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

  const { visitId, token } = await request.json()

  if (!visitId && !token) {
    return NextResponse.json({ error: "Missing visitId or token" }, { status: 400 })
  }

  let query = supabase.from("visits").select("id, status, visitor_id").eq("status", "INSIDE")
  query = visitId ? query.eq("id", visitId) : query.eq("public_token", token)

  const { data: visit, error: findError } = await query.single()

  if (findError || !visit) {
    return NextResponse.json(
      { error: "No active visit found for this code. The visitor may already be checked out." },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from("visits")
    .update({ status: "EXITED", check_out: new Date().toISOString() })
    .eq("id", visit.id)
    .eq("status", "INSIDE")

  if (error) {
    console.error("Checkout error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: visitor } = await supabase.from("visitors").select("full_name").eq("id", visit.visitor_id).single()

  return NextResponse.json({ success: true, visitorName: visitor?.full_name || "Visitor" })
}
