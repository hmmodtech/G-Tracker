/* sync.js — المرحلة 4.3: الربط مع Google، التنبيهات، SOS، الإحصائيات */
(function(){
const url=()=>(S.cfg&&S.cfg.sync&&S.cfg.sync.url)||'';
const getQ=async()=>(await dbGet('outbox'))||[];
let busy=false;

async function enqueue(item){
 let q=await getQ();
 item.id=Date.now()+'-'+Math.random().toString(36).slice(2,6);
 if(item.a==='rep')q=q.filter(x=>!(x.a==='rep'&&x.r.no===item.r.no));
 if(item.a==='contacts')q=q.filter(x=>x.a!=='contacts');
 q.push(item);await dbSet('outbox',q);flush();
}
async function flush(){
 if(busy||!navigator.onLine||!S.cfg||!url())return;busy=true;
 try{
  const q=await getQ();let i=0;
  for(;i<q.length;i++){
   try{
    const r=await fetch(url(),{method:'POST',redirect:'follow',body:JSON.stringify(Object.assign({orgKey:S.cfg.orgKey},q[i]))});
    const j=await r.json();
    if(!j.ok){if(j.err==='auth'){toast('⛔ مفتاح المؤسسة لا يطابق السكربت',4500);break}if(j.err==='admin')toast('⛔ كلمة الإدارة لا تطابق السكربت',4500)}
   }catch(e){break}
  }
  const sent=new Set(q.slice(0,i).map(x=>x.id));
  const cur=await getQ();await dbSet('outbox',cur.filter(x=>!sent.has(x.id)));
 }finally{busy=false}
}
const alertO=(type,text)=>enqueue({a:'alert',type,text:text+'\n— '+(S.me?S.me.name:'')+' · '+fmtD(Date.now())+' '+fmtT(Date.now())});
const pushContacts=async()=>enqueue({a:'contacts',email:S.cfg.officer.email||'',tg:S.cfg.officer.tg||'',adminKey:(await dbGet('adminKey'))||''});

function repRow(rep){
 const E=eff(rep),g=E.g;
 return{no:rep.no,guard:g.guardName,post:postOf(g.post).en,shift:shOf(g.sh).en,date:g.date,start:fmtT(g.start),end:fmtT(g.end),
  level:(E.review&&E.review.level)||g.level,rounds:g.rounds.length,expected:g.expected,late:g.rounds.filter(x=>x.late).length,
  incidents:g.incidents.length,red:g.incidents.filter(x=>x.lv==='r').length,
  assist:g.assist.yes?('Yes — '+g.assist.type+(g.assist.details?' — '+g.assist.details:'')):'No',
  netGood:g.rounds.filter(x=>x.net&&x.net.avail&&x.net.q!=='slow').length+'/'+g.rounds.length,
  stage:rep.stage,rank:rank(rep.stage),review:E.review?E.review.result:'',amends:(rep.amends||[]).filter(a=>!a.hidden).length};
}
const repPush=async no=>{const r=await dbGet('r:'+no);if(r)enqueue({a:'rep',r:repRow(r)})};

function hook(name,pre,post){
 const o=ACT[name];if(!o)return;
 ACT[name]=async function(el,ev){let ctx=null;try{ctx=pre?await pre():null}catch(e){}await o(el,ev);if(post)try{await post(ctx)}catch(e){}};
}
const curNo=()=>S.cur&&S.cur.no;
hook('finish',()=>S.shift&&S.shift.no,no=>no&&repPush(no));
['sendNext','saveReview','receive'].forEach(n=>hook(n,curNo,no=>no&&repPush(no)));

/* تعديل المشرف يصل للأوفيسر — تعديل الأوفيسر نفسه صامت */
hook('amend',()=>({no:S.cur.no,n:S.cur.amends.length,role:S.me.role}),async c=>{
 const r=await dbGet('r:'+c.no);if(!r||r.amends.length<=c.n)return;repPush(c.no);
 if(c.role!=='officer'){const a=r.amends[r.amends.length-1];alertO('تعديل على تقرير',`${c.no}\n${a.lbl}\nالقديم: ${showVal(a.k,a.old)}\nالجديد: ${showVal(a.k,a.nv)}\nالسبب: ${a.reason}`)}
});
/* حادث أحمر */
hook('saveInc',()=>({n:S.shift.incidents.length,lv:$('#il').value}),c=>{
 if(S.shift&&S.shift.incidents.length>c.n&&c.lv==='r'){const x=S.shift.incidents[S.shift.incidents.length-1];
  alertO('🔴 حادث',`الحارس: ${S.shift.guardName}\nالموقع: ${postOf(S.shift.post).ar}\nالحادث: ${x.ar} / ${x.en}\nالوقت: ${fmtT(x.t)}\n${x.details||''}`)}
});
/* تغييرات الحسابات والإعدادات */
function diffUsers(a,b){const o=[],m=new Map(a.map(u=>[u.id,u]));
 b.forEach(u=>{const x=m.get(u.id);if(!x){o.push('إضافة مستخدم: '+u.name);return}
  ['name','role','shift','post'].forEach(k=>{if(x[k]!==u[k])o.push(`${x.name}: ${k} ${x[k]||'-'} ← ${u[k]||'-'}`)});
  if(x.pin!==u.pin)o.push(x.name+': تغيير PIN')});return o}
['saveUsers','addUser'].forEach(n=>hook(n,()=>({role:S.me.role,before:clone(S.users)}),c=>{
 if(c.role==='officer')return;const d=diffUsers(c.before,S.users);if(d.length)alertO('تغيير في الحسابات',d.join('\n'))}));
hook('saveCfg',null,()=>{if(S.me.role==='officer')pushContacts()});
const _it=importTeam;importTeam=async function(f){const role=S.me&&S.me.role;await _it(f);if(role&&role!=='officer')alertO('استيراد إعدادات الفريق','تم استيراد ملف إعدادات على هذا الجهاز')};
const _rs=restore;restore=async function(f){const role=S.me&&S.me.role;await _rs(f);if(role&&role!=='officer')alertO('استعادة نسخة احتياطية','تمت استعادة نسخة على هذا الجهاز')};

/* بطاقة الربط في الإعدادات (للأوفيسر) */
const _vSet=vSet;
vSet=async function(){
 await _vSet();
 if(S.me.role!=='officer'||S.screen!=='set')return;
 const k=(await dbGet('adminKey'))||'',n=(await getQ()).length;
 $('#view').insertAdjacentHTML('beforeend',`<div class="card"><h3>🔗 الربط والتنبيهات (Google)</h3>
 <div class="mut">الرابط يصل للجوالات الأخرى عبر «تصدير إعدادات الفريق». كلمة الإدارة تبقى على جوالك فقط.</div>
 <label>رابط السكربت (ينتهي بـ /exec)</label><input id="sy_u" dir="ltr" value="${esc(url())}">
 <label>كلمة الإدارة (ADMIN_KEY نفسها في السكربت)</label><input id="sy_k" type="password" value="${esc(k)}">
 <div class="mut">الإيميل وتلجرام وواتساب تعدّلها في «قنوات الأوفيسر» أعلاه ثم «حفظ الإعدادات».</div>
 <button class="btn pri" data-act="saveSync">حفظ الربط وإرسال القنوات</button><button class="btn" data-act="testSync">اختبار التنبيه</button>
 <div class="mut">رسائل بانتظار الإرسال: ${n}</div></div>`);
};
ACT.settings=vSet;
ACT.saveSync=async()=>{S.cfg.sync={url:$('#sy_u').value.trim()};await dbSet('cfg',S.cfg);await dbSet('adminKey',$('#sy_k').value);await pushContacts();toast('تم الحفظ ✔');vSet()};
ACT.testSync=async()=>{if(!url())return toast('ضع رابط السكربت أولاً');
 try{const r=await fetch(url());const j=await r.json();toast(j.ok?'السكربت يعمل ✔ — أُرسل تنبيه تجريبي':'السكربت لا يستجيب')}catch(e){toast('تعذّر الوصول للسكربت — تحقق من الرابط والإنترنت')}
 alertO('اختبار','تنبيه تجريبي من التطبيق')};

/* زر SOS (ضغطة مطوّلة) */
const _va=vActive;
vActive=function(){_va();
 $('#view').insertAdjacentHTML('beforeend','<div class="card" id="sosb"><button class="btn red big" id="sos" style="touch-action:none;-webkit-user-select:none;user-select:none">🆘 طوارئ — اضغط مطولاً</button></div>');
 const b=$('#sos');let t;
 const go=async()=>{if(navigator.vibrate)navigator.vibrate(400);b.textContent='جارٍ تحديد الموقع...';
  const p=await gps(),s=S.shift,loc=p?`https://maps.google.com/?q=${p.lat},${p.lon}`:'الموقع غير متوفر';
  const txt=`🆘 طوارئ SOS\nالحارس: ${s.guardName}\nالموقع: ${postOf(s.post).ar}\nالوقت: ${fmtT(Date.now())}\n${loc}`;
  alertO('🆘 SOS',txt);
  $('#sosb').innerHTML=`<div class="ok">تم إرسال التنبيه (أو وُضع في الطابور حتى يتوفر إنترنت)</div><a class="btn red" target="_blank" href="https://wa.me/${S.cfg.officer.wa}?text=${encodeURIComponent(txt)}">فتح واتساب وإرسال</a>`};
 b.addEventListener('pointerdown',e=>{e.preventDefault();clearTimeout(t);t=setTimeout(go,1200);b.textContent='استمر بالضغط...'});
 ['pointerup','pointerleave','pointercancel'].forEach(x=>b.addEventListener(x,()=>{clearTimeout(t);if(b.isConnected&&b.id==='sos')b.textContent='🆘 طوارئ — اضغط مطولاً'}));
 b.addEventListener('contextmenu',e=>e.preventDefault());
};

/* شاشة الإحصائيات */
const _vl=vList;
vList=async function(){await _vl();if(S.screen==='list')$('#view').insertAdjacentHTML('beforeend','<button class="btn" data-act="stats">📊 لوحة الإحصائيات</button>')};
ACT.stats=()=>{S.screen='stats';renderStats()};
ACT.statsGo=()=>{S.sf={from:$('#sf').value,to:$('#st').value,g:$('#sg').value};renderStats()};
async function renderStats(){
 const sf=S.sf||(S.sf={from:'',to:'',g:''});let reps=await allReps();
 if(S.me.role==='leader')reps=reps.filter(r=>r.g.sh===S.me.shift);
 reps=reps.filter(r=>(!sf.from||r.g.date>=sf.from)&&(!sf.to||r.g.date<=sf.to)&&(!sf.g||r.g.guardId===sf.g));
 const by={},st={},inc={},as={},net={slow:0,good:0,excellent:0,none:0},old=[];let tr=0,te=0,tl=0,red=0,yel=0;
 reps.forEach(r=>{const E=eff(r),g=E.g,o=by[g.guardName]||(by[g.guardName]={n:0,r:0,e:0,l:0,i:0});
  o.n++;o.r+=g.rounds.length;o.e+=g.expected;o.l+=g.rounds.filter(x=>x.late).length;o.i+=g.incidents.length;
  tr+=g.rounds.length;te+=g.expected;tl+=g.rounds.filter(x=>x.late).length;st[r.stage]=(st[r.stage]||0)+1;
  g.incidents.forEach(x=>inc[x.ar]=(inc[x.ar]||0)+1);
  const lv=(E.review&&E.review.level)||g.level;if(lv==='r')red++;else if(lv==='y')yel++;
  if(g.assist.yes)as[g.assist.type]=(as[g.assist.type]||0)+1;
  g.rounds.forEach(x=>net[x.net&&x.net.avail?x.net.q:'none']++);
  const last=r.trail[r.trail.length-1];if(['sent_leader','at_leader','reviewed','sent_sup','at_sup'].includes(r.stage)&&Date.now()-last.t>12*3600000)old.push(r)});
 const pct=(a,b)=>b?Math.round(a*100/b):0,bar=p=>`<div class="bar"><i style="width:${p}%"></i></div>`;
 const list=o=>Object.keys(o).map(k=>`<div class="kv"><span>${esc(k)}</span><b>${o[k]}</b></div>`).join('')||'<div class="mut">لا شيء</div>';
 V(`<button class="btn sm" data-act="home">← رجوع</button><div class="card"><h2>📊 الإحصائيات</h2>
 <div class="row2"><input type="date" id="sf" value="${sf.from}"><input type="date" id="st" value="${sf.to}"></div>
 <select id="sg"><option value="">كل الحراس</option>${S.users.filter(u=>u.role==='guard').map(u=>`<option value="${u.id}" ${sf.g===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}</select>
 <button class="btn pri" data-act="statsGo">تطبيق</button></div>
 <div class="card hud"><div class="mut">الالتزام الكلي بالجولات</div><div class="timer" style="font-size:44px">${pct(tr,te)}%</div>${bar(pct(tr,te))}<div class="mut">${reps.length} تقرير · جولات متأخرة ${tl} · 🟡 ${yel} · 🔴 ${red}</div></div>
 <div class="card"><h3>التقارير حسب المرحلة</h3>${Object.keys(st).map(k=>`<div class="kv"><span>${STAGE[k][0]}</span><b>${st[k]}</b></div>`).join('')||'<div class="mut">لا شيء</div>'}</div>
 ${old.length?`<div class="card"><h3 style="color:#ff4d5e">⏰ تقارير متأخرة (أكثر من 12 ساعة)</h3>${old.map(r=>`<div class="kv"><span>${r.no}</span><b>${STAGE[r.stage][0]}</b></div>`).join('')}</div>`:''}
 <div class="card"><h3>الحراس</h3>${Object.keys(by).map(k=>{const o=by[k],p=pct(o.r,o.e);return `<div>${esc(k)} — ${p}% <span class="mut">(${o.n} شفت · متأخرة ${o.l} · حوادث ${o.i})</span>${bar(p)}</div>`}).join('')||'<div class="mut">لا شيء</div>'}</div>
 <div class="card"><h3>الحوادث حسب النوع</h3>${list(inc)}</div>
 <div class="card"><h3>مساعدة الموظفين</h3>${list(as)}</div>
 <div class="card"><h3>جودة الإنترنت في الجولات</h3><div class="kv"><span>ممتاز</span><b>${net.excellent}</b></div><div class="kv"><span>جيد</span><b>${net.good}</b></div><div class="kv"><span>بطيء</span><b>${net.slow}</b></div><div class="kv"><span>غير متوفر</span><b>${net.none}</b></div></div>`);
}

/* تصعيد الجولة المتأخرة + إعادة إرسال الطابور */
setInterval(async()=>{flush();const s=S.shift;
 if(s&&S.me&&S.me.role==='guard'&&Date.now()>s.nextDue+15*60000&&s.escFor!==s.nextDue){s.escFor=s.nextDue;await dbSet('shift:'+S.me.id,s);
  alertO('⏰ جولة متأخرة',`الحارس ${s.guardName} — ${postOf(s.post).ar}\nموعد الجولة كان ${fmtT(s.nextDue)} وتأخرت أكثر من 15 دقيقة`)}},30000);
addEventListener('online',flush);setTimeout(flush,4000);
})();
