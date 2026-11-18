/* الشاشات الإدارية: الرئيسية، الحسابات، المهام، الإحصائيات، السجل، الإعدادات */
import { api } from '../api.js';
import { shell, toast, esc, timeAgo, go, state, ROLE_LABELS } from '../app.js';

/* ============ الرئيسية ============ */
export async function renderDashboard() {
  const d = await api.dashboard();
  const p = state.user.permissions || {};
  const cards = [];

  cards.push(`<div class="stat"><div class="num">${d.myReports}</div><div class="lbl">تقاريري</div></div>`);
  cards.push(`<div class="stat amber"><div class="num">${d.waitingWithMe}</div><div class="lbl">بانتظار إجرائي</div></div>`);
  if (d.myTasks !== undefined && (state.user.role === 'guard' || p.distribute_tasks)) {
    cards.push(`<div class="stat blue"><div class="num">${d.myTasks}</div><div class="lbl">مهام مفتوحة</div></div>`);
  }
  if (d.teamGuards !== undefined) {
    cards.push(`<div class="stat green"><div class="num">${d.teamGuards}</div><div class="lbl">الحراس النشطون</div></div>`);
  }
  if (p.view_alerts && d.unreadAlerts) {
    cards.push(`<div class="stat purple"><div class="num">${d.unreadAlerts}</div><div class="lbl">تنبيهات غير مقروءة</div></div>`);
  }

  const roleHints = {
    guard: 'أرسل تقاريرك اليومية — تذهب للقائد ثم للمشرف ثم للأوفيسر.',
    commander: 'راجع تقارير حراسك (قراءة فقط) وأرسلها للمشرف مع تقريرك.',
    supervisor: 'وزّع المهام، عدّل تقارير القادة والحراس، وأرسلها للأوفيسر.',
    officer: 'الصلاحيات الكبرى معك: الصلاحيات، التنبيهات، الإحصائيات، الإعدادات.'
  };

  const html = shell(`
    <div class="card" style="background:linear-gradient(135deg,var(--navy),var(--navy-3));color:#fff;border:none">
      <div style="font-size:13px;opacity:.75">أهلاً بك</div>
      <div style="font-size:22px;font-weight:800;margin:4px 0 8px">${esc(state.user.name)}</div>
      <div style="font-size:14px;opacity:.9">${roleHints[state.user.role] || ''}</div>
      <div style="margin-top:14px"><span class="chip role-${state.user.role}">${ROLE_LABELS[state.user.role]}</span></div>
    </div>
    <div class="stats-grid">${cards.join('')}</div>

    <div class="card">
      <h3>آخر التقارير المرئية لك</h3>
      ${d.recent?.length ? `<div class="table-wrap"><table>
        <thead><tr><th>الرقم</th><th>المُرسل</th><th>الحالة</th><th>التحديث</th></tr></thead>
        <tbody>${d.recent.map(r => `
          <tr data-id="${r.id}" style="cursor:pointer">
            <td><b>${esc(r.number)}</b></td>
            <td>${esc(r.authorName)}</td>
            <td><span class="chip ${r.status}">${esc(r.statusLabel)}</span></td>
            <td>${timeAgo(r.updatedAt)}</td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<div class="empty">لا توجد تقارير بعد</div>'}
    </div>

    <div class="toolbar">
      ${['guard', 'commander'].includes(state.user.role) ? `
        <button class="btn btn-amber" id="btn-shift">▶️ مناوبة</button>` : ''}
      <button class="btn btn-ghost" onclick="location.hash='#/reports/new'">＋ تقرير يدوي</button>
      <button class="btn btn-ghost" onclick="location.hash='#/reports'">عرض كل التقارير</button>
    </div>`, 'الرئيسية');

  document.getElementById('app').innerHTML = html;
  document.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.onclick = () => go('#/reports/detail/' + tr.dataset.id);
  });
  const bs = document.getElementById('btn-shift');
  if (bs) bs.onclick = async () => {
    try {
      const { report } = await api.activeShift();
      go(report ? '#/shift/' + report.id : '#/shift/start');
    } catch (e) { toast(e.message, 'err'); }
  };
}

/* ============ الحسابات والصلاحيات ============ */
export async function renderUsers() {
  const { users, permissionLabels, toggleable } = await api.users();
  const me = state.user;

  const rows = users.map(u => `
    <tr>
      <td><b>${esc(u.name)}</b><br/><small style="color:var(--muted)">@${esc(u.username)}</small></td>
      <td><span class="chip role-${u.role}">${ROLE_LABELS[u.role]}</span></td>
      <td>${u.active ? '<span class="chip ok">مفعّل</span>' : '<span class="chip no">موقوف</span>'}</td>
      <td>${timeAgo(u.createdAt)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" data-perm="${u.id}">🔒 الصلاحيات</button>
        <button class="btn btn-ghost btn-sm" data-edit="${u.id}">✏️</button>
      </td>
    </tr>`).join('');

  const html = shell(`
    <div class="toolbar">
      <div class="spacer"></div>
      <button class="btn btn-amber" id="btn-new-user">＋ حساب جديد</button>
    </div>
    <div class="card table-wrap">
      <table>
        <thead><tr><th>الاسم</th><th>الدور</th><th>الحالة</th><th>أُنشئ</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="card" style="font-size:13px;color:var(--muted)">
      <b>نطاق صلاحياتك:</b>
      ${me.role === 'supervisor'
        ? 'المشرف يدير حسابات <b>القادة والحراس</b> فقط، ويحدد صلاحياتهم ضمن نطاقه. حسابات المشرفين والأوفيسر ينشئها الأوفيسر.'
        : 'الأوفيسر يحدد صلاحيات <b>المشرف والجميع</b>، وله الصلاحيات الكبرى.'}
    </div>`, 'الحسابات والصلاحيات');

  document.getElementById('app').innerHTML = html;
  document.getElementById('btn-new-user').onclick = () => userModal(null, users);
  document.querySelectorAll('[data-perm]').forEach(b => b.onclick = () => {
    const u = users.find(x => x.id === Number(b.dataset.perm));
    permModal(u, permissionLabels, toggleable);
  });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const u = users.find(x => x.id === Number(b.dataset.edit));
    userModal(u, users);
  });
}

function userModal(existing, users) {
  const me = state.user;
  const roles = me.role === 'officer'
    ? ['supervisor', 'commander', 'guard']
    : ['commander', 'guard'];
  const u = existing || { role: 'guard', name: '', username: '', active: true };

  openModal(`
    <h3>${existing ? 'تعديل حساب: ' + esc(u.name) : 'حساب جديد'}</h3>
    <form id="user-form">
      <div class="field"><label>الاسم</label>
        <input name="name" required value="${esc(u.name)}" /></div>
      <div class="field"><label>اسم المستخدم</label>
        <input name="username" required value="${esc(u.username)}" ${existing ? 'disabled' : ''} placeholder="username" /></div>
      ${!existing ? `<div class="field"><label>كلمة المرور</label>
        <input name="password" type="text" required placeholder="••••" /></div>` :
        `<div class="field"><label>كلمة مرور جديدة (اختياري)</label>
        <input name="password" type="text" placeholder="اتركها فارغة للإبقاء" /></div>`}
      ${!existing ? `<div class="field"><label>الدور</label>
        <select name="role">${roles.map(r => `<option value="${r}">${ROLE_LABELS[r]}</option>`).join('')}</select>
        <div class="hint">${me.role === 'supervisor' ? 'المشرف ينشئ القادة والحراس فقط' : ''}</div></div>` : ''}
      ${existing && me.role === 'officer' ? `<div class="field"><label>الحالة</label>
        <select name="active"><option value="1" ${u.active ? 'selected' : ''}>مفعّل</option><option value="0" ${!u.active ? 'selected' : ''}>موقوف</option></select></div>` : ''}
      <div class="actions-row">
        <button class="btn btn-primary" type="submit" style="width:auto">حفظ</button>
        <button class="btn btn-ghost" type="button" onclick="window.__closeModal()">إلغاء</button>
      </div>
    </form>`);

  document.getElementById('user-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      if (existing) {
        const payload = { name: fd.get('name') };
        const pw = fd.get('password');
        if (pw) payload.password = pw;
        if (fd.get('active') !== null && fd.has('active')) payload.active = fd.get('active') === '1';
        await api.updateUser(existing.id, payload);
        toast('تم تحديث الحساب', 'ok');
      } else {
        await api.createUser({
          name: fd.get('name'),
          username: fd.get('username').trim(),
          password: fd.get('password'),
          role: fd.get('role')
        });
        toast('تم إنشاء الحساب', 'ok');
      }
      window.__closeModal();
      renderUsers();
    } catch (err) { toast(err.message, 'err'); }
  };
}

function permModal(u, permissionLabels, toggleable) {
  const p = u.permissions || {};
  // مفاتيح معروضة: الأساسية + القابلة للتبديل (بدون تكرار)
  const keys = ['own_reports', 'guard_reports', 'commander_reports']
    .concat(toggleable)
    .filter((v, i, a) => a.indexOf(v) === i);

  const rows = keys.map(k => {
    const locked = isLocked(u.role, k);
    const val = p[k];
    let label = permissionLabels[k] || k;
    let sub = '';
    if (k === 'guard_reports' || k === 'commander_reports') {
      label = permissionLabels[k];
      sub = val === 'edit' ? '— تعديل كامل' : val === 'view' ? '— قراءة فقط' : '— بدون وصول';
    } else if (k === 'own_reports') {
      sub = '— تعديل تقاريره';
    }
    const checked = val === true || val === 'edit' || (val === 'view' && k === 'guard_reports');
    const disabled = locked || k === 'own_reports' ||
      (k === 'guard_reports' && u.role === 'guard') ||
      (k === 'commander_reports' && (u.role === 'guard' || u.role === 'commander'));
    return `
      <div class="perm-row">
        <div>
          <div class="nm">${esc(label)}</div>
          <div class="locked">${sub}${locked ? ' · 🔒 قاعدة ثابتة' : ''}</div>
        </div>
        <label class="switch">
          <input type="checkbox" data-k="${k}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}/>
          <span class="sl"></span>
        </label>
      </div>`;
  }).join('');

  openModal(`
    <h3>صلاحيات: ${esc(u.name)} <span class="chip role-${u.role}">${ROLE_LABELS[u.role]}</span></h3>
    <div class="perm-grid">${rows}</div>
    <div class="actions-row">
      <button class="btn btn-primary" id="save-perm" style="width:auto">حفظ الصلاحيات</button>
      <button class="btn btn-ghost" onclick="window.__closeModal()">إلغاء</button>
    </div>
    <div class="hint" style="margin-top:10px;font-size:12px;color:var(--muted)">
      القواعد الذهبية مقفلة: القائد لا يعدّل تقارير الحراس، والإعدادات للأوفيسر فقط.
      ${state.user.role === 'supervisor' ? '<br/>نطاقك: حسابات القادة والحراس فقط.' : ''}
    </div>`);

  document.getElementById('save-perm').onclick = async () => {
    const overrides = {};
    document.querySelectorAll('#modal-root input[data-k]').forEach(cb => {
      if (cb.disabled) return;
      overrides[cb.dataset.k] = cb.checked;
    });
    try {
      await api.updateUser(u.id, { overrides, _replace: true });
      toast('تم حفظ الصلاحيات', 'ok');
      window.__closeModal();
      renderUsers();
    } catch (e) { toast(e.message, 'err'); }
  };
}

function isLocked(role, key) {
  if (key === 'own_reports') return true;
  if (role === 'guard') return true; // الحارس: تقاريره فقط — كل شيء مقفل
  if (role === 'officer') return true; // الصلاحيات الكبرى ثابتة
  if (role === 'commander') {
    // القائد: قراءة تقارير الحراس فقط + Extras يحددها الأوفيسر
    return !['view_stats', 'view_audit'].includes(key);
  }
  if (role === 'supervisor') {
    // المشرف: صلاحياته الوظيفية يضبطها الأوفيسر، لكن القواعد الذهبية مقفلة
    return ['guard_reports', 'commander_reports', 'manage_settings', 'view_alerts'].includes(key);
  }
  return false;
}

/* ============ المهام ============ */
export async function renderTasks() {
  const { tasks } = await api.tasks();
  const me = state.user;
  const canDistribute = me.permissions?.distribute_tasks;
  const guards = canDistribute ? (await api.users()).users.filter(u => u.role === 'guard') : [];

  const rows = tasks.map(t => `
    <tr>
      <td>${esc(t.description)}</td>
      <td>${esc(t.guardName)}</td>
      <td>${esc(t.dueDate || '—')}</td>
      <td><span class="chip ${t.status === 'done' ? 'ok' : t.status === 'in_progress' ? 'pend' : 'no'}">
        ${t.status === 'done' ? 'منجزة' : t.status === 'in_progress' ? 'قيد التنفيذ' : 'معلقة'}</span></td>
      <td style="white-space:nowrap">
        ${t.guardId === me.id && t.status !== 'done'
          ? `<button class="btn btn-ghost btn-sm" data-done="${t.id}">✓ تم</button>` : ''}
        ${canDistribute && t.status !== 'done'
          ? `<button class="btn btn-ghost btn-sm" data-prog="${t.id}">… جارية</button>` : ''}
      </td>
    </tr>`).join('');

  const html = shell(`
    ${canDistribute ? `
    <div class="card" style="max-width:640px">
      <h3>📌 توزيع مهمة جديدة</h3>
      <form id="task-form">
        <div class="field-row">
          <div class="field"><label>الحارس</label>
            <select name="guardId" required>
              <option value="">— اختر حارساً —</option>
              ${guards.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}
            </select></div>
          <div class="field"><label>الموعد النهائي</label>
            <input type="date" name="dueDate" /></div>
        </div>
        <div class="field"><label>وصف المهمة</label>
          <textarea name="description" required placeholder="مثال: جولة على المخزن الساعة 22:00"></textarea></div>
        <button class="btn btn-amber" type="submit">توزيع المهمة</button>
      </form>
    </div>` : ''}

    <div class="card table-wrap">
      <h3>${canDistribute ? 'كل المهام' : 'مهامي'}</h3>
      ${tasks.length ? `<table>
        <thead><tr><th>المهمة</th><th>الحارس</th><th>الموعد</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<div class="empty">لا توجد مهام</div>'}
    </div>`, 'المهام');

  document.getElementById('app').innerHTML = html;

  const tf = document.getElementById('task-form');
  if (tf) tf.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(tf);
    try {
      await api.createTask({ guardId: Number(fd.get('guardId')), description: fd.get('description'), dueDate: fd.get('dueDate') });
      toast('تم توزيع المهمة', 'ok');
      renderTasks();
    } catch (err) { toast(err.message, 'err'); }
  };
  document.querySelectorAll('[data-done]').forEach(b => b.onclick = async () => {
    try { await api.updateTask(Number(b.dataset.done), { status: 'done' }); toast('أحسنت!', 'ok'); renderTasks(); }
    catch (e) { toast(e.message, 'err'); }
  });
  document.querySelectorAll('[data-prog]').forEach(b => b.onclick = async () => {
    try { await api.updateTask(Number(b.dataset.prog), { status: 'in_progress' }); renderTasks(); }
    catch (e) { toast(e.message, 'err'); }
  });
}

/* ============ الإحصائيات ============ */
export async function renderStats() {
  const s = await api.stats();
  const maxStatus = Math.max(1, ...Object.values(s.byStatus));
  const maxRole = Math.max(1, ...Object.values(s.byRole));
  const speedMax = Math.max(1, ...Object.values(s.internetSpeeds));

  const statusColors = { with_guard: '', with_commander: 'blue', with_supervisor: 'amber', with_officer: 'purple', closed: 'green' };

  const html = shell(`
    <div class="stats-grid">
      <div class="stat"><div class="num">${s.totalReports}</div><div class="lbl">إجمالي التقارير</div></div>
      <div class="stat green"><div class="num">${s.todayReports}</div><div class="lbl">تقارير اليوم</div></div>
      <div class="stat blue"><div class="num">${s.users.active}</div><div class="lbl">مستخدمون نشطون</div></div>
      <div class="stat amber"><div class="num">${s.tasks.done}/${s.tasks.total}</div><div class="lbl">مهام منجزة</div></div>
    </div>

    <div class="card">
      <h3>التقارير حسب الحالة</h3>
      <div class="bars">
        ${Object.entries(s.byStatus).map(([k, v]) => `
          <div class="bar-row">
            <span>${s.statusLabels[k]}</span>
            <div class="bar-track"><div class="bar-fill ${statusColors[k] || ''}" style="width:${(v / maxStatus) * 100}%"></div></div>
            <b>${v}</b>
          </div>`).join('')}
      </div>
    </div>

    <div class="card">
      <h3>التقارير حسب الدور</h3>
      <div class="bars">
        ${Object.entries(s.byRole).map(([k, v]) => `
          <div class="bar-row">
            <span>${s.roleLabels[k]}</span>
            <div class="bar-track"><div class="bar-fill blue" style="width:${(v / maxRole) * 100}%"></div></div>
            <b>${v}</b>
          </div>`).join('')}
      </div>
    </div>

    <div class="field-row">
      <div class="card">
        <h3>المساعدة الأمنية/اللوجستية</h3>
        <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin:0">
          <div class="stat green"><div class="num">${s.assistanceYes}</div><div class="lbl">تم تقديم مساعدة</div></div>
          <div class="stat"><div class="num">${s.totalReports - s.assistanceYes}</div><div class="lbl">بدون مساعدة</div></div>
        </div>
      </div>
      <div class="card">
        <h3>اتصال الإنترنت</h3>
        <div class="bars">
          ${Object.entries(s.internetSpeeds).map(([k, v]) => `
            <div class="bar-row">
              <span>${esc(k)}</span>
              <div class="bar-track"><div class="bar-fill green" style="width:${(v / speedMax) * 100}%"></div></div>
              <b>${v}</b>
            </div>`).join('') || '<div class="empty">لا بيانات</div>'}
        </div>
      </div>
    </div>

    <div class="field-row">
      <div class="card">
        <h3>🔄 الجولات والحوادث</h3>
        <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin:0">
          <div class="stat blue"><div class="num">${s.rounds?.total || 0}</div><div class="lbl">إجمالي الجولات</div></div>
          <div class="stat amber"><div class="num">${s.rounds?.late || 0}</div><div class="lbl">جولات متأخرة</div></div>
          <div class="stat green"><div class="num">${s.incidents?.yellow || 0}</div><div class="lbl">ملاحظات 🟡</div></div>
          <div class="stat" style="border-color:var(--red)"><div class="num" style="color:var(--red)">${s.incidents?.red || 0}</div><div class="lbl">حوادث طارئة 🔴</div></div>
        </div>
      </div>
      <div class="card">
        <h3>الحراسة والفريق</h3>
        <div class="stats-grid" style="grid-template-columns:1fr 1fr;margin:0">
          <div class="stat"><div class="num">${s.users.guards}</div><div class="lbl">حراس</div></div>
          <div class="stat blue"><div class="num">${s.users.commanders}</div><div class="lbl">قادة</div></div>
          <div class="stat amber"><div class="num">${s.users.supervisors}</div><div class="lbl">مشرفون</div></div>
          <div class="stat purple"><div class="num">${s.alertsUnread}</div><div class="lbl">تنبيهات جديدة</div></div>
        </div>
      </div>
    </div>`, 'لوحة الإحصائيات');

  document.getElementById('app').innerHTML = html;
}

/* ============ سجل التعديلات ============ */
export async function renderAudit() {
  const { entries } = await api.audit();
  const actionLabels = {
    settings_changed: '⚙️ تغيير إعدادات',
    user_created: '➕ إنشاء حساب',
    user_updated: '✏️ تعديل حساب',
    report_created: '📋 إنشاء تقرير',
    report_edited: '📝 تعديل تقرير',
    report_forwarded: '📤 إرسال تقرير',
    report_closed: '✅ غلق تقرير',
    report_note: '💬 ملاحظة',
    task_created: '📌 مهمة جديدة',
    task_updated: '📌 تحديث مهمة',
    shift_started: '▶️ بدء مناوبة',
    shift_ended: '🏁 إنهاء مناوبة',
    round_saved: '🔄 حفظ جولة',
    incident_recorded: '🚨 تسجيل حدث',
    backup_created: '💾 تنزيل نسخة احتياطية',
    restored: '⬆️ استرجاع نسخة'
  };

  const rows = entries.map(a => `
    <tr>
      <td>${esc(a.userName)}</td>
      <td>${actionLabels[a.action] || esc(a.action)}</td>
      <td>${esc(a.details || '')}</td>
      <td>${timeAgo(a.createdAt)}</td>
    </tr>`).join('');

  const html = shell(`
    <div class="card table-wrap">
      <h3>🧾 سجل التعديلات (للقراءة فقط)</h3>
      ${entries.length ? `<table>
        <thead><tr><th>المستخدم</th><th>الإجراء</th><th>التفاصيل</th><th>الوقت</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : '<div class="empty">لا توجد سجلات بعد</div>'}
    </div>
    <div class="card" style="font-size:13px;color:var(--muted)">
      كل عملية حساسة تُسجَّل هنا: تغيير الصلاحيات، الإعدادات، الحسابات، وتعديلات التقارير — ولا يمكن حذف السجل.
    </div>`, 'سجل التعديلات');

  document.getElementById('app').innerHTML = html;
}

/* ============ الإعدادات (شاملة — نظام + مناوبة SOS) ============ */
export async function renderSettings() {
  const { settings } = await api.settings();
  const points = settings.points || [];
  const shifts = settings.shifts || {};

  const pointsHtml = points.map((p, i) => `
    <div class="field-row" style="align-items:end;gap:8px;margin-bottom:8px" data-pt="${i}">
      <div class="field" style="margin:0"><label style="font-size:11.5px">عربي</label>
        <input data-pf="ar" value="${esc(p.ar)}" placeholder="اسم النقطة"></div>
      <div class="field" style="margin:0"><label style="font-size:11.5px">English</label>
        <input data-pf="en" value="${esc(p.en)}" dir="ltr" placeholder="English"></div>
      <div class="field" style="margin:0"><label style="font-size:11.5px">إلزام QR</label>
        <select data-pf="inRound"><option value="1" ${p.inRound ? 'selected' : ''}>نعم</option><option value="0" ${!p.inRound ? 'selected' : ''}>لا</option></select></div>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('[data-pt]').remove()" style="margin-bottom:2px">✕</button>
    </div>`).join('');

  const shiftRow = (k, s) => `
    <div class="field-row" style="gap:8px;margin-bottom:8px" data-sh="${k}">
      <div class="field" style="margin:0"><label style="font-size:11.5px">${esc(s.ar)}</label>
        <input data-sf="ar" value="${esc(s.ar)}"></div>
      <div class="field" style="margin:0"><label style="font-size:11.5px">من</label>
        <input data-sf="start" type="time" value="${esc(s.start)}"></div>
      <div class="field" style="margin:0"><label style="font-size:11.5px">إلى</label>
        <input data-sf="end" type="time" value="${esc(s.end)}"></div>
    </div>`;

  const html = shell(`
    <div class="card" style="max-width:680px">
      <h3>⚙️ إعدادات النظام</h3>
      <div class="card" style="background:#fffbeb;border:1px solid #fde68a;box-shadow:none;padding:12px 14px;font-size:13px;margin-bottom:16px">
        ⚠️ أي تغيير هنا يُرسل <b>تنبيهاً فورياً للأوفيسر</b> ويُسجَّل في سجل التعديلات.
      </div>
      <form id="set-form">
        <div class="field"><label>اسم المنشأة</label>
          <input name="orgName" value="${esc(settings.orgName)}" /></div>

        <div class="field-row">
          <div class="field"><label>سؤال المساعدة الأمنية/اللوجستية</label>
            <select name="assistanceQuestionEnabled">
              <option value="1" ${settings.assistanceQuestionEnabled ? 'selected' : ''}>مفعّل</option>
              <option value="0" ${!settings.assistanceQuestionEnabled ? 'selected' : ''}>معطّل</option>
            </select></div>
          <div class="field"><label>سؤال الاتصال بالإنترنت والسرعة</label>
            <select name="internetQuestionEnabled">
              <option value="1" ${settings.internetQuestionEnabled ? 'selected' : ''}>مفعّل</option>
              <option value="0" ${!settings.internetQuestionEnabled ? 'selected' : ''}>معطّل</option>
            </select></div>
        </div>

        <h3 style="margin-top:18px">📍 نقاط الحراسة</h3>
        <div id="points-list">${pointsHtml || '<div class="empty" style="padding:12px">لا توجد نقاط</div>'}</div>
        <button type="button" class="btn btn-ghost btn-sm" id="add-point">＋ إضافة نقطة</button>

        <h3 style="margin-top:18px">🕒 المناوبات</h3>
        ${Object.entries(shifts).map(([k, s]) => shiftRow(k, s)).join('')}

        <div class="field-row" style="margin-top:8px">
          <div class="field"><label>فاصل الجولات (دقيقة)</label>
            <input name="roundInterval" type="number" min="10" value="${settings.roundInterval || 120}" /></div>
          <div class="field"><label>رقم واتساب المشرف (دولي بدون +)</label>
            <input name="supPhone" value="${esc(settings.supPhone || '')}" dir="ltr" inputmode="numeric" placeholder="9705xxxxxxxx" /></div>
        </div>
        <div class="field"><label>بريد المشرف (اختياري)</label>
          <input name="supEmail" value="${esc(settings.supEmail || '')}" dir="ltr" type="email" /></div>

        <div class="field-row">
          <div class="field"><label>السماح بالتأكيد اليدوي بدل QR</label>
            <select name="allowManualQR"><option value="1" ${settings.allowManualQR !== false ? 'selected' : ''}>نعم</option><option value="0" ${settings.allowManualQR === false ? 'selected' : ''}>لا</option></select></div>
          <div class="field"><label>صوت تنبيه الجولات</label>
            <select name="sound"><option value="1" ${settings.sound !== false ? 'selected' : ''}>مفعّل</option><option value="0" ${settings.sound === false ? 'selected' : ''}>معطّل</option></select></div>
        </div>

        <button class="btn btn-primary" type="submit" style="width:auto;padding-inline:28px">💾 حفظ الإعدادات</button>
      </form>
    </div>

    <div class="card" style="max-width:680px">
      <h3>🖨 رموز QR للنقاط</h3>
      <p style="font-size:13px;color:var(--muted);margin-bottom:12px">اطبعها ولصقها عند كل نقطة — الحارس يمسحها بالكاميرا أثناء الجولة.</p>
      <div style="display:flex;gap:14px;flex-wrap:wrap">
        ${points.map(p => `
          <div style="text-align:center;background:#f8fafc;border:1px solid var(--line);border-radius:12px;padding:12px">
            <img src="${api.qrUrl(p.id)}" alt="QR" style="width:150px;background:#fff;padding:6px;border-radius:8px" />
            <div style="font-weight:700;font-size:13px;margin-top:6px">${esc(p.ar)}</div>
            <div style="font-size:11px;color:var(--muted)">SOSGUARD|${esc(p.id)}</div>
          </div>`).join('') || '<div class="empty">لا توجد نقاط</div>'}
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="window.print()">🖨 طباعة الصفحة</button>
    </div>

    <div class="card" style="max-width:680px">
      <h3>💾 النسخ الاحتياطي</h3>
      <div class="actions-row">
        <button class="btn btn-ghost" id="btn-backup">⬇️ تنزيل نسخة احتياطية</button>
        <button class="btn btn-ghost" id="btn-restore">⬆️ استرجاع من ملف</button>
      </div>
      <input type="file" id="restore-file" accept=".json,application/json" style="display:none" />
    </div>`, 'الإعدادات');

  document.getElementById('app').innerHTML = html;

  document.getElementById('add-point').onclick = () => {
    const list = document.getElementById('points-list');
    if (list.querySelector('.empty')) list.innerHTML = '';
    const i = list.children.length;
    const div = document.createElement('div');
    div.className = 'field-row';
    div.style.cssText = 'align-items:end;gap:8px;margin-bottom:8px';
    div.setAttribute('data-pt', i);
    div.innerHTML = `
      <div class="field" style="margin:0"><label style="font-size:11.5px">عربي</label><input data-pf="ar" placeholder="اسم النقطة"></div>
      <div class="field" style="margin:0"><label style="font-size:11.5px">English</label><input data-pf="en" dir="ltr" placeholder="English"></div>
      <div class="field" style="margin:0"><label style="font-size:11.5px">إلزام QR</label>
        <select data-pf="inRound"><option value="1" selected>نعم</option><option value="0">لا</option></select></div>
      <button type="button" class="btn btn-danger btn-sm" onclick="this.closest('[data-pt]').remove()" style="margin-bottom:2px">✕</button>`;
    list.appendChild(div);
  };

  document.getElementById('set-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const newPoints = [...document.querySelectorAll('[data-pt]')].map((row, i) => ({
      id: (points[i] && points[i].ar === row.querySelector('[data-pf=ar]').value && points[i].id)
        ? points[i].id
        : (points[i]?.id || 'p' + Date.now().toString(36) + i),
      ar: row.querySelector('[data-pf=ar]').value.trim(),
      en: row.querySelector('[data-pf=en]').value.trim(),
      inRound: row.querySelector('[data-pf=inRound]').value === '1'
    })).filter(p => p.ar);

    const newShifts = {};
    document.querySelectorAll('[data-sh]').forEach(row => {
      const k = row.getAttribute('data-sh');
      newShifts[k] = {
        ar: row.querySelector('[data-sf=ar]').value.trim() || shifts[k]?.ar || k,
        start: row.querySelector('[data-sf=start]').value || shifts[k]?.start || '07:00',
        end: row.querySelector('[data-sf=end]').value || shifts[k]?.end || '15:00'
      };
    });

    try {
      await api.updateSettings({
        orgName: fd.get('orgName'),
        assistanceQuestionEnabled: fd.get('assistanceQuestionEnabled') === '1',
        internetQuestionEnabled: fd.get('internetQuestionEnabled') === '1',
        points: newPoints,
        shifts: newShifts,
        roundInterval: Number(fd.get('roundInterval')),
        supPhone: String(fd.get('supPhone') || '').replace(/\D/g, ''),
        supEmail: fd.get('supEmail'),
        allowManualQR: fd.get('allowManualQR') === '1',
        sound: fd.get('sound') === '1'
      });
      state.orgName = fd.get('orgName');
      toast('تم الحفظ — أُرسل تنبيه للأوفيسر', 'ok');
      renderSettings();
    } catch (err) { toast(err.message, 'err'); }
  };

  document.getElementById('btn-backup').onclick = async () => {
    try {
      const blob = await api.backup();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'security-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast('تم التنزيل', 'ok');
    } catch (e) { toast(e.message, 'err'); }
  };
  document.getElementById('btn-restore').onclick = () => document.getElementById('restore-file').click();
  document.getElementById('restore-file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('سيتم استبدال البيانات الحالية بالنسخة المسترجعة. متأكد؟')) return;
      await api.restore(data);
      toast('✅ تم الاسترجاع', 'ok');
      renderSettings();
    } catch (err) { toast('ملف غير صالح', 'err'); }
  };
}

/* ============ مودال عام ============ */
function openModal(inner) {
  let bg = document.getElementById('modal-bg');
  if (!bg) {
    bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.id = 'modal-bg';
    document.body.appendChild(bg);
  }
  bg.innerHTML = `<div class="modal">
    <button class="close-x" onclick="window.__closeModal()">✕</button>
    ${inner}</div>`;
  bg.classList.add('open');
  bg.onclick = (e) => { if (e.target === bg) window.__closeModal(); };
}
// __closeModal معرّف في app.js
