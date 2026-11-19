import { NextRequest,NextResponse } from 'next/server'
import { schoolDb,requireStaff,denyCrossOrigin,noStore,safeText } from '@/lib/server/client-compliance-db'
import { UUID } from '@/lib/client-compliance'

export const dynamic='force-dynamic'
const categories=['INVALID_QR','GUARDIAN_MISMATCH','PHOTO_REVIEW','DUPLICATE_SCAN','MISSING_INFORMATION','OTHER']
export async function GET(req:NextRequest){
  const staff=await requireStaff()
  if(!staff)return NextResponse.json({error:'Staff authorization required'},{status:401})
  const filter=req.nextUrl.searchParams.get('status')
  try{
    let q=schoolDb().from('security_incidents').select(
      'id,category,details,status,pre_registration_id,visit_id,created_by,resolved_by,created_at,resolved_at'
    ).order('created_at',{ascending:false}).limit(150)
    if(filter==='OPEN'||filter==='RESOLVED')q=q.eq('status',filter)
    const {data,error}=await q
    if(error)throw error
    return NextResponse.json({incidents:data||[]},{headers:noStore})
  }catch{return NextResponse.json({error:'Could not load incidents'},{status:500})}
}
export async function POST(req:NextRequest){
  const staff=await requireStaff()
  if(!staff)return NextResponse.json({error:'Staff authorization required'},{status:401})
  const cross=denyCrossOrigin(req);if(cross)return cross
  try{
    const body=await req.json()
    const category=body.category,details=safeText(body.details,3,500)
    if(!categories.includes(category)||!details||
       body.preRegistrationId&&(!UUID.test(body.preRegistrationId)) ||
       body.visitId&&(!UUID.test(body.visitId)))
      return NextResponse.json({error:'Invalid incident details'},{status:400})
    const db=schoolDb()
    const {data,error}=await db.from('security_incidents').insert({
      category,details,created_by:staff.profileId,
      pre_registration_id:body.preRegistrationId||null,
      visit_id:body.visitId||null,
    }).select('id').single()
    if(error||!data)throw error
    await db.from('audit_logs').insert({user_id:staff.profileId,action:'INCIDENT_CREATED',
      entity_type:'security_incident',entity_id:data.id})
    return NextResponse.json({id:data.id},{status:201})
  }catch{return NextResponse.json({error:'Could not record incident'},{status:500})}
}
export async function PATCH(req:NextRequest){
  const staff=await requireStaff()
  if(!staff)return NextResponse.json({error:'Staff authorization required'},{status:401})
  const cross=denyCrossOrigin(req);if(cross)return cross
  try{
    const body=await req.json()
    if(typeof body.id!=='string'||!UUID.test(body.id))
      return NextResponse.json({error:'Invalid incident'},{status:400})
    const db=schoolDb()
    const {data,error}=await db.from('security_incidents')
      .update({status:'RESOLVED',resolved_by:staff.profileId,resolved_at:new Date().toISOString()})
      .eq('id',body.id).eq('status','OPEN').select('id').maybeSingle()
    if(error||!data)return NextResponse.json({error:'Incident is missing or already closed'},{status:409})
    await db.from('audit_logs').insert({user_id:staff.profileId,action:'INCIDENT_RESOLVED',
      entity_type:'security_incident',entity_id:body.id})
    return NextResponse.json({success:true})
  }catch{return NextResponse.json({error:'Could not resolve incident'},{status:500})}
}
