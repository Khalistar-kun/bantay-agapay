"use client"

import { useEffect,useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import QRCode from "qrcode"

type Pass={
  reference:string;name:string;type:string;purpose:string;status:string;submittedAt:string;
  expiresAt:string;destination:string;building:string;checkedIn:boolean;notice:string
}

export default function VisitorPassPage(){
  const params=useParams()
  const token=typeof params.token==="string"?params.token:""
  const [pass,setPass]=useState<Pass|null>(null)
  const [qr,setQr]=useState("")
  const [error,setError]=useState("")
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    if(!/^[a-f0-9]{32}$/i.test(token)){setError("This QR token is invalid.");setLoading(false);return}
    let alive=true
    QRCode.toDataURL(token,{width:320,margin:2,errorCorrectionLevel:"M"})
      .then(data=>{if(alive)setQr(data)}).catch(()=>{if(alive)setError("QR image could not be generated")})
    async function refresh(){
      try{
        const res=await fetch("/api/pre-register?token="+encodeURIComponent(token),{cache:"no-store"})
        const body=await res.json()
        if(!res.ok)throw Error(body.error||"Pass not found")
        if(alive){setPass(body.pass);setError("")}
      }catch(e){if(alive)setError(e instanceof Error?e.message:"Cannot load pass")}
      finally{if(alive)setLoading(false)}
    }
    void refresh()
    const interval=setInterval(()=>void refresh(),10000)
    return ()=>{alive=false;clearInterval(interval)}
  },[token])
  const expired=pass?Date.now()>new Date(pass.expiresAt).getTime():false
  const admitted=pass?.status==="ADMITTED"
  const pending=pass?.status==="PRE_REGISTERED"||pass?.status==="NEEDS_REVIEW"
  const closed=pass?.status==="DENIED"||pass?.status==="EXPIRED"||pass?.status==="EXITED"||expired
  return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf5f7] px-3 py-6 text-[#30202a] sm:px-6">
    <div className="mx-auto max-w-[740px] space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-[#b52e4c] via-[#82172a] to-[#471320] p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-widest text-[#f4d6db]">Bantay-Agapay · Visitor QR</p>
        <h1 className="mt-2 text-3xl font-extrabold">My School Visit Pass</h1>
        <p className="mt-2 text-sm text-[#fff1f1]">Save the QR to your phone before arriving. The gate guard must verify and scan it before entry.</p>
      </header>
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">{error}</p>}
      {loading?<div className="rounded-2xl bg-white p-8 text-center" role="status">Loading pass…</div>:pass&&<div className="min-w-0 rounded-2xl border border-rose-100 bg-white p-5 shadow-lg sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
          <div><p className="text-xs font-bold uppercase tracking-widest text-[#82172a]">Reference</p>
            <h2 className="text-2xl font-extrabold">{pass.reference}</h2></div>
          <p className={"rounded-full px-4 py-2 text-sm font-bold "+(admitted?"bg-emerald-100 text-emerald-900":closed?"bg-red-100 text-red-900":"bg-amber-100 text-amber-900")}>
            {expired&&!admitted?"EXPIRED":pass.status.replaceAll("_"," ")}
          </p>
        </div>
        <div className="my-5 border-y border-rose-100 py-5">
          {pending&&!expired&&qr?<div className="mx-auto flex w-full max-w-[320px] flex-col items-center gap-4">
            <img src={qr} alt={"Registration QR for "+pass.reference} width={320} height={320} className="aspect-square h-auto w-full max-w-[300px] object-contain"/>
            <a download={"Bantay-Agapay-"+pass.reference+".png"} href={qr}
              className="w-full rounded-xl bg-[#82172a] px-5 py-3.5 text-center font-semibold text-white">Save QR Image for Offline Use</a>
          </div>:admitted&&qr?<div className="mx-auto w-full max-w-[320px] space-y-3 text-center">
            <img src={qr} alt="QR code to scan again when leaving campus" className="mx-auto aspect-square h-auto w-full max-w-[300px]"/>
            <p className="text-sm text-gray-600">Keep this QR for exit checkout at the gate.</p>
          </div>:<div className="rounded-xl bg-gray-50 p-5 text-center text-sm font-medium">This pass cannot be used for new entry. Ask the school guard for assistance.</div>}
        </div>
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          {[
            ["Visitor",pass.name],["Purpose",pass.purpose],["Destination",pass.destination],
            ["Building",pass.building||"Ask the guard"],["Registered",new Date(pass.submittedAt).toLocaleString("en-PH")],
            ["QR expires",new Date(pass.expiresAt).toLocaleString("en-PH")]
          ].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs font-bold uppercase text-gray-500">{label}</dt><dd className="mt-1 break-words font-semibold">{value}</dd></div>)}
        </dl>
        {pending&&!expired&&<p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
          Your registration is saved, but you are <strong>not yet inside the school</strong>. Security must review your photo, validate the details, and scan your QR before approving entry.
        </p>}
        {admitted&&<Link href={"/visit/directions/"+encodeURIComponent(token)}
          className="mt-5 block w-full rounded-xl bg-[#82172a] px-5 py-3.5 text-center font-semibold text-white">
          View My Campus Walking Directions →
        </Link>}
      </div>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/pre-register" className="flex-1 rounded-xl border border-[#ddc8d0] bg-white px-5 py-3.5 text-center text-sm font-semibold">New Registration</Link>
        <Link href="/" className="flex-1 rounded-xl border border-[#ddc8d0] bg-white px-5 py-3.5 text-center text-sm font-semibold">Back to Home</Link>
      </div>
      <p className="text-center text-xs text-gray-500">The QR image can be displayed offline after you save it. Entry verification and live status require the school gate system's connection.</p>
    </div>
  </main>
}
