const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const crypto=require('crypto')

function load(relative,stubs={},env={}){
  const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',relative),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
  }).outputText
  const mod={exports:{}}
  vm.runInNewContext(code,{module:mod,exports:mod.exports,
    require:name=>stubs[name]||require(name),
    process:{env},Date,Buffer,crypto,JSON,Number,Math,
    URL,console, setTimeout,clearTimeout},{filename:relative})
  return mod.exports
}
const token='a'.repeat(32)
const signingSecret='fictional-otp-secret-longer-than-32-characters'
function session(){
  return load('lib/server/location-session.ts',{},{
    BA_OTP_HMAC_SECRET:signingSecret
  })
}
function requestCookie(value){
  return{cookies:{get:name=>name==='ba_location_session'?{value}:undefined}}
}
test('QR token alone cannot authorize location; signed cookie matches only verified browser',()=>{
  const m=session(),cookie=m.locationSessionCookie(token)
  assert.equal(cookie.options.httpOnly,true)
  assert.equal(cookie.options.secure,true)
  assert.equal(cookie.options.sameSite,'lax')
  assert.equal(m.authorizedLocationSession(requestCookie(cookie.value),token),true)
  assert.equal(m.authorizedLocationSession(requestCookie(cookie.value),'b'.repeat(32)),false)
  assert.equal(m.authorizedLocationSession(requestCookie(''),token),false)
  assert.equal(m.authorizedLocationSession(requestCookie(cookie.value.slice(0,-2)+'aa'),token),false)
  assert.equal(m.authorizedLocationSession(requestCookie('v1.'+token+'.0000000000.'+'0'.repeat(64)),token),false)
})
test('location signature is domain-separated and fails closed when secret missing',()=>{
  const m=load('lib/server/location-session.ts',{},{
    BA_OTP_HMAC_SECRET:'short'
  })
  assert.throws(()=>m.locationSessionCookie(token),/not configured/)
  assert.equal(m.authorizedLocationSession(requestCookie(''),token),false)
})
test('staff sees coordinates only when recent, consented and accurate',()=>{
  const now=Date.now()
  const m=load('lib/server/location-presence.ts')
  const row=(age,sharing=true,accuracy=25)=>({
    location_sharing_enabled:sharing,current_latitude:14.7,current_longitude:120.9,
    location_accuracy_m:accuracy,location_updated_at:new Date(now-age*1000).toISOString()
  })
  assert.equal(m.visitorLocationPresence(row(10),now).location_status,'SHARING_ACTIVE')
  assert.equal(m.visitorLocationPresence(row(60),now).location_status,'DELAYED')
  const stale=m.visitorLocationPresence(row(130),now)
  assert.equal(stale.location_status,'STALE')
  assert.equal(stale.current_latitude,null)
  assert.equal(m.visitorLocationPresence(row(10,false),now).location_status,'NOT_SHARED')
  assert.equal(m.visitorLocationPresence(row(10,true,250),now).location_status,'LOW_ACCURACY')
  const waiting=m.visitorLocationPresence({...row(1),location_updated_at:null},now)
  assert.equal(waiting.location_status,'WAITING_FOR_GPS')
})
function makeRoute({authorized=true,admitted=true,inside=true,limit=true}={}){
  const row={
    id:'visit1',status:inside?'INSIDE':'EXITED',location_sharing_enabled:false,
    current_latitude:null,current_longitude:null,location_accuracy_m:null,
    location_updated_at:null
  }
  const mutations=[]
  const db={
    from(name){
      const filters=[],query={
        select(){return query},
        eq(key,value){filters.push([key,value]);return query},
        update(payload){query.pending=payload;return query},
        maybeSingle:async()=>{
          if(name==='pre_registrations'){
            return{data:{id:'pre1',status:admitted?'ADMITTED':'PRE_REGISTERED',
              visit_id:'visit1'},error:null}
          }
          if(name==='visits'){
            const match=filters.every(([key,value])=>row[key]===value)
            if(!match)return{data:null,error:null}
            if(query.pending){
              Object.assign(row,query.pending);mutations.push(query.pending)
            }
            return{data:{...row},error:null}
          }
          return{data:null,error:new Error('Unexpected table')}
        }
      }
      return query
    }
  }
  const mod=load('app/api/visit/location/route.ts',{
    'next/server':{NextResponse:{json:(body,config={})=>({status:config.status||200,body})}},
    '@/lib/server/client-compliance-db':{
      schoolDb:()=>db,noStore:{'Cache-Control':'no-store'},
      qrTokenPattern:/^[a-f0-9]{32}$/
    },
    '@/lib/server/location-session':{authorizedLocationSession:()=>authorized},
    '@/lib/server/rate-limit':{consumeRateLimit:async()=>limit}
  })
  const req=(action,rest={},origin='https://school.example')=>({
    headers:{get:key=>key==='origin'?origin:null},
    nextUrl:{origin:'https://school.example',searchParams:new URLSearchParams('token='+token)},
    text:async()=>JSON.stringify({action,token,...rest})
  })
  return{route:mod,req,row,mutations}
}
test('untrusted QR, cross-site requests and non-admitted visits cannot mutate location',async()=>{
  for(const cfg of [{authorized:false},{admitted:false},{inside:false}]){
    const h=makeRoute(cfg)
    assert.notEqual((await h.route.POST(h.req('start'))).status,200)
    assert.equal(h.mutations.length,0)
  }
  const h=makeRoute()
  assert.equal((await h.route.POST(h.req('start',{},null))).status,403)
  assert.equal(h.mutations.length,0)
})
test('visitor can opt in, report accurate GPS and stop with immediate erasure',async()=>{
  const h=makeRoute()
  assert.equal((await h.route.POST(h.req('start'))).status,200)
  assert.equal(h.row.location_sharing_enabled,true)
  const sent=await h.route.POST(h.req('update',{
    latitude:14.7,longitude:120.9,accuracy:25,measuredAt:Date.now()
  }))
  assert.equal(sent.status,200)
  assert.equal(sent.body.accepted,true)
  assert.equal(h.row.current_latitude,14.7)
  const stopped=await h.route.POST(h.req('stop'))
  assert.equal(stopped.status,200)
  assert.equal(h.row.location_sharing_enabled,false)
  assert.equal(h.row.current_latitude,null)
  assert.equal(h.row.location_updated_at,null)
  const replay=await h.route.POST(h.req('update',{
    latitude:14.7,longitude:120.9,accuracy:25,measuredAt:Date.now()
  }))
  assert.equal(replay.status,409)
})
test('invalid/old location, poor accuracy and abusive updates fail closed',async()=>{
  const h=makeRoute()
  await h.route.POST(h.req('start'))
  for(const payload of [
    {latitude:91,longitude:120.9,accuracy:25,measuredAt:Date.now()},
    {latitude:14.7,longitude:120.9,accuracy:900,measuredAt:Date.now()},
    {latitude:14.7,longitude:120.9,accuracy:25,measuredAt:Date.now()-120000}
  ])assert.equal((await h.route.POST(h.req('update',payload))).status,422)
  const blocked=makeRoute({limit:false})
  assert.equal((await blocked.route.POST(blocked.req('start'))).status,429)
  assert.equal(blocked.mutations.length,0)
})
test('legacy anonymous QR position writer is removed from the visitor page',()=>{
  const legacy=fs.readFileSync(path.join(__dirname,'../app/visit/status/[token]/page.tsx'),'utf8')
  const pass=fs.readFileSync(path.join(__dirname,'../app/pass/[token]/page.tsx'),'utf8')
  assert.doesNotMatch(legacy,/\.rpc\("update_visit_location"/)
  assert.match(pass,/<LocationSharing token=\{token\}\/>/)
})
