"use client"

import { useEffect,useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ProfilePhotoPrompt } from "@/components/staff/ProfilePhotoPrompt"

type Me={fullName:string|null;hasPhoto:boolean;photoUrl:string|null}
type Pre={id:string;reference_number:string;full_name:string;purpose:string;status:string;submitted_at:string;guardian_details_status:string}
type Visit={id:string;full_name:string;reference_number:string;destination_name:string;check_in:string}
type Incident={id:string;category:string;details:string|null;status:string;created_at:string}

export default function SecurityOperationsDashboard(){
 const router=useRouter()
 const [me,setMe]=useState<Me|null>(null)
 const [photoPrompt,setPhotoPrompt]=useState(false)
 const [lastUpdated,setLastUpdated]=useState<string|null>(null)
 const [pre,setPre]=useState<Pre[]>([])
 const [inside,setInside]=useState<Visit[]>([])
 const [incidents,setIncidents]=useState<Incident[]>([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 async function load(){
  try{
   // New entries use pre_registrations. Retired legacy pending RPC is not a
   // prerequisite for gate operations: one missing legacy function must not
   // hide the entire queue or current campus roster.
   const [p,i,a]=await Promise.all([
    fetch("/api/security/gate?list=pending",{cache:"no-store"}),
    fetch("/api/security/inside",{cache:"no-store"}),
    fetch("/api/security/incidents?status=OPEN",{cache:"no-store"})
   ])
   const [pj,ij,aj]=await Promise.all([p.json(),i.json(),a.json()])
   if([p,i,a].some(x=>!x.ok))throw Error(pj.error||ij.error||aj.error||"Unable to load gate records")
   setPre(pj.registrations||[]);setInside(ij.visitors||[]);setIncidents(aj.incidents||[])
   setError("");setLastUpdated(new Date().toISOString())
  }catch(e){setError(e instanceof Error?e.message:"Security data unavailable")}
  finally{setLoading(false)}
 }
 async function loadMe(){try{const r=await fetch("/api/auth/me",{cache:"no-store"});if(r.ok){const j=await r.json();setMe(j);setPhotoPrompt(!j.hasPhoto)}}catch{}}
 useEffect(()=>{void load();void loadMe();const timer=setInterval(()=>{if(!document.hidden)void load()},15000);return()=>clearInterval(timer)},[])
 async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.push("/login")}
 const stats=[
  {label:"Pre-registrations",value:pre.length,detail:"Awaiting QR validation"},
  {label:"Inside Campus",value:inside.length,detail:"Checked in, not yet out"},
  {label:"Open Alerts",value:incidents.length,detail:"Requires security follow-up"}
 ]
 return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf6f8] text-[#291b25]">
  <header className="border-b border-[#ebdce2] bg-white">
   <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div><p className="text-xs font-bold uppercase tracking-widest text-[#82172a]">Bantay-Agapay · Gate Operations</p>
      <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Security Personnel Dashboard</h1></div>
     <div className="flex flex-wrap items-center gap-3">
      {me&&<div className="flex items-center gap-2">
       {me.photoUrl?<img src={me.photoUrl} alt="Security officer profile" className="size-10 rounded-full object-cover"/>:
        <span className="grid size-10 place-items-center rounded-full bg-emerald-800 font-bold text-white">{me.fullName?.charAt(0)||"S"}</span>}
       <span className="max-w-40 break-words text-xs font-semibold">{me.fullName||"Security Officer"}</span>
      </div>}
      <button onClick={()=>void logout()} className="rounded-full border border-[#82172a] px-4 py-2 text-sm font-bold text-[#82172a]">Sign Out</button>
     </div>
    </div>
   </div>
  </header>
  {photoPrompt&&<ProfilePhotoPrompt onDone={()=>{setPhotoPrompt(false);void loadMe()}}/>}
  <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
   <section className="rounded-2xl bg-gradient-to-br from-[#ac2b46] to-[#471320] p-5 text-white sm:p-8">
    <p className="text-xs font-bold uppercase tracking-widest text-rose-100">School Entry Control</p>
    <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">Verify each visitor before entry</h2>
    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#fbe6ed]">
     Scan the registration QR, compare the visitor with the photo, confirm parent/guardian authorization where required, and record both entry and exit with your staff account.
    </p>
    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
     <Link href="/security/gate" className="rounded-xl bg-[#ffd06b] px-6 py-3.5 text-center text-sm font-extrabold text-[#4c1729]">
      ▦ Scan Visitor QR & Verify
     </Link>
     <Link href="/security/incidents" className="rounded-xl border border-white/50 px-5 py-3.5 text-center text-sm font-bold">
      View Alerts & Pending Cases
     </Link>
    </div>
   </section>
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">
      {error} <button type="button" onClick={()=>void load()} className="ml-2 font-bold underline">Retry</button>
    </p>}
   {lastUpdated&&<p role="status" className="text-right text-xs text-gray-500">
     Last synchronized: {new Date(lastUpdated).toLocaleTimeString("en-PH",{timeZone:"Asia/Manila"})} PH · Auto-refresh every 15 seconds
   </p>}
   <section aria-label="Gate operation counts" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    {stats.map(x=><div key={x.label} className="min-w-0 rounded-xl border border-rose-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold text-[#6e515e]">{x.label}</p>
      <strong className="mt-2 block text-3xl font-extrabold text-[#82172a]">{loading?"—":x.value}</strong>
      <p className="mt-1 text-xs text-gray-500">{x.detail}</p>
    </div>)}
   </section>
   <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
    <section className="min-w-0 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
     <div className="flex items-center justify-between gap-2">
      <h2 className="text-lg font-bold">Awaiting QR & Identity Review</h2>
      <button onClick={()=>void load()} className="text-sm font-semibold text-[#82172a]">Refresh</button>
     </div>
     <p className="mt-1 text-xs text-gray-500">Pre-registered visitors are NOT counted as inside the school.</p>
     <div className="mt-4 grid gap-2">
      {pre.slice(0,12).map(v=><div key={v.id} className="min-w-0 rounded-xl border border-rose-100 p-3.5">
       <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><strong className="block break-words text-sm">{v.full_name}</strong>
         <p className="mt-1 text-xs text-gray-500">{v.reference_number} · {v.purpose}</p></div>
        <span className={"shrink-0 text-xs font-bold "+(v.status==="NEEDS_REVIEW"?"text-red-800":"text-amber-700")}>{v.status.replace(/_/g," ")}</span>
       </div>
      </div>)}
      {!pre.length&&<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No pending home pre-registrations.</p>}
     </div>
     <Link href="/security/gate" className="mt-4 block rounded-xl bg-[#82172a] px-4 py-3 text-center text-sm font-semibold text-white">Open QR Gate Scanner</Link>
    </section>
    <section className="min-w-0 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
     <h2 className="text-lg font-bold">Currently on Campus</h2>
     <p className="mt-1 text-xs text-gray-500">Every approved visitor must be checked out at departure.</p>
     <div className="mt-4 grid gap-2">
      {inside.slice(0,12).map(v=><div key={v.id} className="min-w-0 rounded-xl border border-rose-100 p-3.5">
       <strong className="block break-words text-sm">{v.full_name}</strong>
       <p className="mt-1 text-xs text-gray-500">{v.reference_number} · {v.destination_name}</p>
       <p className="mt-1 text-xs text-gray-500">Entered {new Date(v.check_in).toLocaleString("en-PH")}</p>
      </div>)}
      {!inside.length&&<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No visitors currently checked in.</p>}
     </div>
     <Link href="/security/inside" className="mt-4 block rounded-xl border border-[#82172a] px-4 py-3 text-center text-sm font-bold text-[#82172a]">View Active Visitors & Checkout</Link>
    </section>
   </div>
   <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <Link href="/security/history" className="rounded-xl border border-rose-100 bg-white p-4 text-center text-sm font-bold text-[#82172a]">Entry & Exit Logs →</Link>
    <Link href="/security/incidents" className="rounded-xl border border-rose-100 bg-white p-4 text-center text-sm font-bold text-[#82172a]">Security Alerts ({incidents.length}) →</Link>
    <Link href="/security/wayfinding" className="rounded-xl border border-rose-100 bg-white p-4 text-center text-sm font-bold text-[#82172a]">Approved Campus Map & Faculty Routes →</Link>
   </section>
   <p className="text-center text-xs text-gray-500">
    QR entry approval never authorizes a child's departure. Follow the school's separate student release policy.
   </p>
  </div>
 </main>
}
