import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { consumeRateLimit } from "@/lib/server/rate-limit"
import { normalizePhone } from "@/lib/utils/phone"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function POST(request: NextRequest) {
  try {
    const input = await request.json()
    const identifier = typeof (input.identifier ?? input.phoneNumber) === "string"
      ? String(input.identifier ?? input.phoneNumber).trim() : ""
    const password = input.password
    if (!identifier || identifier.length > 200 || typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Full name or contact number and password are required" }, { status: 400 })
    }

    // Full names are permitted per school requirements, but duplicate names
    // must never silently select another person's account.
    const allowed=await consumeRateLimit(request,'staff-login',identifier.toLowerCase(),12,900)
    if(!allowed)return NextResponse.json({error:'Too many login attempts. Contact your school administrator.'},{status:429})
    const phoneLogin = /^\+?\d[\d\s-]{9,20}$/.test(identifier)
    const lookup = supabase.from("profiles")
      .select("id, full_name, role, active, status, password_hash")
    const { data: matches, error } = await (phoneLogin
      ? lookup.eq("phone_number", normalizePhone(identifier))
      : lookup.eq("full_name", identifier)).limit(2)
    if (error || !matches || matches.length !== 1 || !matches[0].password_hash) {
      return NextResponse.json({ error: "Invalid credentials or ambiguous staff name. Use your contact number." }, { status: 401 })
    }
    const profile = matches[0]

    const passwordMatches = await bcrypt.compare(password, profile.password_hash)

    if (!passwordMatches) {
      return NextResponse.json({ error: "Invalid staff credentials" }, { status: 401 })
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
