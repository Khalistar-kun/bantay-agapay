const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')
const path=require('node:path')
const source=fs.readFileSync(path.join(__dirname,'../public/client-demo/face-scanner.js'),'utf8')
const root={requestAnimationFrame(){return 1},cancelAnimationFrame(){}}
vm.runInNewContext(source,{window:root,Math,Number,Object,Float32Array,Uint32Array})
const scanner=root.BantayFaceScan
function face(yaw=0,scale=1) {
 const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
 const anchor=(x,y)=>({x:.5+(x-.5)*scale,y:.5+(y-.5)*scale,z:0})
 points[234]=anchor(.3,.48);points[454]=anchor(.7,.48)
 points[1]=anchor(.5+yaw*.4,.47)
 points[33]=anchor(.39,.43);points[263]=anchor(.61,.43)
 points[152]=anchor(.5,.76);points[10]=anchor(.5,.25)
 points[93]=anchor(.3,.62);points[323]=anchor(.7,.62)
 return points
}
function scan(yaw=0,blink=0,count=1,scale=1) {
 return {faceLandmarks:Array.from({length:count},()=>face(yaw,scale)),
 faceBlendshapes:[{categories:[{categoryName:'eyeBlinkLeft',score:blink},{categoryName:'eyeBlinkRight',score:blink}]}]}
}
function step(p,yaw=0,blink=0) {return scanner.evaluate(p,scan(yaw,blink))}
test('only one centered properly sized face is accepted',()=>{
 assert.equal(scanner.inspect({faceLandmarks:[]}).ok,false)
 assert.match(scanner.inspect(scan(0,0,2)).message,/Only one/)
 assert.equal(scanner.inspect(scan()).ok,true)
 assert.match(scanner.inspect(scan(0,0,1,.2)).message,/closer/)
})
test('challenge ordering varies and is deterministic when provided a random source',()=>{
 assert.equal(scanner.randomOrder(()=>.2).join(','),'blink,turn,opposite')
 assert.equal(scanner.randomOrder(()=>.7).join(','),'turn,opposite,blink')
})
test('blink then left/right movement progresses only after correct head actions',()=>{
 const p=scanner.newProgress(['blink','turn','opposite'])
 for(let i=0;i<5;i++)step(p)
 assert.equal(p.phase,'challenge');assert.equal(p.challenge[p.step],'blink')
 step(p);assert.equal(p.step,0)
 step(p,0,.82);step(p,0,.04);step(p,0,.04)
 assert.equal(p.step,1);assert.equal(p.challenge[p.step],'turn')
 step(p,.2);step(p,.2);assert.equal(p.step,2);assert.equal(p.phase,'recover')
 step(p);step(p);assert.equal(p.phase,'challenge')
 step(p,.2);assert.equal(p.step,2)
 step(p,-.2);step(p,-.2);assert.equal(p.phase,'final')
 for(let i=0;i<4;i++)step(p)
 assert.equal(p.ready,true);assert.equal(p.captureSafe,true)
 step(p,.25);assert.equal(p.captureSafe,false)
 step(p);assert.equal(p.captureSafe,true)
})
test('opposite and then blink sequence also works',()=>{
 const p=scanner.newProgress(['turn','opposite','blink'])
 for(let i=0;i<5;i++)step(p)
 step(p,-.2);step(p,-.2);assert.equal(p.phase,'recover')
 step(p);step(p);assert.equal(p.challenge[p.step],'opposite')
 step(p,.2);step(p,.2);assert.equal(p.phase,'recover')
 step(p);step(p);assert.equal(p.challenge[p.step],'blink')
 step(p,0,.82);step(p,0,.04);step(p,0,.04)
 assert.equal(p.phase,'final')
 for(let i=0;i<4;i++)step(p)
 assert.equal(p.ready,true)
})
test('multiple faces and missing faces invalidate progress and reset after persistence',()=>{
 const p=scanner.newProgress(['blink','turn','opposite'])
 for(let i=0;i<5;i++)step(p)
 assert.equal(p.phase,'challenge')
 for(let i=0;i<6;i++)scanner.evaluate(p,scan(0,0,2))
 assert.equal(p.phase,'center');assert.equal(p.percent,0)
})
test('dark and overexposed frames produce lighting tips',()=>{
 function quality(value) {const data=new Uint8ClampedArray(48*48*4);for(let i=0;i<data.length;i+=4){data[i]=value;data[i+1]=value;data[i+2]=value;data[i+3]=255}
 return scanner.checkQuality({videoWidth:640,videoHeight:640},{getContext:()=>({drawImage(){},getImageData(){return {data}}})})}
 assert.match(quality(4).message,/dark/)
 assert.match(quality(251).message,/bright/)
})
test('quality issues block readiness and no photos are transmitted by scanner',()=>{
 const p=scanner.newProgress(['blink','turn','opposite'])
 scanner.evaluate(p,scan(),{ok:false,message:'Too dark'})
 assert.equal(p.steady,0);assert.match(p.message,/dark/)
 assert.match(source,/@mediapipe\/tasks-vision@/)
 assert.doesNotMatch(source,/fetch\(|toDataURL|localStorage|sessionStorage/)
});


test('auto photo countdown starts at 3 and fires exactly once after 3 seconds',()=>{
 let nextId=1;const queue=new Map();const seen=[];let photos=0;
 const clock={setTimeout(fn,ms){assert.equal(ms,1000);const id=nextId++;queue.set(id,fn);return id},clearTimeout(id){queue.delete(id)}};
 const timer=scanner.createCountdown({onTick(n){seen.push(n)},onComplete(){photos++}},clock);
 timer.update(true);assert.deepEqual(seen,[3]);assert.equal(queue.size,1);
 timer.update(true);assert.equal(queue.size,1);
 for(let i=0;i<3;i++){const [id,fn]=queue.entries().next().value;queue.delete(id);fn()}
 assert.deepEqual(seen,[3,2,1,0]);assert.equal(photos,1);assert.equal(queue.size,0);
 timer.update(true);assert.equal(photos,1);assert.equal(queue.size,0);
});

test('lost face cancels countdown and the next stable scan restarts from 3',()=>{
 let nextId=1;const queue=new Map(),seen=[];let photos=0;
 const clock={setTimeout(fn){const id=nextId++;queue.set(id,fn);return id},clearTimeout(id){queue.delete(id)}};
 const timer=scanner.createCountdown({onTick(n){seen.push(n)},onComplete(){photos++}},clock);
 timer.update(true);
 let [id,fn]=queue.entries().next().value;queue.delete(id);fn();
 assert.equal(timer.remaining(),2);
 timer.update(false);assert.equal(timer.remaining(),0);assert.equal(queue.size,0);assert.equal(photos,0);
 timer.update(true);assert.equal(timer.remaining(),3);
 for(let i=0;i<3;i++){[id,fn]=queue.entries().next().value;queue.delete(id);fn()}
 assert.equal(photos,1);assert.deepEqual(seen,[3,2,0,3,2,1,0]);
});

test('leaving the screen disposes countdown with no delayed photo',()=>{
 let pending;let removed=false;let calls=0;
 const timer=scanner.createCountdown({onComplete(){calls++}},{
   setTimeout(fn){pending=fn;return 9},
   clearTimeout(){removed=true}
 });
 timer.update(true);timer.dispose();assert.equal(removed,true);
 pending();assert.equal(calls,0);timer.update(true);assert.equal(calls,0);
});


test('stale or invalid face before timer finishes cancels capture and allows a retry',()=>{
  let id=1;const queue=new Map();let stable=true;let shots=0;
  const clock={setTimeout(fn){queue.set(id,fn);return id++},clearTimeout(i){queue.delete(i)}};
  const c=scanner.createCountdown({isStillValid:()=>stable,onComplete(){shots++}},clock);
  c.update(true);
  stable=false;
  const [key,fn]=queue.entries().next().value;queue.delete(key);fn();
  assert.equal(shots,0);assert.equal(c.isRunning(),false);
  stable=true;c.update(true);
  for(let i=0;i<3;i++){const [k,f]=queue.entries().next().value;queue.delete(k);f()}
  assert.equal(shots,1);
});
