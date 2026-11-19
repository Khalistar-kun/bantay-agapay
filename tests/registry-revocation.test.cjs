const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')
const src=fs.readFileSync(path.join(__dirname,'../app/api/admin/registry/route.ts'),'utf8')
const js=ts.transpileModule(src,{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}
}).outputText
const studentId='d7719658-9c49-4e40-a0d9-8aa30470dc93'
const guardianId='c1d74422-21b1-4834-9a87-10f70ee345c2'
const origin='https://school.example'
function harness({staff={profileId:'test-admin',role:'ADMIN'},cross=false,rpcResult=true}={}){
 const calls=[]
 const db={rpc:async(name,args)=>{calls.push({name,args});return {data:rpcResult,error:null}}}
 const values={
  'next/server':{NextResponse:{json:(body,opts={})=>({body,status:opts.status||200})}},
  'crypto':require('crypto'),
  '@/lib/client-compliance':{UUID:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i},
  '@/lib/server/client-compliance-db':{
   schoolDb:()=>db,
   requireStaff:async()=>staff,
   denyCrossOrigin:()=>cross?{status:403,body:{error:'Cross-origin denied'}}:null,
   safeText:(value,min=2,max=200)=>typeof value==='string'&&value.trim().length>=min&&value.trim().length<=max?value.trim():null,
   noStore:{}
  }
 }
 const module={exports:{}}
 vm.runInNewContext(js,{module,exports:module.exports,require:id=>values[id]||require(id),
  Date,Buffer,JSON,console,process:{env:{}}},
  {filename:'app/api/admin/registry/route.ts'})
 return {
  PATCH:module.exports.PATCH,
  calls,
  req:body=>({headers:{get:key=>key==='origin'?origin:null},nextUrl:{origin},
   text:async()=>JSON.stringify(body)})
 }
}
test('school authorization revocation requires signed-in approved administrator',async()=>{
 const h=harness({staff:null})
 const r=await h.PATCH(h.req({action:'revoke',kind:'guardian',id:guardianId,reason:'School authorization ended'}))
 assert.equal(r.status,403)
 assert.equal(h.calls.length,0)
})
test('school authorization revocation rejects cross-origin requests',async()=>{
 const h=harness({cross:true})
 const r=await h.PATCH(h.req({action:'revoke',kind:'student',id:studentId,reason:'School record inactive'}))
 assert.equal(r.status,403)
 assert.equal(h.calls.length,0)
})
test('guardian access revocation requires an auditable reason and correct UUID',async()=>{
 const h=harness()
 const missing=await h.PATCH(h.req({action:'revoke',kind:'guardian',id:guardianId,reason:''}))
 const invalid=await h.PATCH(h.req({action:'revoke',kind:'student',id:'invalid',reason:'Withdrawn'}))
 assert.equal(missing.status,400)
 assert.equal(invalid.status,400)
 assert.equal(h.calls.length,0)
 const valid=await h.PATCH(h.req({action:'revoke',kind:'guardian',id:guardianId,reason:'Guardian consent withdrawn'}))
 assert.equal(valid.status,200)
 assert.equal(h.calls[0].name,'revoke_school_registry')
 assert.equal(h.calls[0].args.p_kind,'guardian')
 assert.equal(h.calls[0].args.p_staff_id,'test-admin')
})
test('guardian-to-student link requires renewed school verification',async()=>{
 const h=harness({rpcResult:'link-id'})
 const args={action:'link',guardianId,studentId,relationship:'PARENT'}
 assert.equal((await h.PATCH(h.req(args))).status,400)
 assert.equal(h.calls.length,0)
 const linked=await h.PATCH(h.req({...args,identityChecked:true}))
 assert.equal(linked.status,200)
 assert.equal(h.calls[0].name,'link_verified_guardian')
 assert.equal(h.calls[0].args.p_guardian_id,guardianId)
 assert.equal(h.calls[0].args.p_student_id,studentId)
})
test('revocation and relationship changes are atomic in SQL and audit-tracked',()=>{
 const sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations/12_guardian_registry_operations.sql'),'utf8')
 for(const name of ['revoke_school_registry','link_verified_guardian'])
  assert.equal((sql.match(new RegExp('CREATE OR REPLACE FUNCTION public\\.'+name,'g'))||[]).length,1)
 assert.match(sql,/AND g\.active=true AND g\.verified_at IS NOT NULL/)
 assert.match(sql,/SET active=false/)
 assert.match(sql,/INSERT INTO public\.audit_logs/)
 assert.match(sql,/FROM PUBLIC, anon, authenticated/)
})
test('administrator UI exposes explicit revocation and verified relationship linking',()=>{
 const page=fs.readFileSync(path.join(__dirname,'../app/admin/registry/page.tsx'),'utf8')
 assert.match(page,/Revoke Guardian Access/)
 assert.match(page,/Revoke Relationship/)
 assert.match(page,/Save Verified Relationship/)
 assert.match(page,/reason for this access change/)
})
