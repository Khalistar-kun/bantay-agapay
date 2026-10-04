"use client"

import { createAuthClient } from "@/lib/supabase/auth-client"
import { useRouter } from "next/navigation"

export default function PendingApprovalPage() {
  const router = useRouter()

  const handleSignOut = async () => {
    const supabase = createAuthClient()
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md text-center">
        <div className="text-5xl mb-4">⏳</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Awaiting Approval</h1>
        <p className="text-gray-600 mb-8">
          Your account has been created but needs an administrator to approve it and assign a role before you can
          access the dashboard. Please check back later or contact your school administrator.
        </p>
        <button
          onClick={handleSignOut}
          className="w-full bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-300 transition"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
