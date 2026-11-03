const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const base = path.resolve(__dirname, '..', 'public', 'client-demo')

test('cinematic opening keeps the original huge logo and no card or text', () => {
  const html = fs.readFileSync(path.join(base, 'index.html'), 'utf8')
  assert.match(html, /id="ba-splash"/)
  assert.match(html, /class="ba-splash-logo"/)
  assert.match(html, /\/client-demo\/bantay-agapay-logo\.png/)
  assert.match(html, /class="ba-splash-rings"/)
  assert.match(html, /id="ba-splash-stars"/)
  assert.match(html, /\/client-demo\/intro\.css/)
  assert.match(html, /\/client-demo\/intro\.js/)
  assert.doesNotMatch(html, /ba-intro-logo-card|ba-intro-heading|ba-intro-loading/)
})

test('wine gradient, dramatic reveal, pulses and accessible reduced motion', () => {
  const css = fs.readFileSync(path.join(base, 'intro.css'), 'utf8')
  assert.match(css, /radial-gradient\(ellipse at 50% 40%, #b6304b/)
  assert.match(css, /width: min\(93vw, 1000px\)/)
  assert.match(css, /@keyframes ba-logo-hero/)
  assert.match(css, /@keyframes ba-ring-bloom/)
  assert.match(css, /@keyframes ba-guardian-wave/)
  assert.match(css, /@keyframes ba-scene-depart/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.doesNotMatch(css, /\.ba-intro-logo-card/)
})

test('every full load replays without storage, while click and Escape skip', () => {
  const js = fs.readFileSync(path.join(base, 'intro.js'), 'utf8')
  assert.doesNotMatch(js, /sessionStorage|localStorage/)
  assert.doesNotThrow(() => new vm.Script(js))
  for (let run = 0; run < 3; run++) {
    let removed = 0, registered = {}, delay, cb
    const splash = {
      isConnected: true,
      remove() { this.isConnected = false; removed++ },
      addEventListener(name, fn) { registered[name] = fn },
    }
    const stars = { children: [], appendChild(node) { this.children.push(node) } }
    const doc = {
      getElementById(id) { return id === 'ba-splash' ? splash : id === 'ba-splash-stars' ? stars : null },
      createElement() { return {style: {setProperty() {}}} },
      addEventListener(name, fn) { registered[name] = fn },
      removeEventListener(name) { delete registered[name] },
    }
    const win = {
      matchMedia() { return {matches:false} },
      setTimeout(fn, ms) { delay=ms; cb=fn; return 1 },
      clearTimeout() {},
    }
    vm.runInNewContext(js, {document:doc, window:win, Math})
    assert.equal(stars.children.length, 24)
    assert.equal(delay, 4150)
    if (run === 0) cb()
    if (run === 1) registered.click()
    if (run === 2) registered.keydown({key:'Escape'})
    assert.equal(removed, 1)
    cb()
    assert.equal(removed, 1)
  }
})

test('reduced-motion users do not wait for the animation', () => {
  const js = fs.readFileSync(path.join(base, 'intro.js'), 'utf8')
  let removed = 0
  const doc = {getElementById(){return {remove(){removed++}}}}
  const win = {matchMedia(){return {matches:true}}, setTimeout(){throw new Error('should not schedule timer')}}
  vm.runInNewContext(js, {document:doc,window:win})
  assert.equal(removed, 1)
})
