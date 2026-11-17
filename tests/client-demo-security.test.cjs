/* Mock-backed integration tests: no real visitor or Supabase data is modified. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const uuid = 'd7719658-9c49-4e40-a0d9-8aa30470dc93'
const uuid2 = 'c1d74422-21b1-4834-9a87-10f70ee345c2'
const tok = 'a'.repeat(32)
const origin = 'https://bantay-preview.example'

function mockBackend() {
  const db = {
    visits: [{ id: uuid, visitor_id: uuid2, pre_registration_id: null, status: 'PENDING', public_token: tok }],
    visitors: [{ id: uuid2, full_name: 'Demo Visitor', contact_number: '09170000000' }],
    destinations: [{ id: uuid2, active: true }],
    system_settings: [{key:'school_latitude',value:'14.737'},{key:'school_longitude',value:'120.9728'},{key:'geofence_radius',value:'500'}],
    verification_logs: [],
    uploaded: [], removed: [],
  }
  let serial = 0
  function query(table) {
    let action = 'select', payload, filters = [], wasExecuted = false, result
    const api = {
      select() { return api },
      eq(field, value) { filters.push([field, value]); return api },
      is(field,value){filters.push([field,value]);return api},
      update(value) { action = 'update'; payload = value; return api },
      insert(value) { action = 'insert'; payload = value; return api },
      delete() { action = 'delete'; return api },
      order() { return api },
      async single() { const out = execute(); return {data: out.data?.[0] || null, error: out.error} },
      async maybeSingle() { const out = execute(); return {data: out.data?.[0] || null, error: out.error} },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject) },
    }
    function execute() {
      if (wasExecuted) return result
      wasExecuted = true
      const rows = db[table]
      if (!rows) return result = {data: null,error: new Error('Unknown mock table')}
      const matching = rows.filter(row => filters.every(([k,v]) => row[k] === v))
      if (action === 'select') return result = { data: matching, error: null }
      if (action === 'insert') {
        const values = Array.isArray(payload) ? payload : [payload]
        const created = values.map(v => ({ ...v, id: v.id || 'mock-id-' + (++serial) }))
        rows.push(...created); return result = {data: created, error: null}
      }
      if (action === 'update') {
        matching.forEach(row => Object.assign(row, payload))
        return result = {data: matching, error: null}
      }
      if (action === 'delete') {
        matching.forEach(row => { const idx=rows.indexOf(row); if(idx>=0)rows.splice(idx,1) })
        return result = {data: matching, error: null}
      }
      return result = {data: null,error: new Error('Unknown action')}
    }
    return api
  }
  const client = {
    from: query,
    storage: { from() { return {
      async upload(p) { db.uploaded.push(p); return {data: {path:p}, error:null} },
      async remove(p) { db.removed.push(...p); return {data:[],error:null} },
    } } },
  }
  return { db, client }
}
function loadRoute(route, cfg) {
  const file = path.join(__dirname, '../app/api', route, 'route.ts')
  const js = ts.transpileModule(fs.readFileSync(file,'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  const mod = { exports: {} }
  const requireMock = name => {
    if (name === '@supabase/supabase-js') return {createClient: () => cfg.client}
    if (name === 'next/server') return {NextResponse: { json: (body,opts={}) => ({status:opts.status || 200, body}) }}
    if (name === '@/lib/auth/verifyStaff') return {verifyStaff: async () => cfg.staff}
    return require(name)
  }
  vm.runInNewContext(js, {module: mod,exports:mod.exports,require:requireMock,
    process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test'}},
    Buffer, URL, TextEncoder, console, Date, crypto:global.crypto}, {filename:file})
  return mod.exports
}
function req(body, site = origin) {
  return { headers:{get: key => key==='origin'?site:null},
    nextUrl:{origin,searchParams:new URLSearchParams()},
    json:async()=>body, text:async()=>JSON.stringify(body) }
}
function setup() {
  const {db,client}=mockBackend()
  const cfg={db,client,staff:{profileId:'staff-test',role:'SECURITY'}}
  const approve=loadRoute('visit/approve',cfg).POST
  const deny=loadRoute('visit/deny',cfg).POST
  const checkout=loadRoute('visit/checkout',cfg).POST
  const register=loadRoute('client-demo',cfg).POST
  return {db,cfg,approve,deny,checkout,register}
}
test('legacy approval cannot bypass authorized guardian verification',async()=>{
 const x=setup()
 x.cfg.staff=null
 assert.equal((await x.approve(req({visitId:uuid}))).status,401)
 x.cfg.staff={profileId:'staff-test',role:'SECURITY'}
 assert.equal((await x.approve(req({visitId:uuid},'https://evil.example'))).status,403)
 assert.equal((await x.approve(req({visitId:uuid,token:tok}))).status,410)
 assert.equal(x.db.visits[0].status,'PENDING')
 assert.equal(x.db.visits[0].public_token,tok)
})
test('legacy denial remains possible to safely close pending records',async()=>{
 const x=setup()
 assert.equal((await x.deny(req({visitId:uuid,reason:'Identity unavailable'}))).status,200)
 assert.equal(x.db.visits[0].status,'DENIED')
 assert.equal((await x.deny(req({visitId:uuid,reason:'Repeated'}))).status,409)
 assert.equal((await x.approve(req({visitId:uuid}))).status,410)
 assert.equal((await x.deny(req({visitId:uuid,reason:'x'.repeat(501)}))).status,400)
})
test('previously checked-in legacy visits can still be checked out once',async()=>{
 const x=setup()
 assert.equal((await x.checkout(req({visitId:uuid,token:tok}))).status,409)
 x.db.visits[0].status='INSIDE'
 assert.equal((await x.checkout(req({visitId:uuid,token:'b'.repeat(32)}))).status,409)
 assert.equal((await x.checkout(req({visitId:uuid,token:tok}))).status,200)
 assert.equal(x.db.visits[0].status,'EXITED')
 assert.equal(x.db.visits[0].checked_out_by,'staff-test')
 assert.equal((await x.checkout(req({visitId:uuid,token:tok}))).status,409)
})
test('legacy client registration is disabled, preventing a guardian verification bypass',async()=>{
 const x=setup()
 const res=await x.register(req({action:'register',fullName:'Fictional',facePhoto:'fake'}))
 assert.equal(res.status,410)
 assert.match(res.body.error,/secure|pre-register/i)
 assert.equal(x.db.visits.length,1)
 assert.equal(x.db.uploaded.length,0)
});
test('client script remains valid JavaScript',()=>{
  assert.doesNotThrow(()=>new vm.Script(fs.readFileSync(path.join(__dirname,'../public/client-demo/script.js'),'utf8')))
})
