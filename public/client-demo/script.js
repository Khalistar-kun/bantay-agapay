/* Bantay-Agapay: Plain HTML, CSS and JavaScript client.
   Offline demo data: localStorage only. Connected mode: same-origin Next.js APIs.
   DO NOT put service role keys or private database credentials in this file. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const appRoot = $('#app');
  const STORAGE = 'bantay_agapay_offline_demo_v4';
  const DESTS = [
    { id: 'demo-office', name: 'Administration Office', building: 'Admin Building', room_number:'101' },
    { id: 'demo-registrar', name: "Registrar's Office", building: 'Admin Building', room_number:'102' },
    { id: 'demo-clinic', name: 'Clinic', building: 'Main Building', room_number:'105' },
    { id: 'demo-library', name: 'Library', building: 'Academic Building', room_number:'201' },
    { id: 'demo-guidance', name: 'Guidance Office', building: 'Academic Building', room_number:'103' },
    { id: 'demo-faculty', name: 'Faculty Office', building: 'Academic Building', room_number:'202' },
    { id: 'demo-principal', name: "Principal's Office", building: 'Admin Building', room_number:'103' },
    { id: 'demo-security', name: 'Security Office', building: 'Main Gate', room_number:'Gate 1' },
  ];
  const nowIso = () => new Date().toISOString();
  const generateToken = () => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) return [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2,'0')).join('');
    return Array.from({length:32},() => '0123456789abcdef'[Math.floor(Math.random()*16)]).join('');
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const dateFmt = (d) => d ? new Date(d).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : '—';
  const status = (s) => `<span class="status ${String(s).toLowerCase()}">${({PENDING:'● Awaiting approval',INSIDE:'✓ Checked in',EXITED:'✓ Checked out',DENIED:'× Entry denied'})[s]||esc(s)}</span>`;
  const initials = (s) => esc(String(s||'?').trim().slice(0,1).toUpperCase());
  const makeDemo = () => {
    const a = new Date(Date.now()-1000*60*29).toISOString();
    const b = new Date(Date.now()-1000*60*87).toISOString();
    return {visits:[
      {id:'demo-one',token:'ba0d72c98710f5a3305de59a6d322101',reference:'F-214',name:'Maria Santos',phone:'09171234567',visitorType:'Parent',purpose:'Visit student adviser',destination:DESTS[5].name,destinationId:DESTS[5].id,building:DESTS[5].building,photo:'',status:'PENDING',registeredAt:a,checkIn:null,checkOut:null},
      {id:'demo-two',token:'ba0d72c98710f5a3305de59a6d322102',reference:'M-105',name:'Joel Reyes',phone:'09172345678',visitorType:'Guest',purpose:'Submit documents',destination:DESTS[1].name,destinationId:DESTS[1].id,building:DESTS[1].building,photo:'',status:'INSIDE',registeredAt:b,checkIn:a,checkOut:null},
      {id:'demo-three',token:'ba0d72c98710f5a3305de59a6d322103',reference:'R-309',name:'Ana Cruz',phone:'09173456789',visitorType:'Alumni',purpose:'Alumni inquiry',destination:DESTS[3].name,destinationId:DESTS[3].id,building:DESTS[3].building,photo:'',status:'EXITED',registeredAt:b,checkIn:b,checkOut:a},
    ], logs:[]};
  };
  function dbLoad(){try { const data=JSON.parse(localStorage.getItem(STORAGE));if(data&&Array.isArray(data.visits))return data;}catch{} const d=makeDemo(); dbSave(d);return d;}
  function dbSave(d){try{localStorage.setItem(STORAGE,JSON.stringify(d));}catch(e){console.warn('Storage capacity reached',e);}}
  let db=dbLoad();
  const sameOrigin = location.protocol === 'http:' || location.protocol === 'https:';
  const isLiveProduction = sameOrigin && location.hostname === 'bantay-agapay.vercel.app';
  const fromLocal = location.protocol === 'file:';
  let preferred=isLiveProduction?'connected':localStorage.getItem('ba_demo_mode');
  if(!['offline','connected'].includes(preferred))preferred=sameOrigin?'connected':'offline';
  const state={mode:isLiveProduction?'connected':fromLocal?'offline':preferred, role:'visitor',view:'welcome',step:0,form:{},photo:'',faceScanReady:false,faceScanPercent:0,faceReviewOnly:false,faceScanStatus:'Start the camera to check face presence and motion.',gps:null,gpsVerified:false,gpsLoading:false,gpsError:'',token:sessionStorage.getItem('ba_last_pass')||'',loginRole:'security',staffName:'',staffRole:'',staffLoggedIn:false,destinations:[...DESTS],pending:[],inside:[],history:[],summary:null,selected:null,filter:'',scanning:false,submitting:false};
  let cameraStream=null, scanTimer=null, pollTimer=null, notificationTimer=null;
  let faceScanSession=null, cameraSerial=0;
  const toast = (msg) => { const el=$('#toast');el.textContent=msg;el.classList.add('visible');clearTimeout(notificationTimer);notificationTimer=setTimeout(()=>el.classList.remove('visible'),4200);};
  async function request(path,opts={}){
    if(state.mode!=='connected') throw Error('Connected mode is not active.');
    let r;
    try{r=await fetch(path,{credentials:'same-origin',cache:'no-store',...opts,headers:{'Accept':'application/json',...(opts.body?{'Content-Type':'application/json'}:{}),...(opts.headers||{})}});}
    catch{throw Error('Unable to reach the school backend. Confirm internet access and that this page is hosted on your Vercel site.');}
    const obj=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(obj.error||`Backend error (${r.status}).`);
    return obj;
  }
  async function loadDestinations(){
    if(state.mode==='offline'){state.destinations=[...DESTS];return;}
    try {const data=await request('/api/client-demo?action=destinations');state.destinations=data.destinations||[];}
    catch(e){state.destinations=[];toast(e.message);}
  }
  function stopCamera(){ cameraSerial++;if(faceScanSession){faceScanSession.stop();faceScanSession=null;}state.faceScanReady=false;if(scanTimer){clearInterval(scanTimer);scanTimer=null;}if(cameraStream){cameraStream.getTracks().forEach(t=>t.stop());cameraStream=null;}state.scanning=false; }
  function navigate(view){stopCamera();state.view=view;window.scrollTo(0,0);render();}
  function shell(content){
    let label=isLiveProduction?'Live school portal':state.mode==='offline'?'Offline demo':'Connected backend';
    return `<div class="shell"><header class="topbar"><a class="brand" href="#" data-action="home"><img src="/client-demo/bantay-agapay-logo.png" alt="Bantay-Agapay logo"><div><strong>BANTAY-AGAPAY</strong><span>AFGBMTS Visitor Monitoring</span></div></a><div class="top-actions"><span class="tag ${state.mode==='offline'?'offline':'online'}">${label}</span><button class="btn small secondary" data-action="switch-mode" style="${isLiveProduction?'display:none':''}">${state.mode==='offline'?'Connect':'Demo mode'}</button><button class="btn small ghost" data-action="home">Home</button></div></header><main class="main">${content}<footer class="footer">Bantay-Agapay · Assemblywoman Felicita G. Bernardino Memorial Trade School · ${state.mode==='offline'?'Demonstration only — fictional data':'Connected to your existing school backend'}</footer></main></div>`;
  }
  const hero=(title,sub,kicker='Visitor management')=>`<section class="hero"><div><div class="eyebrow">${esc(kicker)}</div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div><div class="hero-icon">◎</div></section>`;
  const guide=()=>`<aside class="sidebar-stack"><div class="panel panel-pad"><div class="panel-head"><div><h2>Simple, secure visits</h2><p>What happens at the school gate</p></div></div>${[['1','Register','Tell us who you are and where you are going.'],['2','Capture photo','Security checks the face photo manually.'],['3','Show QR pass','Wait for the guard to approve entry.'],['4','Check out','Show the same QR pass before leaving.']].map(([i,t,d])=>`<div class="guide-item"><span class="guide-num">${i}</span><div><h3>${t}</h3><p>${d}</p></div></div>`).join('')}</div><div class="panel panel-pad"><div class="mini-brand"><img src="/client-demo/bantay-agapay-logo.png" alt=""><div><strong>AFGBMTS</strong><p class="muted small">Lias, Marilao, Bulacan</p></div></div><div class="line"></div><p class="muted small">${state.mode==='offline'?'All records are fictional and stay in this browser. No internet is required.':'Registration and security actions use your existing Next.js API and Supabase database.'}</p></div></aside>`;
  const wizard=()=>`<div class="steps">${[['1','Your details'],['2','Face capture'],['3','Campus GPS'],['4','QR pass']].map(([n,s],i)=>`<div class="step ${i<state.step?'done':i===state.step?'active':''}"><span class="step-num">${i<state.step?'✓':n}</span><span>${s}</span></div>`).join('')}</div>`;
  const destOptions=()=>state.destinations.map(d=>`<option value="${esc(d.id)}" ${state.form.destinationId===d.id?'selected':''}>${esc(d.name)} (${esc(d.building||'Campus')})</option>`).join('');
  function visitorWelcome(){return shell(hero('A warm welcome. A safer campus.','Register, have your photo checked by security, and use one QR pass for both arrival and departure.')+`<div class="workspace"><div class="panel panel-pad"><span class="eyebrow">Welcome to AFGBMTS</span><h2 style="margin:9px 0">How can we help you today?</h2><p class="muted">Visitor check-in is designed to take just a few simple steps.</p><div class="welcome-actions"><button class="btn" data-action="begin">Register a new visit →</button><button class="btn secondary" data-action="restore-pass">View my QR pass</button><a class="btn secondary" href="/visit/returning">Returning visitor ↺</a></div><div class="line"></div><div class="mode-choice"><button class="choice" data-action="begin"><div class="choice-icon">◉</div><strong>New visitor</strong><span>Register and capture your photo</span></button><a class="choice" href="/visit/returning"><div class="choice-icon">↺</div><strong>Returning visitor</strong><span>Re-register using the school’s existing returning-visitor workflow</span></a><button class="choice" data-action="go-staff"><div class="choice-icon">▦</div><strong>Security / Admin</strong><span>Review QR passes and process entry and exit</span></button></div></div>${guide()}</div>`);}
  function infoPage(){return shell(hero('Visitor registration','Complete the same core visitor details used in your school registration workflow.','Step 1 · Your information')+`<div class="workspace"><section class="panel panel-pad">${wizard()}<div class="panel-head"><div><h2>Tell us about your visit</h2><p>All fields are required.</p></div></div>${state.mode==='connected'&&state.destinations.length===0?`<div class="message denied">School destinations could not be loaded. Connected registration is unavailable until the backend responds.</div>`:''}<form id="visitor-form"><div class="form-grid"><div class="field wide"><label>Full name <em>*</em></label><input name="fullName" minlength="3" maxlength="100" autocomplete="name" required placeholder="Enter your full name" value="${esc(state.form.fullName||'')}"></div><div class="field"><label>Contact number <em>*</em></label><input name="contactNumber" type="tel" autocomplete="tel" required pattern="09[0-9]{9}" title="Enter 11 digits starting with 09" placeholder="09XXXXXXXXX" value="${esc(state.form.contactNumber||'')}"></div><div class="field"><label>Visitor type <em>*</em></label><select name="visitorType" required><option value="">Choose type</option>${[['Parent','Parent / Guardian'],['Alumni','Alumni'],['Guest','Guest'],['Supplier','Supplier / Contractor'],['Government','Government / Official'],['Other','Other']].map(([v,t])=>`<option value="${v}" ${state.form.visitorType===v?'selected':''}>${t}</option>`).join('')}</select></div><div class="field wide"><label>Purpose of visit <em>*</em></label><input name="purpose" required maxlength="240" placeholder="e.g., Meet a teacher, submit documents" value="${esc(state.form.purpose||'')}"></div><div class="field wide"><label>Where are you going? <em>*</em></label><select name="destinationId" required><option value="">Select a destination</option>${destOptions()}</select></div></div>${state.mode==='connected'?'<div class="note"><label style="display:flex;align-items:flex-start;gap:10px"><input type="checkbox" name="privacyConsent" required style="margin-top:5px"><span>I understand that my name, contact information, visit details, and photo will be processed for school visitor registration and security review. For privacy questions, contact the school administration.</span></label></div>':''}<div class="foot-actions"><button type="button" class="btn ghost" data-action="home">Back</button><button type="submit" class="btn" ${state.destinations.length===0?'disabled':''}>Continue to photo →</button></div></form></section>${guide()}</div>`);}
  function facePage(){
    const pic=state.photo?'<img src="'+esc(state.photo)+'" alt="Your captured visitor photo">':'<div class="face-placeholder"><span class="face-symbol">◎</span><strong>Position your face in the center</strong><p class="small muted">Start the scanner, blink, then turn your head to each side when prompted.</p></div>';
    const label=state.faceReviewOnly?'Photo for manual guard review':'Face-motion prompts completed; guard identity review required';
    return shell(hero('Face photo scanning','Detect one face, follow basic motion prompts, and take a photo for staff review. This does not verify identity.','Step 2 · Face scanning')+
      '<div class="workspace"><section class="panel panel-pad">'+wizard()+
      '<div class="note"><strong>Privacy and access</strong> — Live camera frames are analyzed on your device. The final image is sent to the school backend only when you register. A guard must approve entry. Face motion is not proof of liveness or identity.</div>'+
      '<div class="face-box" id="face-holder">'+pic+(state.photo?'<span class="face-badge">Photo ready ✓</span>':'')+'</div>'+
      '<p id="face-scan-status" class="note" role="status" aria-live="polite">'+esc(state.photo?label:state.faceScanStatus)+'</p>'+
      '<div class="face-progress" role="progressbar" aria-label="Face motion scan progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+(state.faceScanPercent||0)+'"><span id="face-progress-fill" style="width:'+(state.faceScanPercent||0)+'%"></span></div>'+
      '<div class="pill-row"><button type="button" class="btn secondary" data-action="start-camera">📷 Start face scan</button>'+
      '<button type="button" class="btn light" id="face-capture-btn" data-action="capture-camera" disabled>Capture scanned photo</button>'+
      '<button type="button" class="btn ghost" id="face-manual-btn" data-action="capture-manual" disabled>Use camera photo for manual review</button>'+
      '<label class="btn secondary" for="face-upload">Upload for manual review</label>'+
      '<input id="face-upload" type="file" accept="image/*" capture="user" hidden>'+
      '<button type="button" class="btn ghost" data-action="retake">Retake</button></div>'+
      (state.mode==='offline'?'<button type="button" class="btn small ghost" data-action="placeholder-photo">Use fictional demo face placeholder</button>':'')+
      '<div class="line"></div><div class="note">If your device cannot scan faces, use the manual-review option. Photo upload never counts as a completed scan.</div>'+
      (state.mode==='offline'?'<div class="note"><strong>Location check:</strong> <span id="gps-status">Optional in the offline demo.</span> <button class="btn small ghost" data-action="gps">Use my location</button></div>':'<div class="note">Next: campus GPS, followed by manual guard approval.</div>')+
      '<div class="foot-actions"><button class="btn ghost" data-action="back-info">← Back</button><button class="btn" data-action="'+(state.mode==='connected'?'go-gps':'submit-visit')+'" '+(!state.photo||state.submitting?'disabled':'')+'>'+(state.submitting?'Saving...':state.mode==='connected'?'Verify campus GPS →':'Generate my QR pass →')+'</button></div></section>'+guide()+'</div>');
  }
  function findMyVisit(){return db.visits.find(v=>v.token===state.token)||null;}
  function qrPanel(visit){if(!visit)return `<div class="empty">No pass found. Register a visit first.</div>`;
    const s=visit.status||'PENDING';
    return `<div class="pass"><div>${status(s)}</div><h2 style="margin:17px 0 5px">${esc(visit.name||visit.visitor_name||'Visitor')}</h2><p class="muted small">Visitor reference</p><div class="refcode">${esc(visit.reference||visit.reference_number||'—')}</div><canvas id="qr-canvas" width="240" height="240" aria-label="QR visitor pass"></canvas><div class="qr-token">${esc(visit.token||state.token)}</div><div class="pass-details"><div><span class="muted">Destination</span><b>${esc(visit.destination||visit.destination_name||'Campus')}</b></div><div><span class="muted">Visit status</span><b>${esc(s==='PENDING'?'Security review':s==='INSIDE'?'On campus':s==='EXITED'?'Visit complete':'Denied')}</b></div></div><div class="message ${s.toLowerCase()}">${s==='PENDING'?'Show this QR code to the security guard and wait for entry approval. You are not yet checked in.':s==='INSIDE'?'Entry approved. You may proceed to your destination. Keep this same QR code and show it to security before leaving.':s==='EXITED'?'Your check-out has been recorded. Thank you for visiting AFGBMTS.':'Security did not approve this entry. Please ask for assistance.'}</div><div class="pill-row" style="justify-content:center"><button class="btn secondary small" data-action="download-qr">Download QR</button>${s==='INSIDE'?'<button class="btn small" data-action="directions">Campus directions</button>':''}<button class="btn ghost small" data-action="refresh-pass">Refresh status</button></div></div>`;
  }

  function gpsPage() {
    return shell(hero('Verify campus location',
      'Confirm that your device is within the authorized school check-in area before requesting a visitor pass.',
      'Step 3 · Campus GPS')+
      '<div class="workspace"><section class="panel panel-pad">'+wizard()+
      '<div class="panel-head"><div><h2>Campus location check</h2><p>Enable location access for this website, then verify your location.</p></div></div>'+
      '<div class="note"><strong>Privacy:</strong> Your device location is checked against the configured school boundary and saved to the visit verification log. GPS can be inaccurate or spoofed, so a security guard must still approve entry.</div>'+
      (state.gpsError?'<div class="message denied" role="alert">'+esc(state.gpsError)+'</div>':'')+
      (state.gpsVerified?'<div class="message">✓ Your device reports a location inside the authorized check-in area. Security must still review your registration.</div>':'')+
      '<div class="foot-actions"><button type="button" class="btn ghost" data-action="back-face">← Back to photo</button>'+
      '<button type="button" class="btn secondary" data-action="gps-check" '+(state.gpsLoading?'disabled':'')+'>'+(state.gpsLoading?'Checking location…':'📍 Verify my location')+'</button>'+
      '<button type="button" class="btn" data-action="submit-visit" '+(!state.gpsVerified||state.submitting?'disabled':'')+'>'+(state.submitting?'Saving…':'Generate my QR pass →')+'</button></div>'+
      '</section>'+guide()+'</div>');
  }

  function metersBetween(lat1,lon1,lat2,lon2) {
    const rad=Math.PI/180,dLat=(lat2-lat1)*rad,dLon=(lon2-lon1)*rad;
    const a=Math.sin(dLat/2)**2+Math.cos(lat1*rad)*Math.cos(lat2*rad)*Math.sin(dLon/2)**2;
    return 6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)));
  }
  async function verifyCampusGps() {
    if(state.gpsLoading)return;
    state.gpsLoading=true;
    state.gpsError='';
    state.gpsVerified=false;
    state.gps=null;
    render();
    try {
      if(!navigator.geolocation)throw Error('This browser cannot provide GPS. Enable location services and try again on campus.');
      const data=await request('/api/client-demo?action=geofence');
      const boundary=data.boundary;
      if(!boundary || !Number.isFinite(boundary.latitude) || !Number.isFinite(boundary.longitude) || !Number.isFinite(boundary.radius))throw Error('Campus location settings are unavailable.');
      const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{
        enableHighAccuracy:true,maximumAge:0,timeout:12000
      }));
      const latitude=position.coords.latitude,longitude=position.coords.longitude,accuracy=position.coords.accuracy;
      if(!Number.isFinite(accuracy)||accuracy<=0||accuracy>150)throw Error('Location accuracy is too low. Turn on high accuracy GPS and try again closer to the school entrance.');
      const distance=metersBetween(latitude,longitude,boundary.latitude,boundary.longitude);
      if(distance>boundary.radius)throw Error('Your device is outside the school registration boundary. Please register at the school gate.');
      state.gps={latitude,longitude,accuracy,capturedAt:new Date().toISOString()};
      state.gpsVerified=true;
      toast('Campus location checked. Submit your registration for security approval.');
    } catch(e) {
      state.gpsError=e?.message||'Could not verify your location. Enable GPS and try again.';
      toast(state.gpsError);
    } finally {
      state.gpsLoading=false;
      if(state.view==='gps')render();
    }
  }
  function passPage(){let v=state.mode==='offline'?findMyVisit():state.currentPass;if(!v && state.mode==='connected'&&state.token){v={token:state.token,status:'PENDING',name:state.form.fullName||'Visitor',reference:state.form.referenceNumber||'',destination:state.form.destinationName||''};}
    return shell(hero('Your visitor QR pass','One QR code for gate approval and check-out. Keep this pass accessible throughout your visit.','Step 3 · Visit status')+`<div class="workspace"><section class="panel panel-pad"><div class="panel-head"><div><h2>Visit pass</h2><p>${state.mode==='connected'?'Status is synchronized with the backend':'Changes are synchronized within this browser'}</p></div></div>${qrPanel(v)}<div class="line"></div><button class="btn ghost small" data-action="home">Register another visitor</button></section>${guide()}</div>`);
  }
  function directionsPage(){let v=state.mode==='offline'?findMyVisit():state.currentPass;return shell(hero('Campus directions','Follow the map and ask security for assistance whenever needed.','Visitor wayfinding')+`<div class="workspace"><section class="panel panel-pad"><div class="split-header"><h2>Illustrative AFGBMTS campus map</h2><button class="btn secondary small" data-action="pass">My QR pass</button></div><div class="map"><div class="building a">Administration</div><div class="building b">Academic Building</div><div class="building c">Clinic & Library</div><span class="map-pin">📍</span><span class="map-target">●</span><span class="map-name">Main Gate → ${esc(v?.destination||v?.destination_name||'Destination')}</span></div><div class="route"><span class="kv">Start: Main Gate</span><span>→</span><span class="kv">Destination: <strong>${esc(v?.destination||v?.destination_name||'School Office')}</strong></span></div><div class="message">Map is illustrative, not a surveyed GPS route. Confirm your building with the security guard.</div></section>${guide()}</div>`);}
  function loginPage(){return shell(hero('Security & administration','Authorized personnel manage approvals, campus entry, and departure scanning.','Staff access')+`<div class="login-wrap"><div class="panel panel-pad"><h2>Staff sign-in</h2><p class="muted small" style="margin:8px 0 21px">${state.mode==='connected'?'Sign in using the phone number and password already assigned in your school system.':'Offline demo accounts are fictional and have no real security permissions.'}</p><form id="staff-login"><div class="field"><label>${state.mode==='connected'?'Staff phone number':'Username'}</label><input required name="user" autocomplete="username" placeholder="${state.mode==='connected'?'09XXXXXXXXX':'security or admin'}"></div><div class="field" style="margin-top:16px"><label>Password</label><input required type="password" name="password" autocomplete="current-password" placeholder="Enter password"></div><div class="foot-actions"><button class="btn full">Sign in →</button></div></form>${state.mode==='offline'?'<div class="notice-bar">Demo: <strong>security / security123</strong> or <strong>admin / admin123</strong></div>':''}</div></div>`);}
  function visitList(kind){const items=kind==='pending'?state.pending:state.inside;const filtered=items.filter(v=>!state.filter||`${v.name||v.full_name||''} ${v.reference||v.reference_number||''} ${v.destination||v.destination_name||''}`.toLowerCase().includes(state.filter.toLowerCase()));return `<div class="panel"><div class="panel-pad" style="padding-bottom:10px"><div class="split-header"><div><h2>${kind==='pending'?'Pending entry approval':'Currently on campus'}</h2><p class="small muted">${kind==='pending'?'Visitors who have not been checked in yet':'Visitors awaiting their exit scan'}</p></div><input class="inline-search" id="search-list" placeholder="Search records" value="${esc(state.filter)}" aria-label="Search records"></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Visitor</th><th>Reference</th><th>Destination</th><th>Status</th></tr></thead><tbody>${filtered.map(v=>`<tr data-review-id="${esc(v.id)}"><td><strong>${esc(v.name||v.full_name||'Visitor')}</strong><small>${esc(v.visitorType||v.visitor_type||'')}</small></td><td>${esc(v.reference||v.reference_number||'')}</td><td>${esc(v.destination||v.destination_name||'')}</td><td>${status(v.status|| (kind==='pending'?'PENDING':'INSIDE'))}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No visitors in this list.</td></tr>'}</tbody></table></div></div>`;}
  function currentCounts(){if(state.mode==='offline'){return {pending:db.visits.filter(v=>v.status==='PENDING').length,inside:db.visits.filter(v=>v.status==='INSIDE').length,exited:db.visits.filter(v=>v.status==='EXITED').length,all:db.visits.length};}return {pending:state.pending.length,inside:state.inside.length,exited:state.summary?.completedToday??state.history.length,all:state.summary?.todayVisitors??'—'};}
  function staffView(){const c=currentCounts();return shell(hero(state.staffRole==='admin'?'Administrator dashboard':'Security control center','Scan QR passes, approve visitor entry, and record exits using the same QR token.',state.mode==='connected'?'Live school backend':'Offline client demonstration')+`<div class="tabs"><button class="tab ${state.view==='staff'?'active':''}" data-action="staff-dashboard">Dashboard</button><button class="tab ${state.view==='records'?'active':''}" data-action="records">Visitor records</button>${state.staffRole==='admin'&&state.mode==='offline'?'<button class="tab" data-action="export">Export demo CSV</button>':''}<a class="tab" href="/security">Full security dashboard</a>${state.staffRole==='admin'?'<a class="tab" href="/admin">Admin dashboard</a><a class="tab" href="/admin/personnel">Personnel</a><a class="tab" href="/admin/destinations">Destinations</a><a class="tab" href="/admin/settings">Settings</a>':''}<a class="tab" href="/security/history">Full visit history</a><button class="tab" data-action="logout">Sign out</button></div><div class="stats">${[['Pending approval',c.pending],['Currently inside',c.inside],['Completed visits',c.exited],['All visit records',c.all]].map(([label,n])=>`<div class="stat"><p>${label}</p><strong>${n}</strong></div>`).join('')}</div>${state.view==='records'?renderRecords():`<div class="dashboard-layout"><section><div class="panel panel-pad"><div class="panel-head"><div><h2>Scan a visitor QR code</h2><p>Paste a QR token or use a supported camera to scan.</p></div></div><form id="qr-lookup" class="scan-entry"><input class="input" required id="scan-token" name="token" placeholder="Enter or scan a QR token" autocomplete="off"><button class="btn">Look up</button></form><div class="pill-row" style="margin-top:12px"><button class="btn light small" data-action="scan-camera">📷 Open camera</button><button class="btn ghost small" data-action="refresh-staff">↻ Refresh records</button></div><div id="scan-camera-host"></div>${state.selected?reviewPanel(state.selected):'<div class="note" style="margin-top:18px">Visitors must be <strong>approved by a guard</strong> before they count as checked in. The same QR pass is used to check them out later.</div>'}</div><div class="section-heading"></div>${visitList('pending')}</section><section>${visitList('inside')}<div class="panel panel-pad" style="margin-top:20px"><h2>Gate instructions</h2><div class="guide-item"><span class="guide-num">1</span><p>Scan the visitor QR or choose a pending record.</p></div><div class="guide-item"><span class="guide-num">2</span><p>Check the visitor's photo and details; approve or deny entry.</p></div><div class="guide-item"><span class="guide-num">3</span><p>When the visitor leaves, scan the same QR and check out.</p></div></div></section></div>`}`);}
  function renderRecords(){let list=state.mode==='offline'?[...db.visits].reverse():[...state.pending,...state.inside,...state.history];return `<div class="panel"><div class="panel-pad split-header"><div><h2>Visitor records</h2><p class="small muted">${state.mode==='offline'?'Includes local demo history':'Showing live pending, checked-in and the most recent 100 completed or denied visits. Full history is in the original staff dashboard.'}</p></div><button class="btn secondary small" data-action="refresh-staff">Refresh</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Reference</th><th>Name</th><th>Destination</th><th>Registered</th><th>Status</th></tr></thead><tbody>${list.map(v=>`<tr data-review-id="${esc(v.id)}"><td>${esc(v.reference||v.reference_number||'—')}</td><td>${esc(v.name||v.full_name||'')}</td><td>${esc(v.destination||v.destination_name||'')}</td><td>${dateFmt(v.registeredAt||v.registration_time)}</td><td>${status(v.status||'PENDING')}</td></tr>`).join('')||'<tr><td class="empty" colspan="5">No records found.</td></tr>'}</tbody></table></div></div>`;}
  function reviewPanel(v){return `<div class="review"><div class="split-header"><h3>Security review</h3>${status(v.status)}</div><div class="review-grid">${v.photo?`<img class="portrait" src="${esc(v.photo)}" alt="Visitor photo for manual review">`:`<div class="portrait">${initials(v.name)}</div>`}<div><strong>${esc(v.name)}</strong><div class="review-list"><div><span>Reference</span><b>${esc(v.reference)}</b></div><div><span>Type</span><b>${esc(v.visitorType||'Visitor')}</b></div><div><span>Destination</span><b>${esc(v.destination)}</b></div><div><span>Purpose</span><b>${esc(v.purpose||'—')}</b></div></div></div></div><div class="review-actions">${v.status==='PENDING'?'<button class="btn green" data-action="approve">✓ Approve entry</button><button class="btn danger" data-action="deny">Deny entry</button>':v.status==='INSIDE'?'<button class="btn" data-action="checkout">↗ Check out visitor</button>':'<span class="muted small">This visit is already closed. No further gate action is available.</span>'}<button class="btn secondary" data-action="clear-review">Clear</button></div></div>`;}
  function render(){
    if(state.view==='welcome')appRoot.innerHTML=visitorWelcome();
    else if(state.view==='info')appRoot.innerHTML=infoPage();
    else if(state.view==='face')appRoot.innerHTML=facePage();
    else if(state.view==='gps')appRoot.innerHTML=gpsPage();
    else if(state.view==='pass')appRoot.innerHTML=passPage();
    else if(state.view==='directions')appRoot.innerHTML=directionsPage();
    else if(state.view==='login')appRoot.innerHTML=loginPage();
    else if(state.view==='staff'||state.view==='records')appRoot.innerHTML=staffView();
    else appRoot.innerHTML=visitorWelcome();
    if($('#qr-canvas'))renderQR(state.token);
  }
  function renderQR(token){const canvas=$('#qr-canvas');if(!canvas||!token)return;let qr;try{qr=new window.BantayQR.QRCode(0,window.BantayQR.ErrorCorrect.M);qr.addData(token);qr.make();}catch(e){toast('Could not generate QR pass.');return;}const ctx=canvas.getContext('2d');const n=qr.getModuleCount(),pad=10,size=canvas.width;const cell=(size-2*pad)/n;ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.fillStyle='#181018';for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(qr.isDark(y,x)){const x0=Math.round(pad+x*cell),y0=Math.round(pad+y*cell);ctx.fillRect(x0,y0,Math.ceil(pad+(x+1)*cell)-x0,Math.ceil(pad+(y+1)*cell)-y0);} }
  function offlineAddVisit(){let d=state.destinations.find(d=>d.id===state.form.destinationId),tok=generateToken();const v={id:'local-'+tok.slice(0,12),token:tok,reference:`${'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random()*24)]}-${String(Math.floor(100+Math.random()*900))}`,name:state.form.fullName,phone:state.form.contactNumber,visitorType:state.form.visitorType,purpose:state.form.purpose,destination:d?.name||'Campus',destinationId:d?.id,building:d?.building,photo:state.photo.startsWith('data:image')?state.photo:'',registeredAt:nowIso(),checkIn:null,checkOut:null,status:'PENDING'};db.visits.unshift(v);dbSave(db);return v;}
  async function submitVisit(){if(!state.photo){toast('Capture a photo before continuing.');return;}if(state.mode==='connected'&&!state.gpsVerified){toast('Verify your campus location before registering.');return;}if(state.submitting)return;state.submitting=true;render();try{let v;if(state.mode==='offline'){v=offlineAddVisit();}else{let data=await request('/api/client-demo',{method:'POST',body:JSON.stringify({action:'register',fullName:state.form.fullName,contactNumber:state.form.contactNumber,visitorType:state.form.visitorType,purpose:state.form.purpose,destinationId:state.form.destinationId,facePhoto:state.photo,gpsReading:state.gps,privacyConsent:state.form.privacyConsent==='on'})});const d=state.destinations.find(x=>x.id===state.form.destinationId);v={token:data.token,reference:data.referenceNumber,status:'PENDING',name:state.form.fullName,destination:d?.name||'Campus'};state.currentPass=v;}state.token=v.token;sessionStorage.setItem('ba_last_pass',v.token);state.step=state.mode==='connected'?3:2;state.photo='';navigate('pass');toast('Your QR pass is ready. Please wait for security approval.');}catch(e){toast(e.message);}finally{state.submitting=false;if(state.view==='face')render();}}
  async function refreshStatus(silent=false){if(!state.token)return;if(state.mode==='offline'){if(state.view==='pass')render();return;}try{const data=await request('/api/client-demo?action=status&token='+encodeURIComponent(state.token));const old=state.currentPass?.status;state.currentPass={...state.currentPass,...data.visit,token:state.token,status:data.visit.status,name:data.visit.visitor_name,reference:data.visit.reference_number,destination:data.visit.destination_name};if(state.view==='pass'&&old!==state.currentPass.status)render();if(!silent)toast('Visit status refreshed.');}catch(e){if(!silent)toast(e.message);}}
  async function refreshStaff(){if(state.mode==='offline'){state.pending=db.visits.filter(v=>v.status==='PENDING');state.inside=db.visits.filter(v=>v.status==='INSIDE');render();return;}if(!state.staffLoggedIn)return;try{const [p,i,h,summary]=await Promise.all([request('/api/security/pending'),request('/api/security/inside'),request('/api/security/history').catch(()=>({visits:[]})),request('/api/admin/stats').catch(()=>null)]);state.pending=(p.visitors||[]).map(v=>({...v,name:v.full_name,reference:v.reference_number,destination:v.destination_name,status:'PENDING'}));state.inside=(i.visitors||[]).map(v=>({...v,name:v.full_name,reference:v.reference_number,destination:v.destination_name,status:'INSIDE'}));state.history=(h.visits||[]).map(v=>({...v,name:v.full_name,reference:v.reference_number,destination:v.destination_name}));state.summary=summary;render();}catch(e){toast(e.message);}}
  async function staffLookup(token){token=token.trim();if(!token){toast('Please enter a QR token.');return;}try{let v;if(state.mode==='offline'){v=db.visits.find(x=>x.token===token)||null;}else{const data=await request('/api/client-demo?action=lookup&token='+encodeURIComponent(token));v=data.visit;}if(!v)throw Error('No matching visitor pass. Please check the QR token.');state.selected=v;render();if(v.photoPath&&state.mode==='connected'){try{const p=await request('/api/visit/face-photo?path='+encodeURIComponent(v.photoPath));if(state.selected?.id===v.id){state.selected.photo=p.url;render();}}catch{}}toast(`Found ${v.name} (${v.status}).`);}catch(e){state.selected=null;render();toast(e.message);}}
  async function selectVisit(id){let v=state.pending.concat(state.inside,state.history).find(x=>x.id===id)||db.visits.find(x=>x.id===id);if(!v)return;if(state.mode==='connected')try{const data=await request('/api/security/visit/'+encodeURIComponent(id));v={...v, ...data.visit,name:data.visit.full_name,reference:data.visit.reference_number,destination:data.visit.destination_name,visitorType:data.visit.visitor_type,photoPath:data.visit.face_reference_path};}catch(e){toast(e.message);}state.selected=v;state.view='staff';render();if(v.photoPath&&state.mode==='connected')try{const p=await request('/api/visit/face-photo?path='+encodeURIComponent(v.photoPath));if(state.selected?.id===v.id){state.selected.photo=p.url;render();}}catch{}}
  async function gateAction(action){const v=state.selected;if(!v)return;const expected=action==='checkout'?'INSIDE':'PENDING';if(v.status!==expected){toast(`Cannot ${action}: visitor is ${v.status}.`);return;}if(action==='deny'){const reason=prompt('Reason for denying entry:');if(!reason?.trim())return;v.reason=reason.trim();}if(!confirm(action==='approve'?`Approve ${v.name} for entry?`:action==='checkout'?`Record check-out for ${v.name}?`:`Deny ${v.name} entry?`))return;
    try{if(state.mode==='connected'){const path=action==='approve'?'/api/visit/approve':action==='checkout'?'/api/visit/checkout':'/api/visit/deny';let body=action==='checkout'&&v.token?{token:v.token,visitId:v.id}:action==='deny'?{visitId:v.id,reason:v.reason}:{visitId:v.id};await request(path,{method:'POST',body:JSON.stringify(body)});}else{const item=db.visits.find(x=>x.id===v.id);if(!item)throw Error('This visitor is not in the local demo database.');item.status=action==='approve'?'INSIDE':action==='checkout'?'EXITED':'DENIED';if(action==='approve')item.checkIn=nowIso();else if(action==='checkout')item.checkOut=nowIso();else item.reason=v.reason;db.logs.unshift({action,visitId:item.id,time:nowIso()});dbSave(db);}state.selected=null;toast(action==='approve'?'Entry approved and check-in recorded.':action==='checkout'?'Visitor checked out successfully.':'Entry denied.');await refreshStaff();}catch(e){toast(e.message);}}
  function updateFaceStatus(message, ready, percent) {
    state.faceScanStatus=message;
    if(ready!==undefined) state.faceScanReady=ready;
    if(Number.isFinite(percent))state.faceScanPercent=Math.max(0,Math.min(100,percent));
    const bar=$('.face-progress');if(bar)bar.setAttribute('aria-valuenow',String(state.faceScanPercent));
    const fill=$('#face-progress-fill');if(fill)fill.style.width=state.faceScanPercent+'%';
    const el=$('#face-scan-status');if(el)el.textContent=message;
    const button=$('#face-capture-btn');if(button)button.disabled=!state.faceScanReady;
  }
  async function startFaceCamera(){
    stopCamera();
    const attempt=cameraSerial;
    state.faceScanReady=false;
    state.faceScanPercent=0;
    state.faceReviewOnly=false;
    updateFaceStatus('Requesting camera permission…',false);
    try {
      if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera unavailable. Upload a photo for manual security review.');
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:640},height:{ideal:480}},audio:false});
      if(attempt!==cameraSerial){stream.getTracks().forEach(t=>t.stop());return;}
      cameraStream=stream;
      const holder=$('#face-holder');
      if(!holder){stopCamera();return;}
      holder.innerHTML='<video autoplay muted playsinline id="live-video" aria-label="Live front camera"></video><span class="face-badge">Scanning face</span>';
      const video=$('#live-video');
      video.srcObject=stream;
      await video.play();
      if(attempt!==cameraSerial)return;
      const manual=$('#face-manual-btn');if(manual)manual.disabled=false;
      updateFaceStatus('Loading the on-device face landmark model…',false);
      if(!window.BantayFaceScan)throw Error('Face scanner was not loaded. Use manual photo review.');
      faceScanSession=window.BantayFaceScan.start(video,{
        onProgress(progress){
          if(attempt!==cameraSerial)return;
          updateFaceStatus(progress.message,progress.ready,progress.percent);
          const badge=holder.querySelector('.face-badge');if(badge)badge.textContent=progress.ready?'Motion check complete':'Scanning face';
        },
        onError(error){
          if(attempt!==cameraSerial)return;
          updateFaceStatus((error?.message||'Face scan unavailable.')+' Use manual photo review.',false);
        }
      });
      await faceScanSession.ready;
    }catch(e){if(attempt!==cameraSerial)return;updateFaceStatus((e?.message||'Camera error.')+' You may upload a photo for manual security review.',false);}
  }
  function captureFace(manual=false){
    const video=$('#live-video');
    if(!video||!video.videoWidth){toast('Open the camera first or upload a photo for manual review.');return;}
    if(!manual&&(!state.faceScanReady||!faceScanSession?.isReady())){toast('Complete the blink and head-turn prompts first.');return;}
    const canvas=document.createElement('canvas');
    canvas.width=480;canvas.height=480;
    let sx=0,sy=0,sw=video.videoWidth,sh=video.videoHeight;
    if(sw>sh){sx=(sw-sh)/2;sw=sh;}else{sy=(sh-sw)/2;sh=sw;}
    const ctx=canvas.getContext('2d');
    if(!ctx){toast('Camera capture unavailable.');return;}
    ctx.drawImage(video,sx,sy,sw,sh,0,0,480,480);
    state.photo=canvas.toDataURL('image/jpeg',.78);
    state.faceReviewOnly=!!manual;
    stopCamera();
    render();
    toast(manual?'Photo taken for manual security review.':'Motion prompts complete. Security will still verify your identity.');
  }
  async function loadPhoto(file){if(!file||!file.type.startsWith('image/')){toast('Choose a valid image file.');return;}const url=URL.createObjectURL(file),im=new Image();try{await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=url;});const c=document.createElement('canvas');c.width=320;c.height=320;const ctx=c.getContext('2d');const side=Math.min(im.naturalWidth,im.naturalHeight);ctx.drawImage(im,(im.naturalWidth-side)/2,(im.naturalHeight-side)/2,side,side,0,0,320,320);state.photo=c.toDataURL('image/jpeg',.72);state.faceReviewOnly=true;stopCamera();render();toast('Photo attached for manual security review.');}catch{toast('Unable to load this photo.');}finally{URL.revokeObjectURL(url);}}
  function fictionalPhoto(){const c=document.createElement('canvas');c.width=320;c.height=320;const ctx=c.getContext('2d');ctx.fillStyle='#f5e4e8';ctx.fillRect(0,0,320,320);ctx.fillStyle='#9c697b';ctx.beginPath();ctx.arc(160,125,53,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(160,290,105,95,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#783549';ctx.font='17px Arial';ctx.textAlign='center';ctx.fillText('FICTIONAL DEMO PHOTO',160,26);state.photo=c.toDataURL('image/png');render();}
  function useGps(){if(!navigator.geolocation){toast('GPS is unavailable in this browser.');return;}toast('Requesting location permission...');navigator.geolocation.getCurrentPosition(p=>{state.gps={latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy:p.coords.accuracy,distance:null};const el=$('#gps-status');if(el)el.textContent=`Location captured (±${Math.round(p.coords.accuracy)}m)`;toast('Location captured for this registration.');},()=>toast('Location unavailable. The security guard can review manually.'),{enableHighAccuracy:true,timeout:10000});}
  async function staffLogin(form){const fd=new FormData(form),u=String(fd.get('user')||'').trim(),pass=String(fd.get('password')||'');try{if(state.mode==='offline'){if(!((u==='security'&&pass==='security123')||(u==='admin'&&pass==='admin123')))throw Error('Invalid demo login.');state.staffRole=u;state.staffName=u==='admin'?'Demo Administrator':'Demo Security Guard';}else{const data=await request('/api/auth/login',{method:'POST',body:JSON.stringify({phoneNumber:u,password:pass})});state.staffRole=data.role==='ADMIN'?'admin':'security';state.staffName=data.name||'School personnel';}state.staffLoggedIn=true;state.selected=null;state.role='staff';state.view='staff';await refreshStaff();toast(`Welcome, ${state.staffName}.`);}catch(e){toast(e.message);}}
  async function switchMode(){if(isLiveProduction){toast('Demo mode is not available on the live school portal.');return;}if(state.mode==='offline'){
      if(!confirm('Connected mode uses the school database and stores visitor details and photos. Continue only with authorized testing or a real visit.'))return;
      if(fromLocal){toast('Connected mode requires deploying this HTML under your existing Next.js site. See README.');return;}
      if(!['/','/visit'].includes(location.pathname)&&!location.pathname.startsWith('/client-demo')){toast('Connected mode requires the school visitor portal.');return;}
      state.mode='connected';
    }else{state.mode='offline';}
    localStorage.setItem('ba_demo_mode',state.mode);state.staffLoggedIn=false;state.staffRole='';state.role='visitor';state.history=[];state.summary=null;state.selected=null;state.form={};state.photo='';state.gps=null;state.gpsVerified=false;state.gpsError='';state.token='';state.currentPass=null;sessionStorage.removeItem('ba_last_pass');await loadDestinations();navigate('welcome');toast(`Switched to ${state.mode} mode.`);
  }
  function downloadQr(){const c=$('#qr-canvas');if(!c)return;const a=document.createElement('a');a.download=`bantay-agapay-${state.mode==='offline'?findMyVisit()?.reference:state.currentPass?.reference||'visit'}.png`;a.href=c.toDataURL('image/png');a.click();}
  function exportCsv(){if(state.mode==='connected'){toast('For historical exports, use the existing authenticated admin portal.');return;}const items=db.visits;const headers=['Reference','Name','Visitor Type','Destination','Purpose','Status','Registered At','Checked In','Checked Out'];const csv=[headers,...items.map(v=>[v.reference,v.name,v.visitorType,v.destination,v.purpose,v.status,v.registeredAt,v.checkIn||'',v.checkOut||''])].map(row=>row.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='bantay-agapay-offline-visits.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
  async function startQrScan(){const host=$('#scan-camera-host');if(!host)return;if(typeof BarcodeDetector==='undefined'){toast('This browser does not support QR camera scanning. Use the manual token field.');return;}stopCamera();try{cameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false});host.innerHTML='<div class="face-box" style="margin-top:12px;min-height:230px"><video autoplay playsinline muted id="qr-video" style="width:100%;height:250px;object-fit:cover"></video></div><button class="btn small ghost" data-action="close-qr-camera">Close camera</button>';const video=$('#qr-video');video.srcObject=cameraStream;const detector=new BarcodeDetector({formats:['qr_code']});state.scanning=true;scanTimer=setInterval(async()=>{if(!state.scanning||video.readyState<2)return;try{const codes=await detector.detect(video);if(codes.length){const token=codes[0].rawValue.trim();stopCamera();host.innerHTML='';await staffLookup(token);}}catch{}},600);}catch(e){toast('Could not open camera. Use manual token entry.');}}
  document.addEventListener('submit',async e=>{
    if(e.target.id==='visitor-form'){e.preventDefault();const f=new FormData(e.target);const data=Object.fromEntries(f.entries());if(!/^09\d{9}$/.test(data.contactNumber)){toast('Phone number must be 11 digits starting with 09.');return;}if(state.mode==='connected'&&data.privacyConsent!=='on'){toast('Please acknowledge the privacy notice before continuing.');return;}state.form=data;state.step=1;navigate('face');}
    if(e.target.id==='staff-login'){e.preventDefault();await staffLogin(e.target);}
    if(e.target.id==='qr-lookup'){e.preventDefault();await staffLookup(new FormData(e.target).get('token'));}
  });
  document.addEventListener('change',e=>{if(e.target.id==='face-upload')loadPhoto(e.target.files?.[0]);});
  document.addEventListener('input',e=>{if(e.target.id==='search-list'){state.filter=e.target.value;let active=document.activeElement,caret=active.selectionStart;render();const input=$('#search-list');input?.focus();input?.setSelectionRange(caret,caret);}});
  document.addEventListener('click',async e=>{
    const row=e.target.closest('[data-review-id]');if(row){await selectVisit(row.dataset.reviewId);return;}
    const button=e.target.closest('[data-action]');if(!button)return;e.preventDefault();const act=button.dataset.action;
    if(act==='home'){state.role='visitor';navigate('welcome');}
    else if(act==='begin'){state.step=0;state.photo='';state.faceReviewOnly=false;state.faceScanPercent=0;state.faceScanStatus='Start the camera to check face presence and motion.';state.gps=null;state.gpsVerified=false;state.gpsError='';state.form={};await loadDestinations();navigate('info');}
    else if(act==='back-info'){state.step=0;navigate('info');}
    else if(act==='back-face'){state.step=1;navigate('face');}
    else if(act==='go-gps'){if(!state.photo){toast('Capture a photo before continuing.');return;}state.step=2;navigate('gps');}
    else if(act==='gps-check')await verifyCampusGps();
    else if(act==='start-camera')await startFaceCamera();
    else if(act==='capture-camera')captureFace(false);
    else if(act==='capture-manual')captureFace(true);
    else if(act==='retake'){stopCamera();state.photo='';state.faceReviewOnly=false;state.faceScanPercent=0;state.faceScanStatus='Start the camera to check face presence and motion.';render();}
    else if(act==='placeholder-photo'&&state.mode==='offline')fictionalPhoto();
    else if(act==='gps')useGps();
    else if(act==='submit-visit')await submitVisit();
    else if(act==='restore-pass'){state.token=sessionStorage.getItem('ba_last_pass')||'';if(!state.token)toast('No visitor pass saved in this browser session.');else{if(state.mode==='connected')await refreshStatus(true);navigate('pass');}}
    else if(act==='pass')navigate('pass');
    else if(act==='refresh-pass')await refreshStatus(false);
    else if(act==='download-qr')downloadQr();
    else if(act==='directions'){if(state.mode==='connected'&&state.token){window.location.assign('/visit/directions/'+encodeURIComponent(state.token));}else navigate('directions');}
    else if(act==='go-staff')navigate('login');
    else if(act==='switch-mode')await switchMode();
    else if(act==='staff-dashboard'){state.view='staff';state.filter='';await refreshStaff();}
    else if(act==='records'){state.view='records';render();}
    else if(act==='refresh-staff')await refreshStaff();
    else if(act==='approve'||act==='checkout'||act==='deny')await gateAction(act);
    else if(act==='clear-review'){state.selected=null;render();}
    else if(act==='export')exportCsv();
    else if(act==='scan-camera')await startQrScan();
    else if(act==='close-qr-camera'){stopCamera();const h=$('#scan-camera-host');if(h)h.innerHTML='';}
    else if(act==='logout'){if(state.mode==='connected')await request('/api/auth/logout',{method:'POST'}).catch(()=>{});state.staffLoggedIn=false;state.staffRole='';state.selected=null;state.role='visitor';navigate('welcome');}
  });
  window.addEventListener('storage',e=>{if(e.key===STORAGE && state.mode==='offline'){db=dbLoad();if(['staff','records','pass'].includes(state.view)){if(state.staffLoggedIn){state.pending=db.visits.filter(v=>v.status==='PENDING');state.inside=db.visits.filter(v=>v.status==='INSIDE');}render();}}});
  if(state.mode==='connected')loadDestinations().then(()=>{if(state.view==='info')render();});
  pollTimer=setInterval(()=>{if(state.mode==='connected'&&state.view==='pass'&&state.token)refreshStatus(true);},6500);
  render();
})();
