'use strict';
const { db, getSettings } = require('./db');
const { todayStr, addDays, fmt } = require('./util');
const { queueNotification } = require('./whatsapp');

function syncNotifications(memberId) {
  const s = getSettings();
  const today = todayStr();
  const warnDays = Math.max(0, Math.min(30, parseInt(s.expiring_days, 10) || 3));
  const limit = addDays(today, warnDays);
  const extra = memberId ? ' AND id=?' : '';
  const args = (d) => (memberId ? [d, memberId] : [d]);

  const ins = db.prepare("INSERT OR IGNORE INTO notifications(member_id,kind,ref,message,message_en) VALUES(?,?,?,?,?)");
  const expired = db.prepare(`SELECT id,full_name,end_date FROM members WHERE active=1 AND end_date < ?${extra}`).all(...args(today));
  const expiring = db.prepare(`SELECT id,full_name,end_date FROM members WHERE active=1 AND end_date >= ? AND end_date <= ?${extra}`)
    .all(...(memberId ? [today, limit, memberId] : [today, limit]));

  db.transaction(() => {
    for (const m of expired) {
      const message = fmt(s.msg_expired, { name: m.full_name, club: s.club_name, date: m.end_date });
      const messageEn = fmt(s.msg_expired_en || s.msg_expired, { name: m.full_name, club: s.club_name_en || s.club_name, date: m.end_date });
      if (ins.run(m.id, 'expired', m.end_date, message, messageEn).changes) queueNotification(m.id, 'utility', message, messageEn, `expired:${m.end_date}`);
    }
    for (const m of expiring) {
      const message = fmt(s.msg_expiring, { name: m.full_name, club: s.club_name, date: m.end_date });
      const messageEn = fmt(s.msg_expiring_en || s.msg_expiring, { name: m.full_name, club: s.club_name_en || s.club_name, date: m.end_date });
      if (ins.run(m.id, 'expiring', m.end_date, message, messageEn).changes) queueNotification(m.id, 'utility', message, messageEn, `expiring:${m.end_date}`);
    }
  })();
}

module.exports = { syncNotifications };
