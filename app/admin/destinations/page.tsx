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
  map_x: number | null
  map_y: number | null
  active: boolean
}

const MAP_WIDTH = 2048
const MAP_HEIGHT = 1536

export default function DestinationsPage() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [pinningId, setPinningId] = useState<string | null>(null)
  const [pinCoords, setPinCoords] = useState<{ x: number; y: number } | null>(null)
  const mapImgRef = useRef<HTMLImageElement>(null)

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
    setPinCoords(d.map_x !== null && d.map_y !== null ? { x: d.map_x, y: d.map_y } : null)
  }

  const handleMapClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = mapImgRef.current
    if (!img) return

    const rect = img.getBoundingClientRect()
    const clickXRatio = (e.clientX - rect.left) / rect.width
    const clickYRatio = (e.clientY - rect.top) / rect.height

    setPinCoords({
      x: Math.round(clickXRatio * MAP_WIDTH),
      y: Math.round(clickYRatio * MAP_HEIGHT),
    })
  }

  const handleSavePin = async (id: string) => {
    if (!pinCoords) return
    setUpdating(id)
    try {
      const res = await fetch("/api/admin/destinations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, map_x: pinCoords.x, map_y: pinCoords.y }),
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
            <p className="text-gray-600">Manage campus buildings visitors can visit</p>
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
                      {d.map_x !== null && d.map_y !== null ? (
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
                    <p className="text-sm text-gray-600 mb-2">Click on the map to set this destination's marker position.</p>
                    <div className="relative w-full border rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        ref={mapImgRef}
                        src="/campus-map.png"
                        alt="Campus map"
                        onClick={handleMapClick}
                        className="w-full h-auto cursor-crosshair select-none"
                        draggable={false}
                      />
                      {pinCoords && (
                        <div
                          className="absolute w-5 h-5 -ml-2.5 -mt-5 pointer-events-none"
                          style={{
                            left: `${(pinCoords.x / MAP_WIDTH) * 100}%`,
                            top: `${(pinCoords.y / MAP_HEIGHT) * 100}%`,
                          }}
                        >
                          <div className="w-5 h-5 bg-red-600 rounded-full border-2 border-white shadow-lg animate-pulse" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-gray-500">
                        {pinCoords ? `x: ${pinCoords.x}, y: ${pinCoords.y}` : "Click the map to place a marker"}
                      </p>
                      <button
                        onClick={() => handleSavePin(d.id)}
                        disabled={updating === d.id || !pinCoords}
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
