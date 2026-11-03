const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const base = path.resolve(__dirname, '..', 'public', 'client-demo')

test('intro is logo-only and loads assets from the same origin', () => {
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8')
  assert.match(html, /id="ba-splash"/)
  assert.match(html, /class="ba-splash-logo"/)
  assert.match(html, /\/client-demo\/bantay-agapay-logo\.png/)
  assert.match(html, /\/client-demo\/intro\.css/)
  assert.match(html, /\/client-demo\/intro\.js/)
  assert.doesNotMatch(html, /ba-intro-logo-card|ba-intro-orbit|ba-intro-heading|ba-intro-loading|ba-intro-skip/)
})
test('logo fills the viewport and fades away without a card', () => {
  const css = fs.readFileSync(path.join(base, 'intro.css'), 'utf8')
  assert.match(css, /width: min\(92vw, 980px\)/)
  assert.match(css, /@keyframes logoZoom/)
  assert.match(css, /@keyframes splashFade/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(css, /\.ba-intro-logo-card|\.ba-intro-orbit/)
})
test('splash runs on each load, never relies on sessionStorage, and allows skip', () => {
  const js = fs.readFileSync(path.join(base, 'intro.js'), 'utf8')
  assert.doesNotMatch(js, /sessionStorage|localStorage|ba_intro_seen/)
  assert.doesNotThrow(() => new vm.Script(js))
  for (let run = 0; run < 2; run++) {
    let removed = 0, ms = null, timeoutCallback, clickCallback, keyCallback
    const splash = { isConnected: true, remove() { removed++; this.isConnected = false }, addEventListener(type, cb) { if(type === 'click') clickCallback = cb } }
    const document = { getElementById() { return splash }, addEventListener(type, cb) { if(type === 'keydown') keyCallback = cb } }
    const window = { matchMedia() { return { matches: false } }, setTimeout(cb, delay) { timeoutCallback = cb; ms = delay; return 1 }, clearTimeout() {} }
    vm.runInNewContext(js, { document, window })
    assert.equal(ms, 1900)
    if (run === 0) timeoutCallback()
    else clickCallback()
    assert.equal(removed, 1)
    keyCallback({ key: 'Escape' })
    assert.equal(removed, 1)
  }
})
test('reduced motion never shows or holds the splash', () => {
  const js = fs.readFileSync(path.join(base, 'intro.js'), 'utf8')
  let removed = 0, timer = false
  const document = { getElementById: () => ({ remove() { removed++ } }) }
  const window = { matchMedia: () => ({ matches: true }), setTimeout() { timer = true } }
  vm.runInNewContext(js, { document, window })
  assert.equal(removed, 1)
  assert.equal(timer, false)
})
