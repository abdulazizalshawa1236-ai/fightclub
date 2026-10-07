'use strict';
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'club.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  anchor TEXT NOT NULL DEFAULT '',
  nav_label TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  subtitle TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  items TEXT NOT NULL DEFAULT '[]',
  position INTEGER NOT NULL DEFAULT 0,
  visible INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  old_price REAL,
  period_label TEXT NOT NULL DEFAULT '',
  duration_days INTEGER NOT NULL DEFAULT 30,
  features TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  badge TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  badge TEXT NOT NULL DEFAULT '',
  valid_until TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  national_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  plan_id INTEGER REFERENCES plans(id) ON DELETE SET NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_members_end ON members(end_date);
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  trainer TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS ix_classes_date ON classes(date);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  ref TEXT,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_notif_auto ON notifications(member_id, kind, ref) WHERE kind IN ('expired','expiring');
CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS member_auth_codes (
  challenge_id TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_member_auth_codes_expiry ON member_auth_codes(expires_at);
CREATE TABLE IF NOT EXISTS wa_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK(category IN ('utility','marketing')),
  dedupe_key TEXT,
  message TEXT NOT NULL,
  message_en TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','sending','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider_message_id TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT,
  UNIQUE(member_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS ix_wa_outbox_queue ON wa_outbox(status, next_attempt_at, id);
`);

function ensureColumn(table, column, definition) {
  const columns = db.pragma(`table_info(${table})`).map((x) => x.name);
  if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
for (const [table, columns] of Object.entries({
  members: { phone_verified_at: 'TEXT', whatsapp_updates_opt_in: 'INTEGER NOT NULL DEFAULT 0', whatsapp_marketing_opt_in: 'INTEGER NOT NULL DEFAULT 0', whatsapp_consent_at: 'TEXT', preferred_language: "TEXT NOT NULL DEFAULT 'ar'", session_version: 'INTEGER NOT NULL DEFAULT 0' },
  sections: { nav_label_en: "TEXT NOT NULL DEFAULT ''", title_en: "TEXT NOT NULL DEFAULT ''", subtitle_en: "TEXT NOT NULL DEFAULT ''", body_en: "TEXT NOT NULL DEFAULT ''" },
  plans: { name_en: "TEXT NOT NULL DEFAULT ''", period_label_en: "TEXT NOT NULL DEFAULT ''", features_en: "TEXT NOT NULL DEFAULT ''", badge_en: "TEXT NOT NULL DEFAULT ''" },
  offers: { title_en: "TEXT NOT NULL DEFAULT ''", description_en: "TEXT NOT NULL DEFAULT ''", badge_en: "TEXT NOT NULL DEFAULT ''" },
  classes: { title_en: "TEXT NOT NULL DEFAULT ''", trainer_en: "TEXT NOT NULL DEFAULT ''", tag_en: "TEXT NOT NULL DEFAULT ''", notes_en: "TEXT NOT NULL DEFAULT ''" },
  notifications: { message_en: "TEXT NOT NULL DEFAULT ''" },
})) for (const [column, definition] of Object.entries(columns)) ensureColumn(table, column, definition);

const DEFAULT_SETTINGS = {
  club_name: 'فايت كلوب',
  club_name_en: 'Fight Club',
  tagline: 'نادي الفنون القتالية',
  tagline_en: 'Combat Sports Club',
  meta_description: 'فايت كلوب — ملاكمة، مواي تاي، تايكوندو، جوجيتسو ومصارعة. باقات وجدول حصص وحساب مشترك.',
  meta_description_en: 'Fight Club — boxing, Muay Thai, Taekwondo, Jiu-Jitsu and wrestling. Membership plans, classes and member accounts.',
  phone: '0530335050',
  whatsapp: '0530335050',
  email: 'fightclubssaudi@gmail.com',
  address: '',
  address_en: '',
  hours: '',
  hours_en: '',
  map_url: '',
  instagram: '',
  x: '',
  snapchat: '',
  tiktok: '',
  currency: 'ر.س',
  currency_en: 'SAR',
  country_code: '966',
  marquee: 'ملاكمة,مواي تاي,تايكوندو,جوجيتسو,مصارعة',
  marquee_en: 'BOXING,MUAY THAI,TAEKWONDO,JIU-JITSU,WRESTLING',
  week_start: '6',
  expiring_days: '3',
  footer_text: 'جميع الحقوق محفوظة',
  footer_text_en: 'All rights reserved',
  msg_expired: 'مرحباً {name}، انتهى اشتراكك في {club} بتاريخ {date}. جدّد اشتراكك للاستمرار في التدريب.',
  msg_expired_en: 'Hello {name}, your {club} membership expired on {date}. Renew to keep training.',
  msg_expiring: 'مرحباً {name}، ينتهي اشتراكك في {club} بتاريخ {date}. جدّد قبل الانتهاء حتى لا ينقطع تدريبك.',
  msg_expiring_en: 'Hello {name}, your {club} membership expires on {date}. Renew before then to keep training.',
  msg_renewed: 'تم تجديد اشتراكك في {club} حتى {date}. نتمنى لك تدريباً موفقاً.',
  msg_renewed_en: 'Your {club} membership has been renewed through {date}. Enjoy your training.',
};
const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

const insSetting = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)');
for (const k of SETTING_KEYS) insSetting.run(k, DEFAULT_SETTINGS[k]);

function getSettings() {
  const out = {};
  for (const r of db.prepare('SELECT key,value FROM settings').all()) out[r.key] = r.value;
  return out;
}

const STARTER_PLANS = [
  ['رياضة واحدة — 3 أشهر', 'One Sport — 3 Months', 2199, '3 أشهر', '3 months', 90, 'حصص رياضة واحدة', 'Classes in one sport', 1, 'الأكثر طلباً', 'Most popular'],
  ['رياضة واحدة — 6 أشهر', 'One Sport — 6 Months', 3710, '6 أشهر', '6 months', 180, 'حصص رياضة واحدة', 'Classes in one sport', 0, '', ''],
  ['رياضة واحدة — سنة', 'One Sport — 1 Year', 5999, 'سنة', '1 year', 365, 'حصص رياضة واحدة', 'Classes in one sport', 0, '', ''],
  ['رياضتان — 3 أشهر', 'Two Sports — 3 Months', 3450, '3 أشهر', '3 months', 90, 'حصص رياضتين', 'Classes in two sports', 0, '', ''],
  ['رياضتان — 6 أشهر', 'Two Sports — 6 Months', 5790, '6 أشهر', '6 months', 180, 'حصص رياضتين', 'Classes in two sports', 0, '', ''],
  ['رياضتان — سنة', 'Two Sports — 1 Year', 8999, 'سنة', '1 year', 365, 'حصص رياضتين', 'Classes in two sports', 0, '', ''],
  ['VIP — 3 أشهر', 'VIP — 3 Months', 4900, '3 أشهر', '3 months', 90, 'دخول جميع الحصص\nجلستان تدريب شخصي شهرياً', 'Access to all classes\nTwo personal training sessions monthly', 0, 'VIP', 'VIP'],
  ['VIP — 6 أشهر', 'VIP — 6 Months', 7900, '6 أشهر', '6 months', 180, 'دخول جميع الحصص\nجلستان تدريب شخصي شهرياً', 'Access to all classes\nTwo personal training sessions monthly', 0, 'VIP', 'VIP'],
  ['VIP — سنة', 'VIP — 1 Year', 12999, 'سنة', '1 year', 365, 'دخول جميع الحصص\nجلستان تدريب شخصي شهرياً', 'Access to all classes\nTwo personal training sessions monthly', 0, 'VIP', 'VIP'],
];

function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM sections').get().c > 0) return;
  const addSection = db.prepare('INSERT INTO sections(type,anchor,nav_label,title,subtitle,body,items,position,visible) VALUES(?,?,?,?,?,?,?,?,1)');
  const J = (x) => JSON.stringify(x);
  let p = 0;
  db.transaction(() => {
    addSection.run('hero', 'home', '', 'قاتل بقوة، وتدرّب بانضباط', 'ملاكمة · مواي تاي · تايكوندو · جوجيتسو · مصارعة — برامج للصغار والكبار.', '',
      J([{ btn: 'اشترك الآن', link: '#pricing' }, { btn: 'جدول الحصص', link: '#schedule' }]), p++);
    addSection.run('text', 'about', 'عن النادي', 'من نحن', 'نادٍ للفنون القتالية لكل المستويات',
      'فايت كلوب مكان للتدريب الجاد في أجواء تشجّع على التحدّي والانضباط. سواء كنت تبدأ من الصفر أو تستعد لمنافسة، ستجد برنامجاً يناسب مستواك ومدرباً يتابع تقدّمك.',
      J([{ value: '5', label: 'رياضات قتالية' }, { value: '3', label: 'فئات تدريب' }, { value: '9', label: 'خيارات اشتراك' }]), p++);
    addSection.run('cards', 'programs', 'البرامج', 'اختر رياضتك', 'برامج تدريبية متنوعة تناسب الأهداف والمستويات',
      '', J([
        { icon: 'glove', title: 'الملاكمة', title_en: 'Boxing', text: 'تدرّب على اللكمات، الحركة والدفاع.', text_en: 'Build your punches, footwork and defense.' },
        { icon: 'flame', title: 'مواي تاي', title_en: 'Muay Thai', text: 'تدرّب على الركلات واللكمات والركب.', text_en: 'Train with kicks, punches and knees.' },
        { icon: 'belt', title: 'تايكوندو', title_en: 'Taekwondo', text: 'طوّر سرعتك ومرونتك وتقنيات الركل.', text_en: 'Develop speed, flexibility and kicking technique.' },
        { icon: 'trophy', title: 'جوجيتسو', title_en: 'Jiu-Jitsu', text: 'تعلّم السيطرة والقتال الأرضي بالتقنية.', text_en: 'Learn grappling and ground control through technique.' },
        { icon: 'shield', title: 'مصارعة', title_en: 'Wrestling', text: 'قوّة وتوازن وإسقاطات تحت إشراف المدرب.', text_en: 'Build strength, balance and takedowns with a coach.' },
      ]), p++);
    addSection.run('pricing', 'pricing', 'الأسعار', 'باقات الاشتراك', 'اختر المدة المناسبة وابدأ اليوم', '', '[]', p++);
    addSection.run('offers', 'offers', 'العروض', 'العروض الحالية', 'فرص محدودة — لا تفوّتها', '', '[]', p++);
    addSection.run('schedule', 'schedule', 'الجدول', 'جدول الحصص', 'حصص للصغار والكبار من السبت إلى الخميس — اختر يوماً لعرض المواعيد', '', '[]', p++);
    addSection.run('faq', 'faq', 'أسئلة شائعة', 'أسئلة شائعة', '', '',
      J([
        { q: 'كيف أسجّل دخولي لحسابي؟', a: 'من زر «دخول المشتركين» باستخدام رقم الهوية أو الإقامة ورقم الجوال المسجّل لدى النادي.' },
        { q: 'كيف أعرف متى ينتهي اشتراكي؟', a: 'تظهر حالة اشتراكك وعدد الأيام المتبقية داخل حسابك، وسنرسل لك تنبيهاً عند قرب الانتهاء وعند انتهائه.' },
        { q: 'كيف أجدّد اشتراكي؟', a: 'تواصل معنا عبر واتساب أو زر النادي، وسيتم تجديد الاشتراك وتحديث حسابك مباشرة.' },
        { q: 'أين أجد مواعيد الحصص؟', a: 'في قسم «جدول الحصص» اختر اليوم لتظهر لك الحصص والمدربين.' },
      ]), p++);
    addSection.run('contact', 'contact', 'تواصل معنا', 'تواصل معنا', 'يسعدنا استقبالك', '', '[]', p++);
  })();

  const addPlan = db.prepare('INSERT INTO plans(name,name_en,price,old_price,period_label,period_label_en,duration_days,features,features_en,featured,badge,badge_en,visible,position) VALUES(?,?,?,NULL,?,?,?,?,?,?,?,?,1,?)');
  STARTER_PLANS.forEach((x, i) => addPlan.run(x[0], x[1], x[2], '/' + x[3], '/' + x[4], x[5], x[6], x[7], x[8], x[9], x[10], i));
}
seed();

const sectionCopyEn = {
  home: { title: 'Train hard. Fight with discipline.', subtitle: 'Boxing · Muay Thai · Taekwondo · Jiu-Jitsu · Wrestling — classes for children and adults.', nav: '', items: [{ btn_en: 'Join now' }, { btn_en: 'Class schedule' }] },
  about: { title: 'Who we are', subtitle: 'Combat sports for children and adults', nav: 'About us', body: 'Fight Club offers focused martial arts training in a disciplined, welcoming environment. Choose a sport and level, then follow your subscription and class schedule online.', items: [{ label_en: 'combat sports' }, { label_en: 'training groups' }, { label_en: 'membership options' }] },
  programs: { title: 'Choose your discipline', subtitle: 'Five combat sports for different goals and experience levels', nav: 'Programs', items: [{ title_en: 'Boxing', text_en: 'Build your punches, footwork and defense.' }, { title_en: 'Muay Thai', text_en: 'Train with kicks, punches and knees.' }, { title_en: 'Taekwondo', text_en: 'Develop speed, flexibility and kicking technique.' }, { title_en: 'Jiu-Jitsu', text_en: 'Learn grappling and ground control through technique.' }, { title_en: 'Wrestling', text_en: 'Build strength, balance and takedowns with a coach.' }] },
  pricing: { title: 'Membership plans', subtitle: 'Choose a plan and get started today', nav: 'Membership' },
  offers: { title: 'Current offers', subtitle: 'Limited-time offers — do not miss out', nav: 'Offers' },
  schedule: { title: 'Class schedule', subtitle: 'Classes for children and adults, Saturday through Thursday. Choose a day to see the times.', nav: 'Schedule' },
  faq: { title: 'Frequently asked questions', subtitle: '', nav: 'FAQ', items: [{ q_en: 'How do I sign in?', a_en: 'Use the national ID or residency number and the mobile number registered with the club.' }, { q_en: 'How can I check when my membership ends?', a_en: 'Your membership status and remaining days appear in your account. You will also see a reminder when it is close to expiring or has expired.' }, { q_en: 'How do I renew?', a_en: 'Contact us on WhatsApp or call the club, and we will update your membership.' }, { q_en: 'Where can I find class times?', a_en: 'Choose a day in the Class Schedule section to view classes and coaches.' }] },
  contact: { title: 'Contact us', subtitle: 'We would be glad to hear from you', nav: 'Contact' },
};
const byAnchor = db.prepare('SELECT * FROM sections WHERE anchor=?');
const updateSectionEn = db.prepare('UPDATE sections SET title_en=?,subtitle_en=?,nav_label_en=?,body_en=?,items=? WHERE id=?');
const seedTitles = { home: 'هنا تتصنّع القوة', about: 'من نحن', programs: 'اختر رياضتك', pricing: 'باقات الاشتراك', offers: 'العروض الحالية', schedule: 'جدول الحصص', faq: 'أسئلة شائعة', contact: 'تواصل معنا' };
for (const [anchor, copy] of Object.entries(sectionCopyEn)) {
  const row = byAnchor.get(anchor);
  if (!row) continue;
  const items = JSON.parse(row.items || '[]');
  if (row.title !== seedTitles[anchor] || row.title_en || row.subtitle_en || row.nav_label_en || row.body_en || items.some((it) => Object.keys(it).some((k) => k.endsWith('_en') && it[k]))) continue;
  const englishItems = (copy.items || []).map((e, i) => ({ ...(items[i] || {}), ...e }));
  for (let i = englishItems.length; i < items.length; i++) englishItems.push(items[i]);
  updateSectionEn.run(copy.title, copy.subtitle, copy.nav, copy.body || '', JSON.stringify(items.map((it, i) => ({ ...it, ...(englishItems[i] || {}) }))), row.id);
}
const seedPlanEn = db.prepare("UPDATE plans SET name_en=?,period_label_en=?,features_en=?,badge_en=? WHERE name=? AND name_en=''");
for (const p of [
  ['Monthly', '/ month', 'Unlimited gym access\nAll group classes\nCoach guidance', '', 'شهري'],
  ['Quarterly', '/ 3 months', 'Unlimited gym access\nAll group classes\nCoach guidance\nSave compared with monthly', 'Most popular', 'ربع سنوي'],
  ['6 months', '/ 6 months', 'Unlimited gym access\nAll group classes\nCoach guidance\nPriority class booking', '', 'نصف سنوي'],
  ['Annual', '/ year', 'Unlimited gym access\nAll group classes\nCoach guidance\nBest value', '', 'سنوي'],
]) seedPlanEn.run(...p);

function applyMigration(name, run) {
  if (db.prepare('SELECT 1 FROM app_migrations WHERE name=?').get(name)) return;
  const mark = db.prepare('INSERT INTO app_migrations(name) VALUES(?)');
  db.transaction(() => { run(); mark.run(name); })();
}

function insertStarterPlans() {
  const ins = db.prepare('INSERT INTO plans(name,name_en,price,old_price,period_label,period_label_en,duration_days,features,features_en,featured,badge,badge_en,visible,position) VALUES(?,?,?,NULL,?,?,?,?,?,?,?,?,1,?)');
  STARTER_PLANS.forEach((x, i) => ins.run(x[0], x[1], x[2], '/' + x[3], '/' + x[4], x[5], x[6], x[7], x[8], x[9], x[10], i));
}

applyMigration('fightclub-content-2026-10', () => {
  const oldPlans = ['شهري', 'ربع سنوي', 'نصف سنوي', 'سنوي'];
  const currentPlans = db.prepare('SELECT id,name FROM plans ORDER BY id').all();
  if (!db.prepare('SELECT 1 FROM members LIMIT 1').get() && currentPlans.length === oldPlans.length && currentPlans.every((p) => oldPlans.includes(p.name))) {
    db.prepare('DELETE FROM plans').run();
    insertStarterPlans();
  }

  const programs = db.prepare("SELECT id,items FROM sections WHERE anchor='programs'").get();
  if (programs) {
    let items = [];
    try { items = JSON.parse(programs.items || '[]'); } catch (_) { items = []; }
    const oldTitles = ['الملاكمة', 'المواي تاي', 'الجوجيتسو البرازيلي', 'الفنون المختلطة MMA'];
    if (items.length === oldTitles.length && items.every((x, i) => x.title === oldTitles[i])) {
      db.prepare('UPDATE sections SET subtitle=?,subtitle_en=?,items=? WHERE id=?').run(
        'تدرّب على خمس رياضات قتالية للصغار والكبار', 'Five combat sports for children and adults', JSON.stringify([
          { icon: 'glove', title: 'الملاكمة', title_en: 'Boxing', text: 'تدرّب على اللكمات، الحركة والدفاع.', text_en: 'Build your punches, footwork and defense.' },
          { icon: 'flame', title: 'مواي تاي', title_en: 'Muay Thai', text: 'تدرّب على الركلات واللكمات والركب.', text_en: 'Train with kicks, punches and knees.' },
          { icon: 'belt', title: 'تايكوندو', title_en: 'Taekwondo', text: 'طوّر سرعتك ومرونتك وتقنيات الركل.', text_en: 'Develop speed, flexibility and kicking technique.' },
          { icon: 'trophy', title: 'جوجيتسو', title_en: 'Jiu-Jitsu', text: 'تعلّم السيطرة والقتال الأرضي بالتقنية.', text_en: 'Learn grappling and ground control through technique.' },
          { icon: 'shield', title: 'مصارعة', title_en: 'Wrestling', text: 'قوّة وتوازن وإسقاطات تحت إشراف المدرب.', text_en: 'Build strength, balance and takedowns with a coach.' },
        ]), programs.id);
    }
  }

  const home = db.prepare("SELECT id FROM sections WHERE anchor='home' AND title='هنا تتصنّع القوة'").get();
  if (home) db.prepare('UPDATE sections SET title=?,title_en=?,subtitle=?,subtitle_en=? WHERE id=?').run('قاتل بقوة، وتدرّب بانضباط', 'Train hard. Fight with discipline.', 'ملاكمة · مواي تاي · تايكوندو · جوجيتسو · مصارعة — برامج للصغار والكبار.', 'Boxing · Muay Thai · Taekwondo · Jiu-Jitsu · Wrestling — classes for children and adults.', home.id);
  const about = db.prepare("SELECT id,items FROM sections WHERE anchor='about'").get();
  if (about) {
    let items = [];
    try { items = JSON.parse(about.items || '[]'); } catch (_) { items = []; }
    if (items.length === 3 && items[0].value === '4' && items[2].value === '4') {
      db.prepare('UPDATE sections SET items=? WHERE id=?').run(JSON.stringify([
        { value: '5', label: 'رياضات قتالية', label_en: 'combat sports' },
        { value: '3', label: 'فئات تدريب', label_en: 'training groups' },
        { value: '9', label: 'خيارات اشتراك', label_en: 'membership options' },
      ]), about.id);
    }
  }
  db.prepare("UPDATE sections SET subtitle=?,subtitle_en=? WHERE anchor='schedule' AND subtitle='اختر اليوم لتعرف مواعيد الحصص والمدربين'").run('حصص للصغار والكبار من السبت إلى الخميس — اختر يوماً لعرض المواعيد', 'Classes for children and adults, Saturday through Thursday. Choose a day to see the times.');
  const upSetting = db.prepare('UPDATE settings SET value=? WHERE key=? AND value=?');
  upSetting.run('ملاكمة,مواي تاي,تايكوندو,جوجيتسو,مصارعة', 'marquee', 'ملاكمة,مواي تاي,جوجيتسو برازيلي,MMA,لياقة وقوة');
  upSetting.run('BOXING,MUAY THAI,TAEKWONDO,JIU-JITSU,WRESTLING', 'marquee_en', 'BOXING,MUAY THAI,BRAZILIAN JIU-JITSU,MMA,STRENGTH & FITNESS');
  upSetting.run('6', 'week_start', '0');
  upSetting.run('0530335050', 'phone', '');
  upSetting.run('0530335050', 'whatsapp', '');
  upSetting.run('fightclubssaudi@gmail.com', 'email', '');
});

const STARTER_CLASSES = {
  6: [
    ['16:00', '17:00', 'ملاكمة الفتيات', 'Girls Boxing', 'فتيات', 'Girls', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['17:00', '18:30', 'ملاكمة', 'Boxing', 'أطفال', 'Children', 'صالة A', 'Hall A'],
    ['17:00', '18:30', 'تايكوندو', 'Taekwondo', 'أطفال متقدمون', 'Advanced children', 'صالة B', 'Hall B'],
    ['18:30', '20:00', 'تايكوندو', 'Taekwondo', 'كبار متقدمون', 'Advanced adults', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['20:00', '21:30', 'ملاكمة', 'Boxing', 'كبار', 'Adults', 'صالة A + صالة B', 'Hall A + Hall B'],
  ],
  1: [
    ['16:00', '17:00', 'ملاكمة الفتيات', 'Girls Boxing', 'فتيات', 'Girls', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['17:00', '18:30', 'ملاكمة', 'Boxing', 'أطفال', 'Children', 'صالة A', 'Hall A'],
    ['17:00', '18:30', 'تايكوندو', 'Taekwondo', 'أطفال متقدمون', 'Advanced children', 'صالة B', 'Hall B'],
    ['18:30', '20:00', 'تايكوندو', 'Taekwondo', 'كبار متقدمون', 'Advanced adults', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['20:00', '21:30', 'ملاكمة', 'Boxing', 'كبار', 'Adults', 'صالة A + صالة B', 'Hall A + Hall B'],
  ],
  3: [
    ['16:00', '17:00', 'ملاكمة الفتيات', 'Girls Boxing', 'فتيات', 'Girls', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['17:00', '18:30', 'ملاكمة', 'Boxing', 'أطفال', 'Children', 'صالة A', 'Hall A'],
    ['17:00', '18:30', 'تايكوندو', 'Taekwondo', 'أطفال متقدمون', 'Advanced children', 'صالة B', 'Hall B'],
    ['18:30', '20:00', 'تايكوندو', 'Taekwondo', 'كبار متقدمون', 'Advanced adults', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['20:00', '21:30', 'ملاكمة', 'Boxing', 'كبار', 'Adults', 'صالة A + صالة B', 'Hall A + Hall B'],
  ],
  0: [
    ['17:00', '18:30', 'مواي تاي', 'Muay Thai', 'أطفال', 'Children', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['18:30', '20:00', 'تايكوندو', 'Taekwondo', 'مبتدئون', 'Beginners', 'صالة A', 'Hall A'],
    ['18:30', '20:00', 'مواي تاي', 'Muay Thai', 'مبتدئون', 'Beginners', 'صالة B', 'Hall B'],
    ['20:00', '21:30', 'ملاكمة', 'Boxing', 'كبار', 'Adults', 'صالة A', 'Hall A'],
    ['20:00', '21:30', 'مواي تاي', 'Muay Thai', 'متقدمون', 'Advanced', 'صالة B', 'Hall B'],
  ],
  2: [
    ['17:00', '18:30', 'مواي تاي', 'Muay Thai', 'أطفال', 'Children', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['18:30', '20:00', 'تايكوندو', 'Taekwondo', 'مبتدئون', 'Beginners', 'صالة A', 'Hall A'],
    ['18:30', '20:00', 'مواي تاي', 'Muay Thai', 'مبتدئون', 'Beginners', 'صالة B', 'Hall B'],
    ['20:00', '21:30', 'ملاكمة', 'Boxing', 'كبار', 'Adults', 'صالة A', 'Hall A'],
    ['20:00', '21:30', 'مواي تاي', 'Muay Thai', 'متقدمون', 'Advanced', 'صالة B', 'Hall B'],
  ],
  4: [
    ['17:00', '18:30', 'مواي تاي', 'Muay Thai', 'أطفال', 'Children', 'صالة A + صالة B', 'Hall A + Hall B'],
    ['18:30', '20:00', 'تايكوندو', 'Taekwondo', 'مبتدئون', 'Beginners', 'صالة A', 'Hall A'],
    ['18:30', '20:00', 'مواي تاي', 'Muay Thai', 'مبتدئون', 'Beginners', 'صالة B', 'Hall B'],
    ['20:00', '21:30', 'ملاكمة', 'Boxing', 'كبار', 'Adults', 'صالة A', 'Hall A'],
    ['20:00', '21:30', 'مواي تاي', 'Muay Thai', 'متقدمون', 'Advanced', 'صالة B', 'Hall B'],
  ],
};

applyMigration('fightclub-weekly-schedule-2026-10', () => {
  if (db.prepare('SELECT 1 FROM classes LIMIT 1').get()) return;
  const { todayStr, addDays } = require('./util');
  const ins = db.prepare('INSERT INTO classes(date,start_time,end_time,title,title_en,tag,tag_en,notes,notes_en) VALUES(?,?,?,?,?,?,?,?,?)');
  const start = todayStr();
  for (let i = 0; i <= 365; i++) {
    const date = addDays(start, i);
    const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
    for (const c of (STARTER_CLASSES[weekday] || [])) ins.run(date, ...c.slice(0, 2), c[2], c[3], c[4], c[5], c[6], c[7]);
  }
});

module.exports = { db, DATA_DIR, getSettings, SETTING_KEYS, DEFAULT_SETTINGS };
