"use client"

import { useEffect,useRef,useState } from "react"
import Link from "next/link"
import jsQR from "jsqr"

type Registration={
 id:string;reference:string;fullName:string;visitorType:string;purpose:string;contactNumber:string;
 studentName:string|null;studentGrade:string|null;studentSection:string|null;
 guardianBirthday:string|null;guardianAddress:string|null;destination:string;building:string;
 submittedAt:string;expiresAt:string;status:string;photoReviewStatus:string;
 guardianDetailsStatus:string;biometricStatus:string;biometricConfidence:number|null;photoUrl:string|null;referencePhotoUrl:string|null;visitId:string|null
}
type Pending={
 id:string;reference_number:string;full_name:string;visitor_type:string;purpose:string;
 status:string;submitted_at:string;guardian_details_status:string;photo_review_status:string;
 destinations:{name:string}|null
}
const button="rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
const field="w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3 py-3 text-[16px] outline-none focus:ring-2 focus:ring-[#d3a0af]"

export default function GateOperations(){
 const [token,setToken]=useState("")
 const [registration,setRegistration]=useState<Registration|null>(null)
 const [pending,setPending]=useState<Pending[]>([])
 const [pendingError,setPendingError]=useState("")
 const [queueFilter,setQueueFilter]=useState("")
 const [queueSyncedAt,setQueueSyncedAt]=useState<string|null>(null)
 const [error,setError]=useState("")
 const [notice,setNotice]=useState("")
 const [reason,setReason]=useState("")
 const [notes,setNotes]=useState("")
 const [referenceReviewed,setReferenceReviewed]=useState(false)
 const [busy,setBusy]=useState(false)
 const [cameraOpen,setCameraOpen]=useState(false)
 const videoRef=useRef<HTMLVideoElement>(null)
 const canvasRef=useRef<HTMLCanvasElement>(null)
 const processedRef=useRef(false)

 async function loadPending(){
   try{
     const res=await fetch("/api/security/gate?list=pending",{cache:"no-store"})
     const data=await res.json()
     if(!res.ok)throw Error(data.error||"Could not load pending gate queue")
     setPending(data.registrations||[])
     setPendingError("")
     setQueueSyncedAt(new Date().toISOString())
   }catch(e){setPendingError(e instanceof Error?e.message:"Gate queue is temporarily unavailable")}
 }
 useEffect(()=>{void loadPending();const timer=setInterval(()=>void loadPending(),15000);return()=>clearInterval(timer)},[])
 useEffect(()=>{
   if(!cameraOpen)return
   let active=true,stream:MediaStream|null=null,raf=0
   const scan=()=>{
     if(!active)return
     const video=videoRef.current,canvas=canvasRef.current
     if(video&&canvas&&video.readyState>=2&&video.videoWidth&&!processedRef.current){
       const ctx=canvas.getContext("2d",{willReadFrequently:true})
       if(ctx){
         const scale=Math.min(1,700/video.videoWidth)
         canvas.width=Math.round(video.videoWidth*scale)
         canvas.height=Math.round(video.videoHeight*scale)
         ctx.drawImage(video,0,0,canvas.width,canvas.height)
         const img=ctx.getImageData(0,0,canvas.width,canvas.height)
         const result=jsQR(img.data,img.width,img.height,{inversionAttempts:"dontInvert"})
         const raw=result?.data?.trim()||""
         if(/^[a-f0-9]{32}$/i.test(raw)){
           processedRef.current=true
           setToken(raw)
           setCameraOpen(false)
           void lookup(raw)
           return
         }
       }
     }
     raf=requestAnimationFrame(scan)
   }
   navigator.mediaDevices?.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false})
     .then(s=>{if(!active){s.getTracks().forEach(t=>t.stop());return}
       stream=s
       const video=videoRef.current
       if(video){video.srcObject=s;void video.play().then(()=>{raf=requestAnimationFrame(scan)})}
     }).catch(()=>{setError("Camera permission denied. Paste the QR code manually.");setCameraOpen(false)})
   return()=>{active=false;cancelAnimationFrame(raf);stream?.getTracks().forEach(t=>t.stop());processedRef.current=false}
 },[cameraOpen])
 async function lookup(value=token){
   setError("");setNotice("");setRegistration(null)
   const normalized=value.trim()
   if(!/^[a-f0-9]{32}$/i.test(normalized)){setError("Scan a valid 32-character Bantay-Agapay QR code.");return}
   setBusy(true)
   try{
     const res=await fetch("/api/security/gate?token="+encodeURIComponent(normalized),{cache:"no-store"})
     const data=await res.json()
     if(!res.ok)throw Error(data.error||"Unable to check QR")
     setRegistration(data.registration)
     setToken(normalized)
     setReferenceReviewed(false)
   }catch(e){setError(e instanceof Error?e.message:"Could not find QR")}
   finally{setBusy(false)}
 }
 async function action(type:"compare-face"|"review-photo"|"approve"|"deny"|"checkout",decision?:"PASSED"|"FAILED"){
   setBusy(true);setError("");setNotice("")
   try{
     const res=await fetch("/api/security/gate",{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({action:type,token,decision,referenceReviewed,notes,reason})
     })
     const data=await res.json()
     if(!res.ok)throw Error(data.error||"Action rejected")
     setNotice(type==="compare-face"?data.message||"Face comparison completed.":type==="review-photo"?"Photo review decision recorded.":type==="approve"?"Visitor checked in. Entry time recorded.":type==="checkout"?"Visitor checked out. Exit time recorded.":"Registration denied and recorded.")
     await lookup(token)
     await loadPending()
   }catch(e){setError(e instanceof Error?e.message:"Could not complete gate action")}
   finally{setBusy(false)}
 }
 const isGuardian=registration&&(registration.visitorType==="Parent"||registration.visitorType==="Guardian")&&
   (registration.purpose==="Child Emergency"||registration.purpose==="Visit Student")
 const invalidGuardian=isGuardian&&registration?.guardianDetailsStatus!=="MATCH"
 const eligible=registration?.status==="PRE_REGISTERED"&&
   registration.photoReviewStatus==="PASSED"&&!invalidGuardian&&(!isGuardian||registration.biometricStatus==="MATCH")&&Date.now()<new Date(registration.expiresAt).getTime()
 const filteredPending=pending.filter(item=>{
   const query=queueFilter.trim().toLowerCase()
   return !query||[item.full_name,item.reference_number,item.purpose,item.status]
     .some(v=>String(v||"").toLowerCase().includes(query))
 })
 return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#faf6f8] px-3 py-5 text-[#291722] sm:px-6">
   <div className="mx-auto max-w-6xl space-y-5">
     <header className="rounded-2xl bg-gradient-to-br from-[#ad2945] to-[#471320] p-5 text-white sm:p-8">
       <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
         <div><p className="text-xs font-bold uppercase tracking-widest text-rose-100">Bantay-Agapay · Gate Operations</p>
           <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">QR Scanner & Visitor Verification</h1>
           <p className="mt-1 text-sm text-rose-100">Verify the person, confirm authorization, and record school entry or exit.</p></div>
         <Link href="/security" className="rounded-full border border-white/50 px-4 py-2 text-center text-sm">← Security Dashboard</Link>
       </div>
     </header>
     {error&&<p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">{error}</p>}
     {notice&&<p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">{notice}</p>}
     <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
       <section className="min-w-0 space-y-5">
         <div className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
           <h2 className="text-xl font-bold">Scan Registration QR</h2>
           <p className="mt-1 text-sm text-gray-600">Position the visitor's saved QR inside the camera square or enter the token.</p>
           <form onSubmit={e=>{e.preventDefault();void lookup()}} className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row">
             <input className={field+" flex-1"} autoComplete="off" placeholder="Paste or type QR token" value={token}
               onChange={e=>setToken(e.target.value)} />
             <button disabled={busy} className={button+" bg-[#82172a] text-white"}>Look Up</button>
           </form>
           <button type="button" className={button+" mt-3 w-full border border-[#a63854] text-[#82172a] sm:w-auto"}
             onClick={()=>{setCameraOpen(v=>!v);setError("")}}>{cameraOpen?"Close Camera":"📷 Open QR Camera"}</button>
           {cameraOpen&&<div className="mx-auto mt-4 aspect-square w-full max-w-[420px] overflow-hidden rounded-2xl border-2 border-[#82172a] bg-[#1d0b15]">
             <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover"/>
             <canvas ref={canvasRef} className="hidden"/>
           </div>}
         </div>
         {registration&&<div className="min-w-0 space-y-5 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
           <div className="flex flex-wrap items-center justify-between gap-2">
             <h2 className="text-xl font-bold">Security Review · {registration.reference}</h2>
             <span className="rounded-full bg-[#f3e5e9] px-3 py-1.5 text-xs font-bold text-[#82172a]">{registration.status.replace(/_/g," ")}</span>
           </div>
           <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
             <div className="space-y-2">
               <p className="text-xs font-bold text-gray-500">Current Visitor Photo</p>
               {registration.photoUrl?<img src={registration.photoUrl} alt="Current visitor registration face" className="aspect-square w-full max-w-[280px] rounded-xl object-cover"/>:
                <p className="rounded-xl bg-amber-50 p-4 text-sm">Photo unavailable. Do not approve entry.</p>}
             </div>
             {isGuardian&&<div className="space-y-2">
               <p className="text-xs font-bold text-gray-500">School-Enrolled Guardian Reference</p>
               {registration.referencePhotoUrl?<img src={registration.referencePhotoUrl} alt="Enrolled guardian reference photo" className="aspect-square w-full max-w-[280px] rounded-xl object-cover"/>:
                <p className="rounded-xl bg-red-50 p-4 text-sm text-red-900">No enrolled reference available. Entry must be referred for review.</p>}
             </div>}
           </div>
           <dl className="grid min-w-0 grid-cols-1 gap-3 text-sm sm:grid-cols-2">
             {[
               ["Visitor",registration.fullName],["Visitor Type",registration.visitorType],
               ["Purpose",registration.purpose],["Destination",registration.destination],
               ["Contact",registration.contactNumber],
               ["Student",registration.studentName||"—"],
               ["Grade & Section",registration.studentGrade&&registration.studentSection?registration.studentGrade+" · "+registration.studentSection:"—"],
               ["Guardian Details",isGuardian?registration.guardianDetailsStatus:"Not applicable"],
               ["Photo Review",registration.photoReviewStatus],
               ["Biometric Identity Match",isGuardian?registration.biometricStatus:"Not required"]
             ].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs font-bold text-gray-500">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>)}
           </dl>
           {invalidGuardian&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-900">
             Guardian data or student authorization does not match the school's registry. Ordinary entry approval is blocked.
           </div>}
           {(registration.status==="PRE_REGISTERED"||registration.status==="NEEDS_REVIEW")&&<div className="space-y-3 border-t pt-4">
             <h3 className="font-bold">Face Photo & Identity Review</h3>
             <p className="text-sm text-gray-600">Compare the visitor in front of you with the captured photo. For guardians, also compare the protected enrolled reference. The biometric matching service must pass separately before ordinary admission.</p>
             {isGuardian&&<div className="space-y-3 rounded-xl border border-[#e8c9d3] bg-[#fff7f9] p-4">
               <strong className="text-sm text-[#82172a]">One-to-One Biometric Verification</strong>
               <p className="text-xs text-gray-700">This check compares the captured live photo with the school's enrolled reference using an approved service. If the service is unavailable, or the match or liveness check fails, entry remains blocked.</p>
               <button type="button" disabled={busy||Boolean(invalidGuardian)||!registration.photoUrl||!registration.referencePhotoUrl}
                 onClick={()=>void action("compare-face")} className={button+" w-full bg-[#82172a] text-white"}>
                 Run Approved Face Comparison
               </button>
               <p className={"text-xs font-bold "+(registration.biometricStatus==="MATCH"?"text-emerald-800":"text-amber-900")}>
                 Current match status: {registration.biometricStatus||"PENDING"}
               </p>
             </div>}
             {isGuardian&&<label className="flex items-start gap-3 rounded-xl bg-[#fff6f8] p-3 text-sm">
               <input className="mt-1 size-4 accent-[#82172a]" type="checkbox" checked={referenceReviewed}
                 onChange={e=>setReferenceReviewed(e.target.checked)}/>
               <span>I compared this visitor with the enrolled guardian reference and reviewed their student relationship.</span>
             </label>}
             <textarea className={field} rows={2} maxLength={500} value={notes}
               onChange={e=>setNotes(e.target.value)} placeholder="Optional review notes"/>
             <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
               <button disabled={busy||Boolean(invalidGuardian)||Boolean(isGuardian&&!referenceReviewed)||!registration.photoUrl||
                 Boolean(isGuardian&&!registration.referencePhotoUrl)}
                 onClick={()=>void action("review-photo","PASSED")} className={button+" bg-emerald-700 text-white"}>✓ Photo Checked</button>
               <button disabled={busy} onClick={()=>void action("review-photo","FAILED")} className={button+" border border-red-300 text-red-800"}>Refer Photo for Review</button>
             </div>
             <button disabled={busy||!eligible} onClick={()=>void action("approve")}
               className={button+" w-full bg-[#82172a] text-white"}>Approve Entry & Record Check-In</button>
             <div className="space-y-2">
               <label className="block text-xs font-semibold">Reason for Denial
                 <textarea className={field+" mt-1"} maxLength={500} value={reason} rows={2} onChange={e=>setReason(e.target.value)}/>
               </label>
               <button disabled={busy||reason.trim().length<3} onClick={()=>void action("deny")} className={button+" w-full border border-red-300 text-red-800"}>Reject Entry & Record Reason</button>
             </div>
           </div>}
           {registration.status==="ADMITTED"&&<div className="border-t pt-4">
             <p className="mb-3 text-sm text-emerald-900">Visitor was checked in. Scan the same QR again at exit to record timeout.</p>
             <button disabled={busy} onClick={()=>void action("checkout")} className={button+" w-full bg-[#82172a] text-white"}>Approve Exit · Record Checkout</button>
           </div>}
           {registration.status==="EXITED"&&<p className="rounded-xl bg-gray-100 p-4 text-sm">This visitor has already checked out. Duplicate scans will not create another entry.</p>}
         </div>}
       </section>
       <aside className="min-w-0 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-6">
         <div className="flex flex-wrap items-center justify-between gap-2">
           <h2 className="text-xl font-bold">Pending and Alerted</h2>
           <button onClick={()=>void loadPending()} className="text-sm font-semibold text-[#82172a]">Refresh</button>
         </div>
         <p className="mt-1 text-xs text-gray-500">Registrations submitted from home or flagged for review. They are not yet recorded as campus entries.</p>
         {queueSyncedAt&&<p className="mt-2 text-xs text-gray-500">Last updated {new Date(queueSyncedAt).toLocaleTimeString("en-PH",{timeZone:"Asia/Manila"})} PH</p>}
         {pendingError&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
           {pendingError} <button type="button" onClick={()=>void loadPending()} className="font-bold underline">Retry</button>
         </p>}
         <label className="mt-3 block text-xs font-semibold text-gray-600">Search pending visitors
           <input className={field+" mt-1"} value={queueFilter} onChange={e=>setQueueFilter(e.target.value)}
             placeholder="Name, reference or status"/>
         </label>
         <div className="mt-4 grid gap-2">
           {filteredPending.map(item=><button type="button" key={item.id}
             className="min-w-0 rounded-xl border p-4 text-left hover:border-[#82172a]"
             onClick={()=>{setNotice("Use the QR token from the visitor's saved pass to perform identity verification.");setRegistration(null)}}>
             <strong className="block break-words text-sm">{item.full_name}</strong>
             <span className="block text-xs text-gray-500">{item.reference_number} · {item.purpose}</span>
             <span className={"mt-1 block text-xs font-bold "+(item.status==="NEEDS_REVIEW"?"text-red-800":"text-amber-800")}>{item.status.replace(/_/g," ")}</span>
           </button>)}
           {!filteredPending.length&&<p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">
             {pendingError?"Current queue could not be confirmed. Retry the connection.":
               queueFilter?"No pending registrations match your search.":"No pending pre-registrations."}
           </p>}
         </div>
       </aside>
     </div>
     <p className="text-center text-xs text-gray-500">Never release a student solely because a guardian's visitor QR was approved. Follow the school's separate authorized-child-release procedure.</p>
   </div>
 </main>
}
