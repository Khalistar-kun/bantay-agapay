const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const vm=require('node:vm')
const ts=require('typescript')

const source=fs.readFileSync(path.join(__dirname,'../lib/server/sms-gateway.ts'),'utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
function gateway(env,fetchFn=async()=>{throw Error('Never called')}){
  let calls=0
  const module={exports:{}}
  vm.runInNewContext(js,{module,exports:module.exports,process:{env},
    fetch:async(...args)=>{calls++;return fetchFn(...args)},
    AbortSignal,Buffer,JSON,console})
  return{gateway:module.exports,calls:()=>calls}
}
const freeConfig={
 TEXTBEE_API_KEY:'test-key-with-more-than-twenty-four-characters',
 BA_FREE_SMS_ONLY:'true',
 BA_SMS_CARRIER_INCLUDED:'true'
}
test('default mode requires no SMS provider and never sends anything',async()=>{
 const x=gateway({})
 assert.equal(x.gateway.smsGatewayConfigured(),false)
 assert.equal(await x.gateway.sendReturningOtp('09170000000','123456'),false)
 assert.equal(x.calls(),0)
})
test('free provider cannot send unless inclusive SIM confirmation is configured',async()=>{
 const x=gateway({...freeConfig,BA_SMS_CARRIER_INCLUDED:'false'})
 assert.equal(x.gateway.smsGatewayConfigured(),false)
 assert.equal(await x.gateway.sendReturningOtp('09170000000','123456'),false)
 assert.equal(x.calls(),0)
})
test('the only supported SMS API endpoint is textbee Free provider',async()=>{
 let args
 const x=gateway(freeConfig,async(url,init)=>{
  args={url,init}
  return{ok:true,json:async()=>({data:{success:true,smsBatchId:'test-batch'}})}
 })
 assert.equal(x.gateway.smsGatewayConfigured(),true)
 assert.equal(await x.gateway.sendReturningOtp('09170000000','123456'),true)
 assert.equal(args.url,'https://api.textbee.dev/api/v1/gateway/send-sms')
 assert.equal(args.init.headers['x-api-key'],freeConfig.TEXTBEE_API_KEY)
 assert.deepEqual(JSON.parse(args.init.body).recipients,['+639170000000'])
 assert.ok(!('Authorization' in args.init.headers))
 assert.equal(x.calls(),1)
})
test('provider failure or exhausted free tier never results in claimed SMS success',async()=>{
 const x=gateway(freeConfig,async()=>({ok:false,status:429}))
 assert.equal(await x.gateway.sendReturningOtp('09170000000','123456'),false)
})
test('queued SMS must contain the expected success response body',async()=>{
 const x=gateway(freeConfig,async()=>({ok:true,json:async()=>({data:{success:false}})}))
 assert.equal(await x.gateway.sendReturningOtp('09170000000','123456'),false)
})
test('invalid numbers and codes never call the SMS API',async()=>{
 const x=gateway(freeConfig)
 assert.equal(await x.gateway.sendReturningOtp('invalid','123456'),false)
 assert.equal(await x.gateway.sendReturningOtp('09170000000','1111'),false)
 assert.equal(x.calls(),0)
})
test('paid custom SMS gateway configuration is ignored',async()=>{
 const x=gateway({BA_SMS_GATEWAY_URL:'https://paid-gateway.example/send',BA_SMS_GATEWAY_SECRET:'a'.repeat(50)})
 assert.equal(x.gateway.smsGatewayConfigured(),false)
 assert.equal(x.calls(),0)
 assert.doesNotMatch(source,/process\.env\.BA_SMS_GATEWAY_URL/)
})
