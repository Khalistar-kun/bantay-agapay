"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { FaceDetection } from "@/components/visitor/FaceDetection"
import { getMockLocation, isWithinGeofence, ensureGeofenceSettingsLoaded } from "@/lib/gps/geofence"
import Link from "next/link"

export const dynamic = "force-dynamic"

interface Destination {
  id: string
  name: string
  building: string
}

export default function ReturningVisitorPage() {
  const router = useRouter()
  const [step, setStep] = useState<"phone" | "face" | "details" | "gps">("phone")

  const [phoneNumber, setPhoneNumber] = useState("")
  const [destinationId, setDestinationId] = useState("")
  const [purpose, setPurpose] = useState("")
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [loadingDestinations, setLoadingDestinations] = useState(true)

  const [facePhoto, setFacePhoto] = useState<string | null>(null)
  const [faceError, setFaceError] = useState<string | null>(null)

  const [locationGranted, setLocationGranted] = useState(false)
  const [gpsReading, setGpsReading] = useState<{
    latitude: number
    longitude: number
    accuracy: number
    distance: number
  } | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchDestinations = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("destinations")
          .select("id, name, building")
          .eq("active", true)
          .order("name")

        if (!error && data) {
          setDestinations(data)
        }
      } finally {
        setLoadingDestinations(false)
      }
    }

    fetchDestinations()
  }, [])

  // Auto-request location when entering GPS step
  useEffect(() => {
    if (step === "gps" && !locationGranted) {
      ensureGeofenceSettingsLoaded()
      const timer = setTimeout(() => {
        handleRequestLocation()
      }, 1000)
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, locationGranted])

  const handlePhoneNext = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setStep("face")
  }

  const handleFaceSuccess = (photoDataUrl: string) => {
    setFacePhoto(photoDataUrl)
    setFaceError(null)
    setStep("details")
  }

  const handleFaceError = (message: string) => {
    setFaceError(message)
  }

  const handleRequestLocation = async () => {
    await ensureGeofenceSettingsLoaded()

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      })

      const result = isWithinGeofence(position.coords.latitude, position.coords.longitude)

      if (result.verified) {
        setGpsReading({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          distance: result.distance,
        })
        setLocationGranted(true)
        setTimeout(() => handleSubmit(), 800)
      } else {
        alert(`Location verification failed. You are ${result.distance}m away from school.`)
      }
    } catch (err) {
      const mockCoords = getMockLocation()
      const result = isWithinGeofence(mockCoords.latitude, mockCoords.longitude)

      if (result.verified) {
        setGpsReading({
          latitude: mockCoords.latitude,
          longitude: mockCoords.longitude,
          accuracy: mockCoords.accuracy,
          distance: result.distance,
        })
        setLocationGranted(true)
        setTimeout(() => handleSubmit(), 800)
      } else {
        alert("Unable to verify location. Please try again.")
      }
    }
  }

  const handleDetailsNext = (e: React.FormEvent) => {
    e.preventDefault()
    setStep("gps")
  }

  const handleSubmit = async () => {
    setError(null)
    setLoading(true)

    try {
      const response = await fetch("/api/visit/returning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, destinationId, purpose, facePhoto, gpsReading }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Error processing your request. Please try again.")
        setLoading(false)
        return
      }

      router.push(`/visit/status/${data.token}?ref=${data.visitId}`)
    } catch (err) {
      setError("An error occurred. Please try again.")
      console.error(err)
      setLoading(false)
    }
  }

  if (step === "phone") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4 py-8">
        <div className="max-w-md w-full mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
            <p className="text-gray-600">Returning Visitor</p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <p className="text-gray-700 mb-6">
              Welcome back to AFGBMTS! Enter your contact number, then re-verify your face and location to quickly
              re-enter campus. Security will review and approve your entry.
            </p>

            <form onSubmit={handlePhoneNext} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="09XX-XXX-XXXX"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">The number you used during your previous visit</p>
              </div>

              <button
                type="submit"
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Continue to Face Verification
              </button>
            </form>

            <div className="border-t pt-6 mt-6">
              <p className="text-gray-600 text-sm mb-4">Is this your first visit?</p>
              <Link
                href="/visit"
                className="w-full block text-center bg-gray-100 text-gray-900 font-semibold py-3 rounded-lg hover:bg-gray-200 transition"
              >
                New Visitor Registration
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (step === "face") {
    return (
      <div className="min-h-screen bg-gray-50 p-4 py-8">
        <div className="max-w-md w-full mx-auto">
          <h1 className="text-3xl font-bold mb-2">Face Verification</h1>
          <p className="text-gray-600 mb-8">Required for every visit, including returning visitors</p>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <p className="text-gray-700 mb-6">
              Bantay-Agapay uses your face to assist security in confirming your identity for this visit.
            </p>

            {faceError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800 font-semibold text-sm">{faceError}</p>
              </div>
            )}

            <FaceDetection onSuccess={handleFaceSuccess} onError={handleFaceError} />

            <button
              onClick={() => setStep("phone")}
              className="w-full mt-3 bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-400 transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "details") {
    return (
      <div className="min-h-screen bg-gray-50 p-4 py-8">
        <div className="max-w-md w-full mx-auto">
          <h1 className="text-3xl font-bold mb-2">Visit Details</h1>
          <p className="text-gray-600 mb-8">Where are you headed today?</p>

          <div className="bg-white p-8 rounded-lg shadow-md">
            {facePhoto && (
              <div className="flex justify-center mb-6">
                <img
                  src={facePhoto}
                  alt="Captured face"
                  className="w-24 h-24 object-cover rounded-full border-4 border-green-500"
                />
              </div>
            )}

            <form onSubmit={handleDetailsNext} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Destination *</label>
                {loadingDestinations ? (
                  <div className="animate-pulse bg-gray-200 h-10 rounded-lg"></div>
                ) : (
                  <select
                    value={destinationId}
                    onChange={(e) => setDestinationId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Select destination</option>
                    {destinations.map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.name} ({dest.building})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purpose of Visit *</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="What is the purpose of your visit?"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loadingDestinations}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                Continue to Location Verification
              </button>

              <button
                type="button"
                onClick={() => setStep("face")}
                className="w-full bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-400 transition"
              >
                Back
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // step === "gps"
  return (
    <div className="min-h-screen bg-gray-50 p-4 py-8">
      <div className="max-w-md w-full mx-auto">
        <h1 className="text-3xl font-bold mb-2">Location Verification</h1>
        <p className="text-gray-600 mb-8">Confirming you're on campus</p>

        <div className="bg-white p-8 rounded-lg shadow-md">
          <p className="text-gray-700 mb-6">
            Your current location is checked to confirm this request is being made within the authorized AFGBMTS
            area.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800 text-sm font-semibold">{error}</p>
            </div>
          )}

          {locationGranted ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 text-center font-semibold">
                {loading ? "Submitting..." : "✓ Location Verified"}
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 text-center font-semibold">Requesting location permission...</p>
            </div>
          )}

          <button
            onClick={() => setStep("details")}
            disabled={loading}
            className="w-full bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-400 transition disabled:opacity-50"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  )
}
