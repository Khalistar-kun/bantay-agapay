import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function redirectTo(request: NextRequest, pathname: string) {
  const destination = request.nextUrl.clone()
  // Next's internal request URL may be localhost behind the HTTPS tunnel.
  // Keep redirects on the host that the browser is actually using.
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) destination.host = host
  destination.pathname = pathname
  destination.search = ""
  return NextResponse.redirect(destination)
}

export async function middleware(request: NextRequest) {
  const isProtected = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/security")

  if (!isProtected) {
    return NextResponse.next()
  }

  const token = request.cookies.get("staff_session")?.value

  if (!token) {
    return redirectTo(request, "/login")
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
    return redirectTo(request, "/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", session.profile_id)
    .single()

  if (!profile || !profile.active) {
    return redirectTo(request, "/login")
  }

  if (request.nextUrl.pathname.startsWith("/admin") && profile.role !== "ADMIN") {
    return redirectTo(request, "/security")
  }

  if (request.nextUrl.pathname.startsWith("/security") && profile.role !== "SECURITY" && profile.role !== "ADMIN") {
    return redirectTo(request, "/login")
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/security/:path*"],
}
