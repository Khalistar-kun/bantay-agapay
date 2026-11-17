/* Browser-level visitor UX checks using mock API replies and fictional data.
 * Never calls live Supabase, sends SMS, or modifies visitor records.
 */
const assert=require('node:assert/strict')
const {chromium}=require('playwright')

const base=process.env.BA_BROWSER_BASE_URL||'http://127.0.0.1:3100'
const destinationId='c1d74422-21b1-4834-9a87-10f70ee345c2'
const token='a'.repeat(32)

async function intercept(page){
 await page.route('**/api/returning/otp',async route=>{
  if(route.request().method()==='GET'){
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({
    verificationRequired:true,freeSmsAvailable:true,manualRegistrationAvailable:false
   })})
   return
  }
  const request=route.request().postDataJSON()
  const body=request.action==='request'
   ?{message:'An SMS verification code was queued.'}
   :{verified:true,verificationToken:'b'.repeat(64),
     profile:{fullName:'Fictional Returning Guest',visitorType:'Guest'},
     notice:'Phone verified. Finish registration within ten minutes.'}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
 })
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
  assert.equal(await page.getByRole('button',{name:/Continue to Face Verification/}).isDisabled(),true,
   'New visitor must verify SMS before face capture')
  await page.getByRole('button',{name:'Send Free SMS Code'}).click()
  await page.getByLabel('One-time SMS code').fill('123456')
  await page.getByRole('button',{name:'Verify SMS Code'}).click()
  await page.getByText(/Mobile number verified. Complete registration/).waitFor()
  assert.equal(await page.getByRole('button',{name:/Continue to Face Verification/}).isEnabled(),true)
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
  await page.goto(base+'/pre-register?returning=1',{waitUntil:'domcontentloaded'})
  await page.getByRole('heading',{name:'Returning Visitor',exact:true}).waitFor()
  await page.getByLabel('Contact Number *').fill('09170000000')
  await page.getByRole('button',{name:'Send Free SMS Code'}).click()
  await page.getByText(/An SMS verification code was queued/).waitFor()
  await page.getByLabel('One-time SMS code').fill('123456')
  await page.getByRole('button',{name:'Verify SMS Code'}).click()
  await page.getByText(/Mobile number verified. Complete registration/).waitFor()
  assert.equal(await page.getByLabel('Full Legal Name *').inputValue(),'Fictional Returning Guest')
  await page.getByLabel('Contact Number *').fill('09170000001')
  assert.equal(await page.getByRole('button',{name:/Continue to Face Verification/}).isDisabled(),true,
   'Editing phone after verification invalidates proof')
  await noOverflow(page,'returning OTP 375px')
  console.log('PASS returning visitor OTP UX 375px')
 }finally{await page.close()}
}

async function unavailableSmsBlocksRegistration(browser){
 const page=await browser.newPage({viewport:{width:375,height:800},isMobile:true,hasTouch:true})
 try{
  await intercept(page)
  await page.route('**/api/returning/otp',route=>route.fulfill({
   status:200,contentType:'application/json',
   body:JSON.stringify({freeSmsAvailable:false,verificationRequired:true,manualRegistrationAvailable:false})
  }))
  await page.goto(base+'/pre-register?returning=1',{waitUntil:'domcontentloaded'})
  await page.getByRole('heading',{name:'Returning Visitor',exact:true}).waitFor()
  await page.getByText(/Online registration is paused/).waitFor()
  assert.equal(await page.getByRole('button',{name:'Send Free SMS Code'}).isDisabled(),true)
  await page.getByLabel('Full Legal Name *').fill('Returning Fictional Guest')
  await page.getByLabel('Contact Number *').fill('09170000000')
  await page.getByLabel('Purpose of Visit *').selectOption('Teacher Appointment')
  await page.locator('select').last().selectOption(destinationId)
  await page.locator('input[type="checkbox"]').check()
  // Fail-closed: the next-step control remains disabled, not clickable.
  assert.equal(await page.getByRole('button',{name:/Continue to Face Verification/}).isDisabled(),true)
  await noOverflow(page,'SMS unavailable 375px')
  console.log('PASS free-only SMS unavailable blocks registration')
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
  await unavailableSmsBlocksRegistration(browser)
  await pendingPass(browser)
  console.log('All isolated visitor browser checks passed')
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1})
