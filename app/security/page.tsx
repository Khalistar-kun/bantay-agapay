"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

interface PendingVisitor {
  id: string
  reference_number: string
  full_name: string
  visitor_type: string
  purpose: string
  destination_name: string
  registration_time: string
  contact_number: string
  face_reference_path: string | null
}

export default function SecurityDashboard() {
  const [pendingVisitors, setPendingVisitors] = useState<PendingVisitor[]>([])
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.rpc("get_pending_visitors")
        const visitors: PendingVisitor[] = data || []
        setPendingVisitors(visitors)

        const toFetch = visitors.filter((v) => v.face_reference_path && !photoUrls[v.id])
        for (const v of toFetch) {
          fetch(`/api/visit/face-photo?path=${encodeURIComponent(v.face_reference_path!)}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((result) => {
              if (result?.url) {
                setPhotoUrls((prev) => ({ ...prev, [v.id]: result.url }))
              }
            })
            .catch(() => {})
        }
      } catch (error) {
        console.error("Error fetching pending visitors:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchPending()
    const interval = setInterval(fetchPending, 3000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bantay-Agapay</h1>
            <div className="flex gap-4">
              <Link href="/security/inside" className="text-gray-600 hover:text-gray-900">
                Currently Inside
              </Link>
              <Link href="/security/history" className="text-gray-600 hover:text-gray-900">
                History
              </Link>
              <button className="text-gray-600 hover:text-gray-900">Logout</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Pending Visitors</h2>
          <p className="text-gray-600">Review and approve visitor registrations</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 mt-4">Loading pending visitors...</p>
          </div>
        ) : pendingVisitors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 text-lg">No pending visitors at the moment</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingVisitors.map((visitor) => (
              <div key={visitor.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start">
                  {photoUrls[visitor.id] ? (
                    <img
                      src={photoUrls[visitor.id]}
                      alt={visitor.full_name}
                      className="w-16 h-16 rounded-full object-cover border mr-4 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-gray-100 border mr-4 flex-shrink-0 flex items-center justify-center text-gray-400 text-xs text-center">
                      No Photo
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-4">
                      <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold">
                        {visitor.reference_number}
                      </span>
                      <p className="text-xs text-gray-500">
                        {new Date(visitor.registration_time).toLocaleTimeString()}
                      </p>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{visitor.full_name}</h3>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-500">Visitor Type</p>
                        <p className="font-medium">{visitor.visitor_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Destination</p>
                        <p className="font-medium">{visitor.destination_name}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">Purpose</p>
                        <p className="font-medium">{visitor.purpose}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 ml-4">
                    <Link
                      href={`/security/review/${visitor.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Review
                    </Link>
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
