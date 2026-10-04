"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { QRCheckoutScanner } from "@/components/security/QRCheckoutScanner"

interface InsideVisitor {
  id: string
  reference_number: string
  purpose: string
  check_in: string
  current_latitude: number | null
  current_longitude: number | null
  location_updated_at: string | null
  full_name: string
  contact_number: string
  destination_name: string
}

declare global {
  interface Window {
    L: any
  }
}

export default function CurrentlyInsidePage() {
  const [visitors, setVisitors] = useState<InsideVisitor[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null)
  const [viewingLocationId, setViewingLocationId] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapInstanceRef = useRef<any>(null)

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

  useEffect(() => {
    const link = document.createElement("link")
    link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"
    link.rel = "stylesheet"
    document.head.appendChild(link)

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [])

  const visitorBeingViewed = visitors.find((v) => v.id === viewingLocationId)

  useEffect(() => {
    if (!viewingLocationId || !mapLoaded) return
    if (!visitorBeingViewed?.current_latitude || !visitorBeingViewed?.current_longitude) return

    const L = window.L
    if (!L) return

    const container = document.getElementById(`live-map-${viewingLocationId}`)
    if (!container) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
      mapInstanceRef.current = null
    }

    const map = L.map(container, { scrollWheelZoom: false }).setView(
      [visitorBeingViewed.current_latitude, visitorBeingViewed.current_longitude],
      18
    )

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map)

    L.marker([visitorBeingViewed.current_latitude, visitorBeingViewed.current_longitude])
      .addTo(map)
      .bindPopup(visitorBeingViewed.full_name)
      .openPopup()

    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [viewingLocationId, mapLoaded, visitorBeingViewed])

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

  const secondsAgo = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 1000)

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

      {showScanner && (
        <QRCheckoutScanner
          onClose={() => setShowScanner(false)}
          onCheckedOut={(visitorName) => {
            setShowScanner(false)
            setCheckoutNotice(`✓ ${visitorName} checked out successfully`)
            fetchInside()
            setTimeout(() => setCheckoutNotice(null), 4000)
          }}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Currently Inside</h2>
            <p className="text-gray-600">Visitors who have been approved and are on campus</p>
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold whitespace-nowrap"
          >
            📷 Scan QR to Check Out
          </button>
        </div>

        {checkoutNotice && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-green-800 font-semibold text-center">
            {checkoutNotice}
          </div>
        )}

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
              <div key={v.id} className="bg-white rounded-lg shadow-md">
                <div className="p-6 flex items-center justify-between">
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
                    {v.current_latitude && v.current_longitude && v.location_updated_at && (
                      <p className="text-xs text-gray-400 mt-1">
                        📍 Location updated {secondsAgo(v.location_updated_at)}s ago
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <button
                      onClick={() => setViewingLocationId(viewingLocationId === v.id ? null : v.id)}
                      disabled={!v.current_latitude || !v.current_longitude}
                      className="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {viewingLocationId === v.id ? "Hide Location" : "📍 View Location"}
                    </button>
                    <button
                      onClick={() => handleCheckout(v.id)}
                      disabled={checkingOut === v.id}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {checkingOut === v.id ? "Checking out..." : "Check Out"}
                    </button>
                  </div>
                </div>

                {viewingLocationId === v.id && (
                  <div className="px-6 pb-6">
                    {v.current_latitude && v.current_longitude ? (
                      <div id={`live-map-${v.id}`} className="w-full h-64 rounded-lg border" />
                    ) : (
                      <p className="text-gray-500 text-sm">No live location available yet for this visitor.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
