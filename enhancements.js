/* Inter AI Study Buddy — Enhancements v2
   - ARIA + Accessibility
   - Auto TTS + Translate (Telugu/Tamil/Hindi/English auto-detect)
   - Pomodoro 25/5 with Water Photo Break Lock
   - SQL Auth (signup/login/OTP) via backend SQLite
   - Google Search Console helpers
*/
(function(){
  const API_BASE = (() => {
    // If served from backend (3001) -> same origin
    // If served from python 8000 -> backend is 3001
    // If on GitHub Pages -> try backend if env set, else demo
    const h = location.hostname;
    if (h.includes('github.io')) return ''; // demo mode on GH Pages (no backend)
    if (location.port === '8000') return location.protocol + '//' + h + ':3001';
    if (location.port === '3001') return '';
    // e2b preview: https://8000-xxx.e2b.app -> backend is https://3001-xxx.e2b.app
    if (location.href.includes('e2b.app')) {
      return location.origin.replace(/:\/\/\d+-/, '://3001-');
    }
    return 'http://localhost:3001';
  })();
  console.log('API_BASE', API_BASE);

  // ---------- 1. ARIA & Accessibility ----------
  function injectARIA(){
    // Skip link
    const skip = document.createElement('a');
    skip.href = '#main-content';
    skip.textContent = 'Skip to main content';
    skip.className = 'sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 bg-slate-900 text-white px-4 py-2 rounded-full z-[100]';
    skip.setAttribute('aria-label','Skip to main content');
    document.body.prepend(skip);
    
    // Add roles and labels
    const header = document.querySelector('header');
    if(header){ header.setAttribute('role','banner'); header.setAttribute('aria-label','Main header with stream selector and settings'); }
    const nav = document.querySelector('aside nav');
    if(nav){ nav.setAttribute('role','navigation'); nav.setAttribute('aria-label','Primary navigation'); }
    const main = document.querySelector('main');
    if(main){ main.id='main-content'; main.setAttribute('role','main'); main.setAttribute('aria-label','Study content'); }
    // Buttons
    document.querySelectorAll('button').forEach((b,i)=>{
      if(!b.getAttribute('aria-label') && !b.textContent.trim()) b.setAttribute('aria-label','Button '+(i+1));
      b.setAttribute('role','button');
    });
    // Inputs
    document.querySelectorAll('input, textarea, select').forEach(el=>{
      if(el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if(!label && el.placeholder) el.setAttribute('aria-label', el.placeholder);
      }
      el.setAttribute('aria-describedby', el.id+'-help');
    });
    // Modals
    document.querySelectorAll('[id$="Modal"]').forEach(m=>{
      m.setAttribute('role','dialog');
      m.setAttribute('aria-modal','true');
      m.setAttribute('aria-hidden','true');
    });
    // Live region for announcements
    if(!document.getElementById('aria-live')){
      const live=document.createElement('div');
      live.id='aria-live';
      live.setAttribute('aria-live','polite');
      live.setAttribute('aria-atomic','true');
      live.className='sr-only';
      document.body.appendChild(live);
    }
    // Add focus styles
    const style=document.createElement('style');
    style.textContent=`
      .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
      .focus\\:not-sr-only:focus{position:static;width:auto;height:auto;padding:0.5rem 1rem;margin:0;overflow:visible;clip:auto;white-space:normal}
      *:focus-visible{outline:2px solid #4f46e5;outline-offset:2px;border-radius:6px}
    `;
    document.head.appendChild(style);
    announce('Inter AI Study Buddy loaded. Accessible with keyboard. Press Tab to navigate.');
  }
  function announce(msg){
    const live=document.getElementById('aria-live');
    if(live){ live.textContent=''; setTimeout(()=>live.textContent=msg,100); }
  }

  // ---------- 2. Language Auto-Detect ----------
  function detectLang(text){
    if(!text) return 'en';
    // Telugu Unicode: 0C00-0C7F
    if(/[\u0C00-\u0C7F]/.test(text)) return 'te';
    // Tamil: 0B80-0BFF
    if(/[\u0B80-\u0BFF]/.test(text)) return 'ta';
    // Hindi Devanagari: 0900-097F
    if(/[\u0900-\u097F]/.test(text)) return 'hi';
    // Simple English check
    return 'en';
  }
  function langName(code){
    return {en:'English', te:'Telugu', ta:'Tamil', hi:'Hindi'}[code] || 'English';
  }
  function langVoice(code){
    return {en:'en-US', te:'te-IN', ta:'ta-IN', hi:'hi-IN'}[code] || 'en-US';
  }

  // ---------- 3. TTS Engine ----------
  let ttsUtterance=null, ttsVoices=[];
  function loadVoices(){
    ttsVoices = speechSynthesis.getVoices();
    if(!ttsVoices.length) setTimeout(loadVoices, 300);
  }
  if('speechSynthesis' in window){
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  }
  function speak(text, langCode='auto', rate=1, pitch=1){
    if(!('speechSynthesis' in window)) return alert('TTS not supported in this browser');
    speechSynthesis.cancel();
    const detected = langCode==='auto' ? detectLang(text) : langCode;
    const utter = new SpeechSynthesisUtterance(text);
    const voiceLang = langVoice(detected);
    // Find voice matching lang
    let voice = ttsVoices.find(v=>v.lang.toLowerCase().startsWith(voiceLang.toLowerCase())) 
              || ttsVoices.find(v=>v.lang.startsWith(detected))
              || ttsVoices.find(v=>v.lang.startsWith('en'));
    if(voice) utter.voice = voice;
    utter.lang = voiceLang;
    utter.rate = rate;
    utter.pitch = pitch;
    utter.onstart = ()=> announce('Reading started in '+langName(detected));
    utter.onend = ()=> announce('Reading finished');
    utter.onerror = (e)=> console.error('TTS error',e);
    ttsUtterance = utter;
    speechSynthesis.speak(utter);
  }
  function stopTTS(){ speechSynthesis.cancel(); }
  function pauseTTS(){ speechSynthesis.pause(); }
  function resumeTTS(){ speechSynthesis.resume(); }

  // Translate via MyMemory (free, no key) — fallback to no translate
  async function translateText(text, targetLang){
    if(!text || targetLang==='auto' || detectLang(text)===targetLang) return text;
    const src = detectLang(text);
    if(src===targetLang) return text;
    try{
      const pairs = `${src}|${targetLang}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0,500))}&langpair=${pairs}`;
      const res = await fetch(url);
      const j = await res.json();
      if(j.responseData && j.responseData.translatedText) return j.responseData.translatedText;
      return text;
    }catch(e){
      console.warn('Translate failed',e);
      return text;
    }
  }

  // ---------- 4. Pomodoro 25/5 with Photo Lock ----------
  let pomoTimer=null, pomoRemaining=25*60, pomoIsBreak=false, pomoEnabled = localStorage.getItem('pomo_enabled') !== 'false';
  let pomoInterval=null;
  const POMO_STUDY = 25*60, POMO_BREAK = 5*60;

  function createPomodoroUI(){
    // Floating widget
    const widget=document.createElement('div');
    widget.id='pomoWidget';
    widget.setAttribute('role','timer');
    widget.setAttribute('aria-live','polite');
    widget.setAttribute('aria-label','Study timer, 25 minutes study, 5 minutes break');
    widget.className='fixed bottom-4 left-4 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 flex items-center gap-3 hidden lg:flex';
    widget.innerHTML=`
      <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center" aria-hidden="true"><i class="fa-solid fa-stopwatch"></i></div>
      <div>
        <p class="text-xs font-bold tracking-widest uppercase text-slate-500" id="pomoLabel">Study Focus</p>
        <p class="font-mono font-bold text-lg leading-none text-slate-900" id="pomoTime" aria-live="polite">25:00</p>
      </div>
      <div class="flex gap-1 ml-2">
        <button id="pomoToggle" aria-label="Start or pause pomodoro timer" class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700"><i class="fa-solid fa-play text-xs"></i></button>
        <button id="pomoReset" aria-label="Reset timer" class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200"><i class="fa-solid fa-rotate text-xs"></i></button>
      </div>
      <button id="pomoSettingsBtn" aria-label="Pomodoro settings" class="w-8 h-8 rounded-full bg-white border flex items-center justify-center ml-1"><i class="fa-solid fa-gear text-xs"></i></button>
    `;
    document.body.appendChild(widget);

    // Mobile pomodoro bar
    const mobile=document.createElement('div');
    mobile.className='lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-3 flex items-center justify-between z-30';
    mobile.id='pomoMobile';
    mobile.innerHTML=`
      <div class="flex items-center gap-2"><div class="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center"><i class="fa-solid fa-stopwatch text-xs"></i></div><div><p class="text-xs font-bold leading-none" id="pomoLabelM">Study 25:00</p><p class="text-[11px] text-slate-500" id="pomoSubM">Stay focused</p></div></div>
      <div class="flex gap-2"><button id="pomoToggleM" class="px-4 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-bold">Start</button><button id="pomoResetM" class="px-3 py-1.5 rounded-full bg-slate-100 text-xs font-bold">Reset</button></div>
    `;
    document.body.appendChild(mobile);
    // Add padding to body for mobile bar
    document.body.style.paddingBottom = '60px';

    // Lock overlay
    const overlay=document.createElement('div');
    overlay.id='pomoLock';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Break time lock screen. Take photo drinking water to unlock after 5 minutes');
    overlay.className='hidden fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur flex flex-col items-center justify-center p-6 text-center text-white';
    overlay.innerHTML=`
      <div class="max-w-[520px] w-full bg-white rounded-[24px] p-6 sm:p-8 text-slate-900 shadow-2xl">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center mx-auto text-2xl" aria-hidden="true"><i class="fa-solid fa-mug-hot"></i></div>
        <h2 class="font-display font-bold text-2xl mt-4">Break Time! 💧</h2>
        <p class="text-sm text-slate-600 mt-2 leading-relaxed">You studied <b>25 minutes</b> — amazing! Now take <b>5 minutes</b> to drink water, stretch, and rest your eyes. This screen will unlock automatically after 5 minutes.</p>
        <div class="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p class="text-xs font-bold uppercase tracking-widest text-amber-700">To unlock early: Show photo drinking water</p>
          <p class="text-xs text-amber-900 mt-1">Take a photo with your camera holding a glass/bottle. AI will verify in 2 seconds.</p>
        </div>
        <div class="mt-4">
          <p class="font-mono font-bold text-3xl text-indigo-600" id="breakTime" aria-live="polite">05:00</p>
          <p class="text-xs text-slate-500 mt-1">Break countdown • Page locked</p>
          <div class="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden"><div id="breakBar" class="h-full bg-emerald-500 transition-all" style="width:100%"></div></div>
        </div>
        <div class="mt-5 grid sm:grid-cols-2 gap-3">
          <div class="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden flex items-center justify-center">
            <video id="breakVideo" autoplay playsinline class="w-full h-full object-cover hidden"></video>
            <canvas id="breakCanvas" class="hidden"></canvas>
            <img id="breakPreview" class="w-full h-full object-cover hidden">
            <div id="breakPlaceholder" class="text-center p-4 text-white">
              <i class="fa-solid fa-camera text-xl opacity-80"></i><p class="text-xs mt-1 opacity-80">Camera off</p>
            </div>
          </div>
          <div class="space-y-2 text-left">
            <button id="breakStartCam" class="w-full py-2.5 rounded-full bg-slate-900 text-white font-bold text-sm"><i class="fa-solid fa-video mr-1"></i> Start Camera</button>
            <button id="breakCapture" class="w-full py-2.5 rounded-full bg-emerald-600 text-white font-bold text-sm"><i class="fa-solid fa-camera mr-1"></i> I Drank Water — Verify Photo</button>
            <button id="breakSkip" class="w-full py-2 rounded-full bg-white border font-bold text-sm text-slate-600">Wait full 5 min (auto-unlock)</button>
            <p class="text-[11px] text-slate-500 text-center">Verification is on-device demo (any photo unlocks). Real check respects privacy — photo never uploaded without your consent.</p>
          </div>
        </div>
        <p class="text-[11px] text-slate-400 mt-4">Tip: Enable this reminder in <b>⚙️ Settings → Pomodoro</b>. You can turn it off anytime.</p>
      </div>
    `;
    document.body.appendChild(overlay);

    // Listeners
    document.getElementById('pomoToggle').addEventListener('click', togglePomo);
    document.getElementById('pomoReset').addEventListener('click', resetPomo);
    document.getElementById('pomoSettingsBtn').addEventListener('click', openSettingsWithPomo);
    document.getElementById('pomoToggleM').addEventListener('click', togglePomo);
    document.getElementById('pomoResetM').addEventListener('click', resetPomo);
    document.getElementById('breakStartCam').addEventListener('click', startBreakCam);
    document.getElementById('breakCapture').addEventListener('click', verifyWaterPhoto);
    document.getElementById('breakSkip').addEventListener('click', ()=> announce('Break continues — auto unlock in remaining time'));

    updatePomoDisplay();
    if(pomoEnabled) {
      document.getElementById('pomoWidget')?.classList.remove('hidden');
    }
    // Auto-start if enabled and user is logged in? Not auto-start, wait for user.
  }

  let breakCamStream=null, breakRemaining=POMO_BREAK, breakTimer=null;
  function updatePomoDisplay(){
    const m=Math.floor(pomoRemaining/60), s=pomoRemaining%60;
    const txt=`${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    const labelEl=document.getElementById('pomoTime');
    const label=document.getElementById('pomoLabel');
    const labelM=document.getElementById('pomoLabelM');
    const subM=document.getElementById('pomoSubM');
    const btn=document.getElementById('pomoToggle');
    const btnM=document.getElementById('pomoToggleM');
    if(labelEl) labelEl.textContent=txt;
    if(label) label.textContent = pomoIsBreak ? 'Break Time' : 'Study Focus';
    if(labelM) labelM.textContent = (pomoIsBreak?'Break ':'Study ') + txt;
    if(subM) subM.textContent = pomoIsBreak ? 'Drink water • Breathe' : 'Stay focused • 25 min';
    const icon = pomoTimer ? 'fa-pause' : 'fa-play';
    if(btn) btn.innerHTML=`<i class="fa-solid ${icon} text-xs"></i>`;
    if(btnM) btnM.textContent = pomoTimer ? 'Pause' : 'Start';
    // Title
    document.title = pomoTimer ? `(${txt}) ${pomoIsBreak?'Break — ':'Study — '}Inter AI Study Buddy` : 'Inter AI Study Buddy — AITutor';
  }
  function togglePomo(){
    if(pomoTimer){ pausePomo(); } else { startPomo(); }
  }
  function startPomo(){
    if(!pomoEnabled) {
      announce('Pomodoro is disabled. Enable in Settings.');
      return;
    }
    if(pomoTimer) return;
    pomoTimer = setInterval(()=>{
      pomoRemaining--;
      if(pomoRemaining<=0){
        clearInterval(pomoTimer); pomoTimer=null;
        if(!pomoIsBreak){
          // Study done -> start break lock
          pomoIsBreak=true;
          pomoRemaining=POMO_BREAK;
          breakRemaining=POMO_BREAK;
          announce('25 minutes study completed! Break time for 5 minutes. Please drink water.');
          // Play sound
          try{ const a=new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=='); a.play().catch(()=>{});}catch{}
          showBreakLock();
          startBreakCountdown();
        } else {
          // Break done -> back to study
          pomoIsBreak=false;
          pomoRemaining=POMO_STUDY;
          hideBreakLock();
          announce('Break finished! Back to study for 25 minutes. You got this!');
          // Auto start next study? wait for user
        }
      }
      updatePomoDisplay();
    },1000);
    updatePomoDisplay();
  }
  function pausePomo(){ if(pomoTimer){ clearInterval(pomoTimer); pomoTimer=null; updatePomoDisplay(); } }
  function resetPomo(){
    pausePomo();
    pomoIsBreak=false;
    pomoRemaining=POMO_STUDY;
    hideBreakLock();
    if(breakTimer){ clearInterval(breakTimer); breakTimer=null; }
    updatePomoDisplay();
    announce('Timer reset to 25 minutes');
  }
  function showBreakLock(){
    const overlay=document.getElementById('pomoLock');
    if(overlay){ overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false'); }
    // Prevent scroll
    document.body.style.overflow='hidden';
    // Lock interacting with page? overlay covers all
  }
  function hideBreakLock(){
    const overlay=document.getElementById('pomoLock');
    if(overlay){ overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true'); }
    document.body.style.overflow='';
    stopBreakCam();
  }
  function startBreakCountdown(){
    const el=document.getElementById('breakTime');
    const bar=document.getElementById('breakBar');
    breakTimer=setInterval(()=>{
      breakRemaining--;
      pomoRemaining=breakRemaining; // sync
      const m=Math.floor(breakRemaining/60), s=breakRemaining%60;
      if(el) el.textContent=`${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
      if(bar) bar.style.width=`${(breakRemaining/POMO_BREAK*100)}%`;
      updatePomoDisplay();
      if(breakRemaining<=0){
        clearInterval(breakTimer); breakTimer=null;
        hideBreakLock();
        pomoIsBreak=false;
        pomoRemaining=POMO_STUDY;
        updatePomoDisplay();
        announce('Break automatically finished. Study access restored.');
        // Notification
        if(Notification && Notification.permission==='granted'){
          new Notification('Inter AI Study Buddy',{body:'Break over — back to study! 💪',icon:''});
        }
      }
    },1000);
  }
  async function startBreakCam(){
    try{
      breakCamStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:false});
      const v=document.getElementById('breakVideo');
      v.srcObject=breakCamStream; v.classList.remove('hidden');
      document.getElementById('breakPlaceholder').classList.add('hidden');
    }catch(e){ alert('Camera error: '+e.message); }
  }
  function stopBreakCam(){
    if(breakCamStream){ breakCamStream.getTracks().forEach(t=>t.stop()); breakCamStream=null; }
    const v=document.getElementById('breakVideo');
    if(v) v.classList.add('hidden');
    document.getElementById('breakPlaceholder')?.classList.remove('hidden');
  }
  async function verifyWaterPhoto(){
    const v=document.getElementById('breakVideo');
    const c=document.getElementById('breakCanvas');
    const preview=document.getElementById('breakPreview');
    if(!v || !v.srcObject) return alert('Start camera first, then show your water glass/bottle and capture');
    c.width=v.videoWidth; c.height=v.videoHeight;
    c.getContext('2d').drawImage(v,0,0);
    const data=c.toDataURL('image/jpeg',0.8);
    preview.src=data; preview.classList.remove('hidden');
    v.classList.add('hidden');
    // Simulate AI verification 2 sec
    const btn=document.getElementById('breakCapture');
    btn.textContent='Verifying... ⏳'; btn.disabled=true;
    await new Promise(r=>setTimeout(r,1800));
    // Demo always passes (real: could use vision model)
    const isWater = true; // In production, call vision API
    if(isWater){
      announce('Water verification passed! Break can end early, but 5-minute rest is recommended. Unlocking...');
      // Allow early unlock but keep at least 30 sec? For now unlock immediately if user wants
      if(confirm('Great! You drank water 💧 — unlock now or wait full 5 min for full rest?\nOK = Unlock now, Cancel = Wait')){
        if(breakTimer){ clearInterval(breakTimer); breakTimer=null; }
        hideBreakLock();
        pomoIsBreak=false;
        pomoRemaining=POMO_STUDY;
        updatePomoDisplay();
      } else {
        preview.classList.add('hidden'); v.classList.remove('hidden');
        btn.textContent='I Drank Water — Verify Photo'; btn.disabled=false;
      }
    } else {
      alert('Could not verify water. Try again with better light, glass clearly visible.');
      btn.textContent='I Drank Water — Verify Photo'; btn.disabled=false;
    }
  }
  function openSettingsWithPomo(){
    // Open settings and scroll to pomo toggle
    if(typeof openSettings==='function') openSettings();
    setTimeout(()=>{
      const pomoToggle=document.getElementById('pomoEnabledToggle');
      if(pomoToggle) pomoToggle.scrollIntoView({behavior:'smooth',block:'center'});
    },300);
  }

  // ---------- 5. TTS UI ----------
  function createTTSUI(){
    // Add TTS controls to doc modal and right rail
    const ttsBar=document.createElement('div');
    ttsBar.id='ttsBar';
    ttsBar.setAttribute('role','toolbar');
    ttsBar.setAttribute('aria-label','Text to speech and translation toolbar');
    ttsBar.className='mt-3 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-200 rounded-2xl p-3 flex flex-wrap gap-2 items-center';
    ttsBar.innerHTML=`
      <div class="flex items-center gap-1.5">
        <span class="text-xs font-bold text-indigo-700 flex items-center gap-1"><i class="fa-solid fa-volume-high"></i> Auto TTS</span>
        <span id="langBadge" class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border text-slate-600">Detecting...</span>
      </div>
      <div class="flex items-center gap-1">
        <button id="ttsPlay" aria-label="Read aloud" class="px-3 py-1.5 rounded-full bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"><i class="fa-solid fa-play mr-1"></i> Read</button>
        <button id="ttsPause" aria-label="Pause reading" class="px-2.5 py-1.5 rounded-full bg-white border text-xs font-bold">Pause</button>
        <button id="ttsStop" aria-label="Stop reading" class="px-2.5 py-1.5 rounded-full bg-white border text-xs font-bold">Stop</button>
      </div>
      <label class="text-[11px] font-bold text-slate-700 flex items-center gap-1">Speed <input id="ttsRate" type="range" min="0.5" max="1.5" step="0.1" value="1" aria-label="Speech speed" class="w-16"></label>
      <label class="text-[11px] font-bold text-slate-700">Voice
        <select id="ttsVoiceSel" aria-label="Select voice" class="px-2 py-1 rounded-full border text-xs bg-white"><option>Auto (detect)</option></select>
      </label>
      <div class="flex items-center gap-1 ml-auto">
        <label class="text-[11px] font-bold text-slate-700">Translate
          <select id="translateSel" aria-label="Translate language" class="px-2 py-1 rounded-full border text-xs bg-white">
            <option value="original">Original</option>
            <option value="en">English</option>
            <option value="te">Telugu</option>
            <option value="ta">Tamil</option>
            <option value="hi">Hindi</option>
          </select>
        </label>
        <button id="translateBtn" aria-label="Translate text" class="px-3 py-1 rounded-full bg-white border text-xs font-bold">Translate</button>
      </div>
    `;
    // Insert after docModalText if exists, else in dashboard
    const docText=document.getElementById('docModalText');
    if(docText && docText.parentNode){
      docText.parentNode.insertBefore(ttsBar, docText.nextSibling);
    }
    // Also add mini TTS to right rail? Add second instance
    const miniTTS=ttsBar.cloneNode(true);
    miniTTS.id='ttsBarMini';
    const rightRail=document.querySelector('aside.hidden.xl\\:block');
    if(rightRail){
      const card=rightRail.querySelector('.bg-white.rounded-\\[20px\\]');
      if(card) card.appendChild(miniTTS);
    }

    // Populate voices
    function refreshVoices(){
      const sel=document.getElementById('ttsVoiceSel');
      if(!sel || !ttsVoices.length) return;
      sel.innerHTML='<option value="auto">Auto (detect)</option>' + ttsVoices.map(v=>`<option value="${v.name}">${v.name} (${v.lang})</option>`).join('');
    }
    setInterval(refreshVoices, 1000);

    // Events
    document.getElementById('ttsPlay')?.addEventListener('click', async ()=>{
      const textEl=document.getElementById('docModalText');
      let text=textEl ? textEl.textContent.slice(0,4000) : document.getElementById('ocrText')?.value.slice(0,4000) || '';
      if(!text.trim()) text='Welcome to Inter AI Study Buddy. Upload a PDF to start reading.';
      const target=document.getElementById('translateSel')?.value;
      if(target && target!=='original'){
        text = await translateText(text, target);
        // Show translated in modal AI box
        const aiBox=document.getElementById('docModalAI');
        if(aiBox){ aiBox.classList.remove('hidden'); aiBox.innerHTML=`<p class="text-xs font-bold uppercase tracking-widest text-indigo-600">Translated to ${langName(target)}</p><p class="text-sm mt-2 whitespace-pre-wrap">${text.slice(0,2000)}</p>`; }
      }
      const rate=parseFloat(document.getElementById('ttsRate')?.value||'1');
      const voiceName=document.getElementById('ttsVoiceSel')?.value;
      const detected=detectLang(text);
      document.getElementById('langBadge').textContent=langName(detected) + ' • ' + detected.toUpperCase();
      document.getElementById('langBadge').className='text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700';
      // If specific voice chosen
      if(voiceName && voiceName!=='auto'){
        const v=ttsVoices.find(x=>x.name===voiceName);
        if(v){ const utter=new SpeechSynthesisUtterance(text); utter.voice=v; utter.rate=rate; speechSynthesis.cancel(); speechSynthesis.speak(utter); return; }
      }
      speak(text, detected, rate);
    });
    document.getElementById('ttsPause')?.addEventListener('click', ()=>{ if(speechSynthesis.paused) resumeTTS(); else pauseTTS(); });
    document.getElementById('ttsStop')?.addEventListener('click', stopTTS);
    document.getElementById('translateBtn')?.addEventListener('click', async ()=>{
      const sel=document.getElementById('translateSel');
      const target=sel.value;
      if(target==='original') return;
      const textEl=document.getElementById('docModalText');
      let text=textEl ? textEl.textContent.slice(0,800) : '';
      if(!text) return alert('Open a document first');
      const out=await translateText(text, target);
      const aiBox=document.getElementById('docModalAI');
      if(aiBox){ aiBox.classList.remove('hidden'); aiBox.innerHTML=`<p class="text-xs font-bold text-indigo-600">Translated to ${langName(target)} (${target}) — Auto-detected: ${langName(detectLang(text))}</p><p class="text-sm mt-2 whitespace-pre-wrap leading-relaxed">${out}</p><div class="mt-3 flex gap-2"><button onclick="speak(\`${out.replace(/`/g,'\\`').slice(0,1000)}\`, '${target}')" class="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold">🔊 Read Translated</button><button onclick="navigator.clipboard.writeText(\`${out.replace(/`/g,'\\`')}\`)" class="px-3 py-1 rounded-full bg-white border text-xs font-bold">Copy</button></div>`; }
    });

    // Auto-detect language on doc open
    const observer=new MutationObserver(()=>{
      const textEl=document.getElementById('docModalText');
      if(textEl && textEl.textContent.trim()){
        const lang=detectLang(textEl.textContent);
        const badge=document.getElementById('langBadge');
        if(badge){ badge.textContent=langName(lang) + ' • Auto'; }
        // Also update quiz language? auto set quizLang to detected+English?
      }
    });
    if(document.getElementById('docModalText')) observer.observe(document.getElementById('docModalText'), {childList:true, characterData:true, subtree:true});
  }

  // ---------- 6. Auth System (SQL via backend) ----------
  let currentUser = JSON.parse(localStorage.getItem('inter_user')||'null');
  let authToken = localStorage.getItem('inter_token')||'';

  function createAuthUI(){
    // Add auth button to header
    const headerActions=document.querySelector('header .flex.items-center.gap-2');
    if(!headerActions) return;
    // Insert before settings gear
    const authBtn=document.createElement('div');
    authBtn.id='authArea';
    authBtn.className='flex items-center gap-2';
    authBtn.innerHTML = currentUser 
      ? `<span class="hidden sm:inline text-xs font-bold text-slate-700">Hi, ${currentUser.name}</span><button id="logoutBtn" aria-label="Logout" class="px-3 py-1.5 rounded-full bg-white border text-xs font-bold">Logout</button><div class="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-sm" aria-label="User avatar">${currentUser.name[0].toUpperCase()}</div>`
      : `<button id="loginBtn" aria-label="Login or Sign up" class="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"><i class="fa-solid fa-right-to-bracket"></i> Login</button><button id="signupBtn" aria-label="Sign up" class="px-4 py-2 rounded-full bg-white border text-xs font-bold">Sign Up</button>`;
    headerActions.prepend(authBtn);
    
    // Also add mobile inside sidebar?
    document.getElementById('loginBtn')?.addEventListener('click', ()=> openAuth('login'));
    document.getElementById('signupBtn')?.addEventListener('click', ()=> openAuth('signup'));
    document.getElementById('logoutBtn')?.addEventListener('click', logout);

    // Create Auth Modal
    const modal=document.createElement('div');
    modal.id='authModal';
    modal.setAttribute('role','dialog');
    modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label','Login and Signup');
    modal.className='hidden fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.innerHTML=`
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onclick="closeAuth()" aria-hidden="true"></div>
      <div class="relative bg-white rounded-[24px] shadow-2xl border max-w-[440px] w-full overflow-hidden max-h-[90vh] overflow-auto">
        <div class="px-6 py-5 border-b flex items-center justify-between bg-gradient-to-r from-indigo-600 to-violet-600 text-white">
          <h3 class="font-bold flex items-center gap-2" id="authTitle"><i class="fa-solid fa-graduation-cap"></i> Welcome Back</h3>
          <button onclick="closeAuth()" aria-label="Close login dialog" class="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="p-6">
          <!-- Tabs -->
          <div role="tablist" class="flex gap-1 bg-slate-100 p-1 rounded-full">
            <button role="tab" id="tabLogin" aria-selected="true" onclick="switchAuth('login')" class="flex-1 py-2 rounded-full bg-white shadow font-bold text-sm">Login</button>
            <button role="tab" id="tabSignup" aria-selected="false" onclick="switchAuth('signup')" class="flex-1 py-2 rounded-full font-bold text-sm text-slate-600">Sign Up</button>
          </div>

          <!-- Login Form -->
          <form id="loginForm" class="mt-5 space-y-3" onsubmit="handleLogin(event)" aria-label="Login form">
            <label class="block text-xs font-bold">Email ID
              <input id="loginEmail" type="email" required placeholder="you@example.com" autocomplete="email" aria-required="true" class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 text-sm">
            </label>
            <label class="block text-xs font-bold">Password
              <div class="mt-1 flex gap-2">
                <input id="loginPass" type="password" required placeholder="••••••••" autocomplete="current-password" aria-required="true" class="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm">
                <button type="button" onclick="togglePass('loginPass')" aria-label="Show password" class="px-3 rounded-xl bg-white border"><i class="fa-solid fa-eye text-xs"></i></button>
              </div>
            </label>
            <p id="loginMsg" class="text-xs font-semibold min-h-[18px]" aria-live="polite"></p>
            <button type="submit" class="w-full py-3 rounded-full bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700">Login <i class="fa-solid fa-arrow-right ml-1"></i></button>
            <button type="button" onclick="openForgot()" class="w-full text-xs font-bold text-indigo-600 hover:underline">Forgot Password? Recover with OTP</button>
          </form>

          <!-- Signup Form -->
          <form id="signupForm" class="hidden mt-5 space-y-3" onsubmit="handleSignup(event)" aria-label="Signup form">
            <label class="block text-xs font-bold">Full Name
              <input id="signupName" type="text" required placeholder="e.g. Sai Kumar" autocomplete="name" aria-required="true" class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm">
            </label>
            <label class="block text-xs font-bold">Email ID
              <input id="signupEmail" type="email" required placeholder="you@example.com" autocomplete="email" aria-required="true" class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm">
            </label>
            <label class="block text-xs font-bold">Password
              <input id="signupPass" type="password" required placeholder="Min 6 characters" autocomplete="new-password" aria-required="true" class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm">
            </label>
            <label class="block text-xs font-bold">Confirm Password
              <input id="signupConfirm" type="password" required placeholder="Repeat password" autocomplete="new-password" aria-required="true" class="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-indigo-400 text-sm">
            </label>
            <p id="signupMsg" class="text-xs font-semibold min-h-[18px]" aria-live="polite"></p>
            <button type="submit" class="w-full py-3 rounded-full bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700">Create Account → Verify OTP</button>
            <p class="text-[11px] text-slate-500 text-center">OTP will be sent to your email (real email via Gmail) or shown in dev mode.</p>
          </form>

          <!-- OTP Verify -->
          <div id="otpBox" class="hidden mt-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <h4 class="font-bold text-sm text-amber-900 flex items-center gap-2"><i class="fa-solid fa-shield-halved"></i> Verify OTP</h4>
            <p class="text-xs text-amber-800 mt-1">Enter 6-digit code sent to <b id="otpEmailLabel">your email</b>. Valid 10 min.</p>
            <div class="mt-3 flex gap-2">
              <input id="otpInput" inputmode="numeric" maxlength="6" placeholder="123456" aria-label="OTP code" class="flex-1 px-3 py-2.5 rounded-xl border border-amber-300 text-center tracking-[6px] font-mono font-bold text-lg">
              <button onclick="verifyOTP()" class="px-5 py-2.5 rounded-full bg-amber-600 text-white font-bold text-sm">Verify</button>
            </div>
            <p id="otpMsg" class="text-xs font-semibold mt-2 min-h-[16px]" aria-live="polite"></p>
            <button onclick="resendOTP()" class="text-xs font-bold text-amber-700 underline mt-2">Resend OTP</button>
            <p class="text-[11px] text-slate-500 mt-2" id="devOtpHint"></p>
          </div>

          <!-- Forgot -->
          <div id="forgotBox" class="hidden mt-5 bg-slate-50 border rounded-2xl p-4">
            <h4 class="font-bold text-sm">Forgot Password</h4>
            <p class="text-xs text-slate-600 mt-1">Enter your email to get verification code.</p>
            <div class="mt-3 flex gap-2">
              <input id="forgotEmail" type="email" placeholder="you@example.com" aria-label="Email for password reset" class="flex-1 px-3 py-2.5 rounded-xl border text-sm">
              <button onclick="sendForgotOTP()" class="px-4 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold">Send Code</button>
            </div>
            <div id="resetBox" class="hidden mt-3 space-y-2">
              <input id="forgotOtp" placeholder="OTP code" aria-label="Forgot OTP" class="w-full px-3 py-2.5 rounded-xl border text-sm">
              <input id="forgotNewPass" type="password" placeholder="New password" aria-label="New password" class="w-full px-3 py-2.5 rounded-xl border text-sm">
              <input id="forgotConfirm" type="password" placeholder="Confirm new password" aria-label="Confirm new password" class="w-full px-3 py-2.5 rounded-xl border text-sm">
              <button onclick="resetPassword()" class="w-full py-2.5 rounded-full bg-indigo-600 text-white font-bold text-sm">Reset Password</button>
            </div>
            <p id="forgotMsg" class="text-xs font-semibold mt-2" aria-live="polite"></p>
          </div>

          <div class="mt-4 bg-slate-50 border rounded-xl p-3">
            <p class="text-xs font-bold uppercase tracking-widest text-slate-500">SQL Database</p>
            <p class="text-xs text-slate-600 mt-1">We use <b>own SQLite</b> (./backend/database.db) — <b>not Supabase</b>. Tables: <code>users</code>, <code>otps</code>, <code>documents</code>. Check <code>/api/health</code> &amp; <code>/api/admin/users</code>.</p>
            <p class="text-[11px] text-slate-500 mt-1">Emails sent via Gmail App Password (one domain). Configure in <code>backend/.env</code> → <code>GMAIL_USER</code> &amp; <code>GMAIL_APP_PASSWORD</code>.</p>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // Expose globals
    window.openAuth = (mode)=>{
      modal.classList.remove('hidden'); modal.setAttribute('aria-hidden','false');
      switchAuth(mode);
      announce(mode==='signup'?'Signup dialog opened':'Login dialog opened');
    };
    window.closeAuth = ()=>{
      modal.classList.add('hidden'); modal.setAttribute('aria-hidden','true');
    };
    window.switchAuth = (mode)=>{
      const isLogin = mode==='login';
      document.getElementById('loginForm').classList.toggle('hidden', !isLogin);
      document.getElementById('signupForm').classList.toggle('hidden', isLogin);
      document.getElementById('tabLogin').setAttribute('aria-selected', isLogin);
      document.getElementById('tabSignup').setAttribute('aria-selected', !isLogin);
      document.getElementById('tabLogin').className = isLogin ? 'flex-1 py-2 rounded-full bg-white shadow font-bold text-sm' : 'flex-1 py-2 rounded-full font-bold text-sm text-slate-600';
      document.getElementById('tabSignup').className = !isLogin ? 'flex-1 py-2 rounded-full bg-white shadow font-bold text-sm' : 'flex-1 py-2 rounded-full font-bold text-sm text-slate-600';
      document.getElementById('authTitle').innerHTML = isLogin ? '<i class="fa-solid fa-right-to-bracket"></i> Welcome Back' : '<i class="fa-solid fa-user-plus"></i> Create Account';
      document.getElementById('otpBox').classList.add('hidden');
      document.getElementById('forgotBox').classList.add('hidden');
    };
    window.togglePass = (id)=>{
      const el=document.getElementById(id);
      el.type = el.type==='password' ? 'text' : 'password';
    };
    // Close on Esc
    modal.addEventListener('keydown', e=>{ if(e.key==='Escape') closeAuth(); });
  }

  let pendingEmail='', pendingPurpose='signup';
  window.handleSignup = async (e)=>{
    e.preventDefault();
    const name=document.getElementById('signupName').value.trim();
    const email=document.getElementById('signupEmail').value.trim();
    const pass=document.getElementById('signupPass').value;
    const confirm=document.getElementById('signupConfirm').value;
    const msg=document.getElementById('signupMsg');
    msg.textContent='Creating account...'; msg.className='text-xs font-semibold text-slate-600';
    try{
      const res=await fetch(`${API_BASE}/api/auth/signup`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name,email,password:pass,confirmPassword:confirm})});
      const j=await res.json();
      if(!res.ok) throw new Error(j.error || 'Failed');
      msg.textContent='✅ OTP sent to '+email; msg.className='text-xs font-bold text-emerald-600';
      pendingEmail=email; pendingPurpose='signup';
      document.getElementById('otpEmailLabel').textContent=email;
      document.getElementById('otpBox').classList.remove('hidden');
      if(j.devOtp) document.getElementById('devOtpHint').textContent='DEV OTP (no email config): '+j.devOtp;
      announce('OTP sent to '+email);
    }catch(err){
      msg.textContent='❌ '+err.message; msg.className='text-xs font-bold text-red-600';
      if(err.message.includes('already exists')) announce('Email already exists');
    }
  };
  window.handleLogin = async (e)=>{
    e.preventDefault();
    const email=document.getElementById('loginEmail').value.trim();
    const pass=document.getElementById('loginPass').value;
    const msg=document.getElementById('loginMsg');
    msg.textContent='Logging in...'; msg.className='text-xs font-semibold text-slate-600';
    try{
      const res=await fetch(`${API_BASE}/api/auth/login`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email,password:pass})});
      const j=await res.json();
      if(!res.ok) {
        if(j.error && j.error.includes('not found')) throw new Error('Your account is not found. Please sign up first.');
        if(j.needVerify){
          msg.textContent='Email not verified — OTP sent. Please verify.';
          pendingEmail=j.email; pendingPurpose='signup';
          document.getElementById('otpEmailLabel').textContent=j.email;
          document.getElementById('otpBox').classList.remove('hidden');
          return;
        }
        throw new Error(j.error);
      }
      localStorage.setItem('inter_token', j.token);
      localStorage.setItem('inter_user', JSON.stringify(j.user));
      msg.textContent='✅ Login successful'; msg.className='text-xs font-bold text-emerald-600';
      announce('Login successful, welcome '+j.user.name);
      setTimeout(()=> location.reload(), 800);
    }catch(err){
      msg.textContent='❌ '+err.message; msg.className='text-xs font-bold text-red-600';
    }
  };
  window.verifyOTP = async ()=>{
    const otp=document.getElementById('otpInput').value.trim();
    const msg=document.getElementById('otpMsg');
    if(!otp || otp.length!==6) return msg.textContent='Enter 6-digit OTP';
    msg.textContent='Verifying...';
    try{
      const res=await fetch(`${API_BASE}/api/auth/verify-otp`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:pendingEmail, otp, purpose:pendingPurpose})});
      const j=await res.json();
      if(!res.ok) throw new Error(j.error);
      msg.textContent='✅ Verified! Logging in...'; msg.className='text-xs font-bold text-emerald-600';
      localStorage.setItem('inter_token', j.token);
      localStorage.setItem('inter_user', JSON.stringify(j.user));
      announce('Email verified successfully');
      setTimeout(()=> location.reload(), 800);
    }catch(err){ msg.textContent='❌ '+err.message; msg.className='text-xs font-bold text-red-600'; }
  };
  window.resendOTP = async ()=>{
    const msg=document.getElementById('otpMsg');
    msg.textContent='Resending...';
    const res=await fetch(`${API_BASE}/api/auth/resend-otp`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:pendingEmail, purpose:pendingPurpose})});
    const j=await res.json();
    msg.textContent=j.devOtp ? '✅ Resent! DEV OTP: '+j.devOtp : '✅ OTP resent to email';
    if(j.devOtp) document.getElementById('devOtpHint').textContent='DEV OTP: '+j.devOtp;
  };
  window.openForgot = ()=>{
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('signupForm').classList.add('hidden');
    document.getElementById('otpBox').classList.add('hidden');
    document.getElementById('forgotBox').classList.remove('hidden');
  };
  window.sendForgotOTP = async ()=>{
    const email=document.getElementById('forgotEmail').value.trim();
    const msg=document.getElementById('forgotMsg');
    if(!email) return msg.textContent='Enter email';
    msg.textContent='Sending code...';
    try{
      const res=await fetch(`${API_BASE}/api/auth/forgot-password`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email})});
      const j=await res.json();
      if(!res.ok) throw new Error(j.error);
      msg.textContent='✅ Verification code sent to '+email;
      msg.className='text-xs font-bold text-emerald-600';
      document.getElementById('resetBox').classList.remove('hidden');
      pendingEmail=email;
      if(j.devOtp) msg.textContent += '  DEV CODE: '+j.devOtp;
    }catch(err){ msg.textContent='❌ '+err.message; msg.className='text-xs font-bold text-red-600'; }
  };
  window.resetPassword = async ()=>{
    const otp=document.getElementById('forgotOtp').value.trim();
    const np=document.getElementById('forgotNewPass').value;
    const cp=document.getElementById('forgotConfirm').value;
    const msg=document.getElementById('forgotMsg');
    if(!otp || !np) return msg.textContent='Fill all fields';
    msg.textContent='Resetting...';
    try{
      const res=await fetch(`${API_BASE}/api/auth/reset-password`, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({email:pendingEmail, otp, newPassword:np, confirmPassword:cp})});
      const j=await res.json();
      if(!res.ok) throw new Error(j.error);
      msg.textContent='✅ '+j.message + ' — You can login now.'; msg.className='text-xs font-bold text-emerald-600';
      announce('Password reset successful');
      setTimeout(()=> { document.getElementById('forgotBox').classList.add('hidden'); switchAuth('login'); }, 1200);
    }catch(err){ msg.textContent='❌ '+err.message; }
  };
  window.logout = ()=>{
    localStorage.removeItem('inter_token');
    localStorage.removeItem('inter_user');
    announce('Logged out');
    location.reload();
  };

  // Auto-show login if not authenticated and backend available
  function checkAuth(){
    // Show welcome if not logged in
    if(!currentUser){
      // Don't auto-popup, but show banner
      const dash=document.querySelector('#view-dashboard .bg-white');
      if(dash && !document.getElementById('authBanner')){
        const b=document.createElement('div');
        b.id='authBanner';
        b.className='mb-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4';
        b.setAttribute('role','alert');
        b.innerHTML=`<div><p class="font-bold text-sm text-amber-900">🔐 Login to save your library across devices</p><p class="text-xs text-amber-700 mt-1">SQL database (SQLite) — email + OTP verification. No Supabase.</p></div><div class="flex gap-2 shrink-0"><button onclick="openAuth('login')" class="px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold">Login</button><button onclick="openAuth('signup')" class="px-4 py-2 rounded-full bg-white border text-xs font-bold">Sign Up</button></div>`;
        dash.prepend(b);
      }
    } else {
      // Show user in pomodoro? maybe not
    }
  }

  // Enhance Settings with Pomodoro toggle + DB status
  function enhanceSettings(){
    // Wait for settings modal to exist
    const modal=document.getElementById('settingsModal');
    if(!modal) return;
    const container=modal.querySelector('.p-6.space-y-5');
    if(!container || document.getElementById('pomoSettingsSection')) return;
    const section=document.createElement('div');
    section.id='pomoSettingsSection';
    section.className='bg-amber-50 border border-amber-200 rounded-2xl p-4';
    section.innerHTML=`
      <h4 class="font-bold text-sm text-amber-900 flex items-center gap-2"><i class="fa-solid fa-stopwatch"></i> Study Reminder (Pomodoro)</h4>
      <label class="mt-3 flex items-center justify-between p-3 bg-white border rounded-xl">
        <div>
          <p class="font-bold text-sm text-slate-900">Enable 25 min study / 5 min break</p>
          <p class="text-xs text-slate-500">After 25 min, locks page until water photo or 5 min auto-unlock. Very important for focus.</p>
        </div>
        <input id="pomoEnabledToggle" type="checkbox" ${pomoEnabled?'checked':''} aria-label="Enable pomodoro reminder" class="w-10 h-6 accent-indigo-600">
      </label>
      <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div class="bg-white border rounded-xl p-2"><b>25:00</b><br>Study</div>
        <div class="bg-white border rounded-xl p-2"><b>05:00</b><br>Break • Water</div>
        <div class="bg-white border rounded-xl p-2"><b>📸</b><br>Photo verify</div>
      </div>
      <p class="text-[11px] text-amber-700 mt-2">Disable anytime in Settings. Timer shows bottom-left (desktop) & bottom bar (mobile).</p>
    `;
    container.appendChild(section);
    document.getElementById('pomoEnabledToggle').addEventListener('change', e=>{
      pomoEnabled=e.target.checked;
      localStorage.setItem('pomo_enabled', pomoEnabled);
      if(pomoEnabled){
        document.getElementById('pomoWidget')?.classList.remove('hidden');
        announce('Study reminder enabled — 25-5 timer active');
      } else {
        document.getElementById('pomoWidget')?.classList.add('hidden');
        pausePomo();
        announce('Study reminder disabled');
      }
    });

    // DB status
    const dbCard=document.createElement('div');
    dbCard.className='bg-slate-50 border border-slate-200 rounded-2xl p-4';
    dbCard.innerHTML=`
      <p class="text-xs font-bold uppercase tracking-widest text-slate-600">🗄️ Own SQL Database (No Supabase)</p>
      <p class="text-sm text-slate-700 mt-1">SQLite at <code>backend/database.db</code> — Tables: users, otps, documents, quiz_attempts.</p>
      <div class="mt-2 flex gap-2">
        <button id="checkDbBtn" class="px-3 py-1.5 rounded-full bg-white border text-xs font-bold">Check DB Health</button>
        <a href="/api/health" target="_blank" class="px-3 py-1.5 rounded-full bg-white border text-xs font-bold">/api/health</a>
        <a href="/sitemap.xml" target="_blank" class="px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">Sitemap.xml</a>
      </div>
      <p id="dbStatus" class="text-xs mt-2 min-h-[16px]" aria-live="polite"></p>
      <p class="text-[11px] text-slate-500 mt-2">Email OTP via Gmail App Password. Set <code>GMAIL_USER</code> & <code>GMAIL_APP_PASSWORD</code> in <code>backend/.env</code>. Google Search Console: set <code>GSC_VERIFICATION_TOKEN</code> & <code>DOMAIN</code>.</p>
    `;
    container.appendChild(dbCard);
    document.getElementById('checkDbBtn').addEventListener('click', async ()=>{
      const el=document.getElementById('dbStatus');
      el.textContent='Checking...';
      try{
        const r=await fetch(`${API_BASE}/api/health`);
        const j=await r.json();
        el.textContent='✅ DB OK — ' + (j.ok?'SQLite connected':'') + ' @ ' + j.time;
        el.className='text-xs font-bold text-emerald-600 mt-2';
      }catch(e){ el.textContent='❌ Backend not reachable (demo mode). Run backend: cd backend && npm start'; el.className='text-xs font-bold text-amber-700 mt-2'; }
    });
    // Request notification permission
    if(Notification && Notification.permission==='default'){
      const btn=document.createElement('button');
      btn.textContent='Enable Break Notifications';
      btn.className='mt-2 px-3 py-1 rounded-full bg-white border text-xs font-bold';
      btn.onclick=()=> Notification.requestPermission();
      dbCard.appendChild(btn);
    }
  }

  // Google Search Console helpers — inject meta if token set
  function injectGSC(){
    const token = 'google-site-verification=pending'; // will be replaced by backend env
    // Check if meta already exists
    // We also add sitemap link
    const link=document.createElement('link');
    link.rel='sitemap';
    link.type='application/xml';
    link.href='/sitemap.xml';
    document.head.appendChild(link);
  }

  // Init all
  document.addEventListener('DOMContentLoaded', ()=>{
    injectARIA();
    createPomodoroUI();
    createTTSUI();
    createAuthUI();
    injectGSC();
    checkAuth();
    // Enhance settings after a bit (modal exists)
    setTimeout(enhanceSettings, 800);
    // Try to detect backend health
    fetch(`${API_BASE}/api/health`).then(r=>r.json()).then(j=> console.log('Backend health',j)).catch(()=> console.log('Backend not reachable — demo mode'));
    // Keyboard shortcut: Ctrl+Shift+P for pomodoro
    document.addEventListener('keydown', e=>{
      if(e.ctrlKey && e.shiftKey && e.key.toLowerCase()==='p'){ e.preventDefault(); togglePomo(); }
    });
  });

  // Expose for manual testing
  window.InterEnhancements = { detectLang, speak, stopTTS, translateText, API_BASE, togglePomo, resetPomo };
})();
