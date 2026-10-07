'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { db, getSettings } = require('../db');
const { sign, cookieOpts, requireMember, COOKIE_MEMBER, MEMBER_TTL_D } = require('../auth');
const { normDigits, normId, normPhone, todayStr, statusOf } = require('../util');
const { syncNotifications } = require('../notify');
const { status: whatsappStatus, sendOtp, toInternational } = require('../whatsapp');

const router = express.Router();
const requestOtpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'تجاوزت عدد طلبات الرمز. حاول بعد ساعة.' },
});
const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'محاولات كثيرة. حاول بعد 15 دقيقة.' },
});
const codeHash = (salt, code) => crypto.createHash('sha256').update(`${salt}:${code}`).digest('hex');

function memberView(m) {
  const s = getSettings();
  const warn = Math.max(0, parseInt(s.expiring_days, 10) || 3);
  const st = statusOf(m, todayStr(), warn);
  const plan = m.plan_id ? db.prepare('SELECT name,name_en,duration_days FROM plans WHERE id=?').get(m.plan_id) : null;
  return {
    id: m.id, full_name: m.full_name, phone: m.phone, start_date: m.start_date, end_date: m.end_date,
    plan_name: plan ? plan.name : '', plan_name_en: plan ? plan.name_en : '', status: st.status, days_left: st.days_left,
    total_days: Math.max(1, Math.round((Date.parse(m.end_date) - Date.parse(m.start_date)) / 86400000) + 1),
  };
}

router.post('/login', requestOtpLimiter, async (req, res) => {
  const id = normId(req.body && req.body.national_id);
  const phone = normPhone(req.body && req.body.phone);
  if (req.body && req.body.auth_consent !== true) return res.status(400).json({ error: 'وافق على استلام رمز الدخول عبر واتساب للمتابعة' });
  if (!id || !phone) return res.status(401).json({ error: 'رقم الهوية/الإقامة أو رقم الجوال غير صحيح' });
  const member = db.prepare('SELECT id,phone,active FROM members WHERE national_id=?').get(id);
  if (!member || member.phone !== phone) return res.status(401).json({ error: 'رقم الهوية/الإقامة أو رقم الجوال غير صحيح' });
  if (!member.active) return res.status(403).json({ error: 'هذا الحساب معطّل، تواصل مع إدارة النادي' });
  if (!whatsappStatus().authentication) return res.status(503).json({ error: 'تسجيل الدخول برمز واتساب غير مفعّل بعد. تواصل مع إدارة النادي.' });

  const code = String(crypto.randomInt(100000, 1000000));
  const salt = crypto.randomBytes(16).toString('hex');
  const challengeId = crypto.randomUUID();
  db.prepare('DELETE FROM member_auth_codes WHERE member_id=?').run(member.id);
  db.prepare("INSERT INTO member_auth_codes(challenge_id,member_id,code_hash,salt,expires_at) VALUES(?,?,?,?,datetime('now','+5 minutes'))")
    .run(challengeId, member.id, codeHash(salt, code), salt);
  try {
    await sendOtp(toInternational(member.phone, getSettings().country_code), code, req.body.lang === 'en' ? 'en' : 'ar');
  } catch (_) {
    db.prepare('DELETE FROM member_auth_codes WHERE challenge_id=?').run(challengeId);
    return res.status(502).json({ error: 'تعذّر إرسال رمز واتساب. تحقق من الرقم أو تواصل مع إدارة النادي.' });
  }
  res.json({ ok: true, challenge_id: challengeId, masked_phone: member.phone.replace(/\d(?=\d{3})/g, '•') });
});

router.post('/login/verify', verifyOtpLimiter, (req, res) => {
  const challengeId = String(req.body && req.body.challenge_id || '');
  const code = normDigits(req.body && req.body.code || '').replace(/\D/g, '');
  const row = db.prepare('SELECT * FROM member_auth_codes WHERE challenge_id=?').get(challengeId);
  if (!row || !/^\d{6}$/.test(code) || row.attempts >= 5 || row.expires_at <= new Date().toISOString().slice(0, 19).replace('T', ' ')) {
    if (row) db.prepare('DELETE FROM member_auth_codes WHERE challenge_id=?').run(challengeId);
    return res.status(401).json({ error: 'رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.' });
  }
  const actual = Buffer.from(codeHash(row.salt, code), 'hex');
  const expected = Buffer.from(row.code_hash, 'hex');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    db.prepare('UPDATE member_auth_codes SET attempts=attempts+1 WHERE challenge_id=?').run(challengeId);
    db.prepare("DELETE FROM member_auth_codes WHERE challenge_id=? AND attempts>=5").run(challengeId);
    return res.status(401).json({ error: 'رمز التحقق غير صحيح أو انتهت صلاحيته.' });
  }
  const updates = req.body && req.body.whatsapp_updates_opt_in === true ? 1 : 0;
  const marketing = req.body && req.body.whatsapp_marketing_opt_in === true ? 1 : 0;
  const lang = req.body && req.body.lang === 'en' ? 'en' : 'ar';
  const member = db.prepare('SELECT id,active FROM members WHERE id=?').get(row.member_id);
  if (!member || !member.active) {
    db.prepare('DELETE FROM member_auth_codes WHERE challenge_id=?').run(challengeId);
    return res.status(403).json({ error: 'هذا الحساب غير متاح. تواصل مع إدارة النادي.' });
  }
  db.transaction(() => {
    db.prepare(`UPDATE members SET phone_verified_at=CURRENT_TIMESTAMP,whatsapp_updates_opt_in=?,whatsapp_marketing_opt_in=?,
      whatsapp_consent_at=CURRENT_TIMESTAMP,preferred_language=? WHERE id=?`).run(updates, marketing, lang, member.id);
    db.prepare('DELETE FROM member_auth_codes WHERE challenge_id=?').run(challengeId);
  })();
  const session = db.prepare('SELECT session_version FROM members WHERE id=?').get(member.id);
  res.cookie(COOKIE_MEMBER, sign({ role: 'member', sub: member.id, session_version: session.session_version }, MEMBER_TTL_D + 'd'), cookieOpts(req, MEMBER_TTL_D * 86400000));
  res.json({ ok: true });
});

router.post('/logout', (req, res) => { res.clearCookie(COOKIE_MEMBER, { path: '/' }); res.json({ ok: true }); });

router.get('/me', requireMember, (req, res) => {
  syncNotifications(req.member.id);
  const notifications = db.prepare('SELECT id,kind,message,message_en,created_at,read_at FROM notifications WHERE member_id=? ORDER BY id DESC LIMIT 30').all(req.member.id);
  const s = getSettings();
  res.json({
    member: memberView(req.member),
    notifications,
    unread: notifications.filter((n) => !n.read_at).length,
    club: { name: s.club_name, name_en: s.club_name_en, phone: s.phone, whatsapp: s.whatsapp, country_code: s.country_code },
  });
});

router.post('/notifications/read', requireMember, (req, res) => {
  db.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE member_id=? AND read_at IS NULL").run(req.member.id);
  res.json({ ok: true });
});

module.exports = router;
