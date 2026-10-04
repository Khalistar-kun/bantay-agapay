import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function GET() {
  const staff = await verifyStaff()

  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, phone_number, role, photo_path")
    .eq("id", staff.profileId)
    .single()

  if (error || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 })
  }

  let photoUrl: string | null = null
  if (profile.photo_path) {
    const { data: signed } = await supabase.storage.from("staff-photos").createSignedUrl(profile.photo_path, 300)
    photoUrl = signed?.signedUrl || null
  }

  return NextResponse.json({
    id: profile.id,
    fullName: profile.full_name,
    phoneNumber: profile.phone_number,
    role: profile.role,
    hasPhoto: !!profile.photo_path,
    photoUrl,
  })
}
