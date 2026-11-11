"use client"

import { useEffect, useRef, useState } from "react"

interface FaceDetectionProps {
  onSuccess: (photoDataUrl: string) => void
  onError: (message: string) => void
}
interface Progress {
  phase: string
  ready: boolean
  message: string
  percent: number
}
interface ScannerSession {
  stop: () => void
  ready: Promise<void>
  isReady: () => boolean
}
interface ScannerApi {
  start: (
    video: HTMLVideoElement,
    options: { onProgress: (progress: Progress) => void; onError: (error: Error) => void }
  ) => ScannerSession
}
declare global {
  interface Window { BantayFaceScan?: ScannerApi }
}

let scannerScriptPromise: Promise<ScannerApi> | null = null
function loadScanner(): Promise<ScannerApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("Camera requires a browser."))
  if (window.BantayFaceScan) return Promise.resolve(window.BantayFaceScan)
  if (!scannerScriptPromise) {
    scannerScriptPromise = new Promise<ScannerApi>((resolve, reject) => {
      const element = document.createElement("script")
      element.src = "/client-demo/face-scanner.js"
      element.async = true
      element.onload = () => window.BantayFaceScan
        ? resolve(window.BantayFaceScan)
        : reject(new Error("Face scanner was not initialized."))
      element.onerror = () => reject(new Error("Face scanner script could not load."))
      document.head.appendChild(element)
    }).catch((error) => { scannerScriptPromise = null; throw error })
  }
  return scannerScriptPromise
}

export function FaceDetection({ onSuccess, onError }: FaceDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sessionRef = useRef<ScannerSession | null>(null)
  const callbacksRef = useRef({ onSuccess, onError })
  callbacksRef.current = { onSuccess, onError }
  const [retryCount, setRetryCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("Requesting camera permission…")
  const [ready, setReady] = useState(false)
  const [percent, setPercent] = useState(0)
  const [cameraAvailable, setCameraAvailable] = useState(false)
  const [capturedPhoto, setCapturedPhoto] = useState("")
  const [manualReview, setManualReview] = useState(false)
  const [scannerFailed, setScannerFailed] = useState(false)

  useEffect(() => {
    let disposed = false
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is unavailable. Use the photo upload for manual security review.")
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
        })
        if (disposed) { stream.getTracks().forEach((track) => track.stop()); return }
        streamRef.current = stream
        const video = videoRef.current
        if (!video) throw new Error("Video preview is unavailable.")
        video.srcObject = stream
        await video.play()
        if (disposed) return
        setCameraAvailable(true)
        setMessage("Loading on-device face scanner…")
        const scanner = await loadScanner()
        if (disposed) return
        const session = scanner.start(video, {
          onProgress: (progress) => {
            if (!disposed) {
              setMessage(progress.message)
              setReady(progress.ready)
              setPercent(progress.percent)
            }
          },
          onError: (error) => {
            if (!disposed) {
              setScannerFailed(true)
              setMessage(error.message)
            }
          },
        })
        sessionRef.current = session
        await session.ready
      } catch (error) {
        if (disposed) return
        const text = error instanceof Error ? error.message : "Could not start face scan."
        setScannerFailed(true)
        setMessage(text + " You can submit a photo for manual guard review.")
        callbacksRef.current.onError(text)
      } finally {
        if (!disposed) setLoading(false)
      }
    }
    void start()
    return () => {
      disposed = true
      sessionRef.current?.stop()
      sessionRef.current = null
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [retryCount])

  const capture = (reviewOnly: boolean) => {
    const video = videoRef.current
    if (!video || !video.videoWidth || (!reviewOnly && !sessionRef.current?.isReady())) {
      setMessage("Finish the face-motion prompts before capturing, or choose manual security review.")
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = 480
    canvas.height = 480
    const context = canvas.getContext("2d")
    if (!context) { setMessage("Camera capture is unavailable."); return }
    const side = Math.min(video.videoWidth, video.videoHeight)
    context.drawImage(video, (video.videoWidth-side)/2, (video.videoHeight-side)/2,
      side, side, 0, 0, canvas.width, canvas.height)
    setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.78))
    setManualReview(reviewOnly)
    sessionRef.current?.stop()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    setMessage(reviewOnly
      ? "Photo captured for manual security review. No face-motion check was completed."
      : "Face-motion prompts completed. Review your photo; identity is checked by security.")
  }

  const upload = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith("image/") || file.size > 8_000_000) {
      setMessage("Select an image file smaller than 8 MB.")
      return
    }
    const url = URL.createObjectURL(file)
    try {
      const image = new Image()
      image.src = url
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = 480
      canvas.height = 480
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Image conversion failed.")
      const side = Math.min(image.naturalWidth, image.naturalHeight)
      ctx.drawImage(image, (image.naturalWidth-side)/2, (image.naturalHeight-side)/2, side, side, 0, 0, 480, 480)
      setCapturedPhoto(canvas.toDataURL("image/jpeg", 0.78))
      setManualReview(true)
      sessionRef.current?.stop()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      setMessage("Uploaded photo requires manual guard review; no live scan was performed.")
    } catch {
      setMessage("The selected image could not be opened.")
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  const retake = () => {
    setCapturedPhoto("")
    setReady(false)
    setPercent(0)
    setCameraAvailable(false)
    setScannerFailed(false)
    setManualReview(false)
    setLoading(true)
    setMessage("Restarting the camera…")
    setRetryCount((count) => count + 1)
  }

  return (
    <section className="space-y-4" aria-label="Visitor face capture">
      <div role="status" aria-live="polite" className="rounded-lg bg-primary-50 p-4 text-sm font-semibold text-primary-900">
        {loading ? "Starting camera and face scanner…" : message}
      </div>
      <div className="relative overflow-hidden rounded-[24px] border-2 border-primary-700 bg-gray-950 aspect-square w-full max-w-[440px] mx-auto shadow-xl">
        <video ref={videoRef} muted autoPlay playsInline
          className={"h-full w-full object-cover " + (capturedPhoto ? "hidden" : "")} />
        {capturedPhoto ? <img src={capturedPhoto} alt="Visitor photo preview" className="absolute inset-0 w-full h-full object-cover" /> :
          <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-dashed border-white/70" />}
        {!capturedPhoto && ready && <div className="absolute bottom-3 inset-x-3 text-center rounded-lg bg-emerald-900/90 text-white px-3 py-2 text-sm">
          Motion check complete — ready to capture
        </div>}
      </div>
      <div role="progressbar" aria-label="Face motion scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className="h-2 w-full max-w-[440px] mx-auto overflow-hidden rounded-full bg-primary-100">
        <div className="h-full rounded-full bg-primary-700" style={{width: `${percent}%`}} />
      </div>
      <p className="text-xs text-gray-600">
        This checks face presence and simple movements on your device. It does not identify you or prove liveness.
        A security guard must compare your photo and approve your entry.
      </p>
      {capturedPhoto ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">{manualReview ? "Manual photo review required" : "Motion prompts completed; manual identity review still required"}</p>
          <div className="flex gap-3">
            <button type="button" onClick={retake} className="flex-1 rounded-lg bg-gray-200 text-gray-800 py-3 font-semibold">Retake</button>
            <button type="button" onClick={() => callbacksRef.current.onSuccess(capturedPhoto)}
              className="flex-1 rounded-lg bg-primary-600 text-white py-3 font-semibold">Use this photo</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button type="button" onClick={() => capture(false)} disabled={!ready}
            className="w-full rounded-lg bg-primary-600 text-white py-3 font-semibold disabled:opacity-50">Capture scanned photo</button>
          {cameraAvailable && <button type="button" onClick={() => capture(true)}
            className="w-full rounded-lg bg-gray-100 text-gray-800 py-3 font-semibold">
            Capture photo for manual review
          </button>}
          <label className="block cursor-pointer text-center rounded-lg border border-gray-300 py-3 text-sm font-semibold">
            Upload photo for manual review
            <input type="file" accept="image/*" capture="user" className="sr-only"
              onChange={(e) => void upload(e.target.files?.[0])}/>
          </label>
          {scannerFailed && <button type="button" onClick={retake}
            className="w-full text-primary-700 underline text-sm">Retry the face scanner</button>}
        </div>
      )}
    </section>
  )
}
