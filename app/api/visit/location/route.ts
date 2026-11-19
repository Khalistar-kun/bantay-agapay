import {NextRequest,NextResponse} from 'next/server'
import {schoolDb,noStore,qrTokenPattern} from '@/lib/server/client-compliance-db'
import {authorizedLocationSession} from '@/lib/server/location-session'
import {consumeRateLimit} from '@/lib/server/rate-limit'

export const dynamic='force-dynamic'
export const runtime='nodejs'
const result=(value:Record<string,unknown>,status=200)=>NextResponse.json(value,{status,headers:noStore})

/** Checks location consent and the private, OTP-verified device session. */
async function activeVisit(req:NextRequest,token:string){
  if(!qrTokenPattern.test(token))return{error:'Invalid QR pass',status:400} as const
  if(!authorizedLocationSession(req,token))return{
    error:'Location sharing needs the original verified registration browser. Your QR is still valid for entry. Contact school security for assistance.',
    status:403
  } as const
  const db=schoolDb()
  const {data,error}=await db.from('pre_registrations')
    .select('id,status,visit_id').eq('public_token',token).maybeSingle()
  if(error)throw Error('Visitor pass lookup unavailable')
  if(!data)return{error:'Visit not found',status:404} as const
  if(data.status!=='ADMITTED'||!data.visit_id)return{
    error:'Location sharing is available only during an approved active campus visit.',status:409
  } as const
  return{db,visitId:data.visit_id as string} as const
}
export async function GET(req:NextRequest){
  const token=req.nextUrl.searchParams.get('token')||''
  try{
    const visit=await activeVisit(req,token)
    if('error' in visit)return result({error:visit.error,available:false},visit.status)
    const {data,error}=await visit.db.from('visits')
      .select('status,location_sharing_enabled,location_accuracy_m,location_updated_at')
      .eq('id',visit.visitId).maybeSingle()
    if(error)throw Error('Location status unavailable')
    if(!data||data.status!=='INSIDE')return result({sharing:false,available:false})
    return result({
      available:true,sharing:data.location_sharing_enabled===true,
      accuracyMeters:data.location_sharing_enabled?data.location_accuracy_m:null,
      updatedAt:data.location_sharing_enabled?data.location_updated_at:null
    })
  }catch{return result({error:'Location status unavailable. Please retry.'},503)}
}
export async function POST(req:NextRequest){
  // Require exact origin for writes; prevent another site triggering consent,
  // location updates, or sharing revocation through the browser cookie.
  if(req.headers.get('origin')!==req.nextUrl.origin)
    return result({error:'Cross-origin request refused'},403)
  let body:Record<string,unknown>
  try{
    const raw=await req.text()
    if(raw.length>1500)return result({error:'Location request too large'},413)
    const parsed:unknown=JSON.parse(raw)
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return result({error:'Invalid request'},400)
    body=parsed as Record<string,unknown>
  }catch{return result({error:'Invalid request'},400)}
  const token=body.token
  const action=body.action
  if(typeof token!=='string'||!['start','stop','update'].includes(String(action)))
    return result({error:'Invalid location request'},400)
  try{
    const visit=await activeVisit(req,token)
    if('error' in visit)return result({error:visit.error},visit.status)
    const {db,visitId}=visit
    // Bound every mutation to an active check-in. QR possession never suffices.
    if(action==='start'){
      const allowed=await consumeRateLimit(req,'location-start',token,8,3600)
      if(!allowed)return result({error:'Too many location-sharing requests. Try later.'},429)
      const {data,error}=await db.from('visits').update({
        location_sharing_enabled:true,current_latitude:null,current_longitude:null,
        location_accuracy_m:null,location_updated_at:null
      }).eq('id',visitId).eq('status','INSIDE').select('id').maybeSingle()
      if(error)throw Error('Location consent update unavailable')
      if(!data)return result({error:'Visit is no longer checked in'},409)
      return result({sharing:true,message:'Location sharing started. Waiting for a reliable phone GPS fix.'})
    }
    if(action==='stop'){
      // Stopping collection is never subject to daily rate limits.
      const {data,error}=await db.from('visits').update({
        location_sharing_enabled:false,current_latitude:null,current_longitude:null,
        location_accuracy_m:null,location_updated_at:null
      }).eq('id',visitId).eq('status','INSIDE').select('id').maybeSingle()
      if(error)throw Error('Unable to clear shared location')
      if(!data)return result({error:'Visit is no longer checked in'},409)
      return result({sharing:false,message:'Location sharing stopped and the active position was cleared.'})
    }

    const latitude=body.latitude,longitude=body.longitude,accuracy=body.accuracy
    const measuredAt=body.measuredAt
    if(typeof latitude!=='number'||typeof longitude!=='number'||typeof accuracy!=='number'||
      !Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(accuracy)||
      Math.abs(latitude)>90||Math.abs(longitude)>180||accuracy<1||accuracy>150||
      typeof measuredAt!=='number'||!Number.isFinite(measuredAt)||
      Math.abs(Date.now()-measuredAt)>30_000)
      return result({error:'GPS reading is invalid, too old or insufficiently accurate'},422)

    const allowed=await consumeRateLimit(req,'location-update',token,240,3600)
    if(!allowed)return result({error:'Location update limit reached. Contact security.'},429)

    const {data:current,error:readError}=await db.from('visits')
      .select('status,location_sharing_enabled,location_updated_at')
      .eq('id',visitId).maybeSingle()
    if(readError)throw Error('Location consent unavailable')
    if(!current||current.status!=='INSIDE'||current.location_sharing_enabled!==true)
      return result({error:'Location sharing is disabled or the visit has ended'},409)
    if(current.location_updated_at&&Date.now()-new Date(current.location_updated_at).getTime()<8000)
      return result({error:'Location update too frequent',retryAfterSeconds:8},429)

    // The WHERE filters prevent a stale in-flight GPS write after Stop or Exit.
    const {data,error}=await db.from('visits').update({
      current_latitude:latitude,current_longitude:longitude,
      location_accuracy_m:Math.round(accuracy),
      location_updated_at:new Date().toISOString()
    }).eq('id',visitId).eq('status','INSIDE').eq('location_sharing_enabled',true)
      .select('id,location_updated_at').maybeSingle()
    if(error)throw Error('Location update unavailable')
    if(!data)return result({error:'Sharing stopped or visit ended'},409)
    return result({accepted:true,updatedAt:data.location_updated_at,accuracyMeters:Math.round(accuracy)})
  }catch{return result({error:'Secure location service unavailable. Your visit remains valid without location sharing.'},503)}
}
