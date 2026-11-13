/* Mock integration tests: route logic never changes real Supabase records. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const destinationId = '11111111-2222-4333-8444-555555555555'
const publicToken = 'a'.repeat(32)
const serverOrigin = 'https://bantay-preview.example'

function loadModule(file, overrides = {}) {
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const mod = { exports: {} }
  const localRequire = id => overrides[id] || require(id)
  vm.runInNewContext(js, {
    module: mod, exports: mod.exports, require: localRequire, JSON, Math, Number,
    process: {env: { NEXT_PUBLIC_SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'fake-key' }},
    URL, Date, console,
  }, {filename:file})
  return mod.exports
}
const helper = loadModule(path.join(root, 'lib/wayfinding.ts'))
const gate = {x:110,y:1450}, waypoint = {x:240,y:1000}, destPoint = {x:650,y:610}
const initial = {
  destinations: [{id:destinationId, name:'Faculty Office', building:'Academic', floor:'2', room:'201',landmark:'Corridor',
    directions:'Second floor',map_x:destPoint.x,map_y:destPoint.y,active:true}],
  visits: [{public_token:publicToken,status:'PENDING',destinations:null}],
  system_settings: [],
}
function setup() {
  const db = structuredClone(initial)
  const cfg = {role: null}
  db.visits[0].destinations = db.destinations[0]
  function query(table) {
    let filters = [], operation = 'select', payload
    const q = {
      select() { return q },
      eq(k,v) { filters.push(row => row[k] === v); return q },
      in(k,values) { filters.push(row => values.includes(row[k])); return q },
      upsert(value) { operation='upsert';payload=value; return q },
      async maybeSingle() { const {data,error}=execute();return {data:data[0]||null,error} },
      then(res,rej) { return Promise.resolve(execute()).then(res,rej) },
    }
    function execute() {
      const rows = db[table]
      if (!rows) return {data:[],error:{message:'Missing mock table'}}
      if (operation==='upsert') {
        const existing=rows.find(row=>row.key===payload.key)
        if(existing)Object.assign(existing,payload)
        else rows.push({...payload})
        return {data:[],error:null}
      }
      return {data:rows.filter(row=>filters.every(f=>f(row))),error:null}
    }
    return q
  }
  const mock={from:query}
  const mocks = {
    '@supabase/supabase-js': { createClient: () => mock },
    'next/server': { NextResponse: { json: (body,opts={})=>({body,status:opts.status||200,headers:opts.headers}) } },
    '@/lib/auth/verifyStaff': { verifyStaff: async () => cfg.role ? {role:cfg.role} : null },
    '@/lib/wayfinding': helper,
  }
  return { db,cfg, admin:loadModule(path.join(root,'app/api/admin/wayfinding/route.ts'),mocks),
    visitor:loadModule(path.join(root,'app/api/visit/wayfinding/route.ts'),mocks)}
}
const req=(body=null, destination=null, token=null, origin=serverOrigin)=>({
  nextUrl: {searchParams: new URLSearchParams({
    ...(destination ? {destinationId:destination}:{}), ...(token ? {token}:{}),
  })},
  url: serverOrigin+'/api/route',
  headers: {get(name){return name==='origin'?origin:name==='content-length'?'700':null}},
  json:async()=>body,
})

test('map coordinate parser rejects outside, fractional, missing and nonfinite values',()=>{
  assert.equal(helper.point({x:-1,y:300}),null)
  assert.equal(helper.point({x:300,y:1537}),null)
  assert.equal(helper.point({x:1.5,y:300}),null)
  assert.equal(helper.point({x:Infinity,y:200}),null)
  assert.equal(helper.point({x:100,y:100}).x,100)
})
test('route requires gate, destination and at least one real waypoint',()=>{
  assert.match(helper.checkRoute([gate,destPoint],gate,destPoint),/waypoint/)
  assert.match(helper.checkRoute([waypoint,gate,destPoint],gate,destPoint),/gate/)
  assert.match(helper.checkRoute([gate,waypoint,gate],gate,destPoint),/destination/)
  assert.match(helper.checkRoute([gate,gate,destPoint],gate,destPoint),/too close/)
  assert.equal(helper.checkRoute([gate,waypoint,destPoint],gate,destPoint),null)
})
test('admin authorization and same origin required; gate saved through settings',async()=>{
  const x=setup()
  assert.equal((await x.admin.GET(req(null,destinationId))).status,401)
  x.cfg.role='SECURITY'
  assert.equal((await x.admin.PUT(req({action:'gate',gate}))).status,401)
  x.cfg.role='ADMIN'
  assert.equal((await x.admin.PUT(req({action:'gate',gate},null,null,'https://evil.example'))).status,403)
  assert.equal((await x.admin.PUT(req({action:'gate',gate:{x:3000,y:0}}))).status,400)
  assert.equal((await x.admin.PUT(req({action:'gate',gate}))).status,200)
  const shown=await x.admin.GET(req(null,destinationId))
  assert.equal(shown.body.gate.x,gate.x)
})
test('route publishing validates correct destination, requires waypoints and no stale pins',async()=>{
  const x=setup();x.cfg.role='ADMIN'
  const base={action:'route',destinationId,points:[gate,waypoint,destPoint],instructions:'Follow the signed walkway.',published:true}
  assert.equal((await x.admin.PUT(req(base))).status,400) // gate not configured
  assert.equal((await x.admin.PUT(req({action:'gate',gate}))).status,200)
  assert.equal((await x.admin.PUT(req({...base,points:[gate,destPoint]}))).status,400)
  assert.equal((await x.admin.PUT(req(base))).status,200)
  let row=x.db.system_settings.find(r=>r.key===helper.routeKey(destinationId))
  assert.equal(JSON.parse(row.value).published,true)
  x.db.destinations[0].map_x=destPoint.x+50
  assert.equal((await x.admin.PUT(req(base))).status,400)
  assert.equal(helper.availableRoute(helper.readRoute(row.value),gate,{x:destPoint.x+50,y:destPoint.y}),null)
})
test('visitor never gets a walking route before guard approval',async()=>{
  const x=setup();x.cfg.role='ADMIN'
  await x.admin.PUT(req({action:'gate',gate}))
  await x.admin.PUT(req({action:'route',destinationId,points:[gate,waypoint,destPoint],published:true,instructions:'Through the pedestrian corridor.'}))
  assert.equal((await x.visitor.GET(req(null,null,'bad'))).status,400)
  let result=await x.visitor.GET(req(null,null,publicToken))
  assert.equal(result.status,200)
  assert.equal(result.body.available,false)
  assert.equal(result.body.points,undefined)
  x.db.visits[0].status='INSIDE'
  result=await x.visitor.GET(req(null,null,publicToken))
  assert.equal(result.body.available,true)
  assert.equal(result.body.points.length,3)
  assert.equal(result.body.destination.name,'Faculty Office')
  assert.equal(result.body.instructions,'Through the pedestrian corridor.')
  x.db.visits[0].status='EXITED'
  result=await x.visitor.GET(req(null,null,publicToken))
  assert.equal(result.body.available,false)
})
test('unpublished paths and moved gate never appear as visitor navigation',async()=>{
  const x=setup();x.cfg.role='ADMIN';x.db.visits[0].status='INSIDE'
  await x.admin.PUT(req({action:'gate',gate}))
  const base={action:'route',destinationId,points:[gate,waypoint,destPoint],instructions:'',published:false}
  await x.admin.PUT(req(base))
  assert.equal((await x.visitor.GET(req(null,null,publicToken))).body.available,false)
  await x.admin.PUT(req({...base,published:true}))
  assert.equal((await x.visitor.GET(req(null,null,publicToken))).body.available,true)
  await x.admin.PUT(req({action:'gate',gate:{x:gate.x+40,y:gate.y}}))
  assert.equal((await x.visitor.GET(req(null,null,publicToken))).body.available,false)
})
test('admin editor and visitor screen render against real campus map, not invented routes',()=>{
  const editor=fs.readFileSync(path.join(root,'app/admin/wayfinding/page.tsx'),'utf8')
  const visitor=fs.readFileSync(path.join(root,'app/visit/directions/[token]/page.tsx'),'utf8')
  const destinationPage=fs.readFileSync(path.join(root,'app/admin/destinations/page.tsx'),'utf8')
  assert.match(editor,/Publish Approved Route/)
  assert.match(editor,/Undo Last/)
  assert.match(editor,/Save Main Gate/)
  assert.match(editor,/src="\/campus-map.png"/)
  assert.match(visitor,/markerMid="url\(#wayfinding-arrow\)"/)
  assert.match(visitor,/route.available/)
  assert.match(visitor,/not GPS turn-by-turn navigation/)
  assert.match(destinationPage,/href="\/admin\/wayfinding"/)
})
