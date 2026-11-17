import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
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

  // Philippine local midnight (Asia/Manila, UTC+08:00) for school daily statistics.
  const todayPH = new Date(Date.now() + 8*60*60*1000).toISOString().slice(0,10)
  const startOfDay = todayPH+"T00:00:00+08:00"
  const [todayVisitorsRes,currentlyInsideRes,pendingApprovalRes,completedTodayRes,
    preregTodayRes,entryTodayRes,reviewRes] = await Promise.all([
    supabase.from("visits").select("id",{count:"exact",head:true}).gte("registration_time",startOfDay),
    supabase.from("visits").select("id",{count:"exact",head:true}).eq("status","INSIDE"),
    supabase.from("visits").select("id",{count:"exact",head:true}).eq("status","PENDING"),
    supabase.from("visits").select("id",{count:"exact",head:true}).eq("status","EXITED").gte("check_out",startOfDay),
    supabase.from("pre_registrations").select("id",{count:"exact",head:true}).gte("submitted_at",startOfDay),
    supabase.from("visits").select("id",{count:"exact",head:true}).gte("check_in",startOfDay),
    supabase.from("security_incidents").select("id",{count:"exact",head:true}).eq("status","OPEN"),
  ])

  return NextResponse.json({
    todayVisitors: todayVisitorsRes.count ?? 0,
    currentlyInside: currentlyInsideRes.count ?? 0,
    pendingApproval: pendingApprovalRes.count ?? 0,
    completedToday: completedTodayRes.count ?? 0,
    preRegisteredToday: preregTodayRes.count ?? 0,
    entriesToday: entryTodayRes.count ?? 0,
    openCases: reviewRes.count ?? 0,
  })
}
