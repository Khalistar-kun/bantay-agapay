import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { schoolDb, denyCrossOrigin, noStore } from '@/lib/server/client-compliance-db'
import { PHONE } from '@/lib/client-compliance'
import { consumeRateLimit } from '@/lib/server/rate-limit'
import { smsGatewayConfigured, sendReturningOtp } from '@/lib/server/sms-gateway'

export const dynamic='force-dynamic'
const errorResponse=(message:string,status:number)=>NextResponse.json({error:message},{status,headers:noStore})
const successNotice='A verification SMS was queued. Check your phone for the six-digit code.'
const secretsReady=()=>Boolean((process.env.BA_OTP_HMAC_SECRET||'').length>=32 &&
  (process.env.BA_RATE_LIMIT_SECRET||'').length>=32)
export async function GET(){
  const configured=smsGatewayConfigured()&&secretsReady()
  return NextResponse.json({
    verificationRequired:true,
    freeSmsAvailable:configured,
    manualRegistrationAvailable:false,
    freePlanMonthlyLimit:300,
    freePlanDailyLimit:50,
    notice:configured?'SMS verification is required for everyone before face capture.':
      'School-approved free SMS is unavailable. Registration is paused; contact school security.'
  },{headers:noStore})
}
function otpPepper(){
 const secret=process.env.BA_OTP_HMAC_SECRET||''
 if(secret.length<32)throw Error('One-time password service unconfigured')
 return secret
}
function hmac(secret:string,value:string):string{
 return crypto.createHmac('sha256',secret).update(value).digest('hex')
}
function otpHash(secret:string,challengeId:string,code:string):string{
 return hmac(secret,'otp|'+challengeId+'|'+code)
}
export async function POST(req:NextRequest){
 const cross=denyCrossOrigin(req);if(cross)return cross
 let body:Record<string,unknown>
 try{
   const raw=await req.text()
   if(raw.length>2000)return errorResponse('Invalid verification request',400)
   const parsed:unknown=JSON.parse(raw)
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return errorResponse('Invalid verification request',400)
   body=parsed as Record<string,unknown>
 }catch{return errorResponse('Invalid verification request',400)}
 const phone=body.contactNumber
 if(typeof phone!=='string'||!PHONE.test(phone))
   return errorResponse('Enter a valid Philippine mobile number',400)
 const action=body.action
 if(action!=='request'&&action!=='verify')
   return errorResponse('Unknown verification action',400)
 if(!smsGatewayConfigured()||!secretsReady())
   return errorResponse('School-approved free SMS is unavailable. Registration is paused; contact school security.',503)
 try{
   const secret=otpPepper()
   const phoneHash=hmac(secret,'phone|'+phone)
   if(action==='request'){
     if(!smsGatewayConfigured())
       return errorResponse('School-approved free SMS is unavailable. Registration is paused.',503)
     const allowedIp=await consumeRateLimit(req,'visitor-otp-request','new',8,3600)
     const allowedPhone=await consumeRateLimit(req,'visitor-otp-phone',phone,4,86400)
     if(!allowedIp||!allowedPhone)return errorResponse('Too many requests. Contact the school for assistance.',429)
     const db=schoolDb()
     // New and returning numbers follow the same OTP flow.
     const code=String(crypto.randomInt(0,1_000_000)).padStart(6,'0')
     const id=crypto.randomUUID()
     const {error:created}=await db.from('returning_otp_challenges').insert({
       id,phone_hash:phoneHash,code_hash:otpHash(secret,id,code),
       expires_at:new Date(Date.now()+5*60_000).toISOString()
     })
     if(created)throw Error('Could not save verification challenge')
     const delivered=await sendReturningOtp(phone,code)
     if(!delivered){
       await db.from('returning_otp_challenges').delete().eq('id',id)
       return errorResponse('Free SMS could not be queued. Registration is paused; contact school security.',503)
     }
     return NextResponse.json({message:successNotice},{headers:noStore})
   }
   const code=body.code
   if(typeof code!=='string'||!/^\d{6}$/.test(code))
     return errorResponse('Enter the six-digit verification code',400)
   const allowed=await consumeRateLimit(req,'visitor-otp-verify',phone,10,3600)
   if(!allowed)return errorResponse('Too many verification attempts. Contact school security.',429)
   const db=schoolDb()
   const {data:challenge,error}=await db.from('returning_otp_challenges')
     .select('id,code_hash,attempts,expires_at')
     .eq('phone_hash',phoneHash).is('consumed_at',null)
     .gte('expires_at',new Date().toISOString())
     .order('created_at',{ascending:false}).limit(1).maybeSingle()
   if(error)throw Error('Verification challenge unavailable')
   if(!challenge||challenge.attempts>=5)return errorResponse('Verification code is invalid or expired',401)
   const computed=otpHash(secret,challenge.id,code)
   const correct=crypto.timingSafeEqual(Buffer.from(computed,'hex'),Buffer.from(challenge.code_hash,'hex'))
   if(!correct){
     await db.from('returning_otp_challenges').update({attempts:challenge.attempts+1})
       .eq('id',challenge.id).eq('attempts',challenge.attempts).is('consumed_at',null)
     return errorResponse('Verification code is invalid or expired',401)
   }
   // Conditional update consumes this code only once across simultaneous browser tabs.
   const used=await db.from('returning_otp_challenges')
     .update({consumed_at:new Date().toISOString()})
     .eq('id',challenge.id).is('consumed_at',null).lt('attempts',5)
     .gte('expires_at',new Date().toISOString()).select('id').maybeSingle()
   if(used.error||!used.data)return errorResponse('Verification code is invalid or expired',401)

   // Mint one short-lived, one-use registration proof after atomically consuming
   // the OTP. Never store the raw proof or a plaintext OTP.
   const verificationToken=crypto.randomBytes(32).toString('hex')
   const {error:proofError}=await db.from('visitor_phone_verifications').insert({
     proof_hash:hmac(secret,'proof|'+verificationToken),phone_hash:phoneHash,
     expires_at:new Date(Date.now()+10*60_000).toISOString()
   })
   if(proofError)throw Error('SMS proof unavailable')

   // Phone possession allows limited convenience prefill, NOT guardian authorization
   // or skipping a new live photo or manual school gate review.
   const {data:visitors,error:visitorError}=await db.from('visitors')
     .select('full_name,visitor_type').eq('contact_number',phone)
     .order('created_at',{ascending:false}).limit(5)
   if(visitorError)throw Error('Visitor profile unavailable')
   const names=new Set((visitors||[]).map(x=>x.full_name.trim().toLowerCase()))
   const types=new Set((visitors||[]).map(x=>x.visitor_type||'Guest'))
   const person=names.size===1&&types.size===1&&visitors?.length?visitors[0]:null
   return NextResponse.json({
     verified:true,verificationToken,
     profile:person?{fullName:person.full_name,visitorType:person.visitor_type||'Guest'}:null,
     notice:'Phone verified. Finish registration within ten minutes; school security still verifies identity at the gate.'
   },{headers:noStore})
 }catch{
   return errorResponse('Verification is temporarily unavailable. Contact school security.',503)
 }
}
