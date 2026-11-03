const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const root = path.join(__dirname,'..')
const config = require(path.join(root,'next.config.js'))

test('production homepage and /visit reuse the client facing interface',async()=>{
  const rewrites = await config.rewrites()
  assert.deepEqual(rewrites.beforeFiles,[
    {source:'/',destination:'/client-demo/index.html'},
    {source:'/visit',destination:'/client-demo/index.html'},
  ])
})
test('client-facing static assets use absolute paths on rewritten routes',()=>{
  const html=fs.readFileSync(path.join(root,'public/client-demo/index.html'),'utf8')
  for(const asset of ['style.css','script.js','qrcode-offline.js','bantay-agapay-logo.png']){
    assert.ok(html.includes('/client-demo/'+asset),asset)
  }
  const script=fs.readFileSync(path.join(root,'public/client-demo/script.js'),'utf8')
  assert.ok(script.includes('/client-demo/bantay-agapay-logo.png'))
})
test('live production defaults to connected mode and cannot enable demo mode',()=>{
  const script=fs.readFileSync(path.join(root,'public/client-demo/script.js'),'utf8')
  assert.match(script,/location\.hostname === 'bantay-agapay\.vercel\.app'/)
  assert.match(script,/isLiveProduction\?'connected'/)
  assert.match(script,/if\(isLiveProduction\)\{toast\('Demo mode is not available/)
})
