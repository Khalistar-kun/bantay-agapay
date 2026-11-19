import { NextRequest,NextResponse } from 'next/server'
import { schoolDb,noStore } from '@/lib/server/client-compliance-db'
export const dynamic='force-dynamic'
// Only school-approved public directory entries; never expose staff personal phones or IDs.
export async function GET(req:NextRequest){
  try{
    const q=(req.nextUrl.searchParams.get('q')||'').trim()
    if(q.length>100)return NextResponse.json({error:'Search is too long'},{status:400})
    let query=schoolDb().from('faculty_directory')
      .select('id,full_name,department,destination_id,destinations(id,name,building,active)')
      .eq('active',true).eq('public_visible',true).order('full_name').limit(100)
    if(q.length>=2)query=query.ilike('full_name','%'+q.replace(/[%_]/g,'')+'%')
    const {data,error}=await query
    if(error)throw error
    const faculty=(data||[]).map(item=>{
      const d=item.destinations as unknown as {id:string,name:string,building:string|null,active:boolean}|null
      return d?.active?{
        id:item.id,name:item.full_name,department:item.department||'Faculty',
        destinationId:d.id,destinationName:d.name,building:d.building||''
      }:null
    }).filter(Boolean)
    return NextResponse.json({faculty},{headers:noStore})
  }catch{
    return NextResponse.json({error:'Faculty directory is unavailable'},{status:503})
  }
}
