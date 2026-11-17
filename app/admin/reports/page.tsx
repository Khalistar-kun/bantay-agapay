"use client"

import { useEffect,useState } from "react"
import Link from "next/link"
type Point={day:string;registrations:number;entries:number;exits:number}
type Activity={timezone:string;days:number;series:Point[];summary:{currentlyInside:number;openCases:number;registered:number;entries:number}}
type Visit={id:string;name:string;reference:string;purpose:string;status:string;registeredAt:string;checkIn:string|null;checkOut:string|null;approvedBy:string|null;checkedOutBy:string|null;denialReason:string|null;destination:string}
type Audit={id:string;action:string;entity_type:string|null;entity_id:string|null;user_id:string;created_at:string}
const field="w-full min-w-0 rounded-xl border border-rose-200 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-rose-300"
function daysAgo(days:number){return new Date(Date.now()-days*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})}
export default function SchoolReports(){
 const [tab,setTab]=useState<"activity"|"visits"|"audit">("activity")
 const [days,setDays]=useState(30)
 const [activity,setActivity]=useState<Activity|null>(null)
 const [visits,setVisits]=useState<Visit[]>([])
 const [audit,setAudit]=useState<Audit[]>([])
 const [query,setQuery]=useState("")
 const [status,setStatus]=useState("")
 const [from,setFrom]=useState("")
 const [to,setTo]=useState("")
 const [error,setError]=useState("")
 const [busy,setBusy]=useState(false)
 async function load(view=tab){
  setBusy(true);setError("")
  try{
   const qs=new URLSearchParams({view})
   if(view==="activity")qs.set("days",String(days))
   if(view==="visits"){if(query)qs.set("q",query);if(status)qs.set("status",status);if(from)qs.set("from",from);if(to)qs.set("to",to)}
   const r=await fetch("/api/admin/reports?"+qs.toString(),{cache:"no-store"})
   const data=await r.json()
   if(!r.ok)throw Error(data.error||"Could not load reports")
   if(view==="activity")setActivity(data)
   if(view==="visits")setVisits(data.visits||[])
   if(view==="audit")setAudit(data.audit||[])
  }catch(e){setError(e instanceof Error?e.message:"Could not load reports")}
  finally{setBusy(false)}
 }
 useEffect(()=>{void load(tab)},[tab,days])
 const max=Math.max(1,...(activity?.series||[]).flatMap(d=>[d.registrations,d.entries,d.exits]))
 return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf6f8] px-3 py-5 text-[#2b1c26] sm:px-6">
  <div className="mx-auto max-w-6xl space-y-5">
   <header className="rounded-2xl bg-gradient-to-br from-[#aa2343] to-[#471320] p-5 text-white sm:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div><p className="text-xs font-bold uppercase tracking-widest text-rose-100">Bantay-Agapay · School Management</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Visitor Activity & Audit Reports</h1>
      <p className="mt-2 text-sm text-rose-100">Entry, exit, pre-registration, incident and staff-action records for school oversight.</p></div>
     <Link href="/admin" className="rounded-full border border-white/50 px-4 py-2 text-center text-sm">← Admin Dashboard</Link>
    </div>
   </header>
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
   <div className="grid grid-cols-3 gap-2">
    {(["activity","visits","audit"] as const).map(t=><button key={t} className={"rounded-xl px-2 py-3 text-xs font-bold capitalize sm:text-sm "+(tab===t?"bg-[#82172a] text-white":"bg-white text-[#82172a]")} onClick={()=>setTab(t)}>{t==="activity"?"Activity Charts":t==="visits"?"Visit Records":"Audit Trail"}</button>)}
   </div>
   {tab==="activity"&&<section className="min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div><h2 className="text-lg font-bold">Daily Entry & Exit Trends</h2><p className="text-xs text-gray-500">Calendar days in Asia/Manila. Pre-registered is not an actual campus entry.</p></div>
     <label className="text-sm font-semibold">Timeframe
      <select className={field+" mt-1"} value={days} onChange={e=>setDays(Number(e.target.value))}>
       <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option>
      </select></label>
    </div>
    {busy?<p role="status">Loading activity…</p>:activity&&<>
     <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[["Pre-registrations",activity.summary.registered],["Recorded Entries",activity.summary.entries],
       ["Currently Inside",activity.summary.currentlyInside],["Open Incidents",activity.summary.openCases]]
      .map(([label,value])=><div key={label} className="min-w-0 rounded-xl bg-[#faf2f4] p-4">
       <p className="text-xs text-[#755661]">{label}</p><strong className="mt-2 block text-2xl text-[#82172a]">{value}</strong>
      </div>)}
     </div>
     <div className="w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain rounded-xl border border-rose-100 p-3">
      <div className="flex h-56 min-w-[610px] items-end gap-1 border-b border-gray-200">
       {activity.series.map(point=><div key={point.day} className="flex min-w-0 flex-1 flex-col justify-end gap-1" title={point.day+": "+point.entries+" entries, "+point.exits+" exits"}>
        <div className="mx-auto flex h-44 w-full max-w-6 items-end justify-center gap-px">
         <div style={{height:(point.registrations/max*100)+"%"}} className="w-1/3 rounded-t bg-[#f0c54a]"/>
         <div style={{height:(point.entries/max*100)+"%"}} className="w-1/3 rounded-t bg-[#82172a]"/>
         <div style={{height:(point.exits/max*100)+"%"}} className="w-1/3 rounded-t bg-[#2d856a]"/>
        </div>
        <p className="text-center text-[9px] text-gray-500">{point.day.slice(5)}</p>
       </div>)}
      </div>
     </div>
     <div className="flex flex-wrap gap-4 text-xs font-semibold"><span className="text-[#ac7e09]">● Pre-registration</span><span className="text-[#82172a]">● Entry</span><span className="text-[#2d856a]">● Exit</span></div>
    </>}
   </section>}
   {tab==="visits"&&<section className="min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <h2 className="text-lg font-bold">Visit Transaction History</h2>
    <form onSubmit={e=>{e.preventDefault();void load("visits")}} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
     <label className="min-w-0 text-sm font-semibold">Search
      <input className={field+" mt-1"} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, reference, destination"/>
     </label>
     <label className="min-w-0 text-sm font-semibold">Status
      <select className={field+" mt-1"} value={status} onChange={e=>setStatus(e.target.value)}>
       <option value="">All statuses</option>{["PENDING","INSIDE","EXITED","DENIED","CANCELLED"].map(s=><option key={s}>{s}</option>)}
      </select>
     </label>
     <label className="min-w-0 text-sm font-semibold">From
      <input type="date" className={field+" mt-1"} value={from} onChange={e=>setFrom(e.target.value)}/>
     </label>
     <label className="min-w-0 text-sm font-semibold">Through
      <input type="date" className={field+" mt-1"} value={to} onChange={e=>setTo(e.target.value)}/>
     </label>
     <button disabled={busy} type="submit" className="rounded-xl bg-[#82172a] px-4 py-3 text-sm font-bold text-white sm:col-span-2 lg:col-span-4">Apply Filters</button>
    </form>
    <p className="text-xs text-gray-500">Shows the most recent 800 matching visit records. Export and full historical pagination require a separate approved data-retention policy.</p>
    <div className="grid min-w-0 gap-3">
     {visits.map(v=><div key={v.id} className="min-w-0 rounded-xl border border-rose-100 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
       <div className="min-w-0"><strong className="break-words">{v.name||"Visitor"} · {v.reference}</strong>
        <p className="text-sm text-gray-600">{v.destination} · {v.purpose}</p></div>
       <span className="w-fit rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-[#82172a]">{v.status}</span>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-gray-500 sm:grid-cols-2">
       <span>Registered: {new Date(v.registeredAt).toLocaleString("en-PH")}</span>
       <span>Check-in: {v.checkIn?new Date(v.checkIn).toLocaleString("en-PH"):"—"}</span>
       <span>Check-out: {v.checkOut?new Date(v.checkOut).toLocaleString("en-PH"):"—"}</span>
       <span>Approved by staff ID: {v.approvedBy||"—"}</span>
       <span>Checked out by staff ID: {v.checkedOutBy||"—"}</span>
       {v.denialReason&&<span className="text-red-800">Denial: {v.denialReason}</span>}
      </div>
     </div>)}
     {!visits.length&&<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">No records match the selected filters.</p>}
    </div>
   </section>}
   {tab==="audit"&&<section className="min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
    <h2 className="text-lg font-bold">Security Audit Trail</h2>
    <p className="text-sm text-gray-600">Read-only staff action history. Sensitive reference photos and student records are not included in audit exports.</p>
    <div className="grid gap-2">
     {audit.map(x=><div key={x.id} className="flex min-w-0 flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><strong className="break-words text-sm">{x.action}</strong>
       <p className="text-xs text-gray-500">{x.entity_type||"Action"} · {x.entity_id||"—"}</p></div>
      <time className="text-xs text-gray-500">{new Date(x.created_at).toLocaleString("en-PH")}</time>
     </div>)}
     {!audit.length&&<p className="text-sm text-gray-500">No audit actions returned.</p>}
    </div>
   </section>}
   <Link href="/security/incidents" className="block rounded-xl border border-rose-200 bg-white px-5 py-4 text-center font-semibold text-[#82172a]">Review Security Incidents & Alerts →</Link>
  </div>
 </main>
}
