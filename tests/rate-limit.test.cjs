const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const source=fs.readFileSync(path.join(__dirname,'../lib/server/rate-limit.ts'),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
function load(secret,check){
 let last=null
 const exports={},module={exports}
 vm.runInNewContext(js,{exports,module,require:id=>{
  if(id==='@/lib/server/client-compliance-db')return{schoolDb:()=>({
   async rpc(fn,args){last={fn,args};return {data:check,error:null}}
  })}
  return require(id)
 },process:{env:{BA_RATE_LIMIT_SECRET:secret}},Buffer,console})
 return {service:module.exports,last:()=>last}
}
function req(ip='203.0.113.1'){return{headers:{get:key=>key==='x-vercel-forwarded-for'?ip:null}}}
test('missing rate limiter secret blocks all actions before any database RPC',async()=>{
 const a=load('',true)
 await assert.rejects(a.service.consumeRateLimit(req(),'prereg-ip','new',12,3600),/not configured/)
 assert.equal(a.last(),null)
})
test('rate limiter hashes identity and source IP without persisting raw PII',async()=>{
 const a=load('super-secret-'.repeat(4),true)
 assert.equal(await a.service.consumeRateLimit(req(),'prereg-phone','09170000000',5,86400),true)
 const {fn,args}=a.last()
 assert.equal(fn,'consume_rate_limit')
 assert.match(args.p_key_hash,/^[a-f0-9]{64}$/)
 assert.doesNotMatch(args.p_key_hash,/09170000000/)
 assert.equal(args.p_limit,5)
 assert.equal(args.p_window_seconds,86400)
})
test('throttled request fails closed for public callers',async()=>{
 const a=load('super-secret-'.repeat(4),false)
 assert.equal(await a.service.consumeRateLimit(req(),'staff-login','person-name',12,900),false)
})
test('different sources produce different anonymous rate-limit keys',async()=>{
 const a=load('super-secret-'.repeat(4),true)
 await a.service.consumeRateLimit(req('198.51.100.1'),'staff-login','person-name',12,900)
 const first=a.last().args.p_key_hash
 await a.service.consumeRateLimit(req('198.51.100.2'),'staff-login','person-name',12,900)
 const second=a.last().args.p_key_hash
 assert.notEqual(first,second)
})
test('rate-limit RPC is not callable directly by anonymous Supabase users',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/10_client_guardian_preregistration.sql'),'utf8')
 assert.match(sql,/REVOKE EXECUTE ON FUNCTION public\.consume_rate_limit\(varchar,integer,integer\) FROM PUBLIC,anon,authenticated;/)
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.consume_rate_limit\(varchar,integer,integer\) TO service_role;/)
})
