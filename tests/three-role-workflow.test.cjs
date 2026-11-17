/* Role workflow regression using fictitious records and local route stubs.
 * No live school database or real visitor data are accessed. */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')

function read(file){return fs.readFileSync(path.join(__dirname,'..',file),'utf8')}
function route(file,modules){
  const code=ts.transpileModule(read(file),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true
  }}).outputText
  const mod={exports:{}}
  vm.runInNewContext(code,{module:mod,exports:mod.exports,
    require:key=>modules[key]||require(key),process:{env:{
      NEXT_PUBLIC_SUPABASE_URL:'https://fictitious.supabase.test',
      SUPABASE_SERVICE_ROLE_KEY:'fake-test-service-key'
    }},Date,JSON,console},
    {filename:file})
  return mod.exports
}
const req=(body)=>({
  headers:{get:k=>k==='origin'?'https://test.school.example':null},
  nextUrl:{origin:'https://test.school.example'},
  json:async()=>body
})
const id='af7940af-1b48-49cc-8850-f69b15e9e23b'
const preId='c54a7f65-675b-41be-b497-6c68c6c69a5a'

function checkout({preRegistered=true,allowed=true,rpcOK=true}={}){
  const calls=[]
  const visit={id,visitor_id:'fictitious-visitor',pre_registration_id:preRegistered?preId:null,status:'INSIDE'}
  const db={
    rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});return{
      data:rpcOK?[{visitor_name:'Fictitious Guest'}]:null,error:rpcOK?null:new Error('duplicate exit')
    }},
    from(table){
      const st={filters:[],isNull:[]}
      const q={
        select(){return q},eq(key,value){st.filters.push([key,value]);return q},
        is(key,value){st.isNull.push([key,value]);return q},
        update(payload){calls.push({kind:'update',table,payload});return q},
        maybeSingle:async()=>{
          calls.push({kind:'lookup',table,filters:st.filters,isNull:st.isNull})
          if(table==='visits')return{data:st.filters.some(([k])=>k==='id')?visit:{id},error:null}
          if(table==='visitors')return{data:{full_name:'Fictitious Guest'},error:null}
          return{data:null,error:null}
        }
      }
      return q
    }
  }
  const mod=route('app/api/visit/checkout/route.ts',{
    '@supabase/supabase-js':{createClient:()=>db},
    'next/server':{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}},
    '@/lib/auth/verifyStaff':{verifyStaff:async()=>allowed?{profileId:'fictitious-staff',role:'SECURITY'}:null}
  })
  return{calls,endpoint:mod}
}
test('security roster checkout routes preregistration to atomic SQL function',async()=>{
  const c=checkout()
  const result=await c.endpoint.POST(req({visitId:id}))
  assert.equal(result.status,200)
  assert.equal(result.body.status,'EXITED')
  assert.equal(c.calls.filter(x=>x.kind==='update').length,0)
  assert.equal(c.calls.find(x=>x.kind==='rpc').name,'checkout_pre_registration')
  assert.equal(c.calls.find(x=>x.kind==='rpc').args.p_id,preId)
})
test('failed atomic checkout does not fall through to non-atomic visit mutation',async()=>{
  const c=checkout({rpcOK:false})
  assert.equal((await c.endpoint.POST(req({visitId:id}))).status,409)
  assert.equal(c.calls.filter(x=>x.kind==='update').length,0)
})
test('security roster remains restricted to logged-in personnel',async()=>{
  const c=checkout({allowed:false})
  assert.equal((await c.endpoint.POST(req({visitId:id}))).status,401)
  assert.equal(c.calls.length,0)
})
test('legacy-only checkout includes explicit NULL pre-registration condition',()=>{
  const code=read('app/api/visit/checkout/route.ts')
  assert.match(code,/\.is\("pre_registration_id", null\)/)
  assert.match(code,/\.eq\("status", "INSIDE"\)/)
})
test('new school dashboard counts actual active home pre-registrations',()=>{
  const code=read('app/api/admin/stats/route.ts')
  assert.match(code,/\.from\("pre_registrations"\)\.select\("id",\{count:"exact",head:true\}\)\s*\.in\("status",\["PRE_REGISTERED","NEEDS_REVIEW"\]\)/)
  assert.match(code,/checks\.some\(result=>result\.error\)/)
})
test('security scanner never checks out a visitor immediately on QR detection',()=>{
  const code=read('components/security/QRCheckoutScanner.tsx')
  assert.match(code,/setScannedToken\(token\)/)
  assert.match(code,/function confirmCheckout\(/)
  assert.match(code,/onClick=\{\(\)=>void confirmCheckout\(\)\}/)
  assert.ok(code.indexOf('setScannedToken(token)')<code.indexOf('async function confirmCheckout'))
})
test('visitor pass explicitly distinguishes live review, admission, exit and offline status',()=>{
  const code=read('app/pass/[token]/page.tsx')
  assert.match(code,/NEEDS SCHOOL REVIEW/)
  assert.match(code,/PENDING GATE APPROVAL/)
  assert.match(code,/CHECKED OUT/)
  assert.match(code,/You are offline/)
  assert.match(code,/Refresh status/)
})
test('admin configuration readiness remains private and does not claim provider delivery',()=>{
  const code=read('app/api/admin/health/database/route.ts')
  assert.match(code,/staff\.role !== "ADMIN"/)
  assert.match(code,/BA_OTP_HMAC_SECRET/)
  assert.match(code,/BA_FACE_COMPARISON_URL/)
  assert.match(code,/NOT SMS delivery tests/)
  assert.doesNotMatch(code,/process\.env\[key\]\s*\)/)
})
