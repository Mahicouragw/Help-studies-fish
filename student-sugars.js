/* Student Sugars — Extra features Inter toppers actually need */
(function(){
  const TS_INTER_EXAM = new Date('2026-03-01T09:00:00+05:30'); // IPE 2nd year approx
  const SYLLABUS = {
    MPC: {
      "Maths IA": ["Functions","Mathematical Induction","Matrices","Trigonometry","Vectors"],
      "Maths IB": ["Coordinate Geometry","3D Geometry","Calculus - Limits","Differentiation"],
      "Physics": ["Motion in Plane","Work Energy","Gravitation","Thermodynamics","Waves"],
      "Chemistry": ["Atomic Structure","Periodicity","Chemical Bonding","Organic Basics"]
    },
    BiPC: {
      "Botany": ["Cell Structure","Plant Physiology","Genetics","Ecology"],
      "Zoology": ["Animal Diversity","Human Physiology","Reproduction","Evolution"],
      "Physics": ["Motion","Work Energy","Thermodynamics","Waves"],
      "Chemistry": ["Atomic Structure","Periodicity","Organic"]
    }
  };
  const FORMULAS = {
    "Maths IA - Functions": "f: A→B, Domain, Range, Types: One-one, Onto, Bijective. f(x)=x², f⁻¹ important for 2M/4M.",
    "Physics - Work Energy": "W=F·s cosθ, KE=½mv², PE=mgh, Power=P=W/t, Work-Energy Theorem: W=ΔKE",
    "Chemistry - Atomic": "n=1,2,3... l=0 to n-1, s=±½, de Broglie λ=h/p, Heisenberg ΔxΔp≥h/4π"
  };

  function getStream(){ return localStorage.getItem('inter_stream')||'MPC'; }

  function createStudentSugars(){
    // 1. Exam Countdown + Streak + Quick Stats Bar (insert after dashboard hero)
    const hero = document.querySelector('#view-dashboard .bg-white.rounded-\\[24px\\]');
    if(hero && !document.getElementById('studentSugarBar')){
      const bar=document.createElement('div');
      bar.id='studentSugarBar';
      bar.className='grid grid-cols-2 lg:grid-cols-4 gap-3';
      const daysLeft = Math.max(0, Math.ceil((TS_INTER_EXAM - new Date())/86400000));
      const streak = parseInt(localStorage.getItem('study_streak')||'0',10);
      const todayDone = localStorage.getItem('today_done')===new Date().toDateString() ? 'Done ✓' : 'Not yet';
      bar.innerHTML=`
        <div class="bg-gradient-to-br from-slate-900 to-indigo-900 rounded-2xl p-4 text-white relative overflow-hidden">
          <div class="absolute -right-4 -top-4 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
          <p class="text-xs font-bold tracking-widest uppercase opacity-70">IPE 2026 Countdown</p>
          <p class="font-display font-800 text-2xl mt-1">${daysLeft} Days</p>
          <p class="text-xs opacity-80 mt-1">TS Inter 2nd Year • March 1</p>
          <div class="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden"><div class="h-full bg-emerald-400" style="width:${Math.min(100, Math.max(10, 100-daysLeft/3))}%"></div></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-2xl p-4 card-shadow">
          <p class="text-xs font-bold tracking-widest uppercase text-slate-500 flex items-center gap-1"><i class="fa-solid fa-fire text-orange-500"></i> Study Streak</p>
          <p class="font-display font-800 text-2xl mt-1">${streak} days</p>
          <p class="text-xs text-emerald-600 font-semibold mt-1">${todayDone} • Keep going!</p>
          <button onclick="markTodayDone()" class="mt-2 text-xs font-bold px-3 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100">Mark Today ✓</button>
        </div>
        <div class="bg-white border border-slate-200 rounded-2xl p-4 card-shadow">
          <p class="text-xs font-bold tracking-widest uppercase text-slate-500">Attendance %</p>
          <div class="flex items-center gap-2 mt-2">
            <input id="attended" type="number" placeholder="Attended" class="w-16 px-2 py-1.5 rounded-lg border text-sm" oninput="calcAttendance()">
            <span class="text-slate-400">/</span>
            <input id="totalClasses" type="number" placeholder="Total" class="w-16 px-2 py-1.5 rounded-lg border text-sm" oninput="calcAttendance()">
            <span id="attResult" class="font-bold text-indigo-600 ml-1">--%</span>
          </div>
          <p class="text-[11px] text-slate-500 mt-1">75% required for IPE</p>
        </div>
        <div class="bg-white border border-slate-200 rounded-2xl p-4 card-shadow">
          <p class="text-xs font-bold tracking-widest uppercase text-slate-500">Marks Predictor</p>
          <div class="flex gap-2 mt-2">
            <input id="marksObtained" type="number" placeholder="Scored" class="w-16 px-2 py-1.5 rounded-lg border text-sm" oninput="calcMarks()">
            <span class="text-slate-400">/</span>
            <input id="marksTotal" type="number" value="600" class="w-16 px-2 py-1.5 rounded-lg border text-sm" oninput="calcMarks()">
            <span id="marksResult" class="font-bold text-emerald-600 ml-1">--%</span>
          </div>
          <p class="text-[11px] text-slate-500 mt-1">Inter total 1000 (2 years)</p>
        </div>
      `;
      hero.after(bar);
      window.markTodayDone = ()=>{
        const today=new Date().toDateString();
        if(localStorage.getItem('today_done')!==today){
          const s=parseInt(localStorage.getItem('study_streak')||'0',10)+1;
          localStorage.setItem('study_streak', s);
          localStorage.setItem('today_done', today);
          document.getElementById('studentSugarBar').querySelector('.text-2xl').textContent=s+' days';
          // Also update streak display
          const el=document.querySelector('#studentSugarBar .text-2xl');
          if(el) el.textContent=s+' days';
          // Update sugar bar streak
          const streakEl = bar.querySelectorAll('.font-800')[1];
          if(streakEl) streakEl.textContent=s+' days';
          alert('Streak updated! 🔥 '+s+' days — keep it up!');
          location.reload();
        } else alert('Already marked today ✓');
      };
      window.calcAttendance=()=>{
        const a=parseFloat(document.getElementById('attended').value)||0;
        const t=parseFloat(document.getElementById('totalClasses').value)||0;
        const r=t? Math.round(a/t*100):0;
        const el=document.getElementById('attResult');
        el.textContent=r+'%';
        el.className= r>=75?'font-bold text-emerald-600 ml-1':'font-bold text-red-600 ml-1';
      };
      window.calcMarks=()=>{
        const m=parseFloat(document.getElementById('marksObtained').value)||0;
        const tot=parseFloat(document.getElementById('marksTotal').value)||600;
        const p=tot? (m/tot*100).toFixed(1):0;
        document.getElementById('marksResult').textContent=p+'%';
      };
    }

    // 2. Syllabus Tracker (add to dashboard second row)
    const subjGrid = document.getElementById('subjectGrid');
    if(subjGrid && !document.getElementById('syllabusTracker')){
      const stream=getStream();
      const subjects=SYLLABUS[stream] || SYLLABUS.MPC;
      const tracker=document.createElement('div');
      tracker.id='syllabusTracker';
      tracker.className='mt-4 bg-slate-50 border border-slate-200 rounded-2xl p-4';
      let html=`<h4 class="font-bold text-sm flex items-center gap-2"><i class="fa-solid fa-list-check text-indigo-600"></i> Syllabus Tracker — ${stream} <span class="ml-auto text-xs font-normal text-slate-500">${Object.keys(subjects).length} subjects</span></h4>`;
      Object.entries(subjects).forEach(([subj, chapters])=>{
        const key='syll_'+subj;
        const done=JSON.parse(localStorage.getItem(key)||'[]');
        const pct=Math.round(done.length/chapters.length*100);
        html+=`<div class="mt-3 bg-white border rounded-xl p-3"><div class="flex justify-between items-center"><b class="text-sm">${subj}</b><span class="text-xs font-bold ${pct===100?'text-emerald-600':'text-slate-500'}">${pct}% • ${done.length}/${chapters.length}</span></div><div class="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden"><div class="h-full bg-indigo-600" style="width:${pct}%"></div></div><div class="mt-2 flex flex-wrap gap-1.5">`;
        chapters.forEach(ch=>{
          const isDone=done.includes(ch);
          html+=`<label class="text-xs px-2.5 py-1 rounded-full border cursor-pointer flex items-center gap-1 ${isDone?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-slate-50 border-slate-200'}"><input type="checkbox" ${isDone?'checked':''} onchange="toggleChapter('${subj}','${ch}',this.checked)" class="accent-emerald-600"> ${ch}</label>`;
        });
        html+=`</div></div>`;
      });
      tracker.innerHTML=html;
      subjGrid.parentNode.appendChild(tracker);
      window.toggleChapter=(subj,ch,checked)=>{
        const key='syll_'+subj;
        let arr=JSON.parse(localStorage.getItem(key)||'[]');
        if(checked) { if(!arr.includes(ch)) arr.push(ch); } else arr=arr.filter(x=>x!==ch);
        localStorage.setItem(key, JSON.stringify(arr));
        // Re-render tracker
        tracker.remove();
        createStudentSugars();
      };
    }

    // 3. Formula Sheets + Previous Papers (add as new tabs in sidebar)
    const nav=document.querySelector('aside nav');
    if(nav && !document.getElementById('nav-formulas')){
      const mkBtn=(id,icon,label)=>`<button onclick="nav('formulas')" data-nav="formulas" id="nav-formulas" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-600 font-medium text-sm"><i class="fa-solid ${icon} w-5"></i> ${label}</button>`;
      // Insert after flashcards before divider
      const flashBtn=nav.querySelector('[data-nav="flashcards"]');
      if(flashBtn){
        const wrapper=document.createElement('div');
        wrapper.innerHTML=`
          <button onclick="nav('formulas')" data-nav="formulas" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-600 font-medium text-sm"><i class="fa-solid fa-square-root-variable w-5"></i> Formula Sheets</button>
          <button onclick="nav('papers')" data-nav="papers" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-600 font-medium text-sm"><i class="fa-solid fa-file-lines w-5"></i> Prev Papers</button>
          <button onclick="nav('tracker')" data-nav="tracker" class="nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-600 font-medium text-sm"><i class="fa-solid fa-chart-line w-5"></i> Progress</button>
        `;
        flashBtn.after(wrapper);
      }
      // Ensure nav function handles new views
      const originalNav=window.nav;
      window.nav = function(id){
        if(['formulas','papers','tracker'].includes(id)){
          document.querySelectorAll('[id^="view-"]').forEach(el=>el.classList.add('hidden'));
          document.getElementById('view-'+id)?.classList.remove('hidden');
          document.querySelectorAll('.nav-btn').forEach(b=>{ b.classList.remove('bg-indigo-600','text-white'); b.classList.add('text-slate-600'); });
          document.querySelector(`[data-nav="${id}"]`)?.classList.add('bg-indigo-600','text-white');
          window.scrollTo({top:0,behavior:'smooth'});
          return;
        }
        return originalNav(id);
      };
    }

    // 4. Create the new view sections if not exist
    const main=document.querySelector('main');
    if(main && !document.getElementById('view-formulas')){
      const formulas=document.createElement('section');
      formulas.id='view-formulas';
      formulas.className='hidden space-y-6';
      formulas.innerHTML=`
        <div class="bg-white rounded-[24px] card-shadow border p-6">
          <h2 class="font-display font-bold text-xl">📐 Formula Sheets — One-Page Revision</h2>
          <p class="text-sm text-slate-500 mt-1">Tap copy, TTS read, or ask AITutor to explain any formula.</p>
          <div class="grid sm:grid-cols-2 gap-3 mt-5">
            ${Object.entries(FORMULAS).map(([k,v])=>`
              <div class="bg-slate-50 border rounded-2xl p-4">
                <p class="font-bold text-sm text-slate-900">${k}</p>
                <p class="text-sm text-slate-700 mt-2 leading-relaxed">${v}</p>
                <div class="mt-3 flex gap-2">
                  <button onclick="navigator.clipboard.writeText('${v.replace(/'/g,"\\'")}'); alert('Copied!')" class="px-3 py-1 rounded-full bg-white border text-xs font-bold">Copy</button>
                  <button onclick="speak('${v.replace(/'/g,"\\'")}', 'en')" class="px-3 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold">🔊 Listen</button>
                  <button onclick="nav('tutor'); setTimeout(()=>quickAsk('Explain formula: ${v.replace(/'/g,"\\'")} with example for Inter 4M'),300)" class="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold">Ask AI</button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <i class="fa-solid fa-wand-magic-sparkles text-amber-600 mt-0.5"></i>
            <p class="text-sm text-amber-900"><b>Sugar:</b> Generate formula sheet from ANY PDF → Upload → Library → Formula Sheets → <span class="underline">Auto-create from chapter</span> (coming: AI extracts all formulas).</p>
          </div>
        </div>
      `;
      main.appendChild(formulas);

      const papers=document.createElement('section');
      papers.id='view-papers';
      papers.className='hidden space-y-6';
      papers.innerHTML=`
        <div class="bg-white rounded-[24px] card-shadow border p-6">
          <h2 class="font-display font-bold text-xl">📄 Previous Year Papers — BIE Telangana</h2>
          <p class="text-sm text-slate-500 mt-1">IPE 2023 & 2024 — download, then Upload to generate blueprint quizzes.</p>
          <div class="grid sm:grid-cols-3 gap-3 mt-5">
            <a href="https://bie.telangana.gov.in" target="_blank" class="bg-white border rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition">
              <p class="font-bold text-sm">Maths IA — IPE 2024</p><p class="text-xs text-slate-500 mt-1">BIE Official • 60 marks • PDF</p><span class="mt-2 inline-flex text-xs font-bold text-indigo-600">Open BIE →</span>
            </a>
            <a href="https://bie.telangana.gov.in" target="_blank" class="bg-white border rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition">
              <p class="font-bold text-sm">Physics — IPE 2024</p><p class="text-xs text-slate-500 mt-1">BIE Official</p><span class="mt-2 inline-flex text-xs font-bold text-indigo-600">Open BIE →</span>
            </a>
            <a href="https://bie.telangana.gov.in" target="_blank" class="bg-white border rounded-2xl p-4 hover:border-indigo-300 hover:shadow-md transition">
              <p class="font-bold text-sm">Chemistry — IPE 2023</p><p class="text-xs text-slate-500 mt-1">BIE Official</p><span class="mt-2 inline-flex text-xs font-bold text-indigo-600">Open BIE →</span>
            </a>
          </div>
          <div class="mt-4 p-3 bg-slate-50 border rounded-xl text-sm">
            <b>How to use:</b> Download paper → <b>Upload PDF</b> here → AITutor → <b>Generate Mixed Blueprint (10 Qs)</b> → Practice like real exam with timer.
          </div>
        </div>
      `;
      main.appendChild(papers);

      const tracker=document.createElement('section');
      tracker.id='view-tracker';
      tracker.className='hidden space-y-6';
      tracker.innerHTML=`
        <div class="bg-white rounded-[24px] card-shadow border p-6">
          <h2 class="font-display font-bold text-xl">📊 Your Progress —糖 Sugar Dashboard</h2>
          <p class="text-sm text-slate-500 mt-1">Everything a student needs at a glance.</p>
          <div class="grid sm:grid-cols-2 gap-4 mt-5">
            <div class="bg-slate-50 border rounded-2xl p-4">
              <h4 class="font-bold text-sm">Weekly Goal</h4>
              <div class="mt-3 flex gap-1">
                ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>{
                  const done = localStorage.getItem('week_'+i)==='1';
                  return `<label class="flex-1 text-center p-2 rounded-xl border ${done?'bg-emerald-50 border-emerald-200':'bg-white'}"><input type="checkbox" ${done?'checked':''} onchange="localStorage.setItem('week_${i}', this.checked?'1':'0'); this.parentNode.className=this.checked?'flex-1 text-center p-2 rounded-xl border bg-emerald-50 border-emerald-200':'flex-1 text-center p-2 rounded-xl border bg-white'" class="accent-emerald-600"><br><span class="text-xs font-bold">${d}</span></label>`;
                }).join('')}
              </div>
              <p class="text-xs text-slate-500 mt-2">Tick each day you complete Pomodoro streak.</p>
            </div>
            <div class="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
              <h4 class="font-bold text-sm text-indigo-900">AI Insights</h4>
              <p class="text-sm text-indigo-800 mt-2 leading-relaxed">Upload more PDFs to unlock: <b>Weak topics</b>, <b>Time spent</b>, <b>Predicted IPE score</b>. AITutor will analyze your quiz attempts.</p>
              <button onclick="nav('quiz')" class="mt-3 px-4 py-2 rounded-full bg-indigo-600 text-white text-xs font-bold">Generate 10 Qs Now</button>
            </div>
          </div>
          <div class="mt-4 grid sm:grid-cols-3 gap-3">
            <div class="bg-white border rounded-xl p-3 text-center"><p class="text-2xl font-800">${JSON.parse(localStorage.getItem('inter_docs')||'[]').length}</p><p class="text-xs font-bold tracking-widest uppercase text-slate-500">Docs</p></div>
            <div class="bg-white border rounded-xl p-3 text-center"><p class="text-2xl font-800">${JSON.parse(localStorage.getItem('inter_quizzes')||'[]').length}</p><p class="text-xs font-bold tracking-widest uppercase text-slate-500">Quizzes</p></div>
            <div class="bg-white border rounded-xl p-3 text-center"><p class="text-2xl font-800">${localStorage.getItem('study_streak')||0}</p><p class="text-xs font-bold tracking-widest uppercase text-slate-500">Streak days</p></div>
          </div>
        </div>
      `;
      main.appendChild(tracker);
    }

    // 5. Sugar polish — micro animations, toasts, confetti on quiz 80%+
    if(!window._sugarToast){
      window._sugarToast = (msg)=>{
        const t=document.createElement('div');
        t.className='fixed top-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold shadow-xl z-[60]';
        t.textContent=msg;
        document.body.appendChild(t);
        setTimeout(()=>t.remove(), 2500);
      };
      // Hook quiz finish
      const origFinish = window.finishQuiz;
      if(origFinish){
        window.finishQuiz = function(){
          const r=origFinish.apply(this, arguments);
          setTimeout(()=>{
            const txt=document.getElementById('resultText')?.textContent||'';
            const pct=parseInt(txt.match(/(\d+)%/)?.[1]||'0',10);
            if(pct>=80){
              window._sugarToast('🎉 '+pct+'% — Amazing! Share streak?');
              // simple confetti
              for(let i=0;i<12;i++){
                const c=document.createElement('div');
                c.textContent=['🎉','✨','🌟','🔥'][i%4];
                c.style.position='fixed'; c.style.left=Math.random()*100+'%'; c.style.top='-10px';
                c.style.fontSize='20px'; c.style.animation=`fall ${1+Math.random()}s linear`;
                c.style.zIndex=70;
                document.body.appendChild(c);
                setTimeout(()=>c.remove(),2000);
              }
            }
          },100);
          return r;
        };
        // Add fall animation
        const s=document.createElement('style');
        s.textContent='@keyframes fall{to{transform:translateY(100vh) rotate(360deg)}}';
        document.head.appendChild(s);
      }
    }
  }

  // Run after DOM ready
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', createStudentSugars);
  else setTimeout(createStudentSugars, 600);

  // Re-run when stream changes
  const origSetStream = window.setStream;
  if(origSetStream){
    window.setStream = function(v){
      const r=origSetStream(v);
      setTimeout(createStudentSugars, 800);
      return r;
    };
  }
})();
