/* توليد PDF ومشاركة التقارير — مبني على كود SOS Guard ومكيّف لبنية تقاريرنا */
import { esc } from './app.js';
import { ITEMS, POW, TYPES } from './shift.js';

const CREDIT_AR = 'منظومة تقارير الأمن — تصميم Ahmed Abu Jami';
const CREDIT_EN = 'Security Reports System';

const pad = n => String(n).padStart(2, '0');
const fmtT = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const fmtD = t => { const d = new Date(t); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const durTxt = ms => { const m = Math.floor(ms / 60000); return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm'; };

const ST = {
  g: { ar: 'عادي', en: 'NORMAL', e: '🟢', c: '#16a34a' },
  y: { ar: 'ملاحظة / تنبيه', en: 'OBSERVATION', e: '🟡', c: '#d99a00' },
  r: { ar: 'حادث أمني / طارئ', en: 'INCIDENT', e: '🔴', c: '#d6213a' }
};

function stats(r) {
  const fd = r.formData || {};
  const rounds = fd.rounds || [];
  const incidents = fd.incidents || [];
  const red = incidents.filter(i => i.level === 'r').length;
  const yel = incidents.length - red;
  let qrOk = 0, qrTot = 0, vis = 0, issues = [];
  rounds.forEach((x, n) => {
    Object.values(x.qr || {}).forEach(q => { qrTot++; if (q.mode === 'qr') qrOk++; });
    vis += x.visitors || 0;
    ITEMS.forEach(it => {
      const d = (x.items || {})[it.k];
      if (d && d.ok === false) issues.push({ n: n + 1, ar: it.ar, en: it.en, note: d.note, photo: d.photo });
    });
    if (x.power === 'none') issues.push({ n: n + 1, ar: 'الكهرباء', en: 'Power', note: 'لا توجد كهرباء / No power' });
  });
  return { red, yel, qrOk, qrTot, vis, issues, rounds, incidents };
}

/* ============ نص المشاركة (واتساب/إيميل/نسخ) ============ */
export function textRep(r, compact) {
  const fd = r.formData || {};
  const st = ST[fd.status || 'g'] || ST.g;
  const s = stats(r);
  const L = [];
  L.push('🛡️ *تقرير مناوبة / Shift Report*', '━━━━━━━━━━━━━━',
    '🔖 *رقم / No:* ' + r.number,
    '👤 *المسؤول / By:* ' + (r.authorName || ''));
  if (fd.location) L.push('📍 *الموقع / Post:* ' + fd.location);
  L.push('🕒 *التاريخ / Date:* ' + (fd.date || fmtD(r.createdAt)) + (fd.shift ? ' | ' + fd.shift : ''));
  if (fd.phase === 'ended') {
    L.push('📊 *الحالة / Status:* ' + st.e + ' ' + st.ar + ' / ' + st.en,
      '🔄 *الجولات / Rounds:* ' + s.rounds.length + '/' + (fd.expected || '?') + ' (QR ' + s.qrOk + '/' + s.qrTot + ')',
      '🚨 *الأحداث / Events:* 🟡' + s.yel + ' 🔴' + s.red + ' | ⚠️ أعطال: ' + s.issues.length);
    if (!compact) L.push('👥 *زوار / Visitors:* ' + s.vis);
  }
  if (s.issues.length) {
    L.push('', '🔧 *أعطال الفحص / Issues:*');
    s.issues.slice(0, compact ? 4 : 99).forEach(i => L.push('• #' + i.n + ' ' + i.ar + ': ' + i.note));
  }
  if (s.incidents.length) {
    L.push('', '📝 *الأحداث / Incidents:*');
    s.incidents.slice(0, compact ? 4 : 99).forEach(i => {
      const t = TYPES.find(x => x[0] === i.type);
      L.push('• [' + fmtT(i.ts) + '] ' + (i.level === 'r' ? '🔴' : '🟡') + ' ' + (t ? t[1] : i.type) + ' — ' + i.desc + ' ← ' + i.action);
    });
  } else if (fd.phase === 'ended') L.push('', '📝 لا أحداث / No incidents');
  if (fd.assistance_provided === 'yes' && fd.assistance_type) {
    L.push('', '🤝 *مساعدة مقدَّمة / Assistance:* ' + fd.assistance_type);
  }
  if (fd.internet_connection) {
    L.push('🌐 *الإنترنت / Internet:* ' + (fd.internet_connection === 'yes' ? 'نعم' : 'لا') + (fd.internet_speed ? ' — ' + fd.internet_speed : ''));
  }
  if (fd.events) L.push('', '📋 *الملخص:* ' + fd.events);
  if (fd.phase === 'ended') {
    L.push('', '🤝 *التسليم / Handover:* ' + (fd.ho ? 'نعم → ' + (fd.receiver || '') : 'لا') + (fd.finalNote ? ' — ' + fd.finalNote : ''));
    if (fd.missNote) L.push('⏱ *سبب نقص الجولات:* ' + fd.missNote);
  }
  L.push('━━━━━━━━━━━━━━', '_' + CREDIT_AR + '_', '_' + CREDIT_EN + '_');
  return L.join('\n');
}

/* ============ PDF (عربي + إنجليزي) ============ */
const RCSS = `.r-page{width:794px;height:1123px;position:relative;background:#fff;color:#0b1b2b;font-family:'Noto Sans Arabic',Tahoma,Arial,sans-serif;font-size:13px;line-height:1.5;overflow:hidden;box-sizing:border-box;direction:rtl}
.r-body{padding:26px 30px 0}.r-blk{margin-bottom:10px}
.r-head{display:flex;align-items:center;gap:14px;border-bottom:3px solid #12c9e6;padding-bottom:10px}
.r-logo{height:58px;width:58px}.r-tt{flex:1}.r-t1{font-size:21px;font-weight:700;color:#06122a}.r-t2{font-size:14px;color:#0a7f8f}.r-org{font-size:11px;color:#4a6272}
.r-no{text-align:left;direction:ltr;font-family:monospace;font-size:12px}
.r-badge{display:inline-block;color:#fff;border-radius:6px;padding:3px 10px;margin-top:5px;font-size:11px;direction:rtl}
.r-grid{display:flex;flex-wrap:wrap;gap:6px}
.r-c{width:calc(33.3% - 4px);border:1px solid #cfe3ea;border-radius:8px;padding:5px 8px;background:#f5fafc;box-sizing:border-box}
.r-l{font-size:10.5px;color:#4a6272}.r-v{font-weight:700;font-size:13px}
.r-h{font-weight:700;color:#06122a;border-right:4px solid #2dffb2;padding-right:8px;margin-bottom:6px;font-size:14px}
.r-h span{color:#0a7f8f;font-weight:400;font-size:12px}
.r-st{display:flex;gap:6px}.r-s{flex:1;text-align:center;border:1px solid #cfe3ea;border-radius:8px;padding:6px 2px;background:#f5fafc}
.r-s b{display:block;font-size:18px;color:#06122a}.r-s small{font-size:10px;color:#4a6272}
.r-tb{width:100%;border-collapse:collapse;font-size:11.5px}
.r-tb th{background:#06122a;color:#2dffb2;padding:4px 2px;border:1px solid #06122a;font-weight:600;font-size:10.5px}
.r-tb td{border:1px solid #cfe3ea;padding:4px 2px;text-align:center}
.r-g{color:#16a34a}.r-b{color:#d6213a}.r-w{color:#d99a00}
.r-card{border:1px solid #cfe3ea;border-right:5px solid #d99a00;border-radius:8px;padding:7px 10px;background:#fcfdfe;margin-bottom:6px}
.r-card.red{border-right-color:#d6213a}
.r-ph{height:140px;margin-top:6px;border-radius:6px;border:1px solid #cfe3ea}
.r-it{padding:3px 0;border-bottom:1px dashed #cfe3ea}
.r-foot{position:absolute;left:30px;right:30px;bottom:14px;border-top:1px solid #12c9e6;padding-top:6px;font-size:10px;color:#4a6272;display:flex;justify-content:space-between;gap:10px;align-items:center}
.r-foot div{text-align:center;flex:1}`;

const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#0f2744"/><path d="M256 72L112 124v112c0 90 60 168 144 196 84-28 144-106 144-196V124L256 72z" fill="#f59e0b"/><path d="M256 108L144 148v88c0 70 47 132 112 155 65-23 112-85 112-155v-88L256 108z" fill="#0f2744"/><path d="M216 256l32 32 64-64" stroke="#f59e0b" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

function logoData() {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICON_SVG);
}

function blocksOf(r) {
  const fd = r.formData || {};
  const st = ST[fd.status || 'g'] || ST.g;
  const s = stats(r);
  const B = [];
  const H = (a, e) => `<div class="r-h">${a} <span>${e}</span></div>`;
  const cell = (a, e, v) => `<div class="r-c"><div class="r-l">${a} · ${e}</div><div class="r-v">${v}</div></div>`;

  B.push(`<div class="r-head"><img class="r-logo" src="${logoData()}"/><div class="r-tt">
    <div class="r-t1">تقرير مناوبة حارس أمن</div>
    <div class="r-t2">Security Guard Shift Report</div>
    <div class="r-org">منظومة تقارير الأمن / Security Reports System</div></div>
    <div class="r-no"><div>${esc(r.number)}</div>
    <div class="r-badge" style="background:${st.c}">${st.ar} · ${st.en}</div></div></div>`);

  B.push('<div class="r-grid">'
    + cell('المسؤول', 'By', esc(r.authorName || ''))
    + cell('الموقع', 'Post', esc(fd.location || '—'))
    + cell('المناوبة', 'Shift', esc(fd.shift || '—'))
    + cell('التاريخ', 'Date', esc(fd.date || fmtD(r.createdAt)))
    + (fd.startTs ? cell('البداية', 'Start', fmtT(fd.startTs)) : '')
    + (fd.endTs ? cell('النهاية', 'End', fmtT(fd.endTs)) : '')
    + (fd.startTs && fd.endTs ? cell('المدة', 'Duration', durTxt(fd.endTs - fd.startTs)) : '')
    + cell('الحالة بالسلسلة', 'Chain', esc(r.statusLabel || r.status))
    + '</div>');

  const t = (n, a, e) => `<div class="r-s"><b>${n}</b><small>${a}<br>${e}</small></div>`;
  if (fd.phase === 'ended') {
    B.push(H('ملخص', 'Summary') + '<div class="r-st">'
      + t(s.rounds.length + '/' + (fd.expected || '?'), 'الجولات', 'Rounds')
      + t('🔴' + s.red + ' 🟡' + s.yel, 'الأحداث', 'Events')
      + t(s.qrOk + '/' + s.qrTot, 'تحقق QR', 'QR verified')
      + t(String(s.vis), 'زوار', 'Visitors')
      + t(String(s.issues.length), 'أعطال', 'Issues')
      + '</div>');
  }

  // الجولات
  if (s.rounds.length) {
    B.push(H('الجولات الدورية', 'Periodic Rounds'));
    const rows = s.rounds.map((x, n) => {
      const late = x.late > 600000 ? `<br><small class="r-b">تأخر ${Math.round(x.late / 60000)}د</small>` : '';
      const qs = Object.values(x.qr || {});
      const qc = qs.length && qs.every(q => q.mode === 'qr') ? '<b class="r-g">QR ✔</b>' : '<b class="r-w">يدوي</b>';
      const pw = POW.find(p => p[0] === x.power) || [];
      const net = x.internet_connection === 'yes' ? (x.internet_speed || 'نعم') : (x.internet_connection === 'no' ? 'لا' : '—');
      return `<tr><td>${n + 1}</td><td>${fmtT(x.ts)}${late}</td><td>${qc}</td>`
        + ITEMS.map(it => `<td>${(x.items || {})[it.k] && (x.items || {})[it.k].ok ? '<b class="r-g">✔</b>' : '<b class="r-b">✖</b>'}</td>`).join('')
        + `<td>${pw[1] || '-'}</td><td>${net}</td><td>${x.visitors || 0}/${x.vehicles || 0}</td></tr>`;
    }).join('');
    const th = '<tr><th>#</th><th>الوقت<br>Time</th><th>QR</th><th>البوابات<br>Gates</th><th>الإضاءة<br>Light</th><th>السلامة<br>Safety</th><th>السجل<br>Log</th><th>الطاقة<br>Power</th><th>الإنترنت<br>Internet</th><th>ز/م<br>V/V</th></tr>';
    B.push('<table class="r-tb">' + th + rows + '</table>');
  }

  // أعطال الفحص
  if (s.issues.length) {
    B.push(H('أعطال ظهرت بالفحص', 'Checklist Issues'));
    s.issues.forEach(i => B.push(`<div class="r-it"><b>#${i.n} · ${i.ar} / ${i.en}:</b> ${esc(i.note || '')}${i.photo ? `<br><img class="r-ph" src="${i.photo}"/>` : ''}</div>`));
  }

  // الأحداث
  B.push(H('الأحداث والملاحظات', 'Incidents & Observations'));
  if (!s.incidents.length) B.push('<div class="r-g">لا توجد أحداث أو ملاحظات / No incidents reported</div>');
  s.incidents.slice().sort((a, b) => a.ts - b.ts).forEach(i => {
    const ty = TYPES.find(x => x[0] === i.type);
    B.push(`<div class="r-card ${i.level === 'r' ? 'red' : ''}">
      <b>${i.level === 'r' ? '🔴 حادث أمني / Security Incident' : '🟡 ملاحظة / Observation'}</b> · ${fmtT(i.ts)}<br>
      <b>${ty ? ty[1] : i.type}</b><br>
      الوصف / Description: ${esc(i.desc)}<br>
      الإجراء / Action: ${esc(i.action)}
      ${i.photo ? `<br><img class="r-ph" src="${i.photo}"/>` : ''}</div>`);
  });

  // أسئلة التقرير
  const q = [];
  if (fd.assistance_provided) q.push(`<div><b>مساعدة مقدَّمة؟ / Assistance:</b> ${fd.assistance_provided === 'yes' ? 'نعم / Yes' : 'لا / No'}${fd.assistance_type ? ' — ' + esc(fd.assistance_type) : ''}</div>`);
  if (fd.internet_connection) q.push(`<div><b>اتصال بالإنترنت؟ / Internet:</b> ${fd.internet_connection === 'yes' ? 'نعم / Yes' : 'لا / No'}${fd.internet_speed ? ' — ' + esc(fd.internet_speed) : ''}</div>`);
  if (fd.events) q.push(`<div><b>الملخص / Summary:</b> ${esc(fd.events)}</div>`);
  if (fd.patrols) q.push(`<div><b>الجولات / Patrols:</b> ${esc(fd.patrols)}</div>`);
  if (q.length) B.push(H('أسئلة التقرير', 'Report Questions') + q.join(''));

  // التسليم
  if (fd.phase === 'ended') {
    B.push(H('التسليم والاستلام', 'Handover')
      + `<div>تسليم العهدة / Handed over: <b>${fd.ho ? 'نعم / Yes' : 'لا / No'}</b>${fd.receiver ? ' → ' + esc(fd.receiver) : ''}</div>`
      + (fd.missNote ? `<div>سبب نقص الجولات: ${esc(fd.missNote)}</div>` : '')
      + (fd.finalNote ? `<div>ملاحظات: ${esc(fd.finalNote)}</div>` : ''));
  }

  // سير التقرير
  if (r.history?.length) {
    B.push(H('سير التقرير', 'Workflow'));
    const ACTION_AR = {
      created: 'إنشاء', edited: 'تعديل', shift_started: 'بدء مناوبة', shift_ended: 'إنهاء مناوبة',
      round_saved: 'حفظ جولة', incident_y: 'ملاحظة', incident_r: 'حادث طارئ',
      forwarded_to_commander: 'إرسال للقائد', forwarded_to_supervisor: 'إرسال للمشرف',
      forwarded_to_officer: 'إرسال للأوفيسر', closed: 'غلق'
    };
    B.push('<div class="r-it">' + r.history.slice().reverse().map(h =>
      `${fmtT(new Date(h.at).getTime())} — ${ACTION_AR[h.action] || h.action}`
    ).join('<br>') + '</div>');
  }

  return B;
}

export async function genPages(r) {
  const bl = blocksOf(r);
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-99999px;top:0';
  host.innerHTML = '<style>' + RCSS + '</style><div class="r-page"><div class="r-body" id="mb"></div></div>';
  document.body.appendChild(host);
  const mb = host.querySelector('#mb'), hs = [];
  for (const b of bl) {
    const d = document.createElement('div');
    d.className = 'r-blk'; d.innerHTML = b;
    mb.appendChild(d);
    await new Promise(res => setTimeout(res, 15));
    hs.push(d.offsetHeight + 10);
    mb.removeChild(d);
  }
  host.remove();
  const MAXH = 1123 - 26 - 90, pages = [[]];
  let cur = 0;
  bl.forEach((b, i) => {
    if (cur + hs[i] > MAXH && pages[pages.length - 1].length) { pages.push([]); cur = 0; }
    pages[pages.length - 1].push(b);
    cur += hs[i];
  });
  const out = [], N = pages.length;
  for (let p = 0; p < N; p++) {
    const html = `<div class="r-page"><style>${RCSS}</style><div class="r-body">${pages[p].map(b => `<div class="r-blk">${b}</div>`).join('')}</div>
      <div class="r-foot"><span>${esc(r.number)}</span><div>${CREDIT_AR}<br>${CREDIT_EN}</div><span>${p + 1} / ${N}</span></div></div>`;
    const el = document.createElement('div');
    el.innerHTML = html;
    const xml = new XMLSerializer().serializeToString(el.firstElementChild);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1588" height="2246" viewBox="0 0 794 1123"><foreignObject x="0" y="0" width="794" height="1123">${xml}</foreignObject></svg>`;
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const cv = document.createElement('canvas');
    cv.width = 1588; cv.height = 2246;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, 1588, 2246);
    cx.drawImage(img, 0, 0);
    const url = cv.toDataURL('image/jpeg', .88);
    const bin = atob(url.split(',')[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    out.push({ url, bytes, w: 1588, h: 2246 });
  }
  return out;
}

export function buildPDF(pages) {
  const enc = new TextEncoder(), ch = [];
  let pos = 0;
  const offs = [];
  const add = d => { const b = typeof d === 'string' ? enc.encode(d) : d; ch.push(b); pos += b.length; };
  add('%PDF-1.4\n');
  const n = pages.length;
  offs[1] = pos; add('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
  offs[2] = pos; add('2 0 obj\n<</Type/Pages/Kids[' + pages.map((_, i) => (3 + i * 3) + ' 0 R').join(' ') + ']/Count ' + n + '>>\nendobj\n');
  pages.forEach((p, i) => {
    const po = 3 + i * 3, co = po + 1, io = po + 2;
    const c = 'q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';
    offs[po] = pos; add(po + ' 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox[0 0 595.28 841.89]/Resources<</XObject<</Im0 ' + io + ' 0 R>>>>/Contents ' + co + ' 0 R>>\nendobj\n');
    offs[co] = pos; add(co + ' 0 obj\n<</Length ' + c.length + '>>\nstream\n' + c + '\nendstream\nendobj\n');
    offs[io] = pos; add(io + ' 0 obj\n<</Type/XObject/Subtype/Image/Width ' + p.w + '/Height ' + p.h + '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' + p.bytes.length + '>>\nstream\n');
    add(p.bytes);
    add('\nendstream\nendobj\n');
  });
  const total = 3 + n * 3, xp = pos;
  let x = 'xref\n0 ' + total + '\n0000000000 65535 f \n';
  for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
  add(x + 'trailer\n<</Size ' + total + '/Root 1 0 R>>\nstartxref\n' + xp + '\n%%EOF');
  return new Blob(ch, { type: 'application/pdf' });
}

const GEN = { id: null, pages: null, pdf: null };
export async function gen(id, report) {
  if (GEN.id === id) return GEN;
  const pages = await genPages(report);
  GEN.id = id; GEN.pages = pages; GEN.pdf = buildPDF(pages);
  return GEN;
}

export function dl(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
