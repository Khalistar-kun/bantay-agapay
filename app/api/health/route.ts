import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await client.from("destinations").select("id", { head: true }).limit(1)
    return NextResponse.json(
      { status: error ? "unavailable" : "ok", database: error ? "unavailable" : "connected" },
      { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json({ status: "unavailable", database: "unavailable" }, { status: 503 })
  }
}
