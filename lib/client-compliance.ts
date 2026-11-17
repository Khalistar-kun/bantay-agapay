/** Shared input parsing and matching policy. This is a fail-closed data match, not face recognition. */
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const PHONE = /^09\d{9}$/
export const PURPOSES = ['Child Emergency','Visit Student','Teacher Appointment','School Business','Delivery','Other'] as const
export const VISITOR_TYPES = ['Parent','Guardian','Guest','Alumni','Supplier','Government','Other'] as const

export function normalizedWords(input: string): string {
  return input.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-PH')
}
export function normalizedAddress(input: string): string {
  return normalizedWords(input).replace(/[.,#]/g,'').replace(/\s+/g,' ')
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year,month,day] = value.split('-').map(Number)
  const d = new Date(Date.UTC(year,month-1,day))
  return d.getUTCFullYear() === year && d.getUTCMonth() === month-1 && d.getUTCDate() === day &&
    d.getTime() <= Date.now() && year >= 1900
}
export function ageOn(birthday: string, reference=new Date()): number | null {
  if (!validDate(birthday)) return null
  const [y,m,d]=birthday.split('-').map(Number)
  const age=reference.getUTCFullYear()-y-
    (reference.getUTCMonth()+1 < m || (reference.getUTCMonth()+1===m && reference.getUTCDate()<d)?1:0)
  return age >= 0 && age <= 130 ? age : null
}
export type GuardianClaim = {
  fullName:string; contactNumber:string; birthDate:string; address:string;
  studentFullName:string; studentGrade:string; studentSection:string
}
export function guardianDetailsMatch(claim:GuardianClaim, record:{
  full_name:string;contact_number:string;birth_date:string;address:string;
}, student:{full_name:string;grade:string;section:string}):boolean {
  return normalizedWords(claim.fullName)===normalizedWords(record.full_name) &&
    claim.contactNumber===record.contact_number && claim.birthDate===record.birth_date &&
    normalizedAddress(claim.address)===normalizedAddress(record.address) &&
    normalizedWords(claim.studentFullName)===normalizedWords(student.full_name) &&
    normalizedWords(claim.studentGrade)===normalizedWords(student.grade) &&
    normalizedWords(claim.studentSection)===normalizedWords(student.section)
}
export function requiresGuardianCheck(_visitorType:string,purpose:string):boolean {
  // All child-related access requires a school-verified guardian relationship.
  // Visitors cannot escape student verification by selecting "Guest" instead of "Parent".
  return purpose==='Child Emergency' || purpose==='Visit Student'
}
export function parsePhoto(input:unknown):Buffer|null {
  if(typeof input!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(input))return null
  const raw=input.slice('data:image/jpeg;base64,'.length)
  if(raw.length>700000)return null
  const bytes=Buffer.from(raw,'base64')
  if(bytes.length<100||bytes.length>512000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return null
  return bytes
}
