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

    // Cookie-authenticated staff actions must come from the same website.
    const origin = request.headers.get("origin")
    if (origin && origin !== request.nextUrl.origin) {
      return NextResponse.json({ error: "Cross-origin request denied" }, { status: 403 })
    }

    const body = await request.json()
    const visitId = body?.visitId
    if (typeof visitId !== "string" || !uuidPattern.test(visitId)) {
      return NextResponse.json({ error: "Invalid visit ID" }, { status: 400 })
    }

    // Never accept a replacement public QR token from an approval request.
    // A conditional update prevents APPROVED, EXITED or DENIED visits being reopened.
    const now = new Date().toISOString()
    const { data, error } = await supabase.from("visits")
      .update({ status: "INSIDE", approved_at: now, check_in: now, approved_by: staff.profileId })
      .eq("id", visitId)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle()
    if (error) return NextResponse.json({ error: "Unable to approve visit" }, { status: 500 })
    if (!data) return NextResponse.json({ error: "Visit is not pending or does not exist" }, { status: 409 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
