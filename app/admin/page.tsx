"use client"

import { useEffect,useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ProfilePhotoPrompt } from "@/components/staff/ProfilePhotoPrompt"

type Stats={
  todayVisitors:number;currentlyInside:number;pendingApproval:number;completedToday:number;
  preRegisteredToday:number;entriesToday:number;openCases:number
}
type Activity={series:{day:string;registrations:number;entries:number;exits:number}[]}
type Me={fullName:string|null;hasPhoto:boolean;photoUrl:string|null}
const zero:Stats={todayVisitors:0,currentlyInside:0,pendingApproval:0,completedToday:0,preRegisteredToday:0,entriesToday:0,openCases:0}
const links=[
 {href:"/admin/registry",label:"Guardian & Student Registry",description:"Verify legal guardians, students, relationship permissions and reference photos",icon:"👨‍👩‍👧"},
 {href:"/admin/visitors",label:"Visitor Records",description:"Manage visitor profiles and inspect registration history",icon:"📋"},
 {href:"/admin/reports",label:"Activity & Audit Reports",description:"Entry/exit charts, visit filters, staff attribution and audit trail",icon:"📊"},
 {href:"/security/gate",label:"Gate Verification",description:"Assist with QR entry, exit and guardian identity checks",icon:"▦"},
 {href:"/security/incidents",label:"Alerts & Incidents",description:"Pending cases, invalid codes and follow-up records",icon:"⚠"},
 {href:"/admin/wayfinding",label:"Campus & GPS Routes",description:"Gate location, faculty pins and approved walking paths",icon:"🗺"},
 {href:"/admin/destinations",label:"Faculty & Destinations",description:"Register rooms, buildings, offices and campus locations",icon:"🏫"},
 {href:"/admin/faculty-directory",label:"Faculty Office Directory",description:"Publish approved teacher and faculty destinations for visitor search",icon:"📍"},
 {href:"/admin/personnel",label:"Personnel & Accounts",description:"Manage security guards, school administrator access and photos",icon:"👤"},
 {href:"/admin/settings",label:"School Settings",description:"Configure school geofence, location and map policies",icon:"⚙"},
 {href:"/admin/privacy",label:"Privacy & Data Rights",description:"School privacy contact, data lifecycle targets and request register",icon:"🔒"},
]

export default function AdministratorDashboard(){
 const router=useRouter()
 const [stats,setStats]=useState<Stats>(zero)
 const [activity,setActivity]=useState<Activity|null>(null)
 const [me,setMe]=useState<Me|null>(null)
 const [photoPrompt,setPhotoPrompt]=useState(false)
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState("")
 async function load(){
  try{
   const [st,act]=await Promise.all([
    fetch("/api/admin/stats",{cache:"no-store"}),
    fetch("/api/admin/reports?view=activity&days=7",{cache:"no-store"})
   ])
   if(!st.ok||!act.ok)throw Error("Dashboard records could not be loaded")
   setStats(await st.json());setActivity(await act.json())
   setError("")
  }catch(e){setError(e instanceof Error?e.message:"Dashboard unavailable")}
  finally{setLoading(false)}
 }
 async function fetchMe(){
  try{const res=await fetch("/api/auth/me",{cache:"no-store"})
   if(res.ok){const data=await res.json();setMe(data);setPhotoPrompt(!data.hasPhoto)}
  }catch{}
 }
 useEffect(()=>{void load();void fetchMe()},[])
 async function logout(){await fetch("/api/auth/logout",{method:"POST"});router.push("/login")}
 const max=Math.max(1,...(activity?.series||[]).map(x=>Math.max(x.registrations,x.entries,x.exits)))
 const tiles=[
  {label:"Registered Visits Today",number:stats.todayVisitors,info:"Actual visit records created today"},
  {label:"Pre-registrations Today",number:stats.preRegisteredToday,info:"Not yet counted as campus entries"},
  {label:"Recorded Entries Today",number:stats.entriesToday,info:"Authorized check-ins at the gate"},
  {label:"Currently on Campus",number:stats.currentlyInside,info:"Checked in, not yet checked out"},
  {label:"Recorded Exits Today",number:stats.completedToday,info:"Completed exit transactions"},
  {label:"Pending & Review Cases",number:stats.pendingApproval+stats.openCases,info:"Existing pending visits and open incidents"}
 ]
 return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf6f8] text-[#2b1b26]">
  <header className="bg-white border-b border-[#eadde1]">
   <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div><p className="text-xs font-bold uppercase tracking-[.14em] text-[#82172a]">Bantay-Agapay · School Management</p>
      <h1 className="mt-1 text-xl font-extrabold sm:text-2xl">Administrator Dashboard</h1></div>
     <div className="flex flex-wrap items-center gap-3">
      {me&&<div className="flex min-w-0 items-center gap-2">
       {me.photoUrl?<img src={me.photoUrl} alt="Administrator profile" className="size-10 rounded-full object-cover"/>:<span className="grid size-10 place-items-center rounded-full bg-[#82172a] text-white">{me.fullName?.charAt(0)||"A"}</span>}
       <span className="max-w-40 break-words text-xs font-semibold">{me.fullName||"Administrator"}</span>
      </div>}
      <button onClick={()=>void logout()} className="rounded-full border border-[#82172a] px-4 py-2 text-sm font-bold text-[#82172a]">Sign Out</button>
     </div>
    </div>
   </div>
  </header>
  {photoPrompt&&<ProfilePhotoPrompt onDone={()=>{setPhotoPrompt(false);void fetchMe()}}/>}
  <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6 px-3 py-5 sm:px-6 sm:py-8">
   <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#aa2443] to-[#471320] px-5 py-6 text-white sm:px-8 sm:py-8">
    <p className="text-xs font-bold uppercase tracking-widest text-[#f3d2dc]">School Access Operations</p>
    <h2 className="mt-2 max-w-3xl text-2xl font-extrabold sm:text-3xl">Safer school entry. Clear records. Faster gate operations.</h2>
    <p className="mt-2 max-w-2xl text-sm text-[#ffebef]">Guardian identities and student relationships are checked against the school's authorized registry before ordinary admission. A saved QR is not a release authorization for a child.</p>
    <div className="mt-5 flex flex-col gap-2 sm:flex-row">
     <Link href="/admin/registry" className="rounded-xl bg-[#fecb55] px-5 py-3 text-center text-sm font-extrabold text-[#471320]">Manage Authorized Guardians</Link>
     <Link href="/admin/reports" className="rounded-xl border border-white/50 px-5 py-3 text-center text-sm font-bold">View Visit Reports</Link>
    </div>
   </section>
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-900">{error}</p>}
   <section aria-label="Campus statistics" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
    {tiles.map(x=><div key={x.label} className="min-w-0 rounded-xl border border-[#f0dce4] bg-white p-3.5 shadow-sm sm:p-4">
     <p className="text-xs font-semibold text-[#735b65]">{x.label}</p>
     <strong className="mt-2 block text-2xl font-extrabold text-[#82172a] sm:text-3xl">{loading?"—":x.number}</strong>
     <p className="mt-1 text-[11px] leading-relaxed text-gray-500">{x.info}</p>
    </div>)}
   </section>
   <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
    <section className="min-w-0 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
     <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="text-lg font-bold">Recent Visit Activity</h2><p className="text-xs text-gray-500">Last seven days · Philippine local time</p></div>
      <button onClick={()=>void load()} className="text-sm font-semibold text-[#82172a]">Refresh</button>
     </div>
     <div className="mt-5 grid h-44 grid-cols-7 items-end gap-2 border-b border-gray-200 pb-1">
      {(activity?.series||Array.from({length:7},(_,i)=>({day:String(i),entries:0,exits:0,registrations:0}))).map(x=><div key={x.day} className="flex h-full min-w-0 flex-col items-center justify-end gap-1">
       <div className="flex h-32 w-full max-w-[52px] items-end justify-center gap-1">
        <div className="w-1/2 rounded-t bg-[#82172a]" style={{height:(x.entries/max*100)+"%"}}/>
        <div className="w-1/2 rounded-t bg-[#2e8166]" style={{height:(x.exits/max*100)+"%"}}/>
       </div>
       <span className="text-center text-[10px] text-gray-500">{x.day.slice(5)}</span>
      </div>)}
     </div>
     <div className="mt-4 flex flex-wrap gap-4 text-xs font-semibold">
      <span className="text-[#82172a]">● Check-ins</span><span className="text-[#2e8166]">● Check-outs</span>
     </div>
    </section>
    <section className="min-w-0 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
     <h2 className="text-lg font-bold">Security Readiness</h2>
     <div className="mt-4 grid gap-3">
      <div className="rounded-xl bg-[#fff5f7] p-4">
       <p className="text-xs font-semibold text-[#77525e]">Cases requiring attention</p>
       <strong className="mt-1 block text-2xl text-[#82172a]">{stats.openCases}</strong>
       <Link href="/security/incidents" className="mt-2 block text-sm font-bold text-[#82172a] underline">Review incidents</Link>
      </div>
      <div className="rounded-xl bg-[#f2f6f4] p-4">
       <p className="text-sm font-semibold">Gate authorization rule</p>
       <p className="mt-1 text-xs text-gray-600">Student-related visits require verified school registry details and photo review before ordinary admission.</p>
      </div>
     </div>
    </section>
   </div>
   <section>
    <h2 className="mb-3 text-lg font-extrabold">School Management</h2>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
     {links.map(item=><Link href={item.href} key={item.href}
       className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#f1dfe6] bg-white p-4 shadow-sm transition hover:border-[#82172a] hover:shadow-md sm:p-5">
       <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f8e7ed] text-lg">{item.icon}</span>
       <span className="min-w-0"><strong className="block break-words text-sm font-bold">{item.label}</strong>
        <span className="mt-1 block text-xs leading-relaxed text-gray-600">{item.description}</span></span>
     </Link>)}
    </div>
   </section>
  </div>
 </main>
}
