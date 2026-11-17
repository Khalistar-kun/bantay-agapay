/* Browser-level visitor UX checks using mock API replies and fictional data.
 * Never calls live Supabase, sends SMS, or modifies visitor records.
 */
const assert=require('node:assert/strict')
const {chromium}=require('playwright')

const base=process.env.BA_BROWSER_BASE_URL||'http://127.0.0.1:3100'
const destinationId='c1d74422-21b1-4834-9a87-10f70ee345c2'
const token='a'.repeat(32)

async function intercept(page){
 await page.route('**/api/client-demo?action=destinations',route=>route.fulfill({
  status:200,contentType:'application/json',
  body:JSON.stringify({destinations:[{
   id:destinationId,name:'Fictional Faculty Office',building:'School Building',room:'A1'
  }]})
 }))
 await page.route('**/api/faculty-directory',route=>route.fulfill({
  status:200,contentType:'application/json',
  body:JSON.stringify({faculty:[{
   id:'f1',name:'Fictional Faculty',department:'Office',
   destinationId,destinationName:'Fictional Faculty Office',building:'School Building'
  }]})
 }))
}
async function noOverflow(page,label){
 const {screen,content}=await page.evaluate(()=>({
  screen:window.innerWidth,content:document.documentElement.scrollWidth
 }))
 assert.ok(content<=screen+2,label+' horizontal overflow '+content+' > '+screen)
}
async function registration(browser,width){
 const page=await browser.newPage({viewport:{width,height:840},isMobile:width<768,hasTouch:width<768})
 const errors=[]
 page.on('pageerror',err=>errors.push(err.message))
 try{
  await intercept(page)
  await page.goto(base+'/pre-register',{waitUntil:'domcontentloaded'})
  await page.getByRole('heading',{name:'School Visitor Pre-Registration'}).waitFor({timeout:20000})
  await noOverflow(page,'new visitor '+width)
  await page.getByLabel('Full Legal Name *').fill('Fictional Guardian')
  await page.getByLabel('Contact Number *').fill('09170000000')
  await page.getByLabel('Visitor Type *').selectOption('Parent')
  await page.getByLabel('Purpose of Visit *').selectOption('Child Emergency')
  await page.getByLabel('Birthday *').fill('1980-01-02')
  await page.getByLabel('Address *').fill('Fictional Street')
  await page.getByLabel('Student Full Name *').fill('Fictional Child')
  await page.getByLabel('Student Grade *').fill('7')
  await page.getByLabel('Student Section *').fill('A')
  await page.locator('select').last().selectOption(destinationId)
  await page.locator('input[type="checkbox"]').check()
  await noOverflow(page,'guardian fields '+width)
  await page.getByRole('button',{name:/Continue to Face Verification/}).click()
  await page.getByRole('heading',{name:'Step 2 · Face Verification'}).waitFor({timeout:15000})
  await noOverflow(page,'face capture '+width)
  assert.equal(errors.length,0,'browser errors: '+errors.join('; '))
  console.log('PASS responsive registration '+width+'px')
 }finally{await page.close()}
}
async function returning(browser){
 const page=await browser.newPage({viewport:{width:375,height:800},isMobile:true,hasTouch:true})
 try{
  await intercept(page)
  await page.route('**/api/returning/otp',async route=>{
   if(route.request().method()==='GET'){
     await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
       freeSmsAvailable:true,manualRegistrationAvailable:true
     })})
     return
   }
   const req=route.request().postDataJSON()
   const body=req.action==='request'
    ?{message:'If this number has a saved visitor profile, a verification code has been sent. Check your SMS.'}
    :{verified:true,profile:{fullName:'Fictional Returning Guest',visitorType:'Guest'},
       notice:'Your mobile number is verified. A fresh face scan and security gate verification are still required.'}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
  })
  await page.goto(base+'/pre-register?returning=1',{waitUntil:'domcontentloaded'})
  await page.getByRole('heading',{name:'Returning Visitor',exact:true}).waitFor()
  await page.getByLabel('Contact Number *').fill('09170000000')
  await page.getByRole('button',{name:'Send Free SMS Code'}).click()
  await page.getByText(/If this number has a saved visitor profile/).waitFor()
  await page.getByLabel('One-time SMS code').fill('123456')
  await page.getByRole('button',{name:'Verify Code & Prefill Information'}).click()
  await page.getByText('Mobile number verified. Complete a fresh face scan and obtain gate approval.').waitFor()
  assert.equal(await page.getByLabel('Full Legal Name *').inputValue(),'Fictional Returning Guest')
  await noOverflow(page,'returning OTP 375px')
  console.log('PASS returning visitor OTP UX 375px')
 }finally{await page.close()}
}

async function returningFreeManual(browser){
 const page=await browser.newPage({viewport:{width:375,height:800},isMobile:true,hasTouch:true})
 try{
  await intercept(page)
  await page.route('**/api/returning/otp',route=>route.fulfill({
   status:200,contentType:'application/json',
   body:JSON.stringify({freeSmsAvailable:false,manualRegistrationAvailable:true})
  }))
  await page.goto(base+'/pre-register?returning=1',{waitUntil:'domcontentloaded'})
  await page.getByRole('heading',{name:'Returning Visitor',exact:true}).waitFor()
  await page.getByText('No SMS needed — complete the form to continue. No paid SMS gateway is required.').waitFor()
  assert.equal(await page.getByRole('button',{name:'Send Free SMS Code'}).count(),0)
  await page.getByLabel('Full Legal Name *').fill('Returning Fictional Guest')
  await page.getByLabel('Contact Number *').fill('09170000000')
  await page.getByLabel('Purpose of Visit *').selectOption('Teacher Appointment')
  await page.locator('select').last().selectOption(destinationId)
  await page.locator('input[type="checkbox"]').check()
  await page.getByRole('button',{name:/Continue to Face Verification/}).click()
  await page.getByRole('heading',{name:'Step 2 · Face Verification'}).waitFor()
  await noOverflow(page,'no-sms returning registration 375px')
  console.log('PASS no-cost returning registration without SMS')
 }finally{await page.close()}
}

async function pendingPass(browser){
 const page=await browser.newPage({viewport:{width:390,height:800},isMobile:true,hasTouch:true})
 try{
  await page.route('**/api/pre-register?token=*',route=>route.fulfill({
   status:200,contentType:'application/json',
   body:JSON.stringify({pass:{
    reference:'B98765432',name:'Fictional Visitor',type:'Guest',
    purpose:'Teacher Appointment',status:'PRE_REGISTERED',
    submittedAt:'2026-11-17T03:00:00.000Z',expiresAt:'2099-12-31T23:00:00.000Z',
    destination:'Fictional Faculty Office',building:'School Building',
    checkedIn:false,notice:'This pass does not allow entry'
   }})
  }))
  await page.goto(base+'/pass/'+token,{waitUntil:'domcontentloaded'})
  await page.getByRole('heading',{name:'My School Visit Pass'}).waitFor()
  await page.getByRole('link',{name:'Save QR Image for Offline Use'}).waitFor()
  assert.equal(await page.locator('a[href*="/visit/directions/"]').count(),0,
   'Pending visitor must not see authorized walking route')
  await noOverflow(page,'QR pass 390px')
  console.log('PASS offline-presentable pending QR 390px')
 }finally{await page.close()}
}
;(async()=>{
 const browser=await chromium.launch({headless:true})
 try{
  for(const w of [320,375,390,768,1280])await registration(browser,w)
  await returning(browser)
  await returningFreeManual(browser)
  await pendingPass(browser)
  console.log('All isolated visitor browser checks passed')
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1})
