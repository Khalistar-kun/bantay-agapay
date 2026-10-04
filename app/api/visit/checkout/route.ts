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

  const { visitId } = await request.json()

  if (!visitId) {
    return NextResponse.json({ error: "Missing visitId" }, { status: 400 })
  }

  const { error } = await supabase
    .from("visits")
    .update({ status: "EXITED", check_out: new Date().toISOString() })
    .eq("id", visitId)
    .eq("status", "INSIDE")

  if (error) {
    console.error("Checkout error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
