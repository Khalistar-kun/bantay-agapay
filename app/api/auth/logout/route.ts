import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get("staff_session")?.value

  if (token) {
    await supabase.from("staff_sessions").delete().eq("token", token)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete("staff_session")
  return response
}
