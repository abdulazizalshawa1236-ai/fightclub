'use strict';

const TZ = process.env.TZ_NAME || 'Asia/Riyadh';

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const isMonth = (s) => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function dayDiff(a, b) {
  return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
}

function normDigits(v) {
  return String(v ?? '')
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06F0))
    .replace(/[\s\-().+]/g, '');
}
function normId(v) {
  const s = normDigits(v);
  return /^[12]\d{9}$/.test(s) ? s : null;
}
function normPhone(v) {
  let s = normDigits(v);
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith('00966')) s = s.slice(5);
  else if (s.startsWith('966')) s = s.slice(3);
  if (/^5\d{8}$/.test(s)) s = '0' + s;
  if (/^05\d{8}$/.test(s)) return s;
  const raw = normDigits(v);
  return /^\d{8,15}$/.test(raw) ? raw : null;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (tpl, vars) => String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
const clamp = (v, max) => String(v ?? '').trim().slice(0, max);

function safeUrl(u) {
  u = String(u ?? '').trim();
  if (!u) return '';
  if (/^(#|\/(?!\/)|https?:\/\/|tel:|mailto:)/i.test(u)) return u.slice(0, 500);
  return '';
}

function statusOf(m, today, warnDays) {
  if (!m.active) return { status: 'disabled', days_left: null };
  const left = dayDiff(m.end_date, today);
  if (left < 0) return { status: 'expired', days_left: left };
  if (dayDiff(m.start_date, today) > 0) return { status: 'upcoming', days_left: left };
  if (left <= warnDays) return { status: 'expiring', days_left: left };
  return { status: 'active', days_left: left };
}

module.exports = { TZ, todayStr, isDate, isTime, isMonth, addDays, dayDiff, normDigits, normId, normPhone, esc, fmt, clamp, safeUrl, statusOf };
