/* Client compliance regression tests. No real school/student records or Supabase writes. */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const root=path.resolve(__dirname,'..')
const source=p=>fs.readFileSync(path.join(root,p),'utf8')
function moduleAt(file,stubs={}){
 const js=ts.transpileModule(source(file),{compilerOptions:{
   module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
 }}).outputText
 const mod={exports:{}}
 const env={NEXT_PUBLIC_SUPABASE_URL:'https://fake.supabase.test',SUPABASE_SERVICE_ROLE_KEY:'fake-key'}
 vm.runInNewContext(js,{module:mod,exports:mod.exports,require:id=>stubs[id]||(id==='@/lib/biometrics/face-comparator'
  ?{compareEnrolledFaces:async()=>({status:'ERROR',confidence:null,modelVersion:null})}
  :id==='@/lib/server/rate-limit'?{consumeRateLimit:async()=>true}:require(id)),
   process:{env},Number,JSON,Date,Buffer,URL,console,Math,Intl},
   {filename:file})
 return mod.exports
}
const compliance=moduleAt('lib/client-compliance.ts')
const req=body=>({
 headers:{get:()=>null},nextUrl:{origin:'https://test.school',searchParams:new URLSearchParams()},
 json:async()=>body,text:async()=>JSON.stringify(body)
})
const next={NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers})}}
const guardian={
 full_name:'Maria A. Santos',contact_number:'09170000000',
 birth_date:'1984-04-02',address:'Barangay One, Meycauayan'
}
const student={full_name:'Ana Santos',grade:'7',section:'Rizal'}
const claim={
 fullName:'  MARIA   A. SANTOS ',contactNumber:'09170000000',
 birthDate:'1984-04-02',address:'Barangay One Meycauayan',
 studentFullName:'Ana Santos',studentGrade:'7',studentSection:'Rizal'
}
test('guardian data match normalizes harmless formatting but blocks any actual field mismatch',()=>{
 assert.equal(compliance.guardianDetailsMatch(claim,guardian,student),true)
 for(const bad of [
  {...claim,contactNumber:'09170000001'},
  {...claim,birthDate:'1984-04-03'},
  {...claim,address:'Different Street'},
  {...claim,studentGrade:'8'},
  {...claim,studentSection:'Dahlia'},
  {...claim,studentFullName:'Another Child'}
 ])assert.equal(compliance.guardianDetailsMatch(bad,guardian,student),false)
})
test('child-related purpose always requires authorized guardian status, even if visitor selects Guest',()=>{
 assert.equal(compliance.requiresGuardianCheck('Guest','Child Emergency'),true)
 assert.equal(compliance.requiresGuardianCheck('Other','Visit Student'),true)
 assert.equal(compliance.requiresGuardianCheck('Parent','Teacher Appointment'),false)
})
test('birthday and age are derived and reject impossible dates',()=>{
 assert.equal(compliance.validDate('2023-02-29'),false)
 assert.equal(compliance.validDate('1984-02-29'),true)
 assert.equal(compliance.ageOn('2000-11-18',new Date('2026-11-17T00:00:00Z')),25)
 assert.equal(compliance.ageOn('2000-11-17',new Date('2026-11-17T00:00:00Z')),26)
})
test('registration rejects claiming student emergency as an unverified visitor type',async()=>{
 const route=moduleAt('app/api/pre-register/route.ts',{
  'next/server':next,
  '@/lib/client-compliance':compliance,
  '@/lib/server/client-compliance-db':{
   denyCrossOrigin:()=>null,
   schoolDb:()=>{throw Error('Must reject before database access')},
   safeText:x=>typeof x==='string'?x.trim():null,
   noStore:{},consentNotice:()=>'',qrTokenPattern:/^[a-f0-9]{32}$/,
   resolveAuthorizedGuardian:()=>{throw Error('Should not reach')}
  }
 })
 const sample=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(128)]).toString('base64')
 const body={
  fullName:'Fictional Visitor',contactNumber:'09170000000',visitorType:'Guest',
  purpose:'Child Emergency',destinationId:'c1d74422-21b1-4834-9a87-10f70ee345c2',
  facePhoto:'data:image/jpeg;base64,'+sample,privacyConsent:true
 }
 const result=await route.POST(req(body))
 assert.equal(result.status,400)
 assert.match(result.body.error,/Parent or Guardian/)
})
test('security gate returns unauthorized before reading private registration data',async()=>{
 const route=moduleAt('app/api/security/gate/route.ts',{
  'next/server':next,
  '@/lib/server/client-compliance-db':{
    requireStaff:async()=>null,
    schoolDb:()=>{throw Error('No access')},
    denyCrossOrigin:()=>null,
    qrTokenPattern:/^[a-f0-9]{32}$/,noStore:{},
    revalidateGuardianRegistration:async()=>false,safeText:x=>x
  },
  '@/lib/client-compliance':compliance
 })
 assert.equal((await route.GET(req(null))).status,401)
 assert.equal((await route.POST(req({token:'a'.repeat(32),action:'approve'}))).status,401)
})
test('security gate blocks guardian mismatch without invoking admission transaction',async()=>{
 let rpcCalls=0,incidents=0
 const prereg={id:'00000000-0000-4000-8000-000000000002',
   full_name:'Fictional Guardian',contact_number:'09170000000',visitor_type:'Parent',
   purpose:'Child Emergency',guardian_birth_date:'1980-01-01',guardian_address:'Address',
   student_full_name:'Fictional Child',student_grade:'8',student_section:'A',
   guardian_details_status:'MISMATCH',photo_review_status:'PASSED',
   status:'PRE_REGISTERED',expires_at:'2099-01-01T00:00:00Z'}
 const db={
  from(table){
   if(table==='pre_registrations')return {select(){return this},eq(){return this},
      maybeSingle:async()=>({data:prereg,error:null})}
   return {insert:async()=>{incidents++;return{error:null}}}
  },rpc(){rpcCalls++;throw Error('Admission must not run')}
 }
 const route=moduleAt('app/api/security/gate/route.ts',{
  'next/server':next,
  '@/lib/server/client-compliance-db':{
   requireStaff:async()=>({profileId:'staff-test',role:'SECURITY'}),
   schoolDb:()=>db,denyCrossOrigin:()=>null,
   qrTokenPattern:/^[a-f0-9]{32}$/,noStore:{},
   revalidateGuardianRegistration:async()=>false,safeText:x=>x
  },
  '@/lib/client-compliance':compliance
 })
 const result=await route.POST(req({token:'a'.repeat(32),action:'approve'}))
 assert.equal(result.status,403)
 assert.equal(rpcCalls,0)
 assert.equal(incidents,1)
})
test('photo review for a guardian requires explicit reference-image review',async()=>{
 const prereg={id:'00000000-0000-4000-8000-000000000002',visitor_type:'Parent',
 purpose:'Child Emergency',status:'PRE_REGISTERED'}
 const db={from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:prereg,error:null})})}
 const gate=moduleAt('app/api/security/gate/route.ts',{
  'next/server':next,
  '@/lib/server/client-compliance-db':{
   requireStaff:async()=>({profileId:'staff',role:'SECURITY'}),
   schoolDb:()=>db,denyCrossOrigin:()=>null,qrTokenPattern:/^[a-f0-9]{32}$/,noStore:{},
   revalidateGuardianRegistration:async()=>true,safeText:x=>x
  },
  '@/lib/client-compliance':compliance
 })
 const result=await gate.POST(req({token:'a'.repeat(32),action:'review-photo',decision:'PASSED',referenceReviewed:false}))
 assert.equal(result.status,422)
})
test('SQL schema prevents anonymous reads of minor records and handles gate entry/exit atomically',()=>{
 const sql=source('supabase/migrations/10_client_guardian_preregistration.sql')
 for(const table of ['students','authorized_guardians','student_guardians','pre_registrations','identity_verification_attempts','security_incidents']){
   assert.match(sql,new RegExp('ALTER TABLE public\\.'+table+' ENABLE ROW LEVEL SECURITY;'))
 }
 assert.match(sql,/REVOKE ALL ON TABLE public\.students,[\s\S]* FROM anon,authenticated;/)
 assert.match(sql,/SECURITY DEFINER SET search_path = ''/)
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.admit_pre_registration\(uuid,uuid\) FROM PUBLIC,anon,authenticated;/)
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.checkout_pre_registration\(uuid,uuid\) FROM PUBLIC,anon,authenticated;/)
 assert.match(sql,/FOR UPDATE/)
 assert.match(sql,/photo_review_status <> 'PASSED'/)
 assert.match(sql,/pr.biometric_status <> 'MATCH'/)
 assert.match(sql,/guardian_details_status <> 'MATCH'/)
 assert.match(sql,/checked_out_by=p_staff_id/)
})
test('offline QR presentation never counts as approved campus entry',()=>{
 const prereg=source('app/api/pre-register/route.ts')
 const gate=source('app/api/security/gate/route.ts')
 const pass=source('app/pass/[token]/page.tsx')
 assert.match(prereg,/status:'PRE_REGISTERED'/)
 assert.doesNotMatch(prereg,/\.from\('visits'\)\.insert/)
 assert.match(gate,/\.rpc\('admit_pre_registration'/)
 assert.match(pass,/Save QR Image for Offline Use/)
 assert.match(pass,/PRE_REGISTERED/)
})
test('legacy returning identity cannot be claimed with a known phone number alone',()=>{
 const r=source('app/api/visit/returning/route.ts')
 const p=source('app/visit/returning/page.tsx')
 assert.match(r,/status:410/)
 assert.match(p,/pre-register\?returning=1/)
 assert.doesNotMatch(r,/face_reference_path/)
})


test('faculty directory hides unpublished staff offices and uses restricted staff-only CRUD',()=>{
 const sql=source('supabase/migrations/10_client_guardian_preregistration.sql')
 const pub=source('app/api/faculty-directory/route.ts')
 const admin=source('app/api/admin/faculty-directory/route.ts')
 const form=source('app/pre-register/page.tsx')
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.faculty_directory/)
 assert.match(sql,/ALTER TABLE public\.faculty_directory ENABLE ROW LEVEL SECURITY/)
 assert.match(pub,/eq\('public_visible',true\)/)
 assert.match(admin,/requireStaff\('ADMIN'\)/)
 assert.match(form,/Search teacher name/)
})
test('guardian ordinary gate approval needs separately approved face match',()=>{
 const code=source('app/api/security/gate/route.ts')
 assert.match(code,/biometricReady/)
 assert.match(code,/pr\.biometric_status==='MATCH'/)
 assert.match(code,/compareEnrolledFaces/)
 const ui=source('app/security/gate/page.tsx')
 assert.match(ui,/Run Approved Face Comparison/)
 assert.match(ui,/biometricStatus==="MATCH"/)
})


test('school privacy request register is admin-only and deletion cannot be silently marked resolved',()=>{
 const sql=source('supabase/migrations/10_client_guardian_preregistration.sql')
 const privacy=source('app/api/admin/privacy/route.ts')
 const ui=source('app/admin/privacy/page.tsx')
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.privacy_requests/)
 assert.match(sql,/ALTER TABLE public\.privacy_requests ENABLE ROW LEVEL SECURITY/)
 assert.match(privacy,/requireStaff\('ADMIN'\)/)
 assert.match(privacy,/Deletion requests need separately validated erasure evidence/)
 assert.match(ui,/Automatic erasure is/)
});
