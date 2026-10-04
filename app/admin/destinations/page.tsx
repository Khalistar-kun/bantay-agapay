"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"

interface Destination {
  id: string
  name: string
  category: string | null
  building: string | null
  floor: string | null
  room: string | null
  description: string | null
  landmark: string | null
  directions: string | null
  latitude: number | null
  longitude: number | null
  active: boolean
}

declare global {
  interface Window {
    L: any
  }
}

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [pinningId, setPinningId] = useState<string | null>(null)
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const mapMarkerRef = useRef<any>(null)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [building, setBuilding] = useState("")
  const [floor, setFloor] = useState("")
  const [room, setRoom] = useState("")
  const [description, setDescription] = useState("")
  const [landmark, setLandmark] = useState("")
  const [directions, setDirections] = useState("")
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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

  const fetchDestinations = async () => {
    try {
      const res = await fetch("/api/admin/destinations")
      if (res.ok) {
        const { destinations } = await res.json()
        setDestinations(destinations)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDestinations()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)

    try {
      const res = await fetch("/api/admin/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category, building, floor, room, description, landmark, directions }),
      })

      if (res.ok) {
        setName("")
        setCategory("")
        setBuilding("")
        setFloor("")
        setRoom("")
        setDescription("")
        setLandmark("")
        setDirections("")
        setShowForm(false)
        await fetchDestinations()
      } else {
        const data = await res.json().catch(() => ({}))
        setCreateError(data.error || "Failed to create destination")
      }
    } catch (err) {
      setCreateError("Error creating destination")
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (d: Destination) => {
    setUpdating(d.id)
    try {
      const res = await fetch("/api/admin/destinations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: d.id, active: !d.active }),
      })

      if (res.ok) {
        await fetchDestinations()
      } else {
        alert("Failed to update destination")
      }
    } finally {
      setUpdating(null)
    }
  }

  const openPinMap = (d: Destination) => {
    setPinningId(d.id)
    setPinCoords(
      d.latitude && d.longitude ? { lat: d.latitude, lng: d.longitude } : { lat: 14.737, lng: 120.9728 }
    )
  }

  useEffect(() => {
    if (!pinningId || !mapLoaded || !pinCoords) return

    const L = window.L
    if (!L) return

    const container = document.getElementById(`pin-map-${pinningId}`)
    if (!container) return

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove()
    }

    const map = L.map(container).setView([pinCoords.lat, pinCoords.lng], 18)
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker([pinCoords.lat, pinCoords.lng], { draggable: true }).addTo(map)

    marker.on("dragend", () => {
      const pos = marker.getLatLng()
      setPinCoords({ lat: pos.lat, lng: pos.lng })
    })

    map.on("click", (e: any) => {
      marker.setLatLng(e.latlng)
      setPinCoords({ lat: e.latlng.lat, lng: e.latlng.lng })
    })

    mapInstanceRef.current = map
    mapMarkerRef.current = marker

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinningId, mapLoaded])

  const handleSavePin = async (id: string) => {
    if (!pinCoords) return
    setUpdating(id)
    try {
      const res = await fetch("/api/admin/destinations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, latitude: pinCoords.lat, longitude: pinCoords.lng }),
      })

      if (res.ok) {
        setPinningId(null)
        await fetchDestinations()
      } else {
        alert("Failed to save location")
      }
    } finally {
      setUpdating(null)
    }
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Destinations</h2>
            <p className="text-gray-600">Manage rooms and offices visitors can visit</p>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            {showForm ? "Cancel" : "+ New Destination"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-lg shadow-md p-6 mb-8 space-y-4">
            {createError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{createError}</div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Administration, Academic, etc."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Building</label>
                <input
                  type="text"
                  value={building}
                  onChange={(e) => setBuilding(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Floor</label>
                <input
                  type="text"
                  value={floor}
                  onChange={(e) => setFloor(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Landmark</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Beside Guidance Office"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Directions</label>
                <input
                  type="text"
                  value={directions}
                  onChange={(e) => setDirections(e.target.value)}
                  placeholder="Step-by-step directions visitors will read"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="bg-green-600 text-white font-semibold px-6 py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Destination"}
            </button>
          </form>
        )}

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md divide-y">
            {destinations.map((d) => (
              <div key={d.id}>
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">{d.name}</p>
                    <p className="text-sm text-gray-500">
                      {[d.building, d.floor, d.room].filter(Boolean).join(" · ") || "No location details"}
                    </p>
                    <p className="text-xs mt-1">
                      {d.latitude && d.longitude ? (
                        <span className="text-green-700">📍 Location pinned</span>
                      ) : (
                        <span className="text-yellow-700">⚠ No map location set</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => (pinningId === d.id ? setPinningId(null) : openPinMap(d))}
                      className="px-3 py-1 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 transition"
                    >
                      {pinningId === d.id ? "Close Map" : "Pin Location"}
                    </button>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        d.active ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {d.active ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() => toggleActive(d)}
                      disabled={updating === d.id}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      {d.active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>

                {pinningId === d.id && (
                  <div className="px-6 pb-6">
                    <p className="text-sm text-gray-600 mb-2">Click or drag the pin to set this destination's exact location.</p>
                    <div id={`pin-map-${d.id}`} className="w-full h-64 rounded-lg border" />
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-gray-500">
                        {pinCoords ? `${pinCoords.lat.toFixed(5)}, ${pinCoords.lng.toFixed(5)}` : ""}
                      </p>
                      <button
                        onClick={() => handleSavePin(d.id)}
                        disabled={updating === d.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 text-sm font-semibold"
                      >
                        {updating === d.id ? "Saving..." : "Save Location"}
                      </button>
                    </div>
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
