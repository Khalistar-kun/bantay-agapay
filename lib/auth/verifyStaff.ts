import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
)

export async function verifyStaff(): Promise<{ profileId: string; role: "ADMIN" | "SECURITY" } | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("staff_session")?.value

  if (!token) return null

  const { data: session } = await supabase
    .from("staff_sessions")
    .select("profile_id, expires_at")
    .eq("token", token)
    .single()

  if (!session || new Date(session.expires_at) < new Date()) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, active, status")
    .eq("id", session.profile_id)
    .single()

  if (!profile || !profile.active) return null
  if (profile.status !== "APPROVED") return null
  if (profile.role !== "ADMIN" && profile.role !== "SECURITY") return null

  return { profileId: profile.id, role: profile.role }
}
