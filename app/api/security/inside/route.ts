import {NextResponse} from 'next/server'
import {verifyStaff} from '@/lib/auth/verifyStaff'
import {schoolDb,noStore} from '@/lib/server/client-compliance-db'
import {visitorLocationPresence} from '@/lib/server/location-presence'

export const dynamic='force-dynamic'

export async function GET(){
  try{
    const staff=await verifyStaff()
    if(!staff||!['ADMIN','SECURITY'].includes(staff.role))
      return NextResponse.json({error:'Approved security login required'},{status:401,headers:noStore})
    const {data,error}=await schoolDb().from('visits')
      .select('id,reference_number,purpose,check_in,location_sharing_enabled,location_accuracy_m,current_latitude,current_longitude,location_updated_at,visitors(full_name,contact_number),destinations(name)')
      .eq('status','INSIDE').order('check_in',{ascending:false}).limit(250)
    if(error)throw Error('Active campus roster unavailable')
    const now=Date.now()
    const visitors=(data||[]).map(v=>{
      const person=v.visitors as unknown as {full_name:string,contact_number:string}|null
      const destination=v.destinations as unknown as {name:string}|null
      return{
        id:v.id,reference_number:v.reference_number,purpose:v.purpose,check_in:v.check_in,
        full_name:person?.full_name||'Visitor',
        contact_number:person?.contact_number||'',
        destination_name:destination?.name||'Ask security',
        ...visitorLocationPresence(v,now)
      }
    })
    return NextResponse.json({visitors,checkedAt:new Date(now).toISOString(),
      notice:'Coordinates are shown only while voluntarily shared and recent. Never treat a GPS pin as proof of campus location or identity.'},
      {headers:noStore})
  }catch{
    return NextResponse.json({error:'Live campus roster is unavailable. Retry or use school gate records.'},{status:503,headers:noStore})
  }
}
