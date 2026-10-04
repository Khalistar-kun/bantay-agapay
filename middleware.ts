import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: any) {
        cookiesToSet.forEach(({ name, value }: any) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }: any) => response.cookies.set(name, value, options))
      },
    },
  })

  const isProtected = request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/security")

  if (!isProtected) {
    return response
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, active")
    .eq("auth_user_id", user.id)
    .single()

  if (!profile || profile.status !== "APPROVED" || !profile.active) {
    return NextResponse.redirect(new URL("/pending-approval", request.url))
  }

  if (request.nextUrl.pathname.startsWith("/admin") && profile.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/security", request.url))
  }

  if (request.nextUrl.pathname.startsWith("/security") && profile.role !== "SECURITY" && profile.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return response
}

export const config = {
  matcher: ["/admin/:path*", "/security/:path*"],
}
