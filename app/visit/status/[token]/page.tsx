"use client"

import { useEffect, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface VisitStatus {
  status: "PENDING" | "INSIDE" | "EXITED" | "DENIED"
  visitor_name: string
  reference_number: string
  destination_name: string
  approved_at: string | null
  denied_reason: string | null
}

export default function VisitStatusPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const refNumber = searchParams.get("ref")

  const [visitStatus, setVisitStatus] = useState<VisitStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const supabase = createClient()
        const { data, error: fetchError } = await (supabase
          .from("visits")
          .select("*, visitors(full_name), destinations(name)")
          .eq("public_token", token)
          .single() as any)

        if (fetchError || !data) {
          setError("Visit record not found")
          setLoading(false)
          return
        }

        setVisitStatus({
          status: data.status,
          visitor_name: data.visitors?.full_name || "Unknown",
          reference_number: data.reference_number || "",
          destination_name: data.destinations?.name || "Unknown",
          approved_at: data.approved_at,
          denied_reason: data.denial_reason,
        })
      } catch (err) {
        setError("Failed to load visit status")
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      // Poll for updates
      const interval = setInterval(fetchStatus, 2000)
      fetchStatus()

      return () => clearInterval(interval)
    }
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your visit status...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-red-600 font-semibold text-lg">Error</p>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-md w-full mx-auto">
        {visitStatus?.status === "PENDING" && (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 mb-4">
                <span className="text-2xl">⏳</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Awaiting Approval</h1>
              <p className="text-gray-600 mt-2">Reference: {refNumber}</p>
            </div>

            <div className="space-y-4 bg-gray-50 p-4 rounded-lg mb-6">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-semibold">{visitStatus.visitor_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Destination</p>
                <p className="font-semibold">{visitStatus.destination_name}</p>
              </div>
            </div>

            <p className="text-center text-gray-600 text-sm">
              Security is reviewing your registration. This page will update automatically when your entry is approved.
            </p>
          </div>
        )}

        {visitStatus?.status === "INSIDE" && (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <h1 className="text-2xl font-bold text-green-600">Entry Approved</h1>
              <p className="text-gray-600 mt-2">Reference: {refNumber}</p>
            </div>

            <div className="space-y-4 bg-green-50 p-4 rounded-lg mb-6">
              <div>
                <p className="text-sm text-gray-500">Name</p>
                <p className="font-semibold">{visitStatus.visitor_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Destination</p>
                <p className="font-semibold">{visitStatus.destination_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Approved at</p>
                <p className="font-semibold">{new Date(visitStatus.approved_at || "").toLocaleTimeString()}</p>
              </div>
            </div>

            <p className="text-center text-green-700 text-sm font-semibold mb-4">
              You may now enter AFGBMTS. Please proceed to your destination.
            </p>

            <a
              href={`/visit/directions/${token}`}
              className="w-full block text-center bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
            >
              View Campus Map & Directions
            </a>
          </div>
        )}

        {visitStatus?.status === "DENIED" && (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
                <span className="text-2xl">✗</span>
              </div>
              <h1 className="text-2xl font-bold text-red-600">Entry Not Approved</h1>
              <p className="text-gray-600 mt-2">Reference: {refNumber}</p>
            </div>

            <div className="space-y-4 bg-red-50 p-4 rounded-lg mb-6">
              <p className="text-red-700">Your entry request has not been approved at this time.</p>
              {visitStatus.denied_reason && (
                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="text-sm text-red-700">{visitStatus.denied_reason}</p>
                </div>
              )}
            </div>

            <p className="text-center text-gray-600 text-sm mb-4">
              Please contact Security if you believe this is an error.
            </p>

            <a
              href="/"
              className="w-full block text-center bg-gray-600 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition"
            >
              Return Home
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
