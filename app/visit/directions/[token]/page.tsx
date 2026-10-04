"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface DirectionsInfo {
  status: string
  destination_name: string
  building: string | null
  floor: string | null
  room: string | null
  landmark: string | null
  directions: string | null
  latitude: number | null
  longitude: number | null
}

declare global {
  interface Window {
    L: any
  }
}

export default function DirectionsPage() {
  const params = useParams()
  const token = params.token as string

  const [info, setInfo] = useState<DirectionsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchDirections = async () => {
      try {
        const supabase = createClient()
        const { data, error: fetchError } = await supabase.rpc("get_visit_directions", { token } as never)

        const rows = data as DirectionsInfo[] | null

        if (fetchError || !rows || rows.length === 0) {
          setError("Directions not found for this visit")
          return
        }

        setInfo(rows[0])
      } catch (err) {
        console.error(err)
        setError("Failed to load directions")
      } finally {
        setLoading(false)
      }
    }

    if (token) fetchDirections()
  }, [token])

  useEffect(() => {
    if (!info?.latitude || !info?.longitude) return

    const link = document.createElement("link")
    link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"
    link.rel = "stylesheet"
    document.head.appendChild(link)

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [info?.latitude, info?.longitude])

  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !info?.latitude || !info?.longitude) return

    const L = window.L
    if (!L) return

    const map = L.map(mapRef.current, {
      zoomControl: true,
      dragging: true,
      scrollWheelZoom: false,
    }).setView([info.latitude, info.longitude], 18)

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map)

    L.marker([info.latitude, info.longitude]).addTo(map).bindPopup(info.destination_name).openPopup()

    return () => {
      map.remove()
    }
  }, [mapLoaded, info])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !info) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md text-center">
          <p className="text-red-600 font-semibold">{error || "Directions not found"}</p>
          <a href="/" className="text-blue-600 hover:text-blue-800 mt-4 inline-block">
            Return Home
          </a>
        </div>
      </div>
    )
  }

  const locationParts = [info.building, info.floor, info.room].filter(Boolean)
  const hasPin = info.latitude !== null && info.longitude !== null

  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-2xl w-full mx-auto">
        <h1 className="text-3xl font-bold mb-2">Your Destination</h1>
        <p className="text-gray-600 mb-8">Campus directions and wayfinding</p>

        <div className="bg-white p-8 rounded-lg shadow-md space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">{info.destination_name}</h2>

            <div className="space-y-4">
              {info.building && (
                <div>
                  <p className="text-sm text-gray-500">Building</p>
                  <p className="font-semibold">{info.building}</p>
                </div>
              )}

              {locationParts.length > 0 && (
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-semibold">{[info.floor, info.room].filter(Boolean).join(", ")}</p>
                </div>
              )}

              {info.landmark && (
                <div>
                  <p className="text-sm text-gray-500">Landmark</p>
                  <p className="font-semibold">{info.landmark}</p>
                </div>
              )}

              {info.directions && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-3">Directions</p>
                  <p className="text-gray-700">{info.directions}</p>
                </div>
              )}
            </div>
          </div>

          {hasPin ? (
            <div>
              <p className="text-sm text-gray-500 mb-2">Map</p>
              <div ref={mapRef} className="w-full h-64 rounded-lg border" />
            </div>
          ) : (
            <div className="bg-gray-100 rounded-lg p-6 text-center text-gray-500 text-sm">
              Map location not yet configured for this destination.
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 text-sm">
              <strong>Tip:</strong> If you need more information, please ask any staff member wearing a school ID or
              contact the security office.
            </p>
          </div>

          <a
            href="/"
            className="w-full block text-center bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Return Home
          </a>
        </div>
      </div>
    </div>
  )
}
