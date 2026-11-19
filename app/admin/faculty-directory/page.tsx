"use client"

import { useEffect,useState } from "react"
import Link from "next/link"

type Destination={id:string;name:string;building:string|null}
type Faculty={id:string;full_name:string;department:string|null;destination_id:string;public_visible:boolean;active:boolean;destinations:{name:string;building:string|null}|null}
const field="w-full min-w-0 rounded-xl border border-rose-200 bg-white px-3 py-3 text-[16px] outline-none focus:ring-2 focus:ring-rose-300"
export default function FacultyDirectory(){
 const [faculty,setFaculty]=useState<Faculty[]>([])
 const [destinations,setDestinations]=useState<Destination[]>([])
 const [form,setForm]=useState({fullName:"",department:"",destinationId:"",publicVisible:false})
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const [busy,setBusy]=useState(false)
 async function load(){
  const [a,b]=await Promise.all([fetch("/api/admin/faculty-directory",{cache:"no-store"}),fetch("/api/admin/destinations",{cache:"no-store"})])
  const [facultyData,destData]=await Promise.all([a.json(),b.json()])
  if(!a.ok||!b.ok)throw Error(facultyData.error||destData.error||"Cannot load faculty directory")
  setFaculty(facultyData.faculty||[])
  setDestinations((destData.destinations||[]).filter((d:{active:boolean})=>d.active))
 }
 useEffect(()=>{void load().catch(e=>setError(e.message))},[])
 async function create(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setNotice("")
  try{
   const r=await fetch("/api/admin/faculty-directory",{
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)
   })
   const data=await r.json()
   if(!r.ok)throw Error(data.error||"Could not save faculty record")
   setForm({fullName:"",department:"",destinationId:"",publicVisible:false})
   setNotice("Faculty member linked to campus destination.")
   await load()
  }catch(e){setError(e instanceof Error?e.message:"Save failed")}
  finally{setBusy(false)}
 }
 async function toggle(row:Faculty){
  setBusy(true);setError("");setNotice("")
  try{
   const r=await fetch("/api/admin/faculty-directory",{
    method:"PATCH",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id:row.id,publicVisible:!row.public_visible})
   })
   const data=await r.json()
   if(!r.ok)throw Error(data.error||"Could not update directory")
   setNotice(row.public_visible?"Faculty removed from visitor search.":"Faculty published for visitor search.")
   await load()
  }catch(e){setError(e instanceof Error?e.message:"Update failed")}
  finally{setBusy(false)}
 }
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#faf6f8] px-3 py-5 text-[#291b25] sm:px-6">
  <div className="mx-auto max-w-5xl space-y-5">
   <header className="rounded-2xl bg-gradient-to-br from-[#ae2b47] to-[#471320] p-5 text-white sm:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div><p className="text-xs font-bold uppercase tracking-widest text-rose-100">Bantay-Agapay · Campus Management</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Faculty Office Directory</h1>
      <p className="mt-2 text-sm text-rose-100">Help visitors locate a teacher's office without publishing personal staff details.</p></div>
     <Link href="/admin" className="rounded-full border border-white/50 px-4 py-2 text-center text-sm">← Admin Dashboard</Link>
    </div>
   </header>
   {error&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</div>}
   {notice&&<div role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</div>}
   <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
    <form onSubmit={create} className="min-w-0 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
     <h2 className="text-lg font-bold">Link Faculty to Destination</h2>
     <p className="text-xs text-gray-600">Only publish staff names and office locations that the school authorizes for visitor search.</p>
     <label className="block text-sm font-semibold">Teacher / Faculty Full Name<input required value={form.fullName} onChange={e=>setForm(x=>({...x,fullName:e.target.value}))} maxLength={200} className={field+" mt-1"}/></label>
     <label className="block text-sm font-semibold">Department<input value={form.department} onChange={e=>setForm(x=>({...x,department:e.target.value}))} maxLength={120} className={field+" mt-1"}/></label>
     <label className="block text-sm font-semibold">Faculty Office / Destination
      <select required value={form.destinationId} onChange={e=>setForm(x=>({...x,destinationId:e.target.value}))} className={field+" mt-1"}>
       <option value="">Select destination</option>
       {destinations.map(d=><option key={d.id} value={d.id}>{d.name}{d.building?" · "+d.building:""}</option>)}
      </select>
     </label>
     <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm">
      <input type="checkbox" className="mt-1 size-4 accent-[#82172a]" checked={form.publicVisible} onChange={e=>setForm(x=>({...x,publicVisible:e.target.checked}))}/>
      <span>Approved for public visitor search by the school</span>
     </label>
     <button disabled={busy} className="w-full rounded-xl bg-[#82172a] px-5 py-3.5 text-sm font-bold text-white">Save Faculty Destination</button>
    </form>
    <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm">
     <h2 className="text-lg font-bold">Directory Records</h2>
     <div className="mt-4 grid gap-3">
      {faculty.map(person=><div key={person.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-rose-100 p-4 sm:flex-row sm:items-center sm:justify-between">
       <div className="min-w-0">
        <strong className="block break-words text-sm">{person.full_name}</strong>
        <p className="mt-1 text-xs text-gray-500">{person.department||"Faculty"} · {person.destinations?.name||"No office"}</p>
        <p className={"mt-1 text-xs font-bold "+(person.public_visible?"text-emerald-800":"text-amber-800")}>
         {person.public_visible?"Visible to Visitors":"Not Published"}
        </p>
       </div>
       <button onClick={()=>void toggle(person)} disabled={busy} className="rounded-xl border border-[#82172a] px-4 py-2.5 text-xs font-bold text-[#82172a]">
        {person.public_visible?"Unpublish":"Publish"}
       </button>
      </div>)}
      {!faculty.length&&<p className="text-sm text-gray-500">No faculty records created.</p>}
     </div>
    </section>
   </div>
  </div>
 </main>
}
