'use strict';
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>Date.now(),p2=n=>String(n).padStart(2,'0');
const fT=t=>{const d=new Date(t);return p2(d.getHours())+':'+p2(d.getMinutes())};
const fD=t=>{const d=new Date(t);return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())};
const fDT=t=>fD(t)+' '+fT(t);
const toast=(m,ms=2500)=>{const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>t.hidden=true,ms)};
const rv=n=>{const r=$(`input[name="${n}"]:checked`);return r?r.value:''};
const gv=id=>{const e=$('#'+id);return e?e.value:''};
/* ---------- DB ---------- */
let _db;
const dbo=()=>_db||(_db=new Promise((res,rej)=>{const q=indexedDB.open('sosg5',1);q.onupgradeneeded=()=>q.result.createObjectStore('kv');q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)}));
const tx=async(m,f)=>{const d=await dbo();return new Promise((res,rej)=>{const t=d.transaction('kv',m);const r=f(t.objectStore('kv'));t.oncomplete=()=>res(r.result);t.onerror=()=>rej(t.error)})};
const dbGet=k=>tx('readonly',s=>s.get(k));
const dbSet=(k,v)=>tx('readwrite',s=>s.put(v,k));
const dbDel=k=>tx('readwrite',s=>s.delete(k));
const dbAll=async p=>{const d=await dbo();return new Promise(res=>{const o=[];const q=d.transaction('kv').objectStore('kv').openCursor();q.onsuccess=()=>{const c=q.result;if(!c){res(o);return}if(String(c.key).startsWith(p))o.push(c.value);c.continue()}})};
const sha=async s=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');
/* ---------- constants ---------- */
const POSTS={GATE:{ar:'البوابة',en:'Main Gate'},BLDG:{ar:'بجوار المبنى',en:'Beside the Building'}};
const SH={M:{ar:'صباحية',en:'Morning',from:7,to:15},E:{ar:'مسائية',en:'Evening',from:15,to:23}};
const ROLES={guard:['حارس','Guard'],leader:['قائد شفت','Shift Leader'],supervisor:['مشرف','Supervisor'],officer:['أوفيسر','Officer']};
const ST={n:['عادي','Normal','g'],y:['تنبيه / ملاحظة','Observation','y'],r:['حادث أمني / طارئ','Incident','r']};
const PWN={grid:['كهرباء الشبكة','Grid'],gen:['مولد','Generator'],sol:['طاقة شمسية','Solar'],none:['لا توجد طاقة','No power']};
const NET={w:['ضعيف','Weak','y'],g:['جيد','Good','g'],e:['ممتاز','Excellent','g']};
const STG={guard:'عند الحارس',sent_leader:'أُرسل للقائد',at_leader:'عند القائد',reviewed:'راجعه القائد',sent_sup:'أُرسل للمشرف',at_sup:'عند المشرف',sent_off:'أُرسل للأوفيسر',final:'عند الأوفيسر ✔'};
const RK=Object.keys(STG),TO={sent_leader:'القائد',sent_sup:'المشرف',sent_off:'الأوفيسر'};
const PL={start:'بدء المناوبات',imp:'استيراد التقارير',insp:'الجولات التفتيشية',stats:'الإحصائيات',mgr:'إدارة الحسابات',assign:'التوزيع والمهام',texp:'تصدير إعدادات الفريق',edit:'تعديل التقارير'};
const DEF={guard:['start'],leader:['start','imp'],supervisor:['start','imp','insp','stats','mgr','assign','texp','edit'],officer:['imp','insp','stats','mgr','assign','texp','edit']};
const INC=[['محاولة اقتحام / تسلل','Intrusion attempt','r'],['شخص مشبوه','Suspicious person','y'],['إصابة / حالة طبية','Injury / medical case','r'],['حريق / دخان','Fire / smoke','r'],['قصف / إطلاق نار قريب','Shelling / gunfire nearby','r'],['انقطاع الكهرباء','Power outage','y'],['عطل فني','Technical fault','y'],['اقتراب أشخاص من السور','People near the fence','y'],['أخرى','Other','y']];
const Q=[
 {k:'perim',ar:'حالة الأسوار والمداخل',en:'Perimeter & Gates',q:'هل جميع البوابات مغلقة ومؤمنة والأسوار سليمة؟'},
 {k:'light',ar:'الإضاءة الخارجية والداخلية',en:'Lighting',q:'هل الإنارة تعمل بشكل طبيعي في كافة النقاط الحيوية؟'},
 {k:'safety',ar:'معدات السلامة والطوارئ',en:'Fire & Safety Equipment',q:'هل طفايات الحريق وصندوق الإسعافات الأولية في مكانها وصالحة؟'}];
const IC=[['pos','التواجد في نقطة التمركز','Post Positioning','هل الحارس متواجد في النقطة المحددة له أم ترك موقعه دون إذن/بديل؟'],
 ['chal','الاستجابة عند الاقتراب','Challenge & Response','هل انتبه الحارس لاقتراب المشرف بسرعة وقام بإجراءات التحقق والتعرف وفق التعليمات؟'],
 ['uni','الزي الرسمي والهوية','Uniform & ID','هل يرتدي الزي الرسمي/السترة العاكسة وبطاقة التعريف بشكل لائق ونظيف؟'],
 ['gear','تجهيزات الحارس','Personal Gear','هل يحمل الكشاف اليدوي وجهاز الاتصال وصفارة الطوارئ (إن وجدت) بحالة جاهزة؟'],
 ['log','تنظيم السجلات','Logbook Accuracy','هل سجل الزوار والمركبات وأحداث المناوبة محدّث بدقة حتى لحظة التفتيش؟'],
 ['acc','التحكم بالدخول','Access Control','هل البوابات مغلقة بإحكام ولا يوجد أشخاص غير مصرح لهم داخل المحيط؟']];
const IL=[['sup','الإشراف والتوزيع','Team Supervision','هل قام القائد بتوزيع الحراس بشكل صحيح ومتابعة دورياتهم الداخلية؟'],
 ['sit','الإلمام بالوضع الأمني','Situational Awareness','هل القائد على دراية بعدد الموظفين/الزوار داخل الموقع وبخطة الإخلاء الطارئ؟']];
const AL={g:['يقظ ومنتبه تماماً','Fully Alert & Vigilant'],y:['تشتت جزئي (هاتف/حديث جانبي)','Distracted'],r:['نائم أو غائب عن النقطة','Sleeping / Off-Post']};
const OV={4:['ممتاز','Excellent','g'],3:['جيد','Good','g'],2:['يحتاج تحسين','Needs Improvement','y'],1:['غير مقبول','Unacceptable','r']};
const LB={'perim.ok':'الأسوار والمداخل','perim.n':'تفاصيل الأسوار','light.ok':'الإضاءة','light.n':'تفاصيل الإضاءة','safety.ok':'معدات السلامة','safety.n':'تفاصيل السلامة','comm.net':'جودة الاتصال بالإنترنت','comm.pwr':'مصدر الطاقة','comm.solar':'شحن الطاقة الشمسية','access.done':'تسجيل الزوار','access.vis':'عدد الزوار','access.veh':'عدد المركبات','status':'الوضع الأمني','ev.time':'وقت الحدث','ev.desc':'وصف الحدث','hand.done':'تسليم العهدة','hand.to':'المستلم','assist.yes':'مساعدة الموظفين','assist.type':'نوع المساعدة','assist.staff':'الموظف/القسم','assist.det':'تفاصيل المساعدة','notes':'الملاحظات','rev.note':'ملاحظة القائد'};
const FOOT='<div class="foot">هذه الأداة صممت لقسم الأمن SOS<br>تصميم Ahmed Abu Jami<br>saftey and security officer - SOS children\'s villages</div>';
const BK='<button class="b s k" data-a="home">← رجوع</button>',BS='<button class="b s k" data-a="shift">← رجوع للمناوبة</button>';
const pn=p=>POSTS[p]?POSTS[p].ar+' · '+POSTS[p].en:p,shn=s=>SH[s].ar+' · '+SH[s].en,YNT=v=>v==1?'نعم · Yes':'لا · No';
/* ---------- state ---------- */
let CFG,USERS,ME=null,SHIFT=null,INS=null,PH={},PRE={},TICK=0,SP=30,CUR='',TD={};
const V={},ACT={};
const user=id=>USERS.find(u=>u.id===id);
const pOf=(u,k)=>u.perm&&k in u.perm?!!u.perm[k]:DEF[u.role].includes(k);
const hp=k=>ME.role==='officer'?k!=='start':pOf(ME,k);
const persist=async()=>{CFG.ts=now();await dbSet('users',USERS);await dbSet('cfg',CFG)};
const plog=async txt=>{const k=ME.role==='officer'?'priv':'alog';const a=(await dbGet(k))||[];a.push({at:now(),by:ME.name,txt});await dbSet(k,a.slice(-300));if(ME.role!=='officer')notify('🔔 تغيير من '+ROLES[ME.role][0],txt)};
async function seed(){
 CFG=await dbGet('cfg');
 if(!CFG){CFG={orgKey:'SOSG-2025-KEY',wa:'970567144224',email:'',gs:'',tg:'',round:120,ts:0,tasks:[],sites:['البوابة الرئيسية|Main Gate','بجوار المبنى|Beside the Building','منطقة الأمهات|Mothers Area','المخازن|Warehouses']};await dbSet('cfg',CFG)}
 CFG.tasks=CFG.tasks||[];
 TD=(await dbGet('td'))||{};
 USERS=await dbGet('users');
 if(!USERS){const h=p=>sha(p+CFG.orgKey);USERS=[];
  for(let i=1;i<=9;i++)USERS.push({id:'G'+i,name:'حارس '+i,role:'guard',pin:await h('1234'),post:i%2?'GATE':'BLDG',sh:i%2?'M':'E'});
  USERS.push({id:'L1',name:'قائد الشفت الصباحي',role:'leader',pin:await h('2222'),post:'GATE',sh:'M'},
   {id:'L2',name:'قائد الشفت المسائي',role:'leader',pin:await h('2222'),post:'GATE',sh:'E'},
   {id:'S1',name:'المشرف',role:'supervisor',pin:await h('0000'),post:'GATE',sh:'M'},
   {id:'O1',name:'الأوفيسر',role:'officer',pin:await h('9999'),post:'GATE',sh:'M'});
  await dbSet('users',USERS)}
}
/* ---------- alerts: Google Script -> Telegram + Email ---------- */
const b64=b=>new Promise(r=>{const f=new FileReader();f.onload=()=>r(String(f.result).split(',')[1]);f.readAsDataURL(b)});
async function postGS(o){const r=await fetch(CFG.gs,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({key:CFG.orgKey,chat:CFG.tg||'',email:CFG.email||'',...o})});const j=await r.json();if(!j.ok)throw new Error(j.err||'خطأ');return j}
let FL=0;
async function flush(){if(FL||!CFG||!CFG.gs||!navigator.onLine)return;FL=1;
 try{const l=(await dbAll('ob:')).sort((a,b)=>a.t-b.t);for(const it of l){try{await postGS({title:it.title,text:it.text,pdf:it.pdf,name:it.name})}catch(e){break}await dbDel('ob:'+it.id)}}catch(e){}
 FL=0}
async function notify(title,text,pdf,name){if(!CFG||!CFG.gs)return;const id=now()+'_'+Math.floor(Math.random()*1000);
 const by=ME?'\nBy: '+ME.name+' ('+ROLES[ME.role][1]+')':'';
 await dbSet('ob:'+id,{id,t:now(),title,text:text+by,pdf:pdf?await b64(pdf):'',name:name||''});return flush()}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
setInterval(flush,60000);addEventListener('online',flush);
/* ---------- ui core ---------- */
function cond(){$$('[data-if]').forEach(e=>{const[n,v]=e.dataset.if.split('=');const r=$(`input[name="${n}"]:checked`);e.hidden=!(r&&v.split(',').includes(r.value))})}
const view=h=>{$('#view').innerHTML=h+FOOT;cond()};
function go(v,a){clearInterval(TICK);CUR=v;window.scrollTo(0,0);return V[v](a)}
document.addEventListener('click',e=>{const a=e.target.closest('[data-a]');if(a&&ACT[a.dataset.a]){e.preventDefault();ACT[a.dataset.a](a.dataset.v,a)}});
document.addEventListener('change',async e=>{
 cond();const t=e.target;
 if(t.id==='ity'){const r=$(`input[name="isv"][value="${INC[t.value][2]}"]`);if(r)r.checked=true}
 if(t.dataset&&t.dataset.ph&&t.files&&t.files[0]){PH[t.dataset.ph]=await shrink(t.files[0]);const pv=$('#pv_'+t.dataset.ph);if(pv)pv.innerHTML=`<img class="th" src="${PH[t.dataset.ph]}">`}
});
const seg=(n,v,o)=>`<div class="seg">${o.map(([val,t,cl])=>`<label class="${cl||''}"><input type="radio" name="${n}" value="${val}" ${String(v)===String(val)?'checked':''}><span>${t}</span></label>`).join('')}</div>`;
const sel=(id,o,v)=>`<select id="${id}">${o.map(([k,t])=>`<option value="${esc(k)}" ${v===k?'selected':''}>${t}</option>`).join('')}</select>`;
const shrink=f=>new Promise(res=>{const r=new FileReader();r.onload=()=>{const i=new Image();i.onload=()=>{const k=Math.min(1,900/Math.max(i.width,i.height)),c=document.createElement('canvas');c.width=i.width*k;c.height=i.height*k;c.getContext('2d').drawImage(i,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.65))};i.src=r.result};r.readAsDataURL(f)});
let AC;const unlock=()=>{try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();AC.resume&&AC.resume()}catch(e){}};
document.addEventListener('click',unlock);document.addEventListener('touchstart',unlock);
const beep=()=>{try{for(let i=0;i<3;i++){const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=880;o.connect(g);g.connect(AC.destination);g.gain.value=.3;o.start(AC.currentTime+i*.4);o.stop(AC.currentTime+i*.4+.25)}}catch(e){}if(navigator.vibrate)navigator.vibrate([400,200,400,200,400])};
const gps=()=>new Promise(r=>{if(!navigator.geolocation)return r(null);navigator.geolocation.getCurrentPosition(p=>r({lat:+p.coords.latitude.toFixed(6),lng:+p.coords.longitude.toFixed(6)}),()=>r(null),{enableHighAccuracy:true,timeout:9000,maximumAge:30000})});
const waLink=t=>'https://wa.me/'+CFG.wa+'?text='+encodeURIComponent(t);
const shareLinks=(t,s)=>`<a class="b" href="${waLink(t)}" target="_blank" rel="noopener">💬 واتساب</a><a class="b" href="https://t.me/share/url?url=${encodeURIComponent(location.origin+location.pathname)}&text=${encodeURIComponent(t)}" target="_blank" rel="noopener">✈ تلجرام</a><a class="b" href="mailto:${esc(CFG.email)}?subject=${encodeURIComponent(s)}&body=${encodeURIComponent(t)}">✉ بريد إلكتروني</a>`;
const dl=f=>{const a=document.createElement('a');a.href=URL.createObjectURL(f);a.download=f.name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(a.href)},4000)};
async function shareOut(files,text){
 try{if(navigator.canShare&&navigator.canShare({files})){await navigator.share({files,text:text||'',title:'SOS Guard'});return true}}catch(e){if(e.name==='AbortError')return false}
 files.forEach(dl);return true}
async function pack(o,name){const d=JSON.stringify(o);const s=await sha(d+CFG.orgKey);return new File([JSON.stringify({d,s})],name,{type:'text/plain'})}
async function unpack(f){let t;try{t=JSON.parse(await f.text());if(!t.d||!t.s)throw 0}catch(e){throw new Error('ملف غير صالح')}
 if(await sha(t.d+CFG.orgKey)!==t.s)throw new Error('الملف معدّل أو من جهة أخرى');return JSON.parse(t.d)}
/* ---------- QR scan ---------- */
function scan(post,cb){
 const want='SOS|'+post;let st,iv,done=0;
 const ov=document.createElement('div');ov.className='ov';
 ov.innerHTML='<video playsinline muted autoplay></video><div class="sc"><b>وجّه الكاميرا إلى QR «'+POSTS[post].ar+'»</b><div><button class="b" id="sm">تأكيد يدوي</button><button class="b k" id="sx">إلغاء</button></div></div>';
 document.body.appendChild(ov);
 const end=r=>{if(done)return;done=1;clearInterval(iv);st&&st.getTracks().forEach(t=>t.stop());ov.remove();cb(r)};
 $('#sx',ov).onclick=()=>end(null);$('#sm',ov).onclick=()=>end({manual:true});
 const v=$('video',ov),cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
 navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}).then(async s=>{
  if(done){s.getTracks().forEach(t=>t.stop());return}
  st=s;v.srcObject=s;await v.play().catch(()=>{});
  const bd=window.BarcodeDetector?new BarcodeDetector({formats:['qr_code']}):null;let busy=0;
  iv=setInterval(async()=>{if(busy||done||!v.videoWidth)return;busy=1;let t=null;
   try{if(bd){const r=await bd.detect(v);if(r[0])t=r[0].rawValue}
    else if(window.jsQR){const k=Math.min(1,640/v.videoWidth);cv.width=v.videoWidth*k;cv.height=v.videoHeight*k;cx.drawImage(v,0,0,cv.width,cv.height);const q=jsQR(cx.getImageData(0,0,cv.width,cv.height).data,cv.width,cv.height);if(q)t=q.data}}catch(e){}
   busy=0;if(t){if(t.trim()===want)end({manual:false});else toast('هذا QR لموقع آخر: '+t,1500)}},300);
 }).catch(()=>toast('تعذر فتح الكاميرا — استخدم التأكيد اليدوي'));
}
/* ---------- login ---------- */
V.login=()=>view(`<img class="lg" src="icon.svg" alt="SOS" onerror="this.onerror=null;this.style.display='none'"><div class="card c"><h3>SOS Guard — تسجيل الدخول</h3><select id="lu">${USERS.map(u=>`<option value="${u.id}">${esc(u.name)} — ${ROLES[u.role][0]}</option>`).join('')}</select><input id="lp" type="password" inputmode="numeric" placeholder="الرقم السري PIN" style="margin-top:8px"><button class="b big" data-a="login">دخول</button></div>`);
ACT.login=async()=>{const u=user(gv('lu')),pin=gv('lp'),lk=JSON.parse(localStorage.lk||'{}');
 if(lk.until>now())return toast('الحساب مقفل مؤقتاً، حاول بعد '+Math.ceil((lk.until-now())/60000)+' دقيقة');
 if(await sha(pin+CFG.orgKey)===u.pin){localStorage.lk='{}';ME=u;await dbSet('session',u.id);SHIFT=(await dbGet('shift:'+u.id))||null;TD=(await dbGet('td'))||{};go(SHIFT?'shift':'home')}
 else{lk.n=(lk.n||0)+1;if(lk.n>=5){lk.until=now()+300000;lk.n=0}localStorage.lk=JSON.stringify(lk);toast('الرقم السري غير صحيح')}};
ACT.logout=async()=>{ME=null;SHIFT=null;await dbDel('session');go('login')};
ACT.home=()=>go('home');ACT.shift=()=>go('shift');ACT.start=()=>go('start');ACT.incf=()=>go('incf');ACT.endq=()=>go('end');
ACT.insp=()=>go('insp');ACT.inl=()=>go('inl');ACT.mgr=()=>go('mgr');ACT.set=()=>go('set');ACT.stats=()=>go('stats');ACT.asg=()=>go('asg');
ACT.rep=n=>go('rep',n);ACT.ins=n=>go('ins',n);ACT.edit=n=>go('edit',n);
/* ---------- tasks (card shown to the assignee) ---------- */
const taskCard=()=>{if(!ME||ME.role==='officer')return'';const l=(CFG.tasks||[]).filter(t=>(t.to==='ALL'||t.to===ME.id)&&!TD[t.id]);
 return l.length?`<div class="card"><h4>📌 مهامي (${l.length})</h4>${l.map(t=>`<div class="rw"><span>${esc(t.text)}${t.due?'<small>حتى '+esc(t.due)+'</small>':''}<small>من ${esc(t.by)}</small></span><button class="b s ok" data-a="tdone" data-v="${esc(t.id)}">✔ تم</button></div>`).join('')}</div>`:''};
ACT.tdone=async id=>{TD[id]=now();await dbSet('td',TD);toast('✔ تم تسجيل التنفيذ — يظهر في تقرير مناوبتك');V[CUR]()};
/* ---------- home ---------- */
V.home=async()=>{
 const reps=(await dbAll('r:')).filter(r=>ME.role!=='guard'||r.uid===ME.id).sort((a,b)=>b.start-a.start);
 const R=ROLES[ME.role],B=(a,t,v)=>`<button class="b" data-a="${a}"${v?` data-v="${v}"`:''}>${t}</button>`;
 let h=`<div class="top"><div><b>${esc(ME.name)}</b><small>${R[0]} · ${R[1]}</small></div><button class="b s k" data-a="logout">خروج</button></div><img class="lg" src="icon.svg" alt="SOS" onerror="this.onerror=null;this.style.display='none'">`;
 if(SHIFT)h+=`<button class="b big ok" data-a="shift">⏱ العودة إلى المناوبة الجارية</button>`;else if(hp('start'))h+=`<button class="b big" data-a="start">▶ بدء مناوبة</button>`;
 h+=taskCard();
 if(hp('insp'))h+=`<div class="grid"><button class="b big" data-a="insp">🔍 جولة تفتيشية</button><button class="b big" data-a="inl">📋 سجل التفتيش</button></div>`;
 h+=`<div class="grid">`+(hp('imp')?B('imp','📥 استيراد تقرير','rep'):'')+B('imp','🔄 استيراد إعدادات الفريق','team')+(hp('stats')?B('stats','📊 الإحصائيات'):'')+(hp('assign')?B('asg','🗂 التوزيع والمهام'):'')+(hp('mgr')?B('mgr','👥 الحسابات'):'')+(hp('texp')?B('texp','📤 تصدير إعدادات الفريق'):'')+(ME.role==='officer'?B('set','⚙ الإعدادات'):'')+`</div>`;
 h+=`<h4>التقارير</h4>`+(reps.length?reps.map(r=>`<div class="card li" data-a="rep" data-v="${esc(r.no)}"><b>${esc(r.uname)}</b> <span class="${ST[r.check.status][2]}">●</span> <span class="pill">${STG[r.stage]}</span><small>${esc(r.no)} · ${pn(r.post)}</small></div>`).join(''):'<p class="mut c">لا توجد تقارير بعد</p>');
 view(h)};
ACT.imp=k=>{if(k==='rep'&&!hp('imp'))return toast('لا تملك صلاحية استيراد التقارير');const f=$('#fi');f.dataset.k=k;f.value='';f.click()};
$('#fi').onchange=async e=>{const fs=[...e.target.files];if(fs.length&&ME)await importFiles(fs)};
/* ---------- shift ---------- */
V.start=()=>{if(!hp('start'))return go('home');const h=new Date().getHours(),ds=h>=7&&h<15?'M':h>=15&&h<23?'E':ME.sh;
 view(BK+`<div class="card"><h3>▶ بدء مناوبة</h3><label>موقع التمركز</label>${seg('sp',ME.post,Object.entries(POSTS).map(([k,v])=>[k,v.ar+' · '+v.en]))}<label>المناوبة</label>${seg('ss',ds,Object.entries(SH).map(([k,v])=>[k,v.ar+' ('+p2(v.from)+'–'+p2(v.to)+')']))}<button class="b big ok" data-a="sgo">ابدأ</button></div>`)};
ACT.sgo=async()=>{const post=rv('sp'),sh=rv('ss');if(!post||!sh)return toast('اختر الموقع والمناوبة');const t=now();
 SHIFT={no:`GR-${fD(t).replace(/-/g,'')}-${ME.id}${sh}`,uid:ME.id,uname:ME.name,post,sh,start:t,rounds:[],inc:[],next:t+(CFG.round||120)*60000};
 await dbSet('shift:'+ME.id,SHIFT);try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}go('shift')};
const incText=i=>['🚨 SOS PALESTINE — INCIDENT ALERT','Type: '+i.en+' / '+i.ar,'Guard: '+SHIFT.uname,'Site: '+POSTS[SHIFT.post].en,'Time: '+fT(i.t),i.desc?'Details: '+i.desc:'',i.pos?'Location: https://maps.google.com/?q='+i.pos.lat+','+i.pos.lng:''].filter(Boolean).join('\n');
V.shift=()=>{clearInterval(TICK);const s=SHIFT;
 const rl=s.rounds.map((o,i)=>`<div class="rw"><span>${i+1}) ${fT(o.t)}${o.manual?' · يدوي':' · QR'}${o.late>2?' · متأخرة '+o.late+' د':''}</span><span>${o.pos?'📍':''}</span></div>`).join('')||'<p class="mut">لا توجد جولات بعد</p>';
 const il=s.inc.map(i=>`<div class="rw"><span class="${i.sev}">${fT(i.t)} · ${esc(i.ar)}</span>${i.sev==='r'?`<a class="b s r" href="${waLink(incText(i))}" target="_blank" rel="noopener">📲 واتساب</a>`:''}</div>`).join('')||'<p class="mut">لا توجد حوادث</p>';
 view(`<div class="top"><button class="b s k" data-a="home">☰ القائمة</button><button class="b s k" data-a="logout">خروج</button></div>
 <div class="card c"><span class="pill">${pn(s.post)}</span><small>${shn(s.sh)} · ${esc(s.no)}</small><div class="cdl" id="cd">--:--</div><small id="cdt"></small><div class="bar"><i id="pb"></i></div></div>
 <div class="grid"><button class="b big" data-a="round">📍 تسجيل جولة</button><button class="b big y" data-a="incf">⚠ تسجيل حادث</button><button class="b big r" data-a="sos">🆘 طوارئ</button><button class="b big ok" data-a="endq">⏹ إنهاء المناوبة</button></div>
 ${taskCard()}<div class="card"><h4>الجولات (${s.rounds.length})</h4>${rl}</div><div class="card"><h4>الحوادث (${s.inc.length})</h4>${il}</div>`);
 tick();TICK=setInterval(tick,1000)};
function tick(){const s=SHIFT;if(!s||!$('#cd'))return;const iv=(CFG.round||120)*60000,d=s.next-now(),a=Math.abs(d);
 $('#cd').textContent=(d<0?'-':'')+p2(Math.floor(a/60000))+':'+p2(Math.floor(a%60000/1000));
 $('#cd').className='cdl'+(d<0?' late':d<600000?' warn':'');$('#cdt').textContent=d<0?'الجولة متأخرة!':'للجولة القادمة';
 $('#pb').style.width=Math.max(0,Math.min(100,(1-d/iv)*100))+'%';
 if(d<=0&&(!s.al||now()-s.al>=60000)){s.al=now();beep();toast('⏰ حان وقت الجولة',5000)}
 if(d<-900000&&s.esc!==s.next){s.esc=s.next;dbSet('shift:'+s.uid,s);notify('⏰ جولة متأخرة','Guard: '+s.uname+'\nSite: '+POSTS[s.post].en+' / '+POSTS[s.post].ar+'\nمتأخرة '+Math.round(a/60000)+' دقيقة · Late')}}
ACT.round=()=>scan(SHIFT.post,async r=>{if(!r)return;toast('جاري تحديد الموقع…');const pos=await gps(),late=Math.max(0,Math.round((now()-SHIFT.next)/60000));
 SHIFT.rounds.push({t:now(),manual:!!r.manual,pos,late});SHIFT.next=now()+(CFG.round||120)*60000;await dbSet('shift:'+ME.id,SHIFT);toast('✔ تم تسجيل الجولة');V.shift()});
ACT.sos=async()=>{if(!confirm('إرسال نداء طوارئ SOS؟'))return;const pos=await gps(),i={ar:'نداء طوارئ SOS',en:'SOS Emergency',sev:'r',t:now(),desc:'',pos,photo:''};
 SHIFT.inc.push(i);await dbSet('shift:'+ME.id,SHIFT);await Promise.race([notify('🆘 SOS',incText(i)),sleep(2500)]);location.href=waLink(incText(i))};
V.incf=()=>{PH={};view(BS+`<div class="card"><h3>⚠ تسجيل حادث</h3><label>نوع الحدث</label><select id="ity">${INC.map((x,i)=>`<option value="${i}">${x[0]} · ${x[1]}</option>`).join('')}</select><label>الخطورة</label>${seg('isv',INC[0][2],[['y','🟡 تنبيه / ملاحظة','y'],['r','🔴 طارئ','r']])}<label>وقت الحدث</label><input id="itm" type="time" value="${fT(now())}"><label>الوصف والإجراء المتخذ</label><textarea id="ides"></textarea><label>صورة (اختياري) — لا تصوّر الأطفال</label><input type="file" accept="image/*" capture="environment" data-ph="inc"><div id="pv_inc"></div><button class="b big ok" data-a="isave">حفظ</button></div>`)};
ACT.isave=async()=>{const i=+gv('ity'),P=INC[i],desc=gv('ides').trim();if(i===INC.length-1&&!desc)return toast('اكتب الوصف');
 const[h,m]=(gv('itm')||fT(now())).split(':'),d=new Date();d.setHours(+h,+m,0,0);toast('جاري تحديد الموقع…');const pos=await gps();
 const rec={ar:P[0],en:P[1],sev:rv('isv')||P[2],t:d.getTime(),desc,photo:PH.inc||'',pos};
 SHIFT.inc.push(rec);await dbSet('shift:'+ME.id,SHIFT);if(rec.sev==='r')notify('🚨 حادث طارئ',incText(rec));go('shift')};
/* ---------- checklist form ---------- */
const dc=()=>({perim:{ok:'',n:''},light:{ok:'',n:''},safety:{ok:'',n:''},comm:{net:'',pwr:'',solar:''},access:{done:'',vis:'',veh:''},status:'',ev:{time:'',desc:'',photo:''},hand:{done:'',to:''},assist:{yes:'',type:'',staff:'',det:''},notes:''});
function checkForm(c){
 const OK=[[1,'✔ سليم · OK','g'],[0,'✖ يوجد خلل · Defect','r']],YN=[[1,'نعم · Yes'],[0,'لا · No']];let h='';
 Q.forEach(q=>{h+=`<div class="card"><b>${q.ar}<small>${q.en}</small></b><p class="q">${q.q}</p>${seg(q.k,c[q.k].ok,OK)}<div data-if="${q.k}=0"><input id="${q.k}_n" placeholder="اذكر الخلل" value="${esc(c[q.k].n)}" style="margin-top:8px"></div></div>`});
 h+=`<div class="card"><b>وسائل الاتصال والطاقة<small>Comms & Power</small></b><label>جودة الاتصال بالإنترنت</label>${seg('net',c.comm.net,Object.entries(NET).map(([k,v])=>[k,v[0]+' · '+v[1],v[2]]))}<label>حالة الكهرباء / المولد / الطاقة الشمسية</label>${seg('pwr',c.comm.pwr,Object.entries(PWN).map(([k,v])=>[k,v[0]+' · '+v[1]]))}<label>شحن البطارية الشمسية % (اختياري)</label><input id="solar" type="number" inputmode="numeric" value="${esc(c.comm.solar)}"></div>`;
 h+=`<div class="card"><b>سجل الزوار والمركبات<small>Access Control</small></b><p class="q">هل تم تسجيل كافة الزوار والمركبات الداخلة والخارجة في السجل الورقي؟</p>${seg('acc',c.access.done,YN)}<label>عدد الزوار (اختياري)</label><input id="vis" type="number" inputmode="numeric" value="${esc(c.access.vis)}"><label>عدد المركبات (اختياري)</label><input id="veh" type="number" inputmode="numeric" value="${esc(c.access.veh)}"></div>`;
 h+=`<div class="card"><b>مستوى الوضع الأمني العام<small>Security Status</small></b>${seg('st',c.status,[['n','🟢 عادي — لا حوادث ولا خروقات','g'],['y','🟡 تنبيه / ملاحظة — حدث غير اعتيادي تم التعامل معه','y'],['r','🔴 حادث أمني / طارئ — اختراق، سرقة، قصف، إصابة…','r']])}
 <div data-if="st=y,r"><label>وقت وقوع الحدث</label><input id="evt" type="time" value="${esc(c.ev.time||fT(now()))}"><label>وصف مختصر لما حدث والإجراء الذي اتخذه الحارس</label><textarea id="evd">${esc(c.ev.desc)}</textarea><label>إرفاق صورة (اختياري) — لا تصوّر الأطفال</label><input type="file" accept="image/*" capture="environment" data-ph="ev"><div id="pv_ev">${c.ev.photo?`<img class="th" src="${c.ev.photo}">`:''}</div></div></div>`;
 h+=`<div class="card"><b>إقرار التسليم والاستلام<small>Handover Confirmation</small></b><p class="q">هل تم تسليم العهدة (المفاتيح، الأجهزة، السجلات) لحارس المناوبة التالية؟</p>${seg('hd',c.hand.done,YN)}<div data-if="hd=1"><input id="hto" list="ul" placeholder="اسم الحارس المستلم" value="${esc(c.hand.to)}" style="margin-top:8px"><datalist id="ul">${USERS.filter(u=>u.role!=='officer').map(u=>`<option value="${esc(u.name)}">`).join('')}</datalist></div></div>`;
 h+=`<div class="card"><b>مساعدة الموظفين<small>Staff Assistance</small></b><p class="q">هل جرى تقديم أي مساعدة أمنية أو لوجستية لأحد الموظفين خلال فترة المناوبة؟</p>${seg('as',c.assist.yes,YN)}<div data-if="as=1"><label>نوع المساعدة (إلزامي)</label><input id="ast" value="${esc(c.assist.type)}"><label>اسم الموظف / القسم (اختياري)</label><input id="asf" value="${esc(c.assist.staff)}"><label>تفاصيل (اختياري)</label><textarea id="asd">${esc(c.assist.det)}</textarea></div></div>`;
 h+=`<div class="card"><label>ملاحظات عامة (اختياري)</label><textarea id="nt">${esc(c.notes)}</textarea></div>`;
 return h}
function readCheck(prev){const c=dc();let miss='';
 Q.forEach(q=>{const v=rv(q.k);if(v==='')miss=miss||q.ar;c[q.k]={ok:v,n:v==='0'?gv(q.k+'_n').trim():''}});
 const nq=rv('net');if(!nq)miss=miss||'جودة الاتصال بالإنترنت';
 const pw=rv('pwr');if(!pw)miss=miss||'حالة الطاقة';c.comm={net:nq,pwr:pw,solar:gv('solar')};
 const ac=rv('acc');if(ac==='')miss=miss||'سجل الزوار والمركبات';c.access={done:ac,vis:gv('vis'),veh:gv('veh')};
 const st=rv('st');if(!st)miss=miss||'مستوى الوضع الأمني';c.status=st;
 if(st&&st!=='n'){const d=gv('evd').trim();if(!d)miss=miss||'وصف الحدث';c.ev={time:gv('evt'),desc:d,photo:PH.ev||(prev&&prev.ev.photo)||''}}
 const hd=rv('hd');if(hd==='')miss=miss||'تسليم العهدة';const to=gv('hto').trim();if(hd==='1'&&!to)miss=miss||'اسم المستلم';c.hand={done:hd,to:hd==='1'?to:''};
 const as=rv('as');if(as==='')miss=miss||'مساعدة الموظفين';const at=gv('ast').trim();if(as==='1'&&!at)miss=miss||'نوع المساعدة';
 c.assist=as==='1'?{yes:'1',type:at,staff:gv('asf').trim(),det:gv('asd').trim()}:{yes:'0',type:'',staff:'',det:''};
 c.notes=gv('nt').trim();
 if(miss){toast('أكمل: '+miss,3500);return null}return c}
V.end=()=>{PH={};const c=dc();c.status=SHIFT.inc.some(i=>i.sev==='r')?'r':SHIFT.inc.length?'y':'';
 view(BS+`<h3>⏹ إنهاء المناوبة — قائمة الفحص</h3><p class="mut">الجولات المنجزة: ${SHIFT.rounds.length} · الحوادث المسجلة: ${SHIFT.inc.length}</p>`+checkForm(c)+`<button class="b big ok" data-a="fin">✔ إنهاء وإنشاء التقرير</button>`)};
ACT.fin=async()=>{const c=readCheck();if(!c)return;const s=SHIFT,end=now();
 const tk=(CFG.tasks||[]).filter(t=>(t.to==='ALL'||t.to===ME.id)&&TD[t.id]>=s.start).map(t=>({text:t.text,t:TD[t.id]}));
 const r={kind:'rep',no:s.no,uid:s.uid,uname:s.uname,role:ME.role,post:s.post,sh:s.sh,date:fD(s.start),start:s.start,end,rounds:s.rounds,inc:s.inc,tasks:tk,check:c,stage:'guard',amend:[],orig:null,rev:null,log:[]};
 await dbSet('r:'+r.no,r);await dbDel('shift:'+ME.id);SHIFT=null;if(c.status==='r')notify('🔴 تقرير مناوبة بحالة حادث',waText(r));go('rep',r.no)};
/* ---------- report content ---------- */
const flat=(o,p='',out={})=>{for(const k in o){if(k==='photo')continue;const v=o[k];if(v&&typeof v==='object')flat(v,p+k+'.',out);else out[p+k]=v}return out};
const sv=(k,v)=>{if(/\.ok$/.test(k))return v==1?'سليم':'خلل';if(/(done|\.yes)$/.test(k))return v==1?'نعم':'لا';if(k==='status')return ST[v]?ST[v][0]:v;if(k==='comm.pwr')return PWN[v]?PWN[v][0]:v;if(k==='comm.net')return NET[v]?NET[v][0]:v;return v===''||v==null?'—':v};
const chTxt=x=>(LB[x.k]||x.k)+': من ('+sv(x.k,x.f)+') إلى ('+sv(x.k,x.t)+')';
function secs(r){const c=r.check,st=ST[c.status]||ST.n,S=[],ok=o=>[(o.ok==1?'سليم · OK':'يوجد خلل · Defect')+(o.ok==0&&o.n?'\n'+o.n:''),o.ok==1?'g':'r'];
 S.push({t:['بيانات المناوبة','Shift Information'],r:[['الاسم','Name',r.uname+' — '+ROLES[r.role][0]+' · '+ROLES[r.role][1]],['الموقع','Site',pn(r.post)],['المناوبة','Shift',shn(r.sh)],['التاريخ','Date',r.date],['من / إلى','From / To',fT(r.start)+' → '+fT(r.end)],['الوضع الأمني العام','Security Status',st[0]+' · '+st[1],st[2]]]});
 S.push({t:['الجولات الدورية','Patrol Rounds'],r:[['عدد الجولات','Rounds',String(r.rounds.length)],...r.rounds.map((o,i)=>['جولة '+(i+1),'Round '+(i+1),fT(o.t)+' — '+(o.manual?'تأكيد يدوي · Manual':'QR ✔')+(o.late>2?'\nمتأخرة '+o.late+' دقيقة · Late':'')+(o.pos?'\nGPS '+o.pos.lat+', '+o.pos.lng:''),o.late>2?'y':''])]});
 if(r.inc.length)S.push({t:['الحوادث المسجلة أثناء المناوبة','Logged Incidents'],r:r.inc.map(i=>[i.ar,i.en,fT(i.t)+' — '+(i.sev==='r'?'طارئ · Emergency':'ملاحظة · Observation')+(i.desc?'\n'+i.desc:'')+(i.pos?'\nGPS '+i.pos.lat+', '+i.pos.lng:''),i.sev,i.photo])});
 const L=Q.map(q=>{const o=ok(c[q.k]);return[q.ar,q.en,o[0],o[1]]});
 const nt=NET[c.comm.net];
 L.push(['جودة الاتصال بالإنترنت','Internet Connection Quality',nt?nt[0]+' · '+nt[1]:'—',nt?nt[2]:'']);
 L.push(['حالة الطاقة','Power Status',(PWN[c.comm.pwr]||['—','—']).join(' · ')+(c.comm.solar?'\nالطاقة الشمسية · Solar: '+c.comm.solar+'%':'')]);
 L.push(['سجل الزوار والمركبات','Access Control Log',YNT(c.access.done)+(c.access.vis?'\nالزوار · Visitors: '+c.access.vis:'')+(c.access.veh?'\nالمركبات · Vehicles: '+c.access.veh:''),c.access.done==1?'g':'r']);
 S.push({t:['قائمة الفحص','Checklist'],r:L});
 if(c.status!=='n')S.push({t:['تفاصيل الحدث','Event Details'],r:[['وقت الحدث','Event Time',c.ev.time],['الوصف والإجراء المتخذ','Description & Action',c.ev.desc,st[2],c.ev.photo]]});
 S.push({t:['التسليم والمساعدة','Handover & Assistance'],r:[['تسليم العهدة','Handover (keys, devices, logs)',c.hand.done==1?'نعم · Yes — إلى · To: '+c.hand.to+' ('+fT(r.end)+')':'لا · No',c.hand.done==1?'g':'y'],['مساعدة أمنية أو لوجستية للموظفين','Staff Assistance',c.assist.yes==1?'نعم · Yes — '+c.assist.type+(c.assist.staff?' — '+c.assist.staff:'')+(c.assist.det?' — '+c.assist.det:''):'لا · No']]});
 if(r.tasks&&r.tasks.length)S.push({t:['المهام المنفذة','Completed Tasks'],r:r.tasks.map((x,i)=>['مهمة '+(i+1),'Task '+(i+1),x.text+'\n'+fT(x.t)+' ✔','g'])});
 if(c.notes)S.push({t:['ملاحظات','Notes'],r:[['ملاحظات عامة','General Notes',c.notes]]});
 if(r.rev)S.push({t:['مراجعة قائد الشفت','Shift Leader Review'],r:[['القائد','Leader',r.rev.by],['الوقت','Time',fDT(r.rev.at)],['الملاحظة','Note',r.rev.note||'تم الاطلاع · Reviewed']]});
 if(r.amend.length)S.push({t:['تعديلات المشرف','Supervisor Amendments'],r:r.amend.map((a,i)=>['تعديل '+(i+1),'Amendment '+(i+1),a.by+' — '+fDT(a.at)+'\nالسبب · Reason: '+a.reason+'\n'+a.ch.map(chTxt).join('\n')])});
 return S}
const secHTML=s=>`<div class="card"><h4>${s.t[0]} · ${s.t[1]}</h4>${s.r.map(x=>`<div class="rw"><b>${x[0]}<small>${x[1]}</small></b><span class="${x[3]||''}">${esc(x[2]==null||x[2]===''?'—':x[2])}</span></div>${x[4]?`<img class="th" src="${x[4]}">`:''}`).join('')}</div>`;
function waText(r){const c=r.check,E={n:'🟢 NORMAL',y:'🟡 OBSERVATION',r:'🔴 INCIDENT'}[c.status],bad=o=>'DEFECT'+(o.n?' ('+o.n+')':'');
 const notes=[];r.inc.forEach(i=>notes.push('- '+fT(i.t)+' '+i.en+(i.sev==='r'?' [RED]':'')+(i.desc?': '+i.desc:'')));
 if(c.status!=='n')notes.push('- '+c.ev.time+' '+c.ev.desc);if(c.notes)notes.push(c.notes);
 if(!notes.length)notes.push('No security incidents reported during the shift.');
 return['🛡️ SOS PALESTINE - GUARD SHIFT REPORT','━━━━━━━━━━━━━━━━━━━━','👤 Guard: '+r.uname,'📍 Site: '+POSTS[r.post].en+' / '+POSTS[r.post].ar,'🕒 Shift: '+SH[r.sh].en+' | '+r.date,'📊 Status: '+E,'✅ CHECKLIST SUMMARY:',
 'Gates & Perimeter: '+(c.perim.ok==1?'Secure':bad(c.perim)),'Lighting: '+(c.light.ok==1?'Operational':bad(c.light)),'Safety Equipment: '+(c.safety.ok==1?'Checked & Ready':bad(c.safety)),
 'Power: '+(PWN[c.comm.pwr]||['','-'])[1]+(c.comm.solar?' (Solar '+c.comm.solar+'%)':''),'Internet Quality: '+(NET[c.comm.net]||['','-'])[1],
 'Visitors Logged: '+(c.access.done==1?'Yes':'No')+(c.access.vis?' | Visitors: '+c.access.vis:'')+(c.access.veh?' | Vehicles: '+c.access.veh:''),'Rounds completed: '+r.rounds.length,
 '📝 NOTES / INCIDENTS:',...notes,'🤝 HANDOVER:',c.hand.done==1?'Handed over to: '+c.hand.to+' at '+fT(r.end):'Not handed over',
 'Staff assistance: '+(c.assist.yes==1?'Yes — '+c.assist.type+(c.assist.det?' — '+c.assist.det:''):'No'),'━━━━━━━━━━━━━━━━━━━━','Report No: '+r.no].join('\n')}
/* ---------- PDF ---------- */
const FF='"Segoe UI",Tahoma,Arial,sans-serif';
const li=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src});
class Doc{
 constructor(){this.W=1240;this.H=1754;this.M=70;this.pg=[];this.np()}
 np(){const c=document.createElement('canvas');c.width=this.W;c.height=this.H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,this.W,this.H);x.direction='rtl';x.textAlign='right';this.c=c;this.x=x;this.y=this.M;this.pg.push(c)}
 need(h){if(this.y+h>this.H-130)this.np()}
 wrap(t,w,f){const x=this.x;x.font=f;const o=[];String(t).split('\n').forEach(p=>{let l='';p.split(' ').forEach(wd=>{const s=l?l+' '+wd:wd;if(l&&x.measureText(s).width>w){o.push(l);l=wd}else l=s});o.push(l)});return o}
 async head(ar,en,no,col){const x=this.x;
  let lg=await li('logo.png');if(!lg)lg=await li('icon.svg');
  if(lg){const iw=lg.width||130,ih=lg.height||130,k=Math.min(520/iw,130/ih),w=iw*k,h=ih*k;try{x.drawImage(lg,this.M,48,w,h)}catch(e){}}
  x.fillStyle='#0b2a44';x.font='bold 44px '+FF;x.fillText(ar,this.W-this.M,92);
  x.fillStyle='#009edb';x.font='28px '+FF;x.fillText(en,this.W-this.M,138);
  x.fillStyle='#678';x.font='22px '+FF;x.fillText(no,this.W-this.M,176);
  x.fillStyle='#cfcfcf';x.fillRect(this.M,214,this.W-2*this.M,3);
  x.fillStyle=col;x.fillRect(this.W-this.M-260,211,260,9);
  this.y=250}
 sec(ar,en){this.need(120);const x=this.x;this.y+=14;x.fillStyle='#0b3a5c';x.fillRect(this.M,this.y,this.W-2*this.M,56);x.fillStyle='#fff';x.font='bold 28px '+FF;x.fillText(ar+'  ·  '+en,this.W-this.M-16,this.y+39);this.y+=56}
 row(a,e,v,col,alt){const W=this.W-2*this.M,lw=W*.4,vw=W*.6-30,x=this.x;
  const la=this.wrap(a,lw-24,'bold 26px '+FF),le=e?this.wrap(e,lw-24,'20px '+FF):[],vl=this.wrap(v===''||v==null?'—':v,vw-10,'26px '+FF);
  const h=Math.max(la.length*36+le.length*28,vl.length*36)+24;this.need(h);const y=this.y;
  x.fillStyle=alt?'#f2f8fc':'#fff';x.fillRect(this.M,y,W,h);x.strokeStyle='#cfe0ea';x.lineWidth=1;x.strokeRect(this.M,y,W,h);
  x.beginPath();x.moveTo(this.M+vw+30,y);x.lineTo(this.M+vw+30,y+h);x.stroke();
  let yy=y+36;x.fillStyle='#0b2a44';x.font='bold 26px '+FF;la.forEach(l=>{x.fillText(l,this.W-this.M-14,yy);yy+=36});
  x.fillStyle='#678';x.font='20px '+FF;yy-=6;le.forEach(l=>{x.fillText(l,this.W-this.M-14,yy);yy+=28});
  yy=y+36;x.fillStyle={g:'#08843f',r:'#c4122f',y:'#a87400'}[col]||'#111';x.font=(col?'bold ':'')+'26px '+FF;vl.forEach(l=>{x.fillText(l,this.M+vw+14,yy);yy+=36});this.y+=h}
 async img(src,mw=520,mh=380){const i=await li(src);if(!i)return;const k=Math.min(mw/i.width,mh/i.height,1),w=i.width*k,h=i.height*k;this.need(h+30);this.x.drawImage(i,this.W-this.M-w-10,this.y+10,w,h);this.y+=h+24}
 async blob(){const n=this.pg.length,out=[];
  this.pg.forEach((c,i)=>{const x=c.getContext('2d');x.direction='rtl';x.textAlign='center';x.fillStyle='#e8f0f5';x.fillRect(0,this.H-120,this.W,120);x.fillStyle='#456';x.font='20px '+FF;
   x.fillText('هذه الأداة صممت لقسم الأمن SOS / تصميم Ahmed Abu Jami',this.W/2,this.H-78);x.fillText("saftey and security officer - SOS children's villages",this.W/2,this.H-48);x.fillText((i+1)+' / '+n,this.W/2,this.H-18)});
  for(const c of this.pg){const b=atob(c.toDataURL('image/jpeg',.85).split(',')[1]),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);out.push({jpg:u,w:c.width,h:c.height})}
  return buildPDF(out)}}
function buildPDF(pages){const enc=new TextEncoder(),parts=[],off=[];let len=0;
 const add=d=>{const b=typeof d==='string'?enc.encode(d):d;parts.push(b);len+=b.length};const N=pages.length;
 add('%PDF-1.4\n');off[1]=len;add('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
 off[2]=len;add(`2 0 obj\n<</Type/Pages/Count ${N}/Kids[${pages.map((_,i)=>(3+3*i)+' 0 R').join(' ')}]>>\nendobj\n`);
 pages.forEach((p,i)=>{const a=3+3*i,cs='q 595 0 0 842 0 0 cm /Im0 Do Q';
  off[a]=len;add(`${a} 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</XObject<</Im0 ${a+2} 0 R>>>>/Contents ${a+1} 0 R>>\nendobj\n`);
  off[a+1]=len;add(`${a+1} 0 obj\n<</Length ${cs.length}>>\nstream\n${cs}\nendstream\nendobj\n`);
  off[a+2]=len;add(`${a+2} 0 obj\n<</Type/XObject/Subtype/Image/Width ${p.w}/Height ${p.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${p.jpg.length}>>\nstream\n`);add(p.jpg);add('\nendstream\nendobj\n')});
 const tot=3+3*N,xr=len;add(`xref\n0 ${tot}\n0000000000 65535 f \n`);for(let i=1;i<tot;i++)add(String(off[i]).padStart(10,'0')+' 00000 n \n');
 add(`trailer\n<</Size ${tot}/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF`);return new Blob(parts,{type:'application/pdf'})}
async function mkPDF(S,ar,en,no,col){const d=new Doc();await d.head(ar,en,no,col);for(const s of S){d.sec(s.t[0],s.t[1]);let k=0;for(const x of s.r){d.row(x[0],x[1],x[2],x[3],k++%2);if(x[4])await d.img(x[4])}}return d.blob()}
const repPDF=r=>mkPDF(secs(r),'تقرير مناوبة حارس','Guard Shift Report',r.no,{n:'#00b86b',y:'#ffc400',r:'#e0102f'}[r.check.status]||'#00b86b');
async function prepare(id,pdfFn,fileObj,label){PRE={id};const b=await pdfFn();if(PRE.id!==id)return;PRE.pdf=new File([b],id+'.pdf',{type:'application/pdf'});
 const e=$('#bpdf');if(e){e.disabled=false;e.textContent='📄 مشاركة PDF'}
 if(fileObj){PRE.copy=fileObj;PRE.file=await pack(fileObj,id+'.txt');const s=$('#bsend');if(s&&PRE.id===id){s.disabled=false;s.textContent=label}}}
ACT.spdf=()=>{if(PRE.pdf)shareOut([PRE.pdf],'')};
ACT.dpdf=()=>{if(PRE.pdf)dl(PRE.pdf);else toast('PDF قيد التجهيز…')};
ACT.send=async()=>{if(!PRE.file||!PRE.pdf)return;const c=PRE.copy,pdf=PRE.pdf,file=PRE.file,ok=await shareOut([pdf,file],c.kind==='insp'?iWa(c):waText(c));
 if(!ok)return;
 if(c.kind==='rep'){await dbSet('r:'+c.no,c);if(c.stage==='sent_off')notify('📄 تقرير مناوبة '+c.no,waText(c),pdf,c.no+'.pdf');toast('تم — حالة التقرير: '+STG[c.stage]);go('rep',c.no)}
 else{notify('🔍 تقرير تفتيش '+c.id,iWa(c),pdf,c.id+'.pdf');toast('تمت المشاركة')}};
/* ---------- report view / chain ---------- */
function NEXT(r){if(r.stage==='guard'&&r.uid===ME.id)return{guard:'sent_leader',leader:'sent_sup',supervisor:'sent_off'}[r.role]||null;
 if(r.stage==='reviewed'&&ME.role==='leader')return'sent_sup';if(r.stage==='at_sup'&&ME.role==='supervisor')return'sent_off';return null}
V.rep=async no=>{const r=await dbGet('r:'+no);if(!r)return go('home');const nx=NEXT(r);
 let h=BK+`<h3>تقرير ${esc(no)}</h3><div class="card c"><span class="pill">${STG[r.stage]}</span></div>`+secs(r).map(secHTML).join('');
 h+=`<div class="card"><h4>📤 المشاركة</h4><button class="b big" id="bpdf" data-a="spdf" disabled>⏳ جاري تجهيز PDF…</button><button class="b k" data-a="dpdf">⬇ تنزيل PDF</button><div class="grid">${shareLinks(waText(r),'Guard Shift Report '+r.no)}</div></div>`;
 if(nx)h+=`<div class="card"><h4>➡ الخطوة التالية</h4><button class="b big ok" id="bsend" data-a="send" disabled>⏳ …</button><p class="mut">يرسل PDF + ملف التقرير عبر نافذة المشاركة. المستلم يفتح التطبيق ثم «استيراد تقرير».</p></div>`;
 if(r.stage==='at_leader'&&ME.role==='leader')h+=`<div class="card"><h4>مراجعة القائد</h4><textarea id="rn" placeholder="ملاحظة القائد (اختياري)"></textarea><button class="b big ok" data-a="rev" data-v="${esc(no)}">✔ تم الاطلاع</button></div>`;
 if((ME.role==='supervisor'&&r.stage==='at_sup'&&hp('edit'))||ME.role==='officer')h+=`<button class="b big y" data-a="edit" data-v="${esc(no)}">✏ تعديل التقرير</button>`;
 if(ME.role==='officer')h+=`<button class="b s r" data-a="rdel" data-v="${esc(no)}">🗑 حذف التقرير</button>`;
 view(h);prepare(no,()=>repPDF(r),nx?{...r,stage:nx,log:[...r.log,{by:ME.name,at:now(),to:nx}]}:null,'📨 إرسال إلى '+(TO[nx]||'')+' (PDF + ملف)')};
ACT.rev=async no=>{const r=await dbGet('r:'+no);r.rev={by:ME.name,at:now(),note:gv('rn').trim()};r.stage='reviewed';r.log.push({by:ME.name,at:now(),to:'reviewed'});await dbSet('r:'+no,r);go('rep',no)};
ACT.rdel=async no=>{if(!confirm('حذف التقرير نهائياً؟'))return;await dbDel('r:'+no);await plog('حذف تقرير '+no);go('home')};
V.edit=async no=>{PH={};const r=await dbGet('r:'+no);
 view(`<button class="b s k" data-a="rep" data-v="${esc(no)}">✖ إلغاء</button><h3>✏ تعديل ${esc(no)}</h3>`+checkForm(r.check)+(r.rev?`<div class="card"><label>ملاحظة القائد</label><textarea id="ln">${esc(r.rev.note)}</textarea></div>`:'')+(ME.role==='supervisor'?`<div class="card"><label>سبب التعديل (إلزامي — يظهر في التقرير)</label><textarea id="rs"></textarea></div>`:'<p class="mut c">تعديل صامت — لا يظهر في التقرير ويُسجَّل في سجلك الخاص</p>')+`<button class="b big ok" data-a="esave" data-v="${esc(no)}">حفظ</button>`)};
ACT.esave=async no=>{const r=await dbGet('r:'+no),rs=gv('rs').trim();if(ME.role==='supervisor'&&!rs)return toast('سبب التعديل إلزامي');
 const nc=readCheck(r.check);if(!nc)return;const ln=r.rev?gv('ln'):null,A=flat(r.check),B=flat(nc),ch=[];
 for(const k in B)if(String(A[k])!==String(B[k]))ch.push({k,f:A[k]==null?'':A[k],t:B[k]});
 if(r.rev&&ln!==r.rev.note)ch.push({k:'rev.note',f:r.rev.note,t:ln});
 if(!ch.length&&nc.ev.photo===r.check.ev.photo)return toast('لا توجد تغييرات');
 if(ME.role==='supervisor'){if(!r.orig)r.orig=JSON.parse(JSON.stringify(r.check));r.amend.push({by:ME.name,at:now(),reason:rs,ch});notify('✏ تعديل مشرف على تقرير '+no,'السبب: '+rs+'\n'+ch.map(chTxt).join('\n'))}
 else await plog('تعديل صامت على '+no+': '+ch.map(chTxt).join(' | '));
 r.check=nc;if(ln!==null)r.rev.note=ln;await dbSet('r:'+no,r);toast('تم الحفظ');go('rep',no)};
/* ---------- inspections ---------- */
V.insp=()=>{if(!hp('insp'))return go('home');const d=new Date(),dtl=fD(d)+'T'+fT(d);
 view(BK+`<div class="card"><h3>🔍 جولة تفتيشية مفاجئة</h3><label>المشرف القائم بالجولة</label><input value="${esc(ME.name)}" readonly><label>التاريخ والوقت</label><input id="idt" type="datetime-local" value="${dtl}"><label>الموقع / النقطة المفتشة</label><select id="ist">${CFG.sites.map((s,i)=>`<option value="${i}">${esc(s.replace('|',' · '))}</option>`).join('')}</select><label>الحارس / القائد المناوب</label><select id="ipr">${USERS.filter(u=>u.role==='guard'||u.role==='leader').map(u=>`<option value="${u.id}">${esc(u.name)} (${ROLES[u.role][0]})</option>`).join('')}</select><button class="b big" data-a="istart">▶ بدء التفتيش</button><p class="mut">يُسجَّل وقت الوصول الفعلي تلقائياً عند الضغط.</p></div>`)};
ACT.istart=()=>{const t=now(),u=user(gv('ipr')),d=new Date(t);
 INS={kind:'insp',id:`IN-${fD(t).replace(/-/g,'')}-${p2(d.getHours())}${p2(d.getMinutes())}-${ME.id}`,by:ME.name,byId:ME.id,arr:t,dt:new Date(gv('idt')).getTime()||t,site:CFG.sites[+gv('ist')],who:u.id,whoName:u.name,whoRole:u.role};go('insp2')};
V.insp2=()=>{PH={};const A=INS,item=([k,a,e,q])=>`<div class="card"><b>${a}<small>${e}</small></b><p class="q">${q}</p>${seg('i_'+k,'',[[1,'نعم · Yes','g'],[0,'لا · No','r']])}</div>`;
 view(`<button class="b s k" data-a="home">✖ إلغاء</button><h3>🔍 ${esc(A.whoName)} — ${esc(A.site.split('|')[0])}</h3><small>وصول: ${fDT(A.arr)}</small>
 <div class="card"><b>حالة اليقظة<small>Alertness Status</small></b>${seg('ial','',Object.entries(AL).map(([k,v])=>[k,v[0]+' · '+v[1],k]))}</div>`
 +IC.map(item).join('')+(A.whoRole==='leader'?'<h4>تقييم قائد الفريق</h4>'+IL.map(item).join(''):'')
 +`<div class="card"><b>التقييم العام للنقطة<small>Overall Post Rating</small></b>${seg('iov','',Object.entries(OV).map(([k,v])=>[k,v[0]+' · '+v[1],v[2]]))}</div>
 <div class="card"><label>ملاحظات وتوجيهات فورية (تنبيه شفهي وُجّه للحارس/القائد)</label><textarea id="icn"></textarea><label>توثيق بالصورة (اختياري)</label><input type="file" accept="image/*" capture="environment" data-ph="insp"><div id="pv_insp"></div></div>
 <div class="card"><label>توقيع / إقرار الحارس (اختياري) — بالإصبع</label><canvas id="sig" width="600" height="220"></canvas><button class="b s k" data-a="sclr">مسح</button></div>
 <button class="b big ok" data-a="ifin">✔ حفظ التفتيش</button>`);sigInit()};
function sigInit(){const c=$('#sig'),x=c.getContext('2d');let d=0;x.lineWidth=3;x.lineCap='round';x.strokeStyle='#000';
 const p=e=>{const r=c.getBoundingClientRect();return[(e.clientX-r.left)*c.width/r.width,(e.clientY-r.top)*c.height/r.height]};
 c.onpointerdown=e=>{d=1;c.hasInk=1;const[a,b]=p(e);x.beginPath();x.moveTo(a,b);c.setPointerCapture(e.pointerId)};
 c.onpointermove=e=>{if(!d)return;const[a,b]=p(e);x.lineTo(a,b);x.stroke()};c.onpointerup=()=>d=0}
ACT.sclr=()=>{const c=$('#sig');c.getContext('2d').clearRect(0,0,c.width,c.height);c.hasInk=0};
ACT.ifin=async()=>{const A=INS,al=rv('ial'),ov=rv('iov');if(!al||!ov)return toast('أكمل اليقظة والتقييم العام');
 const lead=A.whoRole==='leader',ans={};for(const x of IC.concat(lead?IL:[])){const v=rv('i_'+x[0]);if(v==='')return toast('أجب: '+x[1]);ans[x[0]]=+v}
 const sg=$('#sig'),rec={...A,al,ans,lead,ov,note:gv('icn').trim(),photo:PH.insp||'',sig:sg.hasInk?sg.toDataURL('image/png'):''};
 await dbSet('i:'+rec.id,rec);INS=null;
 if(ov==='1'||al==='r')notify('🔴 تفتيش: '+(ov==='1'?'تقييم غير مقبول':'حارس نائم/غائب'),iWa(rec));
 go('ins',rec.id)};
function isecs(i){const yn=(k,L)=>{const a=L.find(x=>x[0]===k);return[a[1],a[2],YNT(i.ans[k]),i.ans[k]==1?'g':'r']},al=AL[i.al],ov=OV[i.ov],S=[];
 S.push({t:['بيانات التفتيش','Inspection Metadata'],r:[['المشرف القائم بالجولة','Inspector',i.by],['وقت الوصول الفعلي (تلقائي)','Actual Arrival',fDT(i.arr)],['تاريخ ووقت التفتيش','Inspection Date/Time',fDT(i.dt)],['الموقع / النقطة','Post / Sector',i.site.replace('|',' · ')],['الحارس / القائد المناوب','On Duty',i.whoName+' — '+ROLES[i.whoRole][0]]]});
 S.push({t:['اليقظة والانضباط','Alertness & Conduct'],r:[['حالة اليقظة','Alertness',al[0]+' · '+al[1],i.al],yn('pos',IC),yn('chal',IC)]});
 S.push({t:['المظهر والجاهزية','Appearance & Readiness'],r:[yn('uni',IC),yn('gear',IC)]});
 S.push({t:['الالتزام بالإجراءات','SOP Compliance'],r:[yn('log',IC),yn('acc',IC)]});
 if(i.lead)S.push({t:['تقييم قائد الفريق','Shift Leader Assessment'],r:[yn('sup',IL),yn('sit',IL)]});
 S.push({t:['النتائج والإجراءات التصحيحية','Findings & Corrective Actions'],r:[['التقييم العام للنقطة','Overall Post Rating',ov[0]+' · '+ov[1],ov[2]],['ملاحظات وتوجيهات فورية','Immediate Corrective Action',i.note,'',i.photo],...(i.sig?[['توقيع / إقرار الحارس','Guard Acknowledgement','تم التوقيع · Signed','g',i.sig]]:[])]});
 return S}
const ipdf=i=>mkPDF(isecs(i),'تقرير جولة تفتيشية','Surprise Inspection Report',i.id,{g:'#00b86b',y:'#ffc400',r:'#e0102f'}[OV[i.ov][2]]);
const iWa=i=>['🔍 SOS PALESTINE - SPOT INSPECTION','━━━━━━━━━━━━━━━━━━━━','Inspector: '+i.by,'Arrival: '+fDT(i.arr),'Inspection time: '+fDT(i.dt),'Post: '+i.site.replace('|',' / '),'On duty: '+i.whoName+' ('+ROLES[i.whoRole][1]+')','Alertness: '+AL[i.al][1],
 ...IC.map(x=>x[2]+': '+(i.ans[x[0]]==1?'Yes':'NO')),...(i.lead?IL.map(x=>x[2]+': '+(i.ans[x[0]]==1?'Yes':'NO')):[]),'Overall rating: '+OV[i.ov][1],i.note?'Corrective action: '+i.note:'','━━━━━━━━━━━━━━━━━━━━','Inspection No: '+i.id].filter(Boolean).join('\n');
V.ins=async id=>{const i=await dbGet('i:'+id);if(!i)return go('home');
 view(BK+`<h3>تقرير تفتيش ${esc(id)}</h3>`+isecs(i).map(secHTML).join('')+`<div class="card"><h4>📤 المشاركة</h4><button class="b big" id="bpdf" data-a="spdf" disabled>⏳ جاري تجهيز PDF…</button><button class="b k" data-a="dpdf">⬇ تنزيل PDF</button>${ME.role!=='officer'?`<button class="b big ok" id="bsend" data-a="send" disabled>⏳ …</button>`:''}<div class="grid">${shareLinks(iWa(i),'Inspection Report '+id)}</div></div>`);
 prepare(id,()=>ipdf(i),ME.role!=='officer'?i:null,'📨 إرسال إلى الأوفيسر (PDF + ملف)')};
V.inl=async()=>{if(!hp('insp'))return go('home');const l=(await dbAll('i:')).sort((a,b)=>b.arr-a.arr);
 view(BK+'<h3>📋 سجل التفتيش</h3>'+(l.length?l.map(i=>`<div class="card li" data-a="ins" data-v="${esc(i.id)}"><b>${esc(i.whoName)}</b> <span class="${OV[i.ov][2]}">${OV[i.ov][0]}</span><small>${fDT(i.arr)} · ${esc(i.site.split('|')[0])} · ${esc(i.by)}</small></div>`).join(''):'<p class="mut c">لا توجد تفتيشات</p>'))};
/* ---------- stats ---------- */
ACT.sp=n=>{SP=+n;V.stats()};
V.stats=async()=>{if(!hp('stats'))return go('home');const lim=SP?now()-SP*864e5:0,R=(await dbAll('r:')).filter(r=>r.start>=lim),I=(await dbAll('i:')).filter(i=>i.arr>=lim),per={};
 let rounds=0,late=0,inc=0;
 R.forEach(r=>{const l=r.rounds.filter(o=>o.late>2).length;rounds+=r.rounds.length;late+=l;inc+=r.inc.length;const p=per[r.uid]=per[r.uid]||{n:r.uname,rep:0,rd:0,late:0,red:0};p.rep++;p.rd+=r.rounds.length;p.late+=l;if(r.check.status==='r')p.red++});
 const n=s=>R.filter(r=>r.check.status===s).length,box=(v,t,c)=>`<div class="card c"><div class="cdl ${c||''}" style="font-size:34px">${v}</div><small>${t}</small></div>`;
 const pl=Object.values(per).sort((a,b)=>b.rep-a.rep),on=(await dbAll('ob:')).length;
 view(BK+'<h3>📊 الإحصائيات</h3><p class="mut">حسب التقارير الموجودة على هذا الجهاز فقط.</p>'
 +`<div class="grid">${[[7,'7 أيام'],[30,'30 يوماً'],[0,'الكل']].map(([v,t])=>`<button class="b ${SP===v?'ok':'k'}" data-a="sp" data-v="${v}">${t}</button>`).join('')}</div>`
 +`<div class="grid">${box(R.length,'تقارير المناوبات')}${box(rounds,'جولات منفذة')}${box(late,'جولات متأخرة',late?'late':'')}${box(inc,'حوادث مسجلة',inc?'warn':'')}</div>`
 +`<div class="card"><h4>الوضع الأمني</h4><div class="rw"><span>🟢 عادي</span><b>${n('n')}</b></div><div class="rw"><span>🟡 تنبيه / ملاحظة</span><b>${n('y')}</b></div><div class="rw"><span>🔴 حادث / طارئ</span><b>${n('r')}</b></div></div>`
 +`<div class="card"><h4>حسب الحارس</h4>${pl.length?pl.map(p=>`<div class="rw"><b>${esc(p.n)}</b><span>تقارير ${p.rep} · جولات ${p.rd} · متأخرة ${p.late} · حوادث ${p.red}</span></div>`).join(''):'<p class="mut">لا بيانات</p>'}</div>`
 +`<div class="card"><h4>التفتيشات (${I.length})</h4>${[4,3,2,1].map(k=>`<div class="rw"><span class="${OV[k][2]}">${OV[k][0]}</span><b>${I.filter(i=>+i.ov===k).length}</b></div>`).join('')}</div>`
 +(on?`<p class="mut c">رسائل تنبيه بانتظار الإرسال: ${on}</p>`:''))};
/* ---------- distribution & tasks ---------- */
const asgList=()=>USERS.filter(u=>u.role!=='officer'&&(ME.role==='officer'||u.role==='guard'||u.role==='leader'));
V.asg=()=>{if(!hp('assign'))return go('home');const L=asgList(),T=CFG.tasks||[];
 const cnt=(s,p)=>L.filter(u=>u.sh===s&&u.post===p).length;
 const PO=Object.entries(POSTS).map(([k,v])=>[k,v.ar]),SO=Object.entries(SH).map(([k,v])=>[k,v.ar]);
 const sum=Object.entries(SH).map(([s,sv])=>sv.ar+': '+Object.entries(POSTS).map(([p,pv])=>pv.ar+' '+cnt(s,p)).join(' · ')).join(' | ');
 view(BK+`<h3>🗂 التوزيع والمهام</h3>
 <div class="card"><h4>توزيع الأفراد</h4><p class="mut">${sum}</p>${L.map(u=>`<div class="card"><b>${esc(u.name)}<small>${ROLES[u.role][0]} · ${u.id}</small></b><div class="grid">${sel('ap_'+u.id,PO,u.post)}${sel('as_'+u.id,SO,u.sh)}</div></div>`).join('')}<button class="b big ok" data-a="asave">💾 حفظ التوزيع</button></div>
 <div class="card"><h4>➕ مهمة جديدة</h4><label>المكلَّف</label>${sel('tto',[['ALL','الجميع'],...L.map(u=>[u.id,esc(u.name)])],'ALL')}<label>نص المهمة</label><textarea id="ttx"></textarea><label>الموعد النهائي (اختياري)</label><input id="tdu" type="date"><button class="b" data-a="tadd">إضافة المهمة</button></div>
 <div class="card"><h4>المهام الحالية (${T.length})</h4>${T.length?T.map(t=>`<div class="rw"><span>${esc(t.text)}<small>← ${t.to==='ALL'?'الجميع':esc(user(t.to)?user(t.to).name:t.to)}${t.due?' · حتى '+esc(t.due):''} · ${esc(t.by)}</small></span><button class="b s r" data-a="tdel" data-v="${esc(t.id)}">حذف</button></div>`).join(''):'<p class="mut">لا توجد مهام</p>'}<p class="mut">تأكيد التنفيذ يظهر في تقرير المناوبة (PDF) لصاحب المهمة.</p></div>
 <button class="b" data-a="texp">📤 تصدير إعدادات الفريق (لإيصال التوزيع والمهام للجميع)</button>`)};
ACT.asave=async()=>{asgList().forEach(u=>{u.post=gv('ap_'+u.id)||u.post;u.sh=gv('as_'+u.id)||u.sh});await persist();await plog('تعديل توزيع الأفراد على المواقع والمناوبات');toast('تم حفظ التوزيع');V.asg()};
ACT.tadd=async()=>{if(!hp('assign'))return;const text=gv('ttx').trim(),to=gv('tto');if(!text)return toast('اكتب نص المهمة');
 CFG.tasks.push({id:'T'+now(),to,text,by:ME.name,at:now(),due:gv('tdu')});await persist();
 await plog('مهمة جديدة ← '+(to==='ALL'?'الجميع':user(to).name)+': '+text);toast('تمت إضافة المهمة');V.asg()};
ACT.tdel=async id=>{if(!confirm('حذف المهمة؟'))return;const t=CFG.tasks.find(x=>x.id===id);CFG.tasks=CFG.tasks.filter(x=>x.id!==id);await persist();await plog('حذف مهمة: '+(t?t.text:id));V.asg()};
/* ---------- team / accounts ---------- */
const permBlock=u=>ME.role==='officer'&&u.role!=='officer'?`<label>الصلاحيات (الدور يحدد الافتراضي)</label>${Object.entries(PL).map(([k,t])=>`<label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" style="width:auto;margin:0" id="pm_${u.id}_${k}" ${pOf(u,k)?'checked':''}> ${t}</label>`).join('')}`:'';
const mcard=u=>`<div class="card"><b>${u.id} · ${ROLES[u.role][0]}</b><label>الاسم</label><input id="n_${u.id}" value="${esc(u.name)}"><label>رقم سري جديد (اتركه فارغاً للإبقاء)</label><input id="p_${u.id}" inputmode="numeric" maxlength="8"><div class="grid"><div><label>الموقع</label><select id="po_${u.id}">${Object.entries(POSTS).map(([k,v])=>`<option value="${k}" ${u.post===k?'selected':''}>${v.ar}</option>`).join('')}</select></div><div><label>المناوبة</label><select id="sh_${u.id}">${Object.entries(SH).map(([k,v])=>`<option value="${k}" ${u.sh===k?'selected':''}>${v.ar}</option>`).join('')}</select></div></div>${ME.role==='officer'?`<label>الدور</label><select id="ro_${u.id}">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v[0]}</option>`).join('')}</select>`:''}${permBlock(u)}<button class="b" data-a="usave" data-v="${u.id}">حفظ</button>${ME.role==='officer'&&u.id!==ME.id?`<button class="b r" data-a="udel" data-v="${u.id}">حذف</button>`:''}</div>`;
V.mgr=()=>{if(!hp('mgr'))return go('home');const can=u=>ME.role==='officer'||u.role==='guard'||u.role==='leader';
 view(BK+'<h3>👥 الحسابات</h3><p class="mut">بعد أي تعديل اضغط «تصدير إعدادات الفريق» من القائمة ليستوردها الآخرون.</p>'+USERS.map(u=>can(u)?mcard(u):`<div class="card"><b>${esc(u.name)}</b><small>${ROLES[u.role][0]} — لا تملك صلاحية تعديله</small></div>`).join('')
 +`<div class="card"><h4>➕ إضافة حساب</h4><label>الاسم</label><input id="an"><label>الرقم السري</label><input id="ap" inputmode="numeric" maxlength="8"><label>الدور</label><select id="ar">${Object.entries(ROLES).filter(([k])=>ME.role==='officer'||k==='guard'||k==='leader').map(([k,v])=>`<option value="${k}">${v[0]}</option>`).join('')}</select><button class="b" data-a="uadd">إضافة</button></div>`)};
ACT.usave=async id=>{const u=user(id),n=gv('n_'+id).trim(),p=gv('p_'+id).trim();if(!n)return toast('الاسم مطلوب');if(p&&!/^\d{4,8}$/.test(p))return toast('الرقم السري من 4 إلى 8 أرقام');
 let nr=u.role,rp=null;
 if(ME.role==='officer'){nr=gv('ro_'+id);if(u.role==='officer'&&nr!=='officer'&&USERS.filter(x=>x.role==='officer').length<2)return toast('لا يمكن إزالة آخر أوفيسر');
  rp={};if(nr===u.role&&u.role!=='officer')Object.keys(PL).forEach(k=>{const e=$('#pm_'+id+'_'+k);if(e)rp[k]=e.checked})}
 const old=u.name,op=JSON.stringify(u.perm||{});u.name=n;u.post=gv('po_'+id);u.sh=gv('sh_'+id);u.role=nr;if(p)u.pin=await sha(p+CFG.orgKey);
 if(rp)u.perm=rp;const pc=rp&&JSON.stringify(rp)!==op;
 await persist();await plog('تعديل حساب '+id+' ('+old+(old!==n?' ← '+n:'')+')'+(p?' + تغيير الرقم السري':'')+(pc?' + تعديل الصلاحيات':''));toast('تم الحفظ');V.mgr()};
ACT.udel=async id=>{if(!confirm('حذف الحساب '+id+'؟'))return;USERS=USERS.filter(u=>u.id!==id);await persist();await plog('حذف حساب '+id);V.mgr()};
ACT.uadd=async()=>{const n=gv('an').trim(),p=gv('ap').trim(),ro=gv('ar');if(!n||!/^\d{4,8}$/.test(p))return toast('أدخل الاسم ورقماً سرياً من 4 إلى 8 أرقام');
 if(ME.role!=='officer'&&ro!=='guard'&&ro!=='leader')return;const pf={guard:'G',leader:'L',supervisor:'S',officer:'O'}[ro],nn=Math.max(0,...USERS.filter(x=>x.id[0]===pf).map(x=>+x.id.slice(1)))+1;
 USERS.push({id:pf+nn,name:n,role:ro,pin:await sha(p+CFG.orgKey),post:'GATE',sh:'M'});await persist();await plog('إضافة حساب '+pf+nn+' ('+n+')');V.mgr()};
ACT.texp=async()=>{if(!hp('texp'))return;const f=await pack({kind:'team',cfg:CFG,users:USERS,alog:ME.role==='supervisor'?(await dbGet('alog'))||[]:[]},'sos-guard-team.txt');await shareOut([f],'إعدادات فريق SOS Guard')};
async function importFiles(fs){let ok=0;const bad=[];
 for(const f of fs){try{const o=await unpack(f);
  if(o.kind==='team'){CFG=o.cfg;CFG.tasks=CFG.tasks||[];USERS=o.users;await dbSet('cfg',CFG);await dbSet('users',USERS);
   if(ME.role==='officer'&&o.alog&&o.alog.length){const pv=(await dbGet('priv'))||[];o.alog.forEach(a=>pv.push({...a,txt:'(مشرف) '+a.txt}));await dbSet('priv',pv.slice(-300))}
   const me=user(ME.id);if(!me){toast('حسابك لم يعد موجوداً');return ACT.logout()}ME=me;ok++}
  else if(o.kind==='rep'){if(!hp('imp'))throw new Error('لا تملك صلاحية استيراد التقارير');
   if(ME.role!=='officer'&&({leader:'sent_leader',supervisor:'sent_sup'})[ME.role]!==o.stage)throw new Error(o.no+': ليس موجّهاً لك ('+STG[o.stage]+')');
   const ex=await dbGet('r:'+o.no);if(ex&&RK.indexOf(ex.stage)>RK.indexOf(o.stage))throw new Error(o.no+': لديك نسخة أحدث');
   const to={sent_leader:'at_leader',sent_sup:'at_sup',sent_off:'final'}[o.stage];if(to&&(ME.role!=='officer'||o.stage==='sent_off')){o.stage=to;o.log.push({by:ME.name,at:now(),to})}
   await dbSet('r:'+o.no,o);ok++}
  else if(o.kind==='insp'){if(!hp('insp'))throw new Error('لا تملك صلاحية التفتيش');await dbSet('i:'+o.id,o);ok++}
  else throw new Error('نوع ملف غير معروف')}catch(e){bad.push(e.message)}}
 toast('تم استيراد '+ok+(bad.length?' — '+bad.join(' | '):''),6000);go('home')}
/* ---------- officer settings ---------- */
V.set=async()=>{const pv=(await dbGet('priv'))||[],show=localStorage.pl==='1',on=(await dbAll('ob:')).length;
 view(BK+`<h3>⚙ الإعدادات</h3><div class="card"><label>رقم واتساب الأوفيسر (بصيغة دولية)</label><input id="swa" inputmode="numeric" value="${esc(CFG.wa)}"><label>البريد الإلكتروني للأوفيسر</label><input id="sem" type="email" value="${esc(CFG.email)}"><label>فترة الجولة (بالدقائق)</label><input id="srd" type="number" value="${CFG.round||120}"><button class="b" data-a="ssave">حفظ</button></div>
 <div class="card"><h4>✈ التنبيهات التلقائية (تلجرام + بريد)</h4><label>رابط سكربت جوجل (ينتهي بـ /exec)</label><input id="sgs" dir="ltr" value="${esc(CFG.gs||'')}"><label>رقم شات التلجرام (Chat ID)</label><input id="stg" dir="ltr" inputmode="numeric" value="${esc(CFG.tg||'')}"><button class="b" data-a="ssave">حفظ</button><button class="b ok" data-a="stest">🧪 اختبار الإرسال</button><p class="mut">رسائل بانتظار الإرسال: ${on}</p>${on?`<button class="b k" data-a="sflush">إرسال المعلّق الآن</button>`:''}<p class="mut">بعد الحفظ اضغط «تصدير إعدادات الفريق» ليستوردها الجميع.</p></div>
 <div class="card"><h4>📍 مواقع التفتيش</h4>${CFG.sites.map((s,i)=>`<div class="rw"><span>${esc(s.replace('|',' · '))}</span><button class="b s r" data-a="sdel" data-v="${i}">حذف</button></div>`).join('')}<input id="sa" placeholder="الاسم بالعربي" style="margin-top:8px"><input id="se" placeholder="Name in English" style="margin-top:6px"><button class="b" data-a="sadd">إضافة موقع</button></div>
 <div class="card c"><h4>🖨 رموز QR للطباعة (تحتاج إنترنت)</h4><div class="grid">${Object.keys(POSTS).map(k=>`<div><img class="th" style="margin:auto" src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('SOS|'+k)}" alt="QR"><small>${POSTS[k].ar} — SOS|${k}</small></div>`).join('')}</div></div>
 <div class="card"><h4>🕵 السجل الخاص (يراه الأوفيسر فقط)</h4><button class="b" data-a="plt">${show?'إخفاء السجل':'إظهار السجل'}</button>${show?(pv.length?pv.slice().reverse().map(a=>`<div class="rw"><span>${esc(a.txt)}</span><small>${fDT(a.at)}<br>${esc(a.by)}</small></div>`).join(''):'<p class="mut">السجل فارغ</p>'):''}</div>`)};
ACT.ssave=async()=>{CFG.wa=gv('swa').replace(/\D/g,'')||CFG.wa;CFG.email=gv('sem').trim();CFG.round=Math.max(5,+gv('srd')||120);CFG.gs=gv('sgs').trim();CFG.tg=gv('stg').trim();await persist();await plog('تعديل إعدادات الأوفيسر');toast('تم الحفظ')};
ACT.stest=async()=>{await ACT.ssave();if(!CFG.gs)return toast('ألصق رابط السكربت أولاً');toast('جاري الإرسال…');
 try{await postGS({title:'✅ اختبار SOS Guard',text:'✅ SOS Guard test — '+fDT(now())});toast('تم الإرسال — تحقق من التلجرام والبريد',5000)}catch(e){toast('فشل: '+e.message+' (تأكد من الرابط وأن الوصول Anyone)',6000)}};
ACT.sflush=async()=>{toast('جاري الإرسال…');await flush();V.set()};
ACT.sadd=async()=>{const a=gv('sa').trim(),e=gv('se').trim();if(!a)return toast('اكتب الاسم');CFG.sites.push(a+'|'+(e||a));await persist();await plog('إضافة موقع: '+a);V.set()};
ACT.sdel=async i=>{if(!confirm('حذف الموقع؟'))return;const s=CFG.sites.splice(+i,1);await persist();await plog('حذف موقع: '+s[0]);V.set()};
ACT.plt=()=>{localStorage.pl=localStorage.pl==='1'?'0':'1';V.set()};
/* ---------- init ---------- */
(()=>{const c=$('#rain'),x=c.getContext('2d');let w,h,d;const set=()=>{w=c.width=innerWidth;h=c.height=innerHeight;d=Array(Math.floor(w/16)).fill(0).map(()=>Math.random()*h/16)};set();addEventListener('resize',set);
 setInterval(()=>{if(document.hidden)return;x.fillStyle='rgba(5,11,24,.12)';x.fillRect(0,0,w,h);x.fillStyle='#00ff9d';x.font='14px monospace';d.forEach((y,i)=>{x.fillText(String.fromCharCode(0x30A0+Math.random()*60),i*16,y*16);d[i]=y*16>h&&Math.random()>.975?0:y+1})},70)})();
(async()=>{
 await seed();
 if('serviceWorker' in navigator){const had=navigator.serviceWorker.controller;navigator.serviceWorker.register('sw.js').catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(had){const b=$('#banner');b.innerHTML='يوجد تحديث جديد <button onclick="location.reload()">تحديث الآن</button>';b.hidden=false}})}
 const sid=await dbGet('session');
 if(sid&&user(sid)){ME=user(sid);SHIFT=(await dbGet('shift:'+sid))||null;go(SHIFT?'shift':'home')}else go('login');
 flush();
})();
