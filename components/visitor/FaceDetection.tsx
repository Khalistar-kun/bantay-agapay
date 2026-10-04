"use client"

import { useRef, useEffect, useState } from "react"

interface FaceDetectionProps {
  onSuccess: (photoDataUrl: string) => void
  onError: (message: string) => void
}

export function FaceDetection({ onSuccess, onError }: FaceDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [loading, setLoading] = useState(true)
  const [instruction, setInstruction] = useState("Please allow camera access")
  const [faceDetected, setFaceDetected] = useState(false)
  const [headPosition, setHeadPosition] = useState<"center" | "left" | "right">("center")
  const [completedMoves, setCompletedMoves] = useState<("left" | "right")[]>([])
  const [verificationComplete, setVerificationComplete] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null)
  const detectionTimeoutRef = useRef<NodeJS.Timeout>()
  const scanningRef = useRef(true)

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          setLoading(false)
          setInstruction("Look at the camera")
          detectFace()
        }
      } catch (err) {
        onError("Camera access denied. Please allow camera access in your browser settings.")
        setLoading(false)
      }
    }

    startCamera()

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
      if (detectionTimeoutRef.current) {
        clearTimeout(detectionTimeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onError])

  const detectFace = () => {
    if (!videoRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    const video = videoRef.current
    let consecutiveLeftFrames = 0
    let consecutiveRightFrames = 0

    const drawFrame = () => {
      if (!scanningRef.current) return

      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Simple face detection simulation
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      let faceScore = 0
      let leftScore = 0
      let rightScore = 0

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const pixelIndex = i / 4

        // Detect skin tones
        if (r > 95 && g > 40 && b > 20 && r > b && r > g) {
          faceScore++

          // Determine if pixel is on left or right side
          const pixelX = pixelIndex % canvas.width
          if (pixelX < canvas.width / 3) {
            leftScore++
          } else if (pixelX > (canvas.width * 2) / 3) {
            rightScore++
          }
        }
      }

      const faceConfidence = faceScore / (canvas.width * canvas.height)

      if (faceConfidence > 0.15) {
        setFaceDetected(true)

        // Auto-detect head position
        if (leftScore > rightScore && leftScore > faceScore * 0.4) {
          consecutiveLeftFrames++
          consecutiveRightFrames = 0
          setHeadPosition("left")

          // Auto-detect when looking left for 15 frames (~500ms)
          if (consecutiveLeftFrames > 15) {
            setCompletedMoves((prev) => (prev.includes("left") ? prev : [...prev, "left"]))
            setInstruction("Great! Now turning right...")
            consecutiveLeftFrames = 0
          }
        } else if (rightScore > leftScore && rightScore > faceScore * 0.4) {
          consecutiveRightFrames++
          consecutiveLeftFrames = 0
          setHeadPosition("right")

          // Auto-detect when looking right for 15 frames (~500ms)
          if (consecutiveRightFrames > 15) {
            setCompletedMoves((prev) => (prev.includes("right") ? prev : [...prev, "right"]))
            setInstruction("Perfect! Verification complete...")
            consecutiveRightFrames = 0
          }
        } else {
          consecutiveLeftFrames = 0
          consecutiveRightFrames = 0
          setHeadPosition("center")
        }
      } else {
        setFaceDetected(false)
        consecutiveLeftFrames = 0
        consecutiveRightFrames = 0
      }

      requestAnimationFrame(drawFrame)
    }

    drawFrame()
  }

  // Capture the photo and pause for review once both movements are detected
  useEffect(() => {
    if (completedMoves.length === 2 && !verificationComplete) {
      setVerificationComplete(true)
      scanningRef.current = false
      setInstruction("✓ Face verified!")

      detectionTimeoutRef.current = setTimeout(() => {
        setCapturedPhoto(capturePhoto())
      }, 800)
    }
  }, [completedMoves, verificationComplete])

  const capturePhoto = (): string => {
    const canvas = document.createElement("canvas")
    const video = videoRef.current
    if (!video) return ""

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const context = canvas.getContext("2d")
    if (!context) return ""

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.85)
  }

  const handleRetake = () => {
    setCapturedPhoto(null)
    setVerificationComplete(false)
    setCompletedMoves([])
    setFaceDetected(false)
    setHeadPosition("center")
    setInstruction("Look at the camera")
    scanningRef.current = true
    requestAnimationFrame(() => detectFace())
  }

  const handleConfirm = () => {
    if (capturedPhoto) {
      onSuccess(capturedPhoto)
    }
  }

  return (
    <div className="space-y-4">
      {/* Instructions */}
      <div
        className={`p-4 rounded-lg text-center font-semibold ${
          verificationComplete ? "bg-green-50 text-green-900" : faceDetected ? "bg-blue-50 text-blue-900" : "bg-yellow-50 text-yellow-900"
        }`}
      >
        {loading ? "Initializing camera..." : capturedPhoto ? "Review your photo" : instruction}
      </div>

      {/* Video Feed / Captured Photo Preview */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
        {capturedPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={capturedPhoto} alt="Captured face" className="w-full h-full object-cover" />
        ) : (
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        )}

        {/* Face Detection Outline */}
        {faceDetected && !verificationComplete && !capturedPhoto && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-32 h-40 border-4 border-green-500 rounded-2xl animate-pulse" />
          </div>
        )}

        {/* Verification Complete (before photo preview appears) */}
        {verificationComplete && !capturedPhoto && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 pointer-events-none">
            <div className="text-center">
              <p className="text-4xl text-green-400 font-bold">✓</p>
              <p className="text-green-300 text-lg font-semibold">Face Verified</p>
            </div>
          </div>
        )}

        {/* No Face Detected */}
        {!loading && !faceDetected && !verificationComplete && !capturedPhoto && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="text-white text-center">
              <p className="text-lg font-semibold">No face detected</p>
              <p className="text-sm">Position your face in front of the camera</p>
            </div>
          </div>
        )}

        {/* Head Position Indicator */}
        {faceDetected && !verificationComplete && !capturedPhoto && (
          <div className="absolute top-4 right-4 bg-black/50 text-white px-3 py-1 rounded text-sm font-semibold">
            {headPosition === "left" ? "← Looking Left" : headPosition === "right" ? "Looking Right →" : "Centered"}
          </div>
        )}
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} width={640} height={480} className="hidden" />

      {/* Photo Review Actions */}
      {capturedPhoto && (
        <div className="flex gap-3">
          <button
            onClick={handleRetake}
            className="flex-1 bg-gray-200 text-gray-800 font-semibold py-3 rounded-lg hover:bg-gray-300 transition"
          >
            Retake Photo
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-green-600 text-white font-semibold py-3 rounded-lg hover:bg-green-700 transition"
          >
            Use This Photo
          </button>
        </div>
      )}

      {/* Movement Progress */}
      {faceDetected && !verificationComplete && !capturedPhoto && (
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Face verification progress:</p>
          <div className="flex gap-4">
            <div className={`flex-1 p-3 rounded-lg text-center font-semibold ${completedMoves.includes("left") ? "bg-green-100 text-green-800" : "bg-white text-gray-700 border border-gray-300"}`}>
              {completedMoves.includes("left") ? "✓ Left" : "← Left"}
            </div>
            <div className={`flex-1 p-3 rounded-lg text-center font-semibold ${completedMoves.includes("right") ? "bg-green-100 text-green-800" : "bg-white text-gray-700 border border-gray-300"}`}>
              {completedMoves.includes("right") ? "✓ Right →" : "Right →"}
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-3 text-center">Automatically detecting head movements...</p>
        </div>
      )}
    </div>
  )
}
