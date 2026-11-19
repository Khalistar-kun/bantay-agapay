"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { QRCheckoutScanner } from "@/components/security/QRCheckoutScanner"

interface InsideVisitor {
  id: string
  reference_number: string
  purpose: string
  check_in: string
  current_latitude: number | null
  current_longitude: number | null
  location_updated_at: string | null
  location_accuracy_m: number | null
  location_age_seconds: number | null
  location_status: "SHARING_ACTIVE"|"DELAYED"|"STALE"|"NOT_SHARED"|"LOW_ACCURACY"|"WAITING_FOR_GPS"
  full_name: string
  contact_number: string
  destination_name: string
}

declare global {
  interface Window {
    L: any
  }
}

export default function CurrentlyInsidePage() {
  const [visitors, setVisitors] = useState<InsideVisitor[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [showScanner, setShowScanner] = useState(false)
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null)
  const [syncError,setSyncError]=useState("")
  const [lastSyncedAt,setLastSyncedAt]=useState<string|null>(null)
  const [viewingLocationId, setViewingLocationId] = useState<string | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const mapInstanceRef = useRef<any>(null)
  const markerRef=useRef<any>(null)
  const accuracyCircleRef=useRef<any>(null)
  const [filter,setFilter]=useState("")
  const [offline,setOffline]=useState(false)

  const fetchInside = async () => {
    try {
      const res = await fetch("/api/security/inside")
      const result=await res.json()
      if(!res.ok)throw Error(result.error||"Could not read active visitors")
      setVisitors(result.visitors||[])
      setSyncError("")
      setLastSyncedAt(new Date().toISOString())
    } catch (err) {
      setSyncError(err instanceof Error?err.message:"Current campus roster could not be refreshed")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInside()
    const interval=setInterval(()=>{if(!document.hidden&&navigator.onLine)void fetchInside()},15000)
    const onNet=()=>setOffline(!navigator.onLine)
    onNet();window.addEventListener("online",onNet);window.addEventListener("offline",onNet)
    return()=>{clearInterval(interval);window.removeEventListener("online",onNet);window.removeEventListener("offline",onNet)}
  }, [])

  useEffect(() => {
    const link = document.createElement("link")
    link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"
    link.rel = "stylesheet"
    document.head.appendChild(link)

    const script = document.createElement("script")
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"
    script.async = true
    script.onload = () => setMapLoaded(true)
    document.head.appendChild(script)
  }, [])

  const visitorBeingViewed=visitors.find(v=>v.id===viewingLocationId)
  const latitude=visitorBeingViewed?.current_latitude??null
  const longitude=visitorBeingViewed?.current_longitude??null
  const accuracyMeters=visitorBeingViewed?.location_accuracy_m??null
  const locationStatus=visitorBeingViewed?.location_status||"NOT_SHARED"
  const isRecentLocation=(locationStatus==="SHARING_ACTIVE"||locationStatus==="DELAYED")&&
    latitude!==null&&longitude!==null
  const matchingVisitors=visitors.filter(v=>
    [v.full_name,v.reference_number,v.destination_name,v.purpose]
      .some(value=>String(value||"").toLowerCase().includes(filter.trim().toLowerCase())))

  // Keep the same Leaflet map instance between 15s roster refreshes.
  // Recreating it for each new visitors object causes flicker and lost gestures.
  useEffect(()=>{
    if(!viewingLocationId||!mapLoaded||!isRecentLocation)return
    const L=window.L
    const container=document.getElementById(`live-map-${viewingLocationId}`)
    if(!L||!container)return
    const map=L.map(container,{scrollWheelZoom:false}).setView(
      [latitude as number,longitude as number],18
    )
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{
      attribution:"© OpenStreetMap contributors",maxZoom:19
    }).addTo(map)
    markerRef.current=L.marker([latitude as number,longitude as number]).addTo(map)
    accuracyCircleRef.current=L.circle([latitude as number,longitude as number],{
      radius:accuracyMeters||25,color:"#82172a",fillOpacity:0.12
    }).addTo(map)
    mapInstanceRef.current=map
    window.requestAnimationFrame(()=>map.invalidateSize())
    return()=>{
      markerRef.current=null;accuracyCircleRef.current=null
      map.remove();mapInstanceRef.current=null
    }
    // Intentionally reinitialize only when selected visitor or map visibility changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[viewingLocationId,mapLoaded,isRecentLocation])

  useEffect(()=>{
    if(!mapInstanceRef.current||!markerRef.current||!isRecentLocation)return
    const coord:[number,number]=[latitude as number,longitude as number]
    markerRef.current.setLatLng(coord)
    accuracyCircleRef.current?.setLatLng(coord)
    if(accuracyMeters!==null)accuracyCircleRef.current?.setRadius(accuracyMeters)
    mapInstanceRef.current.panTo(coord,{animate:false})
  },[latitude,longitude,accuracyMeters,isRecentLocation])

  const statusLabel=(state:InsideVisitor["location_status"])=>({
    SHARING_ACTIVE:"Sharing active",DELAYED:"Delayed location",STALE:"Last location is stale",
    NOT_SHARED:"Visitor not sharing",LOW_ACCURACY:"GPS accuracy too low",WAITING_FOR_GPS:"Waiting for first GPS fix"
  })[state]
  const canViewPosition=(v:InsideVisitor)=>(
    (v.location_status==="SHARING_ACTIVE"||v.location_status==="DELAYED")&&
    v.current_latitude!==null&&v.current_longitude!==null
  )

  const handleCheckout = async (visitId: string) => {
    if(checkingOut)return
    if(!window.confirm("Confirm this visitor is physically leaving campus. This action records checkout and does not authorize student release."))return
    setCheckingOut(visitId)
    setCheckoutNotice(null)
    try {
      const res = await fetch("/api/visit/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitId }),
      })

      if (res.ok) {
        const data=await res.json()
        setCheckoutNotice((data.visitorName||"Visitor")+" checked out successfully.")
        await fetchInside()
      } else {
        const data = await res.json().catch(() => ({}))
        setSyncError(data.error || "Failed to check out visitor")
      }
    } catch (err) {
      setSyncError("Checkout failed. Check your connection and retry.")
    } finally {
      setCheckingOut(null)
    }
  }

  const secondsAgo = (iso: string) => Math.max(0,Math.round((Date.now() - new Date(iso).getTime()) / 1000))

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Bantay-Agapay</h1>
            <Link href="/security" className="text-primary-600 hover:text-primary-800">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </nav>

      {showScanner && (
        <QRCheckoutScanner
          onClose={() => setShowScanner(false)}
          onCheckedOut={(visitorName) => {
            setShowScanner(false)
            setCheckoutNotice(`✓ ${visitorName} checked out successfully`)
            fetchInside()
            setTimeout(() => setCheckoutNotice(null), 4000)
          }}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Currently Inside</h2>
            <p className="text-gray-600">Visitors who have been approved and are on campus</p>
          </div>
          <button
            onClick={() => setShowScanner(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold whitespace-nowrap"
          >
            📷 Scan QR to Check Out
          </button>
        </div>

        {syncError && (
          <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            {syncError} <button type="button" onClick={()=>void fetchInside()} className="ml-2 font-bold underline">Retry</button>
          </div>
        )}
        {lastSyncedAt&&<p role="status" className="mb-4 text-xs text-gray-500">
          Active roster last synchronized: {new Date(lastSyncedAt).toLocaleTimeString("en-PH",{timeZone:"Asia/Manila"})} PH
        </p>}
        {checkoutNotice && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-green-800 font-semibold text-center">
            {checkoutNotice}
          </div>
        )}

        {offline&&<div role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          This device is offline. Live visitor positions cannot refresh; do not treat previously displayed pins as current.
        </div>}
        <label className="mb-4 block text-sm font-semibold text-gray-700">Search visitors
          <input value={filter} onChange={e=>setFilter(e.target.value)}
            placeholder="Visitor, QR reference, destination or purpose"
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-[16px]"/>
        </label>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : matchingVisitors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center text-gray-500">
            {filter?"No matching visitors found.":"No visitors currently inside."}
          </div>
        ) : (
          <div className="grid gap-4">
            {matchingVisitors.map((v) => (
              <div key={v.id} className="bg-white rounded-lg shadow-md">
                <div className="p-6 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                        {v.reference_number}
                      </span>
                      <span className="text-xs text-gray-500">
                        Checked in {new Date(v.check_in).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="font-semibold text-gray-900">{v.full_name}</p>
                    <p className="text-sm text-gray-500">{v.contact_number}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Visiting <span className="font-medium">{v.destination_name}</span> — {v.purpose}
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className={"text-xs font-bold "+(v.location_status==="SHARING_ACTIVE"?
                        "text-emerald-700":v.location_status==="DELAYED"?
                        "text-amber-700":"text-gray-600")}>
                        📍 {statusLabel(v.location_status)}
                      </p>
                      {v.location_updated_at&&v.location_age_seconds!==null&&
                        <p className="text-xs text-gray-500">
                          Last confirmed {secondsAgo(v.location_updated_at)}s ago
                          {v.location_accuracy_m!==null?
                            " · accuracy ±"+Math.round(v.location_accuracy_m)+" m":""}
                        </p>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <button
                      onClick={() => setViewingLocationId(viewingLocationId === v.id ? null : v.id)}
                      disabled={!canViewPosition(v)||offline}
                      className="px-4 py-2 text-sm border border-primary-300 text-primary-700 rounded-lg hover:bg-primary-50 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {viewingLocationId === v.id ? "Hide Location" : "📍 View Recent Location"}
                    </button>
                    <button
                      onClick={() => handleCheckout(v.id)}
                      disabled={checkingOut === v.id}
                      className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {checkingOut === v.id ? "Checking out..." : "Check Out"}
                    </button>
                  </div>
                </div>

                {viewingLocationId === v.id && (
                  <div className="px-6 pb-6">
                    {canViewPosition(v) ? (
                      <div id={`live-map-${v.id}`} className="w-full h-64 rounded-lg border" />
                    ) : (
                      <p role="status" className="text-gray-600 text-sm rounded-lg bg-amber-50 p-3">
                        No recent consented GPS position is available. The visitor may have stopped sharing,
                        moved indoors, lost network access or left the browser in the background.
                        Contact the visitor or guide them by the approved campus map instead.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
