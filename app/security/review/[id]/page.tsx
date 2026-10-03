"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

interface VisitDetail {
  id: string
  reference_number: string
  full_name: string
  visitor_type: string
  contact_number: string
  purpose: string
  destination_name: string
  status: string
  registration_time: string
  face_reference_path: string | null
}

export default function SecurityReviewPage() {
  const params = useParams()
  const router = useRouter()
  const visitId = params.id as string

  const [visit, setVisit] = useState<VisitDetail | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showDenyForm, setShowDenyForm] = useState(false)
  const [denyReason, setDenyReason] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchVisit = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc("get_visit_detail", { visit_id: visitId } as never)

        const rows = data as VisitDetail[] | null

        if (error || !rows || rows.length === 0) {
          setError("Visitor record not found")
          return
        }

        const detail: VisitDetail = rows[0]
        setVisit(detail)

        if (detail.face_reference_path) {
          const res = await fetch(`/api/visit/face-photo?path=${encodeURIComponent(detail.face_reference_path)}`)
          if (res.ok) {
            const { url } = await res.json()
            setPhotoUrl(url)
          }
        }
      } catch (err) {
        console.error(err)
        setError("Failed to load visitor record")
      } finally {
        setLoading(false)
      }
    }

    fetchVisit()
  }, [visitId])

  const handleApprove = async () => {
    setProcessing(true)
    try {
      const response = await fetch("/api/visit/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId }),
      })

      if (response.ok) {
        router.push("/security")
      } else {
        const data = await response.json().catch(() => ({}))
        alert(data.error || "Failed to approve visitor")
      }
    } catch (err) {
      alert("Error approving visitor. Please check your connection.")
    } finally {
      setProcessing(false)
    }
  }

  const handleDeny = async () => {
    if (!denyReason.trim()) {
      alert("Please provide a reason for denial")
      return
    }

    setProcessing(true)
    try {
      const response = await fetch("/api/visit/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId, reason: denyReason }),
      })

      if (response.ok) {
        router.push("/security")
      } else {
        const data = await response.json().catch(() => ({}))
        alert(data.error || "Failed to deny visitor")
      }
    } catch (err) {
      alert("Error denying visitor. Please check your connection.")
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 mt-4">Loading visitor record...</p>
        </div>
      </div>
    )
  }

  if (error || !visit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-md">
          <p className="text-red-600 font-semibold mb-4">{error || "Visitor not found"}</p>
          <Link href="/security" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bantay-Agapay</h1>
            <Link href="/security" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Review Visitor</h2>
        <p className="text-gray-600 mb-8">Verify identity and details before approving entry</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Photo */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Captured Face Photo</h3>
            {photoUrl ? (
              <img src={photoUrl} alt="Visitor face" className="w-full aspect-square object-cover rounded-lg border" />
            ) : (
              <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center border">
                <p className="text-gray-500 text-center px-4">No photo was captured during registration</p>
              </div>
            )}
          </div>

          {/* Details */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                {visit.reference_number}
              </span>
              <span className="text-xs text-gray-500">
                {new Date(visit.registration_time).toLocaleString()}
              </span>
            </div>

            <div>
              <p className="text-sm text-gray-500">Full Name</p>
              <p className="text-lg font-semibold">{visit.full_name}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Contact Number</p>
              <p className="font-medium">{visit.contact_number}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Visitor Type</p>
                <p className="font-medium">{visit.visitor_type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Destination</p>
                <p className="font-medium">{visit.destination_name}</p>
              </div>
            </div>

            <div>
              <p className="text-sm text-gray-500">Purpose</p>
              <p className="font-medium">{visit.purpose}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white rounded-lg shadow-md p-6 mt-8">
          {!showDenyForm ? (
            <div className="flex gap-4">
              <button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {processing ? "Processing..." : "✓ Approve Entry"}
              </button>
              <button
                onClick={() => setShowDenyForm(true)}
                disabled={processing}
                className="flex-1 bg-red-600 text-white font-semibold py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                ✕ Deny Entry
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">Reason for denial</label>
              <textarea
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                rows={3}
                placeholder="Explain why this visitor is being denied entry"
              />
              <div className="flex gap-4">
                <button
                  onClick={handleDeny}
                  disabled={processing}
                  className="flex-1 bg-red-600 text-white font-semibold py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                >
                  {processing ? "Processing..." : "Confirm Denial"}
                </button>
                <button
                  onClick={() => setShowDenyForm(false)}
                  disabled={processing}
                  className="flex-1 bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-400 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
