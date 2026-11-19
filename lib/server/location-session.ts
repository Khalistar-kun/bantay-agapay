import crypto from 'crypto'
import type {NextRequest} from 'next/server'

export const LOCATION_COOKIE='ba_location_session'
const pattern=/^[a-f0-9]{32}$/i
const ttlSeconds=72*3600

function signingKey(){
  const key=process.env.BA_OTP_HMAC_SECRET||''
  if(key.length<32)throw Error('Visitor device verification is not configured')
  return key
}
function signature(token:string,exp:number){
  return crypto.createHmac('sha256',signingKey())
    .update('bantay-location-session-v1|'+token+'|'+exp).digest('hex')
}
/** This session is minted only after successful OTP-bound registration.
 * The public QR token alone must NEVER authorize geolocation mutation.
 */
export function locationSessionCookie(token:string){
  if(!pattern.test(token))throw Error('Invalid visitor pass token')
  const exp=Math.floor(Date.now()/1000)+ttlSeconds
  return {
    name:LOCATION_COOKIE,value:'v1.'+token+'.'+exp+'.'+signature(token,exp),
    options:{httpOnly:true,sameSite:'lax' as const,secure:true,path:'/',maxAge:ttlSeconds}
  }
}
export function authorizedLocationSession(req:NextRequest,token:string):boolean{
  if(!pattern.test(token))return false
  try{
    const raw=req.cookies.get(LOCATION_COOKIE)?.value||''
    if(raw.length>200)return false
    const parts=raw.split('.')
    if(parts.length!==4||parts[0]!=='v1'||parts[1]!==token||!/^[0-9]{10,12}$/.test(parts[2])||
      !/^[a-f0-9]{64}$/.test(parts[3]))return false
    const exp=Number(parts[2]),now=Math.floor(Date.now()/1000)
    if(!Number.isSafeInteger(exp)||exp<=now||exp>now+ttlSeconds)return false
    const given=Buffer.from(parts[3],'hex')
    const actual=Buffer.from(signature(token,exp),'hex')
    return crypto.timingSafeEqual(given,actual)
  }catch{return false}
}
