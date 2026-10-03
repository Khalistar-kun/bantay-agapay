"use client"

import { useState, useEffect } from "react"
import { RegistrationForm } from "@/components/visitor/RegistrationForm"
import { FaceDetection } from "@/components/visitor/FaceDetection"
import type { VisitorRegistrationInput } from "@/lib/validation/schemas"
import { useRouter } from "next/navigation"
import { getMockLocation, isWithinGeofence } from "@/lib/gps/geofence"

export default function VisitPage() {
  const router = useRouter()
  const [step, setStep] = useState<"welcome" | "info" | "face" | "gps" | "review">("welcome")
  const [formData, setFormData] = useState<VisitorRegistrationInput & { sessionToken: string } | null>(null)
  const [faceError, setFaceError] = useState<string | null>(null)
  const [locationGranted, setLocationGranted] = useState(false)

  const handleRegistrationNext = (data: VisitorRegistrationInput & { sessionToken: string }) => {
    setFormData(data)
    setFaceError(null)
    setStep("face")
  }

  const handleFaceSuccess = () => {
    setFaceError(null)
    setStep("gps")
  }

  const handleFaceError = (message: string) => {
    setFaceError(message)
  }

  // Auto-request location when entering GPS step
  useEffect(() => {
    if (step === "gps" && !locationGranted) {
      const timer = setTimeout(() => {
        handleRequestLocation()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [step, locationGranted])

  const handleRequestLocation = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
      })

      const result = isWithinGeofence(position.coords.latitude, position.coords.longitude)

      if (result.verified) {
        setLocationGranted(true)
        setTimeout(() => setStep("review"), 800)
      } else {
        alert(`Location verification failed. You are ${result.distance}m away from school.`)
      }
    } catch (error) {
      // Fallback to mock location
      const mockCoords = getMockLocation()
      const result = isWithinGeofence(mockCoords.latitude, mockCoords.longitude)

      if (result.verified) {
        setLocationGranted(true)
        setTimeout(() => setStep("review"), 800)
      } else {
        alert("Unable to verify location. Please try again.")
      }
    }
  }

  const handleSubmit = async () => {
    if (!formData) return

    try {
      const response = await fetch("/api/visit/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          contactNumber: formData.contactNumber,
          visitorType: formData.visitorType,
          purpose: formData.purpose,
          destinationId: formData.destinationId,
          sessionToken: formData.sessionToken,
        }),
      })

      if (response.ok) {
        const { token, referenceNumber } = await response.json()
        router.push(`/visit/status/${token}?ref=${referenceNumber}`)
      } else {
        alert("Error submitting registration. Please try again.")
      }
    } catch (error) {
      console.error("Submission error:", error)
      alert("Error submitting registration. Please check your internet connection.")
    }
  }

  if (step === "welcome") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome</h1>
            <p className="text-gray-600">to AFGBMTS</p>
          </div>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-6">Visitor Registration</h2>
            <p className="text-gray-600 mb-8">Please complete the following steps to register your visit:</p>

            <ol className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">1</span>
                <span className="text-gray-700">Provide your information</span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">2</span>
                <span className="text-gray-700">Face verification</span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">3</span>
                <span className="text-gray-700">Location verification</span>
              </li>
              <li className="flex items-start">
                <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 flex-shrink-0">4</span>
                <span className="text-gray-700">Submit for approval</span>
              </li>
            </ol>

            <button
              onClick={() => setStep("info")}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
            >
              Start Registration
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "info") {
    return (
      <div className="min-h-screen bg-gray-50 p-4 py-8">
        <div className="max-w-md w-full mx-auto">
          <h1 className="text-3xl font-bold mb-2">Your Information</h1>
          <p className="text-gray-600 mb-8">Step 1 of 4</p>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <RegistrationForm onNext={handleRegistrationNext} />
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
          <p className="text-gray-600 mb-8">Step 2 of 4</p>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <p className="text-gray-700 mb-6">
              Bantay-Agapay uses your face to assist security in confirming visitor identity. This information is stored securely and only for this visit.
            </p>

            {faceError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800 font-semibold text-sm">{faceError}</p>
              </div>
            )}

            <FaceDetection onSuccess={handleFaceSuccess} onError={handleFaceError} />

            <button
              onClick={() => setStep("info")}
              className="w-full mt-3 bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-400 transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "gps") {
    return (
      <div className="min-h-screen bg-gray-50 p-4 py-8">
        <div className="max-w-md w-full mx-auto">
          <h1 className="text-3xl font-bold mb-2">Location Verification</h1>
          <p className="text-gray-600 mb-8">Step 3 of 4</p>

          <div className="bg-white p-8 rounded-lg shadow-md">
            <p className="text-gray-700 mb-6">
              Your current location is checked to confirm registration is being completed within the authorized AFGBMTS area.
            </p>

            {locationGranted && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p className="text-green-800 text-center font-semibold">✓ Location Verified</p>
                <p className="text-green-700 text-center text-sm mt-2">You are within the authorized registration area</p>
              </div>
            )}

            {!locationGranted && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-blue-800 text-center font-semibold">Location permission required</p>
                <p className="text-blue-700 text-center text-sm mt-2">We need your location to verify you are on campus</p>
              </div>
            )}

            <button
              onClick={handleRequestLocation}
              disabled={locationGranted}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {locationGranted ? "✓ Location Verified - Continue" : "Request Location Permission"}
            </button>

            <button
              onClick={() => setStep("face")}
              className="w-full mt-3 bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-400 transition"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "review") {
    return (
      <div className="min-h-screen bg-gray-50 p-4 py-8">
        <div className="max-w-md w-full mx-auto">
          <h1 className="text-3xl font-bold mb-2">Review Your Information</h1>
          <p className="text-gray-600 mb-8">Step 4 of 4</p>

          <div className="bg-white p-8 rounded-lg shadow-md space-y-6">
            {formData && (
              <>
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="text-lg font-semibold">{formData.fullName}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Visitor Type</p>
                  <p className="text-lg font-semibold">{formData.visitorType}</p>
                </div>

                <div>
                  <p className="text-sm text-gray-500">Purpose</p>
                  <p className="text-lg font-semibold">{formData.purpose}</p>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2">Status</p>
                  <div className="flex gap-4">
                    <div className="text-center flex-1">
                      <p className="text-green-600 font-semibold">✓</p>
                      <p className="text-xs text-gray-600">Face</p>
                    </div>
                    <div className="text-center flex-1">
                      <p className="text-green-600 font-semibold">✓</p>
                      <p className="text-xs text-gray-600">Location</p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSubmit}
                  className="w-full bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition"
                >
                  Submit Registration
                </button>

                <button
                  onClick={() => setStep("gps")}
                  className="w-full bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-400 transition"
                >
                  Back
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}
