import { NextRequest,NextResponse } from 'next/server'
import { randomBytes,randomUUID,createHmac } from 'crypto'
import { schoolDb,denyCrossOrigin,noStore,consentNotice,safeText,qrTokenPattern,resolveAuthorizedGuardian } from '@/lib/server/client-compliance-db'
import { PHONE,PURPOSES,VISITOR_TYPES,requiresGuardianCheck,validDate,parsePhoto,UUID } from '@/lib/client-compliance'
import { consumeRateLimit } from '@/lib/server/rate-limit'
import { smsGatewayConfigured } from '@/lib/server/sms-gateway'

export const dynamic='force-dynamic'

export async function GET(req:NextRequest){
  const token=req.nextUrl.searchParams.get('token')
  if(!token||!qrTokenPattern.test(token))return NextResponse.json({error:'Invalid QR token'},{status:400})
  try{
    const db=schoolDb()
    const {data,error}=await db.from('pre_registrations').select(
      'reference_number,full_name,visitor_type,purpose,status,submitted_at,expires_at,visit_id,destinations(name,building)'
    ).eq('public_token',token).maybeSingle()
    if(error)return NextResponse.json({error:'Could not read pass'},{status:500})
    if(!data)return NextResponse.json({error:'Pass not found'},{status:404})
    const dest=data.destinations as unknown as {name:string,building:string|null}|null
    return NextResponse.json({
      pass:{reference:data.reference_number,name:data.full_name,type:data.visitor_type,purpose:data.purpose,
        status:data.status,submittedAt:data.submitted_at,expiresAt:data.expires_at,
        destination:dest?.name||'',building:dest?.building||'',checkedIn:Boolean(data.visit_id),
        notice:consentNotice()}
    },{headers:noStore})
  }catch{
    return NextResponse.json({error:'Registration service unavailable'},{status:503})
  }
}

export async function POST(req:NextRequest){
  const cross=denyCrossOrigin(req);if(cross)return cross
  try{
    const raw=await req.text()
    if(raw.length>780_000)return NextResponse.json({error:'Photo or form is too large'},{status:413})
    const body=JSON.parse(raw)
    const fullName=safeText(body.fullName,3,200)
    const contactNumber=body.contactNumber
    const visitorType=body.visitorType
    const purpose=body.purpose
    const purposeOther=body.purposeOther
    const destinationId=body.destinationId
    if(!fullName||typeof contactNumber!=='string'||!PHONE.test(contactNumber)||
      !VISITOR_TYPES.includes(visitorType)||!PURPOSES.includes(purpose)||
      !UUID.test(destinationId)||body.privacyConsent!==true)
      return NextResponse.json({error:'Complete all required registration information'},{status:400})
    const detail=purpose==='Other'?safeText(purposeOther,3,180):purpose
    if(!detail)return NextResponse.json({error:'Please specify your purpose of visit'},{status:400})
    const photo=parsePhoto(body.facePhoto)
    if(!photo)return NextResponse.json({error:'A valid face JPEG is required'},{status:400})
    const guardianVisit=requiresGuardianCheck(visitorType,purpose)
    if(guardianVisit && visitorType!=='Parent' && visitorType!=='Guardian')
      return NextResponse.json({error:'Select Parent or Guardian for a student-related visit'},{status:400})
    let birthDate:string|null=null,address:string|null=null,studentName:string|null=null
    let grade:string|null=null,section:string|null=null
    if(guardianVisit){
      birthDate=body.birthDate
      address=safeText(body.address,5,500)
      studentName=safeText(body.studentName,3,200)
      grade=safeText(body.studentGrade,1,32)
      section=safeText(body.studentSection,1,100)
      if(!validDate(birthDate)||!address||!studentName||!grade||!section)
        return NextResponse.json({error:'Guardian and student details are required'},{status:400})
    }
    // The browser cannot bypass mandatory phone verification.
    const verificationToken=body.verificationToken
    if(typeof verificationToken!=='string'||!/^[a-f0-9]{64}$/.test(verificationToken))
      return NextResponse.json({error:'Verify your mobile number by SMS before registering.'},{status:403,headers:noStore})
    const otpSecret=process.env.BA_OTP_HMAC_SECRET||''
    if(!smsGatewayConfigured()||otpSecret.length<32)
      return NextResponse.json({error:'School SMS verification is unavailable. Contact school security.'},{status:503,headers:noStore})
    try{
      const allowed=await consumeRateLimit(req,'prereg-ip','new',12,3600)
      if(!allowed)return NextResponse.json({error:'Registration rate limit reached. Ask school security for assistance.'},{status:429})
      const phoneAllowed=await consumeRateLimit(req,'prereg-phone',contactNumber,5,86400)
      if(!phoneAllowed)return NextResponse.json({error:'Daily registration limit reached. Contact school security.'},{status:429})
    }catch{
      return NextResponse.json({error:'Registration safety checks are temporarily unavailable. Contact the school.'},{status:503})
    }
    const db=schoolDb()
    const {data:destination,error:dError}=await db.from('destinations')
      .select('id').eq('id',destinationId).eq('active',true).maybeSingle()
    if(dError||!destination)return NextResponse.json({error:'Destination unavailable'},{status:400})
    // Do not allow unlimited public pre-registrations against one phone number.
    const since=new Date(Date.now()-24*3600*1000).toISOString()
    const {count,error:countError}=await db.from('pre_registrations')
      .select('id',{count:'exact',head:true}).eq('contact_number',contactNumber).gte('submitted_at',since)
    if(countError)return NextResponse.json({error:'Registration unavailable'},{status:503})
    if((count||0)>=5)return NextResponse.json({error:'Daily registration limit reached. Contact school security.'},{status:429})
    let detailsStatus='NOT_APPLICABLE',guardianId:null|string=null,studentId:null|string=null
    if(guardianVisit){
      const result=await resolveAuthorizedGuardian(db,{
        fullName,contactNumber,birthDate:birthDate as string,address:address as string,
        studentFullName:studentName as string,studentGrade:grade as string,studentSection:section as string
      })
      detailsStatus=result.matched?'MATCH':'MISMATCH'
      guardianId=result.guardianId
      studentId=result.studentId
    }
    // Bind the verified SMS to this number; atomic use prevents replay/races.
    // We consume only after checking form, guardian, destination and abuse limits.
    const proofHash=createHmac('sha256',otpSecret).update('proof|'+verificationToken).digest('hex')
    const phoneHash=createHmac('sha256',otpSecret).update('phone|'+contactNumber).digest('hex')
    const {data:proofValid,error:proofError}=await db.rpc('consume_phone_verification',{
      p_proof_hash:proofHash,p_phone_hash:phoneHash
    })
    if(proofError)return NextResponse.json({error:'Phone verification service unavailable. Contact the school.'},{status:503,headers:noStore})
    if(proofValid!==true)return NextResponse.json({error:'Phone verification expired, mismatched, or already used. Request a new SMS code.'},{status:403,headers:noStore})
    const id=randomUUID(),token=randomBytes(16).toString('hex')
    const referenceNumber='B'+randomBytes(4).toString('hex').toUpperCase()
    const photoPath='pre-register/'+id+'/'+randomBytes(8).toString('hex')+'.jpg'
    const uploaded=await db.storage.from('visitor-faces').upload(photoPath,photo,{
      contentType:'image/jpeg',upsert:false
    })
    if(uploaded.error)return NextResponse.json({error:'Could not securely store your photo'},{status:500})
    const status=detailsStatus==='MISMATCH'?'NEEDS_REVIEW':'PRE_REGISTERED'
    const {error:saveError}=await db.from('pre_registrations').insert({
      id,public_token:token,reference_number:referenceNumber,
      full_name:fullName,contact_number:contactNumber,visitor_type:visitorType,
      purpose:detail,destination_id:destinationId,visitor_photo_path:photoPath,
      guardian_birth_date:birthDate,guardian_address:address,student_full_name:studentName,
      student_grade:grade,student_section:section,guardian_id:guardianId,student_id:studentId,
      guardian_details_status:detailsStatus,status,photo_review_status:'PENDING',
      biometric_status:guardianVisit?'PENDING':'NOT_REQUIRED',
      privacy_acknowledged_at:new Date().toISOString()
    })
    if(saveError){
      await db.storage.from('visitor-faces').remove([photoPath])
      return NextResponse.json({error:'Unable to save pre-registration'},{status:500})
    }
    // Never expose whether a student's information matched in public responses.
    return NextResponse.json({
      token,referenceNumber,status:'PRE_REGISTERED',notice:consentNotice()
    },{status:201,headers:noStore})
  }catch{
    return NextResponse.json({error:'Could not process registration'},{status:400})
  }
}
