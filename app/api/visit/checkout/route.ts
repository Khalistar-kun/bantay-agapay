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

    let query = supabase.from("visits").select("id, visitor_id").eq("status", "INSIDE")
    if (visitId) query = query.eq("id", visitId)
    if (token) query = query.eq("public_token", token)
    const { data: visit, error: findError } = await query.maybeSingle()
    if (findError) return NextResponse.json({ error: "Unable to look up visit" }, { status: 500 })
    if (!visit) return NextResponse.json({ error: "No matching active visit" }, { status: 409 })

    // Conditional update also guards against two simultaneous scans.
    const { data: updated, error } = await supabase.from("visits")
      .update({ status: "EXITED", check_out: new Date().toISOString() })
      .eq("id", visit.id)
      .eq("status", "INSIDE")
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
