'use strict';
require('dotenv').config({ quiet: true });
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { db, DATA_DIR, getSettings } = require('./src/db');
const { ensureAdmin } = require('./src/auth');
const { syncNotifications } = require('./src/notify');
const { startQueueWorker } = require('./src/whatsapp');
const { esc } = require('./src/util');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.disable('x-powered-by');

app.use(helmet({
  hsts: isProd,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '300kb' }));
app.use(cookieParser());

app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/api/member', require('./src/routes/member'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api', require('./src/routes/public'));
app.get('/api/health', (req, res) => {
  db.prepare('SELECT 1').get();
  res.json({ ok: true, service: 'fightclub' });
});
app.use('/api', (req, res) => res.status(404).json({ error: 'غير موجود' }));

app.use('/uploads', express.static(path.join(DATA_DIR, 'uploads'), { maxAge: '7d', index: false, fallthrough: true }));
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), { maxAge: '7d' }));

const indexFile = path.join(__dirname, 'public', 'index.html');
app.get('/', (req, res) => {
  const s = getSettings();
  const html = fs.readFileSync(indexFile, 'utf8')
    .replace(/{{TITLE}}/g, esc(`${s.club_name} | ${s.tagline}`))
    .replace(/{{DESC}}/g, esc(s.meta_description));
  res.set('Cache-Control', 'no-cache').type('html').send(html);
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], etag: true, maxAge: 0, index: false }));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin'), { index: 'index.html', maxAge: 0 }));

app.use((req, res) => res.status(404).type('html').send('<meta charset="utf-8"><body style="background:#080808;color:#fff;font-family:sans-serif;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><h1 style="color:#e8343a;font-size:64px;margin:0">404</h1><p>الصفحة غير موجودة</p><a style="color:#fff" href="/">العودة للرئيسية</a></div>'));

app.use((err, req, res, next) => {
  const status = err.status || (err.type === 'entity.parse.failed' ? 400 : err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  const msg = err.code === 'LIMIT_FILE_SIZE' ? 'حجم الصورة أكبر من 6MB'
    : status >= 500 ? 'حدث خطأ في الخادم' : (err.message || 'طلب غير صالح');
  res.status(status).json({ error: msg });
});

ensureAdmin();
syncNotifications();
setInterval(() => { try { syncNotifications(); } catch (e) { console.error(e); } }, 60 * 60 * 1000).unref();
startQueueWorker();

app.listen(PORT, () => console.log(`Fight Club site running on http://localhost:${PORT}  (admin: /admin)`));
