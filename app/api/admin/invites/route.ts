import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { verifyStaff } from "@/lib/auth/verifyStaff"
import crypto from "crypto"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

const INVITE_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function POST(request: NextRequest) {
  const staff = await verifyStaff()

  if (!staff || staff.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { role } = await request.json().catch(() => ({ role: "SECURITY" }))

  if (role !== "ADMIN" && role !== "SECURITY") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 })
  }

  const token = crypto.randomBytes(24).toString("hex")
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()

  const { error } = await supabase.from("staff_invites").insert({
    token,
    role,
    created_by: staff.profileId,
    expires_at: expiresAt,
  })

  if (error) {
    console.error("Invite creation error:", error)
    return NextResponse.json({ error: "Failed to create invite" }, { status: 500 })
  }

  return NextResponse.json({ token, expiresAt })
}
