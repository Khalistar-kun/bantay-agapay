import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"

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
    .select("id, full_name, email, role, status, active, created_at")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ personnel: data || [] })
}

export async function PATCH(request: NextRequest) {
  const staff = await verifyStaff()

  if (!staff || staff.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { profileId, role, status, active } = await request.json()

  if (!profileId) {
    return NextResponse.json({ error: "Missing profileId" }, { status: 400 })
  }

  if (role && role !== "ADMIN" && role !== "SECURITY") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (role !== undefined) update.role = role
  if (status !== undefined) update.status = status
  if (active !== undefined) update.active = active

  const { error } = await supabase.from("profiles").update(update).eq("id", profileId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
