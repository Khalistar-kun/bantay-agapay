/* Admin-only SMS diagnostics contract. Mocked transport; never sends a real SMS. */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const path=require('node:path')
const ts=require('typescript')
const crypto=require('crypto')
const file=fs.readFileSync(path.join(__dirname,'../app/api/admin/health/sms/route.ts'),'utf8')
const js=ts.transpileModule(file,{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
}}).outputText
const make=({role='ADMIN',enabled=true,gateway=true,limit=true,globalLimit=true,sendOk=true,secret=true}={})=>{
  const calls=[]
  const env={
    BA_SMS_TEST_ENABLED:enabled?'true':'false',BA_SMS_TEST_PHONE:'09170000000',
    BA_RATE_LIMIT_SECRET:secret?'fake-school-rate-secret-of-at-least-32-chars':'',TEXTBEE_DEVICE_ID:'fictionalDevice123'
  }
  const mocks={
    'next/server':{NextResponse:{json:(body,o={})=>({body,status:o.status||200})}},
    '@/lib/auth/verifyStaff':{verifyStaff:async()=>role?{role,profileId:'school-admin'}:null},
    '@/lib/server/client-compliance-db':{
      noStore:{'Cache-Control':'no-store'},
      schoolDb:()=>({rpc:async(name,args)=>{calls.push(['limitRpc',name,args.p_limit]);
        return{data:globalLimit,error:null}}})
    },
    '@/lib/server/rate-limit':{consumeRateLimit:async()=>{calls.push(['adminLimit']);return limit}},
    '@/lib/server/sms-gateway':{
      smsGatewayConfigured:()=>gateway,
      sendSchoolTestSms:async phone=>{calls.push(['send',phone]);return sendOk}
    }
  }
  const mod={exports:{}}
  vm.runInNewContext(js,{module:mod,exports:mod.exports,
    require:id=>mocks[id]||require(id),process:{env},crypto,Date,JSON,Buffer},
    {filename:'app/api/admin/health/sms/route.ts'})
  const request=(origin='https://school.example')=>({
    headers:{get:k=>k==='origin'?origin:null},nextUrl:{origin:'https://school.example'}
  })
  return{route:mod.exports,calls,request}
}
test('non-admin and unauthenticated staff cannot inspect or send SMS',async()=>{
  for(const role of [null,'SECURITY']){
    const c=make({role})
    assert.equal((await c.route.GET()).status,403)
    assert.equal((await c.route.POST(c.request())).status,403)
    assert.equal(c.calls.length,0)
  }
})
test('CSRF protection rejects absent or foreign Origin before sending',async()=>{
  const c=make()
  assert.equal((await c.route.POST(c.request(null))).status,403)
  assert.equal((await c.route.POST(c.request('https://attacker.invalid'))).status,403)
  assert.equal(c.calls.length,0)
})
test('diagnostics do not send anything on GET and expose only masked school handset',async()=>{
  const c=make()
  const status=await c.route.GET()
  assert.equal(status.status,200)
  assert.equal(status.body.ready,true)
  assert.equal(status.body.destination,'09*****0000')
  assert.equal(c.calls.length,0)
})
test('disabled test switch or missing gateway fails closed without sending',async()=>{
  for(const cfg of [{enabled:false},{gateway:false},{secret:false}]){
    const c=make(cfg)
    assert.equal((await c.route.GET()).body.ready,false)
    assert.equal((await c.route.POST(c.request())).status,503)
    assert.equal(c.calls.length,0)
  }
})
test('only configured school test handset receives explicitly triggered SMS',async()=>{
  const c=make()
  const result=await c.route.POST(c.request())
  assert.equal(result.status,200)
  assert.equal(result.body.queued,true)
  assert.equal(result.body.destination,'09*****0000')
  assert.deepEqual(c.calls.map(x=>x[0]),['adminLimit','limitRpc','send'])
  assert.deepEqual(c.calls.find(x=>x[0]==='send'),['send','09170000000'])
})
test('rate limits and provider failures do not falsely claim SMS was delivered',async()=>{
  for(const cfg of [{limit:false},{globalLimit:false},{sendOk:false}]){
    const c=make(cfg)
    const result=await c.route.POST(c.request())
    assert.notEqual(result.status,200)
    assert.notEqual(result.body.queued,true)
  }
})
test('SMS test is distinct from visitor OTP and uses no user-supplied number',()=>{
  assert.doesNotMatch(file,/req\.json\(|req\.text\(/)
  assert.match(file,/BA_SMS_TEST_PHONE/)
  assert.match(file,/BA_SMS_TEST_ENABLED/)
  assert.match(file,/sendSchoolTestSms\(phone\)/)
})
