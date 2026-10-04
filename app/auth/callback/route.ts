import { createServerClient } from "@supabase/ssr"
import { createClient as createServiceClient } from "@supabase/supabase-js"
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const serviceClient = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existingProfile } = await serviceClient
    .from("profiles")
    .select("id, role, status, active")
    .eq("auth_user_id", data.user.id)
    .single()

  if (!existingProfile) {
    const bootstrapAdminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase()
    const isFirstAdmin = bootstrapAdminEmail && data.user.email?.toLowerCase() === bootstrapAdminEmail

    await serviceClient.from("profiles").insert({
      auth_user_id: data.user.id,
      full_name: data.user.user_metadata?.full_name || data.user.email,
      email: data.user.email,
      role: isFirstAdmin ? "ADMIN" : null,
      status: isFirstAdmin ? "APPROVED" : "PENDING",
      active: true,
    })

    if (isFirstAdmin) {
      return NextResponse.redirect(`${origin}/admin`)
    }

    return NextResponse.redirect(`${origin}/pending-approval`)
  }

  if (existingProfile.status !== "APPROVED" || !existingProfile.active) {
    return NextResponse.redirect(`${origin}/pending-approval`)
  }

  return NextResponse.redirect(`${origin}${existingProfile.role === "ADMIN" ? "/admin" : "/security"}`)
}
