import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { normalizePhone } from "@/lib/utils/phone"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const { fullName, phoneNumber, password } = await request.json()

  if (!fullName || !phoneNumber || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }

  const { data: invite, error: inviteError } = await supabase
    .from("staff_invites")
    .select("role, used_at, expires_at")
    .eq("token", token)
    .single()

  if (inviteError || !invite) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: "This invite link has already been used" }, { status: 410 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite link has expired" }, { status: 410 })
  }

  const normalized = normalizePhone(phoneNumber)
  const passwordHash = await bcrypt.hash(password, 10)

  const { data: newProfile, error: createError } = await supabase
    .from("profiles")
    .insert({
      full_name: fullName,
      phone_number: normalized,
      password_hash: passwordHash,
      role: invite.role,
      status: "PENDING",
      active: true,
    })
    .select("id")
    .single()

  if (createError || !newProfile) {
    if (createError?.code === "23505") {
      return NextResponse.json({ error: "An account with this phone number already exists" }, { status: 409 })
    }
    console.error("Self-registration error:", createError)
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }

  // Mark the invite used now, atomically guarding against a second concurrent
  // submission racing to use the same token.
  const { error: consumeError, count } = await supabase
    .from("staff_invites")
    .update({ used_at: new Date().toISOString(), used_by_profile_id: newProfile.id }, { count: "exact" })
    .eq("token", token)
    .is("used_at", null)

  if (consumeError || count === 0) {
    // Someone else used this invite in the same instant; roll back the profile we just created.
    await supabase.from("profiles").delete().eq("id", newProfile.id)
    return NextResponse.json({ error: "This invite link has already been used" }, { status: 410 })
  }

  return NextResponse.json({ success: true })
}
