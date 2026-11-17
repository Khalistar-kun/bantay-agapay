const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const crypto=require('crypto')
const source=fs.readFileSync(path.join(__dirname,'../app/api/returning/otp/route.ts'),'utf8')
const js=ts.transpileModule(source,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText
const phone='09170000000', origin='https://school.example'
function context({found=true,configured=true,rateAllowed=true}={}){
 const rows={
  visitors:found?[{id:'v1',full_name:'Sample Visitor',visitor_type:'Guest',contact_number:phone,
   created_at:'2026-11-17T00:00:00Z'}]:[],
  returning_otp_challenges:[]
 }
 const sent=[]
 let called=0
 const db={from(table){
  const a=rows[table],filters=[]
  let operation='select',changes=null,orderKey='',desc=false,limit=1000
  const q={
   select(){return q},
   eq(k,v){filters.push(x=>x[k]===v);return q},
   is(k,v){filters.push(x=>x[k]===v);return q},
   gte(k,v){filters.push(x=>x[k]>=v);return q},
   lt(k,v){filters.push(x=>x[k]<v);return q},
   order(k,o){orderKey=k;desc=o?.ascending===false;return q},
   limit(n){limit=n;return q},
   update(x){operation='update';changes=x;return q},
   insert(x){operation='insert';changes=x;return q},
   delete(){operation='delete';return q},
   maybeSingle:async()=>{const d=execute();return {data:d.data?.[0]||null,error:d.error}},
   then(ok,bad){return Promise.resolve(execute()).then(ok,bad)}
  }
  function execute(){
   let result=(a||[]).filter(x=>filters.every(f=>f(x)))
   if(orderKey)result=[...result].sort((x,y)=>String(x[orderKey]).localeCompare(String(y[orderKey]))*(desc?-1:1))
   result=result.slice(0,limit)
   if(operation==='insert'){const row={attempts:0,consumed_at:null,created_at:new Date().toISOString(),...changes};a.push(row);return{data:[row],error:null}}
   if(operation==='delete'){result.forEach(x=>a.splice(a.indexOf(x),1));return{data:result,error:null}}
   if(operation==='update'){result.forEach(x=>Object.assign(x,changes));return{data:result,error:null}}
   return{data:result,error:null}
  }
  return q
 }}
 const json=(body,opts={})=>({body,status:opts.status||200})
 const stubs={
  'next/server':{NextResponse:{json}},
  '@/lib/server/client-compliance-db':{
   schoolDb:()=>db,noStore:{},
   denyCrossOrigin:r=>r.headers.get('origin')===r.nextUrl.origin?null:json({error:'Cross-origin'}, {status:403})
  },
  '@/lib/client-compliance':{PHONE:/^09\d{9}$/},
  '@/lib/server/rate-limit':{consumeRateLimit:async()=>rateAllowed},
  '@/lib/server/sms-gateway':{
   smsGatewayConfigured:()=>configured,
   sendReturningOtp:async(p,c)=>{sent.push({phone:p,code:c});return true}
  }
 }
 const module={exports:{}}
 vm.runInNewContext(js,{module,exports:module.exports,require:id=>stubs[id]||require(id),
  process:{env:{BA_OTP_HMAC_SECRET:'secret-'.repeat(8)}},Date,Buffer,JSON,URL,crypto,console},
  {filename:'app/api/returning/otp/route.ts'})
 return{rows,sent,
  request:body=>({headers:{get:key=>key==='origin'?origin:null},nextUrl:{origin},
   text:async()=>JSON.stringify(body)}),
  post:module.exports.POST,
  get calls(){return called}
 }
}
test('returning visitor receives a one-time SMS, stores only hashed contact and code',async()=>{
 const c=context()
 const r=await c.post(c.request({action:'request',contactNumber:phone}))
 assert.equal(r.status,200)
 assert.equal(c.sent.length,1)
 assert.equal(c.sent[0].phone,phone)
 assert.match(c.sent[0].code,/^\d{6}$/)
 const row=c.rows.returning_otp_challenges[0]
 assert.match(row.phone_hash,/^[a-f0-9]{64}$/)
 assert.match(row.code_hash,/^[a-f0-9]{64}$/)
 assert.doesNotMatch(JSON.stringify(row),new RegExp(phone))
 assert.doesNotMatch(JSON.stringify(row),new RegExp(c.sent[0].code))
 assert.ok(new Date(row.expires_at).getTime()>Date.now())
})
test('valid OTP returns only minimal visitor prefill and cannot be reused',async()=>{
 const c=context()
 await c.post(c.request({action:'request',contactNumber:phone}))
 const verified=await c.post(c.request({action:'verify',contactNumber:phone,code:c.sent[0].code}))
 assert.equal(verified.status,200)
 assert.equal(verified.body.verified,true)
 assert.equal(verified.body.profile.fullName,'Sample Visitor')
 assert.equal(verified.body.profile.visitorType,'Guest')
 assert.equal(verified.body.profile.studentName,undefined)
 assert.equal(verified.body.profile.facePhoto,undefined)
 assert.ok(c.rows.returning_otp_challenges[0].consumed_at)
 const replay=await c.post(c.request({action:'verify',contactNumber:phone,code:c.sent[0].code}))
 assert.equal(replay.status,401)
})
test('five incorrect codes block even a subsequently correct code',async()=>{
 const c=context()
 await c.post(c.request({action:'request',contactNumber:phone}))
 const correct=c.sent[0].code
 const wrong=correct==='000000'?'999999':'000000'
 for(let i=0;i<5;i++){
  const r=await c.post(c.request({action:'verify',contactNumber:phone,code:wrong}))
  assert.equal(r.status,401)
 }
 const r=await c.post(c.request({action:'verify',contactNumber:phone,code:correct}))
 assert.equal(r.status,401)
})
test('unknown phone number receives generic response with no identity lookup details',async()=>{
 const c=context({found:false})
 const r=await c.post(c.request({action:'request',contactNumber:phone}))
 assert.equal(r.status,200)
 assert.match(r.body.message,/If this number/)
 assert.equal(c.sent.length,0)
})
test('SMS gateway unavailable returns an error without creating an OTP or claiming delivery',async()=>{
 const c=context({configured:false})
 const r=await c.post(c.request({action:'request',contactNumber:phone}))
 assert.equal(r.status,503)
 assert.equal(c.rows.returning_otp_challenges.length,0)
})
test('rate limiting denies OTP spam before creating records',async()=>{
 const c=context({rateAllowed:false})
 const r=await c.post(c.request({action:'request',contactNumber:phone}))
 assert.equal(r.status,429)
 assert.equal(c.sent.length,0)
})
test('OTP does not skip the separate camera, student and gate authorization workflow',()=>{
 const page=fs.readFileSync(path.join(__dirname,'../app/pre-register/page.tsx'),'utf8')
 const endpoint=source
 assert.match(page,/Verify Code & Prefill Information/)
 assert.match(page,/<FaceDetection key=/)
 assert.match(endpoint,/A fresh face scan and security gate verification/)
 assert.doesNotMatch(endpoint,/face_reference_path|guardian_address|student_full_name/)
})
test('guardian SMS challenge data is private and anonymous clients have no table grants',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/11_returning_visitor_otp.sql'),'utf8')
 assert.match(sql,/ALTER TABLE public\.returning_otp_challenges ENABLE ROW LEVEL SECURITY/)
 assert.match(sql,/REVOKE ALL ON TABLE public\.returning_otp_challenges FROM anon, authenticated/)
})
