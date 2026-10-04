import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"
import bcrypt from "bcryptjs"
import { normalizePhone } from "@/lib/utils/phone"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function GET() {
  const staff = await verifyStaff()

  if (!staff || staff.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone_number, role, active, created_at, photo_path")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const personnel = await Promise.all(
    (data || []).map(async (p) => {
      let photoUrl: string | null = null
      if (p.photo_path) {
        const { data: signed } = await supabase.storage.from("staff-photos").createSignedUrl(p.photo_path, 300)
        photoUrl = signed?.signedUrl || null
      }
      const { photo_path, ...rest } = p
      return { ...rest, photoUrl }
    })
  )

  return NextResponse.json({ personnel })
}

export async function POST(request: NextRequest) {
  const staff = await verifyStaff()

  if (!staff || staff.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { fullName, phoneNumber, password, role } = await request.json()

  if (!fullName || !phoneNumber || !password || !role) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 })
  }

  if (role !== "ADMIN" && role !== "SECURITY") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }

  const normalized = normalizePhone(phoneNumber)
  const passwordHash = await bcrypt.hash(password, 10)

  const { error } = await supabase.from("profiles").insert({
    full_name: fullName,
    phone_number: normalized,
    password_hash: passwordHash,
    role,
    active: true,
  })

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "An account with this phone number already exists" }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const staff = await verifyStaff()

  if (!staff || staff.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { profileId, role, active } = await request.json()

  if (!profileId) {
    return NextResponse.json({ error: "Missing profileId" }, { status: 400 })
  }

  if (role && role !== "ADMIN" && role !== "SECURITY") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (role !== undefined) update.role = role
  if (active !== undefined) update.active = active

  const { error } = await supabase.from("profiles").update(update).eq("id", profileId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (active === false) {
    await supabase.from("staff_sessions").delete().eq("profile_id", profileId)
  }

  return NextResponse.json({ success: true })
}
