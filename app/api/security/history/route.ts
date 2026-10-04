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
      "id, reference_number, purpose, status, registration_time, check_in, check_out, denial_reason, visitors(full_name, contact_number), destinations(name)"
    )
    .in("status", ["EXITED", "DENIED", "CANCELLED"])
    .order("registration_time", { ascending: false })
    .limit(100)

  if (error) {
    console.error("Error fetching visit history:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const visits = (data || []).map((v: any) => ({
    id: v.id,
    reference_number: v.reference_number,
    purpose: v.purpose,
    status: v.status,
    registration_time: v.registration_time,
    check_in: v.check_in,
    check_out: v.check_out,
    denial_reason: v.denial_reason,
    full_name: v.visitors?.full_name || "Unknown",
    contact_number: v.visitors?.contact_number || "",
    destination_name: v.destinations?.name || "Unknown",
  }))

  return NextResponse.json({ visits })
}
