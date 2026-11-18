/* الموجّه والهيكل الرئيسي */
import { api, getToken, setToken } from './api.js';
import { renderLogin } from './views/auth.js';
import { renderReports, renderReportForm, renderReportDetail } from './views/reports.js';
import { renderDashboard, renderUsers, renderTasks, renderStats, renderAudit, renderSettings } from './views/admin.js';
import { renderShiftStart, renderShiftDash, renderRound, renderIncident, renderEndShift } from './views/shift.js';

export const ROLE_LABELS = { guard: 'حارس', commander: 'قائد', supervisor: 'مشرف', officer: 'أوفيسر' };

export const state = {
  user: null,
  alerts: [],
  route: ''
};

/* ---------- أدوات عامة ---------- */
export function toast(msg, type = '') {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function timeAgo(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'الآن';
  if (d < 3600) return `قبل ${Math.floor(d / 60)} د`;
  if (d < 86400) return `قبل ${Math.floor(d / 3600)} س`;
  return `قبل ${Math.floor(d / 86400)} يوم`;
}

/* ---------- التنقل ---------- */
const routes = {
  '#/login': () => renderLogin(),
  '#/dashboard': () => renderDashboard(),
  '#/reports': () => renderReports(),
  '#/reports/new': () => renderReportForm(null),
  '#/reports/edit': (id) => renderReportForm(id),
  '#/reports/detail': (id) => renderReportDetail(id),
  '#/shift/start': () => renderShiftStart(),
  '#/shift': (id, sub) => {
    if (sub === 'round') return renderRound(id);
    if (sub === 'incident') return renderIncident(id);
    if (sub === 'end') return renderEndShift(id);
    return renderShiftDash(id);
  },
  '#/users': () => renderUsers(),
  '#/tasks': () => renderTasks(),
  '#/stats': () => renderStats(),
  '#/audit': () => renderAudit(),
  '#/settings': () => renderSettings()
};

export function go(hash) { location.hash = hash; }

async function router() {
  const hash = location.hash || '#/dashboard';
  if (hash === '#/login' || !getToken()) {
    if (!getToken()) { location.hash = '#/login'; return renderLogin(); }
  }
  if (!state.user) {
    try {
      const { user } = await api.me();
      state.user = user;
    } catch {
      location.hash = '#/login';
      return renderLogin();
    }
  }
  // parse: #/reports/detail/5 · #/shift/12/round
  const parts = hash.replace(/^#\//, '').split('/');
  let key = '#/' + parts[0];
  let id = null, sub = null;
  if (parts[0] === 'reports') {
    if (parts[1] === 'detail' || parts[1] === 'edit') { key = '#/reports/' + parts[1]; id = parts[2]; }
    else if (parts[1] === 'new') key = '#/reports/new';
  } else if (parts[0] === 'shift') {
    if (parts[1] === 'start') key = '#/shift/start';
    else { key = '#/shift'; id = parts[1]; sub = parts[2] || null; }
  }
  const fn = routes[key];
  if (!fn) { location.hash = '#/dashboard'; return; }
  state.route = key;
  try {
    await fn(id, sub);
  } catch (e) {
    console.error(e);
    document.getElementById('app').innerHTML =
      `<div class="login-page"><div class="login-card">
        <h1>تعذّر عرض الصفحة</h1>
        <div class="sub">${esc(e.message || 'خطأ غير متوقع')}</div>
        <button class="btn btn-primary" onclick="location.hash='#/dashboard'">العودة للرئيسية</button>
      </div></div>`;
    return;
  }
  refreshShell();
  window.scrollTo(0, 0);
}

/* ---------- الهيكل ---------- */
function navItems() {
  const u = state.user;
  const p = u.permissions || {};
  const items = [
    { hash: '#/dashboard', ico: '🏠', label: 'الرئيسية' },
    { hash: '#/reports', ico: '📋', label: 'التقارير' }
  ];
  if (p.distribute_tasks || u.role === 'guard') items.push({ hash: '#/tasks', ico: '📌', label: 'المهام' });
  if (p.manage_users || p.manage_permissions) items.push({ hash: '#/users', ico: '👥', label: 'الحسابات' });
  if (p.view_stats) items.push({ hash: '#/stats', ico: '📊', label: 'الإحصائيات' });
  if (p.view_audit) items.push({ hash: '#/audit', ico: '🧾', label: 'سجل التعديلات' });
  if (p.manage_settings) items.push({ hash: '#/settings', ico: '⚙️', label: 'الإعدادات' });
  return items;
}

export function shell(inner, title) {
  const u = state.user;
  const unread = state.alerts.filter(a => !a.read).length;
  const p = u.permissions || {};
  const items = navItems().map(it => `
    <a href="${it.hash}" class="${state.route === it.hash || (it.hash === '#/reports' && state.route.startsWith('#/reports')) ? 'active' : ''}">
      <span class="ico">${it.ico}</span>${it.label}
    </a>`).join('');

  return `
  <div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <div class="logo"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill="#0f2744"/><path d="M9 12l2 2 4-4" stroke="#f59e0b" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div><strong>تقارير الأمن</strong><span>${esc(state.orgName || '')}</span></div>
      </div>
      <nav class="nav">${items}</nav>
      <div class="whoami">
        <div class="nm">${esc(u.name)}</div>
        <div class="rl">${ROLE_LABELS[u.role]} · ${esc(u.username)}</div>
        <button onclick="window.__logout()">تسجيل الخروج</button>
      </div>
    </aside>
    <div class="overlay" id="overlay" onclick="window.__closeMenu()"></div>
    <div class="main">
      <header class="topbar">
        <button class="menu-btn" onclick="window.__openMenu()">☰</button>
        <h2>${esc(title)}</h2>
        ${p.view_alerts ? `<button class="bell" onclick="window.__toggleAlerts()" title="التنبيهات">🔔${unread ? `<span class="cnt">${unread}</span>` : ''}</button>` : ''}
      </header>
      <div class="content" id="content">${inner}</div>
    </div>
    <div class="alerts-panel" id="alerts-panel">${alertsHtml()}</div>
  </div>`;
}

function alertsHtml() {
  if (!state.alerts.length) return `<div class="hd">التنبيهات</div><div class="empty">لا توجد تنبيهات</div>`;
  return `<div class="hd">التنبيهات <button onclick="window.__readAllAlerts()">تعليم الكل كمقروء</button></div>
    ${state.alerts.slice(0, 30).map(a => `
      <div class="alert-item ${a.read ? '' : 'unread'}">
        <div class="tp">${alertTypeLabel(a.type)}</div>
        <div>${esc(a.message)}</div>
        <div class="t">${timeAgo(a.createdAt)}</div>
      </div>`).join('')}`;
}

function alertTypeLabel(t) {
  return {
    settings_changed: '⚙️ تغيير إعدادات',
    user_created: '➕ حساب جديد',
    user_updated: '✏️ تعديل حساب',
    report_edited: '📝 تعديل تقرير',
    permissions_changed: '🔒 تغيير صلاحيات'
  }[t] || 'تنبيه';
}

export function refreshShell() {
  // تحديث شارة التنبيهات بدون إعادة رسم كاملة
  const panel = document.getElementById('alerts-panel');
  if (panel) panel.innerHTML = alertsHtml();
  const bell = document.querySelector('.bell');
  if (bell && state.user?.permissions?.view_alerts) {
    const unread = state.alerts.filter(a => !a.read).length;
    bell.innerHTML = `🔔${unread ? `<span class="cnt">${unread}</span>` : ''}`;
  }
}

/* ---------- أحداث عامة ---------- */
window.__modal = (h) => {
  let bg = document.getElementById('modal-bg');
  if (!bg) {
    bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.id = 'modal-bg';
    document.body.appendChild(bg);
  }
  bg.innerHTML = `<div class="modal"><button class="close-x" onclick="window.__closeModal()">✕</button>${h}</div>`;
  bg.classList.add('open');
  bg.onclick = (e) => { if (e.target === bg) window.__closeModal(); };
};
window.__closeModal = () => document.getElementById('modal-bg')?.classList.remove('open');

window.__openMenu = () => {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('overlay')?.classList.add('open');
};
window.__closeMenu = () => {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('open');
};
window.__toggleAlerts = () => document.getElementById('alerts-panel')?.classList.toggle('open');
window.__readAllAlerts = async () => {
  try { await api.readAllAlerts(); state.alerts.forEach(a => a.read = true); refreshShell(); } catch (e) { toast(e.message, 'err'); }
};
window.__logout = async () => {
  try { await api.logout(); } catch {}
  setToken('');
  localStorage.removeItem('user');
  state.user = null;
  location.hash = '#/login';
};

/* ---------- الإقلاع ---------- */
async function boot() {
  if (getToken()) {
    try {
      const { user } = await api.me();
      state.user = user;
      if (user.permissions?.view_alerts) {
        try { state.alerts = (await api.alerts()).alerts; } catch {}
      }
      try {
        const { settings } = await api.settings();
        state.orgName = settings.orgName;
      } catch {}
    } catch {}
  }
  window.addEventListener('hashchange', router);
  router();
}
boot();
