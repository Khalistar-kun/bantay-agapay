import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyStaff } from '@/lib/auth/verifyStaff'
import { GuardianClaim, guardianDetailsMatch, normalizedWords, requiresGuardianCheck } from '@/lib/client-compliance'

export function schoolDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('School data service is unavailable')
  return createClient(url, serviceKey, { auth: { autoRefreshToken:false, persistSession:false } })
}
export function denyCrossOrigin(req:NextRequest):NextResponse|null {
  const origin=req.headers.get('origin')
  return origin && origin !== req.nextUrl.origin
    ? NextResponse.json({ error:'Cross-origin request denied' },{status:403}) : null
}
export async function requireStaff(role:'ADMIN'|'SECURITY'='SECURITY') {
  const staff=await verifyStaff()
  if (!staff || (role==='ADMIN' && staff.role!=='ADMIN')) return null
  return staff
}
export const noStore={'Cache-Control':'no-store, private'}
export const qrTokenPattern=/^[a-f0-9]{32}$/i

export async function resolveAuthorizedGuardian(
  db:ReturnType<typeof schoolDb>,
  claim: GuardianClaim,
):Promise<{matched:boolean;guardianId:string|null;studentId:string|null}> {
  // Lookup uses a narrow index and never returns enrolled identity data to the public caller.
  const {data:guardians,error}=await db.from('authorized_guardians')
    .select('id,full_name,contact_number,birth_date,address,active,verified_at')
    .eq('contact_number',claim.contactNumber)
    .eq('birth_date',claim.birthDate)
    .eq('active',true).limit(15)
  if(error)throw Error('Guardian registry unavailable')
  for(const guardian of guardians||[]) {
    if(!guardian.verified_at)continue
    const {data:links,error:linkError}=await db.from('student_guardians')
      .select('student_id,active,students(id,full_name,grade,section,active)')
      .eq('guardian_id',guardian.id).eq('active',true)
    if(linkError)throw Error('Guardian relationships unavailable')
    for(const link of links||[]) {
      const student=link.students as unknown as {
        id:string;full_name:string;grade:string;section:string;active:boolean
      } | null
      if(!student?.active)continue
      if(guardianDetailsMatch(claim,guardian as {full_name:string;contact_number:string;birth_date:string;address:string},student))
        return {matched:true,guardianId:guardian.id,studentId:student.id}
    }
  }
  return {matched:false,guardianId:null,studentId:null}
}
export async function revalidateGuardianRegistration(
  db:ReturnType<typeof schoolDb>,
  pr:{
    visitor_type:string;purpose:string;full_name:string;contact_number:string;
    guardian_birth_date:string|null;guardian_address:string|null;student_full_name:string|null;
    student_grade:string|null;student_section:string|null
  }
):Promise<boolean> {
  if(!requiresGuardianCheck(pr.visitor_type,pr.purpose))return true
  if(!pr.guardian_birth_date||!pr.guardian_address||!pr.student_full_name||!pr.student_grade||!pr.student_section)return false
  const result=await resolveAuthorizedGuardian(db,{
    fullName:pr.full_name,contactNumber:pr.contact_number,birthDate:pr.guardian_birth_date,
    address:pr.guardian_address,studentFullName:pr.student_full_name,
    studentGrade:pr.student_grade,studentSection:pr.student_section
  })
  return result.matched
}
export function safeText(input:unknown,min=2,max=200):string|null {
  if(typeof input!=='string')return null
  const value=input.trim().replace(/\s+/g,' ')
  return value.length>=min&&value.length<=max ? value : null
}
export function consentNotice(){
  return 'Your registration is pending security verification. The QR code is not entry approval.'
}
