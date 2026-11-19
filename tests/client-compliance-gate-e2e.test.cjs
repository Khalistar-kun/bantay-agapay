/* Isolated mock-backed school gate lifecycle. No live student or school data.
 * This tests the Next.js route contracts; real PostgreSQL/RLS needs separate staging. */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const crypto=require('crypto')
const root=path.join(__dirname,'..')
function transpile(pathname,stubs){
 const js=ts.transpileModule(fs.readFileSync(path.join(root,pathname),'utf8'),{
   compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
 }).outputText
 const module={exports:{}}
 vm.runInNewContext(js,{module,exports:module.exports,require:id=>stubs[id]||require(id),
   Buffer,Blob,Date,Math,Number,JSON,URL,URLSearchParams,Intl,crypto,console,
   process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://fake.supabase.test',SUPABASE_SERVICE_ROLE_KEY:'fake',
    BA_OTP_HMAC_SECRET:'dev-test-secret-'.repeat(4)}}}, {filename:pathname})
 return module.exports
}
const compliance=transpile('lib/client-compliance.ts',{})
const token='b'.repeat(32)
const guardianId='8ed0f38e-cc31-42a2-876d-e2c682baf0d0'
const studentId='b07c6fb0-e772-4775-9a4a-153a0843799e'
const destId='56a29c99-b729-4b8e-96cb-62ce1185802a'
const prId='83706e96-f1e2-4c43-977e-4c99352c7073'
const photo=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(130)])
const photoInput='data:image/jpeg;base64,'+photo.toString('base64')
const origin='https://bantay-test.school.example'

function setup({guardian=true,match=true,biometric='MATCH'}={}){
 const dest={id:destId,name:'Faculty Office',building:'Building 1',active:true}
 const tables={
  pre_registrations:[],visits:[],visitors:[],security_incidents:[],
  audit_logs:[],identity_verification_attempts:[],
  destinations:[dest],authorized_guardians:[{
    id:guardianId,reference_photo_path:'reference.jpg',active:true,verified_at:'2026-11-17'
  }],
 }
 const cfg={role:'SECURITY',matched:match,provider:{status:biometric,confidence:biometric==='MATCH'?.991:null,modelVersion:'school-approved-mock-1'},calls:[],proofUsed:false}
 const qb=(table)=>{
  const filters=[],opts={};let mutation='select',payload
  const rows=tables[table]||[]
  const q={
    select(_fields,options){if(options)Object.assign(opts,options);return q},
    eq(k,v){filters.push(r=>r[k]===v);return q},
    gte(k,v){filters.push(r=>r[k]>=v);return q},
    in(k,values){filters.push(r=>values.includes(r[k]));return q},
    order(){return q},limit(){return q},
    insert(v){mutation='insert';payload=v;return q},
    update(v){mutation='update';payload=v;return q},
    delete(){mutation='delete';return q},
    maybeSingle:async()=>{const r=execute();return {data:r.data?.[0]||null,error:r.error}},
    single:async()=>{const r=execute();return {data:r.data?.[0]||null,error:r.error}},
    then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject)}
  }
  function execute(){
   const matching=rows.filter(r=>filters.every(f=>f(r)))
   if(mutation==='select')return {data:opts.head?null:matching,error:null,count:matching.length}
   if(mutation==='insert'){
    const adds=(Array.isArray(payload)?payload:[payload]).map(r=>({...r,id:r.id||crypto.randomUUID()}))
    rows.push(...adds);return{data:adds,error:null}
   }
   if(mutation==='update'){matching.forEach(r=>Object.assign(r,payload));return{data:matching,error:null}}
   if(mutation==='delete'){matching.forEach(r=>rows.splice(rows.indexOf(r),1));return{data:matching,error:null}}
   return{error:new Error('Unknown query operation')}
  }
  return q
 }
 const db={
  from:qb,
  storage:{from:()=>({
    upload:async(path)=>({data:{path},error:null}),
    download:async()=>({data:new Blob([photo]),error:null}),
    createSignedUrl:async(path)=>({data:{signedUrl:'https://signed.test/'+path},error:null}),
    remove:async()=>({error:null})
  })},
  async rpc(method,args){
   cfg.calls.push(method)
   if(method==='consume_phone_verification'){
    const h=(v)=>crypto.createHmac('sha256','dev-test-secret-'.repeat(4)).update(v).digest('hex')
    const match=args.p_proof_hash===h('proof|'+'d'.repeat(64)) &&
      args.p_phone_hash===h('phone|'+'09170000000')
    if(!match||cfg.proofUsed)return {data:false,error:null}
    cfg.proofUsed=true
    return {data:true,error:null}
   }
   if(method==='admit_pre_registration'){
    const p=tables.pre_registrations.find(x=>x.id===args.p_id)
    if(!p||p.status!=='PRE_REGISTERED'||p.photo_review_status!=='PASSED'||
      (compliance.requiresGuardianCheck(p.visitor_type,p.purpose)&&
        (p.biometric_status!=='MATCH'||p.guardian_details_status!=='MATCH')))
      return{data:null,error:new Error('Admission refused')}
    const visitId=crypto.randomUUID()
    p.status='ADMITTED';p.visit_id=visitId
    tables.visits.push({id:visitId,public_token:p.public_token,status:'INSIDE',approved_by:args.p_staff_id,check_in:new Date().toISOString()})
    return{data:[{visit_id:visitId,visitor_name:p.full_name}],error:null}
   }
   if(method==='checkout_pre_registration'){
    const p=tables.pre_registrations.find(x=>x.id===args.p_id)
    const v=tables.visits.find(x=>x.id===p?.visit_id)
    if(!p||p.status!=='ADMITTED'||!v||v.status!=='INSIDE')
      return{data:null,error:new Error('Duplicate checkout')}
    p.status='EXITED';v.status='EXITED';v.checked_out_by=args.p_staff_id
    v.check_out=new Date().toISOString()
    return{data:[{visitor_name:p.full_name}],error:null}
   }
   return{data:null,error:new Error('Unknown rpc')}
  }
 }
 const server={
  schoolDb:()=>db,
  requireStaff:async()=>cfg.role?{profileId:'staff-test',role:cfg.role}:null,
  denyCrossOrigin:req=>req.headers.get('origin')===req.nextUrl.origin?null:{status:403,body:{error:'CSRF'}},
  qrTokenPattern:/^[a-f0-9]{32}$/i,
  noStore:{},consentNotice:()=> 'Not entry approval',
  safeText:(v,min=2,max=200)=>typeof v==='string'&&v.trim().length>=min&&v.trim().length<=max?v.trim():null,
  resolveAuthorizedGuardian:async()=>({matched:cfg.matched,guardianId:cfg.matched?guardianId:null,studentId:cfg.matched?studentId:null}),
  revalidateGuardianRegistration:async()=>cfg.matched
 }
 const mocks={
  'next/server':{NextResponse:{json:(body,opt={})=>({body,status:opt.status||200})}},
  '@/lib/server/client-compliance-db':server,
  '@/lib/client-compliance':compliance,
  '@/lib/server/rate-limit':{consumeRateLimit:async()=>true},
  '@/lib/server/sms-gateway':{smsGatewayConfigured:()=>true},
  '@/lib/server/location-session':{locationSessionCookie:()=>({name:'test',value:'signed',options:{}})},
  '@/lib/biometrics/face-comparator':{compareEnrolledFaces:async()=>cfg.provider}
 }
 const pre=transpile('app/api/pre-register/route.ts',mocks)
 const gate=transpile('app/api/security/gate/route.ts',mocks)
 const request=(body=null,params={})=>({
  headers:{get:key=>key==='origin'?origin:null},nextUrl:{
    origin,searchParams:new URLSearchParams(params)},
  text:async()=>JSON.stringify(body),json:async()=>body
 })
 const register=async(d)=>{
  const res=await pre.POST(request(d))
  if(res.status!==201)return res
  const p=tables.pre_registrations[tables.pre_registrations.length-1]
  // The POST body never reveals whether a child's details matched.
  return{...res,record:p}
 }
 const defaultForm={
  fullName:'Fictional Visitor',contactNumber:'09170000000',
  visitorType:guardian?'Parent':'Guest',
  purpose:guardian?'Child Emergency':'Teacher Appointment',
  destinationId:destId,facePhoto:photoInput,privacyConsent:true,
  verificationToken:'d'.repeat(64),
  birthDate:'1980-01-01',address:'Fictional School Address',
  studentName:'Fictional Child',studentGrade:'8',studentSection:'Rizal'
 }
 return{tables,cfg,request,register,defaultForm,gate,pre}
}
test('guest can pre-register at home, save QR, then get checked in and out once',async()=>{
 const x=setup({guardian:false})
 const registered=await x.register(x.defaultForm)
 assert.equal(registered.status,201)
 assert.equal(x.tables.visits.length,0,'preregister does not count as campus entry')
 const p=registered.record
 assert.equal(p.status,'PRE_REGISTERED')
 assert.equal(p.biometric_status,'NOT_REQUIRED')
 const pass=await x.pre.GET(x.request(null,{token:p.public_token}))
 assert.equal(pass.status,200)
 assert.equal(pass.body.pass.status,'PRE_REGISTERED')
 const review=await x.gate.POST(x.request({token:p.public_token,action:'review-photo',decision:'PASSED'}))
 assert.equal(review.status,200)
 const approved=await x.gate.POST(x.request({token:p.public_token,action:'approve'}))
 assert.equal(approved.status,200)
 assert.equal(x.tables.visits[0].status,'INSIDE')
 const checkout=await x.gate.POST(x.request({token:p.public_token,action:'checkout'}))
 assert.equal(checkout.status,200)
 assert.equal(x.tables.visits[0].status,'EXITED')
 assert.equal(x.tables.visits[0].checked_out_by,'staff-test')
 const duplicate=await x.gate.POST(x.request({token:p.public_token,action:'checkout'}))
 assert.equal(duplicate.status,409)
 assert.equal(x.tables.visits.length,1)
 assert.equal(x.tables.security_incidents.length,1)
});
test('guardian requires biometric comparison, manual review and authorized detail match',async()=>{
 const x=setup({guardian:true})
 const registered=await x.register(x.defaultForm)
 assert.equal(registered.status,201)
 const p=registered.record
 assert.equal(p.guardian_details_status,'MATCH')
 assert.equal(p.biometric_status,'PENDING')
 assert.equal((await x.gate.POST(x.request({token:p.public_token,action:'approve'}))).status,403)
 const compare=await x.gate.POST(x.request({token:p.public_token,action:'compare-face'}))
 assert.equal(compare.status,200)
 assert.equal(compare.body.status,'MATCH')
 assert.equal((await x.gate.POST(x.request({
  token:p.public_token,action:'review-photo',decision:'PASSED',referenceReviewed:false
 }))).status,422)
 assert.equal((await x.gate.POST(x.request({
  token:p.public_token,action:'review-photo',decision:'PASSED',referenceReviewed:true
 }))).status,200)
 assert.equal((await x.gate.POST(x.request({token:p.public_token,action:'approve'}))).status,200)
 assert.equal(x.tables.visits.length,1)
 assert.equal(x.tables.visits[0].status,'INSIDE')
 assert.deepEqual(x.cfg.calls,['consume_phone_verification','admit_pre_registration'])
});
test('guardian data mismatch cannot be approved, even with a saved QR',async()=>{
 const x=setup({guardian:true,match:false})
 const registered=await x.register(x.defaultForm)
 assert.equal(registered.status,201)
 const p=registered.record
 assert.equal(p.status,'NEEDS_REVIEW')
 assert.equal(p.guardian_details_status,'MISMATCH')
 assert.equal(x.tables.visits.length,0)
 assert.equal((await x.gate.POST(x.request({token:p.public_token,action:'approve'}))).status,409)
 assert.equal(x.tables.visits.length,0)
});
test('provider biometrics NO_MATCH blocks admission and creates review case',async()=>{
 const x=setup({guardian:true,biometric:'NO_MATCH'})
 const p=(await x.register(x.defaultForm)).record
 const result=await x.gate.POST(x.request({token:p.public_token,action:'compare-face'}))
 assert.equal(result.status,200)
 assert.equal(result.body.status,'NO_MATCH')
 assert.equal(p.status,'NEEDS_REVIEW')
 assert.equal((await x.gate.POST(x.request({token:p.public_token,action:'approve'}))).status,409)
 assert.equal(x.tables.visits.length,0)
 assert.equal(x.tables.security_incidents.length,1)
});
test('unverified security login cannot look up private guardian identity',async()=>{
 const x=setup()
 const p=(await x.register(x.defaultForm)).record
 x.cfg.role=null
 assert.equal((await x.gate.GET(x.request(null,{token:p.public_token}))).status,401)
 assert.equal((await x.gate.POST(x.request({token:p.public_token,action:'approve'}))).status,401)
});

test('missing or reused SMS proof cannot create a second visitor pre-registration',async()=>{
 const x=setup({guardian:false})
 const unverified=await x.register({...x.defaultForm,verificationToken:''})
 assert.equal(unverified.status,403)
 assert.equal(x.tables.pre_registrations.length,0)
 assert.equal((await x.register(x.defaultForm)).status,201)
 assert.equal((await x.register(x.defaultForm)).status,403)
 assert.equal(x.tables.pre_registrations.length,1)
});
