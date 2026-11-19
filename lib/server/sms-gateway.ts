/**
 * Free-only Android TextBee gateway. No paid gateway, trial upgrade, or automatic fallback.
 * The school's SIM may still be billed unless its carrier allowance includes these texts.
 * Provider acceptance means QUEUED, never proof of delivery.
 */
export function smsGatewayConfigured(): boolean {
  const apiKey=process.env.TEXTBEE_API_KEY||''
  const deviceId=process.env.TEXTBEE_DEVICE_ID?.trim()||''
  return process.env.BA_FREE_SMS_ONLY==='true' &&
    process.env.BA_SMS_CARRIER_INCLUDED==='true' &&
    apiKey.length>=24 &&
    /^[a-zA-Z0-9_-]{8,64}$/.test(deviceId)
}

async function queueFreeSms(phone:string,message:string): Promise<boolean> {
  if(!smsGatewayConfigured()||!/^09\d{9}$/.test(phone)||!message||message.length>220)return false
  const apiKey=process.env.TEXTBEE_API_KEY as string
  const deviceId=process.env.TEXTBEE_DEVICE_ID?.trim()||''
  if(!/^[a-zA-Z0-9_-]{8,64}$/.test(deviceId))return false
  try {
    const response=await fetch('https://api.textbee.dev/api/v1/gateway/send-sms',{
      method:'POST',
      headers:{'x-api-key':apiKey,'Content-Type':'application/json'},
      redirect:'error',cache:'no-store',signal:AbortSignal.timeout(6500),
      body:JSON.stringify({recipients:['+63'+phone.slice(1)],message,deviceId})
    })
    if(!response.ok)return false
    const body:unknown=await response.json()
    if(!body||typeof body!=='object')return false
    const data=(body as Record<string,unknown>).data
    return Boolean(data&&typeof data==='object'&&(data as Record<string,unknown>).success===true)
  }catch{return false}
}

export async function sendReturningOtp(phone:string,code:string): Promise<boolean> {
  if(!/^\d{6}$/.test(code))return false
  return queueFreeSms(phone,'Bantay-Agapay code: '+code+'. Valid for 5 minutes. Do not share this code.')
}

/** A non-OTP connectivity test sent only to the school's configured test SIM. */
export async function sendSchoolTestSms(phone:string): Promise<boolean> {
  return queueFreeSms(phone,'Bantay-Agapay admin SMS test. This is NOT a login or visitor OTP. No action required.')
}
