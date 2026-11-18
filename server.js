/* ============================================================
   منظومة تقارير الأمن — REST API
   الأدوار: guard < commander < supervisor < officer
   ============================================================ */
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

app.use(express.json({ limit: '12mb' })); // للصور المضغوطة داخل التقارير
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- قاعدة البيانات (JSON) ---------------- */
function defaultSettings() {
  return {
    orgName: 'شركة الحراسة الأمنية',
    assistanceQuestionEnabled: true,
    internetQuestionEnabled: true,
    // — إعدادات المناوبة (من SOS Guard) —
    points: [
      { id: 'gate', ar: 'البوابة', en: 'Main Gate', inRound: true },
      { id: 'bldg', ar: 'بجوار المبنى', en: 'Beside the Building', inRound: true }
    ],
    shifts: {
      M: { ar: 'صباحي', start: '07:00', end: '15:00' },
      E: { ar: 'مسائي', start: '15:00', end: '23:00' },
      N: { ar: 'ليلي', start: '23:00', end: '07:00' }
    },
    roundInterval: 120,          // دقائق بين الجولات
    supPhone: '',                // واتساب المشرف (للتنبيهات الفورية)
    supEmail: '',
    allowManualQR: true,
    sound: true,
    wake: true,
    matrix: false
  };
}

function defaultDb() {
  return {
    settings: defaultSettings(),
    users: [],
    sessions: {},
    reports: [],
    tasks: [],
    audit: [],
    alerts: [],
    seq: { report: 0, task: 0, user: 0, audit: 0, alert: 0 }
  };
}

let db;
try {
  db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  // ترحيل الإعدادات القديمة
  db.settings = { ...defaultSettings(), ...(db.settings || {}) };
} catch {
  db = defaultDb();
}

function saveDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

/* ---------------- الصلاحيات ---------------- */
// قواعد ثابتة (لا يمكن كسرها):
//  - الحارس: تقاريره فقط
//  - القائد: يقرأ تقارير الحراس فقط (بدون تعديل) — GOLDEN RULE
//  - المشرف: يعدل تقارير الحراس والقادة + يوزع المهام + يدير حسابات القادة والحراس
//  - الأوفيسر: كل الصلاحيات + الإعدادات + التنبيهات + الإحصائيات
const ROLE_DEFAULTS = {
  guard: {
    own_reports: 'edit', guard_reports: 'none', commander_reports: 'none',
    distribute_tasks: false, manage_users: false, manage_permissions: false,
    view_stats: false, view_audit: false, view_alerts: false, manage_settings: false
  },
  commander: {
    own_reports: 'edit', guard_reports: 'view', commander_reports: 'none',
    distribute_tasks: false, manage_users: false, manage_permissions: false,
    view_stats: false, view_audit: false, view_alerts: false, manage_settings: false
  },
  supervisor: {
    own_reports: 'edit', guard_reports: 'edit', commander_reports: 'edit',
    distribute_tasks: true, manage_users: true, manage_permissions: true,
    view_stats: false, view_audit: false, view_alerts: false, manage_settings: false
  },
  officer: {
    own_reports: 'edit', guard_reports: 'edit', commander_reports: 'edit',
    distribute_tasks: true, manage_users: true, manage_permissions: true,
    view_stats: true, view_audit: true, view_alerts: true, manage_settings: true
  }
};

const PERMISSION_LABELS = {
  own_reports: 'تعديل تقاريره الخاصة',
  guard_reports: 'تقارير الحراس (عرض/تعديل)',
  commander_reports: 'تقارير القادة (عرض/تعديل)',
  distribute_tasks: 'توزيع الحراس والمهام',
  manage_users: 'إنشاء وإدارة الحسابات',
  manage_permissions: 'تحديد الصلاحيات',
  view_stats: 'لوحة الإحصائيات',
  view_audit: 'سجل التعديلات',
  view_alerts: 'التنبيهات',
  manage_settings: 'تغيير الإعدادات'
};

// مفاتيح يسمح للأوفيسر بتعديلها لأي دور، وللمشرف لحسابات القادة/الحراس
const TOGGLEABLE = [
  'distribute_tasks', 'manage_users', 'manage_permissions',
  'view_stats', 'view_audit', 'view_alerts', 'manage_settings'
];

function effectivePerms(user) {
  const base = { ...ROLE_DEFAULTS[user.role] };
  const ov = user.overrides || {};
  for (const k of Object.keys(ov)) {
    if (k in base) base[k] = !!ov[k];
  }
  // قواعد ذهبية تُفرض دائماً
  if (user.role === 'guard') {
    base.guard_reports = 'none';
    base.commander_reports = 'none';
    base.distribute_tasks = false;
    base.manage_users = false;
    base.manage_permissions = false;
    base.view_stats = false;
    base.view_audit = false;
    base.view_alerts = false;
    base.manage_settings = false;
  }
  if (user.role === 'commander') {
    if (base.guard_reports === 'edit') base.guard_reports = 'view'; // لا تعديل أبداً
    base.commander_reports = 'none';
    base.manage_users = false;
    base.manage_permissions = false;
    base.manage_settings = false;
    base.view_alerts = false;
  }
  if (user.role === 'supervisor') {
    base.guard_reports = 'edit';
    base.commander_reports = 'edit';
    base.manage_settings = false; // الإعدادات للأوفيسر فقط
  }
  if (user.role === 'officer') {
    return { ...ROLE_DEFAULTS.officer };
  }
  return base;
}

function can(user, key) {
  const p = effectivePerms(user);
  return !!p[key];
}

function permLevel(user, key) { // 'none' | 'view' | 'edit'
  const p = effectivePerms(user);
  return p[key] || 'none';
}

/* ---------------- أدوات مساعدة ---------------- */
function audit(action, userId, details, oldValue, newValue) {
  db.seq.audit++;
  db.audit.unshift({
    id: db.seq.audit,
    userId, action, details,
    oldValue: oldValue !== undefined ? oldValue : null,
    newValue: newValue !== undefined ? newValue : null,
    createdAt: new Date().toISOString()
  });
  if (db.audit.length > 500) db.audit.length = 500;
}

function alertOfficer(type, message, userId) {
  // تنبيه يصل لكل الأوفيسرين ولمن يملك view_alerts
  db.seq.alert++;
  db.alerts.unshift({
    id: db.seq.alert, type, message, userId,
    read: false, createdAt: new Date().toISOString()
  });
  if (db.alerts.length > 200) db.alerts.length = 200;
}

function publicUser(u) {
  const { passwordHash, ...rest } = u;
  return { ...rest, permissions: effectivePerms(u) };
}

function findUser(id) { return db.users.find(u => u.id === id); }

function authRequired(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const sess = token && db.sessions[token];
  if (!sess || sess.expiresAt < Date.now()) {
    return res.status(401).json({ error: 'يرجى تسجيل الدخول' });
  }
  const user = findUser(sess.userId);
  if (!user || !user.active) return res.status(401).json({ error: 'الحساب غير مفعّل' });
  req.user = user;
  req.token = token;
  next();
}

function requirePerm(key, level = true) {
  return (req, res, next) => {
    if (!can(req.user, key)) {
      return res.status(403).json({ error: 'ليست لديك صلاحية لهذه العملية' });
    }
    next();
  };
}

/* ================= البيانات الأولية (Seed) ================= */
function seed() {
  if (db.users.length > 0) return;
  const mk = (id, username, name, role, password) => ({
    id, username, name, role,
    passwordHash: hashPassword(password),
    overrides: {}, active: true,
    createdAt: new Date().toISOString()
  });
  db.users = [
    mk(1, 'officer', 'أحمد الأوفيسر', 'officer', '1234'),
    mk(2, 'supervisor', 'سالم المشرف', 'supervisor', '1234'),
    mk(3, 'commander', 'خالد القائد', 'commander', '1234'),
    mk(4, 'guard1', 'وليد الحارس', 'guard', '1234')
  ];
  db.seq.user = 4;

  // تقرير تجريبي: الحارس أرسله للقائد
  db.seq.report = 1;
  db.reports.push({
    id: 1,
    authorId: 4,
    authorRole: 'guard',
    number: 'R-0001',
    status: 'with_commander',
    formData: {
      date: new Date().toISOString().slice(0, 10),
      shift: 'مسائية',
      location: 'البوابة الرئيسية',
      events: 'جولة راجعة — لا ملاحظات تذكر',
      patrols: 'جولة الساعة 18:00 و20:00',
      assistance_provided: 'no',
      assistance_type: '',
      internet_connection: 'yes',
      internet_speed: 'جيد',
      notes: ''
    },
    history: [
      { by: 4, byRole: 'guard', action: 'created', at: new Date().toISOString() },
      { by: 4, byRole: 'guard', action: 'forwarded_to_commander', at: new Date().toISOString() }
    ],
    notes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  saveDb();
}
seed();

/* ================= المصادقة ================= */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find(u => u.username === username && u.active);
  if (!user || !verifyPassword(password || '', user.passwordHash)) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  db.sessions[token] = { userId: user.id, expiresAt: Date.now() + 7 * 24 * 3600 * 1000 };
  saveDb();
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', authRequired, (req, res) => {
  delete db.sessions[req.token];
  saveDb();
  res.json({ ok: true });
});

app.get('/api/auth/me', authRequired, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

/* ================= التقارير ================= */
function canViewReport(user, report) {
  const p = effectivePerms(user);
  if (report.authorId === user.id) return true;
  if (report.authorRole === 'guard' && p.guard_reports !== 'none') return true;
  if (report.authorRole === 'commander' && p.commander_reports !== 'none') return true;
  if (report.authorRole === 'supervisor' && (p.commander_reports !== 'none' || user.role === 'officer')) return true;
  if (user.role === 'officer') return true;
  if (user.role === 'supervisor') return true;
  return false;
}

function canEditReport(user, report) {
  if (user.role === 'officer') return true;
  if (report.authorId === user.id) {
    // المؤلف يعدّل ما دام التقرير لديه (لم يُرحَّل بعد)
    if (report.status === 'with_guard' && user.role === 'guard') return true;
    if (report.status === 'with_commander' && user.role === 'commander') return true;
    if (report.status === 'with_supervisor' && user.role === 'supervisor') return true;
    if (report.status === 'with_officer' && user.role === 'officer') return true;
    // المشرف يعدّل تقريره الخاص في أي وقت
    if (user.role === 'supervisor') return true;
    return false;
  }
  if (user.role === 'supervisor') {
    return report.authorRole === 'guard' || report.authorRole === 'commander';
  }
  // القائد لا يعدّل تقارير الحارس إطلاقاً
  return false;
}

function canForwardReport(user, report) {
  // لا إرسال ما دام المناوبة نشطة
  if (report.formData && report.formData.phase === 'active') return null;
  if (report.status === 'with_guard' && report.authorId === user.id && user.role === 'guard') return 'commander';
  if (report.status === 'with_commander' && user.role === 'commander') return 'supervisor';
  if (report.status === 'with_supervisor' && user.role === 'supervisor') return 'officer';
  if (user.role === 'officer' && report.status === 'with_officer') return 'closed';
  return null;
}

const STATUS_LABELS = {
  with_guard: 'مع الحارس',
  with_commander: 'مع القائد',
  with_supervisor: 'مع المشرف',
  with_officer: 'مع الأوفيسر',
  closed: 'مغلق'
};

app.get('/api/reports', authRequired, (req, res) => {
  let list = db.reports.filter(r => canViewReport(req.user, r));
  if (req.query.status) list = list.filter(r => r.status === req.query.status);
  if (req.query.mine === '1') list = list.filter(r => r.authorId === req.user.id);
  res.json({
    reports: list.map(r => ({
      ...r,
      authorName: (findUser(r.authorId) || {}).name || '?',
      statusLabel: STATUS_LABELS[r.status]
    }))
  });
});

app.get('/api/reports/:id', authRequired, (req, res) => {
  const report = db.reports.find(r => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  if (!canViewReport(req.user, report)) return res.status(403).json({ error: 'غير مصرح لك بعرض هذا التقرير' });
  res.json({
    report: {
      ...report,
      authorName: (findUser(report.authorId) || {}).name || '?',
      statusLabel: STATUS_LABELS[report.status],
      canEdit: canEditReport(req.user, report),
      canForward: !!canForwardReport(req.user, report),
      forwardTo: canForwardReport(req.user, report)
    }
  });
});

app.post('/api/reports', authRequired, (req, res) => {
  const { formData } = req.body || {};
  if (!formData || typeof formData !== 'object') {
    return res.status(400).json({ error: 'بيانات التقرير مطلوبة' });
  }
  db.seq.report++;
  const now = new Date().toISOString();
  const report = {
    id: db.seq.report,
    authorId: req.user.id,
    authorRole: req.user.role,
    number: 'R-' + String(db.seq.report).padStart(4, '0'),
    status: req.user.role === 'guard' ? 'with_guard' : req.user.role === 'commander' ? 'with_commander' : req.user.role === 'supervisor' ? 'with_supervisor' : 'with_officer',
    formData,
    history: [{ by: req.user.id, byRole: req.user.role, action: 'created', at: now }],
    notes: [],
    createdAt: now,
    updatedAt: now
  };
  db.reports.unshift(report);
  audit('report_created', req.user.id, `إنشاء تقرير ${report.number}`);
  saveDb();
  res.status(201).json({ report });
});

app.put('/api/reports/:id', authRequired, (req, res) => {
  const report = db.reports.find(r => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  if (!canEditReport(req.user, report)) {
    return res.status(403).json({ error: 'لا تملك صلاحية تعديل هذا التقرير' });
  }
  const oldData = { ...report.formData };
  report.formData = { ...report.formData, ...(req.body.formData || {}) };
  report.updatedAt = new Date().toISOString();
  report.history.push({ by: req.user.id, byRole: req.user.role, action: 'edited', at: report.updatedAt });
  audit('report_edited', req.user.id, `تعديل تقرير ${report.number}`, oldData, report.formData);
  // تنبيه الأوفيسر عند تعديل تقرير من طرف غير صاحبه (المشرف يعدّل تقارير القادة/الحراس)
  if (report.authorId !== req.user.id && req.user.role !== 'officer') {
    alertOfficer('report_edited', `${req.user.name} عدّل تقرير ${report.number} (صاحب التقرير: ${(findUser(report.authorId) || {}).name})`, req.user.id);
  }
  saveDb();
  res.json({ report });
});

app.post('/api/reports/:id/forward', authRequired, (req, res) => {
  const report = db.reports.find(r => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  const to = canForwardReport(req.user, report);
  if (!to) return res.status(403).json({ error: 'لا يمكنك إرسال هذا التقرير الآن' });
  const now = new Date().toISOString();
  if (to === 'closed') {
    report.status = 'closed';
    report.history.push({ by: req.user.id, byRole: req.user.role, action: 'closed', at: now });
    audit('report_closed', req.user.id, `غلق تقرير ${report.number}`);
  } else {
    report.status = 'with_' + to;
    report.history.push({ by: req.user.id, byRole: req.user.role, action: 'forwarded_to_' + to, at: now });
    audit('report_forwarded', req.user.id, `إرسال تقرير ${report.number} إلى ${STATUS_LABELS['with_' + to]}`);
  }
  report.updatedAt = now;
  saveDb();
  res.json({ report, statusLabel: STATUS_LABELS[report.status] });
});

app.post('/api/reports/:id/notes', authRequired, (req, res) => {
  const report = db.reports.find(r => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  if (!canViewReport(req.user, report)) return res.status(403).json({ error: 'غير مصرح' });
  const text = (req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'النص مطلوب' });
  report.notes.push({ by: req.user.id, byName: req.user.name, byRole: req.user.role, text, at: new Date().toISOString() });
  report.updatedAt = new Date().toISOString();
  audit('report_note', req.user.id, `إضافة ملاحظة على تقرير ${report.number}`);
  saveDb();
  res.json({ report });
});

/* ============ المناوبة: بدء/جولات/حوادث/إنهاء ============ */
function canWorkOnShift(user, report) {
  // المؤلف أثناء نشاط المناوبة + المشرف والأوفيسر دائماً
  if (user.role === 'officer') return true;
  if (user.role === 'supervisor') return true;
  return report.authorId === user.id && report.status === 'with_guard';
}

// بدء مناوبة → إنشاء تقرير نشط
app.post('/api/shifts/start', authRequired, (req, res) => {
  if (req.user.role !== 'guard' && req.user.role !== 'commander') {
    return res.status(403).json({ error: 'بدء المناوبة للحراس (والقادة)' });
  }
  const active = db.reports.find(r =>
    r.authorId === req.user.id && r.formData && r.formData.phase === 'active' && r.status === 'with_guard');
  if (active) return res.status(400).json({ error: 'لديك مناوبة نشطة بالفعل', reportId: active.id });

  const { pointId, shiftKey } = req.body || {};
  const st = db.settings;
  const point = (st.points || []).find(p => p.id === pointId) || (st.points || [])[0];
  const shift = (st.shifts || {})[shiftKey] || st.shifts?.M;
  if (!point) return res.status(400).json({ error: 'لا توجد نقاط حراسة — يرجى إضافة نقاط من الإعدادات' });

  db.seq.report++;
  const now = Date.now();
  const report = {
    id: db.seq.report,
    authorId: req.user.id,
    authorRole: req.user.role,
    number: 'R-' + String(db.seq.report).padStart(4, '0'),
    status: 'with_guard',
    formData: {
      phase: 'active',
      date: new Date(now).toISOString().slice(0, 10),
      shift: shift?.ar || 'صباحية',
      shiftKey: shiftKey || 'M',
      pointId: point.id,
      location: point.ar,
      startTs: now,
      rounds: [],
      incidents: [],
      events: '',
      patrols: '',
      assistance_provided: '',
      assistance_type: '',
      internet_connection: '',
      internet_speed: '',
      notes: ''
    },
    history: [{ by: req.user.id, byRole: req.user.role, action: 'shift_started', at: new Date().toISOString() }],
    notes: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.reports.unshift(report);
  audit('shift_started', req.user.id, `بدء مناوبة ${report.number} — ${point.ar}`);
  saveDb();
  res.status(201).json({ report });
});

// المناوبة النشطة للمستخدم
app.get('/api/shifts/active', authRequired, (req, res) => {
  const active = db.reports.find(r =>
    r.authorId === req.user.id && r.formData && r.formData.phase === 'active' && r.status === 'with_guard');
  res.json({ report: active || null });
});

// حفظ جولة فحص
app.post('/api/reports/:id/rounds', authRequired, (req, res) => {
  const report = db.reports.find(r => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  if (!report.formData || report.formData.phase !== 'active') {
    return res.status(400).json({ error: 'المناوبة غير نشطة' });
  }
  if (!canWorkOnShift(req.user, report)) return res.status(403).json({ error: 'ليست لديك صلاحية' });

  const round = req.body.round || {};
  const st = db.settings;
  round.ts = Date.now();
  round.gps = round.gps || null;
  round.qr = round.qr || {};
  round.items = round.items || {};
  round.power = round.power || '';
  round.internet_connection = round.internet_connection || '';
  round.internet_speed = round.internet_speed || '';
  round.visitors = Number(round.visitors) || 0;
  round.vehicles = Number(round.vehicles) || 0;
  const last = report.formData.rounds.length
    ? report.formData.rounds[report.formData.rounds.length - 1].ts
    : (report.formData.startTs || round.ts);
  round.due = last + (st.roundInterval || 120) * 60000;
  round.late = Math.max(0, round.ts - round.due);

  report.formData.rounds.push(round);
  report.updatedAt = new Date().toISOString();
  report.history.push({ by: req.user.id, byRole: req.user.role, action: 'round_saved', at: report.updatedAt });
  audit('round_saved', req.user.id, `حفظ جولة #${report.formData.rounds.length} في ${report.number}`);
  saveDb();
  res.status(201).json({ report, roundNo: report.formData.rounds.length });
});

// تسجيل حدث/حادث
app.post('/api/reports/:id/incidents', authRequired, (req, res) => {
  const report = db.reports.find(r => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  if (!report.formData || report.formData.phase !== 'active') {
    return res.status(400).json({ error: 'المناوبة غير نشطة' });
  }
  if (!canWorkOnShift(req.user, report)) return res.status(403).json({ error: 'ليست لديك صلاحية' });

  const inc = req.body.incident || {};
  if (!inc.level || !['y', 'r'].includes(inc.level)) return res.status(400).json({ error: 'مستوى الحدث مطلوب' });
  if (!inc.type) return res.status(400).json({ error: 'نوع الحدث مطلوب' });
  if (!inc.desc || !inc.action) return res.status(400).json({ error: 'الوصف والإجراء مطلوبان' });

  inc.ts = inc.ts || Date.now();
  inc.rec = Date.now();
  report.formData.incidents.push(inc);
  report.updatedAt = new Date().toISOString();
  report.history.push({ by: req.user.id, byRole: req.user.role, action: 'incident_' + inc.level, at: report.updatedAt });
  audit('incident_recorded', req.user.id,
    `تسجيل حدث ${inc.level === 'r' ? 'طارئ 🔴' : 'ملاحظة 🟡'} (${inc.type}) في ${report.number}`);

  // تنبيه فوري للأوفيسر عند الحادث الأحمر
  let alertSent = false;
  if (inc.level === 'r') {
    alertOfficer('incident_red', `${req.user.name} سجّل حادثاً أمنياً طارئاً (${inc.type}) في ${report.number}: ${inc.desc.slice(0, 80)}`, req.user.id);
    alertSent = true;
  }
  saveDb();
  res.status(201).json({ report, alertSent });
});

// إنهاء المناوبة (تسليم + تثبيت التقرير)
app.post('/api/reports/:id/end', authRequired, (req, res) => {
  const report = db.reports.find(r => r.id === Number(req.params.id));
  if (!report) return res.status(404).json({ error: 'التقرير غير موجود' });
  if (!report.formData || report.formData.phase !== 'active') {
    return res.status(400).json({ error: 'المناوبة غير نشطة' });
  }
  if (!canWorkOnShift(req.user, report)) return res.status(403).json({ error: 'ليست لديك صلاحية' });

  const b = req.body || {};
  const fd = report.formData;
  // حقول النموذج النهائي (المساعدة، الإنترنت، الملخص…)
  for (const k of ['events', 'patrols', 'assistance_provided', 'assistance_type', 'internet_connection', 'internet_speed', 'notes']) {
    if (k in b) fd[k] = b[k];
  }
  if (fd.assistance_provided !== 'yes') fd.assistance_type = '';
  if (fd.internet_connection !== 'yes') fd.internet_speed = '';

  // التسليم
  fd.ho = !!b.ho;
  fd.receiver = b.receiver || '';
  fd.finalNote = b.finalNote || '';
  fd.missNote = b.missNote || '';
  if (fd.ho && !fd.receiver) return res.status(400).json({ error: 'اختر اسم الحارس المستلم' });
  if (!fd.ho && !fd.finalNote) return res.status(400).json({ error: 'اذكر سبب عدم التسليم' });

  const exp = fd.startTs ? Math.floor((Date.now() - fd.startTs) / ((db.settings.roundInterval || 120) * 60000)) : 0;
  if (fd.rounds.length < exp && !fd.missNote) {
    return res.status(400).json({ error: 'الجولات المنفذة أقل من المطلوبة — اذكر السبب' });
  }

  fd.phase = 'ended';
  fd.endTs = Date.now();
  fd.expected = exp;
  fd.iv = db.settings.roundInterval || 120;
  // الحالة العامة: أحمر إذا حادث طارئ، أصفر إذا ملاحظات/أعطال، وإلا أخضر
  const red = fd.incidents.filter(i => i.level === 'r').length;
  const yel = fd.incidents.length - red;
  let issues = 0;
  fd.rounds.forEach(r => Object.values(r.items || {}).forEach(d => { if (d && d.ok === false) issues++; }));
  fd.status = red ? 'r' : (yel || issues ? 'y' : 'g');

  report.updatedAt = new Date().toISOString();
  report.history.push({ by: req.user.id, byRole: req.user.role, action: 'shift_ended', at: report.updatedAt });
  audit('shift_ended', req.user.id, `إنهاء مناوبة ${report.number} — ${fd.rounds.length} جولة، ${fd.incidents.length} حدث`);
  saveDb();
  res.json({ report });
});

/* ============ رموز QR للنقاط ============ */
const QRCode = require('qrcode');
app.get('/api/points/:id/qr.svg', async (req, res) => {
  const point = (db.settings.points || []).find(p => p.id === req.params.id);
  if (!point) return res.status(404).send('not found');
  try {
    const svg = await QRCode.toString('SOSGUARD|' + point.id, { type: 'svg', margin: 2, width: 360 });
    res.type('image/svg+xml').send(svg);
  } catch (e) {
    res.status(500).send('qr error');
  }
});

/* ============ النسخ الاحتياطي والاسترجاع ============ */
app.get('/api/backup', authRequired, (req, res) => {
  if (!can(req.user, 'manage_settings')) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  const { sessions, ...rest } = db;
  audit('backup_created', req.user.id, 'تنزيل نسخة احتياطية');
  saveDb();
  res.setHeader('Content-Disposition', 'attachment; filename=security-backup-' + new Date().toISOString().slice(0, 10) + '.json');
  res.json({ v: 1, exportedAt: new Date().toISOString(), ...rest });
});

app.post('/api/restore', authRequired, (req, res) => {
  if (!can(req.user, 'manage_settings')) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  const d = req.body;
  if (!d || typeof d !== 'object') return res.status(400).json({ error: 'ملف غير صالح' });
  const old = { reports: db.reports.length, users: db.users.length };
  if (d.settings) db.settings = { ...defaultSettings(), ...d.settings };
  if (Array.isArray(d.reports)) db.reports = d.reports;
  if (Array.isArray(d.tasks)) db.tasks = d.tasks;
  if (Array.isArray(d.users) && d.users.length) {
    // لا نستبدل كلمات المرور الحالية بقيم مجهولة
    const byId = new Map(db.users.map(u => [u.id, u]));
    db.users = d.users.map(u => byId.get(u.id) || u).filter(Boolean);
  }
  if (d.seq) db.seq = { ...db.seq, ...d.seq };
  audit('restored', req.user.id, 'استرجاع نسخة احتياطية', old,
    { reports: db.reports.length, users: db.users.length });
  alertOfficer('restored', `${req.user.name} استرجع نسخة احتياطية`, req.user.id);
  saveDb();
  res.json({ ok: true, reports: db.reports.length });
});

// قائمة الحراس النشطين (للتسليم والمهام — متاحة للجميع)
app.get('/api/guards', authRequired, (req, res) => {
  res.json({
    guards: db.users
      .filter(u => u.role === 'guard' && u.active)
      .map(u => ({ id: u.id, name: u.name }))
  });
});

/* ================= المستخدمون والصلاحيات ================= */
app.get('/api/users', authRequired, (req, res) => {
  if (!can(req.user, 'manage_users') && !can(req.user, 'manage_permissions')) {
    return res.status(403).json({ error: 'ليست لديك صلاحية' });
  }
  // المشرف يرى ويدير: القادة والحراس (+ نفسه للعرض)
  let list = db.users;
  if (req.user.role === 'supervisor') {
    list = db.users.filter(u => u.role === 'commander' || u.role === 'guard' || u.id === req.user.id);
  }
  res.json({ users: list.map(publicUser), permissionLabels: PERMISSION_LABELS, toggleable: TOGGLEABLE });
});

function validateNewUser(actor, { role, username, name, password }) {
  if (!['guard', 'commander', 'supervisor', 'officer'].includes(role)) return 'دور غير صالح';
  if (!username || !password || !name) return 'جميع الحقول مطلوبة';
  if (db.users.some(u => u.username === username)) return 'اسم المستخدم موجود مسبقاً';
  // المشرف ينشئ: قادة وحراس فقط
  if (actor.role === 'supervisor' && !['commander', 'guard'].includes(role)) {
    return 'المشرف يمكنه إنشاء حسابات القادة والحراس فقط — حسابات المشرفين والأوفيسر ينشئها الأوفيسر';
  }
  if (actor.role !== 'officer' && actor.role !== 'supervisor') return 'ليست لديك صلاحية إنشاء حسابات';
  return null;
}

app.post('/api/users', authRequired, (req, res) => {
  if (!can(req.user, 'manage_users')) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  const { role, username, name, password, overrides } = req.body || {};
  const err = validateNewUser(req.user, { role, username, name, password });
  if (err) return res.status(400).json({ error: err });
  db.seq.user++;
  const user = {
    id: db.seq.user,
    username, name, role,
    passwordHash: hashPassword(password),
    overrides: sanitizeOverrides(req.user, role, overrides),
    active: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  audit('user_created', req.user.id, `إنشاء حساب ${name} (${ROLE_LABEL(role)})`);
  if (req.user.role !== 'officer') {
    alertOfficer('user_created', `${req.user.name} أنشأ حساباً جديداً: ${name} (${ROLE_LABEL(role)})`, req.user.id);
  }
  saveDb();
  res.status(201).json({ user: publicUser(user) });
});

function sanitizeOverrides(actor, targetRole, overrides) {
  if (!overrides || typeof overrides !== 'object') return {};
  const clean = {};
  // من يملك manage_permissions ضمن نطاقه يعدّل المفاتيح القابلة للتبديل فقط
  const allowedScope =
    (actor.role === 'officer') ||
    (actor.role === 'supervisor' && ['commander', 'guard'].includes(targetRole));
  if (!allowedScope) return {};
  for (const k of TOGGLEABLE) {
    if (k in overrides) clean[k] = !!overrides[k];
  }
  // المشرف لا يمنح صلاحيات الإعدادات/الإحصائيات الكبرى؟ — يُسمح له بتبديل TOGGLEABLE
  // لكن لا يستطيع كسر القواعد الذهبية (تُفرض في effectivePerms)
  return clean;
}

function ROLE_LABEL(r) {
  return { guard: 'حارس', commander: 'قائد', supervisor: 'مشرف', officer: 'أوفيسر' }[r] || r;
}

app.put('/api/users/:id', authRequired, (req, res) => {
  const target = findUser(Number(req.params.id));
  if (!target) return res.status(404).json({ error: 'الحساب غير موجود' });
  if (!can(req.user, 'manage_users') && !can(req.user, 'manage_permissions')) {
    return res.status(403).json({ error: 'ليست لديك صلاحية' });
  }
  // نطاق المشرف: قادة وحراس فقط
  if (req.user.role === 'supervisor' && !['commander', 'guard'].includes(target.role)) {
    return res.status(403).json({ error: 'المشرف لا يمكنه تعديل هذا الحساب' });
  }
  if (req.user.role !== 'officer' && req.user.role !== 'supervisor') {
    return res.status(403).json({ error: 'ليست لديك صلاحية' });
  }

  const { name, password, active, overrides } = req.body || {};
  const old = { name: target.name, active: target.active, overrides: { ...target.overrides } };
  if (name) target.name = name;
  if (password) target.passwordHash = hashPassword(password);
  if (typeof active === 'boolean' && req.user.role === 'officer') target.active = active;
  if (overrides && can(req.user, 'manage_permissions')) {
    target.overrides = { ...target.overrides, ...sanitizeOverrides(req.user, target.role, overrides) };
    // إزالة مفاتيح غير موجودة في الطلب صراحةً عبر استبدال كامل عند تمرير _replace
    if (req.body._replace) {
      const clean = sanitizeOverrides(req.user, target.role, overrides);
      for (const k of Object.keys(target.overrides)) if (!(k in clean)) delete target.overrides[k];
      target.overrides = clean;
    }
  }
  audit('user_updated', req.user.id, `تعديل حساب ${target.name}`, old,
    { name: target.name, active: target.active, overrides: target.overrides });
  if (req.user.id !== target.id) {
    alertOfficer('user_updated', `${req.user.name} عدّل حساب ${target.name} (${ROLE_LABEL(target.role)})`, req.user.id);
  }
  saveDb();
  res.json({ user: publicUser(target) });
});

app.get('/api/permissions/labels', authRequired, (req, res) => {
  res.json({ permissionLabels: PERMISSION_LABELS, toggleable: TOGGLEABLE, roleDefaults: ROLE_DEFAULTS });
});

/* ================= المهام (توزيع المشرف) ================= */
app.get('/api/tasks', authRequired, (req, res) => {
  let list = db.tasks;
  if (req.user.role === 'guard') list = list.filter(t => t.guardId === req.user.id);
  if (req.user.role === 'commander') list = list.filter(t => true); // القائد يرى مهام فريقه (نظرياً)
  res.json({
    tasks: list.map(t => ({
      ...t,
      guardName: (findUser(t.guardId) || {}).name || '?',
      createdByName: (findUser(t.createdBy) || {}).name || '?'
    }))
  });
});

app.post('/api/tasks', authRequired, (req, res) => {
  if (!can(req.user, 'distribute_tasks')) return res.status(403).json({ error: 'ليست لديك صلاحية توزيع المهام' });
  const { guardId, description, dueDate } = req.body || {};
  const guard = findUser(Number(guardId));
  if (!guard || guard.role !== 'guard') return res.status(400).json({ error: 'اختر حارساً صحيحاً' });
  if (!description) return res.status(400).json({ error: 'وصف المهمة مطلوب' });
  db.seq.task++;
  const task = {
    id: db.seq.task,
    guardId: guard.id,
    description,
    dueDate: dueDate || '',
    status: 'pending',
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };
  db.tasks.unshift(task);
  audit('task_created', req.user.id, `توزيع مهمة على ${guard.name}: ${description.slice(0, 60)}`);
  saveDb();
  res.status(201).json({ task });
});

app.put('/api/tasks/:id', authRequired, (req, res) => {
  const task = db.tasks.find(t => t.id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'المهمة غير موجودة' });
  const isAssignee = task.guardId === req.user.id;
  const canManage = can(req.user, 'distribute_tasks');
  if (!isAssignee && !canManage) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  if (req.body.status && ['pending', 'in_progress', 'done'].includes(req.body.status)) {
    task.status = req.body.status;
  }
  if (req.body.description && canManage) task.description = req.body.description;
  task.updatedAt = new Date().toISOString();
  audit('task_updated', req.user.id, `تحديث مهمة #${task.id}`);
  saveDb();
  res.json({ task });
});

/* ================= التنبيهات ================= */
app.get('/api/alerts', authRequired, (req, res) => {
  if (!can(req.user, 'view_alerts')) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  res.json({ alerts: db.alerts.slice(0, 50) });
});

app.post('/api/alerts/:id/read', authRequired, (req, res) => {
  if (!can(req.user, 'view_alerts')) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  const a = db.alerts.find(x => x.id === Number(req.params.id));
  if (a) a.read = true;
  saveDb();
  res.json({ ok: true });
});

app.post('/api/alerts/read-all', authRequired, (req, res) => {
  if (!can(req.user, 'view_alerts')) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  db.alerts.forEach(a => a.read = true);
  saveDb();
  res.json({ ok: true });
});

/* ================= سجل التعديلات ================= */
app.get('/api/audit', authRequired, (req, res) => {
  if (!can(req.user, 'view_audit')) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  res.json({
    entries: db.audit.slice(0, 100).map(a => ({
      ...a,
      userName: (findUser(a.userId) || {}).name || 'نظام'
    }))
  });
});

/* ================= الإحصائيات ================= */
app.get('/api/stats', authRequired, (req, res) => {
  if (!can(req.user, 'view_stats')) return res.status(403).json({ error: 'ليست لديك صلاحية' });
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const byStatus = {};
  for (const s of Object.keys(STATUS_LABELS)) byStatus[s] = 0;
  let assistanceYes = 0, internetYes = 0, internetSpeeds = {};
  let totalRounds = 0, totalIncidents = 0, redIncidents = 0, yellowIncidents = 0, lateRounds = 0;
  const incidentTypes = {};
  for (const r of db.reports) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.formData.assistance_provided === 'yes') assistanceYes++;
    if (r.formData.internet_connection === 'yes') {
      internetYes++;
      const sp = r.formData.internet_speed || 'غير محدد';
      internetSpeeds[sp] = (internetSpeeds[sp] || 0) + 1;
    }
    const rounds = r.formData.rounds || [];
    totalRounds += rounds.length;
    lateRounds += rounds.filter(x => x.late > 600000).length;
    const incs = r.formData.incidents || [];
    totalIncidents += incs.length;
    for (const i of incs) {
      if (i.level === 'r') redIncidents++; else yellowIncidents++;
      incidentTypes[i.type] = (incidentTypes[i.type] || 0) + 1;
    }
  }
  const byRole = { guard: 0, commander: 0, supervisor: 0, officer: 0 };
  db.reports.forEach(r => { byRole[r.authorRole] = (byRole[r.authorRole] || 0) + 1; });
  res.json({
    totalReports: db.reports.length,
    todayReports: db.reports.filter(r => r.createdAt.slice(0, 10) === today).length,
    byStatus,
    statusLabels: STATUS_LABELS,
    byRole,
    roleLabels: { guard: 'حراس', commander: 'قادة', supervisor: 'مشرفون', officer: 'أوفيسر' },
    assistanceYes,
    internetYes,
    internetSpeeds,
    rounds: { total: totalRounds, late: lateRounds },
    incidents: { total: totalIncidents, red: redIncidents, yellow: yellowIncidents, types: incidentTypes },
    users: {
      total: db.users.length,
      active: db.users.filter(u => u.active).length,
      guards: db.users.filter(u => u.role === 'guard').length,
      commanders: db.users.filter(u => u.role === 'commander').length,
      supervisors: db.users.filter(u => u.role === 'supervisor').length
    },
    tasks: {
      total: db.tasks.length,
      pending: db.tasks.filter(t => t.status === 'pending').length,
      done: db.tasks.filter(t => t.status === 'done').length
    },
    alertsUnread: db.alerts.filter(a => !a.read).length
  });
});

/* ================= الإعدادات ================= */
app.get('/api/settings', authRequired, (req, res) => {
  res.json({ settings: db.settings });
});

app.put('/api/settings', authRequired, (req, res) => {
  if (!can(req.user, 'manage_settings')) {
    return res.status(403).json({ error: 'تغيير الإعدادات صلاحية الأوفيسر فقط' });
  }
  const old = JSON.parse(JSON.stringify(db.settings));
  const allowed = [
    'orgName', 'assistanceQuestionEnabled', 'internetQuestionEnabled',
    'points', 'shifts', 'roundInterval', 'supPhone', 'supEmail',
    'allowManualQR', 'sound', 'wake', 'matrix'
  ];
  const incoming = req.body.settings || {};
  for (const k of allowed) {
    if (k in incoming) db.settings[k] = incoming[k];
  }
  if (Array.isArray(db.settings.points)) {
    db.settings.points = db.settings.points
      .filter(p => p && p.id)
      .map(p => ({
        id: String(p.id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || ('p' + Math.random().toString(36).slice(2, 8)),
        ar: String(p.ar || '').slice(0, 60),
        en: String(p.en || '').slice(0, 60),
        inRound: !!p.inRound
      }));
  }
  db.settings.roundInterval = Math.max(10, Number(db.settings.roundInterval) || 120);

  const LABELS = {
    orgName: 'اسم المنشأة',
    assistanceQuestionEnabled: 'تفعيل سؤال المساعدة',
    internetQuestionEnabled: 'تفعيل سؤال الإنترنت',
    points: 'نقاط الحراسة',
    shifts: 'المناوبات',
    roundInterval: 'فاصل الجولات',
    supPhone: 'رقم واتساب المشرف',
    supEmail: 'بريد المشرف',
    allowManualQR: 'التأكيد اليدوي بدل QR',
    sound: 'صوت التنبيه',
    wake: 'إبقاء الشاشة مضاءة',
    matrix: 'أثر الماتريكس'
  };
  audit('settings_changed', req.user.id, 'تغيير إعدادات النظام', old, db.settings);
  const changed = allowed.filter(k => JSON.stringify(old[k]) !== JSON.stringify(db.settings[k]))
    .map(k => LABELS[k] || k);
  alertOfficer('settings_changed',
    `${req.user.name} غيّر الإعدادات: ${changed.join('، ') || 'تحديث'}`, req.user.id);
  saveDb();
  res.json({ settings: db.settings });
});

/* ================= لوحة الملخص ================= */
app.get('/api/dashboard', authRequired, (req, res) => {
  const u = req.user;
  const p = effectivePerms(u);
  const mine = db.reports.filter(r => r.authorId === u.id);
  const waitingWithMe =
    u.role === 'guard' ? db.reports.filter(r => r.authorId === u.id && r.status === 'with_guard') :
    u.role === 'commander' ? db.reports.filter(r => r.status === 'with_commander') :
    u.role === 'supervisor' ? db.reports.filter(r => r.status === 'with_supervisor') :
    db.reports.filter(r => r.status === 'with_officer');
  res.json({
    myReports: mine.length,
    waitingWithMe: waitingWithMe.length,
    myTasks: db.tasks.filter(t => t.guardId === u.id && t.status !== 'done').length,
    teamGuards: u.role === 'supervisor' || u.role === 'officer' ? db.users.filter(x => x.role === 'guard' && x.active).length : undefined,
    unreadAlerts: p.view_alerts ? db.alerts.filter(a => !a.read).length : 0,
    recent: db.reports.filter(r => canViewReport(u, r)).slice(0, 5).map(r => ({
      id: r.id, number: r.number, status: r.status,
      statusLabel: STATUS_LABELS[r.status],
      authorName: (findUser(r.authorId) || {}).name,
      updatedAt: r.updatedAt
    }))
  });
});

/* ================= خادم الصفحة + PWA ================= */
app.get('/sw.js', (req, res) => {
  res.set('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ server listening on 0.0.0.0:${PORT}`);
});
