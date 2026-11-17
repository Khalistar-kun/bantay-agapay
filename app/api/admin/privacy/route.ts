import {NextRequest,NextResponse} from 'next/server'
import {schoolDb,requireStaff,denyCrossOrigin,noStore,safeText} from '@/lib/server/client-compliance-db'
import {UUID} from '@/lib/client-compliance'

export const dynamic='force-dynamic'
const denied=()=>NextResponse.json({error:'Administrator authorization required'},{status:403})
const keys=['privacy_contact_email','visitor_retention_days','guardian_review_days','privacy_notice_version']
export async function GET(req:NextRequest){
 const staff=await requireStaff('ADMIN');if(!staff)return denied()
 try{
  const db=schoolDb()
  if(req.nextUrl.searchParams.get('view')==='requests'){
   const {data,error}=await db.from('privacy_requests')
     .select('id,request_type,subject_type,subject_reference,details,status,created_at,reviewed_at,resolution_notes,created_by,reviewed_by')
     .order('created_at',{ascending:false}).limit(150)
   if(error)throw error
   return NextResponse.json({requests:data||[]},{headers:noStore})
  }
  const {data,error}=await db.from('system_settings').select('key,value').in('key',keys)
  if(error)throw error
  const values=Object.fromEntries((data||[]).map(item=>[item.key,item.value]))
  return NextResponse.json({settings:{
   contactEmail:values.privacy_contact_email||'',
   visitorRetentionDays:Number(values.visitor_retention_days||30),
   guardianReviewDays:Number(values.guardian_review_days||365),
   noticeVersion:values.privacy_notice_version||'draft-1',
   enforcementEnabled:false
  }},{headers:noStore})
 }catch{return NextResponse.json({error:'Privacy settings unavailable'},{status:500})}
}
export async function POST(req:NextRequest){
 const staff=await requireStaff('ADMIN');if(!staff)return denied()
 const cross=denyCrossOrigin(req);if(cross)return cross
 try{
  const body=await req.json()
  const db=schoolDb()
  if(body.action==='settings'){
   const contactEmail=safeText(body.contactEmail,5,200)
   const visitorRetentionDays=Number(body.visitorRetentionDays)
   const guardianReviewDays=Number(body.guardianReviewDays)
   const noticeVersion=safeText(body.noticeVersion,1,40)
   if(!contactEmail||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(contactEmail)||
      !Number.isInteger(visitorRetentionDays)||visitorRetentionDays<7||visitorRetentionDays>365||
      !Number.isInteger(guardianReviewDays)||guardianReviewDays<30||guardianReviewDays>3650||
      !noticeVersion)return NextResponse.json({error:'Invalid privacy policy values'},{status:400})
   const values=[
    {key:'privacy_contact_email',value:contactEmail},
    {key:'visitor_retention_days',value:String(visitorRetentionDays)},
    {key:'guardian_review_days',value:String(guardianReviewDays)},
    {key:'privacy_notice_version',value:noticeVersion}
   ]
   const {error}=await db.from('system_settings').upsert(values,{onConflict:'key'})
   if(error)throw error
   await db.from('audit_logs').insert({user_id:staff.profileId,
    action:'PRIVACY_POLICY_SETTINGS_UPDATED',entity_type:'system_settings',
    metadata:{visitorRetentionDays,guardianReviewDays,noticeVersion}})
   return NextResponse.json({success:true,enforcementEnabled:false})
  }
  if(body.action==='request'){
   const type=body.requestType,subjectType=body.subjectType
   const ref=safeText(body.subjectReference,3,100),details=safeText(body.details,5,500)
   if(!['ACCESS','CORRECTION','DELETION'].includes(type)||
      !['PRE_REGISTRATION','GUARDIAN','VISITOR'].includes(subjectType)||!ref||!details)
    return NextResponse.json({error:'Invalid privacy request'},{status:400})
   const {data,error}=await db.from('privacy_requests').insert({
     request_type:type,subject_type:subjectType,subject_reference:ref,
     details,created_by:staff.profileId
   }).select('id').single()
   if(error||!data)throw error
   await db.from('audit_logs').insert({user_id:staff.profileId,action:'PRIVACY_REQUEST_CREATED',
    entity_type:'privacy_request',entity_id:data.id})
   return NextResponse.json({id:data.id},{status:201})
  }
  return NextResponse.json({error:'Unknown privacy action'},{status:400})
 }catch{return NextResponse.json({error:'Could not save privacy settings or request'},{status:500})}
}
export async function PATCH(req:NextRequest){
 const staff=await requireStaff('ADMIN');if(!staff)return denied()
 const cross=denyCrossOrigin(req);if(cross)return cross
 try{
  const body=await req.json()
  const id=body.id,notes=safeText(body.notes,3,500)
  if(typeof id!=='string'||!UUID.test(id)||!notes||
     !['REVIEWED','RESOLVED'].includes(body.status))
    return NextResponse.json({error:'Invalid privacy case update'},{status:400})
  const db=schoolDb()
  if(body.status==='RESOLVED'){
    const {data:record}=await db.from('privacy_requests')
      .select('request_type').eq('id',id).maybeSingle()
    if(record?.request_type==='DELETION'){
      return NextResponse.json({
        error:'Deletion requests need separately validated erasure evidence and cannot be marked resolved here.'
      },{status:403})
    }
  }
  const {data,error}=await db.from('privacy_requests').update({
    status:body.status,resolution_notes:notes,
    reviewed_at:new Date().toISOString(),reviewed_by:staff.profileId
  }).eq('id',id).in('status',['OPEN','REVIEWED']).select('id').maybeSingle()
  if(error||!data)return NextResponse.json({error:'Case already closed or unavailable'},{status:409})
  await db.from('audit_logs').insert({user_id:staff.profileId,
    action:'PRIVACY_REQUEST_'+body.status,entity_type:'privacy_request',entity_id:id})
  return NextResponse.json({success:true})
 }catch{return NextResponse.json({error:'Could not update privacy case'},{status:500})}
}
