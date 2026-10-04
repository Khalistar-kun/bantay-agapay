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

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [todayVisitorsRes, currentlyInsideRes, pendingApprovalRes, completedTodayRes] = await Promise.all([
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .gte("registration_time", startOfDay.toISOString()),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("status", "INSIDE"),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    supabase
      .from("visits")
      .select("id", { count: "exact", head: true })
      .eq("status", "EXITED")
      .gte("check_out", startOfDay.toISOString()),
  ])

  return NextResponse.json({
    todayVisitors: todayVisitorsRes.count ?? 0,
    currentlyInside: currentlyInsideRes.count ?? 0,
    pendingApproval: pendingApprovalRes.count ?? 0,
    completedToday: completedTodayRes.count ?? 0,
  })
}
