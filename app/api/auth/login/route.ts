import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  // Normalize to 11-digit local format (0917...) regardless of +63/63/0 prefix
  if (digits.startsWith("63") && digits.length === 12) return "0" + digits.slice(2)
  if (digits.length === 10) return "0" + digits
  return digits
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, password } = await request.json()

    if (!phoneNumber || !password) {
      return NextResponse.json({ error: "Phone number and password are required" }, { status: 400 })
    }

    const normalized = normalizePhone(phoneNumber)

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, active, password_hash")
      .eq("phone_number", normalized)
      .single()

    if (error || !profile || !profile.password_hash) {
      return NextResponse.json({ error: "Invalid phone number or password" }, { status: 401 })
    }

    if (!profile.active) {
      return NextResponse.json({ error: "This account has been deactivated" }, { status: 403 })
    }

    const passwordMatches = await bcrypt.compare(password, profile.password_hash)

    if (!passwordMatches) {
      return NextResponse.json({ error: "Invalid phone number or password" }, { status: 401 })
    }

    const sessionToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: sessionError } = await supabase
      .from("staff_sessions")
      .insert({ token: sessionToken, profile_id: profile.id, expires_at: expiresAt })

    if (sessionError) {
      console.error("Session creation error:", sessionError)
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 })
    }

    const response = NextResponse.json(
      { success: true, role: profile.role, name: profile.full_name },
      { status: 200 }
    )

    response.cookies.set("staff_session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    })

    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
