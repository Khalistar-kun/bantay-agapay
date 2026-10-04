import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function POST(request: NextRequest) {
  const staff = await verifyStaff()

  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { photo } = await request.json()

  if (!photo) {
    return NextResponse.json({ error: "Missing photo" }, { status: 400 })
  }

  const matches = photo.match(/^data:image\/(\w+);base64,(.+)$/)
  if (!matches) {
    return NextResponse.json({ error: "Invalid photo format" }, { status: 400 })
  }

  const ext = matches[1] === "jpeg" ? "jpg" : matches[1]
  const buffer = Buffer.from(matches[2], "base64")
  const path = `${staff.profileId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage.from("staff-photos").upload(path, buffer, {
    contentType: `image/${matches[1]}`,
    upsert: false,
  })

  if (uploadError) {
    console.error("Staff photo upload error:", uploadError)
    return NextResponse.json({ error: "Failed to upload photo" }, { status: 500 })
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("photo_path")
    .eq("id", staff.profileId)
    .single()

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ photo_path: path })
    .eq("id", staff.profileId)

  if (updateError) {
    return NextResponse.json({ error: "Failed to save photo" }, { status: 500 })
  }

  if (existing?.photo_path) {
    await supabase.storage.from("staff-photos").remove([existing.photo_path])
  }

  return NextResponse.json({ success: true })
}
