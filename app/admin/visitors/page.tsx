"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"

interface VisitorRecord {
  id: string
  full_name: string
  contact_number: string
  visitor_type: string
  created_at: string
  visit_count: number
  last_status: string | null
}

export default function VisitorRecordsPage() {
  const [visitors, setVisitors] = useState<VisitorRecord[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)

  const fetchVisitors = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/visitors${q ? `?q=${encodeURIComponent(q)}` : ""}`)
      if (res.ok) {
        const { visitors } = await res.json()
        setVisitors(visitors)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVisitors("")
  }, [fetchVisitors])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchVisitors(query)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bantay-Agapay Admin</h1>
            <Link href="/admin" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Visitor Records</h2>
        <p className="text-gray-600 mb-6">Search registered visitors and their visit history</p>

        <form onSubmit={handleSearch} className="flex gap-3 mb-8">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone number"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Search
          </button>
        </form>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : visitors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">No visitors found</div>
        ) : (
          <div className="bg-white rounded-lg shadow-md divide-y">
            {visitors.map((v) => (
              <div key={v.id} className="p-6 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{v.full_name}</p>
                  <p className="text-sm text-gray-500">{v.contact_number}</p>
                  <p className="text-sm text-gray-600 mt-1">{v.visitor_type}</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>{v.visit_count} visit{v.visit_count === 1 ? "" : "s"}</p>
                  {v.last_status && <p className="mt-1">Last status: {v.last_status}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
