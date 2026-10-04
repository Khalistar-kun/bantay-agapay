import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { normalizePhone } from "@/lib/utils/phone"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, password } = await request.json()

    if (!phoneNumber || !password) {
      return NextResponse.json({ error: "Phone number and password are required" }, { status: 400 })
    }

    const normalized = normalizePhone(phoneNumber)

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, full_name, role, active, status, password_hash")
      .eq("phone_number", normalized)
      .single()

    if (error || !profile || !profile.password_hash) {
      return NextResponse.json({ error: "Invalid phone number or password" }, { status: 401 })
    }

    const passwordMatches = await bcrypt.compare(password, profile.password_hash)

    if (!passwordMatches) {
      return NextResponse.json({ error: "Invalid phone number or password" }, { status: 401 })
    }

    if (!profile.active) {
      return NextResponse.json({ error: "This account has been deactivated" }, { status: 403 })
    }

    if (profile.status === "PENDING") {
      return NextResponse.json(
        { error: "Your account is awaiting administrator approval. Please check back later." },
        { status: 403 }
      )
    }

    if (profile.status === "REJECTED") {
      return NextResponse.json({ error: "Your registration was not approved. Contact your administrator." }, { status: 403 })
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
