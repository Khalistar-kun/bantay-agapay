import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { verifyStaff } from '@/lib/auth/verifyStaff'
import { schoolDb, noStore } from '@/lib/server/client-compliance-db'
import { consumeRateLimit } from '@/lib/server/rate-limit'
import { smsGatewayConfigured, sendSchoolTestSms } from '@/lib/server/sms-gateway'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const respond = (body:Record<string,unknown>,status=200) =>
  NextResponse.json(body,{status,headers:noStore})

function testRecipient():string|null {
  const phone=process.env.BA_SMS_TEST_PHONE||''
  return process.env.BA_SMS_TEST_ENABLED==='true' && /^09\d{9}$/.test(phone)
    ?phone:null
}
function ready():boolean {
  return Boolean(testRecipient() && smsGatewayConfigured() &&
    (process.env.BA_RATE_LIMIT_SECRET||'').length>=32)
}
async function approvedAdmin(){
  const user=await verifyStaff()
  return user?.role==='ADMIN'?user:null
}

/** Readiness check; never sends SMS, exposes secrets, or returns the full phone number. */
export async function GET(){
  try {
    if(!await approvedAdmin()) return respond({error:'Administrator access required'},403)
    const phone=testRecipient()
    return respond({
      ready:ready(),
      destination:phone?'09*****'+phone.slice(-4):null,
      notice:'Uses only the school-approved TextBee Android SIM. Provider acceptance does not confirm handset delivery.'
    })
  }catch{return respond({error:'SMS test status unavailable'},503)}
}

/** Admin-only, single configured recipient; no user-supplied number or message accepted. */
export async function POST(req:NextRequest){
  // Browser same-origin POSTs send Origin. Reject missing and cross-site Origin.
  if(req.headers.get('origin')!==req.nextUrl.origin)
    return respond({error:'Cross-origin SMS test denied'},403)
  let admin:Awaited<ReturnType<typeof approvedAdmin>>
  try{admin=await approvedAdmin()}catch{return respond({error:'SMS test authorization unavailable'},503)}
  if(!admin)return respond({error:'Administrator access required'},403)
  if(!ready())return respond({
    error:'Free SMS test is not configured. Verify school-approved test phone, Android device, carrier-inclusive SMS and rate-limit settings.'
  },503)

  const secret=process.env.BA_RATE_LIMIT_SECRET as string
  const phone=testRecipient() as string
  try {
    const adminLimit=await consumeRateLimit(req,'admin-sms-test',admin.profileId,2,3600)
    if(!adminLimit)return respond({error:'Test limit reached. Try again after the hourly window.'},429)
    // Also enforce a daily device-wide ceiling shared across admin accounts and IPs.
    const globalKey=crypto.createHmac('sha256',secret).update('admin-sms-test:school:daily').digest('hex')
    const {data:dailyAllowed,error:rateError}=await schoolDb().rpc('consume_rate_limit',{
      p_key_hash:globalKey,p_limit:5,p_window_seconds:86400
    })
    if(rateError||typeof dailyAllowed!=='boolean')throw Error('Test rate limiter unavailable')
    if(!dailyAllowed)return respond({error:'School SMS test limit reached for the day.'},429)

    // This is a real SMS only when an administrator explicitly clicks Send.
    const queued=await sendSchoolTestSms(phone)
    if(!queued)return respond({error:'TextBee did not accept the test SMS. Check the school Android gateway and free quota.'},503)
    return respond({
      queued:true,
      destination:'09*****'+phone.slice(-4),
      message:'TextBee accepted the test SMS. Check the school test phone for actual delivery; this is not an OTP.'
    })
  }catch{return respond({error:'SMS test temporarily unavailable. Check rate limiting, device connection and gateway configuration.'},503)}
}
