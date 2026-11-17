import { NextRequest,NextResponse } from 'next/server'
import { schoolDb,requireStaff,denyCrossOrigin,noStore,safeText } from '@/lib/server/client-compliance-db'
import { UUID } from '@/lib/client-compliance'
export const dynamic='force-dynamic'
const denied=()=>NextResponse.json({error:'Administrator authorization required'},{status:403})
export async function GET(){
  const staff=await requireStaff('ADMIN');if(!staff)return denied()
  try{
    const {data,error}=await schoolDb().from('faculty_directory')
      .select('id,full_name,department,destination_id,active,public_visible,created_at,destinations(name,building)')
      .order('full_name').limit(500)
    if(error)throw error
    return NextResponse.json({faculty:data||[]},{headers:noStore})
  }catch{return NextResponse.json({error:'Faculty directory unavailable'},{status:500})}
}
export async function POST(req:NextRequest){
  const staff=await requireStaff('ADMIN');if(!staff)return denied()
  const cross=denyCrossOrigin(req);if(cross)return cross
  try{
    const body=await req.json()
    const name=safeText(body.fullName,3,200),department=safeText(body.department,0,120)
    const destinationId=body.destinationId
    if(!name||typeof destinationId!=='string'||!UUID.test(destinationId))
      return NextResponse.json({error:'Faculty name and valid destination required'},{status:400})
    const db=schoolDb()
    const {data:dest}=await db.from('destinations').select('id,active').eq('id',destinationId).maybeSingle()
    if(!dest?.active)return NextResponse.json({error:'Faculty destination must be active'},{status:400})
    const {data,error}=await db.from('faculty_directory').insert({
      full_name:name,department:department||null,destination_id:destinationId,
      active:true,public_visible:body.publicVisible===true
    }).select('id').single()
    if(error||!data)throw error
    await db.from('audit_logs').insert({user_id:staff.profileId,action:'FACULTY_DIRECTORY_ADDED',
      entity_type:'faculty_directory',entity_id:data.id})
    return NextResponse.json({id:data.id},{status:201})
  }catch{return NextResponse.json({error:'Cannot add faculty destination'},{status:500})}
}
export async function PATCH(req:NextRequest){
  const staff=await requireStaff('ADMIN');if(!staff)return denied()
  const cross=denyCrossOrigin(req);if(cross)return cross
  try{
    const body=await req.json()
    if(typeof body.id!=='string'||!UUID.test(body.id)||typeof body.publicVisible!=='boolean')
      return NextResponse.json({error:'Invalid directory update'},{status:400})
    const db=schoolDb()
    const {data,error}=await db.from('faculty_directory')
      .update({public_visible:body.publicVisible,updated_at:new Date().toISOString()})
      .eq('id',body.id).select('id').maybeSingle()
    if(error||!data)return NextResponse.json({error:'Faculty record unavailable'},{status:404})
    await db.from('audit_logs').insert({user_id:staff.profileId,
      action:body.publicVisible?'FACULTY_PUBLICATION_ENABLED':'FACULTY_PUBLICATION_DISABLED',
      entity_type:'faculty_directory',entity_id:body.id})
    return NextResponse.json({success:true})
  }catch{return NextResponse.json({error:'Cannot update directory'},{status:500})}
}
