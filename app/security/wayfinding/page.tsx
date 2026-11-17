"use client"

import { useCallback,useEffect,useMemo,useState } from "react"
import Link from "next/link"
import { MAP_WIDTH,MAP_HEIGHT,type MapPoint } from "@/lib/wayfinding"

type Waypoint={points:MapPoint[];instructions:string}
type Destination={
  id:string;name:string;building:string|null;floor:string|null;room:string|null;
  pin:MapPoint|null;route:Waypoint|null
}
type Directory={gate:MapPoint|null;destinations:Destination[];notice:string}
const field="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-[16px] focus:outline-none focus:ring-2 focus:ring-rose-300"

export default function SecurityWayfindingPage(){
  const [data,setData]=useState<Directory|null>(null)
  const [selectedId,setSelectedId]=useState("")
  const [query,setQuery]=useState("")
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState("")
  const load=useCallback(async()=>{
    setLoading(true);setError("")
    try{
      const response=await fetch("/api/security/wayfinding",{cache:"no-store"})
      const body=await response.json()
      if(!response.ok)throw Error(body.error||"School route directory unavailable")
      setData(body as Directory)
      setSelectedId(old=>old||(body.destinations?.[0]?.id||""))
    }catch(e){setError(e instanceof Error?e.message:"Unable to load approved school directions")}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void load()},[load])
  const selected=useMemo(()=>data?.destinations.find(x=>x.id===selectedId)||null,[data,selectedId])
  const filtered=(data?.destinations||[]).filter(x=>
    [x.name,x.building,x.floor,x.room].some(v=>String(v||"").toLowerCase().includes(query.trim().toLowerCase())))
  const route=selected?.route||null
  const gate=data?.gate||null
  return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#faf6f8] px-3 py-5 text-[#2b1b26] sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-[#ad2945] to-[#471320] p-5 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-rose-100">Bantay-Agapay · Security Personnel</p>
        <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Campus & Faculty Route Assistance</h1>
        <p className="mt-2 max-w-2xl text-sm text-rose-100">
          Locate active faculty destinations using the school's approved walking paths.
          Only school administrators can change or publish routes.
        </p>
        <Link href="/security" className="mt-4 inline-flex rounded-full border border-white/50 px-4 py-2 text-sm font-semibold">
          ← Security Dashboard
        </Link>
      </header>
      {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        {error} <button type="button" onClick={()=>void load()} className="ml-2 font-bold underline">Retry</button>
      </div>}
      {loading&&!data&&<p role="status" className="rounded-xl bg-white p-5">Loading active campus routes…</p>}
      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">School Campus Map</h2>
            <button type="button" onClick={()=>void load()} disabled={loading}
              className="rounded-full border border-[#82172a] px-3 py-2 text-xs font-bold text-[#82172a] disabled:opacity-50">
              {loading?"Refreshing…":"Refresh routes"}
            </button>
          </div>
          <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-xl border bg-[#faf6f8]">
            <img src="/campus-map.png" alt="School campus reference map with published route overlay"
              width={MAP_WIDTH} height={MAP_HEIGHT} className="absolute inset-0 h-full w-full object-contain"/>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              {route&&<polyline points={route.points.map(p=>p.x+","+p.y).join(" ")}
                stroke="#82172a" strokeWidth="12" fill="none" strokeLinejoin="round" strokeLinecap="round"/>}
              {gate&&<circle cx={gate.x} cy={gate.y} r="22" fill="#15803d" stroke="white" strokeWidth="8"/>}
              {selected?.pin&&<circle cx={selected.pin.x} cy={selected.pin.y} r="22"
                fill="#82172a" stroke="white" strokeWidth="8"/>}
            </svg>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold text-gray-600">
            <span><span aria-hidden className="text-green-700">●</span> Main school gate</span>
            <span><span aria-hidden className="text-[#82172a]">●</span> Selected destination</span>
            <span>Line: administrator-approved walking path</span>
          </div>
          <p className="mt-3 text-xs text-gray-600">
            This campus image is a reference, not a live GPS location. Follow posted signs and escort rules.
          </p>
        </section>
        <aside className="min-w-0 space-y-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold">Find a School Destination</h2>
          <label className="block text-sm font-semibold">Search building or faculty
            <input value={query} onChange={e=>setQuery(e.target.value)} className={field+" mt-1"}
              placeholder="Search active destinations"/>
          </label>
          <div className="max-h-52 space-y-2 overflow-y-auto">
            {filtered.map(item=><button type="button" key={item.id}
              onClick={()=>setSelectedId(item.id)} aria-pressed={selectedId===item.id}
              className={"w-full rounded-xl border p-3 text-left text-sm "+
                (selectedId===item.id?"border-[#82172a] bg-[#fff0f4]":"border-gray-200 bg-white")}>
              <strong className="block break-words">{item.name}</strong>
              <span className="mt-1 block text-xs text-gray-500">{[item.building,item.floor,item.room].filter(Boolean).join(" · ")||"Building details not set"}</span>
            </button>)}
            {!filtered.length&&<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
              No active destination matches this search.
            </p>}
          </div>
          {selected&&<section className="rounded-xl border border-rose-100 bg-[#fff9fa] p-4">
            <h3 className="font-bold">{selected.name}</h3>
            <p className="mt-1 text-xs text-gray-600">
              {[selected.building,selected.floor,selected.room].filter(Boolean).join(" · ")||"Ask school administration for room information."}
            </p>
            {route?<div className="mt-3 space-y-2 text-sm">
              <p className="font-bold text-emerald-800">Approved route published</p>
              <p className="whitespace-pre-wrap leading-relaxed">{route.instructions||"Follow the displayed approved walking line."}</p>
            </div>:<p role="status" className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              No published walking path. Ask school administration before directing the visitor.
            </p>}
          </section>}
          <p className="text-xs leading-relaxed text-gray-600">
            A visible route does not authorize campus entry or child release. Confirm QR and
            visitor identity in the main gate verification workflow.
          </p>
          <Link href="/security/gate"
            className="block rounded-xl bg-[#82172a] px-4 py-3 text-center text-sm font-bold text-white">
            Open QR & Identity Verification
          </Link>
        </aside>
      </div>
    </div>
  </main>
}
