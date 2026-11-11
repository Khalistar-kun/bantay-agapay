// Browser-independent, in-memory end-to-end flow tests for the plain HTML client.
// No real external HTTP calls, school data or staff credentials are used.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const script = fs.readFileSync(path.join(__dirname, '../public/client-demo/script.js'), 'utf8')
const token = 'b'.repeat(32)
const visitorId = 'd7719658-9c49-4e40-a0d9-8aa30470dc93'
const destinationId = 'c1d74422-21b1-4834-9a87-10f70ee345c2'
const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(128)]).toString('base64')
function harness(connected) {
  const store = new Map()
  const session = new Map()
  if (connected) store.set('ba_demo_mode','connected')
  const events = {}
  const app = {innerHTML:''}
  const toast = {textContent:'',classList:{add(){},remove(){}}}
  const db = {status:'PENDING',calls:[],token,visitId:visitorId}
  const canvas = () => ({
    width: 320,height:320,
    getContext() {return {fillRect(){},arc(){},beginPath(){},ellipse(){},fill(){},fillText(){},drawImage(){}}},
    toDataURL() {return jpeg},
  })
  const fakeDocument = {
    querySelector(s) {if(s==='#app')return app;if(s==='#toast')return toast;return null},
    addEventListener(name, cb) {events[name]=cb},
    createElement(name) {if(name==='canvas')return canvas();return {}},
  }
  const storage = map => ({
    getItem:k=>map.has(k)?map.get(k):null,
    setItem:(k,v)=>map.set(k,String(v)),
    removeItem:k=>map.delete(k),
  })
  const fakeFormData = class {
    constructor(form){this.data=new Map(Object.entries(form.fields||{}))}
    entries(){return this.data.entries()}
    get(k){return this.data.get(k)||null}
  }
  const Response = data => ({ok:true,status:200,json:async()=>data})
  const ErrorResponse = (status,error) => ({ok:false,status,json:async()=>({error})})
  async function fakeFetch(url,opts={}) {
    const verb=opts.method||'GET'
    db.calls.push([verb,url])
    if(url.includes('action=geofence'))return Response({boundary:{latitude:14.737,longitude:120.9728,radius:500}})
    if(url.includes('action=destinations'))return Response({destinations:[{id:destinationId,name:'Library',building:'School'}]})
    if(verb==='POST'&&url==='/api/client-demo'){
      const payload=JSON.parse(opts.body)
      assert.equal(payload.privacyConsent,true)
      assert.equal(payload.gpsReading.latitude,14.737)
      assert.ok(payload.gpsReading.capturedAt)
      assert.equal(payload.action,'register')
      assert.ok(payload.facePhoto.startsWith('data:image/jpeg;base64,'))
      return Response({success:true,token,referenceNumber:'V-ABCDEF12'})
    }
    if(url.includes('action=status'))return Response({visit:{status:db.status,visitor_name:'Fictional Test',reference_number:'V-ABCDEF12',destination_name:'Library'}})
    if(url==='/api/auth/login')return Response({role:'SECURITY',name:'Security tester'})
    if(url==='/api/security/pending')return Response({visitors:db.status==='PENDING'?[{id:visitorId,reference_number:'V-ABCDEF12',full_name:'Fictional Test',destination_name:'Library'}]:[]})
    if(url==='/api/security/inside')return Response({visitors:db.status==='INSIDE'?[{id:visitorId,reference_number:'V-ABCDEF12',full_name:'Fictional Test',destination_name:'Library'}]:[]})
    if(url.includes('action=lookup'))return Response({visit:{id:visitorId,token,status:db.status,name:'Fictional Test',reference:'V-ABCDEF12',destination:'Library',visitorType:'Guest'}})
    if(url==='/api/visit/approve'&&verb==='POST'){if(db.status!=='PENDING')return ErrorResponse(409,'Not pending');db.status='INSIDE';return Response({success:true})}
    if(url==='/api/visit/checkout'&&verb==='POST'){if(db.status!=='INSIDE')return ErrorResponse(409,'Not inside');db.status='EXITED';return Response({success:true})}
    if(url==='/api/auth/logout')return Response({success:true})
    return ErrorResponse(404,'Unexpected mocked URL '+url)
  }
  class FakeImage {
    constructor(){this.naturalWidth=320;this.naturalHeight=320}
    set src(v){queueMicrotask(()=>this.onload&&this.onload())}
  }
  const ctx={
    document:fakeDocument,
    localStorage:storage(store),sessionStorage:storage(session),
    location:{protocol:connected?'https:':'file:',pathname:'/client-demo/index.html'},
    window:{addEventListener(){},scrollTo(){}},
    FormData:fakeFormData,
    navigator:{geolocation:{getCurrentPosition(onSuccess){onSuccess({coords:{latitude:14.737,longitude:120.9728,accuracy:18}})}}},
    Image:FakeImage,
    URL:{createObjectURL:()=>'/fake.jpg',revokeObjectURL(){}},
    fetch:fakeFetch,
    confirm:()=>true,prompt:()=> 'Security decision',
    setInterval:()=>1,clearInterval(){},setTimeout:()=>1,clearTimeout(){},
    crypto:{getRandomValues(bytes){bytes.forEach((_,i)=>bytes[i]=(i+13)%255);return bytes}},
    console,Date,Math,Object,Array,JSON,String,Blob,encodeURIComponent,
  }
  vm.runInNewContext(script,ctx,{filename:'client-demo/script.js'})
  const click = async action=>{
    const target={dataset:{action}}
    await events.click({preventDefault(){},target:{closest:s=>s==='[data-action]'?target:null}})
  }
  const submit = async (id,fields)=>{
    await events.submit({preventDefault(){},target:{id,fields}})
  }
  const change = async (id,files)=>{
    events.change({target:{id,files}})
    await new Promise(resolve=>setTimeout(resolve,0))
  }
  return {app,toast,db,click,submit,change}
}
const form={
  fullName:'Fictional Test',contactNumber:'09170000000',visitorType:'Guest',
  purpose:'Mock appointment',destinationId,privacyConsent:'on',
}
test('offline visitor registration, staff QR approval and same-QR checkout',async()=>{
  const h=harness(false)
  assert.match(h.app.innerHTML,/Register a new visit/)
  await h.click('begin')
  await h.submit('visitor-form',form)
  assert.match(h.app.innerHTML,/Face photo scanning/)
  await h.click('placeholder-photo')
  await h.click('submit-visit')
  const pass=h.app.innerHTML
  assert.match(pass,/Awaiting approval/)
  const found=pass.match(/<div class="qr-token">([a-f0-9]{32})<\/div>/)
  assert.ok(found,'Generated QR token must display')
  await h.click('home')
  await h.click('go-staff')
  await h.submit('staff-login',{user:'security',password:'security123'})
  await h.submit('qr-lookup',{token:found[1]})
  assert.match(h.app.innerHTML,/Approve entry/)
  await h.click('approve')
  await h.click('home')
  await h.click('restore-pass')
  assert.match(h.app.innerHTML,/Checked in/)
  await h.click('home')
  await h.click('go-staff')
  await h.submit('staff-login',{user:'security',password:'security123'})
  await h.submit('qr-lookup',{token:found[1]})
  await h.click('checkout')
  await h.click('home')
  await h.click('restore-pass')
  assert.match(h.app.innerHTML,/Checked out/)
})
test('connected client uses only mocked APIs and completes approval and checkout',async()=>{
  const h=harness(true)
  await h.click('begin')
  await h.submit('visitor-form',form)
  await h.change('face-upload',[{type:'image/jpeg'}])
  assert.match(h.app.innerHTML,/Photo ready/)
  await h.click('go-gps')
  assert.match(h.app.innerHTML,/Campus location check/)
  await h.click('gps-check')
  assert.match(h.app.innerHTML,/inside the authorized check-in area/)
  await h.click('submit-visit')
  assert.match(h.app.innerHTML,/Awaiting approval/)
  await h.click('home')
  await h.click('go-staff')
  await h.submit('staff-login',{user:'09170000001',password:'fictional-secret'})
  await h.submit('qr-lookup',{token})
  assert.match(h.app.innerHTML,/Approve entry/)
  await h.click('approve')
  assert.equal(h.db.status,'INSIDE')
  await h.click('home')
  await h.click('restore-pass')
  await h.click('refresh-pass')
  assert.match(h.app.innerHTML,/Checked in/)
  await h.click('home')
  await h.click('go-staff')
  await h.submit('staff-login',{user:'09170000001',password:'fictional-secret'})
  await h.submit('qr-lookup',{token})
  await h.click('checkout')
  assert.equal(h.db.status,'EXITED')
  await h.click('home')
  await h.click('restore-pass')
  await h.click('refresh-pass')
  assert.match(h.app.innerHTML,/Checked out/)
  assert.ok(h.db.calls.some(([verb,url])=>verb==='POST'&&url==='/api/client-demo'))
  assert.ok(!h.db.calls.some(([verb,url])=>url==='/api/visit/submit'),'Legacy registration should not be called')
})
