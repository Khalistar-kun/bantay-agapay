import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
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

  const { data, error } = await supabase.from("destinations").select("*").order("name")

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ destinations: data || [] })
}

export async function POST(request: NextRequest) {
  const staff = await verifyStaff()

  if (!staff || staff.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { name, category, building, floor, room, description, landmark, directions, latitude, longitude } =
    await request.json()

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }

  const { error } = await supabase.from("destinations").insert({
    name,
    category: category || null,
    building: building || null,
    floor: floor || null,
    room: room || null,
    description: description || null,
    landmark: landmark || null,
    directions: directions || null,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    active: true,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const staff = await verifyStaff()

  if (!staff || staff.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id, active, map_x, map_y } = await request.json()

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  const update: Record<string, unknown> = {}
  if (active !== undefined) update.active = active
  if (map_x !== undefined) update.map_x = map_x
  if (map_y !== undefined) update.map_y = map_y

  const { error } = await supabase.from("destinations").update(update).eq("id", id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
