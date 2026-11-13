"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { MAP_WIDTH, MAP_HEIGHT, type MapPoint } from "@/lib/wayfinding"

type Destination = {
  name: string; building: string | null; floor: string | null; room: string | null
  landmark: string | null; directions: string | null; map_x: number | null; map_y: number | null
}
type VisitRoute = {
  status: string; destination: Destination; available: boolean
  points?: MapPoint[] | null; instructions?: string | null; message?: string | null
}
const noRoute = "A verified walking route is not available yet. Ask the school guard for directions."

export default function VisitorWayfindingPage() {
  const params = useParams()
  const token = typeof params.token === "string" ? params.token : ""
  const [route, setRoute] = useState<VisitRoute | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [zoom, setZoom] = useState(false)

  useEffect(() => {
    if (!token) return
    let active = true
    fetch("/api/visit/wayfinding?token=" + encodeURIComponent(token), { cache: "no-store" })
      .then(async response => {
        const data = await response.json()
        if (!response.ok) throw Error(data.error || "Walking directions could not be loaded.")
        return data as VisitRoute
      })
      .then(result => { if (active) setRoute(result) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Directions unavailable") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[#faf6f7]">
    <p role="status" className="rounded-xl bg-white p-6 text-gray-700">Loading campus directions…</p>
  </div>
  if (error || !route) return <main className="min-h-screen w-full min-w-0 flex items-center justify-center bg-[#faf6f7] p-4">
    <div className="rounded-2xl bg-white p-8 shadow-sm max-w-md w-full">
      <h1 className="text-2xl font-bold text-[#82172a]">Directions unavailable</h1>
      <p role="alert" className="mt-3">{error || "Your visitor pass could not be found."}</p>
      <Link className="mt-5 inline-block underline text-[#82172a]" href="/">Return home</Link>
    </div>
  </main>

  const d = route.destination
  const points = route.available && Array.isArray(route.points) && route.points.length >= 3 ? route.points : null
  const steps = route.instructions?.split(/\r?\n/).map(s => s.trim()).filter(Boolean) || []
  const destinationHasPin = d.map_x !== null && d.map_y !== null
  const location = [d.building, d.floor, d.room].filter(Boolean).join(" · ")
  const statusText = route.status === "PENDING" ? "Waiting for security approval"
    : route.status === "EXITED" ? "Visitor checked out"
    : route.status === "DENIED" ? "Entry not approved"
    : "Campus directions"

  return (
    <main className="min-h-screen w-full min-w-0 bg-[#faf6f7] text-[#30222a] px-3 py-5 sm:p-8 overflow-x-clip">
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4 sm:space-y-5">
        <header className="min-w-0 rounded-2xl p-5 sm:p-8 text-white bg-gradient-to-br from-[#a22037] via-[#82172a] to-[#471320]">
          <p className="uppercase tracking-widest text-xs font-semibold text-[#f6d2cf]">Bantay-Agapay · Campus Wayfinding</p>
          <h1 className="text-[1.65rem] leading-tight sm:text-4xl font-extrabold mt-3 break-words">Find your destination</h1>
          <p className="mt-2 text-[#fce8eb]">{statusText}</p>
        </header>
        <section className="min-w-0 rounded-2xl bg-white border border-rose-100 p-4 sm:p-7 shadow-sm space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-[#541322] break-words">{d.name}</h2>
          {location && <p className="font-medium text-gray-700">{location}</p>}
          {d.landmark && <p className="text-sm text-gray-600">Landmark: {d.landmark}</p>}
          {!points && <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <strong>{route.status !== "INSIDE" ? "Entry not yet authorized" : "Route not published"}</strong>
            <p className="text-sm mt-1">{route.message || noRoute}</p>
          </div>}
        </section>
        <section className="min-w-0 max-w-full rounded-2xl bg-white border border-rose-100 p-3 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            <div>
              <h2 className="font-bold text-lg">Illustrated campus map</h2>
              <p className="text-xs text-gray-500">Static walkway guidance, not GPS turn-by-turn navigation.</p>
            </div>
            <button type="button" onClick={() => setZoom(!zoom)}
              className="w-full sm:w-auto rounded-xl border border-[#82172a] px-4 py-3 sm:py-2 text-sm font-semibold text-[#82172a]">
              {zoom ? "Fit Map" : "Zoom for Details"}
            </button>
          </div>
          <div className="w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain max-h-[70vh] sm:max-h-[80vh] rounded-xl border border-rose-100 bg-[#f9f5ef]">
            <div className={"relative " + (zoom ? "w-[820px] min-w-[820px]" : "w-full min-w-0")}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/campus-map.png" alt="Illustrated AFGBMTS campus map with approved walking path if available"
                className="block w-full h-auto max-w-none" />
              <svg viewBox={"0 0 " + MAP_WIDTH + " " + MAP_HEIGHT} preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full pointer-events-none" role="img"
                aria-label={points ? "Approved walking path from the main gate to the destination" : "Destination location on campus map"}>
                <defs>
                  <marker id="wayfinding-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0 0 L6 3 L0 6" fill="none" stroke="#82172a" strokeWidth="1.6" />
                  </marker>
                </defs>
                {points && <>
                  <polyline points={points.map(p => p.x + "," + p.y).join(" ")} fill="none" stroke="white" strokeWidth="18" strokeLinejoin="round" strokeLinecap="round" />
                  <polyline points={points.map(p => p.x + "," + p.y).join(" ")} fill="none" stroke="#82172a" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="28 14" markerMid="url(#wayfinding-arrow)" markerEnd="url(#wayfinding-arrow)" />
                  <circle cx={points[0].x} cy={points[0].y} r="21" fill="#148359" stroke="white" strokeWidth="6"/>
                  <text x={points[0].x+24} y={points[0].y-22} stroke="white" strokeWidth="5" paintOrder="stroke" fontSize="26" fontWeight="bold" fill="#148359">START · MAIN GATE</text>
                  <circle cx={points[points.length-1].x} cy={points[points.length-1].y} r="22" fill="#82172a" stroke="white" strokeWidth="6"/>
                  <text x={points[points.length-1].x+24} y={points[points.length-1].y-23} stroke="white" strokeWidth="5" paintOrder="stroke" fontSize="26" fontWeight="bold" fill="#82172a">DESTINATION</text>
                </>}
                {!points && destinationHasPin &&
                  <circle cx={Number(d.map_x)} cy={Number(d.map_y)} r="20" fill="#82172a" stroke="white" strokeWidth="6" />}
              </svg>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
            {points && <span><span className="text-emerald-700">●</span> Main gate</span>}
            <span><span className="text-[#82172a]">●</span> Destination</span>
            {points && <span>⟶ Follow the marked maroon walkway</span>}
          </div>
        </section>
        <section className="min-w-0 rounded-2xl border border-rose-100 bg-white p-4 sm:p-7 shadow-sm space-y-3 break-words">
          <h2 className="text-lg font-bold">Walking instructions</h2>
          {points ? <ol className="list-decimal pl-5 space-y-3 text-sm text-gray-700">
            <li>Enter through the main gate after the security guard approves your visit.</li>
            <li>Follow the highlighted maroon walking route and arrows on the campus map.</li>
            {steps.map((instruction, i) => <li key={i}>{instruction}</li>)}
            <li>Proceed to <strong>{d.name}</strong>{d.room ? ", room " + d.room : ""}.</li>
          </ol> : <p className="text-sm text-gray-600">Ask the guard for an approved path before walking to the destination.</p>}
          {route.status === "INSIDE" && d.directions && <p className="text-sm border-t pt-3 text-gray-700"><strong>Additional destination note:</strong> {d.directions}</p>}
          <p className="text-xs text-gray-500">Always follow posted campus safety signs and instructions from school staff. The map does not detect temporary closures.</p>
        </section>
        <div className="flex flex-col sm:flex-row gap-3 pb-4 min-w-0">
          <Link className="w-full sm:flex-1 sm:min-w-[200px] text-center rounded-xl bg-[#82172a] text-white font-semibold px-5 py-3"
            href={"/visit/status/" + encodeURIComponent(token)}>← Back to my QR pass</Link>
          <Link href="/" className="w-full sm:flex-1 sm:min-w-[200px] text-center rounded-xl bg-white border border-gray-200 text-gray-800 font-semibold px-5 py-3">Return home</Link>
        </div>
      </div>
    </main>
  )
}
