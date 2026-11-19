const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const source=fs.readFileSync(path.join(__dirname,'../lib/biometrics/face-comparator.ts'),'utf8')
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
const secret='x'.repeat(40)
function load(env,provider){
 const exports={}
 const module={exports}
 vm.runInNewContext(code,{
  module,exports,URL,Buffer,Date,Number,JSON,AbortSignal,console,
  process:{env},
  fetch:provider
 })
 return module.exports
}
const photo=Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(125)])
test('guardian comparison fails closed without an explicitly configured approved provider',async()=>{
 const x=load({},()=>{throw Error('External comparison must not run')})
 const r=await x.compareEnrolledFaces(photo,photo)
 assert.equal(r.status,'ERROR')
 assert.equal(r.confidence,null)
})
test('untrusted service or missing threshold fails closed before photo transfer',async()=>{
 let calls=0
 const x=load({BA_FACE_COMPARISON_URL:'http://localhost:8080/',BA_FACE_COMPARISON_SECRET:secret,
  BA_FACE_MIN_CONFIDENCE:'0.98'},()=>{calls++})
 assert.equal((await x.compareEnrolledFaces(photo,photo)).status,'ERROR')
 const y=load({BA_FACE_COMPARISON_URL:'https://comparison.school.example/verify',BA_FACE_COMPARISON_SECRET:secret},()=>{calls++})
 assert.equal((await y.compareEnrolledFaces(photo,photo)).status,'ERROR')
 assert.equal(calls,0)
})
test('only attested liveness and sufficient confidence can yield MATCH',async()=>{
 let calls=0
 const env={BA_FACE_COMPARISON_URL:'https://comparison.school.example/verify',
  BA_FACE_COMPARISON_SECRET:secret,BA_FACE_MIN_CONFIDENCE:'0.98'}
 const x=load(env,async(_url,opts)=>{
   calls++
   const parsed=JSON.parse(opts.body)
   assert.equal(parsed.version,'1')
   assert.ok(parsed.probeImageBase64.length>100)
   assert.equal(opts.headers.Authorization,'Bearer '+secret)
   return {ok:true,headers:{get:()=>null},json:async()=>({
     matched:true,confidence:0.99,livenessVerified:true,modelVersion:'provider-approved-1'
   })}
 })
 const r=await x.compareEnrolledFaces(photo,photo)
 assert.equal(r.status,'MATCH')
 assert.equal(r.confidence,0.99)
 assert.equal(calls,1)
})
test('provider match cannot override a failed liveness check',async()=>{
 const x=load({BA_FACE_COMPARISON_URL:'https://comparison.school.example/verify',
  BA_FACE_COMPARISON_SECRET:secret,BA_FACE_MIN_CONFIDENCE:'0.98'},async()=>({
   ok:true,headers:{get:()=>null},
   json:async()=>({matched:true,confidence:1,livenessVerified:false,modelVersion:'provider-approved-1'})
 }))
 assert.equal((await x.compareEnrolledFaces(photo,photo)).status,'ERROR')
})
test('low confidence and provider mismatch do not count as a verified guardian',async()=>{
 const x=load({BA_FACE_COMPARISON_URL:'https://comparison.school.example/verify',
  BA_FACE_COMPARISON_SECRET:secret,BA_FACE_MIN_CONFIDENCE:'0.98'},async()=>({
   ok:true,headers:{get:()=>null},
   json:async()=>({matched:true,confidence:0.91,livenessVerified:true,modelVersion:'provider-approved-1'})
 }))
 assert.equal((await x.compareEnrolledFaces(photo,photo)).status,'NO_MATCH')
})
test('face comparison adapter does not log or store identity photos',()=>{
 assert.doesNotMatch(source,/console\.log|localStorage|sessionStorage|storage\.upload/)
 assert.match(source,/no-store/)
 assert.match(source,/AbortSignal\.timeout/)
})
