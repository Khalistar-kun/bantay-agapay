import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const tokenPattern = /^[0-9a-f]{32}$/i

export async function POST(request: NextRequest) {
  try {
    const staff = await verifyStaff()
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    const origin = request.headers.get("origin")
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Cross-origin request denied" }, { status: 403 })
    }

    const body = await request.json()
    const visitId = body?.visitId
    const token = body?.token
    if ((!visitId && !token) || (visitId && (typeof visitId !== "string" || !uuidPattern.test(visitId))) ||
        (token && (typeof token !== "string" || !tokenPattern.test(token)))) {
      return NextResponse.json({ error: "Invalid visit ID or QR token" }, { status: 400 })
    }

    let query = supabase.from("visits").select("id, visitor_id, pre_registration_id").eq("status", "INSIDE")
    if (visitId) query = query.eq("id", visitId)
    if (token) query = query.eq("public_token", token)
    const { data: visit, error: findError } = await query.maybeSingle()
    if (findError) return NextResponse.json({ error: "Unable to look up visit" }, { status: 500 })
    if (!visit) return NextResponse.json({ error: "No matching active visit" }, { status: 409 })

    // New visitor passes are controlled by the atomic gate checkout RPC.
    // Updating only the visits row would leave pre_registrations as ADMITTED,
    // showing an incorrect live pass and allowing inconsistent repeat actions.
    if (visit.pre_registration_id) {
      const { data, error } = await supabase.rpc("checkout_pre_registration", {
        p_id: visit.pre_registration_id, p_staff_id: staff.profileId
      })
      if (error || !data?.length)
        return NextResponse.json({ error: "Visitor exit could not be recorded. Refresh and retry at the gate." }, { status: 409 })
      return NextResponse.json({
        success: true, visitorName: data[0].visitor_name || "Visitor", status: "EXITED"
      }, { headers: { "Cache-Control": "no-store" } })
    }

    // Conditional legacy checkout is restricted to truly legacy rows.

    const { data: updated, error } = await supabase.from("visits")
      .update({ status: "EXITED", check_out: new Date().toISOString(), checked_out_by: staff.profileId })
      .eq("id", visit.id)
      .eq("status", "INSIDE")
      .is("pre_registration_id", null)
      .select("id")
      .maybeSingle()
    if (error) return NextResponse.json({ error: "Unable to check out visit" }, { status: 500 })
    if (!updated) return NextResponse.json({ error: "Visit was already checked out" }, { status: 409 })

    const { data: visitor } = await supabase.from("visitors")
      .select("full_name").eq("id", visit.visitor_id).maybeSingle()
    return NextResponse.json({ success: true, visitorName: visitor?.full_name || "Visitor" })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
