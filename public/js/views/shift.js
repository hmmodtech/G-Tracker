/* شاشات المناوبة — مستوحاة من SOS Guard ومربوطة بنظام الصلاحيات */
import { api } from '../api.js';
import { shell, toast, esc, go, state, timeAgo } from '../app.js';

/* بنود قائمة الفحص (من SOS Guard) */
export const ITEMS = [
  { k: 'gates', ar: 'البوابات والأسوار', en: 'Gates & Perimeter', q: 'هل جميع البوابات مغلقة ومؤمنة والأسوار سليمة؟', ok: 'سليم', bad: 'يوجد خلل' },
  { k: 'light', ar: 'الإضاءة', en: 'Lighting', q: 'هل الإنارة تعمل بشكل طبيعي في كافة النقاط الحيوية؟', ok: 'تعمل', bad: 'يوجد خلل' },
  { k: 'safety', ar: 'معدات السلامة والطوارئ', en: 'Fire & Safety Equipment', q: 'هل طفايات الحريق وصندوق الإسعافات في مكانها وصالحة؟', ok: 'سليمة', bad: 'يوجد خلل' },
  { k: 'access', ar: 'سجل الزوار والمركبات', en: 'Visitors & Vehicles Log', q: 'هل تم تسجيل كل الزوار والمركبات في السجل؟', ok: 'تم التسجيل', bad: 'لم يتم / خلل' }
];
export const POW = [
  ['grid', 'كهرباء عامة'], ['gen', 'مولد'], ['solar', 'طاقة شمسية'], ['none', 'لا توجد كهرباء']
];
export const TYPES = [
  ['power', 'انقطاع كهرباء'], ['fence', 'اقتراب أشخاص من السور'], ['gate', 'عطل في البوابة'],
  ['intrude', 'محاولة دخول غير مصرح'], ['theft', 'سرقة / اختراق'], ['fire', 'حريق / دخان'],
  ['shell', 'قصف / إطلاق نار قريب'], ['injury', 'إصابة / حالة طبية'], ['light', 'عطل في الإنارة'],
  ['susp', 'جسم أو مركبة مشبوهة'], ['other', 'أخرى']
];

const pad = n => String(n).padStart(2, '0');
const fmtT = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const hms = ms => { const s = Math.floor(Math.abs(ms) / 1000); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s % 3600 / 60)) + ':' + pad(s % 60); };

function chips(id, options, sel) {
  return '<div class="chips" id="' + id + '">' + options.map(x =>
    `<button type="button" class="chip ${x.v === sel ? 'on' : ''}" data-v="${esc(x.v)}" onclick="window.__pick(this)">${esc(x.t)}</button>`
  ).join('') + '</div>';
}
window.__pick = (el) => {
  el.parentNode.querySelectorAll('.chip').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
};
const chipVal = (id) => document.querySelector('#' + id + ' .chip.on')?.dataset.v || '';

function getGps() {
  return new Promise(r => {
    if (!navigator.geolocation) return r(null);
    navigator.geolocation.getCurrentPosition(
      p => r({ lat: +p.coords.latitude.toFixed(6), lon: +p.coords.longitude.toFixed(6), acc: Math.round(p.coords.accuracy) }),
      () => r(null), { enableHighAccuracy: true, timeout: 7000, maximumAge: 120000 });
  });
}

function photo(cb) {
  const i = document.createElement('input');
  i.type = 'file'; i.accept = 'image/*'; i.capture = 'environment';
  i.onchange = () => {
    const f = i.files[0]; if (!f) return;
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 900 / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = im.width * k; c.height = im.height * k;
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', .6));
      URL.revokeObjectURL(im.src);
    };
    im.src = URL.createObjectURL(f);
  };
  i.click();
}
window.__photo = photo;

function beep() {
  if (!state.settings?.sound) return;
  try {
    const AC = window.__ac = window.__ac || new (window.AudioContext || window.webkitAudioContext)();
    AC.resume && AC.resume();
    [0, .3, .6].forEach(t => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(.25, AC.currentTime + t);
      g.gain.exponentialRampToValueAtTime(.001, AC.currentTime + t + .22);
      o.start(AC.currentTime + t); o.stop(AC.currentTime + t + .25);
    });
  } catch (e) {}
}

/* ============ بدء المناوبة ============ */
export async function renderShiftStart() {
  const { settings } = await api.settings();
  state.settings = settings;
  const points = settings.points || [];
  const shifts = settings.shifts || {};
  const curKey = curShiftKey(settings);

  if (!points.length) {
    return renderShellInner('بدء المناوبة', `
      <div class="card"><div class="empty">لا توجد نقاط حراسة — يرجى إضافتها من الإعدادات (الأوفيسر)</div></div>`,
      '<button class="btn btn-ghost" onclick="location.hash=\'#/dashboard\'">رجوع</button>');
  }

  renderShellInner('بدء المناوبة', `
    <div class="card" style="max-width:620px">
      <h3>▶️ بدء المناوبة</h3>
      <div class="field"><label>نقطة الحراسة</label>
        ${chips('cp', points.map(p => ({ v: p.id, t: '📍 ' + p.ar })), points[0].id)}
      </div>
      <div class="field"><label>المناوبة</label>
        ${chips('cs', Object.entries(shifts).map(([k, s]) => ({ v: k, t: `${s.ar} (${s.start}–${s.end})` })), curKey)}
      </div>
      <p style="color:var(--muted);font-size:13px">جولة الفحص كل ${settings.roundInterval || 120} دقيقة — سيتم تذكيرك داخل التطبيق.</p>
      <button class="btn btn-amber" style="width:100%;margin-top:10px" id="btn-start">▶️ بدء المناوبة</button>
      <button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="location.hash='#/dashboard'">إلغاء</button>
    </div>`);

  document.getElementById('btn-start').onclick = async () => {
    try {
      const { report } = await api.startShift(chipVal('cp'), chipVal('cs'));
      toast('بدأت المناوبة ✅', 'ok');
      go('#/shift/' + report.id);
    } catch (e) { toast(e.message, 'err'); }
  };
}

function curShiftKey(settings) {
  const d = new Date(), m = d.getHours() * 60 + d.getMinutes();
  const f = s => { const a = s.split(':'); return +a[0] * 60 + +a[1]; };
  for (const [k, s] of Object.entries(settings.shifts || {})) {
    const a = f(s.start), b = f(s.end);
    if (a < b ? (m >= a && m < b) : (m >= a || m < b)) return k;
  }
  return 'M';
}

/* ============ لوحة المناوبة ============ */
let tickTimer = null;
export async function renderShiftDash(reportId) {
  clearInterval(tickTimer);
  const { report } = await api.report(reportId);
  const r = report;
  if (r.formData.phase !== 'active') return go('#/reports/detail/' + reportId);
  const fd = r.formData;
  const settings = state.settings || (await api.settings()).settings;
  state.settings = settings;
  const iv = (settings.roundInterval || 120) * 60000;
  const pt = (settings.points || []).find(p => p.id === fd.pointId) || { ar: fd.location };
  const sh = (settings.shifts || {})[fd.shiftKey] || { ar: fd.shift };
  const red = fd.incidents.filter(i => i.level === 'r').length;
  const yel = fd.incidents.length - red;

  const ev = fd.rounds.map((round, i) => ({
    ts: round.ts,
    h: `جولة #${i + 1} — ${badCount(round) ? `⚠️ ${badCount(round)} خلل` : '✅ سليمة'}${Object.values(round.qr || {}).some(q => q.mode !== 'qr') ? ' · يدوي' : ' · QR'}`
  })).concat(fd.incidents.map(i => ({
    ts: i.ts,
    h: `${i.level === 'r' ? '🔴' : '🟡'} ${TYPES.find(t => t[0] === i.type)?.[1] || i.type}`
  }))).sort((a, b) => b.ts - a.ts);

  renderShellInner('المناوبة — نشطة', `
    <div class="tags" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <span class="chip">👤 ${esc(r.authorName || state.user.name)}</span>
      <span class="chip">📍 ${esc(pt.ar)}</span>
      <span class="chip">${esc(sh.ar)}</span>
      <span class="chip with_guard">🟢 مناوبة نشطة</span>
    </div>

    <div class="stats-grid">
      <div class="stat amber" style="grid-column:1/-1;text-align:center">
        <div class="num mono" id="cd" style="font-size:34px">--:--:--</div>
        <div class="lbl" id="cdl">الجولة القادمة</div>
        <div class="bar-track" style="margin-top:10px;background:#e2e8f0"><div class="bar-fill amber" id="pb" style="width:0%"></div></div>
      </div>
      <div class="stat"><div class="num" id="rc">${fd.rounds.length}</div><div class="lbl">الجولات المنفذة</div></div>
      <div class="stat purple"><div class="num">🟡${yel} 🔴${red}</div><div class="lbl">الأحداث</div></div>
    </div>

    <button class="btn btn-amber" style="width:100%;margin-bottom:10px" onclick="location.hash='#/shift/${r.id}/round'">🔄 بدء جولة فحص</button>
    <button class="btn btn-danger" style="width:100%;margin-bottom:10px;border:1px solid #fecaca" onclick="location.hash='#/shift/${r.id}/incident'">🚨 تسجيل حدث / حادث</button>

    <div class="card">
      <h3>📋 سجل المناوبة</h3>
      ${ev.length ? ev.map(e => `<div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px dashed var(--line);font-size:14px">
        <b style="color:var(--blue)" class="mono">${fmtT(e.ts)}</b><span>${e.h}</span></div>`).join('')
      : '<div class="empty" style="padding:16px">لا توجد أحداث بعد</div>'}
    </div>

    <button class="btn btn-primary" style="width:100%" onclick="location.hash='#/shift/${r.id}/end'">🏁 إنهاء المناوبة وإنشاء التقرير</button>
  `, 'المناوبة');

  // عدّاد تنازلي
  const startTs = fd.startTs || Date.now();
  const tick = () => {
    const now = Date.now();
    const last = fd.rounds.length ? fd.rounds[fd.rounds.length - 1].ts : startTs;
    const due = last + iv, rem = due - now;
    const cd = document.getElementById('cd');
    if (!cd) { clearInterval(tickTimer); return; }
    cd.textContent = (rem < 0 ? '+' : '') + hms(rem);
    cd.style.color = rem < 0 ? 'var(--red)' : 'var(--amber-dark)';
    const pb = document.getElementById('pb');
    if (pb) pb.style.width = Math.min(100, Math.max(0, ((now - last) / iv) * 100)) + '%';
    const cdl = document.getElementById('cdl');
    if (cdl) cdl.textContent = rem < 0 ? '⚠️ الجولة متأخرة — ابدأ الجولة الآن' : 'موعد الجولة القادمة ' + fmtT(due);
    if (rem <= 0 && (!window.__lastAlarm || now - window.__lastAlarm > 600000)) {
      window.__lastAlarm = now;
      beep();
      if (navigator.vibrate) navigator.vibrate([400, 150, 400]);
      toast('⏰ حان موعد جولة الفحص', 'err');
    }
  };
  tick();
  tickTimer = setInterval(tick, 1000);
}

function badCount(round) {
  let n = 0;
  ITEMS.forEach(it => { const d = (round.items || {})[it.k]; if (d && d.ok === false) n++; });
  if (round.power === 'none') n++;
  return n;
}

/* ============ جولة الفحص ============ */
let RD = null;
export async function renderRound(reportId) {
  clearInterval(tickTimer);
  const { report } = await api.report(reportId);
  if (report.formData.phase !== 'active') return go('#/reports/detail/' + reportId);
  const settings = state.settings || (await api.settings()).settings;
  const points = (settings.points || []).filter(p => p.inRound || p.id === report.formData.pointId);
  RD = { qr: {}, items: {}, power: '', internet_connection: '', internet_speed: '', visitors: 0, vehicles: 0, photo: null };

  const itemHTML = (it) => {
    const d = RD.items[it.k] || {};
    return `<div class="card" id="it_${it.k}" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:baseline"><b>${it.ar}</b><small style="color:var(--muted)">${it.en}</small></div>
      <p style="margin:8px 0;font-size:14px">${it.q}</p>
      <div class="field-row" style="gap:8px">
        <button type="button" class="btn ${d.ok === true ? 'btn-amber' : 'btn-ghost'} btn-sm" style="width:100%" onclick="window.__setItem('${it.k}',true)">✅ ${it.ok}</button>
        <button type="button" class="btn ${d.ok === false ? 'btn-danger' : 'btn-ghost'} btn-sm" style="width:100%" onclick="window.__setItem('${it.k}',false)">⚠️ ${it.bad}</button>
      </div>
      ${d.ok === false ? `
        <div class="field" style="margin-top:10px"><textarea placeholder="اكتب الخلل باختصار (إلزامي)" oninput="RD.items['${it.k}'].note=this.value">${esc(d.note || '')}</textarea></div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="window.__itemPhoto('${it.k}')">${d.photo ? '✔ تم إرفاق صورة — تغيير' : '📷 إرفاق صورة (اختياري)'}</button>` : ''}
    </div>`;
  };

  const qrRows = () => points.map(p => {
    const q = RD.qr[p.id];
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px dashed var(--line)">
      <span>📍 ${esc(p.ar)}</span>
      ${q ? `<b style="color:var(--green)">${q.mode === 'qr' ? '✔ QR' : '✔ يدوي ⚠'}</b>`
        : `<button type="button" class="btn btn-amber btn-sm" onclick="window.__scan('${p.id}')">📷 مسح QR</button>`}
    </div>`;
  }).join('');

  window.__setItem = (k, ok) => {
    RD.items[k] = Object.assign({}, RD.items[k], { ok });
    const el = document.getElementById('it_' + k);
    if (el) el.outerHTML = itemHTML(ITEMS.find(i => i.k === k));
  };
  window.__itemPhoto = (k) => photo(d => {
    RD.items[k] = Object.assign({}, RD.items[k], { photo: d });
    const el = document.getElementById('it_' + k);
    if (el) el.outerHTML = itemHTML(ITEMS.find(i => i.k === k));
  });
  window.__stp = (k, d) => {
    RD[k] = Math.max(0, RD[k] + d);
    document.getElementById('v_' + k).textContent = RD[k];
  };
  const redrawQR = () => { document.getElementById('qrs').innerHTML = qrRows(); };

  window.__scan = async (pid) => {
    const p = points.find(x => x.id === pid);
    const has = 'BarcodeDetector' in window;
    if (!has || !settings.allowManualQR) {
      if (!has) {
        // لا دعم — تأكيد يدوي
        RD.qr[pid] = { mode: 'manual', ts: Date.now() };
        redrawQR();
        toast('تم التأكيد اليدوي', 'ok');
        return;
      }
    }
    // محاولة فتح الكاميرا للمسح
    window.__modal(`<h3>📷 مسح QR — ${esc(p.ar)}</h3>
      <video id="vid" playsinline muted style="width:100%;border-radius:12px;background:#000;max-height:45vh;object-fit:cover"></video>
      <p id="sm" style="color:var(--muted);font-size:13px;margin-top:8px">وجّه الكاميرا نحو رمز QR المثبت عند النقطة</p>
      <div class="field-row" style="gap:10px;margin-top:10px">
        <button class="btn btn-ghost" onclick="window.__stopScan()">إلغاء</button>
        <button class="btn btn-ghost" style="border-color:var(--amber);color:var(--amber-dark)" onclick="window.__manualQR('${pid}')">تأكيد يدوي</button>
      </div>`);
    try {
      const stream = window.__stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      const v = document.getElementById('vid');
      v.srcObject = stream; await v.play();
      const det = new BarcodeDetector({ formats: ['qr_code'] });
      window.__scanning = true;
      const loop = async () => {
        if (!window.__scanning) return;
        try {
          const rs = await det.detect(v);
          for (const b of rs) {
            if (b.rawValue === 'SOSGUARD|' + pid) {
              RD.qr[pid] = { mode: 'qr', ts: Date.now() };
              if (navigator.vibrate) navigator.vibrate(200);
              window.__stopScan(); redrawQR();
              toast('✅ تم التحقق من ' + p.ar, 'ok');
              return;
            } else if (b.rawValue.indexOf('SOSGUARD|') === 0) {
              const sm = document.getElementById('sm');
              if (sm) sm.textContent = '❌ هذا QR لنقطة أخرى';
            }
          }
        } catch (e) {}
        setTimeout(loop, 250);
      };
      loop();
    } catch (e) {
      const sm = document.getElementById('sm');
      if (sm) sm.textContent = 'تعذر فتح الكاميرا — استخدم التأكيد اليدوي';
    }
  };
  window.__stopScan = () => {
    window.__scanning = false;
    if (window.__stream) { window.__stream.getTracks().forEach(t => t.stop()); window.__stream = null; }
    window.__closeModal();
  };
  window.__manualQR = (pid) => {
    window.__stopScan();
    RD.qr[pid] = { mode: 'manual', ts: Date.now() };
    redrawQR();
  };

  renderShellInner('جولة فحص', `
    <div class="card"><h3>1) إثبات التواجد بالنقاط (QR)</h3><div id="qrs">${qrRows()}</div></div>
    <h3 style="margin:14px 0 8px;color:var(--navy-3)">2) قائمة الفحص</h3>
    ${ITEMS.map(itemHTML).join('')}

    <div class="card">
      <h3>3) الكهرباء والاتصال</h3>
      <div class="field"><label>مصدر الطاقة</label>
        ${chips('pw', POW.map(p => ({ v: p[0], t: p[1] })), '')}
      </div>
      <div class="field"><label>هل كان هناك اتصال بالإنترنت؟</label>
        <select id="f-net">
          <option value="">— اختر —</option>
          <option value="yes">نعم</option>
          <option value="no">لا</option>
        </select>
      </div>
      <div class="field" id="net-speed-wrap" style="display:none">
        <label>سرعة الاتصال بالإنترنت</label>
        <select id="f-net-speed">
          <option value="">— اختر —</option>
          <option>ممتاز</option><option>جيد</option><option>ضعيف</option><option>متقطع</option>
        </select>
      </div>
    </div>

    <div class="card">
      <h3>4) منذ آخر جولة</h3>
      <div class="field-row">
        <div><small style="color:var(--muted)">عدد الزوار</small>
          <div style="display:flex;gap:10px;align-items:center;justify-content:center;margin-top:6px">
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.__stp('visitors',-1)">−</button>
            <b id="v_visitors" style="font-size:24px;min-width:40px;text-align:center">0</b>
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.__stp('visitors',1)">+</button>
          </div>
        </div>
        <div><small style="color:var(--muted)">عدد المركبات</small>
          <div style="display:flex;gap:10px;align-items:center;justify-content:center;margin-top:6px">
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.__stp('vehicles',-1)">−</button>
            <b id="v_vehicles" style="font-size:24px;min-width:40px;text-align:center">0</b>
            <button type="button" class="btn btn-ghost btn-sm" onclick="window.__stp('vehicles',1)">+</button>
          </div>
        </div>
      </div>
    </div>

    <button class="btn btn-amber" style="width:100%;margin-top:6px" id="btn-save-round">💾 حفظ الجولة</button>
    <button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="location.hash='#/shift/${reportId}'">إلغاء</button>
  `, 'جولة فحص');

  const net = document.getElementById('f-net');
  net.onchange = () => {
    document.getElementById('net-speed-wrap').style.display = net.value === 'yes' ? '' : 'none';
  };

  document.getElementById('btn-save-round').onclick = async () => {
    for (const it of ITEMS) {
      const d = RD.items[it.k];
      if (!d || d.ok === undefined) return toast('أجب على: ' + it.ar, 'err');
      if (d.ok === false && !(d.note || '').trim()) return toast('اكتب وصف الخلل: ' + it.ar, 'err');
    }
    const pw = chipVal('pw');
    if (!pw) return toast('اختر مصدر الطاقة', 'err');
    const btn = document.getElementById('btn-save-round');
    btn.disabled = true; btn.textContent = '⏳ جاري تحديد الموقع…';
    const gps = await getGps();
    try {
      await api.saveRound(reportId, {
        qr: RD.qr, items: RD.items, power: pw,
        internet_connection: net.value,
        internet_speed: net.value === 'yes' ? document.getElementById('f-net-speed').value : '',
        visitors: RD.visitors, vehicles: RD.vehicles, gps
      });
      toast('✅ تم حفظ الجولة', 'ok');
      go('#/shift/' + reportId);
    } catch (e) {
      toast(e.message, 'err');
      btn.disabled = false; btn.textContent = '💾 حفظ الجولة';
    }
  };
}

/* ============ تسجيل حدث ============ */
export async function renderIncident(reportId) {
  clearInterval(tickTimer);
  const { report } = await api.report(reportId);
  if (report.formData.phase !== 'active') return go('#/reports/detail/' + reportId);
  let photoData = null;

  renderShellInner('تسجيل حدث', `
    <div class="card" style="max-width:640px">
      <h3>🚨 تسجيل حدث</h3>
      <div class="field"><label>مستوى الحدث</label>
        ${chips('lv', [{ v: 'y', t: '🟡 ملاحظة / تنبيه' }, { v: 'r', t: '🔴 حادث أمني / طارئ' }], '')}
      </div>
      <div class="field"><label>نوع الحدث</label>
        ${chips('ty', TYPES.map(t => ({ v: t[0], t: t[1] })), '')}
      </div>
      <div class="field"><label>متى حصل؟</label>
        ${chips('wh', [{ v: '0', t: 'الآن' }, { v: '5', t: 'قبل 5 د' }, { v: '10', t: 'قبل 10 د' }, { v: '30', t: 'قبل 30 د' }, { v: '60', t: 'قبل ساعة' }], '0')}
      </div>
      <div class="field"><label>وصف ما حدث (إلزامي)</label>
        <textarea id="ds" placeholder="اكتب تفاصيل الحدث…"></textarea></div>
      <div class="field"><label>الإجراء الذي اتخذته (إلزامي)</label>
        <textarea id="ac" placeholder="ما الذي فعلته؟"></textarea></div>
      <button type="button" class="btn btn-ghost btn-sm" id="btn-ph" onclick="window.__incPhoto()">📷 إرفاق صورة (اختياري)</button>
      <p style="color:var(--amber-dark);font-size:12.5px;margin-top:8px">⚠️ لا تصوّر الأطفال. صوّر الحدث أو العطل فقط.</p>
      <button class="btn btn-danger" style="width:100%;margin-top:12px;background:linear-gradient(90deg,#b3122b,#ff4d63);color:#fff;border:none" id="btn-save-inc">💾 حفظ الحدث</button>
      <button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="location.hash='#/shift/${reportId}'">إلغاء</button>
    </div>`, 'تسجيل حدث');

  window.__incPhoto = () => photo(d => {
    photoData = d;
    document.getElementById('btn-ph').textContent = '✔ تم إرفاق صورة — تغيير';
  });

  document.getElementById('btn-save-inc').onclick = async () => {
    const level = chipVal('lv'), type = chipVal('ty'), wh = chipVal('wh') || '0';
    const desc = document.getElementById('ds').value.trim();
    const action = document.getElementById('ac').value.trim();
    if (!level) return toast('اختر مستوى الحدث', 'err');
    if (!type) return toast('اختر نوع الحدث', 'err');
    if (!desc) return toast('اكتب وصف ما حدث', 'err');
    if (!action) return toast('اكتب الإجراء المتخذ', 'err');
    try {
      const { alertSent } = await api.saveIncident(reportId, {
        level, type, desc, action, photo: photoData,
        ts: Date.now() - Number(wh) * 60000
      });
      toast('✅ تم حفظ الحدث', 'ok');
      if (level === 'r') {
        const typeName = TYPES.find(t => t[0] === type)?.[1] || type;
        const phone = (state.settings || {}).supPhone || '';
        const txt = `🚨 تنبيه فوري\n👤 ${state.user.name}\n⚠️ ${typeName}\n📝 ${desc}\n✅ ${action}`;
        window.__modal(`<h3 style="color:var(--red)">🔴 تم تسجيل حادث طارئ</h3>
          <p style="font-size:14px;margin:10px 0">أرسل تنبيهاً فورياً للمشرف الآن؟${alertSent ? '<br><small style="color:var(--green)">✓ أُرسل تنبيه داخلي للأوفيسر</small>' : ''}</p>
          ${phone ? `<button class="btn btn-danger" style="width:100%;background:linear-gradient(90deg,#16a34a,#22c55e);border:none" onclick="window.__wa('${esc(phone)}', ${JSON.stringify(encodeURIComponent(txt)).replace(/"/g, '&quot;')})">💬 إرسال لرقم المشرف (واتساب)</button>` : ''}
          <button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="window.__closeModal();location.hash='#/shift/${reportId}'">المتابعة</button>`);
      } else {
        go('#/shift/' + reportId);
      }
    } catch (e) { toast(e.message, 'err'); }
  };
}
window.__wa = (phone, enc) => window.open('https://wa.me/' + phone + '?text=' + enc, '_blank');

/* ============ إنهاء المناوبة ============ */
export async function renderEndShift(reportId) {
  clearInterval(tickTimer);
  const { report } = await api.report(reportId);
  if (report.formData.phase !== 'active') return go('#/reports/detail/' + reportId);
  const fd = report.formData;
  const settings = state.settings || (await api.settings()).settings;
  const iv = settings.roundInterval || 120;
  const exp = fd.startTs ? Math.floor((Date.now() - fd.startTs) / (iv * 60000)) : 0;
  const { guards } = await api.guards().catch(() => ({ guards: [] }));
  const others = guards.filter(g => g.id !== report.authorId);
  const dur = Math.floor((Date.now() - fd.startTs) / 60000);

  renderShellInner('إنهاء المناوبة', `
    <div class="card" style="max-width:660px">
      <h3>🏁 إنهاء المناوبة</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <span class="chip">⏱ ${Math.floor(dur / 60)}س ${dur % 60}د</span>
        <span class="chip">🔄 ${fd.rounds.length} / ${exp} جولة</span>
        <span class="chip">🚨 ${fd.incidents.length} حدث</span>
      </div>

      ${fd.rounds.length < exp ? `
      <div class="field"><label style="color:var(--amber-dark)">⚠️ الجولات المنفذة ${fd.rounds.length} من ${exp} مطلوبة — اذكر السبب (إلزامي)</label>
        <textarea id="miss" placeholder="سبب نقص الجولات…"></textarea></div>` : ''}

      <div class="field"><label>هل جرى تقديم أي مساعدة أمنية أو لوجستية لأحد الموظفين خلال فترة المناوبة؟</label>
        <select name="assistance_provided" id="f-assist">
          <option value="">— اختر —</option><option value="yes">نعم</option><option value="no">لا</option>
        </select></div>
      <div class="field" id="assist-type-wrap" style="display:none">
        <label>نوع المساعدة المقدَّمة</label>
        <textarea id="f-assist-type" placeholder="اكتب نوع المساعدة…"></textarea></div>

      <div class="field-row">
        <div class="field"><label>هل كان هناك اتصال بالإنترنت؟</label>
          <select id="f-net"><option value="">— اختر —</option><option value="yes">نعم</option><option value="no">لا</option></select></div>
        <div class="field" id="net-speed-wrap" style="display:none"><label>سرعة الاتصال</label>
          <select id="f-net-speed"><option value="">— اختر —</option><option>ممتاز</option><option>جيد</option><option>ضعيف</option><option>متقطع</option></select></div>
      </div>

      <div class="field"><label>ملخص الأحداث والملاحظات</label>
        <textarea id="events" placeholder="ما الذي جرى خلال المناوبة…">${esc(fd.events || '')}</textarea></div>

      <div class="card" style="background:#f8fafc;box-shadow:none;padding:14px">
        <h3 style="font-size:14px">🤝 التسليم والاستلام</h3>
        <div class="field"><label>هل تم تسليم العهدة (مفاتيح، أجهزة، سجلات)؟</label>
          ${chips('ho', [{ v: '1', t: '✅ نعم' }, { v: '0', t: '❌ لا' }], '')}
        </div>
        <div class="field" id="rcv-wrap" style="display:none"><label>اسم الحارس المستلم</label>
          <select id="rc2" onchange="document.getElementById('rco').style.display=this.value==='__o'?'block':'none'">
            <option value="">— اختر —</option>
            ${others.map(o => `<option>${esc(o.name)}</option>`).join('')}
            <option value="__o">آخر (اكتب الاسم)</option>
          </select>
          <input id="rco" style="display:none;margin-top:8px" placeholder="اسم المستلم">
        </div>
        <div class="field"><label>ملاحظات ختامية</label>
          <textarea id="fn" placeholder="اختياري…">${esc(fd.finalNote || '')}</textarea></div>
      </div>

      <button class="btn btn-primary" style="width:100%;margin-top:14px" id="btn-end">✅ إنهاء وإنشاء التقرير</button>
      <button class="btn btn-ghost" style="width:100%;margin-top:8px" onclick="location.hash='#/shift/${reportId}'">رجوع</button>
    </div>`, 'إنهاء المناوبة');

  const assist = document.getElementById('f-assist');
  assist.onchange = () => {
    document.getElementById('assist-type-wrap').style.display = assist.value === 'yes' ? '' : 'none';
  };
  const net = document.getElementById('f-net');
  net.onchange = () => {
    document.getElementById('net-speed-wrap').style.display = net.value === 'yes' ? '' : 'none';
  };
  document.querySelector('#ho .chip') && (document.querySelectorAll('#ho .chip').forEach(b => {
    b.addEventListener('click', () => {
      setTimeout(() => {
        document.getElementById('rcv-wrap').style.display = chipVal('ho') === '1' ? '' : 'none';
      }, 0);
    });
  }));

  document.getElementById('btn-end').onclick = async () => {
    const ho = chipVal('ho');
    if (!ho) return toast('حدد هل تم التسليم', 'err');
    let receiver = document.getElementById('rc2').value;
    if (receiver === '__o') receiver = document.getElementById('rco').value.trim();
    if (ho === '1' && !receiver) return toast('اختر اسم الحارس المستلم', 'err');
    const finalNote = document.getElementById('fn').value.trim();
    if (ho === '0' && !finalNote) return toast('اكتب ملاحظات الختام / سبب عدم التسليم', 'err');
    const payload = {
      ho: ho === '1', receiver, finalNote,
      missNote: document.getElementById('miss')?.value.trim() || '',
      events: document.getElementById('events').value.trim(),
      assistance_provided: assist.value,
      assistance_type: assist.value === 'yes' ? document.getElementById('f-assist-type').value.trim() : '',
      internet_connection: net.value,
      internet_speed: net.value === 'yes' ? document.getElementById('f-net-speed').value : ''
    };
    if (!confirm('بعد الإنهاء تُرسَل المناوبة للقائد. متأكد؟')) return;
    try {
      await api.endShift(reportId, payload);
      toast('✅ انتهت المناوبة — التقرير جاهز', 'ok');
      go('#/reports/detail/' + reportId);
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* أدوات مساعدة */
function renderShellInner(title, inner, extra = '') {
  clearInterval(tickTimer);
  document.getElementById('app').innerHTML = shell(inner + extra, title);
  window.scrollTo(0, 0);
}
