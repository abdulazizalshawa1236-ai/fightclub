'use strict';
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const { db, DATA_DIR, getSettings, SETTING_KEYS } = require('../db');
const { sign, cookieOpts, requireAdmin, loginLimiter, bcrypt, COOKIE_ADMIN, ADMIN_TTL_H } = require('../auth');
const U = require('../util');
const { syncNotifications } = require('../notify');
const { parseItems } = require('./public');
const whatsapp = require('../whatsapp');

const router = express.Router();
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const bool = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));

const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 11);

router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const row = db.prepare('SELECT * FROM admins WHERE username=?').get(String(username || '').trim());
  const ok = bcrypt.compareSync(String(password || ''), row ? row.password_hash : DUMMY_HASH);
  if (!row || !ok) return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  res.cookie(COOKIE_ADMIN, sign({ role: 'admin', sub: row.id }, ADMIN_TTL_H + 'h'), cookieOpts(req, ADMIN_TTL_H * 3600000));
  res.json({ ok: true });
});
router.post('/logout', (req, res) => { res.clearCookie(COOKIE_ADMIN, { path: '/' }); res.json({ ok: true }); });

router.use(requireAdmin);

router.get('/me', (req, res) => res.json({ admin: req.admin }));

router.post('/password', (req, res) => {
  const { current, next } = req.body || {};
  const row = db.prepare('SELECT * FROM admins WHERE id=?').get(req.admin.id);
  if (!bcrypt.compareSync(String(current || ''), row.password_hash)) throw bad('كلمة المرور الحالية غير صحيحة');
  if (String(next || '').length < 12) throw bad('كلمة المرور الجديدة يجب ألا تقل عن 12 حرفاً');
  db.prepare('UPDATE admins SET password_hash=? WHERE id=?').run(bcrypt.hashSync(String(next), 11), row.id);
  res.json({ ok: true });
});

const warnDays = () => Math.max(0, Math.min(30, parseInt(getSettings().expiring_days, 10) || 3));

function memberRows() {
  const today = U.todayStr(); const warn = warnDays();
  return db.prepare('SELECT m.*, p.name AS plan_name FROM members m LEFT JOIN plans p ON p.id=m.plan_id ORDER BY m.id DESC').all()
    .map((m) => ({ ...m, active: !!m.active, ...U.statusOf(m, today, warn) }));
}

function parseMember(b) {
  const full_name = U.clamp(b.full_name, 80);
  if (full_name.length < 2) throw bad('أدخل اسم المشترك');
  const national_id = U.normId(b.national_id);
  if (!national_id) throw bad('رقم الهوية/الإقامة يجب أن يكون 10 أرقام ويبدأ بـ 1 أو 2');
  const phone = U.normPhone(b.phone);
  if (!phone) throw bad('رقم الجوال غير صحيح (مثال: 05XXXXXXXX)');
  let plan_id = num(b.plan_id);
  if (plan_id) { if (!db.prepare('SELECT 1 FROM plans WHERE id=?').get(plan_id)) throw bad('الباقة غير موجودة'); } else plan_id = null;
  const start_date = b.start_date || U.todayStr();
  if (!U.isDate(start_date)) throw bad('تاريخ البداية غير صالح');
  let end_date = b.end_date;
  if (!end_date && plan_id) end_date = U.addDays(start_date, db.prepare('SELECT duration_days d FROM plans WHERE id=?').get(plan_id).d - 1);
  if (!U.isDate(end_date)) throw bad('تاريخ النهاية غير صالح');
  if (end_date < start_date) throw bad('تاريخ النهاية قبل تاريخ البداية');
  return { full_name, national_id, phone, plan_id, start_date, end_date, notes: U.clamp(b.notes, 500), active: b.active === undefined ? 1 : bool(b.active) };
}

function uniqueGuard(fn) {
  try { return fn(); } catch (e) {
    if (String(e.code).startsWith('SQLITE_CONSTRAINT')) throw bad('رقم الهوية/الإقامة مسجّل مسبقاً لمشترك آخر');
    throw e;
  }
}

function refreshNotifs(id, end) {
  db.prepare("UPDATE wa_outbox SET status='failed',last_error='membership_updated' WHERE member_id=? AND status='queued' AND (dedupe_key LIKE 'expired:%' OR dedupe_key LIKE 'expiring:%')").run(id);
  db.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE member_id=? AND kind IN ('expired','expiring') AND ref<>? AND read_at IS NULL").run(id, end);
  syncNotifications(id);
}

router.get('/members', (req, res) => {
  const all = memberRows();
  const counts = { total: all.length, active: 0, expiring: 0, expired: 0, disabled: 0, upcoming: 0 };
  all.forEach((m) => { counts[m.status]++; });
  let rows = all;
  const q = String(req.query.q || '').trim();
  if (q) {
    const qd = U.normDigits(q);
    rows = rows.filter((m) => m.full_name.includes(q) || (qd && (m.national_id.includes(qd) || m.phone.includes(qd))));
  }
  const st = String(req.query.status || '');
  if (st && st !== 'all') rows = rows.filter((m) => m.status === st || (st === 'active' && m.status === 'upcoming'));
  res.json({ members: rows, counts });
});

router.post('/members', (req, res) => {
  const v = parseMember(req.body || {});
  const r = uniqueGuard(() => db.prepare('INSERT INTO members(full_name,national_id,phone,plan_id,start_date,end_date,notes,active) VALUES(@full_name,@national_id,@phone,@plan_id,@start_date,@end_date,@notes,@active)').run(v));
  syncNotifications(r.lastInsertRowid);
  res.status(201).json({ ok: true, id: r.lastInsertRowid });
});

router.put('/members/:id', (req, res) => {
  const id = Number(req.params.id);
  const old = db.prepare('SELECT phone FROM members WHERE id=?').get(id);
  if (!old) throw bad('المشترك غير موجود', 404);
  const v = parseMember(req.body || {});
  uniqueGuard(() => db.prepare(`UPDATE members SET full_name=@full_name,national_id=@national_id,phone=@phone,plan_id=@plan_id,start_date=@start_date,end_date=@end_date,notes=@notes,active=@active,
    phone_verified_at=CASE WHEN phone<>@phone THEN NULL ELSE phone_verified_at END,
    whatsapp_updates_opt_in=CASE WHEN phone<>@phone THEN 0 ELSE whatsapp_updates_opt_in END,
    whatsapp_marketing_opt_in=CASE WHEN phone<>@phone THEN 0 ELSE whatsapp_marketing_opt_in END,
    whatsapp_consent_at=CASE WHEN phone<>@phone THEN NULL ELSE whatsapp_consent_at END,
    session_version=session_version+CASE WHEN phone<>@phone THEN 1 ELSE 0 END WHERE id=@id`).run({ ...v, id }));
  refreshNotifs(id, v.end_date);
  res.json({ ok: true });
});

router.delete('/members/:id', (req, res) => {
  db.prepare('DELETE FROM members WHERE id=?').run(Number(req.params.id));
  res.json({ ok: true });
});

router.post('/members/:id/renew', (req, res) => {
  const m = db.prepare('SELECT * FROM members WHERE id=?').get(Number(req.params.id));
  if (!m) throw bad('المشترك غير موجود', 404);
  const plan = db.prepare('SELECT * FROM plans WHERE id=?').get(num(req.body && req.body.plan_id) || m.plan_id);
  if (!plan) throw bad('اختر باقة للتجديد');
  const today = U.todayStr();
  let start; let end;
  if (m.end_date >= today) { start = m.start_date; end = U.addDays(m.end_date, plan.duration_days); }
  else { start = today; end = U.addDays(today, plan.duration_days - 1); }
  db.prepare('UPDATE members SET plan_id=?, start_date=?, end_date=?, active=1 WHERE id=?').run(plan.id, start, end, m.id);
  refreshNotifs(m.id, end);
  const s = getSettings();
  const message = U.fmt(s.msg_renewed, { name: m.full_name, club: s.club_name, date: end });
  const messageEn = U.fmt(s.msg_renewed_en || s.msg_renewed, { name: m.full_name, club: s.club_name_en || s.club_name, date: end });
  db.prepare("INSERT INTO notifications(member_id,kind,ref,message,message_en) VALUES(?,?,?,?,?)").run(m.id, 'renewed', end, message, messageEn);
  whatsapp.queueNotification(m.id, 'utility', message, messageEn, `renewed:${end}`);
  res.json({ ok: true, start_date: start, end_date: end });
});

router.get('/export/members.csv', (req, res) => {
  const label = { active: 'فعّال', expiring: 'ينتهي قريباً', expired: 'منتهي', disabled: 'معطّل', upcoming: 'لم يبدأ' };
  const safe = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  const asText = (v) => `="${String(v).replace(/"/g, '')}"`;
  const lines = [['الاسم', 'الهوية/الإقامة', 'الجوال', 'الباقة', 'البداية', 'النهاية', 'الحالة', 'ملاحظات'].map(safe).join(',')];
  memberRows().forEach((m) => lines.push([safe(m.full_name), asText(m.national_id), asText(m.phone), safe(m.plan_name), safe(m.start_date), safe(m.end_date), safe(label[m.status]), safe(m.notes)].join(',')));
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="members.csv"');
  res.send('\uFEFF' + lines.join('\r\n'));
});

router.get('/stats', (req, res) => {
  const all = memberRows();
  const counts = { total: all.length, active: 0, expiring: 0, expired: 0, disabled: 0, upcoming: 0 };
  all.forEach((m) => { counts[m.status]++; });
  const expiring = all.filter((m) => m.status === 'expiring').sort((a, b) => a.end_date.localeCompare(b.end_date)).slice(0, 8);
  const expired = all.filter((m) => m.status === 'expired').sort((a, b) => b.end_date.localeCompare(a.end_date)).slice(0, 8);
  const today = U.todayStr();
  const todayClasses = db.prepare('SELECT * FROM classes WHERE date=? ORDER BY start_time').all(today);
  res.json({ counts, expiring, expired, todayClasses, today });
});

function planRow(p) { return { ...p, featured: !!p.featured, visible: !!p.visible, features: p.features.split('\n').filter(Boolean), features_en: p.features_en.split('\n').filter(Boolean) }; }
function parsePlan(b) {
  const name = U.clamp(b.name, 60); if (!name) throw bad('أدخل اسم الباقة');
  const name_en = U.clamp(b.name_en, 60);
  const price = Number(b.price); if (!(price >= 0) || price > 1e6) throw bad('السعر غير صالح');
  const old = num(b.old_price); if (old !== null && (!(old >= 0) || old > 1e6)) throw bad('السعر القديم غير صالح');
  const dur = parseInt(b.duration_days, 10); if (!(dur >= 1 && dur <= 3650)) throw bad('مدة الباقة بالأيام يجب أن تكون بين 1 و 3650');
  const feats = (Array.isArray(b.features) ? b.features : String(b.features || '').split('\n')).map((x) => U.clamp(x, 100)).filter(Boolean).slice(0, 12);
  const feats_en = (Array.isArray(b.features_en) ? b.features_en : String(b.features_en || '').split('\n')).map((x) => U.clamp(x, 100)).filter(Boolean).slice(0, 12);
  return { name, name_en, price, old_price: old, period_label: U.clamp(b.period_label, 30), period_label_en: U.clamp(b.period_label_en, 30), duration_days: dur, features: feats.join('\n'), features_en: feats_en.join('\n'), featured: bool(b.featured), badge: U.clamp(b.badge, 30), badge_en: U.clamp(b.badge_en, 30), visible: b.visible === undefined ? 1 : bool(b.visible) };
}
const nextPos = (table) => db.prepare(`SELECT COALESCE(MAX(position),-1)+1 n FROM ${table}`).get().n;

router.get('/plans', (req, res) => {
  res.json({ plans: db.prepare('SELECT p.*, (SELECT COUNT(*) FROM members WHERE plan_id=p.id) members_count FROM plans p ORDER BY position,id').all().map(planRow) });
});
router.post('/plans', (req, res) => {
  const v = parsePlan(req.body || {});
  const r = db.prepare('INSERT INTO plans(name,name_en,price,old_price,period_label,period_label_en,duration_days,features,features_en,featured,badge,badge_en,visible,position) VALUES(@name,@name_en,@price,@old_price,@period_label,@period_label_en,@duration_days,@features,@features_en,@featured,@badge,@badge_en,@visible,@position)').run({ ...v, position: nextPos('plans') });
  res.status(201).json({ ok: true, id: r.lastInsertRowid });
});
router.put('/plans/:id', (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM plans WHERE id=?').get(id); if (!cur) throw bad('الباقة غير موجودة', 404);
  const v = parsePlan({ ...planRow(cur), ...(req.body || {}) });
  db.prepare('UPDATE plans SET name=@name,name_en=@name_en,price=@price,old_price=@old_price,period_label=@period_label,period_label_en=@period_label_en,duration_days=@duration_days,features=@features,features_en=@features_en,featured=@featured,badge=@badge,badge_en=@badge_en,visible=@visible WHERE id=@id').run({ ...v, id });
  res.json({ ok: true });
});
router.delete('/plans/:id', (req, res) => { db.prepare('DELETE FROM plans WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

function parseOffer(b) {
  const title = U.clamp(b.title, 80); if (!title) throw bad('أدخل عنوان العرض');
  const title_en = U.clamp(b.title_en, 80);
  const valid_until = b.valid_until ? String(b.valid_until) : '';
  if (valid_until && !U.isDate(valid_until)) throw bad('تاريخ انتهاء العرض غير صالح');
  return { title, title_en, description: U.clamp(b.description, 400), description_en: U.clamp(b.description_en, 400), badge: U.clamp(b.badge, 30), badge_en: U.clamp(b.badge_en, 30), valid_until, visible: b.visible === undefined ? 1 : bool(b.visible) };
}
router.get('/offers', (req, res) => res.json({ offers: db.prepare('SELECT * FROM offers ORDER BY position,id').all().map((o) => ({ ...o, visible: !!o.visible })) }));
router.post('/offers', (req, res) => {
  const v = parseOffer(req.body || {});
  const r = db.prepare('INSERT INTO offers(title,title_en,description,description_en,badge,badge_en,valid_until,visible,position) VALUES(@title,@title_en,@description,@description_en,@badge,@badge_en,@valid_until,@visible,@position)').run({ ...v, position: nextPos('offers') });
  res.status(201).json({ ok: true, id: r.lastInsertRowid });
});
router.put('/offers/:id', (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM offers WHERE id=?').get(id); if (!cur) throw bad('العرض غير موجود', 404);
  const v = parseOffer({ ...cur, ...(req.body || {}) });
  db.prepare('UPDATE offers SET title=@title,title_en=@title_en,description=@description,description_en=@description_en,badge=@badge,badge_en=@badge_en,valid_until=@valid_until,visible=@visible WHERE id=@id').run({ ...v, id });
  res.json({ ok: true });
});
router.delete('/offers/:id', (req, res) => { db.prepare('DELETE FROM offers WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

const SECTION_TYPES = ['hero', 'text', 'cards', 'gallery', 'faq', 'pricing', 'offers', 'schedule', 'contact'];
const ITEM_KEYS = ['icon', 'title', 'title_en', 'text', 'text_en', 'image', 'value', 'label', 'label_en', 'q', 'q_en', 'a', 'a_en', 'link', 'btn', 'btn_en', 'caption', 'caption_en', 'phone', 'email'];

function cleanItems(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 40).map((it) => {
    const o = {};
    for (const k of ITEM_KEYS) {
      let v = it && typeof it[k] === 'string' ? it[k].trim().slice(0, 1200) : '';
      if (k === 'image' || k === 'link') v = U.safeUrl(v);
      if (k === 'phone') v = v.replace(/[^\d+]/g, '').slice(0, 20);
      if (k === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) v = '';
      if (v) o[k] = v;
    }
    return o;
  }).filter((o) => Object.keys(o).length);
}
const secRow = (s) => ({ ...s, visible: !!s.visible, items: parseItems(s.items) });

function parseSection(b) {
  if (!SECTION_TYPES.includes(b.type)) throw bad('نوع القسم غير معروف');
  const anchor = U.clamp(b.anchor, 40);
  if (anchor && !/^[A-Za-z0-9_-]+$/.test(anchor)) throw bad('المعرّف (Anchor) يقبل أحرفاً إنجليزية وأرقاماً وشرطات فقط');
  return { type: b.type, anchor, nav_label: U.clamp(b.nav_label, 30), nav_label_en: U.clamp(b.nav_label_en, 30), title: U.clamp(b.title, 120), title_en: U.clamp(b.title_en, 120), subtitle: U.clamp(b.subtitle, 300), subtitle_en: U.clamp(b.subtitle_en, 300), body: String(b.body || '').trim().slice(0, 5000), body_en: String(b.body_en || '').trim().slice(0, 5000), items: JSON.stringify(cleanItems(b.items)), visible: b.visible === undefined ? 1 : bool(b.visible) };
}
function uniqueAnchor(anchor, id) {
  let a = anchor || `section-${id}`;
  const taken = (x) => db.prepare('SELECT 1 FROM sections WHERE anchor=? AND id<>?').get(x, id);
  if (taken(a)) a = `${a}-${id}`;
  return a;
}

router.get('/sections', (req, res) => res.json({ sections: db.prepare('SELECT * FROM sections ORDER BY position,id').all().map(secRow) }));
router.post('/sections', (req, res) => {
  const v = parseSection(req.body || {});
  const r = db.prepare('INSERT INTO sections(type,anchor,nav_label,nav_label_en,title,title_en,subtitle,subtitle_en,body,body_en,items,position,visible) VALUES(@type,@anchor,@nav_label,@nav_label_en,@title,@title_en,@subtitle,@subtitle_en,@body,@body_en,@items,@position,@visible)').run({ ...v, position: nextPos('sections') });
  db.prepare('UPDATE sections SET anchor=? WHERE id=?').run(uniqueAnchor(v.anchor, r.lastInsertRowid), r.lastInsertRowid);
  res.status(201).json({ ok: true, id: r.lastInsertRowid });
});
router.put('/sections/:id', (req, res) => {
  const id = Number(req.params.id);
  const cur = db.prepare('SELECT * FROM sections WHERE id=?').get(id); if (!cur) throw bad('القسم غير موجود', 404);
  const v = parseSection({ ...secRow(cur), ...(req.body || {}) });
  db.prepare('UPDATE sections SET type=@type,anchor=@anchor,nav_label=@nav_label,nav_label_en=@nav_label_en,title=@title,title_en=@title_en,subtitle=@subtitle,subtitle_en=@subtitle_en,body=@body,body_en=@body_en,items=@items,visible=@visible WHERE id=@id').run({ ...v, anchor: uniqueAnchor(v.anchor, id), id });
  res.json({ ok: true });
});
router.delete('/sections/:id', (req, res) => { db.prepare('DELETE FROM sections WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

router.post('/reorder/:table', (req, res) => {
  const table = { sections: 'sections', plans: 'plans', offers: 'offers' }[req.params.table];
  if (!table) throw bad('غير مدعوم', 404);
  const ids = (req.body && req.body.ids) || [];
  if (!Array.isArray(ids) || ids.some((x) => !Number.isInteger(x))) throw bad('ترتيب غير صالح');
  const up = db.prepare(`UPDATE ${table} SET position=? WHERE id=?`);
  db.transaction(() => ids.forEach((id, i) => up.run(i, id)))();
  res.json({ ok: true });
});

function parseClass(b) {
  if (!U.isDate(b.date)) throw bad('التاريخ غير صالح');
  if (!U.isTime(b.start_time)) throw bad('وقت البداية غير صالح');
  const end_time = b.end_time || '';
  if (end_time && !U.isTime(end_time)) throw bad('وقت النهاية غير صالح');
  if (end_time && end_time <= b.start_time) throw bad('وقت النهاية يجب أن يكون بعد وقت البداية');
  const title = U.clamp(b.title, 80); if (!title) throw bad('أدخل اسم الحصة');
  return { date: b.date, start_time: b.start_time, end_time, title, title_en: U.clamp(b.title_en, 80), trainer: U.clamp(b.trainer, 60), trainer_en: U.clamp(b.trainer_en, 60), tag: U.clamp(b.tag, 30), tag_en: U.clamp(b.tag_en, 30), notes: U.clamp(b.notes, 200), notes_en: U.clamp(b.notes_en, 200) };
}
router.get('/classes', (req, res) => {
  if (!U.isMonth(req.query.month)) throw bad('شهر غير صالح');
  res.json({ classes: db.prepare('SELECT * FROM classes WHERE date LIKE ? ORDER BY date,start_time').all(req.query.month + '-%') });
});
router.post('/classes', (req, res) => {
  const v = parseClass(req.body || {});
  const repeat = Math.max(0, Math.min(26, parseInt(req.body.repeat_weeks, 10) || 0));
  const ins = db.prepare('INSERT INTO classes(date,start_time,end_time,title,title_en,trainer,trainer_en,tag,tag_en,notes,notes_en) VALUES(@date,@start_time,@end_time,@title,@title_en,@trainer,@trainer_en,@tag,@tag_en,@notes,@notes_en)');
  let created = 0;
  db.transaction(() => { for (let i = 0; i <= repeat; i++) { ins.run({ ...v, date: U.addDays(v.date, 7 * i) }); created++; } })();
  res.status(201).json({ ok: true, created });
});
router.put('/classes/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM classes WHERE id=?').get(id)) throw bad('الحصة غير موجودة', 404);
  const v = parseClass(req.body || {});
  db.prepare('UPDATE classes SET date=@date,start_time=@start_time,end_time=@end_time,title=@title,title_en=@title_en,trainer=@trainer,trainer_en=@trainer_en,tag=@tag,tag_en=@tag_en,notes=@notes,notes_en=@notes_en WHERE id=@id').run({ ...v, id });
  res.json({ ok: true });
});
router.delete('/classes/:id', (req, res) => { db.prepare('DELETE FROM classes WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });

router.post('/classes/copy-month', (req, res) => {
  const { from, to } = req.body || {};
  if (!U.isMonth(from) || !U.isMonth(to) || from === to) throw bad('اختر شهرين مختلفين');
  const [ty, tm] = to.split('-').map(Number);
  const dim = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const nth = (wd, n) => { let c = 0; for (let d = 1; d <= dim; d++) { if (new Date(Date.UTC(ty, tm - 1, d)).getUTCDay() === wd && ++c === n) return d; } return null; };
  const src = db.prepare('SELECT * FROM classes WHERE date LIKE ? ORDER BY date,start_time').all(from + '-%');
  const exists = db.prepare('SELECT 1 FROM classes WHERE date=? AND start_time=? AND title=?');
  const ins = db.prepare('INSERT INTO classes(date,start_time,end_time,title,title_en,trainer,trainer_en,tag,tag_en,notes,notes_en) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
  let created = 0; let skipped = 0;
  db.transaction(() => {
    for (const c of src) {
      const dt = new Date(c.date + 'T00:00:00Z');
      const d = nth(dt.getUTCDay(), Math.ceil(dt.getUTCDate() / 7));
      if (!d) { skipped++; continue; }
      const date = `${to}-${String(d).padStart(2, '0')}`;
      if (exists.get(date, c.start_time, c.title)) { skipped++; continue; }
      ins.run(date, c.start_time, c.end_time, c.title, c.title_en, c.trainer, c.trainer_en, c.tag, c.tag_en, c.notes, c.notes_en); created++;
    }
  })();
  res.json({ ok: true, created, skipped });
});

router.get('/notifications', (req, res) => {
  const c = whatsapp.status();
  const outbox = db.prepare("SELECT status,COUNT(*) AS count FROM wa_outbox GROUP BY status").all().reduce((a, x) => ({ ...a, [x.status]: x.count }), {});
  res.json({ notifications: db.prepare("SELECT n.id,n.kind,n.message,n.message_en,n.created_at,n.read_at,m.full_name FROM notifications n JOIN members m ON m.id=n.member_id ORDER BY n.id DESC LIMIT 100").all(), whatsapp: { ...c, outbox, verified_members: db.prepare('SELECT COUNT(*) AS count FROM members WHERE phone_verified_at IS NOT NULL').get().count, eligible_marketing: db.prepare('SELECT COUNT(*) AS count FROM members WHERE active=1 AND phone_verified_at IS NOT NULL AND whatsapp_marketing_opt_in=1').get().count } });
});
router.post('/notify', (req, res) => {
  const { target, member_id, send_whatsapp } = req.body || {};
  const message = U.clamp(req.body && req.body.message, 300);
  const message_en = U.clamp(req.body && req.body.message_en, 300);
  if (message.length < 2) throw bad('اكتب نص الرسالة');
  let rows;
  if (target === 'member') {
    rows = db.prepare('SELECT id FROM members WHERE id=?').all(Number(member_id));
    if (!rows.length) throw bad('اختر مشتركاً');
  } else if (['all', 'active', 'expired', 'expiring'].includes(target)) {
    rows = memberRows().filter((m) => m.active && (target === 'all' || (target === 'active' ? ['active', 'expiring', 'upcoming'].includes(m.status) : m.status === target)));
  } else throw bad('الفئة غير صالحة');
  if (send_whatsapp && !whatsapp.status().marketing) throw bad('أرسل الرسائل عبر واتساب بعد إعداد قالب العروض وبيانات Meta.', 503);
  const ins = db.prepare("INSERT INTO notifications(member_id,kind,ref,message,message_en) VALUES(?,?,?,?,?)");
  db.transaction(() => rows.forEach((m) => ins.run(m.id, 'custom', null, message, message_en || message)))();
  let whatsappQueued = 0;
  if (send_whatsapp) for (const m of rows) {
    const optIn = db.prepare('SELECT phone_verified_at,whatsapp_marketing_opt_in FROM members WHERE id=?').get(m.id);
    if (optIn && optIn.phone_verified_at && optIn.whatsapp_marketing_opt_in) {
      if (whatsapp.queueNotification(m.id, 'marketing', message, message_en || message, `admin:${Date.now()}:${crypto.randomBytes(5).toString('hex')}`)) whatsappQueued++;
    }
  }
  res.json({ ok: true, sent: rows.length, whatsapp_queued: whatsappQueued });
});

router.get('/settings', (req, res) => res.json({ settings: getSettings() }));
router.put('/settings', (req, res) => {
  const b = req.body || {};
  const up = db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');
  const urlKeys = ['map_url', 'instagram', 'x', 'snapchat', 'tiktok'];
  db.transaction(() => {
    for (const k of SETTING_KEYS) {
      if (!(k in b)) continue;
      let v = U.clamp(b[k], k.startsWith('msg_') ? 400 : 300);
      if (urlKeys.includes(k)) v = U.safeUrl(v);
      if (k === 'week_start') v = ['0', '5', '6'].includes(v) ? v : '0';
      if (k === 'expiring_days') v = String(Math.max(0, Math.min(30, parseInt(v, 10) || 0)));
      if (k === 'country_code') v = v.replace(/\D/g, '') || '966';
      if (k === 'whatsapp' || k === 'phone') v = v.replace(/[^\d+\s-]/g, '');
      up.run(k, v);
    }
  })();
  syncNotifications();
  res.json({ ok: true });
});

const MIME_EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(DATA_DIR, 'uploads')),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(12).toString('hex') + MIME_EXT[file.mimetype]),
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (MIME_EXT[file.mimetype] ? cb(null, true) : cb(bad('يُسمح بالصور فقط (JPG / PNG / WebP / GIF)'))),
});
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) throw bad('لم يتم اختيار ملف');
  res.json({ url: '/uploads/' + req.file.filename });
});

module.exports = router;
