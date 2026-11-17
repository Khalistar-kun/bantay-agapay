import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { schoolDb, requireStaff, denyCrossOrigin, safeText, noStore } from '@/lib/server/client-compliance-db'
import { validDate, PHONE, UUID } from '@/lib/client-compliance'

export const dynamic='force-dynamic'
const denied=()=>NextResponse.json({error:'Administrator authorization required'},{status:403})

export async function GET(request:NextRequest){
  const staff=await requireStaff('ADMIN')
  if(!staff)return denied()
  try{
    const db=schoolDb()
    const mode=request.nextUrl.searchParams.get('mode')
    if(mode==='guardians'){
      const {data,error}=await db.from('authorized_guardians')
        .select('id,full_name,birth_date,address,contact_number,reference_photo_path,active,verified_at,created_at')
        .order('created_at',{ascending:false}).limit(100)
      if(error)throw error
      // Do not return raw storage paths or documents to arbitrary visitors.
      const rows=await Promise.all((data||[]).map(async ({reference_photo_path,...guardian})=>{
        const signed=await db.storage.from('guardian-references')
          .createSignedUrl(reference_photo_path,90)
        return {...guardian,referencePhotoUrl:signed.data?.signedUrl||null}
      }))
      return NextResponse.json({guardians:rows},{headers:noStore})
    }
    const {data,error}=await db.from('students')
      .select('id,full_name,student_number,grade,section,active,created_at')
      .order('full_name').limit(500)
    if(error)throw error
    return NextResponse.json({students:data||[]},{headers:noStore})
  }catch{
    return NextResponse.json({error:'Could not load registry'},{status:500})
  }
}

export async function POST(request:NextRequest){
  const staff=await requireStaff('ADMIN')
  if(!staff)return denied()
  const cross=denyCrossOrigin(request);if(cross)return cross
  try{
    const raw=await request.text()
    if(raw.length>1_450_000)return NextResponse.json({error:'Enrollment payload is too large'},{status:413})
    const body=JSON.parse(raw)
    const db=schoolDb()
    if(body?.action==='student'){
      const fullName=safeText(body.fullName,3,200),grade=safeText(body.grade,1,32)
      const section=safeText(body.section,1,100)
      const number=body.studentNumber===undefined||body.studentNumber===''?null:safeText(body.studentNumber,1,64)
      if(!fullName||!grade||!section||(body.studentNumber&&!number))
        return NextResponse.json({error:'Enter the student name, grade and section'},{status:400})
      const {data,error}=await db.from('students').insert({
        full_name:fullName,grade,section,student_number:number,
      }).select('id').single()
      if(error||!data)return NextResponse.json({error:'Could not register the student'},{status:409})
      await db.from('audit_logs').insert({user_id:staff.profileId,action:'STUDENT_ENROLLED',entity_type:'student',entity_id:data.id})
      return NextResponse.json({id:data.id},{status:201})
    }
    if(body?.action==='guardian'){
      const fullName=safeText(body.fullName,3,200),address=safeText(body.address,5,500)
      const phone=body.contactNumber, birthDate=body.birthDate
      const studentId=body.studentId,relationship=body.relationship
      const hasValidRelation=['PARENT','LEGAL_GUARDIAN','OTHER_AUTHORIZED'].includes(relationship)
      if(!fullName||!address||!PHONE.test(phone)||!validDate(birthDate)||!UUID.test(studentId)||
         !hasValidRelation||body.identityChecked!==true||typeof body.referencePhoto!=='string')
        return NextResponse.json({error:'Guardian details, school verification and a reference photo are required'},{status:400})
      const photoMatch=/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(body.referencePhoto)
      if(!photoMatch)return NextResponse.json({error:'The reference must be a JPEG image'},{status:400})
      const bytes=Buffer.from(body.referencePhoto.slice('data:image/jpeg;base64,'.length),'base64')
      if(bytes.length<100||bytes.length>512000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)
        return NextResponse.json({error:'Invalid reference photo'},{status:400})
      const {data:student,error:studentError}=await db.from('students').select('id,active').eq('id',studentId).maybeSingle()
      if(studentError||!student?.active)return NextResponse.json({error:'Student is not active in the registry'},{status:400})
      const id=crypto.randomUUID(),path=id+'/'+crypto.randomBytes(12).toString('hex')+'.jpg'
      const uploaded=await db.storage.from('guardian-references').upload(path,bytes,{contentType:'image/jpeg',upsert:false})
      if(uploaded.error)return NextResponse.json({error:'Could not securely upload the guardian reference'},{status:500})
      const created=await db.from('authorized_guardians').insert({
        id,full_name:fullName,birth_date:birthDate,address,contact_number:phone,
        reference_photo_path:path,verified_by:staff.profileId,verified_at:new Date().toISOString(),active:true
      }).select('id').single()
      if(created.error){
        await db.storage.from('guardian-references').remove([path])
        return NextResponse.json({error:'Guardian enrollment failed'},{status:500})
      }
      const joined=await db.from('student_guardians').insert({
        guardian_id:id,student_id:studentId,relationship,active:true
      })
      if(joined.error){
        await db.from('authorized_guardians').delete().eq('id',id)
        await db.storage.from('guardian-references').remove([path])
        return NextResponse.json({error:'Guardian-student relationship could not be saved'},{status:500})
      }
      await db.from('audit_logs').insert({
        user_id:staff.profileId,action:'GUARDIAN_ENROLLED',
        entity_type:'guardian',entity_id:id,
        metadata:{studentId,relationship,referencePhotoStored:true}
      })
      return NextResponse.json({id},{status:201})
    }
    return NextResponse.json({error:'Unknown enrollment action'},{status:400})
  }catch{
    return NextResponse.json({error:'Invalid enrollment request'},{status:400})
  }
}
