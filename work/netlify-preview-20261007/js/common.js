(function () {
  'use strict';
  const FC = (window.FC = {});
  let savedLang = 'ar';
  try { savedLang = localStorage.getItem('fc_lang') === 'en' ? 'en' : 'ar'; } catch (_) {}
  FC.lang = savedLang;
  FC.setLang = (lang) => {
    FC.lang = lang === 'en' ? 'en' : 'ar';
    try { localStorage.setItem('fc_lang', FC.lang); } catch (_) {}
    document.documentElement.lang = FC.lang;
    document.documentElement.dir = FC.lang === 'en' ? 'ltr' : 'rtl';
  };
  FC.setLang(savedLang);
  FC.loc = (ar, en) => FC.lang === 'en' ? (en || ar || '') : (ar || '');
  FC.value = (item, key) => FC.lang === 'en' ? (item && (item[key + '_en'] || item[key]) || '') : (item && item[key] || '');

  FC.h = function (tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'svg') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return el;
  };
  const h = FC.h;

  FC.api = async function (path, { method = 'GET', body } = {}) {
    let res;
    try {
      res = await fetch('/api' + path, {
        method, credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) { throw Object.assign(new Error('تعذّر الاتصال بالخادم. تحقق من الإنترنت.'), { status: 0 }); }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw Object.assign(new Error((data && data.error) || 'حدث خطأ غير متوقع'), { status: res.status });
    return data;
  };

  FC.safeUrl = (u) => {
    u = String(u || '').trim();
    return /^(#|\/(?!\/)|https?:\/\/|tel:|mailto:)/i.test(u) ? u : '';
  };

  const I = {
    glove: '<path d="M7 12V7a4 4 0 0 1 4-4h2.5A4.5 4.5 0 0 1 18 7.5V12a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5Z"/><path d="M7 10h4.5"/><rect x="8" y="17" width="8" height="4.5" rx="1"/>',
    belt: '<rect x="2" y="9" width="20" height="6" rx="1"/><rect x="10" y="7" width="4" height="10" rx="1"/><path d="m12 17-2 4M12 17l2 4"/>',
    dumbbell: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
    chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>',
    chevL: '<path d="m15 18-6-6 6-6"/>',
    chevD: '<path d="m6 9 6 6 6-6"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M8 16H3v5"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61"/><path d="m2 2 20 20"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
    layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
    tag: '<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  };
  FC.ICON_NAMES = ['glove', 'belt', 'dumbbell', 'flame', 'trophy', 'shield', 'clock', 'users', 'heart', 'zap', 'star', 'target', 'award', 'calendar'];
  FC.ICON_LABELS = { glove: 'قفاز', belt: 'حزام', dumbbell: 'أثقال', flame: 'نار', trophy: 'كأس', shield: 'درع', clock: 'ساعة', users: 'أشخاص', heart: 'قلب', zap: 'صاعقة', star: 'نجمة', target: 'هدف', award: 'ميدالية', calendar: 'تقويم' };
  FC.icon = function (name, size = 20) {
    const s = document.createElement('span');
    s.className = 'ico';
    s.style.cssText = `display:inline-flex;width:${size}px;height:${size}px;flex:none`;
    s.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[name] || I.star}</svg>`;
    return s;
  };

  const pad = (n) => String(n).padStart(2, '0');
  FC.pad = pad;
  FC.MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  FC.DAYS_FULL = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  FC.DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  FC.fmtTime = (t) => {
    if (!t) return '';
    const [H, M] = t.split(':').map(Number);
    if (FC.lang === 'en') return `${H % 12 || 12}:${pad(M)} ${H >= 12 ? 'PM' : 'AM'}`;
    return `${H % 12 || 12}:${pad(M)} ${H >= 12 ? 'م' : 'ص'}`;
  };
  FC.fmtRange = (a, b) => FC.fmtTime(a) + (b ? ' – ' + FC.fmtTime(b) : '');
  FC.fmtDate = (d) => {
    if (!d) return '';
    const [y, m, day] = d.split('-').map(Number);
    if (FC.lang === 'en') return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    return `${day} ${FC.MONTHS[m - 1]} ${y}`;
  };
  FC.fmtDateLong = (d) => {
    const [y, m, day] = d.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    if (FC.lang === 'en') return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
    return `${FC.DAYS_FULL[wd]} ${day} ${FC.MONTHS[m - 1]}`;
  };
  FC.money = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

  FC.waLink = (settings, text) => {
    let n = String(settings.whatsapp || settings.phone || '').replace(/\D/g, '');
    if (!n) return '';
    const cc = String(settings.country_code || '966');
    if (n.startsWith('00')) n = n.slice(2);
    else if (n.startsWith('0')) n = cc + n.slice(1);
    else if (!n.startsWith(cc) && n.length <= 9) n = cc + n;
    return `https://wa.me/${n}` + (text ? `?text=${encodeURIComponent(text)}` : '');
  };

  FC.Calendar = class {
    constructor(root, cfg) {
      this.root = root; this.cfg = cfg;
      const [y, m] = cfg.today.split('-').map(Number);
      this.y = y; this.m = m; this.data = {}; this.sel = cfg.today;
      this.title = h('div', { class: 'cal-title' });
      this.grid = h('div', { class: 'cal-grid', role: 'grid' });
      const nav = (icon, label, step) => h('button', { type: 'button', class: 'cal-nav', 'aria-label': label, onclick: () => this.step(step) }, FC.icon(icon, 20));
      this.head = h('div', { class: 'cal-head' }, nav(FC.lang === 'en' ? 'chevL' : 'chevR', FC.loc('الشهر السابق', 'Previous month'), -1), this.title, nav(FC.lang === 'en' ? 'chevR' : 'chevL', FC.loc('الشهر التالي', 'Next month'), 1));
      this.wd = h('div', { class: 'cal-wd', 'aria-hidden': 'true' });
      root.classList.add('cal');
      root.replaceChildren(this.head, this.wd, this.grid);
      this.render();
    }
    get month() { return `${this.y}-${pad(this.m)}`; }
    step(n) {
      this.m += n;
      if (this.m < 1) { this.m = 12; this.y--; } else if (this.m > 12) { this.m = 1; this.y++; }
      this.data = {}; this.render(); this.cfg.onMonth && this.cfg.onMonth(this.month);
    }
    setData(byDate) { this.data = byDate || {}; this.render(); }
    select(d) { this.sel = d; this.render(); this.cfg.onSelect && this.cfg.onSelect(d); }
    render() {
      const ws = Number(this.cfg.weekStart) || 0;
      this.title.textContent = FC.lang === 'en' ? new Date(Date.UTC(this.y, this.m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : `${FC.MONTHS[this.m - 1]} ${this.y}`;
      this.wd.replaceChildren(...Array.from({ length: 7 }, (_, i) => {
        const d = (i + ws) % 7;
        const full = FC.lang === 'en' ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d] : FC.DAYS_FULL[d];
        const short = FC.lang === 'en' ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] : FC.DAYS_SHORT[d];
        return h('span', {}, h('b', { class: 'wd-full', text: full }), h('b', { class: 'wd-short', text: short }));
      }));
      const first = new Date(Date.UTC(this.y, this.m - 1, 1)).getUTCDay();
      const dim = new Date(Date.UTC(this.y, this.m, 0)).getUTCDate();
      const lead = (first - ws + 7) % 7;
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'cal-cell empty', 'aria-hidden': 'true' }));
      for (let d = 1; d <= dim; d++) {
        const ds = `${this.y}-${pad(this.m)}-${pad(d)}`;
        const list = this.data[ds] || [];
        const cls = ['cal-cell'];
        if (list.length) cls.push('has');
        if (ds === this.cfg.today) cls.push('today');
        if (ds === this.sel) cls.push('sel');
        cells.push(h('button', {
          type: 'button', class: cls.join(' '), role: 'gridcell', 'aria-label': `${FC.fmtDateLong(ds)}${list.length ? ' — ' + list.length + FC.loc(' حصص', ' classes') : ''}`,
          'aria-pressed': ds === this.sel ? 'true' : 'false', onclick: () => this.select(ds),
        }, h('span', { class: 'cal-num', text: String(d) }),
          list.length ? h('span', { class: 'cal-dots' }, ...list.slice(0, 3).map(() => h('i')), list.length > 3 ? h('em', { text: '+' }) : null) : null));
      }
      this.grid.replaceChildren(...cells);
    }
  };

  FC.groupByDate = (classes) => {
    const o = {};
    (classes || []).forEach((c) => { (o[c.date] = o[c.date] || []).push(c); });
    return o;
  };

  FC.toast = (msg, type = 'ok') => {
    let box = document.getElementById('toasts');
    if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(box); }
    const t = h('div', { class: 'toast ' + type, text: msg });
    box.append(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3200);
  };

  FC.reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
})();
