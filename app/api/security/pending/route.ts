import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function GET() {
  const cookieStore = await cookies()
  const authToken = cookieStore.get("auth_token")?.value

  if (authToken !== "security_token_123" && authToken !== "admin_token_123") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data, error } = await supabase.rpc("get_pending_visitors")

  if (error) {
    console.error("get_pending_visitors error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ visitors: data || [] })
}
