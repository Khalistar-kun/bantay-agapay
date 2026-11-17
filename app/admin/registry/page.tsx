"use client"

import { useEffect,useState } from "react"
import Link from "next/link"
import { ageOn } from "@/lib/client-compliance"

type Student={id:string;full_name:string;student_number:string|null;grade:string;section:string;active:boolean}
type Relationship={id:string;guardian_id:string;student_id:string;relationship:string;active:boolean;students:{full_name:string;grade:string;section:string}|null}
type Guardian={id:string;full_name:string;birth_date:string;address:string;contact_number:string;
  active:boolean;verified_at:string|null;referencePhotoUrl:string|null}
type Enrollment={fullName:string;birthDate:string;address:string;contactNumber:string;studentId:string;relationship:string}
const empty:Enrollment={fullName:"",birthDate:"",address:"",contactNumber:"",studentId:"",relationship:"PARENT"}
const field="w-full min-w-0 max-w-full rounded-xl border border-rose-200 bg-white px-3 py-3 text-[16px] outline-none focus:ring-2 focus:ring-rose-300"
const primary="w-full sm:w-auto rounded-xl bg-[#82172a] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50"

async function makeJpeg(file:File):Promise<string>{
  if(!file.type.startsWith("image/")||file.size>8_000_000)throw Error("Choose an image under 8 MB.")
  const url=URL.createObjectURL(file)
  try{
    const image=new Image();image.src=url;await image.decode()
    const canvas=document.createElement("canvas")
    const ratio=Math.min(1,640/Math.max(image.naturalWidth,image.naturalHeight))
    canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio)
    const ctx=canvas.getContext("2d");if(!ctx)throw Error("Cannot prepare this photo")
    ctx.drawImage(image,0,0,canvas.width,canvas.height)
    const encoded=canvas.toDataURL("image/jpeg",.75)
    if(encoded.length>700_000)throw Error("Image remains too large. Choose a smaller photo.")
    return encoded
  }finally{URL.revokeObjectURL(url)}
}

export default function AdminGuardianRegistry(){
  const [students,setStudents]=useState<Student[]>([])
  const [guardians,setGuardians]=useState<Guardian[]>([])
  const [relationships,setRelationships]=useState<Relationship[]>([])
  const [linkForm,setLinkForm]=useState({guardianId:"",studentId:"",relationship:"PARENT"})
  const [linkVerified,setLinkVerified]=useState(false)
  const [revocation,setRevocation]=useState<{id:string;kind:"guardian"|"student"|"relationship";name:string}|null>(null)
  const [revokeReason,setRevokeReason]=useState("")
  const [studentForm,setStudentForm]=useState({fullName:"",studentNumber:"",grade:"",section:""})
  const [guardianForm,setGuardianForm]=useState<Enrollment>(empty)
  const [photo,setPhoto]=useState<string>("")
  const [verified,setVerified]=useState(false)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  const [notice,setNotice]=useState("")
  const [tab,setTab]=useState<"students"|"guardians">("students")
  async function fetchAll(){
    const [a,b,c]=await Promise.all([
      fetch("/api/admin/registry",{cache:"no-store"}),
      fetch("/api/admin/registry?mode=guardians",{cache:"no-store"}),
      fetch("/api/admin/registry?mode=relationships",{cache:"no-store"})
    ])
    const [studentsData,guardiansData,relationshipData]=await Promise.all([a.json(),b.json(),c.json()])
    if(!a.ok||!b.ok||!c.ok)throw Error(studentsData.error||guardiansData.error||relationshipData.error||"Cannot load registry")
    setStudents(studentsData.students||[]);setGuardians(guardiansData.guardians||[])
    setRelationships(relationshipData.relationships||[])
  }
  useEffect(()=>{fetchAll().catch(e=>setError(e.message))},[])
  async function save(input:Record<string,unknown>){
    const res=await fetch("/api/admin/registry",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input)
    })
    const data=await res.json()
    if(!res.ok)throw Error(data.error||"Unable to save enrollment")
    await fetchAll()
  }
  async function createStudent(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError("");setNotice("")
    try{
      await save({action:"student",...studentForm})
      setStudentForm({fullName:"",studentNumber:"",grade:"",section:""})
      setNotice("Student record enrolled. Add their verified guardian next.")
    }catch(e){setError(e instanceof Error?e.message:"Save failed")}
    finally{setBusy(false)}
  }
  async function createGuardian(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError("");setNotice("")
    try{
      if(!verified||!photo)throw Error("Verify the guardian's identity and attach an approved reference photo.")
      await save({action:"guardian",...guardianForm,referencePhoto:photo,identityChecked:verified})
      setGuardianForm(empty);setPhoto("");setVerified(false)
      setNotice("Verified guardian enrolled and linked to the student.")
    }catch(e){setError(e instanceof Error?e.message:"Enrollment failed")}
    finally{setBusy(false)}
  }
  async function revokeAuthorization(){
    if(!revocation||revokeReason.trim().length<3)return
    setBusy(true);setError("");setNotice("")
    try{
      const response=await fetch("/api/admin/registry",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"revoke",id:revocation.id,kind:revocation.kind,reason:revokeReason.trim()})
      })
      const data=await response.json()
      if(!response.ok)throw Error(data.error||"Could not revoke authorization")
      setNotice("Authorization revoked and recorded in the school audit trail. Related future entries are blocked.")
      setRevocation(null);setRevokeReason("")
      await fetchAll()
    }catch(e){setError(e instanceof Error?e.message:"Revoke failed")}
    finally{setBusy(false)}
  }
  async function linkExisting(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError("");setNotice("")
    try{
      if(!linkVerified)throw Error("Verify the guardian's relationship to this student before saving.")
      const response=await fetch("/api/admin/registry",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"link",...linkForm,identityChecked:true})
      })
      const data=await response.json()
      if(!response.ok)throw Error(data.error||"Guardian relationship cannot be saved")
      setNotice("Existing verified guardian linked to a student; authorization audited.")
      setLinkForm({guardianId:"",studentId:"",relationship:"PARENT"});setLinkVerified(false)
      await fetchAll()
    }catch(e){setError(e instanceof Error?e.message:"Link failed")}
    finally{setBusy(false)}
  }
  const updateStudent=(field:keyof typeof studentForm,value:string)=>setStudentForm(f=>({...f,[field]:value}))
  const updateGuardian=(field:keyof Enrollment,value:string)=>setGuardianForm(f=>({...f,[field]:value}))
  return <main className="min-h-screen min-w-0 overflow-x-clip bg-[#faf6f8] px-3 py-5 text-[#291923] sm:px-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="rounded-2xl bg-gradient-to-br from-[#b12b47] to-[#471320] p-5 text-white sm:p-8">
        <p className="text-xs uppercase tracking-widest text-rose-100">Bantay-Agapay · Administrator</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">Student & Guardian Registry</h1>
            <p className="mt-1 max-w-xl text-sm text-rose-100">Only school-authorized staff may enroll students and verify parent or guardian identity before emergency visits.</p></div>
          <Link href="/admin" className="rounded-full border border-white/40 px-4 py-2 text-center text-sm">← Admin Dashboard</Link>
        </div>
      </header>
      {error&&<div role="alert" className="rounded-xl bg-red-50 p-4 text-red-900">{error}</div>}
      {notice&&<div role="status" className="rounded-xl bg-emerald-50 p-4 text-emerald-900">{notice}</div>}
      {revocation&&<section className="space-y-3 rounded-2xl border-2 border-red-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-red-900">Revoke School Authorization</h2>
        <p className="break-words text-sm">Revoke {revocation.kind} access for <strong>{revocation.name}</strong>?
          This does not delete existing visit records. It blocks future guardian approvals that rely on this authorization.</p>
        <label className="block text-sm font-semibold">Reason for revocation
          <textarea rows={2} maxLength={500} required className={field+" mt-1"}
            value={revokeReason} onChange={e=>setRevokeReason(e.target.value)}
            placeholder="Record the school-approved reason for this access change"/>
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button disabled={busy||revokeReason.trim().length<3} type="button" onClick={()=>void revokeAuthorization()}
            className="rounded-xl bg-red-800 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Confirm Revocation</button>
          <button type="button" className="rounded-xl border px-5 py-3 text-sm font-semibold"
            onClick={()=>{setRevocation(null);setRevokeReason("")}}>Cancel</button>
        </div>
      </section>}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={()=>setTab("students")} className={"rounded-xl px-4 py-3 text-sm font-bold "+(tab==="students"?"bg-[#82172a] text-white":"bg-white text-[#82172a]")}>Students ({students.length})</button>
        <button onClick={()=>setTab("guardians")} className={"rounded-xl px-4 py-3 text-sm font-bold "+(tab==="guardians"?"bg-[#82172a] text-white":"bg-white text-[#82172a]")}>Guardians ({guardians.length})</button>
      </div>
      {tab==="students"?<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form onSubmit={createStudent} className="min-w-0 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Enroll Student</h2>
          {([["fullName","Student Full Name"],["studentNumber","School Student ID (optional)"],["grade","Grade"],["section","Section"]] as const).map(([key,label])=>
            <label key={key} className="block text-sm font-semibold">{label}
              <input className={field+" mt-1"} required={key!=="studentNumber"} maxLength={key==="fullName"?200:key==="section"?100:64}
                value={studentForm[key]} onChange={e=>updateStudent(key,e.target.value)}/>
            </label>
          )}
          <button className={primary} disabled={busy}>Save Student Record</button>
        </form>
        <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Enrolled Students</h2>
          <div className="mt-4 grid gap-2">
            {students.map(s=><div key={s.id} className="min-w-0 rounded-xl border p-4">
              <strong className="break-words">{s.full_name}</strong>
              <p className="mt-1 text-xs text-gray-600">{s.grade} · {s.section} {s.student_number?"· "+s.student_number:""}</p>
              <p className={"mt-2 text-xs font-bold "+(s.active?"text-emerald-800":"text-red-800")}>
                {s.active?"Active Student":"Authorization Inactive"}</p>
              {s.active&&<button type="button" disabled={busy} onClick={()=>setRevocation({id:s.id,kind:"student",name:s.full_name})}
                className="mt-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">
                Deactivate Student
              </button>}
            </div>)}
            {!students.length&&<p className="text-sm text-gray-500">No student records available.</p>}
          </div>
        </section>
      </div>:<div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <form onSubmit={createGuardian} className="min-w-0 space-y-4 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Enroll Authorized Guardian</h2>
          <p className="text-xs text-gray-600">A responsible school administrator must check official identity evidence and the student's relationship before enrollment.</p>
          <label className="block text-sm font-semibold">Guardian Legal Name<input required className={field+" mt-1"} value={guardianForm.fullName} maxLength={200} onChange={e=>updateGuardian("fullName",e.target.value)}/></label>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Birthday<input type="date" required className={field+" mt-1"} value={guardianForm.birthDate} onChange={e=>updateGuardian("birthDate",e.target.value)}/></label>
            <label className="text-sm font-semibold">Age (calculated)<input readOnly className={field+" mt-1 bg-gray-50"} value={ageOn(guardianForm.birthDate)??""}/></label>
          </div>
          <label className="block text-sm font-semibold">Contact Number<input required pattern="09[0-9]{9}" maxLength={11} className={field+" mt-1"} placeholder="09XXXXXXXXX" value={guardianForm.contactNumber} onChange={e=>updateGuardian("contactNumber",e.target.value)}/></label>
          <label className="block text-sm font-semibold">Registered Address<textarea rows={2} required className={field+" mt-1"} value={guardianForm.address} maxLength={500} onChange={e=>updateGuardian("address",e.target.value)}/></label>
          <label className="block text-sm font-semibold">Student
            <select required className={field+" mt-1"} value={guardianForm.studentId} onChange={e=>updateGuardian("studentId",e.target.value)}>
              <option value="">Select student</option>
              {students.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.grade}-{s.section}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold">Relationship
            <select className={field+" mt-1"} value={guardianForm.relationship} onChange={e=>updateGuardian("relationship",e.target.value)}>
              <option value="PARENT">Parent</option><option value="LEGAL_GUARDIAN">Legal Guardian</option>
              <option value="OTHER_AUTHORIZED">Other School-Authorized Contact</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">Reference Face Photo (verified ID or recent 2×2)
            <input type="file" accept="image/jpeg,image/png,image/webp" className={field+" mt-1"} required={!photo}
              onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{setPhoto(await makeJpeg(file));setError("")}catch(err){setError(err instanceof Error?err.message:"Invalid image")}}}/>
          </label>
          {photo&&<img alt="Enrolled reference photo preview" src={photo} className="aspect-square h-32 w-32 rounded-xl border object-cover"/>}
          <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-sm">
            <input type="checkbox" required checked={verified} onChange={e=>setVerified(e.target.checked)} className="mt-1 size-4 accent-[#82172a]"/>
            <span>I am an authorized administrator, have verified this guardian's identity and relationship to the student, and am authorized to store this reference image under the school's privacy policy.</span>
          </label>
          <button disabled={busy||!students.length} className={primary}>{busy?"Saving…":"Save Verified Guardian"}</button>
        </form>
        <section className="min-w-0 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Authorized Guardians</h2>
          <p className="text-xs text-gray-600">Reference photos are accessed using short-lived URLs for signed-in staff only.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {guardians.map(g=><div key={g.id} className="min-w-0 rounded-xl border p-3">
              {g.referencePhotoUrl?<img alt={"Reference photo for "+g.full_name} src={g.referencePhotoUrl} className="mb-3 aspect-square w-full max-w-36 rounded-xl object-cover"/>:null}
              <strong className="break-words">{g.full_name}</strong>
              <p className="text-xs text-gray-600">Born: {g.birth_date}</p>
              <p className={"mt-2 text-xs font-bold "+(g.active&&g.verified_at?"text-emerald-800":"text-amber-800")}>{g.active&&g.verified_at?"Verified enrollment":"Authorization Inactive"}</p>
              <div className="mt-3 space-y-2">
                {relationships.filter(link=>link.guardian_id===g.id).map(link=>
                  <div key={link.id} className="min-w-0 rounded-lg bg-[#faf4f7] p-2.5 text-xs">
                    <strong className="block break-words">{link.students?.full_name||"Student"}</strong>
                    <span>{link.relationship.replace(/_/g," ")} · {link.active?"Authorized":"Revoked"}</span>
                    {link.active&&<button type="button" disabled={busy}
                      onClick={()=>setRevocation({id:link.id,kind:"relationship",name:g.full_name+" ↔ "+(link.students?.full_name||"student")})}
                      className="mt-2 block rounded-lg border border-red-200 px-2.5 py-1.5 font-semibold text-red-800">
                      Revoke Relationship
                    </button>}
                  </div>)}
              </div>
              {g.active&&<button type="button" disabled={busy}
                onClick={()=>setRevocation({id:g.id,kind:"guardian",name:g.full_name})}
                className="mt-3 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-800">
                Revoke Guardian Access
              </button>}
            </div>)}
            {!guardians.length&&<p className="text-sm text-gray-500">No guardian records available.</p>}
          </div>
        </section>
        <form onSubmit={linkExisting} className="min-w-0 space-y-4 rounded-2xl border border-[#edd8df] bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-bold">Authorize an Existing Guardian for Another Student</h2>
          <p className="text-xs text-gray-600">Only a school administrator may add a relationship. Reverify the legal relationship first; the update is recorded in the audit trail.</p>
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-sm font-semibold">Active Verified Guardian
              <select required className={field+" mt-1"} value={linkForm.guardianId}
                onChange={e=>setLinkForm(f=>({...f,guardianId:e.target.value}))}>
                <option value="">Choose guardian</option>
                {guardians.filter(g=>g.active&&g.verified_at).map(g=><option key={g.id} value={g.id}>{g.full_name}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Student
              <select required className={field+" mt-1"} value={linkForm.studentId}
                onChange={e=>setLinkForm(f=>({...f,studentId:e.target.value}))}>
                <option value="">Choose student</option>
                {students.filter(s=>s.active).map(s=><option key={s.id} value={s.id}>{s.full_name} · {s.grade}–{s.section}</option>)}
              </select>
            </label>
            <label className="text-sm font-semibold">Relationship
              <select className={field+" mt-1"} value={linkForm.relationship}
                onChange={e=>setLinkForm(f=>({...f,relationship:e.target.value}))}>
                <option value="PARENT">Parent</option><option value="LEGAL_GUARDIAN">Legal Guardian</option>
                <option value="OTHER_AUTHORIZED">Other Approved Contact</option>
              </select>
            </label>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 size-4 accent-[#82172a]" checked={linkVerified}
              onChange={e=>setLinkVerified(e.target.checked)} required/>
            <span>I verified this guardian's relationship to the selected student using school-authorized records.</span>
          </label>
          <button disabled={busy||!linkVerified} type="submit" className={primary}>Save Verified Relationship</button>
        </form>
      </div>}
      <p className="text-center text-xs leading-relaxed text-gray-500">Do not enroll real child data until the school has approved access policies, consent, retention, and secure backups.</p>
    </div>
  </main>
}
