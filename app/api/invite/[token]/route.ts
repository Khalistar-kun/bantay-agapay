import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const { data: invite, error } = await supabase
    .from("staff_invites")
    .select("role, used_at, expires_at")
    .eq("token", token)
    .single()

  if (error || !invite) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 })
  }

  if (invite.used_at) {
    return NextResponse.json({ error: "This invite link has already been used" }, { status: 410 })
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite link has expired" }, { status: 410 })
  }

  return NextResponse.json({ role: invite.role })
}
