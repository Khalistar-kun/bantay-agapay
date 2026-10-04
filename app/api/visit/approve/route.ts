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

    const { visitId, token } = await request.json()

    if (!visitId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const update: Record<string, unknown> = {
      status: "INSIDE",
      approved_at: new Date().toISOString(),
      check_in: new Date().toISOString(),
      approved_by: staff.profileId,
    }

    if (token) {
      update.public_token = token
    }

    const { error } = await supabase.from("visits").update(update).eq("id", visitId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
