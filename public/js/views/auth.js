/* شاشة تسجيل الدخول */
import { api, setToken } from '../api.js';
import { toast, state } from '../app.js';

export function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
  <div class="login-page">
    <div class="login-card">
      <div class="login-logo">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 2L4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill="#f59e0b"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h1>منظومة تقارير الأمن</h1>
      <div class="sub">سجّل الدخول حسب دورك في السلسلة</div>
      <form id="login-form">
        <div class="field">
          <label>اسم المستخدم</label>
          <input name="username" autocomplete="username" required placeholder="username" />
        </div>
        <div class="field">
          <label>كلمة المرور</label>
          <input name="password" type="password" autocomplete="current-password" required placeholder="••••" />
        </div>
        <button class="btn btn-primary" type="submit">دخول</button>
      </form>
      <div class="demo-box">
        حسابات تجريبية (كلمة المرور <b>1234</b>) — اضغط على الاسم:<br/>
        <b data-u="officer">أوفيسر</b> · <b data-u="supervisor">مشرف</b> · <b data-u="commander">قائد</b> · <b data-u="guard1">حارس</b>
      </div>
    </div>
  </div>`;

  document.querySelectorAll('.demo-box b[data-u]').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelector('[name=username]').value = el.dataset.u;
      document.querySelector('[name=password]').value = '1234';
    });
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const fd = new FormData(e.target);
      const { token, user } = await api.login(fd.get('username').trim(), fd.get('password'));
      setToken(token);
      state.user = user;
      if (user.permissions?.view_alerts) {
        try { state.alerts = (await api.alerts()).alerts; } catch {}
      }
      try {
        const { settings } = await api.settings();
        state.orgName = settings.orgName;
      } catch {}
      toast(`أهلاً ${user.name}`, 'ok');
      location.hash = '#/dashboard';
    } catch (err) {
      toast(err.message, 'err');
      btn.disabled = false;
    }
  });
}
