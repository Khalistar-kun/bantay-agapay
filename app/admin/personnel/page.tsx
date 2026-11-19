"use client"

import {useEffect,useRef,useState} from "react"
import Link from "next/link"
import QRCode from "qrcode"

type Staff={
 id:string;full_name:string;phone_number:string;position:string|null;
 role:"ADMIN"|"SECURITY";active:boolean;status:"PENDING"|"APPROVED"|"REJECTED";
 created_at:string;photoUrl:string|null
}
const input="w-full min-w-0 max-w-full rounded-xl border border-[#e5d6dc] bg-white px-3 py-3 text-[16px] outline-none focus:ring-2 focus:ring-rose-300"
const action="rounded-xl px-4 py-2.5 text-xs font-semibold disabled:opacity-40"
export default function PersonnelManagement(){
 const [rows,setRows]=useState<Staff[]>([])
 const [role,setRole]=useState<"ADMIN"|"SECURITY">("SECURITY")
 const [name,setName]=useState("")
 const [phone,setPhone]=useState("")
 const [position,setPosition]=useState("")
 const [password,setPassword]=useState("")
 const [inviteRole,setInviteRole]=useState<"ADMIN"|"SECURITY">("SECURITY")
 const [inviteUrl,setInviteUrl]=useState("")
 const [inviteExpiry,setInviteExpiry]=useState("")
 const [busy,setBusy]=useState(false)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const qrRef=useRef<HTMLCanvasElement>(null)
 async function load(){
  const r=await fetch("/api/admin/personnel",{cache:"no-store"})
  const d=await r.json()
  if(!r.ok)throw Error(d.error||"Personnel unavailable")
  setRows(d.personnel||[])
 }
 useEffect(()=>{void load().catch(e=>setError(e.message))},[])
 useEffect(()=>{
  if(inviteUrl&&qrRef.current)QRCode.toCanvas(qrRef.current,inviteUrl,{width:220,margin:2})
    .catch(()=>setError("Invite QR could not be generated"))
 },[inviteUrl])
 async function send(method:"POST"|"PATCH",body:unknown){
  const r=await fetch("/api/admin/personnel",{
   method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)
  })
  const d=await r.json()
  if(!r.ok)throw Error(d.error||"Staff operation failed")
 }
 async function createStaff(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError("");setNotice("")
  try{
   if(password.length<12)throw Error("Use a strong password of at least 12 characters.")
   await send("POST",{fullName:name,phoneNumber:phone,role,password,position})
   setName("");setPhone("");setPassword("");setPosition("")
   setNotice("Staff account created. Advise the employee to change their initial password securely.")
   await load()
  }catch(e){setError(e instanceof Error?e.message:"Cannot create account")}
  finally{setBusy(false)}
 }
 async function changeProfile(id:string,changes:Record<string,unknown>){
  setBusy(true);setError("");setNotice("")
  try{await send("PATCH",{profileId:id,...changes});setNotice("Staff record updated.");await load()}
  catch(e){setError(e instanceof Error?e.message:"Update failed")}
  finally{setBusy(false)}
 }
 async function createInvite(){
  setBusy(true);setError("");setNotice("")
  try{
   const r=await fetch("/api/admin/invites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({role:inviteRole})})
   const d=await r.json()
   if(!r.ok)throw Error(d.error||"Invite unavailable")
   setInviteUrl(window.location.origin+"/invite/"+d.token)
   setInviteExpiry(d.expiresAt)
   setNotice("A one-time staff invite QR is ready. Share it only with the authorized employee.")
  }catch(e){setError(e instanceof Error?e.message:"Invite failed")}
  finally{setBusy(false)}
 }
 const pending=rows.filter(x=>x.status==="PENDING")
 const others=rows.filter(x=>x.status!=="PENDING")
 return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf6f8] px-3 py-5 text-[#291a24] sm:px-6">
  <div className="mx-auto max-w-6xl space-y-5">
   <header className="rounded-2xl bg-gradient-to-br from-[#ad2945] to-[#471320] p-5 text-white sm:p-8">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
     <div><p className="text-xs font-bold uppercase tracking-widest text-rose-100">Bantay-Agapay · School Management</p>
      <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Personnel & Account Management</h1>
      <p className="mt-2 text-sm text-rose-100">Control guard and administrator access, approvals, position and staff profile records.</p></div>
     <Link href="/admin" className="rounded-full border border-white/50 px-4 py-2 text-center text-sm">← Admin Dashboard</Link>
    </div>
   </header>
   {error&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</p>}
   {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</p>}
   <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
    <form onSubmit={createStaff} className="min-w-0 space-y-3 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
     <h2 className="text-lg font-bold">Create Authorized Staff Account</h2>
     <p className="text-xs text-gray-600">The user's password is hashed on the server. Never write their credentials in incident reports or shared documents.</p>
     <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-sm font-semibold">Full Legal Name<input required maxLength={200} value={name} onChange={e=>setName(e.target.value)} className={input+" mt-1"}/></label>
      <label className="min-w-0 text-sm font-semibold">Contact Number<input required maxLength={11} pattern="09[0-9]{9}" value={phone} onChange={e=>setPhone(e.target.value)} className={input+" mt-1"} placeholder="09XXXXXXXXX"/></label>
      <label className="min-w-0 text-sm font-semibold">Role
       <select value={role} onChange={e=>setRole(e.target.value as "ADMIN"|"SECURITY")} className={input+" mt-1"}>
        <option value="SECURITY">Security Personnel</option><option value="ADMIN">School Administrator</option>
       </select></label>
      <label className="min-w-0 text-sm font-semibold">Position / Designation
       <input value={position} maxLength={120} onChange={e=>setPosition(e.target.value)} className={input+" mt-1"} placeholder="School Administrator / Guard"/></label>
     </div>
     <label className="block text-sm font-semibold">Initial Password (12+ characters)
      <input type="password" required minLength={12} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className={input+" mt-1"}/>
     </label>
     <button disabled={busy} className="w-full rounded-xl bg-[#82172a] px-5 py-3.5 text-sm font-bold text-white">Create Staff Account</button>
    </form>
    <section className="min-w-0 space-y-3 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
     <h2 className="text-lg font-bold">One-Time Invite QR</h2>
     <p className="text-xs text-gray-600">For authorized personnel registering on their own phone. Approval remains required for invite sign-ups.</p>
     <select value={inviteRole} onChange={e=>setInviteRole(e.target.value as "ADMIN"|"SECURITY")} className={input}>
      <option value="SECURITY">Security Personnel</option><option value="ADMIN">School Administrator</option>
     </select>
     <button disabled={busy} onClick={()=>void createInvite()} className="w-full rounded-xl border border-[#82172a] px-4 py-3 font-bold text-[#82172a]">Generate Invite QR</button>
     {inviteUrl&&<div className="space-y-3 rounded-xl bg-[#faf4f7] p-4">
      <canvas ref={qrRef} className="mx-auto max-w-full rounded-xl bg-white p-2"/>
      <p className="break-all text-center text-xs text-gray-700">{inviteUrl}</p>
      {inviteExpiry&&<p className="text-center text-xs text-gray-500">Expires: {new Date(inviteExpiry).toLocaleString("en-PH")}</p>}
      <button onClick={()=>void navigator.clipboard.writeText(inviteUrl)} className="w-full rounded-xl bg-[#82172a] px-4 py-3 text-sm font-bold text-white">Copy Invite Link</button>
     </div>}
    </section>
   </div>
   <section className="space-y-3 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><h2 className="text-lg font-bold">Pending Staff Approvals</h2><p className="text-xs text-gray-600">{pending.length} pending account{pending.length===1?"":"s"}</p></div>
     <button onClick={()=>void load()} className="text-sm font-bold text-[#82172a]">Refresh</button>
    </div>
    {pending.length?pending.map(p=><div key={p.id} className="flex min-w-0 flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
     <div className="min-w-0"><strong className="block break-words">{p.full_name}</strong><p className="text-xs text-gray-500">{p.phone_number} · {p.role}</p></div>
     <div className="flex flex-wrap gap-2">
      <button disabled={busy} className={action+" bg-emerald-700 text-white"} onClick={()=>void changeProfile(p.id,{status:"APPROVED"})}>Approve</button>
      <button disabled={busy} className={action+" border border-red-200 text-red-800"} onClick={()=>void changeProfile(p.id,{status:"REJECTED"})}>Reject</button>
     </div>
    </div>):<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">No pending staff access requests.</p>}
   </section>
   <section className="space-y-3 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
    <h2 className="text-lg font-bold">All Personnel</h2>
    <div className="grid min-w-0 gap-3">
     {others.map(p=><div key={p.id} className="flex min-w-0 flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
       {p.photoUrl?<img src={p.photoUrl} alt={p.full_name} className="size-12 shrink-0 rounded-full object-cover"/>:
        <div className="grid size-12 shrink-0 place-items-center rounded-full bg-[#f4e7eb] text-[#82172a]">{p.full_name.charAt(0)}</div>}
       <div className="min-w-0">
        <strong className="block break-words text-sm">{p.full_name}</strong>
        <p className="text-xs text-gray-600">{p.phone_number} · {p.role}</p>
        <p className="text-xs text-gray-500">{p.position||"No position set"} · {p.active?"Active":"Inactive"}</p>
       </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
       <input aria-label={"Position for "+p.full_name} defaultValue={p.position||""} maxLength={120}
        onBlur={e=>{if(e.target.value!==p.position)void changeProfile(p.id,{position:e.target.value})}}
        className="min-w-0 flex-1 rounded-lg border p-2 text-sm sm:w-36" placeholder="Position"/>
       <button disabled={busy} onClick={()=>void changeProfile(p.id,{active:!p.active})}
        className={action+(p.active?" border border-red-200 text-red-800":" bg-emerald-700 text-white")}>
        {p.active?"Deactivate":"Reactivate"}
       </button>
      </div>
     </div>)}
     {!others.length&&<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">No active staff records.</p>}
    </div>
   </section>
  </div>
 </main>
}
