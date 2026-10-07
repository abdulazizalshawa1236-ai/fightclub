'use strict';

const { db, getSettings } = require('./db');

function config() {
  const version = process.env.WHATSAPP_GRAPH_VERSION || 'v26.0';
  const versionOk = /^v\d+\.0$/.test(version);
  return {
    version: versionOk ? version : 'v26.0',
    phoneId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    token: process.env.WHATSAPP_ACCESS_TOKEN || '',
    otpTemplate: process.env.WHATSAPP_OTP_TEMPLATE || '',
    utilityTemplate: process.env.WHATSAPP_UTILITY_TEMPLATE || '',
    marketingTemplate: process.env.WHATSAPP_MARKETING_TEMPLATE || '',
    arabicLanguage: process.env.WHATSAPP_AR_LANGUAGE || 'ar',
    englishLanguage: process.env.WHATSAPP_EN_LANGUAGE || 'en_US',
  };
}

function status() {
  const c = config();
  const senderReady = Boolean(c.phoneId && c.token);
  return {
    authentication: senderReady && Boolean(c.otpTemplate),
    utility: senderReady && Boolean(c.utilityTemplate),
    marketing: senderReady && Boolean(c.marketingTemplate),
    graphVersion: c.version,
  };
}

async function sendTemplate(to, templateName, language, components) {
  const c = config();
  if (!c.phoneId || !c.token || !templateName) throw new Error('WhatsApp is not configured');
  const response = await fetch(`https://graph.facebook.com/${c.version}/${encodeURIComponent(c.phoneId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template: { name: templateName, language: { code: language }, components } }),
    signal: AbortSignal.timeout(12000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = data && data.error && data.error.code;
    const error = new Error(`WhatsApp API rejected message (${response.status}${code ? `/${code}` : ''})`);
    error.status = response.status;
    error.providerCode = code || null;
    throw error;
  }
  return data && data.messages && data.messages[0] ? data.messages[0].id : null;
}

async function sendOtp(to, code, language = 'ar') {
  const c = config();
  if (!status().authentication) throw new Error('WhatsApp authentication template is not configured');
  return sendTemplate(to, c.otpTemplate, language === 'en' ? c.englishLanguage : c.arabicLanguage, [
    { type: 'body', parameters: [{ type: 'text', text: code }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
  ]);
}

function queueNotification(memberId, category, message, messageEn, dedupeKey = null) {
  if (!['utility', 'marketing'].includes(category)) return false;
  const eligible = db.prepare(`SELECT 1 FROM members WHERE id=? AND active=1 AND phone_verified_at IS NOT NULL AND
    ${category === 'utility' ? 'whatsapp_updates_opt_in=1' : 'whatsapp_marketing_opt_in=1'}`).get(memberId);
  if (!eligible) return false;
  const result = db.prepare(`INSERT OR IGNORE INTO wa_outbox(member_id,category,dedupe_key,message,message_en)
    VALUES(?,?,?,?,?)`).run(memberId, category, dedupeKey, message, messageEn || message);
  return result.changes > 0;
}

let busy = false;
async function processQueue() {
  if (busy) return;
  const readiness = status();
  if (!readiness.utility && !readiness.marketing) return;
  busy = true;
  try {
    db.prepare(`UPDATE wa_outbox SET status='failed',last_error='recipient_not_eligible'
      WHERE status='queued' AND member_id IN (
        SELECT m.id FROM members m WHERE m.active=0 OR m.phone_verified_at IS NULL OR
          (wa_outbox.category='utility' AND m.whatsapp_updates_opt_in=0) OR
          (wa_outbox.category='marketing' AND m.whatsapp_marketing_opt_in=0)
      )`).run();
    const rows = db.prepare(`SELECT q.*,m.phone,m.full_name,m.active,m.whatsapp_updates_opt_in,m.whatsapp_marketing_opt_in,m.preferred_language
      FROM wa_outbox q JOIN members m ON m.id=q.member_id
      WHERE q.status='queued' AND q.next_attempt_at<=CURRENT_TIMESTAMP
      AND m.active=1 AND m.phone_verified_at IS NOT NULL
      AND ((q.category='utility' AND m.whatsapp_updates_opt_in=1) OR (q.category='marketing' AND m.whatsapp_marketing_opt_in=1))
      ORDER BY q.id LIMIT 4`).all();
    const start = db.prepare("UPDATE wa_outbox SET status='sending' WHERE id=? AND status='queued'");
    const sent = db.prepare("UPDATE wa_outbox SET status='sent',provider_message_id=?,sent_at=CURRENT_TIMESTAMP,last_error=NULL WHERE id=?");
    const retry = db.prepare("UPDATE wa_outbox SET status=?,attempts=?,next_attempt_at=datetime('now', ?),last_error=? WHERE id=?");
    const stop = db.prepare("UPDATE wa_outbox SET status='failed',last_error=? WHERE id=?");
    for (const row of rows) {
      if (!start.run(row.id).changes) continue;
      const c = config();
      const templateName = row.category === 'marketing' ? c.marketingTemplate : c.utilityTemplate;
      const lang = row.preferred_language === 'en' ? c.englishLanguage : c.arabicLanguage;
      const message = row.preferred_language === 'en' ? row.message_en : row.message;
      const to = toInternational(row.phone, getSettings().country_code);
      try {
        const remoteId = await sendTemplate(to, templateName, lang, [{
          type: 'body', parameters: [{ type: 'text', text: row.full_name.slice(0, 80) }, { type: 'text', text: message.slice(0, 700) }],
        }]);
        sent.run(remoteId, row.id);
      } catch (error) {
        const attempts = row.attempts + 1;
        const retryable = !error.status || error.status === 429 || error.status >= 500;
        const state = retryable && attempts < 5 ? 'queued' : 'failed';
        const delay = `+${Math.min(300, 15 * (2 ** attempts))} seconds`;
        const safeError = String(error.providerCode || error.message || 'send_failed').slice(0, 160);
        retry.run(state, attempts, delay, safeError, row.id);
      }
    }
  } finally {
    busy = false;
  }
}

function startQueueWorker() {
  db.prepare("UPDATE wa_outbox SET status='queued' WHERE status='sending'").run();
  const run = () => processQueue().catch(() => {});
  run();
  const timer = setInterval(run, 5000);
  timer.unref();
}

function toInternational(phone, countryCode = '966') {
  let value = String(phone || '').replace(/\D/g, '');
  if (value.startsWith('00')) value = value.slice(2);
  else if (value.startsWith('0')) value = countryCode + value.slice(1);
  else if (countryCode && !value.startsWith(countryCode) && value.length <= 10) value = countryCode + value;
  return value;
}

module.exports = { status, sendOtp, queueNotification, startQueueWorker, toInternational };
