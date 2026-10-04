"use client"

import { useEffect, useRef, useState } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import QRCode from "qrcode"

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
  const qrCanvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const supabase = createClient()
        const { data, error: fetchError } = await supabase.rpc("get_visit_status", { token } as never)

        const rows = data as
          | {
              status: string
              visitor_name: string
              reference_number: string
              destination_name: string
              approved_at: string | null
              denied_reason: string | null
            }[]
          | null

        if (fetchError || !rows || rows.length === 0) {
          setError("Visit record not found")
          setLoading(false)
          return
        }

        const result = rows[0]

        setVisitStatus({
          status: result.status as VisitStatus["status"],
          visitor_name: result.visitor_name || "Unknown",
          reference_number: result.reference_number || "",
          destination_name: result.destination_name || "Unknown",
          approved_at: result.approved_at,
          denied_reason: result.denied_reason,
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

  useEffect(() => {
    if (visitStatus?.status === "INSIDE" && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, token, { width: 200, margin: 2 }, (err) => {
        if (err) console.error("QR render error:", err)
      })
    }
  }, [visitStatus?.status, token])

  // While the visitor is inside and this page stays open, periodically push
  // their current location so security can see where they are on campus.
  useEffect(() => {
    if (visitStatus?.status !== "INSIDE" || !navigator.geolocation) return

    const pushLocation = () => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const supabase = createClient()
            await supabase.rpc("update_visit_location", {
              p_token: token,
              p_latitude: position.coords.latitude,
              p_longitude: position.coords.longitude,
            } as never)
          } catch (err) {
            console.error("Location update failed:", err)
          }
        },
        () => {
          // Silently ignore - live tracking is best-effort
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
      )
    }

    pushLocation()
    const interval = setInterval(pushLocation, 20000)

    return () => clearInterval(interval)
  }, [visitStatus?.status, token])

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

            <p className="text-center text-gray-500 text-xs mb-6">
              📍 While you're on campus, keep this page open so security can see your location.
            </p>

            <a
              href={`/visit/directions/${token}`}
              className="w-full block text-center bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition mb-6"
            >
              View Campus Map & Directions
            </a>

            <div className="border-t pt-6 text-center">
              <p className="text-sm text-gray-600 mb-3">
                When leaving, show this QR code to security for checkout
              </p>
              <canvas ref={qrCanvasRef} className="mx-auto border rounded-lg p-2" />
            </div>
          </div>
        )}

        {visitStatus?.status === "EXITED" && (
          <div className="bg-white p-8 rounded-lg shadow-md">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-200 mb-4">
                <span className="text-2xl">👋</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-700">Checked Out</h1>
              <p className="text-gray-600 mt-2">Reference: {refNumber}</p>
            </div>

            <p className="text-center text-gray-600 text-sm mb-4">
              Thank you for visiting AFGBMTS. Your visit has been completed.
            </p>

            <a
              href="/"
              className="w-full block text-center bg-gray-600 text-white font-semibold py-3 rounded-lg hover:bg-gray-700 transition"
            >
              Return Home
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
