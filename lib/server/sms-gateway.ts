/**
 * No-subscription SMS mode: textbee's Free Android/SIM gateway only.
 * There is no external paid SMS gateway fallback, trial-credit auto-upgrade,
 * or hidden subscription. Sending may still consume the SCHOOL'S SIM SMS
 * allowance and may incur carrier charges unless the school has inclusive SMS.
 *
 * This module is disabled by default. All secrets are server-only.
 * Successful API acceptance means "queued", NOT "delivered".
 */
export function smsGatewayConfigured(): boolean {
  const apiKey=process.env.TEXTBEE_API_KEY||''
  return process.env.BA_FREE_SMS_ONLY==='true' &&
    process.env.BA_SMS_CARRIER_INCLUDED==='true' &&
    apiKey.length>=24
}

export async function sendReturningOtp(phone:string,code:string): Promise<boolean> {
  if(!smsGatewayConfigured()||!/^09\d{9}$/.test(phone)||!/^\d{6}$/.test(code))return false
  const apiKey=process.env.TEXTBEE_API_KEY as string
  const deviceId=process.env.TEXTBEE_DEVICE_ID?.trim()||''
  if(deviceId && !/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId))return false
  try {
    const response=await fetch('https://api.textbee.dev/api/v1/gateway/send-sms',{
      method:'POST',
      headers:{
        'x-api-key':apiKey,
        'Content-Type':'application/json',
      },
      redirect:'error',
      cache:'no-store',
      signal:AbortSignal.timeout(6500),
      body:JSON.stringify({
        recipients:['+63'+phone.slice(1)],
        message:'Bantay-Agapay code: '+code+'. Valid for 5 minutes. Do not share this code.',
        ...(deviceId?{deviceId}:{})
      })
    })
    if(!response.ok)return false
    const body:unknown=await response.json()
    if(!body||typeof body!=='object')return false
    const data=(body as Record<string,unknown>).data
    return Boolean(data&&typeof data==='object'&&(data as Record<string,unknown>).success===true)
  }catch{
    return false
  }
}


/** Sends a fixed non-OTP diagnostic SMS only through the free-only school Android gateway.
 * This does NOT alter the existing returning-visitor OTP flow.
 * A provider acknowledgement is a QUEUE confirmation, not handset delivery.
 */
export async function sendSchoolTestSms(phone:string):Promise<boolean>{
  const deviceId=process.env.TEXTBEE_DEVICE_ID?.trim()||''
  if(!smsGatewayConfigured()||!/^09\d{9}$/.test(phone)||!/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId))return false
  try{
    const response=await fetch('https://api.textbee.dev/api/v1/gateway/send-sms',{
      method:'POST',
      headers:{'x-api-key':process.env.TEXTBEE_API_KEY as string,'Content-Type':'application/json'},
      redirect:'error',cache:'no-store',signal:AbortSignal.timeout(6500),
      body:JSON.stringify({
        recipients:['+63'+phone.slice(1)],
        message:'Bantay-Agapay admin SMS test. This is NOT a login or visitor OTP. No action required.',
        deviceId
      })
    })
    if(!response.ok)return false
    const body:unknown=await response.json()
    if(!body||typeof body!=='object')return false
    const data=(body as Record<string,unknown>).data
    return Boolean(data&&typeof data==='object'&&(data as Record<string,unknown>).success===true)
  }catch{return false}
}
