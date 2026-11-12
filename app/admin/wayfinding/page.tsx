"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { MAP_WIDTH, MAP_HEIGHT, MapPoint, StoredRoute, checkRoute, point } from "@/lib/wayfinding"

type Destination = {
  id: string; name: string; building: string | null; floor: string | null; room: string | null
  active: boolean; map_x: number | null; map_y: number | null
}
type Mode = "view" | "gate" | "pin" | "route"
const inputStyle = "min-w-0 max-w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400"
const buttonStyle = "rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"

export default function CampusWayfindingEditor() {
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [gate, setGate] = useState<MapPoint | null>(null)
  const [gateDraft, setGateDraft] = useState<MapPoint | null>(null)
  const [pinDraft, setPinDraft] = useState<MapPoint | null>(null)
  const [waypoints, setWaypoints] = useState<MapPoint[]>([])
  const [storedRoute, setStoredRoute] = useState<StoredRoute | null>(null)
  const [instructions, setInstructions] = useState("")
  const [mode, setMode] = useState<Mode>("view")
  const [loading, setLoading] = useState(true)
  const [mapZoom, setMapZoom] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const mapRef = useRef<HTMLImageElement>(null)

  const selected = useMemo(() => destinations.find(d => d.id === selectedId) || null, [destinations, selectedId])
  const end = selected && selected.map_x !== null && selected.map_y !== null
    ? point({ x: Number(selected.map_x), y: Number(selected.map_y) }) : null
  const drawnGate = mode === "gate" ? gateDraft : gate
  const drawnEnd = mode === "pin" ? pinDraft : end
  const line = drawnGate && drawnEnd ? [drawnGate, ...waypoints, drawnEnd] : []
  const valid = gate && end && waypoints.length
    ? checkRoute([gate, ...waypoints, end], gate, end) : "Add a gate, destination pin and at least one walkway waypoint."
  const livePublished = storedRoute?.published && gate && end &&
    !checkRoute(storedRoute.points, gate, end)

  const loadDestinations = useCallback(async () => {
    const response = await fetch("/api/admin/destinations", { cache: "no-store" })
    const result = await response.json()
    if (!response.ok) throw Error(result.error || "Admin sign-in is required")
    setDestinations(result.destinations || [])
    setSelectedId(current => current || result.destinations?.[0]?.id || "")
  }, [])

  useEffect(() => {
    loadDestinations().catch(err => setError(err.message)).finally(() => setLoading(false))
  }, [loadDestinations])
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setMode("view")
    setError("")
    const run = async () => {
      try {
        const response = await fetch("/api/admin/wayfinding?destinationId=" + encodeURIComponent(selectedId), { cache: "no-store" })
        const payload = await response.json()
        if (!response.ok) throw Error(payload.error || "Could not load walking route")
        if (cancelled) return
        setGate(payload.gate || null)
        setGateDraft(payload.gate || null)
        const route = (payload.route || null) as StoredRoute | null
        setStoredRoute(route)
        setWaypoints(route && route.points.length >= 2 ? route.points.slice(1, -1) : [])
        setInstructions(route?.instructions || "")
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load walking route") }
    }
    void run()
    return () => { cancelled = true }
  }, [selectedId])

  function mapClick(e: React.MouseEvent<HTMLImageElement>) {
    if (mode === "view") return
    const img = mapRef.current
    if (!img) return
    const rect = img.getBoundingClientRect()
    const x = Math.round((e.clientX - rect.left) / rect.width * MAP_WIDTH)
    const y = Math.round((e.clientY - rect.top) / rect.height * MAP_HEIGHT)
    const p = point({ x, y })
    if (!p) return
    setNotice("")
    if (mode === "gate") setGateDraft(p)
    if (mode === "pin") setPinDraft(p)
    if (mode === "route" && waypoints.length < 62) setWaypoints(old => [...old, p])
  }

  async function requestWrite(url: string, method: string, body: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw Error(payload.error || "Save failed")
    return payload
  }
  async function saveGate() {
    if (!gateDraft) { setError("Click the campus map to choose the main entrance."); return }
    setSaving(true); setError(""); setNotice("")
    try {
      await requestWrite("/api/admin/wayfinding", "PUT", { action: "gate", gate: gateDraft })
      setGate(gateDraft)
      setMode("view")
      setNotice("Main entrance saved. Existing routes must be reviewed after changing the gate.")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save gate") }
    finally { setSaving(false) }
  }
  async function savePin() {
    if (!selected || !pinDraft) { setError("Choose a destination and its location."); return }
    setSaving(true); setError(""); setNotice("")
    try {
      await requestWrite("/api/admin/destinations", "PATCH", { id: selected.id, map_x: pinDraft.x, map_y: pinDraft.y })
      setDestinations(old => old.map(d => d.id === selected.id ? { ...d, map_x: pinDraft.x, map_y: pinDraft.y } : d))
      setMode("view")
      setNotice("Destination position saved. Review and republish its route if you moved the pin.")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save pin") }
    finally { setSaving(false) }
  }
  async function saveRoute(published: boolean) {
    if (!selected) return
    if (!gate || !end) { setError("Set the main gate and destination pin first."); return }
    if (published && valid) { setError(valid); return }
    setSaving(true); setError(""); setNotice("")
    try {
      const payload = await requestWrite("/api/admin/wayfinding", "PUT", {
        action: "route", destinationId: selected.id,
        points: [gate, ...waypoints, end], instructions, published
      })
      setStoredRoute(payload.route)
      setMode("view")
      setNotice(published
        ? "Route published for approved visitors. Confirm that the line follows actual permitted walkways."
        : "Draft saved. Visitors will not see this path until you publish it.")
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save route") }
    finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen w-full min-w-0 bg-[#faf6f7] text-gray-900 overflow-x-clip">
      <header className="border-b border-rose-100 bg-white">
        <div className="mx-auto w-full min-w-0 max-w-7xl px-3 sm:px-4 py-4 flex flex-col sm:flex-row flex-wrap sm:items-center sm:justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[#8b1e37]">Bantay-Agapay · Administrator</p>
            <h1 className="text-2xl font-extrabold text-[#541322]">Campus Wayfinding</h1></div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-semibold text-[#82172a]">
            <Link href="/admin/destinations">Destination Management</Link><Link href="/admin">Admin Dashboard</Link>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full min-w-0 max-w-7xl px-3 sm:px-4 py-5 sm:py-7 space-y-5">
        <div className="rounded-2xl border border-rose-100 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-lg">Design safe campus walking routes</h2>
          <p className="text-sm text-gray-600 mt-1">Set the main entrance, pin each faculty or office, then tap along the <strong>actual permitted walkway</strong> from gate to destination. A path is never generated automatically through buildings.</p>
          <p className="mt-2 text-xs text-gray-500">These are coordinates on the illustrated campus map, not latitude/longitude or live visitor tracking. Published routes unlock after guard approval.</p>
        </div>
        {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">{error} <Link className="underline" href="/login">Staff login</Link></div>}
        {notice && <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">{notice}</div>}
        {loading ? <p>Loading campus destinations…</p> : (
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(270px,1fr)] items-start">
            <section className="min-w-0 max-w-full rounded-2xl border border-rose-100 bg-white p-3 sm:p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
                <h2 className="font-bold">Campus Map</h2>
                <button type="button" className="w-full sm:w-auto rounded-lg border border-[#82172a] px-3 py-2 text-sm font-semibold text-[#82172a]" onClick={() => setMapZoom(value => !value)}>
                  {mapZoom ? "Fit map to screen" : "Zoom map for accurate pinning"}
                </button>
                <span className="w-full text-xs font-semibold text-[#82172a]">{mode === "view" ? "Preview" : mode === "gate" ? "Tap the gate position" : mode === "pin" ? "Tap destination position" : "Tap each walkway turning point"}</span>
              </div>
              <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-rose-200 bg-[#f6ebee]">
                <div className={mapZoom ? "relative w-[820px] min-w-[820px]" : "relative w-full min-w-0"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img ref={mapRef} src="/campus-map.png" alt="AFGBMTS campus map. Click to place the selected marker or walking route points."
                  onClick={mapClick} draggable={false} className={"block w-full h-auto max-w-none select-none " + (mode === "view" ? "" : "cursor-crosshair")} />
                <svg viewBox={"0 0 " + MAP_WIDTH + " " + MAP_HEIGHT} preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full" role="img" aria-label="Walking route and location markers">
                  <defs>
                    <marker id="way-arrow-admin" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L6,3 L0,6" fill="none" stroke="#82172a" strokeWidth="1.6" />
                    </marker>
                  </defs>
                  {line.length > 1 && <>
                    <polyline points={line.map(p => p.x + "," + p.y).join(" ")} fill="none" stroke="white" strokeWidth="16" strokeLinejoin="round" strokeLinecap="round" />
                    <polyline points={line.map(p => p.x + "," + p.y).join(" ")} fill="none" stroke="#82172a" strokeWidth="7" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="22 12" markerMid="url(#way-arrow-admin)" />
                  </>}
                  {line.slice(1, -1).map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="12" fill="#fff" stroke="#82172a" strokeWidth="4"/><text x={p.x} y={p.y+5} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#82172a">{i+1}</text></g>)}
                  {drawnGate && <g><circle cx={drawnGate.x} cy={drawnGate.y} r="18" fill="#148359" stroke="white" strokeWidth="6"/><text x={drawnGate.x+24} y={drawnGate.y-18} fontSize="25" fontWeight="bold" fill="#148359" stroke="white" strokeWidth="4" paintOrder="stroke">START · GATE</text></g>}
                  {drawnEnd && <g><circle cx={drawnEnd.x} cy={drawnEnd.y} r="18" fill="#82172a" stroke="white" strokeWidth="6"/><text x={drawnEnd.x+24} y={drawnEnd.y-18} fontSize="25" fontWeight="bold" fill="#82172a" stroke="white" strokeWidth="4" paintOrder="stroke">DESTINATION</text></g>}
                </svg>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 mt-4 text-xs font-medium text-gray-700">
                <span><span className="text-emerald-700">●</span> Main gate</span><span><span className="text-[#82172a]">●</span> Destination</span><span>— Approved walkway</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Pin changes and gate changes automatically invalidate previously published paths until they are reviewed and republished.</p>
            </section>
            <aside className="min-w-0 max-w-full rounded-2xl border border-rose-100 bg-white p-4 sm:p-5 shadow-sm space-y-5 break-words">
              <div className="space-y-2">
                <label htmlFor="destination" className="text-sm font-bold">Select faculty, office or building</label>
                <select id="destination" className={inputStyle + " w-full"} value={selectedId}
                  onChange={e => { setSelectedId(e.target.value); setError(""); setNotice("") }}>
                  {destinations.map(d => <option key={d.id} value={d.id}>{d.name}{!d.active ? " (inactive)" : ""}</option>)}
                </select>
                <div className="text-xs text-gray-500">{selected?.building || "No building"} · {selected?.floor || "Floor unspecified"} · {selected?.room || "Room unspecified"}</div>
                <div className="text-xs font-semibold">{livePublished ? <span className="text-emerald-700">✓ Approved route is published</span> : storedRoute?.published ? <span className="text-amber-700">⚠ Review required: coordinates changed</span> : <span className="text-amber-700">Draft / unpublished walking route</span>}</div>
              </div>
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-bold">1 · Set the main gate</h3>
                <p className="text-xs text-gray-500">{gate ? "Current gate: " + gate.x + ", " + gate.y : "Not configured yet"}</p>
                <button type="button" className={buttonStyle + " w-full bg-gray-100 text-gray-900"} onClick={() => {setGateDraft(gate);setMode("gate")}}>Choose Gate on Map</button>
                {mode === "gate" && <div className="space-y-2">
                  <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-2">
                    {(["x","y"] as const).map(k => <label key={k} className="text-xs font-medium">{k.toUpperCase()}
                      <input type="number" min={0} max={k === "x" ? MAP_WIDTH : MAP_HEIGHT} className={inputStyle+" w-full"}
                        value={gateDraft?.[k] ?? ""} onChange={e => setGateDraft(old => point({x:k==="x"?Number(e.target.value):old?.x,y:k==="y"?Number(e.target.value):old?.y}))} />
                    </label>)}
                  </div>
                  <button type="button" disabled={saving || !gateDraft} className={buttonStyle+" w-full bg-[#82172a] text-white"} onClick={saveGate}>Save Main Gate</button>
                </div>}
              </div>
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-bold">2 · Pin the destination</h3>
                <p className="text-xs text-gray-500">{end ? "Current pin: " + end.x + ", " + end.y : "No destination pin set"}</p>
                <button type="button" disabled={!selected} className={buttonStyle + " w-full bg-gray-100 text-gray-900"}
                  onClick={() => {setPinDraft(end);setMode("pin")}}>Choose Destination Pin</button>
                {mode === "pin" && <div className="space-y-2">
                  <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-2">
                    {(["x","y"] as const).map(k => <label key={k} className="text-xs font-medium">{k.toUpperCase()}
                      <input type="number" min={0} max={k === "x" ? MAP_WIDTH : MAP_HEIGHT} className={inputStyle+" w-full"}
                        value={pinDraft?.[k] ?? ""} onChange={e => setPinDraft(old => point({x:k==="x"?Number(e.target.value):old?.x,y:k==="y"?Number(e.target.value):old?.y}))} />
                    </label>)}
                  </div>
                  <button type="button" disabled={saving || !pinDraft} className={buttonStyle+" w-full bg-[#82172a] text-white"} onClick={savePin}>Save Destination Pin</button>
                </div>}
              </div>
              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-bold">3 · Draw walking path</h3>
                <p className="text-xs text-gray-500">Tap each safe walkway turn, in order, between the green gate and the destination marker. At least one waypoint is required. No route will cross buildings automatically.</p>
                <button type="button" disabled={!gate || !end} className={buttonStyle + " w-full bg-gray-100 text-gray-900"}
                  onClick={() => setMode("route")}>{mode === "route" ? "Drawing route · Tap the map" : "Edit Walking Path"}</button>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button type="button" className={buttonStyle+" bg-gray-100 flex-1"} disabled={!waypoints.length || saving}
                    onClick={() => setWaypoints(p => p.slice(0,-1))}>Undo Last</button>
                  <button type="button" className={buttonStyle+" bg-gray-100 flex-1"} disabled={!waypoints.length || saving}
                    onClick={() => setWaypoints([])}>Clear</button>
                </div>
                <p className="text-xs text-gray-500">{waypoints.length} walkway waypoint{waypoints.length === 1 ? "" : "s"} · Maximum 62</p>
                <label htmlFor="walking-steps" className="block text-sm font-bold">Optional step-by-step directions</label>
                <textarea id="walking-steps" rows={4} maxLength={1200} value={instructions}
                  onChange={e => setInstructions(e.target.value)} className={inputStyle+" w-full"}
                  placeholder={"Enter through the main gate.\nFollow the walkway past the administration building.\nTurn left toward the faculty office."}/>
                <p className="text-xs text-gray-500">One instruction per line. Enter only verified landmarks and permitted paths.</p>
                {valid && <p className="text-xs text-amber-800">{valid}</p>}
                <button type="button" disabled={saving || !gate || !end} className={buttonStyle+" w-full bg-gray-100 text-gray-900"}
                  onClick={() => saveRoute(false)}>{saving ? "Saving…" : "Save Unpublished Draft"}</button>
                <button type="button" disabled={saving || !gate || !end || Boolean(valid) || !selected?.active}
                  className={buttonStyle+" w-full bg-[#82172a] text-white"}
                  onClick={() => saveRoute(true)}>{saving ? "Saving…" : "Publish Approved Route"}</button>
                {storedRoute?.published && <button type="button" disabled={saving || !gate || !end}
                  className={buttonStyle+" w-full border border-red-200 text-red-800"} onClick={() => saveRoute(false)}>Unpublish Route</button>}
              </div>
              {mode !== "view" && <button type="button" onClick={() => setMode("view")} className="text-xs underline text-gray-600">Stop editing the map</button>}
              <p className="border-t pt-4 text-xs text-gray-500">Publishing confirms that a responsible school administrator reviewed the actual campus walkways. These directions are static, not live GPS navigation.</p>
            </aside>
          </div>
        )}
      </main>
    </div>
  )
}
