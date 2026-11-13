import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    const reason = body?.reason
    if (typeof visitId !== "string" || !uuidPattern.test(visitId) ||
        typeof reason !== "string" || !reason.trim() || reason.trim().length > 500) {
      return NextResponse.json({ error: "Invalid visit ID or denial reason" }, { status: 400 })
    }
    const { data, error } = await supabase.from("visits")
      .update({
        status: "DENIED",
        denied_at: new Date().toISOString(),
        denial_reason: reason.trim(),
        denied_by: staff.profileId,
      })
      .eq("id", visitId)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle()
    if (error) return NextResponse.json({ error: "Unable to deny visit" }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Visit is not pending or does not exist" }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
