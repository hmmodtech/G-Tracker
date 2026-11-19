'use strict';
/* ===== أدوات ===== */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const fmtT=d=>{d=new Date(d);return pad(d.getHours())+':'+pad(d.getMinutes())};
const fmtD=d=>{d=new Date(d);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const clone=o=>JSON.parse(JSON.stringify(o));
const getPath=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const setPath=(o,p,v)=>{const a=p.split('.');const l=a.pop();const t=a.reduce((x,k)=>x[k],o);t[l]=v};
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
function toast(m,ms=2800){const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.i);toast.i=setTimeout(()=>t.style.display='none',ms)}
function dl(file){const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download=file.name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},4000)}

/* ===== قاعدة البيانات ===== */
let _db;
const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open('sosg4',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>{_db=r.result;res()};r.onerror=()=>rej(r.error)});
const st=m=>_db.transaction('kv',m).objectStore('kv');
const dbGet=k=>new Promise(r=>{const q=st('readonly').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r()});
const dbSet=(k,v)=>new Promise(r=>{const q=st('readwrite').put(v,k);q.onsuccess=()=>r();q.onerror=()=>r()});
const dbDel=k=>new Promise(r=>{const q=st('readwrite').delete(k);q.onsuccess=()=>r();q.onerror=()=>r()});
const dbAll=p=>new Promise(r=>{const o=[];const q=st('readonly').openCursor(IDBKeyRange.bound(p,p+'\uffff'));q.onsuccess=()=>{const c=q.result;if(c){o.push(c.value);c.continue()}else r(o)};q.onerror=()=>r(o)});
const allReps=()=>dbAll('r:');

/* ===== الثوابت ===== */
const ROLE={guard:['حارس','Guard'],leader:['قائد شفت','Shift Leader'],supervisor:['مشرف','Supervisor'],officer:['أوفيسر','Security Officer']};
const STAGE={guard:['عند الحارس','With guard',0],sent_leader:['أُرسل للقائد','Sent to leader',1],at_leader:['عند القائد','At leader',2],reviewed:['راجعه القائد','Reviewed by leader',3],sent_sup:['أُرسل للمشرف','Sent to supervisor',4],at_sup:['عند المشرف','At supervisor',5],sent_off:['وصل للأوفيسر','Sent to officer',6],final:['استلمه الأوفيسر','Received by officer',7]};
const rank=s=>STAGE[s]?STAGE[s][2]:0;
const LV={g:['سليم','Normal','#2dff9a'],y:['ملاحظات','Attention','#d9a300'],r:['حرج','Critical','#e0283a']};
const RES={ok:['سليم - لا ملاحظات','OK - no remarks'],follow:['يحتاج متابعة','Needs follow-up'],esc:['تصعيد','Escalate']};
const NETQ={slow:['بطيء','Slow'],good:['جيد','Good'],excellent:['ممتاز','Excellent']};
const INC=[['دخول شخص غير مصرّح','Unauthorized entry attempt','r'],['شخص مشبوه بالقرب من المكان','Suspicious person nearby','y'],['حريق أو دخان','Fire or smoke','r'],['حالة طبية طارئة','Medical emergency','r'],['عطل في الإنارة أو الكاميرات','Lighting / CCTV malfunction','y'],['باب أو بوابة مفتوحة بشكل غير طبيعي','Door / gate found open','y'],['خلاف أو مشاجرة','Dispute or fight','r'],['مركبة غير معروفة','Unknown vehicle','y'],['انقطاع الكهرباء','Power outage','y'],['أخرى (اكتب التفاصيل)','Other (free text)','y']];
const DEF_CFG={orgKey:'SOSG-2025-KEY',posts:[{id:'GATE',ar:'البوابة',en:'Main Gate'},{id:'BLDG',ar:'بجوار المبنى',en:'Beside the Building'}],shifts:{M:{ar:'صباحي',en:'Morning',from:'07:00',to:'15:00'},E:{ar:'مسائي',en:'Evening',from:'15:00',to:'23:00'}},interval:120,requireQR:true,manualOK:true,matrix:true,sound:true,wake:true,officer:{name:'الأوفيسر',wa:'970567144224',tg:'',email:''}};
function defUsers(){const u=[];for(let i=1;i<=9;i++)u.push({id:'G'+i,name:'حارس '+i,pin:'1234',role:'guard',shift:i%2?'M':'E',post:i%2?'GATE':'BLDG'});
u.push({id:'L1',name:'قائد الشفت الصباحي',pin:'2222',role:'leader',shift:'M'},{id:'L2',name:'قائد الشفت المسائي',pin:'2222',role:'leader',shift:'E'},{id:'S1',name:'المشرف',pin:'0000',role:'supervisor'},{id:'O1',name:'الأوفيسر',pin:'9999',role:'officer'});return u}

const S={cfg:null,users:[],me:null,shift:null,screen:'login',rd:null,cur:null,pdfP:null,as:0,lastAl:0};
const ACT={};
const postOf=id=>S.cfg.posts.find(p=>p.id===id)||{id,ar:id,en:id};
const shOf=k=>S.cfg.shifts[k]||{ar:k,en:k,from:'00:00',to:'00:00'};
const durMin=sh=>{const [a,b]=sh.from.split(':').map(Number),[c,d]=sh.to.split(':').map(Number);let m=(c*60+d)-(a*60+b);if(m<=0)m+=1440;return m};
const expRounds=k=>Math.max(1,Math.floor(durMin(shOf(k))/S.cfg.interval));
const V=h=>{$('#view').innerHTML=h;scrollTo(0,0);hdr()};
function hdr(){const w=$('#who');w.innerHTML=S.me?`${esc(S.me.name)}<br><small>${ROLE[S.me.role][0]}</small> <button data-act="logout">خروج</button>`:''}

/* ===== صوت / اهتزاز / شاشة ===== */
let AC,WL;
function unlockAudio(){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();AC.resume()}catch(e){}}
function beep(n=3){if(S.cfg.sound&&AC){for(let i=0;i<n;i++){const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=880;o.connect(g);g.connect(AC.destination);const t=AC.currentTime+i*.35;g.gain.setValueAtTime(.35,t);g.gain.exponentialRampToValueAtTime(.001,t+.25);o.start(t);o.stop(t+.3)}}
if(navigator.vibrate)navigator.vibrate([300,150,300]);document.body.animate([{background:'#3a0710'},{background:'#050b1a'}],{duration:900,iterations:2})}
async function wake(){try{if(S.cfg.wake&&'wakeLock'in navigator)WL=await navigator.wakeLock.request('screen')}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.shift)wake()});

/* ===== مطر Matrix ===== */
function rain(){const c=$('#rain'),x=c.getContext('2d');let cols,d;const size=()=>{c.width=innerWidth;c.height=innerHeight;cols=Math.floor(c.width/16);d=Array.from({length:cols},()=>Math.random()*50)};size();addEventListener('resize',size);const ch='01SOS<>/#アイウエオカキ';
setInterval(()=>{if(!S.cfg.matrix){x.clearRect(0,0,c.width,c.height);return}x.fillStyle='rgba(5,11,26,.12)';x.fillRect(0,0,c.width,c.height);x.font='14px monospace';for(let i=0;i<cols;i++){x.fillStyle=Math.random()>.5?'#19e6ff':'#2dff9a';x.fillText(ch[Math.random()*ch.length|0],i*16,d[i]*16);if(d[i]*16>c.height&&Math.random()>.975)d[i]=0;d[i]++}},70)}

/* ===== حالة التقرير الفعّالة (الأصل + التعديلات) ===== */
function eff(rep){const E=clone({g:rep.g,review:rep.review||null});(rep.amends||[]).forEach(a=>{try{setPath(E,a.k,a.nv)}catch(e){}});return E}
const showVal=(k,v)=>k.endsWith('level')?(LV[v]?LV[v][0]:v):k==='review.result'?(RES[v]?RES[v][0]:v):v;

/* ===== الجوال: GPS + الإنترنت ===== */
const gps=()=>new Promise(r=>{if(!navigator.geolocation)return r(null);navigator.geolocation.getCurrentPosition(p=>r({lat:+p.coords.latitude.toFixed(5),lon:+p.coords.longitude.toFixed(5),acc:Math.round(p.coords.accuracy)}),()=>r(null),{timeout:8000,maximumAge:60000,enableHighAccuracy:true})});
async function netTest(){if(!navigator.onLine)return{ok:false};const ac=new AbortController();const to=setTimeout(()=>ac.abort(),8000);
try{const t0=performance.now();const r=await fetch('logo.png?speedtest='+Date.now(),{cache:'no-store',signal:ac.signal});if(!r.ok)throw 0;const b=await r.blob();const dt=Math.max(.05,(performance.now()-t0)/1000);const mbps=+(b.size*8/dt/1e6).toFixed(1);return{ok:true,mbps,q:mbps<1?'slow':mbps<5?'good':'excellent'}}catch(e){return{ok:false}}finally{clearTimeout(to)}}

/* ===== البداية ===== */
async function init(){
 await openDB();
 S.cfg=Object.assign({},DEF_CFG,await dbGet('cfg')||{});
 const u=await dbGet('users');S.users=u||defUsers();if(!u)await dbSet('users',S.users);
 rain();banner();
 try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist()}catch(e){}
 const sid=await dbGet('session');if(sid)S.me=S.users.find(x=>x.id===sid)||null;
 home();
}
function banner(){const sa=matchMedia('(display-mode: standalone)').matches||navigator.standalone;if(sa)return;const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
$('#banner').innerHTML='<div class="b">'+(ios?'⚠ ثبّت التطبيق: افتح الرابط في Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية». بدون التثبيت قد يحذف آيفون بياناتك.':'⚠ ثبّت التطبيق من قائمة المتصفح (تثبيت التطبيق) ليعمل بدون إنترنت.')+'</div>'}
function showUpdate(w){$('#banner').innerHTML='<div class="b">🔄 يوجد إصدار جديد من التطبيق<br><button class="btn sm pri" id="updb">تحديث الآن</button></div>';$('#updb').onclick=()=>w.postMessage('skip')}
if('serviceWorker'in navigator){navigator.serviceWorker.register('sw.js').then(reg=>{reg.addEventListener('updatefound',()=>{const w=reg.installing;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdate(w)})})}).catch(()=>{});let rl;navigator.serviceWorker.addEventListener('controllerchange',()=>{if(rl)return;rl=1;location.reload()})}
function loadJsQR(){const s=document.createElement('script');s.src='jsQR.js';s.onerror=()=>{};document.head.appendChild(s)}loadJsQR();

document.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const f=ACT[el.dataset.act];if(f){unlockAudio();f(el,e)}});
document.addEventListener('change',e=>{if(e.target.id==='af')swapAV()});

/* ===== الدخول ===== */
function home(){
 if(!S.me)return vLogin();
 if(S.me.role==='guard')return vGuard();
 vList();
}
function vLogin(){S.screen='login';
 V(`<div class="card"><h2>تسجيل الدخول</h2><label>المستخدم</label><select id="lu">${S.users.map(u=>`<option value="${u.id}">${esc(u.name)} — ${ROLE[u.role][0]}</option>`).join('')}</select><label>الرقم السري PIN</label><input id="lp" type="password" inputmode="numeric" autocomplete="off"><button class="btn pri" data-act="login">دخول</button></div>`)}
ACT.login=async()=>{const u=S.users.find(x=>x.id===$('#lu').value);if(!u||String(u.pin)!==$('#lp').value)return toast('الرقم السري غير صحيح');S.me=u;await dbSet('session',u.id);home()};
ACT.logout=async()=>{S.me=null;S.shift=null;await dbDel('session');vLogin()};
ACT.home=()=>{stopScan();home()};

/* ===== الحارس ===== */
async function vGuard(){
 const u=S.me;S.shift=await dbGet('shift:'+u.id);if(S.shift){wake();return vActive()}
 S.screen='ghome';
 const mine=(await allReps()).filter(r=>r.g.guardId===u.id).sort((a,b)=>b.g.start-a.g.start);
 const sh=shOf(u.shift),post=postOf(u.post),ho=await dbGet('handover:'+u.post);
 V(`<div class="card hud"><h2>${esc(u.name)}</h2><div class="mut">الموقع: ${esc(post.ar)} · الشفت: ${sh.ar} (${sh.from}–${sh.to})</div><button class="btn pri big" data-act="startShift">▶ بدء المناوبة</button><div class="mut">الجولة كل ${S.cfg.interval} دقيقة</div></div>
 ${ho?`<div class="card"><h3>تسليم الشفت السابق</h3><div class="mut">${fmtD(ho.t)} — ${esc(ho.by)}</div><p>${esc(ho.text||'لا ملاحظات')}</p></div>`:''}
 <div class="card"><h3>تقاريري</h3>${mine.map(repItem).join('')||'<div class="mut">لا توجد تقارير</div>'}</div>
 <button class="btn" data-act="settings">⚙ أدوات</button>`)}
ACT.startShift=async()=>{const u=S.me,now=Date.now(),no=`GR-${fmtD(now).replace(/-/g,'')}-${u.id}${u.shift}`;
 if(await dbGet('r:'+no))return toast('يوجد تقرير لهذا الشفت اليوم: '+no);
 S.shift={guardId:u.id,guardName:u.name,post:u.post,sh:u.shift,date:fmtD(now),start:now,nextDue:now+S.cfg.interval*60000,rounds:[],incidents:[],no};
 await dbSet('shift:'+u.id,S.shift);wake();toast('بدأت المناوبة');vActive()};
function vActive(){S.screen='active';const s=S.shift,sh=shOf(s.sh),post=postOf(s.post);
 V(`<div class="card hud"><div class="mut">${esc(post.ar)} · ${sh.ar} · ${s.no}</div><div id="cd" class="timer">--:--</div><div id="cdl" class="mut"></div><div class="bar"><i id="pb"></i></div><div class="mut">الجولات: ${s.rounds.length} / ${expRounds(s.sh)} · الحوادث: ${s.incidents.length}</div></div>
 <button class="btn pri big" data-act="round">✔ تسجيل جولة</button>
 <button class="btn warn" data-act="inc">⚠ بلاغ حادث</button>
 <button class="btn red" data-act="endq">■ إنهاء المناوبة</button>
 <div class="card"><h3>سجل الجولات</h3>${s.rounds.map((r,i)=>`<div class="item"><span>${i+1}. ${fmtT(r.t)} ${r.late?'<span class="tag" style="color:#ff4d5e">متأخرة</span>':''}</span><span class="mut">${r.net&&r.net.avail?NETQ[r.net.q][0]:'بدون إنترنت'}</span></div>`).join('')||'<div class="mut">لا جولات بعد</div>'}</div>`);
 tick()}
function tick(){const cd=$('#cd');if(!cd||!S.shift)return;const s=S.shift,iv=S.cfg.interval*60000,rem=s.nextDue-Date.now(),a=Math.abs(rem);
 cd.textContent=(rem<0?'-':'')+pad(Math.floor(a/60000))+':'+pad(Math.floor(a/1000)%60);cd.className='timer'+(rem<0?' late':rem<5*60000?' soon':'');
 $('#cdl').textContent=rem<0?'الجولة متأخرة!':'الجولة القادمة '+fmtT(s.nextDue);$('#pb').style.width=Math.max(0,Math.min(100,100-rem/iv*100))+'%'}
setInterval(()=>{if(S.shift&&S.me&&S.me.role==='guard'){if(S.screen==='active')tick();if(S.shift.nextDue<=Date.now()&&Date.now()-S.lastAl>45000){S.lastAl=Date.now();beep()}}},1000);

/* --- جولة --- */
const hasScan=()=>!!(navigator.mediaDevices&&(window.BarcodeDetector||window.jsQR));
let STREAM,SCANNING=false;
function stopScan(){SCANNING=false;if(STREAM){STREAM.getTracks().forEach(t=>t.stop());STREAM=null}}
ACT.round=()=>{S.screen='round';S.rd={qr:false};const c=S.cfg,scan=c.requireQR&&hasScan(),man=!c.requireQR||c.manualOK||!hasScan();
 V(`<div class="card"><h2>جولة التفقد</h2><div id="rbox">${scan?`<video id="vid" playsinline muted></video><div id="sstat" class="mut">وجّه الكاميرا نحو رمز QR الخاص بالموقع</div>`:`<div class="mut">${c.requireQR?'قارئ QR غير متوفر على هذا الجهاز':'التحقق بالرمز غير مفعّل'}</div>`}${man?'<button class="btn" data-act="manual">تأكيد يدوي (وجودي في الموقع)</button>':''}</div><button class="btn sm" data-act="home">← رجوع</button></div>`);
 if(scan)startScan()};
async function startScan(){const v=$('#vid');try{STREAM=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});v.srcObject=STREAM;await v.play()}catch(e){$('#sstat').textContent='تعذّر فتح الكاميرا — استخدم التأكيد اليدوي';return}
 const bd=window.BarcodeDetector?new BarcodeDetector({formats:['qr_code']}):null,cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});SCANNING=true;
 const loop=async()=>{if(!SCANNING)return;let code=null;if(v.videoWidth){try{if(bd){const r=await bd.detect(v);if(r[0])code=r[0].rawValue}else if(window.jsQR){const w=480,h=Math.round(v.videoHeight*w/v.videoWidth);cv.width=w;cv.height=h;cx.drawImage(v,0,0,w,h);const q=jsQR(cx.getImageData(0,0,w,h).data,w,h);if(q)code=q.data}}catch(e){}}
  if(code){if(code==='SOS|'+S.shift.post){qrOK('scan');return}$('#sstat').textContent='⚠ هذا الرمز لموقع آخر'}setTimeout(loop,250)};loop()}
ACT.manual=()=>qrOK('manual');
function qrOK(method){stopScan();S.rd={qr:true,method,gpsP:gps(),net:null};
 $('#rbox').innerHTML=`<div class="ok">✔ تم التحقق من الموقع ${method==='scan'?'(مسح QR)':'(يدوي)'}</div>
 <label>الاتصال بالإنترنت وسرعته</label><select id="rnet"><option value="none">غير متوفر</option><option value="slow">بطيء</option><option value="good">جيد</option><option value="excellent">ممتاز</option></select><div id="nst" class="mut">جارٍ القياس...</div>
 <label>ملاحظة (اختياري)</label><input id="rnote"><button class="btn pri" data-act="saveRound">حفظ الجولة</button>`;
 netTest().then(n=>{S.rd.net=n;const sel=$('#rnet');if(!sel)return;if(n.ok){sel.value=n.q;$('#nst').textContent='القياس التلقائي: '+NETQ[n.q][0]+' (≈'+n.mbps+' Mbps) — يمكنك تغييره'}else{sel.value='none';$('#nst').textContent='لا يوجد اتصال بالإنترنت'}})}
ACT.saveRound=async()=>{const s=S.shift,rd=S.rd;toast('جارٍ الحفظ...',1500);const g=await rd.gpsP,now=Date.now(),q=$('#rnet').value;
 s.rounds.push({t:now,due:s.nextDue,late:now>s.nextDue+10*60000,method:rd.method,gps:g,net:q==='none'?{avail:false}:{avail:true,q,mbps:rd.net&&rd.net.mbps},note:$('#rnote').value.trim()});
 s.nextDue=now+S.cfg.interval*60000;await dbSet('shift:'+S.me.id,s);toast('تم تسجيل الجولة ✔');vActive()};

/* --- حادث --- */
ACT.inc=()=>{S.screen='inc';V(`<div class="card"><h2>بلاغ حادث</h2><label>نوع الحادث</label><select id="it">${INC.map((x,i)=>`<option value="${i}">${x[0]} / ${x[1]}</option>`).join('')}</select><label>الخطورة</label><select id="il"><option value="y">🟡 متوسطة</option><option value="r">🔴 عالية</option></select><label>التفاصيل (لا تكتب أسماء أو بيانات أطفال)</label><textarea id="id"></textarea><button class="btn pri" data-act="saveInc">حفظ البلاغ</button><button class="btn sm" data-act="home">← رجوع</button></div>`);
 $('#it').onchange=()=>{$('#il').value=INC[$('#it').value][2]};$('#il').value=INC[0][2]};
ACT.saveInc=async()=>{const i=+$('#it').value,d=$('#id').value.trim(),lv=$('#il').value;if(i===INC.length-1&&!d)return toast('اكتب التفاصيل');
 const x={t:Date.now(),ar:INC[i][0],en:INC[i][1],lv,details:d};S.shift.incidents.push(x);await dbSet('shift:'+S.me.id,S.shift);
 if(lv==='r'){S.alertTxt=`🔴 تنبيه حادث\nالحارس: ${S.me.name}\nالموقع: ${postOf(S.shift.post).ar}\nالحادث: ${x.ar} / ${x.en}\nالوقت: ${fmtT(x.t)}\n${d}`;return V(`<div class="card"><h2 style="color:#ff4d5e">تم حفظ البلاغ 🔴</h2><button class="btn red" data-act="waAlert">إرسال تنبيه واتساب فوراً</button><button class="btn" data-act="home">متابعة</button></div>`)}
 toast('تم حفظ البلاغ');vActive()};
ACT.waAlert=()=>{window.open('https://wa.me/'+S.cfg.officer.wa+'?text='+encodeURIComponent(S.alertTxt),'_blank')};

/* --- إنهاء المناوبة --- */
ACT.endq=()=>{S.screen='end';S.as=0;const s=S.shift;
 V(`<div class="card"><h2>إنهاء المناوبة</h2><div class="kv"><span>الجولات</span><b>${s.rounds.length} / ${expRounds(s.sh)}</b></div><div class="kv"><span>الحوادث</span><b>${s.incidents.length}</b></div>
 <label>هل جرى تقديم أي مساعدة أمنية أو لوجستية لأحد الموظفين خلال فترة المناوبة؟</label>
 <div class="seg"><button data-act="as" data-v="1">نعم</button><button data-act="as" data-v="0" class="on">لا</button></div>
 <div id="asbox" hidden><label>نوع المساعدة *</label><input id="atype" placeholder="اكتب نوع المساعدة"><label>الموظف / القسم (اختياري)</label><input id="awho"><label>التفاصيل (اختياري — دون أسماء أطفال)</label><textarea id="adet"></textarea></div>
 <label>ملاحظات تسليم الشفت للحارس القادم</label><textarea id="ho"></textarea><label>ملاحظات عامة (اختياري)</label><textarea id="gn"></textarea>
 <button class="btn pri" data-act="finish">اعتماد وإغلاق التقرير</button><button class="btn sm" data-act="home">← رجوع</button></div>`)};
ACT.as=el=>{S.as=+el.dataset.v;document.querySelectorAll('.seg button').forEach(b=>b.classList.toggle('on',b===el));$('#asbox').hidden=!S.as};
ACT.finish=async()=>{const s=S.shift;if(S.as&&!$('#atype').value.trim())return toast('اكتب نوع المساعدة');if(!confirm('بعد الإغلاق لا يمكن تعديل التقرير. متابعة؟'))return;
 const end=Date.now(),exp=expRounds(s.sh),late=s.rounds.filter(r=>r.late).length;
 const level=s.incidents.some(x=>x.lv==='r')?'r':(s.incidents.length||late||s.rounds.length<exp)?'y':'g';
 const g={no:s.no,guardId:s.guardId,guardName:s.guardName,post:s.post,sh:s.sh,date:s.date,start:s.start,end,expected:exp,rounds:s.rounds,incidents:s.incidents,
  assist:{yes:!!S.as,type:S.as?$('#atype').value.trim():'',who:S.as?$('#awho').value.trim():'',details:S.as?$('#adet').value.trim():''},handover:$('#ho').value.trim(),notes:$('#gn').value.trim(),level};
 const rep={no:s.no,g,seal:await sha(JSON.stringify(g)+S.cfg.orgKey),stage:'guard',review:null,supNote:'',amends:[],trail:[{r:'guard',n:s.guardName,a:'أنشأ التقرير وختمه',t:end}]};
 await dbSet('r:'+rep.no,rep);await dbSet('handover:'+s.post,{t:end,by:s.guardName,text:g.handover});await dbDel('shift:'+S.me.id);S.shift=null;toast('تم إغلاق التقرير ✔');vRep(rep.no)};

/* ===== القوائم للأدوار الأخرى ===== */
const repItem=r=>{const E=eff(r),lv=(E.review&&E.review.level)||E.g.level;return `<div class="item" data-act="openRep" data-no="${r.no}" style="cursor:pointer"><span><i class="dot lv-${lv}"></i>${esc(r.g.guardName)}<br><small class="mut">${r.no}</small></span><span class="tag">${STAGE[r.stage][0]}</span></div>`};
async function vList(){S.screen='list';const r=S.me.role;let reps=(await allReps()).sort((a,b)=>b.g.start-a.g.start);if(r==='leader')reps=reps.filter(x=>x.g.sh===S.me.shift);
 V(`<div class="card hud"><h2>${esc(S.me.name)}</h2><div class="mut">${ROLE[r][0]} · ${ROLE[r][1]}</div><button class="btn pri" data-act="impRep">⬇ استيراد تقرير (ملف -data.txt)</button></div>
 <div class="card"><h3>التقارير (${reps.length})</h3>${reps.map(repItem).join('')||'<div class="mut">لا توجد تقارير. استورد الملف الذي وصلك.</div>'}</div>
 <button class="btn" data-act="settings">⚙ ${r==='leader'?'أدوات':'الإعدادات'}</button>`)}
ACT.impRep=()=>pickFile('rep',true);
ACT.openRep=el=>vRep(el.dataset.no);

/* ===== عرض التقرير ===== */
async function vRep(no){S.screen='rep';const rep=await dbGet('r:'+no);if(!rep)return home();S.cur=rep;S.pdfP=makePDF(rep).catch(()=>null);
 const E=eff(rep),g=E.g,post=postOf(g.post),sh=shOf(g.sh),r=S.me.role,vis=(rep.amends||[]).filter(a=>!a.hidden);
 const kv=(a,b)=>`<div class="kv"><span>${a}</span><b>${esc(b||'—')}</b></div>`;
 let h=`<button class="btn sm" data-act="home">← رجوع</button><div class="card"><h2>${rep.no}</h2><span class="tag">${STAGE[rep.stage][0]}</span>
 ${kv('الحارس',g.guardName)}${kv('الموقع',post.ar+' / '+post.en)}${kv('الشفت',sh.ar+' / '+sh.en)}${kv('التاريخ',g.date)}${kv('من - إلى',fmtT(g.start)+' - '+fmtT(g.end))}${kv('الجولات',g.rounds.length+' / '+g.expected+' (متأخرة: '+g.rounds.filter(x=>x.late).length+')')}${kv('الحوادث',g.incidents.length)}
 <div class="kv"><span>حالة الحارس</span><b><i class="dot lv-${g.level}"></i>${LV[g.level][0]}</b></div>
 ${kv('مساعدة الموظفين',g.assist.yes?'نعم — '+g.assist.type+(g.assist.who?' ('+g.assist.who+')':'')+(g.assist.details?' — '+g.assist.details:''):'لا')}
 ${kv('تسليم الشفت',g.handover)}${g.notes?kv('ملاحظات',g.notes):''}</div>
 <div class="card"><h3>الجولات</h3><table><tr><th>#</th><th>الوقت</th><th>التحقق</th><th>الإنترنت</th></tr>${g.rounds.map((x,i)=>`<tr><td>${i+1}</td><td>${fmtT(x.t)}${x.late?' ⚠':''}</td><td>${x.method==='scan'?'QR':'يدوي'}</td><td>${x.net&&x.net.avail?NETQ[x.net.q][0]:'—'}</td></tr>`).join('')}</table></div>
 ${g.incidents.length?`<div class="card"><h3>الحوادث</h3>${g.incidents.map(x=>`<div class="item"><span><i class="dot lv-${x.lv}"></i>${fmtT(x.t)} ${esc(x.ar)}<br><small class="mut">${esc(x.details)}</small></span></div>`).join('')}</div>`:''}`;
 if(E.review)h+=`<div class="card"><h3>مراجعة القائد</h3>${kv('النتيجة',RES[E.review.result][0])}<div class="kv"><span>المستوى</span><b><i class="dot lv-${E.review.level}"></i>${LV[E.review.level][0]}</b></div>${kv('الملاحظات',E.review.remarks)}${kv('الإجراء',E.review.action)}${kv('بواسطة',E.review.by)}</div>`;
 if(vis.length)h+=`<div class="card"><h3>تعديلات</h3>${vis.map(a=>`<div class="item"><span>${esc(a.lbl)}<br><small class="mut">${esc(showVal(a.k,a.old))} ← ${esc(showVal(a.k,a.nv))}<br>السبب: ${esc(a.reason)} · ${esc(a.by)} · ${fmtD(a.t)} ${fmtT(a.t)}</small></span></div>`).join('')}</div>`;
 if(rep.supNote)h+=`<div class="card"><h3>ملاحظة المشرف</h3><p>${esc(rep.supNote)}</p></div>`;
 /* إجراءات حسب الدور */
 if(r==='guard'&&g.guardId===S.me.id)h+=`<button class="btn pri" data-act="sendNext">📤 ${rank(rep.stage)>=1?'إعادة الإرسال':'إرسال'} إلى القائد (PDF + ملف البيانات)</button>`;
 if(r==='leader'&&(rep.stage==='at_leader'||rep.stage==='reviewed')){const rv=rep.review||{result:'ok',level:E.g.level,remarks:'',action:''};
  h+=`<div class="card"><h3>مراجعة القائد</h3><label>النتيجة</label><select id="rr">${Object.keys(RES).map(k=>`<option value="${k}" ${rv.result===k?'selected':''}>${RES[k][0]}</option>`).join('')}</select><label>المستوى</label><select id="rl">${Object.keys(LV).map(k=>`<option value="${k}" ${rv.level===k?'selected':''}>${LV[k][0]}</option>`).join('')}</select><label>الملاحظات (إلزامية إن لم تكن النتيجة سليم)</label><textarea id="rm">${esc(rv.remarks)}</textarea><label>الإجراء المتخذ</label><input id="ra" value="${esc(rv.action)}"><button class="btn pri" data-act="saveReview">حفظ المراجعة</button></div>`;
  if(rep.stage==='reviewed')h+=`<button class="btn pri" data-act="sendNext">📤 إرسال إلى المشرف</button>`}
 if(r==='supervisor'&&(rep.stage==='at_sup'||rep.stage==='sent_off'))h+=amendPanel(rep)+`<div class="card"><h3>ملاحظة المشرف</h3><textarea id="sn">${esc(rep.supNote)}</textarea><button class="btn" data-act="saveSup">حفظ الملاحظة</button></div><button class="btn pri" data-act="sendNext">📤 ${rep.stage==='sent_off'?'إعادة الإرسال':'إرسال'} إلى الأوفيسر</button>`;
 if(r==='officer'){h+=amendPanel(rep)+`<button class="btn pri" data-act="shareAny">📤 مشاركة (واتساب / تلجرام / إيميل)</button>`;if(rep.stage!=='final')h+=`<button class="btn" data-act="receive">✔ تسجيل الاستلام</button>`}
 h+=`<button class="btn" data-act="dlPdf">⬇ تنزيل PDF</button><div class="card"><h3>مسار التقرير</h3>${rep.trail.map(t=>`<div class="mut">${fmtD(t.t)} ${fmtT(t.t)} — ${esc(t.n)}: ${esc(t.a)}</div>`).join('')}<div class="mut" style="word-break:break-all;margin-top:6px">الختم: ${rep.seal.slice(0,24)}…</div></div>`;
 V(h)}

/* --- مراجعة القائد --- */
ACT.saveReview=async()=>{const rep=S.cur,res=$('#rr').value,rm=$('#rm').value.trim();if(res!=='ok'&&!rm)return toast('اكتب الملاحظات');
 rep.review={result:res,level:$('#rl').value,remarks:rm,action:$('#ra').value.trim(),by:S.me.name,at:Date.now()};rep.stage='reviewed';rep.trail.push({r:'leader',n:S.me.name,a:'حفظ المراجعة',t:Date.now()});await dbSet('r:'+rep.no,rep);toast('تم حفظ المراجعة');vRep(rep.no)};
ACT.saveSup=async()=>{const rep=S.cur;rep.supNote=$('#sn').value.trim();rep.trail.push({r:'supervisor',n:S.me.name,a:'أضاف ملاحظة',t:Date.now()});await dbSet('r:'+rep.no,rep);toast('تم الحفظ');vRep(rep.no)};
ACT.receive=async()=>{const rep=S.cur;rep.stage='final';rep.trail.push({r:'officer',n:S.me.name,a:'استلم التقرير',t:Date.now()});await dbSet('r:'+rep.no,rep);vRep(rep.no)};

/* --- التعديل (المشرف: ظاهر مع سبب إلزامي | الأوفيسر: صامت) --- */
function FIELDS(rep){const E=eff(rep),f=[{k:'g.level',l:'مستوى تقرير الحارس',t:'level'},{k:'g.handover',l:'ملاحظات التسليم'},{k:'g.notes',l:'ملاحظات الحارس العامة'}];
 if(E.g.assist.yes)f.push({k:'g.assist.type',l:'نوع المساعدة'},{k:'g.assist.details',l:'تفاصيل المساعدة'});
 E.g.incidents.forEach((x,i)=>f.push({k:`g.incidents.${i}.details`,l:'تفاصيل الحادث '+(i+1)}));
 if(E.review)f.push({k:'review.result',l:'نتيجة مراجعة القائد',t:'result'},{k:'review.level',l:'مستوى مراجعة القائد',t:'level'},{k:'review.remarks',l:'ملاحظات القائد'},{k:'review.action',l:'إجراء القائد'});return f}
function avCtl(f,rep){const cur=getPath(eff(rep),f.k)||'';if(f.t==='level')return `<label>القيمة الجديدة</label><select id="av">${Object.keys(LV).map(k=>`<option value="${k}" ${cur===k?'selected':''}>${LV[k][0]}</option>`).join('')}</select>`;
 if(f.t==='result')return `<label>القيمة الجديدة</label><select id="av">${Object.keys(RES).map(k=>`<option value="${k}" ${cur===k?'selected':''}>${RES[k][0]}</option>`).join('')}</select>`;
 return `<label>القيمة الجديدة</label><textarea id="av">${esc(cur)}</textarea>`}
function amendPanel(rep){const fl=FIELDS(rep);return `<div class="card"><h3>تعديل التقرير</h3><div class="mut">التقرير الأصلي للحارس يبقى مختوماً، والتعديل يُحفظ فوقه.</div><label>الحقل</label><select id="af">${fl.map(f=>`<option value="${f.k}">${f.l}</option>`).join('')}</select><div id="avb">${avCtl(fl[0],rep)}</div><label>سبب التعديل ${S.me.role==='officer'?'(اختياري)':'*'}</label><input id="ar"><button class="btn pri" data-act="amend">تطبيق التعديل</button></div>`}
function swapAV(){const f=FIELDS(S.cur).find(x=>x.k===$('#af').value);$('#avb').innerHTML=avCtl(f,S.cur)}
ACT.amend=async()=>{const rep=S.cur,f=FIELDS(rep).find(x=>x.k===$('#af').value),nv=$('#av').value.trim(),reason=$('#ar').value.trim(),off=S.me.role==='officer';
 if(!off&&!reason)return toast('سبب التعديل إلزامي');const old=getPath(eff(rep),f.k);if(old===nv)return toast('لا يوجد تغيير');
 rep.amends.push({k:f.k,lbl:f.l,old,nv,by:S.me.name,role:S.me.role,t:Date.now(),reason,hidden:off});
 if(off){const pl=(await dbGet('priv'))||[];pl.push({t:Date.now(),rep:rep.no,k:f.k,old,nv,reason});await dbSet('priv',pl)}
 else rep.trail.push({r:S.me.role,n:S.me.name,a:'عدّل: '+f.l,t:Date.now()});
 await dbSet('r:'+rep.no,rep);toast('تم التعديل');vRep(rep.no)};

/* --- الإرسال --- */
function summary(rep,to){const E=eff(rep),g=E.g;return `تقرير مناوبة ${rep.no}\nالحارس: ${g.guardName}\nالموقع: ${postOf(g.post).ar}\nالتاريخ: ${g.date}\nالجولات: ${g.rounds.length}/${g.expected}\nالحوادث: ${g.incidents.length}\nالحالة: ${LV[(E.review&&E.review.level)||g.level][0]}\n${to?'إلى: '+to+'\n':''}— SOS Guard`}
async function shareRep(rep,copy,to){const pdf=await (S.pdfP||makePDF(rep));if(!pdf){toast('تعذّر إنشاء PDF');return false}
 const f1=new File([pdf],rep.no+'.pdf',{type:'application/pdf'}),f2=new File([JSON.stringify(copy)],rep.no+'-data.txt',{type:'text/plain'});
 try{if(navigator.canShare&&navigator.canShare({files:[f1,f2]})){await navigator.share({files:[f1,f2],text:summary(rep,to),title:rep.no});return true}}catch(e){if(e.name==='AbortError')return false}
 dl(f1);setTimeout(()=>dl(f2),600);toast('تم تنزيل الملفين — أرسلهما يدوياً');return true}
ACT.sendNext=async()=>{const rep=S.cur,r=S.me.role,m={guard:['sent_leader','القائد'],leader:['sent_sup','المشرف'],supervisor:['sent_off','الأوفيسر']}[r];if(!m)return;
 const copy=clone(rep);copy.stage=m[0];copy.trail.push({r,n:S.me.name,a:'أرسل إلى '+m[1],t:Date.now()});
 if(await shareRep(rep,copy,m[1])){await dbSet('r:'+rep.no,copy);vRep(rep.no)}};
ACT.shareAny=()=>shareRep(S.cur,S.cur,'');
ACT.dlPdf=async()=>{const p=await (S.pdfP||makePDF(S.cur));if(p)dl(new File([p],S.cur.no+'.pdf',{type:'application/pdf'}))};

/* --- استيراد التقارير --- */
function pickFile(mode,multi){const f=$('#fi');f.dataset.mode=mode;f.multiple=!!multi;f.value='';f.click()}
$('#fi').addEventListener('change',async e=>{const fs=[...e.target.files],m=e.target.dataset.mode;if(!fs.length)return;if(m==='rep')await importReps(fs);if(m==='team')await importTeam(fs[0]);if(m==='restore')await restore(fs[0])});
async function importReps(files){const r=S.me.role,need={leader:'sent_leader',supervisor:'sent_sup',officer:null}[r];let n=0;
 for(const f of files){let rep;try{rep=JSON.parse(await f.text())}catch(e){toast('ملف غير صالح: '+f.name);continue}
  if(!rep||!rep.g||!rep.seal||!rep.no||!STAGE[rep.stage]){toast('ليس ملف تقرير');continue}
  if(await sha(JSON.stringify(rep.g)+S.cfg.orgKey)!==rep.seal){toast('⛔ فشل الختم أو مفتاح المؤسسة مختلف: '+rep.no,4500);continue}
  if(need&&rep.stage!==need){toast('هذا التقرير غير موجّه لك ('+STAGE[rep.stage][0]+')',4000);continue}
  if(r==='leader'&&rep.g.sh!==S.me.shift){toast('التقرير من شفت آخر');continue}
  const ex=await dbGet('r:'+rep.no);if(ex&&rank(ex.stage)>=rank(rep.stage)&&r!=='officer'){toast('موجود مسبقاً: '+rep.no);continue}
  if(r==='leader')rep.stage='at_leader';if(r==='supervisor')rep.stage='at_sup';
  rep.trail.push({r,n:S.me.name,a:'استلم التقرير',t:Date.now()});await dbSet('r:'+rep.no,rep);n++}
 if(n)toast('تم استيراد '+n+' تقرير ✔');vList()}

/* ===== الإعدادات والأدوات ===== */
function userCard(u,i){const off=S.me.role==='officer';if(!off&&!['guard','leader'].includes(u.role))return '';
 return `<div class="card" style="margin:6px 0"><div class="row2"><input id="un${i}" value="${esc(u.name)}"><input id="up${i}" value="${esc(u.pin)}" inputmode="numeric" style="max-width:100px"></div>
 <div class="row2"><select id="ur${i}" ${off?'':'disabled'}>${Object.keys(ROLE).map(k=>`<option value="${k}" ${u.role===k?'selected':''}>${ROLE[k][0]}</option>`).join('')}</select><select id="us${i}"><option value="M" ${u.shift==='M'?'selected':''}>صباحي</option><option value="E" ${u.shift==='E'?'selected':''}>مسائي</option></select><select id="uo${i}">${S.cfg.posts.map(p=>`<option value="${p.id}" ${u.post===p.id?'selected':''}>${p.ar}</option>`).join('')}</select></div>
 ${off&&u.role!=='officer'?`<button class="btn red sm" data-act="delU" data-i="${i}">حذف</button>`:''}</div>`}
function collectUsers(){S.users.forEach((u,i)=>{const n=$('#un'+i);if(!n)return;u.name=n.value.trim()||u.name;if($('#up'+i).value.trim().length>=4)u.pin=$('#up'+i).value.trim();if(S.me.role==='officer')u.role=$('#ur'+i).value;u.shift=$('#us'+i).value;u.post=$('#uo'+i).value})}
async function vSet(){S.screen='set';const r=S.me.role,c=S.cfg,adm=r==='supervisor'||r==='officer',off=r==='officer';
 let h='<button class="btn sm" data-act="home">← رجوع</button>';
 if(adm)h+=`<div class="card"><h3>المستخدمون وتوزيعهم</h3><div class="mut">الاسم · PIN · الدور · الشفت · الموقع</div>${S.users.map(userCard).join('')}<button class="btn" data-act="addUser">+ إضافة مستخدم</button><button class="btn pri" data-act="saveUsers">حفظ المستخدمين</button></div>
 <div class="card"><h3>رموز QR للمواقع</h3><div class="qrs">${c.posts.map(p=>`<div><img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('SOS|'+p.id)}" alt="QR"><br>${p.ar}<br><small>SOS|${p.id}</small></div>`).join('')}</div><div class="mut">الصور تحتاج إنترنت لمرة واحدة، اطبعها وألصقها في كل موقع.</div></div>`;
 if(off)h+=`<div class="card"><h3>الإعدادات العامة</h3><label>فترة الجولة (دقيقة)</label><input id="ci" type="number" value="${c.interval}"><label>الصباحي: من / إلى</label><div class="row2"><input id="cm1" value="${c.shifts.M.from}"><input id="cm2" value="${c.shifts.M.to}"></div><label>المسائي: من / إلى</label><div class="row2"><input id="ce1" value="${c.shifts.E.from}"><input id="ce2" value="${c.shifts.E.to}"></div>
 ${[['requireQR','إلزام مسح QR'],['manualOK','السماح بالتأكيد اليدوي'],['matrix','خلفية Matrix'],['sound','الصوت'],['wake','إبقاء الشاشة مضاءة']].map(([k,l])=>`<label><input type="checkbox" id="c_${k}" ${c[k]?'checked':''} style="width:auto"> ${l}</label>`).join('')}
 <h3 style="margin-top:14px">قنوات الأوفيسر</h3><label>واتساب (بصيغة دولية)</label><input id="ow" value="${esc(c.officer.wa)}"><label>تلجرام (معرّف أو رقم)</label><input id="ot" value="${esc(c.officer.tg)}"><label>الإيميل</label><input id="oe" value="${esc(c.officer.email)}">
 <label>مفتاح المؤسسة (يجب أن يتطابق على كل الجوالات)</label><input id="ok" value="${esc(c.orgKey)}"><button class="btn pri" data-act="saveCfg">حفظ الإعدادات</button></div>`;
 h+=`<div class="card"><h3>أدوات</h3>${off?'<button class="btn" data-act="expTeam">📤 تصدير إعدادات الفريق (للجوالات)</button>':''}<button class="btn" data-act="impTeam">📥 استيراد إعدادات الفريق</button><button class="btn" data-act="backup">💾 نسخة احتياطية</button><button class="btn" data-act="restoreB">♻ استعادة نسخة</button><button class="btn" data-act="testSound">🔔 اختبار الصوت</button></div>`;
 if(off){const pl=(await dbGet('priv'))||[];h+=`<div class="card"><h3>سجلّك الخاص</h3><div class="mut">لا يراه أحد غيرك.</div><button class="btn sm" data-act="togglePriv">${S.priv?'إخفاء':'إظهار'}</button>${S.priv?pl.slice().reverse().map(x=>`<div class="item"><span>${x.rep}<br><small class="mut">${esc(x.k)}: ${esc(x.old)} ← ${esc(x.nv)}<br>${fmtD(x.t)} ${fmtT(x.t)}</small></span></div>`).join('')||'<div class="mut">فارغ</div>':''}</div>`}
 V(h)}
ACT.settings=vSet;ACT.togglePriv=()=>{S.priv=!S.priv;vSet()};
ACT.saveUsers=async()=>{collectUsers();await dbSet('users',S.users);toast('تم الحفظ');vSet()};
ACT.addUser=async()=>{collectUsers();S.users.push({id:'U'+Date.now().toString(36),name:'مستخدم جديد',pin:'1234',role:'guard',shift:'M',post:'GATE'});await dbSet('users',S.users);vSet()};
ACT.delU=async el=>{if(S.me.role!=='officer')return;if(!confirm('حذف هذا الحساب؟'))return;collectUsers();const u=S.users[+el.dataset.i];if(u.role==='officer')return toast('لا يمكن حذف الأوفيسر');S.users.splice(+el.dataset.i,1);await dbSet('users',S.users);vSet()};
ACT.saveCfg=async()=>{const c=S.cfg;c.interval=Math.max(5,+$('#ci').value||120);c.shifts.M.from=$('#cm1').value;c.shifts.M.to=$('#cm2').value;c.shifts.E.from=$('#ce1').value;c.shifts.E.to=$('#ce2').value;
 ['requireQR','manualOK','matrix','sound','wake'].forEach(k=>c[k]=$('#c_'+k).checked);c.officer={name:c.officer.name,wa:$('#ow').value.trim(),tg:$('#ot').value.trim(),email:$('#oe').value.trim()};c.orgKey=$('#ok').value.trim()||c.orgKey;await dbSet('cfg',c);toast('تم الحفظ');vSet()};
ACT.testSound=()=>{unlockAudio();beep(2)};
async function shareFile(f){try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}}catch(e){if(e.name==='AbortError')return}dl(f)}
ACT.expTeam=async()=>{const body=JSON.stringify({cfg:S.cfg,users:S.users,ts:Date.now()});const sig=await sha(body+S.cfg.orgKey);shareFile(new File([JSON.stringify({body,sig})],'sos-guard-team.txt',{type:'text/plain'}))};
ACT.impTeam=()=>pickFile('team');
async function importTeam(f){let o;try{o=JSON.parse(await f.text())}catch(e){return toast('ملف غير صالح')}
 let ok=await sha(o.body+S.cfg.orgKey)===o.sig;if(!ok){const k=prompt('مفتاح المؤسسة لهذا الملف:');if(k&&await sha(o.body+k)===o.sig)ok=true}
 if(!ok)return toast('⛔ فشل التحقق من الملف');const b=JSON.parse(o.body);S.cfg=Object.assign({},DEF_CFG,b.cfg);S.users=b.users;await dbSet('cfg',S.cfg);await dbSet('users',S.users);
 S.me=S.users.find(u=>u.id===(S.me&&S.me.id))||null;if(!S.me)await dbDel('session');toast('تم تحديث إعدادات الفريق ✔');home()}
ACT.backup=async()=>{const reps=await allReps();shareFile(new File([JSON.stringify({reps,users:S.users,cfg:S.cfg,priv:await dbGet('priv')||[]})],'sos-guard-backup-'+fmtD(Date.now())+'.txt',{type:'text/plain'}))};
ACT.restoreB=()=>pickFile('restore');
async function restore(f){try{const b=JSON.parse(await f.text());if(!confirm('استعادة النسخة؟'))return;for(const r of b.reps||[])await dbSet('r:'+r.no,r);if(S.me.role==='officer'||S.me.role==='supervisor'){if(b.users){S.users=b.users;await dbSet('users',b.users)}if(b.cfg){S.cfg=Object.assign({},DEF_CFG,b.cfg);await dbSet('cfg',S.cfg)}}toast('تمت الاستعادة ✔');home()}catch(e){toast('ملف غير صالح')}}

/* ===== توليد PDF (رسم مباشر على Canvas — يعمل على آيفون وأندرويد) ===== */
const loadImg=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src});
async function makePDF(rep){
 const E=eff(rep),g=E.g,post=postOf(g.post),sh=shOf(g.sh),W=794,H=1123,SC=2,M=40,pages=[];let cx,y,ri=0;
 const logo=await loadImg('logo.png').catch(()=>null);const isAr=s=>/[\u0600-\u06FF]/.test(s);
 const font=o=>`${o.b?'bold ':''}${o.s||13}px Tahoma,Arial,sans-serif`;
 function np(){const c=document.createElement('canvas');c.width=W*SC;c.height=H*SC;cx=c.getContext('2d');cx.scale(SC,SC);cx.fillStyle='#fff';cx.fillRect(0,0,W,H);pages.push(c);y=M}
 function T(s,x,yy,o={}){cx.font=font(o);cx.fillStyle=o.c||'#111';const rtl=o.dir?o.dir==='rtl':isAr(s);cx.direction=rtl?'rtl':'ltr';cx.textAlign=o.a||(rtl?'right':'left');cx.textBaseline='top';cx.fillText(s,x,yy)}
 function wrap(s,w,o){cx.font=font(o);const ws=String(s).split(/\s+/),ls=[];let l='';for(const x of ws){const t=l?l+' '+x:x;if(cx.measureText(t).width>w&&l){ls.push(l);l=x}else l=t}if(l)ls.push(l);return ls}
 const need=h=>{if(y+h>H-80)np()};
 function sec(a,e){need(36);cx.fillStyle='#0a1a33';cx.fillRect(M,y,W-2*M,26);T(a,W-M-8,y+5,{b:1,s:14,c:'#19e6ff',dir:'rtl'});T(e,M+8,y+6,{b:1,s:12,c:'#2dff9a',dir:'ltr'});y+=30}
 function row(a,e,v,col){const ls=wrap(v||'—',330,{s:13}),h=Math.max(24,ls.length*18+8);need(h);cx.fillStyle=(ri++%2)?'#f2f7fb':'#fff';cx.fillRect(M,y,W-2*M,h);
  T(a,W-M-6,y+5,{b:1,s:12,dir:'rtl',c:'#0a2a44'});T(e,M+6,y+5,{s:11,c:'#5a6f80',dir:'ltr'});ls.forEach((l,i)=>T(l,W/2,y+5+i*18,{a:'center',c:col||'#111'}));y+=h}
 function line(s,o={}){const ls=wrap(s,W-2*M,o);ls.forEach(l=>{need(18);T(l,o.dir==='ltr'?M:W-M,y,o);y+=18})}
 np();
 if(logo)cx.drawImage(logo,W-M-70,y,70,70);
 T('تقرير مناوبة حارس',W-M-82,y+4,{b:1,s:24,c:'#0a1a33',dir:'rtl'});T('Guard Shift Report',W-M-82,y+36,{s:15,c:'#335',dir:'ltr',a:'right'});
 T(rep.no,M,y+4,{b:1,s:15,dir:'ltr',c:'#0a2a44'});T(g.date,M,y+28,{s:13,dir:'ltr',c:'#555'});y+=84;
 const lvE=(E.review&&E.review.level)||g.level;cx.fillStyle=LV[lvE][2];cx.fillRect(M,y,W-2*M,6);y+=14;
 sec('ملخص المناوبة','Shift Summary');
 row('الحارس','Guard',g.guardName);row('الموقع','Post',post.ar+' / '+post.en);row('الشفت','Shift',sh.ar+' / '+sh.en);row('التاريخ','Date',g.date);row('الوقت','Time',fmtT(g.start)+' - '+fmtT(g.end));
 row('الجولات','Rounds',g.rounds.length+' / '+g.expected);row('الجولات المتأخرة','Late rounds',String(g.rounds.filter(x=>x.late).length));
 const ni=g.rounds.filter(x=>x.net&&x.net.avail&&x.net.q!=='slow').length;row('جودة الإنترنت','Good internet',ni+' / '+g.rounds.length);
 row('الحوادث','Incidents',String(g.incidents.length));row('الحالة العامة','Overall status',LV[lvE][0]+' / '+LV[lvE][1],LV[lvE][2]);
 y+=8;sec('جولات التفقد','Check Rounds');
 const cols=[['#','#',40],['الوقت · Time','',100],['الحالة · Status','',110],['التحقق · Verify','',100],['الإنترنت · Internet','',200],['الموقع · GPS','',164]];
 const trow=(vals,hd)=>{need(24);if(hd){cx.fillStyle='#e6eef5';cx.fillRect(M,y,W-2*M,22)}let x=W-M;vals.forEach((v,i)=>{const w=cols[i][2];T(v,x-w/2,y+4,{a:'center',s:11,b:hd,dir:'ltr',c:'#111'});x-=w});cx.strokeStyle='#d5dee6';cx.beginPath();cx.moveTo(M,y+22);cx.lineTo(W-M,y+22);cx.stroke();y+=22};
 trow(cols.map(c=>c[0]),1);
 g.rounds.forEach((r,i)=>trow([String(i+1),fmtT(r.t),r.late?'متأخرة · Late':'بالوقت · On time',r.method==='scan'?'QR':'يدوي · Manual',r.net&&r.net.avail?NETQ[r.net.q][0]+' · '+NETQ[r.net.q][1]+(r.net.mbps?' (~'+r.net.mbps+' Mbps)':''):'غير متوفر · None',r.gps?r.gps.lat+','+r.gps.lon:'—']));
 if(!g.rounds.length)line('لا توجد جولات مسجلة · No rounds recorded',{s:12,c:'#a00'});
 y+=10;sec('الحوادث','Incidents');
 if(!g.incidents.length)line('لا حوادث · No incidents',{s:12});
 g.incidents.forEach((x,i)=>row('حادث '+(i+1),'Incident '+(i+1),fmtT(x.t)+' · '+x.ar+' / '+x.en+' · '+(x.lv==='r'?'🔴 عالية/High':'متوسطة/Medium')+(x.details?' — '+x.details:''),x.lv==='r'?'#c0182a':'#111'));
 y+=10;sec('مساعدة الموظفين','Staff Assistance');
 row('هل قُدّمت مساعدة؟','Assistance given?',g.assist.yes?'نعم / Yes':'لا / No');
 if(g.assist.yes){row('نوع المساعدة','Type',g.assist.type);if(g.assist.who)row('الموظف / القسم','Staff / Dept',g.assist.who);if(g.assist.details)row('التفاصيل','Details',g.assist.details)}
 y+=4;line('Staff assistance: '+(g.assist.yes?'Yes — '+g.assist.type+(g.assist.details?' — '+g.assist.details:''):'No'),{dir:'ltr',b:1,s:12,c:'#0a2a44'});
 y+=8;sec('التسليم والملاحظات','Handover & Notes');row('تسليم الشفت','Shift handover',g.handover);row('ملاحظات','Notes',g.notes);
 if(E.review){y+=8;sec('مراجعة قائد الشفت','Shift Leader Review');row('النتيجة','Result',RES[E.review.result][0]+' / '+RES[E.review.result][1]);row('المستوى','Level',LV[E.review.level][0]+' / '+LV[E.review.level][1],LV[E.review.level][2]);row('الملاحظات','Remarks',E.review.remarks);row('الإجراء','Action',E.review.action);row('بواسطة','By',E.review.by)}
 const vis=(rep.amends||[]).filter(a=>!a.hidden);
 if(vis.length){y+=8;sec('تعديلات المشرف','Supervisor Amendments');vis.forEach(a=>row(a.lbl,'Amended',showVal(a.k,a.old)+'  ←  '+showVal(a.k,a.nv)+' | السبب: '+a.reason+' | '+a.by+' '+fmtD(a.t)+' '+fmtT(a.t)))}
 if(rep.supNote){y+=8;sec('ملاحظة المشرف','Supervisor Note');row('الملاحظة','Note',rep.supNote)}
 y+=8;sec('مسار التقرير والختم','Trail & Seal');rep.trail.forEach(t=>line(`${fmtD(t.t)} ${fmtT(t.t)} — ${t.n}: ${t.a}`,{s:11,c:'#444'}));
 line('Seal (SHA-256): '+rep.seal.slice(0,40)+'…',{dir:'ltr',s:10,c:'#666'});line('النصوص الحرة تظهر كما أدخلها كاتبها دون ترجمة · Free text is shown as entered',{s:10,c:'#777'});
 pages.forEach((c,i)=>{cx=c.getContext('2d');cx.fillStyle='#0a1a33';cx.fillRect(M,H-62,W-2*M,1);
  T('هذه الأداة صممت لقسم الأمن SOS — تصميم Ahmed Abu Jami',W/2,H-56,{a:'center',s:11,c:'#335',dir:'rtl'});T("saftey and security officer - SOS children's villages",W/2,H-40,{a:'center',s:10,c:'#335',dir:'ltr'});T(`${rep.no} · ${i+1}/${pages.length}`,W/2,H-24,{a:'center',s:10,c:'#777',dir:'ltr'})});
 const jp=pages.map(c=>{const b=atob(c.toDataURL('image/jpeg',.85).split(',')[1]),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return{bytes:u,w:c.width,h:c.height}});
 return buildPDF(jp)}
function buildPDF(jp){const enc=new TextEncoder(),parts=[],offs=[];let len=0;const push=d=>{const b=typeof d==='string'?enc.encode(d):d;parts.push(b);len+=b.length};
 push('%PDF-1.4\n');const n=jp.length,kids=jp.map((_,i)=>`${3+i*3} 0 R`).join(' ');
 offs[1]=len;push('1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n');offs[2]=len;push(`2 0 obj<</Type/Pages/Kids[${kids}]/Count ${n}>>endobj\n`);
 jp.forEach((j,i)=>{const p=3+i*3,c=p+1,im=p+2,cs='q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
  offs[p]=len;push(`${p} 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 841.89]/Resources<</XObject<</Im0 ${im} 0 R>>>>/Contents ${c} 0 R>>endobj\n`);
  offs[c]=len;push(`${c} 0 obj<</Length ${cs.length}>>stream\n${cs}\nendstream endobj\n`);
  offs[im]=len;push(`${im} 0 obj<</Type/XObject/Subtype/Image/Width ${j.w}/Height ${j.h}/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ${j.bytes.length}>>stream\n`);push(j.bytes);push('\nendstream endobj\n')});
 const total=2+n*3,xr=len;let x=`xref\n0 ${total+1}\n0000000000 65535 f \n`;for(let i=1;i<=total;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
 push(x);push(`trailer<</Size ${total+1}/Root 1 0 R>>\nstartxref\n${xr}\n%%EOF`);return new Blob(parts,{type:'application/pdf'})}

init();
