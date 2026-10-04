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

  const { data, error } = await supabase
    .from("visits")
    .select(
      "id, reference_number, purpose, check_in, current_latitude, current_longitude, location_updated_at, visitors(full_name, contact_number), destinations(name)"
    )
    .eq("status", "INSIDE")
    .order("check_in", { ascending: false })

  if (error) {
    console.error("Error fetching visitors inside:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const visitors = (data || []).map((v: any) => ({
    id: v.id,
    reference_number: v.reference_number,
    purpose: v.purpose,
    check_in: v.check_in,
    current_latitude: v.current_latitude,
    current_longitude: v.current_longitude,
    location_updated_at: v.location_updated_at,
    full_name: v.visitors?.full_name || "Unknown",
    contact_number: v.visitors?.contact_number || "",
    destination_name: v.destinations?.name || "Unknown",
  }))

  return NextResponse.json({ visitors })
}
