import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function verifyStaff(): Promise<{ userId: string; role: "ADMIN" | "SECURITY" } | null> {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll() {
          // No-op: API routes don't need to refresh cookies
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status, active")
    .eq("auth_user_id", user.id)
    .single()

  if (!profile || profile.status !== "APPROVED" || !profile.active) return null
  if (profile.role !== "ADMIN" && profile.role !== "SECURITY") return null

  return { userId: user.id, role: profile.role }
}
