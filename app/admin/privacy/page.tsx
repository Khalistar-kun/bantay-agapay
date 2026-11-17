"use client"

import {useEffect,useState} from "react"
import Link from "next/link"

type Settings={contactEmail:string;visitorRetentionDays:number;guardianReviewDays:number;noticeVersion:string;enforcementEnabled:boolean}
type PrivacyRequest={id:string;request_type:string;subject_type:string;subject_reference:string;
 details:string;status:string;created_at:string;resolution_notes:string|null}
const input="w-full min-w-0 rounded-xl border border-rose-200 bg-white px-3 py-3 text-[16px] outline-none focus:ring-2 focus:ring-rose-300"
const btn="rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
const initial:Settings={contactEmail:"",visitorRetentionDays:30,guardianReviewDays:365,noticeVersion:"draft-1",enforcementEnabled:false}
export default function PrivacyManagement(){
 const [values,setValues]=useState<Settings>(initial)
 const [requests,setRequests]=useState<PrivacyRequest[]>([])
 const [kind,setKind]=useState("ACCESS"),[subject,setSubject]=useState("VISITOR")
 const [reference,setReference]=useState(""),[details,setDetails]=useState("")
 const [notes,setNotes]=useState<Record<string,string>>({})
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false)
 async function load(){
  const [a,b]=await Promise.all([fetch("/api/admin/privacy",{cache:"no-store"}),
   fetch("/api/admin/privacy?view=requests",{cache:"no-store"})])
  const [aa,bb]=await Promise.all([a.json(),b.json()])
  if(!a.ok||!b.ok)throw Error(aa.error||bb.error||"Privacy records unavailable")
  setValues(aa.settings);setRequests(bb.requests||[])
 }
 useEffect(()=>{void load().catch(e=>setError(e.message))},[])
 async function mutate(method:"POST"|"PATCH",body:Record<string,unknown>){
  setBusy(true);setError("");setNotice("")
  try{
   const r=await fetch("/api/admin/privacy",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
   const j=await r.json()
   if(!r.ok)throw Error(j.error||"Could not save")
   setNotice(method==="PATCH"?"Review note and status recorded.":"Privacy policy or request saved.")
   await load()
  }catch(e){setError(e instanceof Error?e.message:"Operation failed")}
  finally{setBusy(false)}
 }
 function change<K extends keyof Settings>(field:K,value:Settings[K]){setValues(x=>({...x,[field]:value}))}
 return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf6f8] px-3 py-5 text-[#291a24] sm:px-6">
  <div className="mx-auto max-w-5xl space-y-5">
   <header className="rounded-2xl bg-gradient-to-br from-[#b12e4a] to-[#471320] p-5 text-white sm:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div><p className="text-xs font-bold uppercase tracking-widest text-rose-100">Bantay-Agapay · School Management</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">System Privacy & Data Lifecycle</h1>
      <p className="mt-2 max-w-2xl text-sm text-rose-100">Set a school-approved privacy policy, manage access/correction/deletion requests, and document review decisions.</p></div>
     <Link href="/admin" className="rounded-full border border-white/50 px-4 py-2 text-center text-sm">← Admin Dashboard</Link>
    </div>
   </header>
   <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
    <strong>Privacy release gate:</strong> Retention targets are for policy planning. Automatic erasure is <strong>not enabled</strong> until the school approves a legally reviewed retention policy, tested purge process, and verified backups. Do not consider a deletion request fulfilled merely by changing its status.
   </div>
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
   {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
   <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
    <form onSubmit={e=>{e.preventDefault();void mutate("POST",{action:"settings",...values})}}
     className="min-w-0 space-y-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
     <h2 className="text-lg font-bold">School Privacy Policy Settings</h2>
     <label className="block text-sm font-semibold">School Privacy Contact Email
      <input type="email" required className={input+" mt-1"} value={values.contactEmail}
       onChange={e=>change("contactEmail",e.target.value)} placeholder="privacy@school-domain.edu.ph"/>
     </label>
     <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Visitor Data Retention Target (days)
       <input type="number" min={7} max={365} required className={input+" mt-1"} value={values.visitorRetentionDays}
        onChange={e=>change("visitorRetentionDays",Number(e.target.value))}/>
      </label>
      <label className="text-sm font-semibold">Guardian Registry Review Interval (days)
       <input type="number" min={30} max={3650} required className={input+" mt-1"} value={values.guardianReviewDays}
        onChange={e=>change("guardianReviewDays",Number(e.target.value))}/>
      </label>
     </div>
     <label className="block text-sm font-semibold">Privacy Notice Version
      <input required maxLength={40} className={input+" mt-1"} value={values.noticeVersion}
       onChange={e=>change("noticeVersion",e.target.value)}/>
     </label>
     <p className="text-xs text-gray-600">Enrollment photos and student records remain restricted to authorized school staff. Policy settings do not automatically delete or export any records.</p>
     <button disabled={busy} className={btn+" w-full bg-[#82172a] text-white"}>Save Privacy Settings</button>
    </form>
    <form onSubmit={e=>{e.preventDefault();void mutate("POST",{
      action:"request",requestType:kind,subjectType:subject,subjectReference:reference,details
     }).then(()=>{setDetails("");setReference("")})}}
     className="min-w-0 space-y-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
     <h2 className="text-lg font-bold">Record a Privacy Request</h2>
     <p className="text-xs text-gray-600">Use a visit reference or approved record ID. Avoid unnecessary child names or private details in request notes.</p>
     <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm font-semibold">Request Type
       <select className={input+" mt-1"} value={kind} onChange={e=>setKind(e.target.value)}>
        <option value="ACCESS">Access</option><option value="CORRECTION">Correction</option>
        <option value="DELETION">Deletion</option>
       </select></label>
      <label className="text-sm font-semibold">Record Type
       <select className={input+" mt-1"} value={subject} onChange={e=>setSubject(e.target.value)}>
        <option value="VISITOR">Visitor</option><option value="PRE_REGISTRATION">Pre-registration</option>
        <option value="GUARDIAN">Guardian</option>
       </select></label>
     </div>
     <label className="block text-sm font-semibold">Reference Number
      <input required className={input+" mt-1"} maxLength={100} value={reference} onChange={e=>setReference(e.target.value)}/>
     </label>
     <label className="block text-sm font-semibold">Request Summary
      <textarea required rows={3} className={input+" mt-1"} maxLength={500} value={details}
       onChange={e=>setDetails(e.target.value)}/>
     </label>
     <button disabled={busy||details.trim().length<5} className={btn+" w-full bg-[#82172a] text-white"}>Record Privacy Request</button>
    </form>
   </div>
   <section className="min-w-0 space-y-3 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
    <h2 className="text-lg font-bold">Privacy Request Register</h2>
    <div className="grid min-w-0 gap-3">
     {requests.map(r=><article key={r.id} className="min-w-0 space-y-3 rounded-xl border p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
       <div><strong className="text-sm">{r.request_type} · {r.subject_type.replace(/_/g," ")}</strong>
        <p className="mt-1 break-words text-xs text-gray-600">Reference {r.subject_reference}</p>
        <p className="mt-2 break-words text-sm">{r.details}</p></div>
       <span className="text-xs font-bold text-[#82172a]">{r.status}</span>
      </div>
      <p className="text-xs text-gray-500">Submitted {new Date(r.created_at).toLocaleString("en-PH")}</p>
      {r.status!=="RESOLVED"&&<>
       <textarea className={input} rows={2} maxLength={500}
        placeholder="Document the authorized school review and actions taken"
        value={notes[r.id]||""} onChange={e=>setNotes(x=>({...x,[r.id]:e.target.value}))}/>
       <div className="flex flex-col gap-2 sm:flex-row">
        <button disabled={busy||(notes[r.id]||"").trim().length<3}
         className={btn+" border border-[#82172a] text-[#82172a]"}
         onClick={()=>void mutate("PATCH",{id:r.id,status:"REVIEWED",notes:notes[r.id]})}>Mark Reviewed</button>
        {r.request_type!=="DELETION"&&<button disabled={busy||(notes[r.id]||"").trim().length<3}
         className={btn+" bg-[#82172a] text-white"}
         onClick={()=>void mutate("PATCH",{id:r.id,status:"RESOLVED",notes:notes[r.id]})}>Mark Resolved (After Action)</button>}
       </div>
      </>}
      {r.request_type==="DELETION"&&<p className="text-xs text-amber-800">Deletion requests require school-controlled verification and a separate tested erasure procedure before closure.</p>}
     </article>)}
     {!requests.length&&<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">No privacy requests recorded.</p>}
    </div>
   </section>
  </div>
 </main>
}
