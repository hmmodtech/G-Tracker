/* شاشات التقارير: القائمة، النموذج، التفاصيل + PDF/مشاركة */
import { api } from '../api.js';
import { shell, toast, esc, timeAgo, go, state, ROLE_LABELS } from '../app.js';
import { ITEMS, POW, TYPES } from './shift.js';
import { textRep, gen, dl } from '../pdf.js';

const pad = n => String(n).padStart(2, '0');
const fmtT = t => { const d = new Date(t); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

export async function renderReports() {
  const { reports } = await api.reports();
  const filter = state._reportFilter || '';
  const list = filter ? reports.filter(r => r.status === filter) : reports;
  const { report: active } = await api.activeShift().catch(() => ({ report: null }));
  const p = state.user.permissions || {};
  const canShift = ['guard', 'commander'].includes(state.user.role);

  const tabs = [
    ['', 'الكل'],
    ['with_guard', 'مع الحارس'],
    ['with_commander', 'مع القائد'],
    ['with_supervisor', 'مع المشرف'],
    ['with_officer', 'مع الأوفيسر'],
    ['closed', 'مغلق']
  ].map(([v, l]) => `<button class="${filter === v ? 'active' : ''}" data-f="${v}">${l}</button>`).join('');

  const rows = list.map(r => `
    <tr data-id="${r.id}" style="cursor:pointer">
      <td><b>${esc(r.number)}</b>${r.formData?.phase === 'active' ? ' <span class="chip with_guard">🟢 نشطة</span>' : ''}</td>
      <td>${esc(r.authorName)} <span class="chip role-${r.authorRole}">${ROLE_LABELS[r.authorRole]}</span></td>
      <td><span class="chip ${r.status}">${esc(r.statusLabel)}</span></td>
      <td>${esc(r.formData?.date || '—')}</td>
      <td>${timeAgo(r.updatedAt)}</td>
      <td>›</td>
    </tr>`).join('');

  const html = shell(`
    ${canShift ? (active
      ? `<button class="btn btn-amber" style="width:100%;margin-bottom:14px" onclick="location.hash='#/shift/${active.id}'">🟢 مناوبة نشطة — انتقل للوحة المناوبة</button>`
      : `<button class="btn btn-amber" style="width:100%;margin-bottom:14px" onclick="location.hash='#/shift/start'">▶️ بدء مناوبة جديدة</button>`) : ''}
    <div class="toolbar">
      <div class="filter-tabs">${tabs}</div>
      <div class="spacer"></div>
      ${(p.own_reports !== 'none') ? `<button class="btn btn-ghost btn-sm" id="btn-new">＋ تقرير يدوي</button>` : ''}
    </div>
    <div class="card table-wrap">
      ${list.length ? `<table>
        <thead><tr><th>الرقم</th><th>المُرسل</th><th>الحالة</th><th>التاريخ</th><th>آخر تحديث</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : `<div class="empty">لا توجد تقارير</div>`}
    </div>`, 'التقارير');

  document.getElementById('app').innerHTML = html;

  const bn = document.getElementById('btn-new');
  if (bn) bn.onclick = () => go('#/reports/new');
  document.querySelectorAll('.filter-tabs button').forEach(b => {
    b.onclick = () => { state._reportFilter = b.dataset.f; renderReports(); };
  });
  document.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.onclick = () => go('#/reports/detail/' + tr.dataset.id);
  });
}

/* ============ نموذج التقرير اليدوي ============ */
export async function renderReportForm(id) {
  let report = null;
  if (id) {
    ({ report } = await api.report(id));
    if (!report.canEdit) { toast('لا تملك صلاحية تعديل هذا التقرير', 'err'); return go('#/reports/detail/' + id); }
    if (report.formData.phase === 'active') return go('#/shift/' + id);
  }
  const { settings } = await api.settings().catch(() => ({ settings: {} }));
  const f = report?.formData || {
    date: new Date().toISOString().slice(0, 10),
    shift: 'صباحية', location: '', events: '', patrols: '',
    assistance_provided: '', assistance_type: '',
    internet_connection: '', internet_speed: '', notes: ''
  };

  const html = shell(`
    <div class="card" style="max-width:760px">
      <h3>${report ? 'تعديل التقرير ' + esc(report.number) : 'تقرير يدوي جديد'}</h3>
      <form id="rep-form">
        <div class="field-row">
          <div class="field"><label>التاريخ</label>
            <input type="date" name="date" value="${esc(f.date)}" required /></div>
          <div class="field"><label>المناوبة</label>
            <select name="shift">
              ${['صباحية', 'مسائية', 'ليلية'].map(s => `<option ${f.shift === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select></div>
        </div>
        <div class="field"><label>الموقع / المنطقة</label>
          <input name="location" value="${esc(f.location)}" placeholder="مثال: البوابة الرئيسية" /></div>
        <div class="field"><label>الأحداث والملحوظات الأمنية</label>
          <textarea name="events" placeholder="اكتب ما جرى…">${esc(f.events)}</textarea></div>
        <div class="field"><label>الجولات والمعاينات</label>
          <textarea name="patrols" placeholder="مواعيد الجولات…">${esc(f.patrols)}</textarea></div>

        ${settings.assistanceQuestionEnabled !== false ? `
        <div class="field">
          <label>هل جرى تقديم أي مساعدة أمنية أو لوجستية لأحد الموظفين خلال فترة المناوبة؟</label>
          <select name="assistance_provided" id="f-assist">
            <option value="" ${!f.assistance_provided ? 'selected' : ''}>— اختر —</option>
            <option value="yes" ${f.assistance_provided === 'yes' ? 'selected' : ''}>نعم</option>
            <option value="no" ${f.assistance_provided === 'no' ? 'selected' : ''}>لا</option>
          </select>
        </div>
        <div class="field" id="assist-type-wrap" style="${f.assistance_provided === 'yes' ? '' : 'display:none'}">
          <label>نوع المساعدة المقدَّمة</label>
          <textarea name="assistance_type" id="f-assist-type" placeholder="اكتب نوع المساعدة…">${esc(f.assistance_type)}</textarea>
        </div>` : ''}

        ${settings.internetQuestionEnabled !== false ? `
        <div class="field-row">
          <div class="field">
            <label>هل كان هناك اتصال بالإنترنت؟</label>
            <select name="internet_connection" id="f-net">
              <option value="" ${!f.internet_connection ? 'selected' : ''}>— اختر —</option>
              <option value="yes" ${f.internet_connection === 'yes' ? 'selected' : ''}>نعم</option>
              <option value="no" ${f.internet_connection === 'no' ? 'selected' : ''}>لا</option>
            </select>
          </div>
          <div class="field" id="net-speed-wrap" style="${f.internet_connection === 'yes' ? '' : 'display:none'}">
            <label>سرعة الاتصال بالإنترنت</label>
            <select name="internet_speed" id="f-net-speed">
              <option value="" ${!f.internet_speed ? 'selected' : ''}>— اختر —</option>
              ${['ممتاز', 'جيد', 'ضعيف', 'متقطع'].map(s => `<option ${f.internet_speed === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>` : ''}

        <div class="field"><label>ملاحظات إضافية</label>
          <textarea name="notes" placeholder="اختياري…">${esc(f.notes)}</textarea></div>

        <div class="actions-row">
          <button class="btn btn-primary" type="submit" style="width:auto;padding-inline:28px">
            ${report ? 'حفظ التعديلات' : 'حفظ التقرير'}
          </button>
          <button class="btn btn-ghost" type="button" id="btn-cancel">إلغاء</button>
        </div>
      </form>
    </div>`, report ? 'تعديل التقرير' : 'تقرير جديد');

  document.getElementById('app').innerHTML = html;

  const assist = document.getElementById('f-assist');
  if (assist) assist.onchange = () => {
    document.getElementById('assist-type-wrap').style.display = assist.value === 'yes' ? '' : 'none';
  };
  const net = document.getElementById('f-net');
  if (net) net.onchange = () => {
    document.getElementById('net-speed-wrap').style.display = net.value === 'yes' ? '' : 'none';
  };

  document.getElementById('btn-cancel').onclick = () => history.back();
  document.getElementById('rep-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const formData = Object.fromEntries(fd.entries());
    if (formData.assistance_provided !== 'yes') formData.assistance_type = '';
    if (formData.internet_connection !== 'yes') formData.internet_speed = '';
    try {
      if (report) {
        await api.updateReport(report.id, formData);
        toast('تم حفظ التعديلات', 'ok');
        go('#/reports/detail/' + report.id);
      } else {
        const { report: created } = await api.createReport(formData);
        toast('تم إنشاء التقرير', 'ok');
        go('#/reports/detail/' + created.id);
      }
    } catch (err) { toast(err.message, 'err'); }
  };
}

/* ============ تفاصيل التقرير ============ */
export async function renderReportDetail(id) {
  const { report } = await api.report(id);
  const r = report;
  const fd = r.formData || {};
  const isActive = fd.phase === 'active';

  // لو المناوبة نشطة والمشاهد هو صاحبها → للوحة المناوبة
  if (isActive && r.authorId === state.user.id && ['guard', 'commander'].includes(state.user.role)) {
    return go('#/shift/' + id);
  }

  const roundsHtml = (fd.rounds || []).length ? `
    <h3 style="margin-top:20px">🔄 الجولات (${fd.rounds.length}${fd.expected ? '/' + fd.expected : ''})</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>#</th><th>الوقت</th><th>QR</th>${ITEMS.map(i => `<th>${i.ar.split(' ')[0]}</th>`).join('')}<th>الطاقة</th><th>الإنترنت</th><th>ز/م</th></tr></thead>
      <tbody>${fd.rounds.map((x, n) => {
        const qs = Object.values(x.qr || {});
        const qc = qs.length && qs.every(q => q.mode === 'qr') ? '✔ QR' : '⚠ يدوي';
        const pw = POW.find(p => p[0] === x.power)?.[1] || '—';
        const net = x.internet_connection === 'yes' ? (x.internet_speed || 'نعم') : x.internet_connection === 'no' ? 'لا' : '—';
        return `<tr>
          <td>${n + 1}</td>
          <td>${fmtT(x.ts)}${x.late > 600000 ? ` <span class="chip no">تأخر ${Math.round(x.late / 60000)}د</span>` : ''}</td>
          <td>${qc}</td>
          ${ITEMS.map(it => {
            const d = (x.items || {})[it.k];
            return `<td>${d?.ok ? '✅' : d?.ok === false ? '❌' : '—'}</td>`;
          }).join('')}
          <td>${esc(pw)}</td><td>${esc(net)}</td><td>${x.visitors || 0}/${x.vehicles || 0}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
    ${fd.rounds.some(x => Object.values(x.items || {}).some(d => d?.ok === false)) ? `
      <div style="margin-top:10px">
        ${fd.rounds.flatMap((x, n) => ITEMS.filter(it => (x.items || {})[it.k]?.ok === false).map(it => {
          const d = x.items[it.k];
          return `<div class="note"><div class="meta">جولة #${n + 1} — ${it.ar}</div>${esc(d.note || '')}${d.photo ? `<br><img src="${d.photo}" style="max-height:120px;border-radius:8px;margin-top:6px"/>` : ''}</div>`;
        })).join('')}
      </div>` : ''}
  ` : '';

  const incHtml = (fd.incidents || []).length ? `
    <h3 style="margin-top:20px">🚨 الأحداث (${fd.incidents.length})</h3>
    ${fd.incidents.slice().sort((a, b) => a.ts - b.ts).map(i => {
      const ty = TYPES.find(x => x[0] === i.type);
      return `<div class="note" style="${i.level === 'r' ? 'background:#fef2f2;border-color:#fecaca' : ''}">
        <div class="meta">${i.level === 'r' ? '🔴 حادث طارئ' : '🟡 ملاحظة'} · ${fmtT(i.ts)} — ${esc(ty?.[1] || i.type)}</div>
        <b>الوصف:</b> ${esc(i.desc)}<br/><b>الإجراء:</b> ${esc(i.action)}
        ${i.photo ? `<br/><img src="${i.photo}" style="max-height:160px;border-radius:8px;margin-top:6px"/>` : ''}
      </div>`;
    }).join('')}
  ` : '';

  const detailItems = [
    ['التاريخ', fd.date],
    ['المناوبة', fd.shift],
    ['الموقع', fd.location],
    ['الأحداث والملحوظات', fd.events, true],
    ['الجولات والمعاينات', fd.patrols, true],
    ...(fd.assistance_provided ? [['مساعدة مقدَّمة؟', fd.assistance_provided === 'yes' ? 'نعم' : 'لا']] : []),
    ...(fd.assistance_type ? [['نوع المساعدة', fd.assistance_type, true]] : []),
    ...(fd.internet_connection ? [['اتصال بالإنترنت؟', fd.internet_connection === 'yes' ? 'نعم' : 'لا']] : []),
    ...(fd.internet_speed ? [['سرعة الاتصال', fd.internet_speed]] : []),
    ...(fd.phase === 'ended' && fd.ho !== undefined ? [['تسليم العهدة', fd.ho ? 'نعم → ' + (fd.receiver || '') : 'لا']] : []),
    ...(fd.finalNote ? [['ملاحظات ختامية', fd.finalNote, true]] : []),
    ...(fd.notes ? [['ملاحظات إضافية', fd.notes, true]] : [])
  ].filter(x => x[1]);

  const canEdit = r.canEdit && !isActive;
  const canForward = r.canForward;
  const forwardLabels = { commander: 'إرسال للقائد', supervisor: 'إرسال للمشرف', officer: 'إرسال للأوفيسر', closed: 'غلق التقرير' };
  const stEmoji = fd.status ? { g: '🟢', y: '🟡', r: '🔴' }[fd.status] : '';

  const html = shell(`
    <div class="card" style="max-width:860px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px">
        <h3 style="margin:0">${esc(r.number)} ${stEmoji}</h3>
        <span class="chip ${r.status}">${esc(r.statusLabel)}</span>
        <span class="chip role-${r.authorRole}">${ROLE_LABELS[r.authorRole]}: ${esc(r.authorName)}</span>
        ${isActive ? '<span class="chip with_guard">🟢 مناوبة نشطة</span>' : ''}
        <div style="flex:1"></div>
        ${canEdit ? `<button class="btn btn-ghost btn-sm" id="btn-edit">✏️ تعديل</button>` : ''}
      </div>

      <div class="detail-grid">
        ${detailItems.map(([k, v, full]) => `
          <div class="detail-item ${full ? 'full' : ''}">
            <div class="k">${esc(k)}</div><div class="v">${esc(v)}</div>
          </div>`).join('')}
      </div>

      ${roundsHtml}
      ${incHtml}

      ${canForward ? `<div class="actions-row">
        <button class="btn btn-amber" id="btn-forward">${forwardLabels[canForward] || 'إرسال'}</button>
      </div>` : ''}

      ${!isActive ? `
      <h3 style="margin-top:22px">📤 تصدير ومشاركة</h3>
      <div class="actions-row">
        <button class="btn btn-primary" style="width:auto" id="btn-pdf">📄 مشاركة PDF</button>
        <button class="btn btn-ghost" id="btn-wa">💬 واتساب (ملخص)</button>
        <button class="btn btn-ghost" id="btn-copy">📋 نسخ النص</button>
        <button class="btn btn-ghost" id="btn-dl">⬇️ تحميل PDF</button>
      </div>
      <div id="pdf-prev" style="margin-top:12px"></div>` : ''}

      ${r.history?.length ? `
      <h3 style="margin-top:22px">سجل التقرير</h3>
      <ul class="timeline">
        ${r.history.slice().reverse().map(h => `
          <li>
            <div>${historyLabel(h.action)}</div>
            <div class="t">${timeAgo(h.at)}</div>
          </li>`).join('')}
      </ul>` : ''}

      <h3 style="margin-top:22px">ملاحظات المراجعين</h3>
      ${r.notes?.length ? r.notes.map(n => `
        <div class="note"><div class="meta">${esc(n.byName)} · ${ROLE_LABELS[n.byRole]} · ${timeAgo(n.at)}</div>${esc(n.text)}</div>
      `).join('') : '<div class="empty" style="padding:14px">لا توجد ملاحظات</div>'}

      <div class="field" style="margin-top:12px">
        <label>إضافة ملاحظة</label>
        <textarea id="note-text" placeholder="ملاحظة…"></textarea>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-note">إضافة الملاحظة</button>

      <div class="actions-row">
        <button class="btn btn-ghost" id="btn-back">→ رجوع للقائمة</button>
      </div>
    </div>`, 'تفاصيل ' + r.number);

  document.getElementById('app').innerHTML = html;

  document.getElementById('btn-back').onclick = () => go('#/reports');
  const be = document.getElementById('btn-edit');
  if (be) be.onclick = () => go('#/reports/edit/' + r.id);
  const bf = document.getElementById('btn-forward');
  if (bf) bf.onclick = async () => {
    if (!confirm('تأكيد الإرسال؟')) return;
    try {
      await api.forwardReport(r.id);
      toast('تم الإرسال بنجاح', 'ok');
      renderReportDetail(id);
    } catch (e) { toast(e.message, 'err'); }
  };

  // PDF / مشاركة
  const ensureGen = async () => {
    const btn = document.getElementById('btn-pdf');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ جاري التجهيز…'; }
    try {
      const g = await gen(r.id, r);
      if (btn) { btn.disabled = false; btn.textContent = '📄 مشاركة PDF'; }
      return g;
    } catch (e) {
      if (btn) { btn.disabled = false; btn.textContent = '📄 مشاركة PDF'; }
      toast('تعذر إنشاء PDF على هذا الجهاز', 'err');
      throw e;
    }
  };
  const bp = document.getElementById('btn-pdf');
  if (bp) bp.onclick = async () => {
    try {
      const g = await ensureGen();
      const f = new File([g.pdf], r.number + '.pdf', { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        await navigator.share({ files: [f], title: 'تقرير ' + r.number, text: textRep(r, true) });
      } else {
        dl(g.pdf, r.number + '.pdf');
        toast('تم التحميل — أرفقه يدوياً', 'ok');
      }
    } catch (e) { if (e.name !== 'AbortError') toast(e.message || 'تعذر', 'err'); }
  };
  const bd = document.getElementById('btn-dl');
  if (bd) bd.onclick = async () => {
    try { const g = await ensureGen(); dl(g.pdf, r.number + '.pdf'); }
    catch (e) {}
  };
  const bw = document.getElementById('btn-wa');
  if (bw) bw.onclick = () => {
    const phone = state.settings?.supPhone || '';
    const txt = encodeURIComponent(textRep(r, true));
    window.open(phone ? `https://wa.me/${phone}?text=${txt}` : `https://wa.me/?text=${txt}`, '_blank');
  };
  const bc = document.getElementById('btn-copy');
  if (bc) bc.onclick = async () => {
    try { await navigator.clipboard.writeText(textRep(r, false)); toast('✅ تم النسخ', 'ok'); }
    catch (e) { toast('تعذر النسخ', 'err'); }
  };

  document.getElementById('btn-note').onclick = async () => {
    const text = document.getElementById('note-text').value.trim();
    if (!text) return toast('اكتب الملاحظة أولاً', 'err');
    try { await api.addNote(id, text); toast('تمت إضافة الملاحظة', 'ok'); renderReportDetail(id); }
    catch (e) { toast(e.message, 'err'); }
  };
}

function historyLabel(a) {
  return {
    created: 'إنشاء التقرير',
    edited: 'تعديل محتوى التقرير',
    shift_started: '▶️ بدء مناوبة',
    shift_ended: '🏁 إنهاء مناوبة',
    round_saved: '🔄 حفظ جولة',
    incident_y: '🟡 تسجيل ملاحظة',
    incident_r: '🔴 تسجيل حادث طارئ',
    forwarded_to_commander: 'إرسال إلى القائد',
    forwarded_to_supervisor: 'إرسال إلى المشرف',
    forwarded_to_officer: 'إرسال إلى الأوفيسر',
    closed: 'غلق التقرير'
  }[a] || a;
}
