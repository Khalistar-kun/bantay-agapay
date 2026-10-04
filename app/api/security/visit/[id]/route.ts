import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies()
  const authToken = cookieStore.get("auth_token")?.value

  if (authToken !== "security_token_123" && authToken !== "admin_token_123") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const { data, error } = await supabase.rpc("get_visit_detail", { visit_id: id })

  if (error) {
    console.error("get_visit_detail error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({ error: "Visit not found" }, { status: 404 })
  }

  return NextResponse.json({ visit: data[0] })
}
