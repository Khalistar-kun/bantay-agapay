"use client"

import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"

export function QRCheckoutScanner({
  onCheckedOut,
  onClose,
}: {
  onCheckedOut: (visitorName: string) => void
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const pausedRef = useRef(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let rafId: number

    const scanFrame = () => {
      if (!pausedRef.current) {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext("2d")
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const code = jsQR(imageData.data, imageData.width, imageData.height)

            if (code?.data) {
              pausedRef.current = true
              handleToken(code.data)
            }
          }
        }
      }

      rafId = requestAnimationFrame(scanFrame)
    }

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          rafId = requestAnimationFrame(scanFrame)
        }
      } catch (err) {
        setError("Camera access denied. Please allow camera access to scan.")
      }
    }

    start()

    return () => {
      cancelAnimationFrame(rafId)
      stream?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToken = async (token: string) => {
    setProcessing(true)
    setError(null)

    try {
      const res = await fetch("/api/visit/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to check out visitor")
        setProcessing(false)
        pausedRef.current = false
        return
      }

      onCheckedOut(data.visitorName)
    } catch (err) {
      setError("Error processing checkout. Please check your connection.")
      setProcessing(false)
      pausedRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Scan Visitor QR Code</h2>
        <p className="text-gray-600 text-sm mb-4">Point the camera at the visitor's checkout QR code</p>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm mb-4">{error}</div>}

        <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-square mb-4">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {processing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                <p className="text-sm">Processing...</p>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <button
          onClick={onClose}
          className="w-full bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-300 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
