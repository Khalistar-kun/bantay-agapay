"use client"

import { useRef, useState, useEffect } from "react"

export function ProfilePhotoPrompt({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [captured, setCaptured] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stream: MediaStream | null = null

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setReady(true)
        }
      } catch (err) {
        setError("Camera access denied. Please allow camera access to continue.")
      }
    }

    startCamera()

    return () => {
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const handleCapture = () => {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const context = canvas.getContext("2d")
    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    setCaptured(canvas.toDataURL("image/jpeg", 0.85))
  }

  const handleRetake = () => setCaptured(null)

  const handleSave = async () => {
    if (!captured) return
    setUploading(true)
    setError(null)

    try {
      const res = await fetch("/api/auth/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo: captured }),
      })

      if (res.ok) {
        onDone()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || "Failed to save photo")
      }
    } catch (err) {
      setError("Error uploading photo. Please check your connection.")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Add Your Profile Photo</h2>
        <p className="text-gray-600 text-sm mb-4">
          This helps visitors and colleagues recognize you. You can take it now with your camera.
        </p>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">{error}</div>}

        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-square mb-4">
          {captured ? (
            <img src={captured} alt="Captured profile" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
          )}
        </div>

        <div className="flex gap-3">
          {!captured ? (
            <button
              onClick={handleCapture}
              disabled={!ready}
              className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              Take Photo
            </button>
          ) : (
            <>
              <button
                onClick={handleRetake}
                disabled={uploading}
                className="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-300 transition disabled:opacity-50"
              >
                Retake
              </button>
              <button
                onClick={handleSave}
                disabled={uploading}
                className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                {uploading ? "Saving..." : "Save Photo"}
              </button>
            </>
          )}
        </div>

        <button onClick={onDone} className="w-full text-center text-gray-500 text-sm mt-4 hover:text-gray-700">
          Skip for now
        </button>
      </div>
    </div>
  )
}
