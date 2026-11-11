const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require('node:path').join(__dirname, '../public/client-demo/face-scanner.js'),'utf8')
const root = {requestAnimationFrame(){return 1},cancelAnimationFrame(){}}
const context={window:root, Math, Number, Object}
vm.runInNewContext(source,context)
const engine=root.BantayFaceScan

function face(yaw=0) {
  const landmarks=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
  landmarks[234]={x:.3,y:.48}
  landmarks[454]={x:.7,y:.48}
  landmarks[1]={x:.5+yaw*.4,y:.47}
  landmarks[33]={x:.39,y:.43}
  landmarks[263]={x:.61,y:.43}
  landmarks[152]={x:.5,y:.76}
  landmarks[10]={x:.5,y:.25}
  landmarks[93]={x:.3,y:.62}
  landmarks[323]={x:.7,y:.62}
  return landmarks
}
function result(yaw=0,blink=0,count=1) {
  return {faceLandmarks:Array.from({length:count},()=>face(yaw)),
    faceBlendshapes:[{categories:[{categoryName:'eyeBlinkLeft',score:blink},{categoryName:'eyeBlinkRight',score:blink}]}]}
}
test('real facial landmarks, not skin color, determine presence and reject multiple faces',()=>{
  assert.equal(engine.inspect({faceLandmarks:[]}).ok,false)
  assert.match(engine.inspect(result(0,0,2)).message,/Only one/)
  assert.equal(engine.inspect(result()).ok,true)
})
test('motion check requires centered face, blink, opposite head movements, final centered photo',()=>{
  const p=engine.newProgress()
  for(let i=0;i<5;i++)engine.evaluate(p,result())
  assert.equal(p.phase,'blink')
  engine.evaluate(p,result())
  assert.equal(p.phase,'blink')
  engine.evaluate(p,result(0,.8))
  engine.evaluate(p,result(0,.08))
  assert.equal(p.phase,'first-turn')
  engine.evaluate(p,result(.2))
  engine.evaluate(p,result(.2))
  assert.equal(p.phase,'back-center')
  engine.evaluate(p,result())
  engine.evaluate(p,result())
  assert.equal(p.phase,'second-turn')
  engine.evaluate(p,result(.2))
  assert.equal(p.phase,'second-turn','cannot repeat same direction')
  engine.evaluate(p,result(-.2))
  engine.evaluate(p,result(-.2))
  assert.equal(p.phase,'final-center')
  for(let i=0;i<3;i++)engine.evaluate(p,result())
  assert.equal(p.ready,true)
  assert.equal(p.phase,'ready')
})
test('losing the face or multiple people resets a partly completed scan',()=>{
  const p=engine.newProgress()
  for(let i=0;i<5;i++)engine.evaluate(p,result())
  assert.equal(p.phase,'blink')
  for(let i=0;i<6;i++)engine.evaluate(p,result(0,0,2))
  assert.equal(p.phase,'center')
})
test('face scanner is pinned to one model version and never writes photos to network',()=>{
  assert.match(source,/@mediapipe\/tasks-vision@0\.10\.35/)
  assert.doesNotMatch(source,/fetch\(|toDataURL|localStorage|sessionStorage/)
})
