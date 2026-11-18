/* عميل الـ API */
const BASE = '/api';

function getToken() { return localStorage.getItem('token') || ''; }
function setToken(t) { t ? localStorage.setItem('token', t) : localStorage.removeItem('token'); }

async function request(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    },
    body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401 && !path.startsWith('/auth/login')) {
    setToken('');
    localStorage.removeItem('user');
    location.hash = '#/login';
    throw new Error(data.error || 'انتهت الجلسة');
  }
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}

export const api = {
  login: (username, password) => request('POST', '/auth/login', { username, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => request('GET', '/auth/me'),

  dashboard: () => request('GET', '/dashboard'),

  reports: (q = '') => request('GET', '/reports' + q),
  report: (id) => request('GET', `/reports/${id}`),
  createReport: (formData) => request('POST', '/reports', { formData }),
  updateReport: (id, formData) => request('PUT', `/reports/${id}`, { formData }),
  forwardReport: (id) => request('POST', `/reports/${id}/forward`),
  addNote: (id, text) => request('POST', `/reports/${id}/notes`, { text }),

  // المناوبة (من SOS Guard)
  startShift: (pointId, shiftKey) => request('POST', '/shifts/start', { pointId, shiftKey }),
  activeShift: () => request('GET', '/shifts/active'),
  saveRound: (id, round) => request('POST', `/reports/${id}/rounds`, { round }),
  saveIncident: (id, incident) => request('POST', `/reports/${id}/incidents`, { incident }),
  endShift: (id, payload) => request('POST', `/reports/${id}/end`, payload),

  users: () => request('GET', '/users'),
  guards: () => request('GET', '/guards'),
  createUser: (payload) => request('POST', '/users', payload),
  updateUser: (id, payload) => request('PUT', `/users/${id}`, payload),
  permLabels: () => request('GET', '/permissions/labels'),

  tasks: () => request('GET', '/tasks'),
  createTask: (payload) => request('POST', '/tasks', payload),
  updateTask: (id, payload) => request('PUT', `/tasks/${id}`, payload),

  alerts: () => request('GET', '/alerts'),
  readAlert: (id) => request('POST', `/alerts/${id}/read`),
  readAllAlerts: () => request('POST', '/alerts/read-all'),

  audit: () => request('GET', '/audit'),
  stats: () => request('GET', '/stats'),

  settings: () => request('GET', '/settings'),
  updateSettings: (settings) => request('PUT', '/settings', { settings }),

  backup: () => fetch(BASE + '/backup', { headers: { 'Authorization': `Bearer ${getToken()}` } })
    .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'فشل'); return r.blob(); }),
  restore: (data) => request('POST', '/restore', data),

  qrUrl: (pointId) => `${BASE}/points/${encodeURIComponent(pointId)}/qr.svg`
};

export { getToken, setToken };
