"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface InsideVisitor {
  id: string
  reference_number: string
  purpose: string
  check_in: string
  full_name: string
  contact_number: string
  destination_name: string
}

export default function CurrentlyInsidePage() {
  const [visitors, setVisitors] = useState<InsideVisitor[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)

  const fetchInside = async () => {
    try {
      const res = await fetch("/api/security/inside")
      if (res.ok) {
        const { visitors } = await res.json()
        setVisitors(visitors)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInside()
    const interval = setInterval(fetchInside, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleCheckout = async (visitId: string) => {
    setCheckingOut(visitId)
    try {
      const res = await fetch("/api/visit/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId }),
      })

      if (res.ok) {
        await fetchInside()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || "Failed to check out visitor")
      }
    } catch (err) {
      alert("Error checking out visitor")
    } finally {
      setCheckingOut(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bantay-Agapay</h1>
            <Link href="/security" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Currently Inside</h2>
        <p className="text-gray-600 mb-8">Visitors who have been approved and are on campus</p>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : visitors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
            No visitors currently inside
          </div>
        ) : (
          <div className="grid gap-4">
            {visitors.map((v) => (
              <div key={v.id} className="bg-white rounded-lg shadow-md p-6 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {v.reference_number}
                    </span>
                    <span className="text-xs text-gray-500">
                      Checked in {new Date(v.check_in).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900">{v.full_name}</p>
                  <p className="text-sm text-gray-500">{v.contact_number}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Visiting <span className="font-medium">{v.destination_name}</span> — {v.purpose}
                  </p>
                </div>
                <button
                  onClick={() => handleCheckout(v.id)}
                  disabled={checkingOut === v.id}
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
                >
                  {checkingOut === v.id ? "Checking out..." : "Check Out"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
