"use client"

import { useEffect,useState } from "react"
import Link from "next/link"

type Incident={id:string;category:string;details:string|null;status:string;created_at:string;resolved_at:string|null;created_by:string|null}
const field="w-full min-w-0 rounded-xl border border-rose-200 bg-white px-3 py-3 text-[16px] outline-none focus:ring-2 focus:ring-rose-300"
const categories=["INVALID_QR","GUARDIAN_MISMATCH","PHOTO_REVIEW","DUPLICATE_SCAN","MISSING_INFORMATION","OTHER"]

export default function SecurityIncidents(){
 const [incidents,setIncidents]=useState<Incident[]>([])
 const [category,setCategory]=useState("OTHER")
 const [details,setDetails]=useState("")
 const [filter,setFilter]=useState("OPEN")
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const [busy,setBusy]=useState(false)
 async function load(){
   try{
     const res=await fetch("/api/security/incidents?status="+filter,{cache:"no-store"})
     const data=await res.json()
     if(!res.ok)throw Error(data.error||"Could not load incidents")
     setIncidents(data.incidents||[])
   }catch(e){setError(e instanceof Error?e.message:"Cannot load incidents")}
 }
 useEffect(()=>{void load()},[filter])
 async function mutate(method:"POST"|"PATCH",body:Record<string,unknown>){
   setBusy(true);setError("");setNotice("")
   try{
     const res=await fetch("/api/security/incidents",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
     const data=await res.json()
     if(!res.ok)throw Error(data.error||"Could not save incident")
     setNotice(method==="POST"?"Security case recorded.":"Case marked as resolved.")
     if(method==="POST")setDetails("")
     await load()
   }catch(e){setError(e instanceof Error?e.message:"Incident operation failed")}
   finally{setBusy(false)}
 }
 return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf6f8] px-3 py-5 text-[#2b1c26] sm:px-6">
  <div className="mx-auto max-w-5xl space-y-5">
   <header className="rounded-2xl bg-gradient-to-br from-[#ac2946] to-[#471320] p-5 text-white sm:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
     <div><p className="text-xs font-bold uppercase tracking-widest text-rose-100">Bantay-Agapay · School Security</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Alerts & Incident Reports</h1>
      <p className="mt-2 text-sm text-rose-100">Handle invalid QR passes, verification mismatches, repeat scans and missing information.</p></div>
     <Link href="/security/gate" className="rounded-full border border-white/50 px-4 py-2 text-center text-sm">← Gate Operations</Link>
    </div>
   </header>
   {error&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</div>}
   {notice&&<div role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</div>}
   <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
    <section className="order-2 min-w-0 rounded-2xl bg-white p-4 shadow-sm lg:order-1 sm:p-6">
     <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xl font-bold">Cases for Review</h2>
      <select className={field+" sm:w-auto"} value={filter} onChange={e=>setFilter(e.target.value)}>
       <option value="OPEN">Open Cases</option><option value="RESOLVED">Resolved Cases</option><option value="">All Cases</option>
      </select>
     </div>
     <div className="mt-4 grid gap-3">
      {incidents.map(x=><article key={x.id} className="min-w-0 rounded-xl border border-rose-100 p-4">
       <div className="flex flex-wrap justify-between gap-2">
        <strong className="text-sm">{x.category.replace(/_/g," ")}</strong>
        <span className={"text-xs font-bold "+(x.status==="OPEN"?"text-amber-800":"text-emerald-800")}>{x.status}</span>
       </div>
       {x.details&&<p className="mt-2 break-words text-sm text-gray-600">{x.details}</p>}
       <p className="mt-2 text-xs text-gray-500">Reported {new Date(x.created_at).toLocaleString("en-PH")}</p>
       {x.status==="OPEN"&&<button disabled={busy} className="mt-3 w-full rounded-xl border border-[#82172a] px-4 py-3 text-sm font-semibold text-[#82172a]" onClick={()=>void mutate("PATCH",{id:x.id})}>Mark Resolved</button>}
      </article>)}
      {!incidents.length&&<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">No incidents for this filter.</p>}
     </div>
    </section>
    <form onSubmit={e=>{e.preventDefault();void mutate("POST",{category,details})}}
      className="order-1 h-fit min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow-sm lg:order-2 sm:p-6">
     <h2 className="text-xl font-bold">Report an Incident</h2>
     <label className="block text-sm font-semibold">Incident Type
      <select className={field+" mt-1"} value={category} onChange={e=>setCategory(e.target.value)}>
       {categories.map(c=><option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
      </select>
     </label>
     <label className="block text-sm font-semibold">Description / Action Taken
      <textarea required rows={4} className={field+" mt-1"} value={details} maxLength={500} onChange={e=>setDetails(e.target.value)} placeholder="Describe the observation, outcome and assistance provided. Avoid unnecessary student personal details."/>
     </label>
     <button disabled={busy||details.trim().length<3} className="w-full rounded-xl bg-[#82172a] px-5 py-3.5 text-sm font-bold text-white disabled:opacity-40">Record Incident</button>
    </form>
   </div>
  </div>
 </main>
}
