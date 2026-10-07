'use strict';
const express = require('express');
const { db, getSettings } = require('../db');
const { todayStr, isMonth } = require('../util');

const router = express.Router();

const parseItems = (s) => { try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (_) { return []; } };

function publicPlans() {
  return db.prepare('SELECT * FROM plans WHERE visible=1 ORDER BY position,id').all().map((p) => ({
    ...p, featured: !!p.featured,
    features: p.features.split('\n').map((x) => x.trim()).filter(Boolean),
    features_en: p.features_en.split('\n').map((x) => x.trim()).filter(Boolean),
  }));
}
function publicOffers() {
  const today = todayStr();
  return db.prepare("SELECT * FROM offers WHERE visible=1 AND (valid_until='' OR valid_until>=?) ORDER BY position,id").all(today);
}

router.get('/site', (req, res) => {
  const sections = db.prepare('SELECT * FROM sections WHERE visible=1 ORDER BY position,id').all()
    .map((s) => ({ ...s, items: parseItems(s.items) }));
  res.json({ settings: getSettings(), sections, plans: publicPlans(), offers: publicOffers(), today: todayStr() });
});

router.get('/schedule', (req, res) => {
  const month = req.query.month;
  if (!isMonth(month)) return res.status(400).json({ error: 'شهر غير صالح' });
  const rows = db.prepare('SELECT id,date,start_time,end_time,title,trainer,tag,notes,title_en,trainer_en,tag_en,notes_en FROM classes WHERE date LIKE ? ORDER BY date,start_time').all(month + '-%');
  res.json({ month, classes: rows });
});

module.exports = router;
module.exports.parseItems = parseItems;
