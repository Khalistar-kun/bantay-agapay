"use client"

import { useEffect,useMemo,useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FaceDetection } from "@/components/visitor/FaceDetection"
import { ageOn,requiresGuardianCheck,PURPOSES,VISITOR_TYPES } from "@/lib/client-compliance"

type Destination={id:string;name:string;building?:string|null;room?:string|null}
type FormData={
  fullName:string;contactNumber:string;visitorType:string;purpose:string;purposeOther:string;
  destinationId:string;birthDate:string;address:string;studentName:string;studentGrade:string;studentSection:string
}
const initial:FormData={
  fullName:"",contactNumber:"",visitorType:"Guest",purpose:"Teacher Appointment",purposeOther:"",
  destinationId:"",birthDate:"",address:"",studentName:"",studentGrade:"",studentSection:""
}
const input="w-full min-w-0 max-w-full rounded-xl border border-[#dccdd4] bg-white px-3 py-3 text-[16px] text-[#32202a] outline-none focus:border-[#82172a] focus:ring-2 focus:ring-[#d5a3b0]"
const button="inline-flex w-full items-center justify-center rounded-xl bg-[#82172a] px-5 py-3.5 font-semibold text-white disabled:opacity-40 sm:w-auto"
const steps=["Personal Information","Face Verification","QR & Gate Approval","Campus Directions"]

export default function PreRegisterPage(){
  const router=useRouter()
  const [form,setForm]=useState<FormData>(initial)
  const [step,setStep]=useState(0)
  const [returning,setReturning]=useState(false)
  const [destinations,setDestinations]=useState<Destination[]>([])
  const [filter,setFilter]=useState("")
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState("")
  const [consent,setConsent]=useState(false)
  const [faceKey,setFaceKey]=useState(0)
  const [token,setToken]=useState("")
  const childVisit=requiresGuardianCheck(form.visitorType,form.purpose)
  const age=useMemo(()=>ageOn(form.birthDate),[form.birthDate])
  const choices=destinations.filter(d=>((d.name+" "+(d.building||"")).toLowerCase()).includes(filter.toLowerCase()))
  useEffect(()=>{
    setReturning(new URLSearchParams(window.location.search).get("returning")==="1")
    fetch("/api/client-demo?action=destinations",{cache:"no-store"})
      .then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error||"Could not load campus destinations");return j})
      .then(j=>setDestinations(j.destinations||[]))
      .catch(e=>setError(e instanceof Error?e.message:"Could not load campus destinations"))
  },[])
  function update<K extends keyof FormData>(key:K,value:FormData[K]){setForm(f=>({...f,[key]:value}));setError("")}
  function next(e:React.FormEvent){
    e.preventDefault()
    if(!form.fullName.trim()||form.fullName.trim().length<3||!/^09\d{9}$/.test(form.contactNumber)){
      setError("Enter your full name and a valid 11-digit Philippine contact number.");return
    }
    if(!form.destinationId||!form.purpose||form.purpose==="Other"&&form.purposeOther.trim().length<3){
      setError("Choose your purpose and destination.");return
    }
    if(childVisit && (!form.birthDate||age===null||!form.address.trim()||
      !form.studentName.trim()||!form.studentGrade.trim()||!form.studentSection.trim())){
      setError("For a child-related visit, complete your birthday, address, student name, grade, and section.");return
    }
    if(!consent){setError("Read and accept the privacy acknowledgement.");return}
    setStep(1)
    setError("")
  }
  async function submit(photo:string){
    if(loading)return
    setLoading(true);setError("")
    try{
      const result=await fetch("/api/pre-register",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({...form,facePhoto:photo,privacyConsent:consent})
      })
      const data=await result.json()
      if(!result.ok)throw Error(data.error||"Could not save your pre-registration")
      setToken(data.token)
      setStep(2)
      router.push("/pass/"+encodeURIComponent(data.token))
    }catch(e){
      setError(e instanceof Error?e.message:"Could not submit")
      setFaceKey(i=>i+1)
    }finally{setLoading(false)}
  }
  return <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#faf5f7] px-3 py-5 text-[#281822] sm:px-6 sm:py-9">
    <div className="mx-auto w-full max-w-[940px] space-y-5">
      <header className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#b52e4c] via-[#82172a] to-[#471320] p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[.15em] text-[#f5d4dd]">Bantay-Agapay · Visitor Access</p>
            <h1 className="mt-2 text-[1.6rem] font-extrabold leading-tight sm:text-3xl">{returning?"Returning Visitor":"School Visitor Pre-Registration"}</h1></div>
          <Link href="/" className="rounded-full border border-white/50 px-4 py-2 text-xs font-semibold text-white">← Home</Link>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#fff0f2]">
          Complete your details from anywhere. Save your QR pass and show it at the school gate.
          Security checks your identity and records entry only after approval.
        </p>
      </header>
      <nav aria-label="Registration progress" className="grid grid-cols-4 gap-1.5 sm:gap-3">
        {steps.map((name,i)=><div key={name} className={"min-w-0 rounded-xl px-1.5 py-2.5 text-center text-[10px] font-semibold leading-tight sm:p-3 sm:text-xs "+
          (i===step?"bg-[#82172a] text-white":i<step?"bg-[#eddde3] text-[#6c2236]":"bg-white text-gray-500")}>
          <span className="mb-1 block text-sm sm:text-lg">{i+1}</span>{name}
        </div>)}
      </nav>
      {error&&<div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">{error}</div>}
      <section className="min-w-0 rounded-2xl border border-[#eee1e6] bg-white p-4 shadow-sm sm:p-7">
        {step===0&&<form onSubmit={next} className="space-y-5">
          <div><h2 className="text-xl font-bold">Step 1 · Your Personal Information</h2>
            <p className="mt-1 text-sm text-gray-600">Required fields help school security process your visit without unnecessary delays.</p></div>
          {returning&&<p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">For your privacy, returning visitors must re-enter their information until identity-based account retrieval is enabled. A phone number alone cannot unlock someone's saved details.</p>}
          <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-semibold">Full Legal Name *
              <input required autoComplete="name" maxLength={200} className={input+" mt-1"} value={form.fullName} onChange={e=>update("fullName",e.target.value)} placeholder="First Middle Last" />
            </label>
            <label className="min-w-0 text-sm font-semibold">Contact Number *
              <input required inputMode="tel" autoComplete="tel" pattern="09[0-9]{9}" maxLength={11} className={input+" mt-1"} value={form.contactNumber} onChange={e=>update("contactNumber",e.target.value)} placeholder="09XXXXXXXXX"/>
            </label>
            <label className="min-w-0 text-sm font-semibold">Visitor Type *
              <select className={input+" mt-1"} value={form.visitorType} onChange={e=>update("visitorType",e.target.value)}>{VISITOR_TYPES.map(v=><option key={v}>{v}</option>)}</select>
            </label>
            <label className="min-w-0 text-sm font-semibold">Purpose of Visit *
              <select className={input+" mt-1"} value={form.purpose} onChange={e=>update("purpose",e.target.value)}>{PURPOSES.map(v=><option key={v}>{v}</option>)}</select>
            </label>
            {form.purpose==="Other"&&<label className="sm:col-span-2 min-w-0 text-sm font-semibold">Please Specify *
              <textarea maxLength={180} rows={2} className={input+" mt-1"} value={form.purposeOther} onChange={e=>update("purposeOther",e.target.value)} />
            </label>}
          </div>
          {childVisit&&<fieldset className="min-w-0 space-y-3 rounded-xl border border-[#ddc3ca] bg-[#fff8f9] p-4">
            <legend className="px-2 text-sm font-bold text-[#82172a]">Guardian and Student Verification</legend>
            <p className="text-xs text-[#714358]">Information is checked against records enrolled by the school. A mismatch prevents ordinary gate approval.</p>
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Birthday *<input type="date" required className={input+" mt-1"} value={form.birthDate} max={new Date().toISOString().slice(0,10)} onChange={e=>update("birthDate",e.target.value)}/></label>
              <label className="text-sm font-semibold">Age (calculated)<input readOnly className={input+" mt-1 bg-gray-50"} value={age??""} aria-label="Calculated age" /></label>
              <label className="text-sm font-semibold sm:col-span-2">Address *<textarea rows={2} maxLength={500} required className={input+" mt-1"} value={form.address} onChange={e=>update("address",e.target.value)}/></label>
              <label className="text-sm font-semibold sm:col-span-2">Student Full Name *<input required className={input+" mt-1"} maxLength={200} value={form.studentName} onChange={e=>update("studentName",e.target.value)}/></label>
              <label className="text-sm font-semibold">Student Grade *<input required className={input+" mt-1"} maxLength={32} value={form.studentGrade} onChange={e=>update("studentGrade",e.target.value)}/></label>
              <label className="text-sm font-semibold">Student Section *<input required className={input+" mt-1"} maxLength={100} value={form.studentSection} onChange={e=>update("studentSection",e.target.value)}/></label>
            </div>
          </fieldset>}
          <div className="min-w-0 space-y-2">
            <label className="block text-sm font-semibold" htmlFor="destination-search">Destination *</label>
            <input id="destination-search" className={input} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search faculty, teacher's office or building"/>
            <select required className={input} value={form.destinationId} onChange={e=>update("destinationId",e.target.value)}>
              <option value="">Select campus destination</option>
              {choices.map(d=><option key={d.id} value={d.id}>{d.name}{d.building?" — "+d.building:""}</option>)}
            </select>
            <p className="text-xs text-gray-500">Unsure where your teacher is? Search the faculty or office. Security can assist when you arrive.</p>
          </div>
          <label className="flex items-start gap-3 rounded-xl bg-[#f7eff2] p-4 text-sm">
            <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[#82172a]" checked={consent} onChange={e=>setConsent(e.target.checked)} required/>
            <span>I acknowledge that the school will securely process my registration details and photograph for campus access control, identity review and visit records. Entry is subject to security approval.</span>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button className={button} type="submit">Continue to Face Verification →</button>
          </div>
        </form>}
        {step===1&&<div className="space-y-4">
          <h2 className="text-xl font-bold">Step 2 · Face Verification</h2>
          <p className="text-sm text-gray-600">Keep one face inside the square guide. The scanner will automatically capture your photo after its three-second countdown. School security still verifies identity before entry.</p>
          {loading?<div className="rounded-xl bg-[#f7eff2] p-8 text-center font-semibold text-[#82172a]" role="status">Securely storing your registration and QR pass…</div>:
            <FaceDetection key={faceKey} onSuccess={photo=>void submit(photo)} onError={setError}/>}
          <button type="button" onClick={()=>{setError("");setStep(0)}} className="w-full rounded-xl border px-4 py-3 text-sm font-semibold sm:w-auto">← Edit Information</button>
        </div>}
        {step>=2&&<div className="space-y-3 text-center">
          <h2 className="text-xl font-bold">Step 3 · QR Pass</h2>
          <p className="text-gray-600">Pre-registered — not yet checked in. Present your QR at the gate.</p>
          {token&&<Link href={"/pass/"+encodeURIComponent(token)} className={button}>Open My QR Pass</Link>}
        </div>}
      </section>
      <p className="px-2 text-center text-xs leading-relaxed text-gray-500">Important: A QR code is not permission to collect or release a child. School-authorized release procedures remain mandatory.</p>
    </div>
  </main>
}
