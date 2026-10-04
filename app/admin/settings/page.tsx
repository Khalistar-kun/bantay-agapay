"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface SchoolSettings {
  latitude: number
  longitude: number
  radius: number
  schoolName: string
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SchoolSettings>({
    latitude: 14.737,
    longitude: 120.9728,
    radius: 500,
    schoolName: "AFGBMTS - Won St, Deca Homes Saluysoy, Meycauayan",
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/admin/settings")
        if (res.ok) {
          const data = await res.json()
          setSettings({
            latitude: data.latitude,
            longitude: data.longitude,
            radius: data.radius,
            schoolName: data.schoolName,
          })
        }
      } catch (err) {
        console.error("Failed to load existing settings:", err)
      } finally {
        setSettingsLoaded(true)
      }
    }

    fetchSettings()
  }, [])

  useEffect(() => {
    // Load Leaflet (OpenStreetMap based)
    const link = document.createElement("link")
    link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"
    link.rel = "stylesheet"
    document.head.appendChild(link)

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.onload = () => {
      setMapLoaded(true)
    }
    script.onerror = () => {
      console.error("Failed to load Leaflet")
    }
    document.head.appendChild(script)

    return () => {
      // Cleanup if needed
    }
  }, [])

  useEffect(() => {
    if (mapLoaded && settingsLoaded && settings.latitude && settings.longitude) {
      initializeMap()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, settingsLoaded, settings.latitude, settings.longitude])

  const initializeMap = () => {
    if (typeof window === "undefined") return

    const L = (window as any).L
    if (!L) return

    const mapContainer = document.getElementById("map")
    if (!mapContainer) return

    try {
      // Clear existing map
      if ((window as any).mapInstance) {
        (window as any).mapInstance.remove()
      }

      const map = L.map("map").setView([settings.latitude, settings.longitude], 15)

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map)

      // Add draggable marker
      let marker = L.marker([settings.latitude, settings.longitude], { draggable: true })
        .addTo(map)
        .bindPopup(`<strong>${settings.schoolName}</strong><br>Geofence: ${settings.radius}m`)
        .openPopup()

      // Update coordinates when marker is dragged
      marker.on("dragend", () => {
        const newLatLng = marker.getLatLng()
        setSettings({
          ...settings,
          latitude: parseFloat(newLatLng.lat.toFixed(4)),
          longitude: parseFloat(newLatLng.lng.toFixed(4)),
        })
        updateCircle(newLatLng.lat, newLatLng.lng)
      })

      // Add circle for geofence
      const circleLayer = L.circle([settings.latitude, settings.longitude], {
        color: "blue",
        fillColor: "#30b0ff",
        fillOpacity: 0.2,
        radius: settings.radius,
      }).addTo(map)

      ;(window as any).mapInstance = map
      ;(window as any).mapMarker = marker
      ;(window as any).mapCircle = circleLayer

      // Handle map clicks to place marker
      map.on("click", (e: any) => {
        const lat = parseFloat(e.latlng.lat.toFixed(4))
        const lng = parseFloat(e.latlng.lng.toFixed(4))

        setSettings({
          ...settings,
          latitude: lat,
          longitude: lng,
        })

        marker.setLatLng([lat, lng])
        updateCircle(lat, lng)
      })
    } catch (err) {
      console.error("Error initializing map:", err)
    }
  }

  const updateCircle = (lat: number, lng: number, radius?: number) => {
    if ((window as any).mapCircle) {
      ;(window as any).mapCircle.setLatLng([lat, lng])
      if (radius !== undefined) {
        ;(window as any).mapCircle.setRadius(radius)
      }
    }
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      if (response.ok) {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bantay-Agapay Admin</h1>
            <Link href="/admin" className="text-blue-600 hover:text-blue-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Settings Form */}
          <div className="bg-white rounded-lg shadow-md p-8">
            <h2 className="text-2xl font-bold mb-6">School Location Settings</h2>

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-green-800 font-semibold">✓ Settings saved successfully!</p>
              </div>
            )}

            <div className="space-y-6">
              {/* School Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  School Name
                </label>
                <input
                  type="text"
                  value={settings.schoolName}
                  onChange={(e) => setSettings({ ...settings, schoolName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="School name and address"
                />
              </div>

              {/* Latitude */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Latitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={settings.latitude}
                  onChange={(e) => setSettings({ ...settings, latitude: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="14.7370"
                />
              </div>

              {/* Longitude */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longitude
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={settings.longitude}
                  onChange={(e) => setSettings({ ...settings, longitude: parseFloat(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  placeholder="120.9728"
                />
              </div>

              {/* Geofence Radius */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Geofence Radius: {settings.radius}m
                </label>

                {/* Slider */}
                <input
                  type="range"
                  min="100"
                  max="2000"
                  step="50"
                  value={settings.radius}
                  onChange={(e) => {
                    const newRadius = parseInt(e.target.value)
                    setSettings({ ...settings, radius: newRadius })
                    updateCircle(settings.latitude, settings.longitude, newRadius)
                  }}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((settings.radius - 100) / 1900) * 100}%, #e5e7eb ${((settings.radius - 100) / 1900) * 100}%, #e5e7eb 100%)`
                  }}
                />

                {/* Number input as backup */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    value={settings.radius}
                    onChange={(e) => {
                      const val = Math.max(100, Math.min(2000, parseInt(e.target.value) || 500))
                      setSettings({ ...settings, radius: val })
                      updateCircle(settings.latitude, settings.longitude, val)
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="500"
                    min="100"
                    max="2000"
                  />
                  <span className="px-3 py-2 bg-gray-100 rounded-lg text-gray-700 font-semibold">meters</span>
                </div>

                <p className="text-xs text-gray-500 mt-3">
                  Drag the slider or enter a value (100m - 2000m). Watch the circle on the map update in real-time!
                </p>
                <p className="text-xs text-blue-600 mt-2 font-semibold">
                  💡 Adjust to match your school's actual size
                </p>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save Settings"}
              </button>
            </div>

            {/* Current Coordinates Info */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Current Location</h3>
              <p className="text-sm text-blue-800">
                <strong>Lat:</strong> {settings.latitude}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Lon:</strong> {settings.longitude}
              </p>
              <p className="text-sm text-blue-800">
                <strong>Radius:</strong> {settings.radius}m
              </p>
            </div>
          </div>

          {/* Map */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <h2 className="text-2xl font-bold p-8 pb-4">School Location Map</h2>
            <div id="map" className="w-full h-96" style={{ minHeight: "500px" }}></div>
            <div className="p-4 bg-blue-50 border-t border-blue-200">
              <p className="text-sm text-blue-900 font-semibold mb-2">📍 How to Pin Location:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>✓ Click anywhere on the map to place the marker</li>
                <li>✓ Drag the marker to adjust position</li>
                <li>✓ Coordinates update automatically as you move</li>
                <li>✓ 🔵 Blue circle = geofence area (radius: {settings.radius}m)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
