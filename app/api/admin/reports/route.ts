import { NextRequest,NextResponse } from 'next/server'
import { schoolDb,requireStaff,noStore } from '@/lib/server/client-compliance-db'

export const dynamic='force-dynamic'
function dayInManila(date:string|Date):string{
  const d=new Date(date)
  if(!Number.isFinite(d.getTime()))return ''
  const f=new Intl.DateTimeFormat('en-US',{
    timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(d)
  const p=Object.fromEntries(f.map(x=>[x.type,x.value]))
  return p.year+'-'+p.month+'-'+p.day
}
function dateFrom(q:string|null,defaultDays=30){
  const d=q&&/^\d{4}-\d{2}-\d{2}$/.test(q)?q:null
  return d||dayInManila(new Date(Date.now()-(defaultDays-1)*86400000))
}
export async function GET(req:NextRequest){
  const staff=await requireStaff('ADMIN')
  if(!staff)return NextResponse.json({error:'Administrator access required'},{status:403})
  const mode=req.nextUrl.searchParams.get('view')||'activity'
  const db=schoolDb()
  try{
    if(mode==='audit'){
      const {data,error}=await db.from('audit_logs')
        .select('id,action,entity_type,entity_id,user_id,created_at')
        .order('created_at',{ascending:false}).limit(200)
      if(error)throw error
      return NextResponse.json({audit:data||[]},{headers:noStore})
    }
    if(mode==='visits'){
      const from=dateFrom(req.nextUrl.searchParams.get('from'),30)
      const to=dateFrom(req.nextUrl.searchParams.get('to'),1)
      const status=req.nextUrl.searchParams.get('status')||''
      const search=(req.nextUrl.searchParams.get('q')||'').trim().toLowerCase().slice(0,100)
      if(from>to)return NextResponse.json({error:'Start date must be earlier than end date'},{status:400})
      let query=db.from('visits').select(
        'id,reference_number,purpose,status,registration_time,check_in,check_out,approved_by,checked_out_by,denied_by,denial_reason,visitors(full_name,contact_number),destinations(name)'
      ).gte('registration_time',from+'T00:00:00+08:00').lte('registration_time',to+'T23:59:59+08:00')
        .order('registration_time',{ascending:false}).limit(800)
      if(['PENDING','INSIDE','EXITED','DENIED','CANCELLED'].includes(status))query=query.eq('status',status)
      const {data,error}=await query
      if(error)throw error
      const visits=(data||[]).map(v=>{
        const person=v.visitors as unknown as {full_name:string,contact_number:string}|null
        const dest=v.destinations as unknown as {name:string}|null
        return {
          id:v.id,reference:v.reference_number,purpose:v.purpose,status:v.status,
          registeredAt:v.registration_time,checkIn:v.check_in,checkOut:v.check_out,
          approvedBy:v.approved_by,checkedOutBy:v.checked_out_by,deniedBy:v.denied_by,
          denialReason:v.denial_reason,name:person?.full_name||'',contact:person?.contact_number||'',
          destination:dest?.name||''
        }
      }).filter(v=>!search||
        [v.reference,v.name,v.purpose,v.destination].some(s=>(s||'').toLowerCase().includes(search)))
      return NextResponse.json({visits,limit:800},{headers:noStore})
    }
    if(mode==='activity'){
      const days=Number(req.nextUrl.searchParams.get('days')||30)
      if(![7,30,90].includes(days))return NextResponse.json({error:'Invalid report window'},{status:400})
      const today=dayInManila(new Date())
      const start=new Date(Date.now()-(days-1)*86400000)
      const from=dayInManila(start)
      const {data:visits,error}=await db.from('visits')
        .select('id,registration_time,check_in,check_out,status')
        .gte('registration_time',from+'T00:00:00+08:00').order('registration_time').limit(5000)
      if(error)throw error
      const {data:prereg,error:pErr}=await db.from('pre_registrations')
        .select('id,submitted_at,status').gte('submitted_at',from+'T00:00:00+08:00')
        .order('submitted_at').limit(5000)
      if(pErr)throw pErr
      const rows=new Map<string,{day:string,registrations:number,entries:number,exits:number}>()
      for(let i=days-1;i>=0;i--){
        const key=dayInManila(new Date(Date.now()-i*86400000))
        rows.set(key,{day:key,registrations:0,entries:0,exits:0})
      }
      for(const row of prereg||[]){const day=dayInManila(row.submitted_at);const target=rows.get(day);if(target)target.registrations++}
      for(const row of visits||[]){
        if(row.check_in){const target=rows.get(dayInManila(row.check_in));if(target)target.entries++}
        if(row.check_out){const target=rows.get(dayInManila(row.check_out));if(target)target.exits++}
      }
      const {count:insideCount}=await db.from('visits').select('id',{count:'exact',head:true}).eq('status','INSIDE')
      const {count:casesCount}=await db.from('security_incidents').select('id',{count:'exact',head:true}).eq('status','OPEN')
      return NextResponse.json({
        timezone:'Asia/Manila',from,today,days,
        series:[...rows.values()],
        summary:{currentlyInside:insideCount||0,openCases:casesCount||0,
          registered:(prereg||[]).length,entries:(visits||[]).filter(v=>v.check_in).length}
      },{headers:noStore})
    }
    return NextResponse.json({error:'Unknown report'},{status:400})
  }catch{
    return NextResponse.json({error:'Could not generate report'},{status:500})
  }
}
