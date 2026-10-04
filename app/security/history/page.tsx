"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface HistoryVisit {
  id: string
  reference_number: string
  purpose: string
  status: "EXITED" | "DENIED" | "CANCELLED"
  registration_time: string
  check_in: string | null
  check_out: string | null
  denial_reason: string | null
  full_name: string
  contact_number: string
  destination_name: string
}

const statusStyles: Record<string, string> = {
  EXITED: "bg-gray-200 text-gray-700",
  DENIED: "bg-red-100 text-red-800",
  CANCELLED: "bg-yellow-100 text-yellow-800",
}

export default function VisitHistoryPage() {
  const [visits, setVisits] = useState<HistoryVisit[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/security/history")
        if (res.ok) {
          const { visits } = await res.json()
          setVisits(visits)
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [])

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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Visit History</h2>
        <p className="text-gray-600 mb-8">Completed, denied, and cancelled visits (most recent 100)</p>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : visits.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">No visit history yet</div>
        ) : (
          <div className="bg-white rounded-lg shadow-md divide-y">
            {visits.map((v) => (
              <div key={v.id} className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                        {v.reference_number}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusStyles[v.status]}`}>
                        {v.status}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{v.full_name}</p>
                    <p className="text-sm text-gray-500">{v.contact_number}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {v.destination_name} — {v.purpose}
                    </p>
                    {v.status === "DENIED" && v.denial_reason && (
                      <p className="text-sm text-red-700 mt-1">Reason: {v.denial_reason}</p>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>Registered: {new Date(v.registration_time).toLocaleString()}</p>
                    {v.check_in && <p>Checked in: {new Date(v.check_in).toLocaleString()}</p>}
                    {v.check_out && <p>Checked out: {new Date(v.check_out).toLocaleString()}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
