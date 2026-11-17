import { NextRequest,NextResponse } from 'next/server'
import { schoolDb,requireStaff,denyCrossOrigin,qrTokenPattern,revalidateGuardianRegistration,noStore,safeText } from '@/lib/server/client-compliance-db'
import { UUID,requiresGuardianCheck } from '@/lib/client-compliance'

export const dynamic='force-dynamic'
const forbidden=()=>NextResponse.json({error:'Security login required'},{status:401})

export async function GET(req:NextRequest){
  const staff=await requireStaff()
  if(!staff)return forbidden()
  try{
    const db=schoolDb()
    if(req.nextUrl.searchParams.get('list')==='pending'){
      const {data,error}=await db.from('pre_registrations')
        .select('id,reference_number,full_name,visitor_type,purpose,status,submitted_at,expires_at,guardian_details_status,photo_review_status,destinations(name)')
        .in('status',['PRE_REGISTERED','NEEDS_REVIEW'])
        .order('submitted_at',{ascending:false}).limit(100)
      if(error)throw error
      return NextResponse.json({registrations:data||[]},{headers:noStore})
    }
    const token=req.nextUrl.searchParams.get('token')
    if(!token||!qrTokenPattern.test(token))return NextResponse.json({error:'Invalid QR code'},{status:400})
    const {data:pr,error}=await db.from('pre_registrations')
      .select('id,public_token,reference_number,full_name,contact_number,visitor_type,purpose,destination_id,visitor_photo_path,guardian_birth_date,guardian_address,student_full_name,student_grade,student_section,guardian_id,student_id,guardian_details_status,photo_review_status,status,expires_at,submitted_at,visit_id,destinations(name,building)')
      .eq('public_token',token).maybeSingle()
    if(error)throw error
    if(!pr)return NextResponse.json({error:'QR code not registered'},{status:404})
    const visitorPhoto=await db.storage.from('visitor-faces').createSignedUrl(pr.visitor_photo_path,90)
    let referencePhotoUrl:null|string=null
    if(pr.guardian_id && requiresGuardianCheck(pr.visitor_type,pr.purpose)){
      const {data:guardian}=await db.from('authorized_guardians')
        .select('reference_photo_path').eq('id',pr.guardian_id).maybeSingle()
      if(guardian?.reference_photo_path){
        const ref=await db.storage.from('guardian-references').createSignedUrl(guardian.reference_photo_path,90)
        referencePhotoUrl=ref.data?.signedUrl||null
      }
    }
    const destination=pr.destinations as unknown as {name:string;building:string|null}|null
    const guardianVisit=requiresGuardianCheck(pr.visitor_type,pr.purpose)
    const latestDetails=guardianVisit?await revalidateGuardianRegistration(db,pr):null
    return NextResponse.json({
      registration:{
        id:pr.id,reference:pr.reference_number,fullName:pr.full_name,
        visitorType:pr.visitor_type,purpose:pr.purpose,contactNumber:pr.contact_number,
        studentName:pr.student_full_name,studentGrade:pr.student_grade,studentSection:pr.student_section,
        guardianBirthday:pr.guardian_birth_date,guardianAddress:pr.guardian_address,
        destination:destination?.name||'Unknown',building:destination?.building||'',
        submittedAt:pr.submitted_at,expiresAt:pr.expires_at,
        status:pr.status,photoReviewStatus:pr.photo_review_status,
        guardianDetailsStatus:latestDetails===null?'NOT_APPLICABLE':latestDetails?'MATCH':'MISMATCH',
        photoUrl:visitorPhoto.data?.signedUrl||null,referencePhotoUrl,
        visitId:pr.visit_id
      }
    },{headers:noStore})
  }catch{
    return NextResponse.json({error:'Could not retrieve school visitor record'},{status:500})
  }
}

export async function POST(req:NextRequest){
  const staff=await requireStaff()
  if(!staff)return forbidden()
  const cross=denyCrossOrigin(req);if(cross)return cross
  try{
    const body=await req.json()
    const token=body?.token,action=body?.action
    if(typeof token!=='string'||!qrTokenPattern.test(token))
      return NextResponse.json({error:'Invalid QR code'},{status:400})
    const db=schoolDb()
    const {data:pr,error}=await db.from('pre_registrations')
      .select('id,full_name,visitor_type,purpose,contact_number,guardian_birth_date,guardian_address,student_full_name,student_grade,student_section,guardian_details_status,photo_review_status,status,expires_at,visit_id')
      .eq('public_token',token).maybeSingle()
    if(error||!pr)return NextResponse.json({error:'Registration not found'},{status:404})
    if(action==='review-photo'){
      if(pr.status!=='PRE_REGISTERED'&&pr.status!=='NEEDS_REVIEW')
        return NextResponse.json({error:'This registration is already closed'},{status:409})
      const decision=body.decision
      if(decision!=='PASSED'&&decision!=='FAILED')
        return NextResponse.json({error:'Explicit photo decision required'},{status:400})
      // For guardians require the guard to explicitly affirm side-by-side reference-photo review.
      const guardian=requiresGuardianCheck(pr.visitor_type,pr.purpose)
      if(guardian&&body.referenceReviewed!==true&&decision==='PASSED')
        return NextResponse.json({error:'Review the enrolled guardian reference photo before confirming'},{status:422})
      const {error:save}=await db.from('pre_registrations')
        .update({photo_review_status:decision,reviewed_by:staff.profileId,reviewed_at:new Date().toISOString()})
        .eq('id',pr.id).in('status',['PRE_REGISTERED','NEEDS_REVIEW'])
      if(save)return NextResponse.json({error:'Could not save photo review'},{status:500})
      await db.from('identity_verification_attempts').insert({
        pre_registration_id:pr.id,reviewer_id:staff.profileId,kind:'PHOTO_MANUAL',
        outcome:decision==='PASSED'?'MATCH':'MISMATCH',
        notes:safeText(body.notes,0,500)||null
      })
      await db.from('audit_logs').insert({user_id:staff.profileId,action:'PHOTO_REVIEW_'+decision,
        entity_type:'pre_registration',entity_id:pr.id})
      return NextResponse.json({success:true,photoReviewStatus:decision})
    }
    if(action==='approve'){
      if(pr.status!=='PRE_REGISTERED'||new Date(pr.expires_at).getTime()<=Date.now())
        return NextResponse.json({error:'Pass is expired, flagged or already used'},{status:409})
      const validated=await revalidateGuardianRegistration(db,pr)
      if(!validated||pr.photo_review_status!=='PASSED'){
        const category=validated?'PHOTO_REVIEW':'GUARDIAN_MISMATCH'
        await db.from('security_incidents').insert({
          pre_registration_id:pr.id,category,details:'Entry held for school review',created_by:staff.profileId
        })
        return NextResponse.json({error:'Identity or guardian validation is incomplete. Entry is blocked.'},{status:403})
      }
      const result=await db.rpc('admit_pre_registration',{p_id:pr.id,p_staff_id:staff.profileId})
      if(result.error||!result.data?.length)return NextResponse.json({error:'Entry could not be approved'},{status:409})
      return NextResponse.json({success:true,status:'INSIDE',visitId:result.data[0].visit_id,visitorName:result.data[0].visitor_name})
    }
    if(action==='checkout'){
      if(pr.status!=='ADMITTED')return NextResponse.json({error:'No active entry. Duplicate exit attempt blocked.'},{status:409})
      const result=await db.rpc('checkout_pre_registration',{p_id:pr.id,p_staff_id:staff.profileId})
      if(result.error||!result.data?.length)return NextResponse.json({error:'Checkout could not be recorded'},{status:409})
      return NextResponse.json({success:true,status:'EXITED',visitorName:result.data[0].visitor_name})
    }
    if(action==='deny'){
      const reason=safeText(body.reason,3,500)
      if(!reason)return NextResponse.json({error:'A denial reason is required'},{status:400})
      const result=await db.from('pre_registrations')
        .update({status:'DENIED',denial_reason:reason,reviewed_by:staff.profileId,reviewed_at:new Date().toISOString()})
        .eq('id',pr.id).in('status',['PRE_REGISTERED','NEEDS_REVIEW']).select('id').maybeSingle()
      if(result.error||!result.data)return NextResponse.json({error:'Registration is already closed'},{status:409})
      await db.from('audit_logs').insert({user_id:staff.profileId,action:'GATE_ENTRY_DENIED',
        entity_type:'pre_registration',entity_id:pr.id,metadata:{reason}})
      return NextResponse.json({success:true,status:'DENIED'})
    }
    return NextResponse.json({error:'Unknown gate action'},{status:400})
  }catch{
    return NextResponse.json({error:'Gate action failed'},{status:500})
  }
}
