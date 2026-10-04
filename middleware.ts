import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function middleware(request: NextRequest) {
  const isProtected = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/security")

  if (!isProtected) {
    return NextResponse.next()
  }

  const token = request.cookies.get("staff_session")?.value

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: session } = await supabase
    .from("staff_sessions")
    .select("profile_id, expires_at")
    .eq("token", token)
    .single()

  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", session.profile_id)
    .single()

  if (!profile || !profile.active) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (request.nextUrl.pathname.startsWith("/admin") && profile.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/security", request.url))
  }

  if (request.nextUrl.pathname.startsWith("/security") && profile.role !== "SECURITY" && profile.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/security/:path*"],
}
