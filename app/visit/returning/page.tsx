"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface Destination {
  id: string
  name: string
  building: string
}

export default function ReturningVisitorPage() {
  const router = useRouter()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [destinationId, setDestinationId] = useState("")
  const [purpose, setPurpose] = useState("")
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loadingDestinations, setLoadingDestinations] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("destinations")
          .select("id, name, building")
          .eq("active", true)
          .order("name")

        if (!error && data) {
          setDestinations(data)
        }
      } finally {
        setLoadingDestinations(false)
      }
    }

    fetchDestinations()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/visit/returning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, destinationId, purpose }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Error processing your request. Please try again.")
        setLoading(false)
        return
      }

      router.push(`/visit/status/${data.token}?ref=${data.visitId}`)
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
            Welcome back to AFGBMTS! If you've visited before, enter your contact number to quickly re-verify and
            enter campus. Security will review and approve your entry.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
              {loadingDestinations ? (
                <div className="animate-pulse bg-gray-200 h-10 rounded-lg"></div>
              ) : (
                <select
                  value={destinationId}
                  onChange={(e) => setDestinationId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Select destination</option>
                  {destinations.map((dest) => (
                    <option key={dest.id} value={dest.id}>
                      {dest.name} ({dest.building})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Purpose of Visit *</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="What is the purpose of your visit?"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm font-semibold">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || loadingDestinations}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Submitting..." : "Verify and Enter"}
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
