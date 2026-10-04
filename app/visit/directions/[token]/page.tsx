"use client"

import { useEffect, useState } from "react"
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
}

export default function DirectionsPage() {
  const params = useParams()
  const token = params.token as string

  const [info, setInfo] = useState<DirectionsInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
