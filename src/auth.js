'use strict';
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { db, DATA_DIR } = require('./db');

function loadSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) return process.env.JWT_SECRET;
  const f = path.join(DATA_DIR, '.secret');
  try { return fs.readFileSync(f, 'utf8').trim(); } catch (_) {}
  const s = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}
const SECRET = loadSecret();

const COOKIE_ADMIN = 'fc_admin';
const COOKIE_MEMBER = 'fc_member';
const ADMIN_TTL_H = 12;
const MEMBER_TTL_D = 30;

const sign = (payload, expiresIn) => jwt.sign(payload, SECRET, { expiresIn });
const cookieOpts = (req, maxAge) => ({ httpOnly: true, sameSite: 'lax', secure: !!req.secure, maxAge, path: '/' });

function readToken(req, name, role) {
  const t = req.cookies && req.cookies[name];
  if (!t) return null;
  try {
    const p = jwt.verify(t, SECRET);
    return p.role === role ? p : null;
  } catch (_) { return null; }
}

function requireAdmin(req, res, next) {
  const p = readToken(req, COOKIE_ADMIN, 'admin');
  const admin = p && db.prepare('SELECT id,username FROM admins WHERE id=?').get(p.sub);
  if (!admin) return res.status(401).json({ error: 'يجب تسجيل الدخول كمسؤول' });
  req.admin = admin;
  next();
}
function requireMember(req, res, next) {
  const p = readToken(req, COOKIE_MEMBER, 'member');
  const m = p && db.prepare('SELECT * FROM members WHERE id=?').get(p.sub);
  if (!m || !m.active || !m.phone_verified_at || Number(p.session_version || 0) !== m.session_version) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
  req.member = m;
  next();
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'محاولات كثيرة، حاول مرة أخرى بعد 15 دقيقة' },
});

function ensureAdmin() {
  if (db.prepare('SELECT COUNT(*) c FROM admins').get().c > 0) return;
  const user = (process.env.ADMIN_USER || 'admin').trim();
  let pass = process.env.ADMIN_PASS;
  let generated = false;
  if (!pass || pass.length < 12 || /change-me/i.test(pass)) { pass = crypto.randomBytes(24).toString('base64url'); generated = true; }
  db.prepare('INSERT INTO admins(username,password_hash) VALUES(?,?)').run(user, bcrypt.hashSync(pass, 11));
  console.log('\n==============================================');
  console.log(' تم إنشاء حساب الأدمن الأول / First admin created');
  console.log('  username:', user);
  if (generated) console.log('  password:', pass, '  (احفظها الآن وغيّرها من الإعدادات)');
  else console.log('  password: (من ملف .env)');
  console.log('==============================================\n');
}

module.exports = { sign, cookieOpts, requireAdmin, requireMember, loginLimiter, ensureAdmin, COOKIE_ADMIN, COOKIE_MEMBER, ADMIN_TTL_H, MEMBER_TTL_D, bcrypt };
