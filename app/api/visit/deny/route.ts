import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function POST(request: NextRequest) {
  try {
    const staff = await verifyStaff()

    if (!staff) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { visitId, reason } = await request.json()

    if (!visitId || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { data: profile } = await supabase.from("profiles").select("id").eq("auth_user_id", staff.userId).single()

    const { error } = await supabase
      .from("visits")
      .update({
        status: "DENIED",
        denied_at: new Date().toISOString(),
        denial_reason: reason,
        denied_by: profile?.id ?? null,
      })
      .eq("id", visitId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
