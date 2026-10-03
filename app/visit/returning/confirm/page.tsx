"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState } from "react"

export const dynamic = "force-dynamic"

export default function ConfirmReturningVisitorPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const phone = searchParams.get("phone") || ""
  const visitorName = searchParams.get("visitor") || ""
  const visitId = searchParams.get("visitId") || ""

  const [approving, setApproving] = useState(false)
  const [denying, setDenying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleApprove = async () => {
    setApproving(true)
    setError(null)

    try {
      const token = Math.random().toString(36).substring(2, 15)

      // Use API to approve
      const response = await fetch("/api/visit/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId, token }),
      })

      if (!response.ok) {
        setError("Error approving visitor")
        setApproving(false)
        return
      }

      alert("✓ Visitor approved and allowed entry!")
      router.push(`/visit/status/${token}`)
    } catch (err) {
      setError("Error processing approval")
      console.error(err)
      setApproving(false)
    }
  }

  const handleDeny = async () => {
    setDenying(true)
    setError(null)

    const reason = prompt("Reason for denial:")
    if (!reason) {
      setDenying(false)
      return
    }

    try {
      // Use API to deny
      const response = await fetch("/api/visit/deny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId, reason }),
      })

      if (!response.ok) {
        setError("Error denying visitor")
        setDenying(false)
        return
      }

      alert("✓ Visitor denied entry")
      router.push("/security")
    } catch (err) {
      setError("Error processing denial")
      console.error(err)
      setDenying(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-3xl font-bold mb-2">Confirm Entry</h1>
        <p className="text-gray-600 mb-8">Returning Visitor Verification</p>

        <div className="bg-white p-8 rounded-lg shadow-md space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-gray-600">Visitor Name</p>
            <p className="text-2xl font-bold text-gray-900">{visitorName}</p>
          </div>

          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-gray-600">Contact Number</p>
            <p className="text-lg font-semibold text-gray-900">{phone}</p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 text-sm font-semibold">
              ⚠️ This is a returning visitor requesting re-entry. Please verify identity before approving.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 text-sm font-semibold">{error}</p>
            </div>
          )}

          <div className="space-y-3 pt-4">
            <button
              onClick={handleApprove}
              disabled={approving || denying}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {approving ? "Processing..." : "✓ Approve Entry"}
            </button>

            <button
              onClick={handleDeny}
              disabled={approving || denying}
              className="w-full bg-red-600 text-white font-semibold py-3 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
            >
              {denying ? "Processing..." : "✗ Deny Entry"}
            </button>

            <button
              onClick={() => router.back()}
              disabled={approving || denying}
              className="w-full bg-gray-300 text-gray-900 font-semibold py-3 rounded-lg hover:bg-gray-400 transition disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
