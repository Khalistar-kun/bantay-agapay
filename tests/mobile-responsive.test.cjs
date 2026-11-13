/* Responsive layout regressions: source-level assertions, no live visitor data. */
const {test}=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const path=require('node:path')
const root=path.join(__dirname,'..')
const read=name=>fs.readFileSync(path.join(root,name),'utf8')

test('mobile visitor dashboard cards and camera stay within viewport',()=>{
  const css=read('public/client-demo/style.css')
  assert.match(css,/@media \(max-width: 630px\)/)
  assert.match(css,/\.workspace, \.dashboard-layout, \.sidebar-stack, \.mode-choice, \.form-grid \{ grid-template-columns: minmax\(0,1fr\); \}/)
  assert.match(css,/\.face-box \{ width: min\(100%, 390px\); aspect-ratio: 1\/1; \}/)
  assert.match(css,/#qr-video\s*\{[^}]*transform: none !important;/s)
  assert.match(css,/@media \(max-width: 390px\)/)
  assert.match(css,/\.stats, \.review-list, \.pass-details \{ grid-template-columns: minmax\(0,1fr\); \}/)
  assert.match(css,/\.topbar \{ gap: 8px; padding: 10px 12px; height: auto;/)
});

test('visitor tables render as stacked mobile cards without forcing horizontal width',()=>{
  const css=read('public/client-demo/style.css')
  const js=read('public/client-demo/script.js')
  assert.match(css,/\.table \{ min-width: 0; display: block; width: 100%;/)
  assert.match(css,/\.table tbody tr\s*\{\s*display: block; min-width: 0;/s)
  assert.match(css,/\.table tbody td:not\(\.empty\)::before\s*\{\s*content: attr\(data-label\)/s)
  for(const label of ['Visitor','Reference','Name','Destination','Registered','Status']) {
    assert.ok(js.includes('data-label="'+label+'"'),label)
  }
});

test('visitor campus map fits small screens and zoom only scrolls inside map panel',()=>{
  const v=read('app/visit/directions/[token]/page.tsx')
  assert.match(v,/w-full max-w-full min-w-0 overflow-x-auto overflow-y-auto overscroll-x-contain/)
  assert.match(v,/zoom \? "w-\[820px\] min-w-\[820px\]" : "w-full min-w-0"/)
  assert.match(v,/w-full sm:w-auto rounded-xl border/)
  assert.match(v,/flex flex-col sm:flex-row gap-3 pb-4/)
  assert.match(v,/markerMid="url\(#wayfinding-arrow\)"/)
});

test('administrator campus editor and destination cards stack on phones',()=>{
  const a=read('app/admin/wayfinding/page.tsx')
  const d=read('app/admin/destinations/page.tsx')
  assert.match(a,/Zoom map for accurate pinning/)
  assert.match(a,/max-w-full min-w-0 overflow-x-auto overscroll-x-contain/)
  assert.match(a,/grid min-w-0 grid-cols-1 gap-4/)
  assert.match(a,/grid min-w-0 grid-cols-1 sm:grid-cols-2 gap-2/)
  assert.match(d,/p-4 sm:p-6 flex flex-col sm:flex-row/)
  assert.match(d,/flex flex-col sm:flex-row sm:justify-between/)
});

test('original Next.js routes protect against viewport-wide overflow without resizing camera media',()=>{
  const css=read('app/globals.css')
  assert.match(css,/body \{ overflow-x: clip; \}/)
  assert.match(css,/main \.grid > \*, main \.flex > \* \{ min-width: 0; \}/)
  assert.doesNotMatch(css,/main img, main video \{ height: auto/)
});
