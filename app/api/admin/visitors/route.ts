import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function GET(request: NextRequest) {
  const staff = await verifyStaff()

  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const query = request.nextUrl.searchParams.get("q")?.trim()

  let visitorQuery = supabase
    .from("visitors")
    .select("id, full_name, contact_number, visitor_type, created_at")
    .order("created_at", { ascending: false })
    .limit(50)

  if (query) {
    visitorQuery = visitorQuery.or(`full_name.ilike.%${query}%,contact_number.ilike.%${query}%`)
  }

  const { data: visitors, error } = await visitorQuery

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!visitors || visitors.length === 0) {
    return NextResponse.json({ visitors: [] })
  }

  const visitorIds = visitors.map((v) => v.id)
  const { data: visitCounts } = await supabase
    .from("visits")
    .select("visitor_id, status")
    .in("visitor_id", visitorIds)

  const countsByVisitor: Record<string, number> = {}
  const lastStatusByVisitor: Record<string, string> = {}
  for (const v of visitCounts || []) {
    countsByVisitor[v.visitor_id] = (countsByVisitor[v.visitor_id] || 0) + 1
    lastStatusByVisitor[v.visitor_id] = v.status
  }

  const result = visitors.map((v) => ({
    ...v,
    visit_count: countsByVisitor[v.id] || 0,
    last_status: lastStatusByVisitor[v.id] || null,
  }))

  return NextResponse.json({ visitors: result })
}
