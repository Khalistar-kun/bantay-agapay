import { createClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function GET(request: NextRequest) {
  const cookieStore = await cookies()
  const authToken = cookieStore.get("auth_token")?.value

  if (authToken !== "security_token_123" && authToken !== "admin_token_123") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const path = request.nextUrl.searchParams.get("path")

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 })
  }

  const { data, error } = await supabase.storage.from("visitor-faces").createSignedUrl(path, 300)

  if (error || !data) {
    return NextResponse.json({ error: "Failed to generate photo URL" }, { status: 500 })
  }

  return NextResponse.json({ url: data.signedUrl })
}
