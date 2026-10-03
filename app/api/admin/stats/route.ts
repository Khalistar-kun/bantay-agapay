import { NextResponse } from "next/server"

export async function GET() {
  // Demo stats - in production fetch from Supabase
  return NextResponse.json({
    todayVisitors: 12,
    currentlyInside: 5,
    pendingApproval: 3,
    completedToday: 4,
  })
}
