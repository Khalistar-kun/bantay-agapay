"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import QRCode from "qrcode"
import {LocationSharing} from "@/components/visitor/LocationSharing"

type Pass={
  reference:string;name:string;type:string;purpose:string;status:string;submittedAt:string;
  expiresAt:string;destination:string;building:string;checkedIn:boolean;notice:string
}
const asPH=(value:string)=>new Date(value).toLocaleString("en-PH",{
  timeZone:"Asia/Manila",dateStyle:"medium",timeStyle:"short"
})
const progress=[
  {label:"Registered",detail:"Registration received"},
  {label:"Gate review",detail:"Photo and identity review"},
  {label:"Inside campus",detail:"Approved entry recorded"},
  {label:"Checked out",detail:"Exit recorded"},
]

export default function VisitorPassPage(){
  const params=useParams()
  const token=typeof params.token==="string"?params.token:""
  const validToken=/^[a-f0-9]{32}$/i.test(token)
  const [pass,setPass]=useState<Pass|null>(null)
  const [qr,setQr]=useState("")
  const [error,setError]=useState("")
  const [loading,setLoading]=useState(true)
  const [checking,setChecking]=useState(false)
  const [lastChecked,setLastChecked]=useState<string|null>(null)
  const [offline,setOffline]=useState(false)
  const busyRef=useRef(false)

  const refresh=useCallback(async()=>{
    if(!validToken||busyRef.current)return
    busyRef.current=true;setChecking(true)
    try{
      const response=await fetch("/api/pre-register?token="+encodeURIComponent(token),{cache:"no-store"})
      const body=await response.json()
      if(!response.ok||!body.pass)throw Error(body.error||"Unable to read the current pass status")
      setPass(body.pass as Pass)
      setLastChecked(new Date().toISOString())
      setError("")
    }catch(e){
      setError(e instanceof Error?e.message:"Pass status unavailable. Save the QR and ask school security.")
    }finally{
      setLoading(false);setChecking(false);busyRef.current=false
    }
  },[token,validToken])

  useEffect(()=>{
    if(!validToken){setError("This QR token is invalid.");setLoading(false);return}
    let mounted=true
    QRCode.toDataURL(token,{width:320,margin:2,errorCorrectionLevel:"M"})
      .then(data=>{if(mounted)setQr(data)})
      .catch(()=>{if(mounted)setError("The QR image could not be generated. Ask school security for assistance.")})
    setOffline(!navigator.onLine)
    const wentOffline=()=>setOffline(true)
    const wentOnline=()=>{setOffline(false);void refresh()}
    window.addEventListener("offline",wentOffline)
    window.addEventListener("online",wentOnline)
    void refresh()
    const interval=window.setInterval(()=>{
      if(!document.hidden&&navigator.onLine)void refresh()
    },10000)
    return()=>{
      mounted=false;window.clearInterval(interval)
      window.removeEventListener("offline",wentOffline)
      window.removeEventListener("online",wentOnline)
    }
  },[token,validToken,refresh])

  const admitted=pass?.status==="ADMITTED"
  const needsReview=pass?.status==="NEEDS_REVIEW"
  const exited=pass?.status==="EXITED"
  const expired=Boolean(pass&&(pass.status==="PRE_REGISTERED"||needsReview)&&Date.now()>new Date(pass.expiresAt).getTime())
  const pending=pass?.status==="PRE_REGISTERED"||needsReview
  const closed=pass?.status==="DENIED"||pass?.status==="EXPIRED"||exited||expired
  const canPresent=Boolean(qr&&pass&&!closed)
  const step=exited?3:admitted?2:pass?1:0
  const stateText=expired?"EXPIRED":needsReview?"NEEDS SCHOOL REVIEW":
    admitted?"CHECKED IN":exited?"CHECKED OUT":
    pass?.status==="PRE_REGISTERED"?"PENDING GATE APPROVAL":
    pass?.status==="DENIED"?"ENTRY DENIED":pass?.status.replace(/_/g," ")||"UNAVAILABLE"

  return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf5f7] px-3 py-6 text-[#30202a] sm:px-6">
    <div className="mx-auto max-w-[740px] space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-[#b52e4c] via-[#82172a] to-[#471320] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#f4d6db]">Bantay-Agapay · Visitor QR</p>
        <h1 className="mt-2 text-3xl font-extrabold">My School Visit Pass</h1>
        <p className="mt-2 text-sm text-[#fff1f1]">Save your QR before visiting. School security must verify your identity and scan the pass before entry.</p>
      </header>

      <section className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-sm font-bold">Live gate status</h2>
            <p className="mt-1 text-xs text-gray-600">Updates every 10 seconds while this page is open and online.</p>
          </div>
          <button type="button" disabled={!validToken||checking||offline} onClick={()=>void refresh()}
            className="rounded-full border border-[#82172a] px-4 py-2 text-xs font-bold text-[#82172a] disabled:opacity-50">
            {checking?"Checking…":"Refresh status"}
          </button>
        </div>
        {lastChecked&&<p className="mt-2 text-xs text-gray-500">
          Last confirmed: {asPH(lastChecked)} · Philippine time
        </p>}
        {offline&&<p role="alert" className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          You are offline. A previously saved QR can still be shown to the guard, but its live status cannot be verified here.
        </p>}
        {error&&<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          {error} {pass&&"The last confirmed pass is shown below; its status may be outdated."}
        </p>}
      </section>

      {loading&&!pass?<div className="rounded-2xl bg-white p-8 text-center" role="status">Loading pass…</div>:pass&&<>
        <section aria-label="Visit progress" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {progress.map((item,i)=><div key={item.label} className={
            "rounded-xl border p-3 "+(i<=step?"border-[#d3a0af] bg-[#fff3f6]":"border-gray-200 bg-white")
          }>
            <span className="text-xs font-bold text-[#82172a]">{i+1}. {item.label}</span>
            <p className="mt-1 text-[11px] text-gray-600">{item.detail}</p>
          </div>)}
        </section>

        <div className="min-w-0 rounded-2xl border border-rose-100 bg-white p-5 shadow-lg sm:p-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-bold uppercase tracking-widest text-[#82172a]">Reference</p>
              <h2 className="break-all text-2xl font-extrabold">{pass.reference}</h2></div>
            <p role="status" aria-live="polite" className={"rounded-full px-4 py-2 text-sm font-bold "+
              (admitted?"bg-emerald-100 text-emerald-900":closed?"bg-red-100 text-red-900":"bg-amber-100 text-amber-900")}>
              {stateText}
            </p>
          </div>

          <div className="my-5 border-y border-rose-100 py-5">
            {canPresent?<div className="mx-auto flex w-full max-w-[320px] flex-col items-center gap-4">
              <img src={qr} alt={"School visit QR for "+pass.reference}
                width={320} height={320} className="aspect-square h-auto w-full max-w-[300px] object-contain"/>
              <a download={"Bantay-Agapay-"+pass.reference+".png"} href={qr}
                className="w-full rounded-xl bg-[#82172a] px-5 py-3.5 text-center font-semibold text-white">
                Save QR Image for Offline Use
              </a>
              {admitted&&<p className="text-center text-sm text-gray-700">Present this same QR to security again to record your exit.</p>}
            </div>:<div className="rounded-xl bg-gray-50 p-5 text-center text-sm font-medium">
              {closed?"This pass is no longer valid for a new entry. Contact school security if you need another visit.":
                "QR not available. Refresh the status or ask the gate guard for assistance."}
            </div>}
          </div>

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            {[
              ["Visitor",pass.name],["Purpose",pass.purpose],["Destination",pass.destination],
              ["Building",pass.building||"Ask the guard"],["Registered",asPH(pass.submittedAt)],
              ["Original QR expiry",asPH(pass.expiresAt)]
            ].map(([label,value])=><div key={label} className="min-w-0">
              <dt className="text-xs font-bold uppercase text-gray-500">{label}</dt>
              <dd className="mt-1 break-words font-semibold">{value}</dd>
            </div>)}
          </dl>
          {pending&&!expired&&<p className={
            "mt-5 rounded-xl p-4 text-sm "+(needsReview?"bg-red-50 text-red-900":"bg-amber-50 text-amber-950")
          }>
            {needsReview?
              "The school needs to review this registration. It is not permission to enter or collect a student. Ask security for assistance.":
              <>Your registration is saved, but you are <strong>not yet inside the school</strong>.
                Security must review your photo, validate the details, and scan your QR before approving entry.</>}
          </p>}
          {admitted&&<LocationSharing token={token}/>}
          {admitted&&<Link href={"/visit/directions/"+encodeURIComponent(token)}
            className="mt-5 block w-full rounded-xl bg-[#82172a] px-5 py-3.5 text-center font-semibold text-white">
            View My Campus Walking Directions →
          </Link>}
          {exited&&<p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">
            Your departure was recorded. Thank you for checking out with school security.
          </p>}
        </div>
      </>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/pre-register" className="flex-1 rounded-xl border border-[#ddc8d0] bg-white px-5 py-3.5 text-center text-sm font-semibold">
          New Registration
        </Link>
        <Link href="/" className="flex-1 rounded-xl border border-[#ddc8d0] bg-white px-5 py-3.5 text-center text-sm font-semibold">
          Back to Home
        </Link>
      </div>
      <p className="text-center text-xs text-gray-500">
        A QR pass never authorizes a child's release. A saved QR can be displayed offline, but entry verification requires the school's live gate system.
      </p>
    </div>
  </main>
}
