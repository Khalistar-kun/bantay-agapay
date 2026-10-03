"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default function ReturningVisitorPage() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Normalize phone number
      const normalized = phoneNumber.replace(/\D/g, "").slice(-10)

      const supabase = createClient()

      // Find visitor by phone number
      const { data: visitors, error: searchError } = await supabase
        .from("visitors")
        .select("id, full_name, visitor_type")
        .ilike("contact_number", `%${normalized}%`)
        .limit(1)

      if (searchError || !visitors || visitors.length === 0) {
        setError("Phone number not found. Please register as a new visitor.")
        setLoading(false)
        return
      }

      const visitor = visitors[0]

      // Create visit via API
      const visitResponse = await fetch("/api/visit/returning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorId: (visitor as any).id }),
      })

      if (!visitResponse.ok) {
        setError("Error creating visit record. Please try again.")
        setLoading(false)
        return
      }

      const { visitId } = await visitResponse.json()

      // Redirect to security confirmation
      router.push(
        `/visit/returning/confirm?phone=${encodeURIComponent(phoneNumber)}&visitor=${encodeURIComponent((visitor as any).full_name)}&visitId=${visitId}`
      )
    } catch (err) {
      setError("An error occurred. Please try again.")
      console.error(err)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 py-8">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Returning Visitor</p>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-gray-700 mb-6">
            Welcome back to AFGBMTS! If you've visited before, enter your contact number to quickly re-verify and enter campus.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Number *
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="09XX-XXX-XXXX"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">The number you used during your previous visit</p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-semibold">{error}</p>
            </div>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Looking up..." : "Verify and Enter"}
            </button>
          </form>

          <div className="border-t pt-6 mt-6">
            <p className="text-gray-600 text-sm mb-4">Is this your first visit?</p>
            <Link
              href="/visit"
              className="w-full block text-center bg-gray-100 text-gray-900 font-semibold py-3 rounded-lg hover:bg-gray-200 transition"
            >
              New Visitor Registration
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
