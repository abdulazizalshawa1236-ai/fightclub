(function () {
  'use strict';
  FC.lang = 'ar';
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
  const { h, icon, api } = FC;
  const app = document.getElementById('app');
  const S = { settings: {}, plans: [], stats: null };
  let uidn = 0; const uid = () => 'f' + (++uidn);

  const SL = { active: 'فعّال', expiring: 'ينتهي قريباً', expired: 'منتهي', disabled: 'معطّل', upcoming: 'لم يبدأ' };
  const fmtTpl = (t, v) => String(t || '').replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');

  function field(label, input, o = {}) {
    const id = uid(); (o.target || input).id = id;
    return h('div', { class: 'field' + (o.full ? ' full' : '') }, h('label', { for: id, text: label }), input, o.help ? h('small', { class: 'help', text: o.help }) : null);
  }
  const inp = (v, a = {}) => h('input', { class: 'input', value: v ?? '', ...a });
  const area = (v, a = {}) => h('textarea', { class: 'input', ...a }, v ?? '');
  function sel(options, value, a = {}) {
    const s = h('select', { class: 'input', ...a }, options.map(([v, l]) => h('option', { value: v, text: l })));
    s.value = String(value ?? ''); return s;
  }
  const check = (label, on) => { const cb = h('input', { type: 'checkbox', checked: !!on }); return { cb, el: h('label', { class: 'check' }, cb, h('span', { text: label })) }; };

  function modal(title, body, { wide, footer } = {}) {
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const btns = footer ? footer(close) : [];
    const m = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('header', {}, h('h2', { text: title }), h('button', { class: 'b ico-only', type: 'button', 'aria-label': 'إغلاق', onclick: close }, icon('x', 18))),
      h('div', { class: 'mb' }, body), btns.length ? h('footer', {}, ...btns) : null);
    const bg = h('div', { class: 'modal-bg' }, m);
    let down = false;
    bg.addEventListener('mousedown', (e) => { down = e.target === bg; });
    bg.addEventListener('click', (e) => { if (down && e.target === bg) close(); });
    document.addEventListener('keydown', onKey);
    document.body.append(bg);
    const f = m.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea,select,button.b.pri'); if (f) f.focus();
    return { close, m };
  }

  function formModal(title, bodyEls, onSave, { wide, saveLabel = 'حفظ' } = {}) {
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true, style: { marginBottom: '1rem' } });
    const body = h('form', { novalidate: true }, err, ...[].concat(bodyEls));
    const mod = modal(title, body, { wide, footer: (close) => {
      const save = h('button', { class: 'b pri', type: 'button', text: saveLabel });
      save.addEventListener('click', async () => {
        err.hidden = true; save.disabled = true;
        try { await onSave(); mod.close(); } catch (e) { err.textContent = e.message; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); save.disabled = false; }
      });
      body.addEventListener('submit', (e) => { e.preventDefault(); save.click(); });
      return [save, h('button', { class: 'b', type: 'button', onclick: close, text: 'إلغاء' })];
    } });
    return mod;
  }

  function ask(message, okLabel = 'تأكيد', danger = true) {
    return new Promise((resolve) => {
      let done = false;
      const fin = (v) => { if (!done) { done = true; resolve(v); } };
      const mod = modal('تأكيد', h('p', { text: message, style: { lineHeight: 1.8 } }), { footer: (close) => [
        h('button', { class: 'b ' + (danger ? 'danger' : 'pri'), type: 'button', text: okLabel, onclick: () => { fin(true); close(); } }),
        h('button', { class: 'b', type: 'button', text: 'إلغاء', onclick: () => { fin(false); close(); } })] });
      const obs = new MutationObserver(() => { if (!document.body.contains(mod.m)) { fin(false); obs.disconnect(); } });
      obs.observe(document.body, { childList: true });
    });
  }
  const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) FC.toast(okMsg); return r; } catch (e) { FC.toast(e.message, 'err'); throw e; } };

  async function uploadFile(file) {
    const fd = new FormData(); fd.append('file', file);
    const r = await fetch('/api/admin/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'فشل رفع الصورة');
    return j.url;
  }
  function imageField(value) {
    const t = inp(value, { class: 'input ltr', placeholder: 'رابط الصورة أو ارفع صورة', autocomplete: 'off' });
    const prev = h('img', { class: 'img-prev', alt: '', hidden: !value, src: value || null });
    const file = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', hidden: true });
    const sync = () => { const v = t.value.trim(); prev.hidden = !v; if (v) prev.src = v; };
    t.addEventListener('change', sync);
    const btn = h('button', { class: 'b sm', type: 'button', onclick: () => file.click() }, icon('image', 16), 'رفع');
    file.addEventListener('change', async () => {
      if (!file.files[0]) return; btn.disabled = true;
      try { t.value = await uploadFile(file.files[0]); sync(); } catch (e) { FC.toast(e.message, 'err'); }
      btn.disabled = false; file.value = '';
    });
    return { input: t, el: h('div', { class: 'img-f' }, prev, t, btn, file) };
  }

  function repeater(cfg, items, { addLabel = 'إضافة عنصر', max = 40 } = {}) {
    const translatable = new Set(['title', 'text', 'label', 'q', 'a', 'btn', 'caption']);
    const list = h('div', { class: 'rep' }); const rows = [];
    const addBtn = h('button', { class: 'b sm', type: 'button', onclick: () => add({}, true) }, icon('plus', 16), addLabel);
    function paint() { list.replaceChildren(...rows.map((r) => r.el)); addBtn.disabled = rows.length >= max; }
    function add(data, focus) {
      if (rows.length >= max) return;
      const refs = {}; const cols = h('div', { class: 'rep-cols' });
      cfg.forEach((c) => {
        let el; let target;
        if (c.kind === 'area') { el = area(data[c.k] || '', { rows: 2 }); }
        else if (c.kind === 'icon') { el = sel([['', 'بدون أيقونة']].concat(FC.ICON_NAMES.map((n) => [n, FC.ICON_LABELS[n]])), data[c.k] || ''); }
        else if (c.kind === 'image') { const f = imageField(data[c.k] || ''); refs[c.k] = f.input; el = f.el; target = f.input; cols.append(field(c.label, el, { full: c.full, target })); return; }
        else { el = inp(data[c.k] || '', c.ltr ? { class: 'input ltr' } : {}); }
        refs[c.k] = el; cols.append(field(c.label, el, { full: c.full }));
        if (translatable.has(c.k)) {
          const enKey = c.k + '_en';
          const en = c.kind === 'area' ? area(data[enKey] || '', { rows: 2, class: 'input ltr' }) : inp(data[enKey] || '', { class: 'input ltr' });
          refs[enKey] = en; cols.append(field(c.label + ' (English)', en, { full: c.full }));
        }
      });
      const row = { el: null, refs };
      const move = (d) => { const i = rows.indexOf(row); const j = i + d; if (j < 0 || j >= rows.length) return; [rows[i], rows[j]] = [rows[j], rows[i]]; paint(); };
      row.el = h('div', { class: 'rep-row' }, cols, h('div', { class: 'rep-ctl' },
        h('button', { class: 'b sm ico-only', type: 'button', 'aria-label': 'أعلى', onclick: () => move(-1) }, icon('up', 16)),
        h('button', { class: 'b sm ico-only', type: 'button', 'aria-label': 'أسفل', onclick: () => move(1) }, icon('down', 16)),
        h('button', { class: 'b sm ico-only danger', type: 'button', 'aria-label': 'حذف', onclick: () => { rows.splice(rows.indexOf(row), 1); paint(); } }, icon('trash', 16))));
      rows.push(row); paint();
      if (focus) { const f = row.el.querySelector('input,textarea'); if (f) f.focus(); }
    }
    (items || []).forEach((d) => add(d, false));
    return {
      el: h('div', {}, list, h('div', { style: { marginTop: '.7rem' } }, addBtn)),
      get: () => rows.map((r) => { const o = {}; cfg.forEach((c) => { o[c.k] = (r.refs[c.k].value || '').trim(); if (translatable.has(c.k)) o[c.k + '_en'] = (r.refs[c.k + '_en'].value || '').trim(); }); return o; }).filter((o) => Object.values(o).some(Boolean)),
    };
  }

  function waMember(m) {
    const s = S.settings; const cc = s.country_code || '966';
    let n = String(m.phone).replace(/\D/g, ''); if (n.startsWith('0')) n = cc + n.slice(1);
    const tpl = m.status === 'expired' ? s.msg_expired : m.status === 'expiring' ? s.msg_expiring : '';
    const text = fmtTpl(tpl, { name: m.full_name, club: s.club_name, date: m.end_date });
    return `https://wa.me/${n}` + (text ? `?text=${encodeURIComponent(text)}` : '');
  }
  const leftText = (m) => m.status === 'expired' ? `منذ ${Math.abs(m.days_left)} يوم` : m.status === 'expiring' ? (m.days_left === 0 ? 'ينتهي اليوم' : `متبقي ${m.days_left} يوم`) : m.status === 'active' ? `متبقي ${m.days_left} يوم` : '';
  const badge = (st) => h('span', { class: 'badge ' + st, text: SL[st] || st });
  const ltr = (t) => h('span', { class: 'ltr', text: t });
  const pageHead = (title, sub, ...tools) => h('div', { class: 'page-head' }, h('div', {}, h('h1', { text: title }), sub ? h('p', { text: sub }) : null), h('div', { class: 'tools' }, ...tools));
  const addBtnEl = (label, fn) => h('button', { class: 'b pri', type: 'button', onclick: fn }, icon('plus', 18), label);

  async function loadPlans() { S.plans = (await api('/admin/plans')).plans; return S.plans; }
  async function loadSettings() { S.settings = (await api('/admin/settings')).settings; return S.settings; }

  function loginView() {
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const u = inp('', { name: 'username', autocomplete: 'username', required: true, class: 'input ltr' });
    const p = inp('', { name: 'password', type: 'password', autocomplete: 'current-password', required: true, class: 'input ltr' });
    const btn = h('button', { class: 'btn', type: 'submit', text: 'دخول' });
    const form = h('form', { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); err.hidden = true; btn.disabled = true;
      try { await api('/admin/login', { method: 'POST', body: { username: u.value, password: p.value } }); await boot(); }
      catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
    } }, h('h1', { text: 'لوحة التحكم' }), err, field('اسم المستخدم', u), field('كلمة المرور', p), btn);
    app.replaceChildren(h('div', { class: 'a-login' }, h('div', { class: 'box' }, h('div', { class: 'logo' }, h('img', { src: '/assets/logo-main.jpg', alt: 'فايت كلوب' })), form)));
    u.focus();
  }

  const NAV = [['dashboard', 'نظرة عامة', 'home'], ['members', 'المشتركون', 'users'], ['plans', 'الباقات والأسعار', 'tag'], ['offers', 'العروض', 'star'],
    ['sections', 'أقسام الموقع', 'layout'], ['schedule', 'جدول الحصص', 'calendar'], ['notify', 'التنبيهات', 'bell'], ['settings', 'الإعدادات', 'settings']];
  const VIEWS = {};
  let content; let shellEl; let navBtns = {};
  let token = 0;

  function shell() {
    content = h('main', { class: 'content', id: 'content' });
    const side = h('aside', { class: 'side' },
      h('div', { class: 'brand' }, h('img', { src: '/assets/logo-inner.png', alt: 'فايت كلوب' })),
      h('nav', { 'aria-label': 'لوحة التحكم' }, ...NAV.map(([id, label, ic]) => {
        const cnt = h('span', { class: 'cnt', hidden: true, id: 'cnt-' + id });
        const b = h('button', { type: 'button', onclick: () => { location.hash = '#/' + id; shellEl.classList.remove('open'); } }, icon(ic, 20), h('span', { text: label }), cnt);
        navBtns[id] = b; return b;
      })),
      h('div', { class: 'foot' },
        h('a', { href: '/', target: '_blank', rel: 'noopener' }, icon('eye', 18), 'عرض الموقع'),
        h('button', { type: 'button', onclick: async () => { await api('/admin/logout', { method: 'POST' }); location.hash = ''; loginView(); } }, icon('logout', 18), 'تسجيل الخروج')));
    shellEl = h('div', { class: 'shell' },
      h('div', { class: 'topbar' }, h('img', { src: '/assets/logo-inner.png', alt: '' }), h('button', { type: 'button', 'aria-label': 'القائمة', onclick: () => shellEl.classList.toggle('open') }, icon('menu', 22))),
      side, content, h('div', { class: 'scrim', hidden: true }));
    const scrim = shellEl.querySelector('.scrim');
    new MutationObserver(() => { scrim.hidden = !shellEl.classList.contains('open'); }).observe(shellEl, { attributes: true, attributeFilter: ['class'] });
    scrim.addEventListener('click', () => shellEl.classList.remove('open'));
    app.replaceChildren(shellEl);
  }

  async function refreshCounts() {
    try {
      S.stats = await api('/admin/stats');
      const n = S.stats.counts.expired + S.stats.counts.expiring; const el = document.getElementById('cnt-members');
      if (el) { el.textContent = n; el.hidden = !n; }
    } catch (_) {}
  }

  async function route() {
    const id = (location.hash.replace(/^#\//, '').split('?')[0]) || 'dashboard';
    const name = VIEWS[id] ? id : 'dashboard';
    Object.entries(navBtns).forEach(([k, b]) => (k === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current')));
    const my = ++token; content.replaceChildren(h('p', { class: 'adm-loading', text: 'جارٍ التحميل…' }));
    const root = h('div');
    try { await VIEWS[name](root, () => my === token); } catch (e) {
      if (e.status === 401) return loginView();
      if (my === token) root.replaceChildren(h('div', { class: 'form-error', text: e.message }));
    }
    if (my !== token) return;
    content.replaceChildren(root); window.scrollTo(0, 0); refreshCounts();
  }
  const reload = () => route();

  VIEWS.dashboard = async (root) => {
    const [st] = await Promise.all([api('/admin/stats'), loadSettings()]);
    S.stats = st; const c = st.counts;
    const go = (status) => () => { sessionStorage.setItem('adm_status', status); location.hash = '#/members'; };
    const card = (cls, num, label, status) => h('button', { type: 'button', class: 'stat-c ' + cls, onclick: go(status) }, h('b', { text: num }), h('span', { text: label }));
    const row = (m) => h('li', {}, h('div', { class: 'grow' }, h('strong', { text: m.full_name }), h('small', { text: `${leftText(m)} — ${FC.fmtDate(m.end_date)}` })),
      h('a', { class: 'b sm', href: waMember(m), target: '_blank', rel: 'noopener' }, icon('chat', 16), 'واتساب'),
      h('button', { class: 'b sm pri', type: 'button', onclick: () => renewModal(m) }, icon('refresh', 16), 'تجديد'));
    root.append(pageHead('نظرة عامة', 'ملخص سريع لحالة النادي اليوم'),
      h('div', { class: 'grid-stats' }, card('', c.total, 'إجمالي المشتركين', 'all'), card('ok', c.active + c.upcoming, 'اشتراكات فعّالة', 'active'), card('warn', c.expiring, 'تنتهي قريباً', 'expiring'), card('red', c.expired, 'منتهية', 'expired')),
      h('div', { class: 'cols two' },
        h('section', { class: 'card-a' }, h('h2', {}, icon('clock', 22), 'تنتهي قريباً'), st.expiring.length ? h('ul', { class: 'mini' }, ...st.expiring.map(row)) : h('p', { class: 'empty', text: 'لا توجد اشتراكات تنتهي قريباً.' })),
        h('section', { class: 'card-a' }, h('h2', {}, icon('alert', 22), 'انتهت مؤخراً'), st.expired.length ? h('ul', { class: 'mini' }, ...st.expired.map(row)) : h('p', { class: 'empty', text: 'لا توجد اشتراكات منتهية.' })),
        h('section', { class: 'card-a' }, h('h2', {}, icon('calendar', 22), 'حصص اليوم'),
          st.todayClasses.length ? h('ul', { class: 'mini' }, ...st.todayClasses.map((k) => h('li', {}, h('div', { class: 'grow' }, h('strong', { text: k.title }), h('small', { text: [k.trainer, FC.fmtRange(k.start_time, k.end_time)].filter(Boolean).join(' — ') }))))) : h('p', { class: 'empty', text: 'لا توجد حصص اليوم.' }))));
  };

  const MS = { q: '', status: 'all', page: 1 };
  async function memberForm(m) {
    const plans = S.plans.length ? S.plans : await loadPlans();
    const edit = !!m; m = m || {};
    const today = S.stats ? S.stats.today : new Date().toISOString().slice(0, 10);
    const name = inp(m.full_name, { maxlength: 80, autocomplete: 'off' });
    const nid = inp(m.national_id, { class: 'input ltr', inputmode: 'numeric', maxlength: 14, placeholder: '1XXXXXXXXX', autocomplete: 'off' });
    const ph = inp(m.phone, { class: 'input ltr', inputmode: 'tel', maxlength: 18, placeholder: '05XXXXXXXX', autocomplete: 'off' });
    const plan = sel([['', '— بدون باقة —']].concat(plans.map((p) => [p.id, `${p.name} (${p.duration_days} يوم)`])), m.plan_id || (edit ? '' : (plans[0] && plans[0].id)));
    const start = inp(m.start_date || today, { type: 'date' });
    const end = inp(m.end_date || '', { type: 'date' });
    const act = check('الحساب مفعّل (يستطيع تسجيل الدخول)', edit ? m.active : true);
    const notes = area(m.notes || '', { rows: 2, maxlength: 500 });
    const whatsappStatus = edit ? h('p', { class: 'note-box', text: m.phone_verified_at
      ? `رقم واتساب موثّق${m.whatsapp_updates_opt_in ? ' · يوافق على رسائل الاشتراك' : ''}${m.whatsapp_marketing_opt_in ? ' · يوافق على العروض' : ''}`
      : 'رقم واتساب غير موثّق بعد. على المشترك إدخال رمز الدخول المرسل للرقم المسجّل.' }) : null;
    const autoEnd = () => {
      const p = plans.find((x) => String(x.id) === plan.value); if (!p || !start.value) return;
      const d = new Date(start.value + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + p.duration_days - 1); end.value = d.toISOString().slice(0, 10);
    };
    plan.addEventListener('change', autoEnd); start.addEventListener('change', autoEnd);
    if (!edit) autoEnd();
    formModal(edit ? 'تعديل مشترك' : 'إضافة مشترك', h('div', { class: 'form-grid' },
      field('الاسم الكامل', name, { full: true }),
      field('رقم الهوية / الإقامة', nid, { help: '10 أرقام — هو اسم الدخول للمشترك' }),
      field('رقم الجوال', ph, { help: 'يُرسل إليه رمز التحقق لتسجيل الدخول' }),
      field('الباقة', plan, { full: true }), field('بداية الاشتراك', start), field('نهاية الاشتراك', end, { help: 'تُحسب تلقائياً من الباقة ويمكن تعديلها' }),
      field('ملاحظات (للإدارة فقط)', notes, { full: true }), whatsappStatus, h('div', { class: 'full' }, act.el)),
    async () => {
      const body = { full_name: name.value, national_id: nid.value, phone: ph.value, plan_id: plan.value || null, start_date: start.value, end_date: end.value, notes: notes.value, active: act.cb.checked };
      await api(edit ? `/admin/members/${m.id}` : '/admin/members', { method: edit ? 'PUT' : 'POST', body });
      FC.toast(edit ? 'تم حفظ التعديلات' : 'تمت إضافة المشترك'); reload();
    });
  }
  async function renewModal(m) {
    const plans = S.plans.length ? S.plans : await loadPlans();
    const plan = sel(plans.map((p) => [p.id, `${p.name} — ${p.duration_days} يوم`]), m.plan_id || (plans[0] && plans[0].id));
    formModal('تجديد اشتراك ' + m.full_name, [
      h('p', { class: 'note-box', text: m.status === 'expired' || m.status === 'disabled' ? 'الاشتراك منتهي: سيبدأ التجديد من اليوم.' : 'الاشتراك ما زال فعّالاً: ستُضاف المدة الجديدة بعد تاريخ الانتهاء الحالي.' }),
      field('الباقة', plan)],
    async () => { const r = await api(`/admin/members/${m.id}/renew`, { method: 'POST', body: { plan_id: plan.value } }); FC.toast('تم التجديد حتى ' + FC.fmtDate(r.end_date)); reload(); }, { saveLabel: 'تجديد الآن' });
  }

  VIEWS.members = async (root, alive) => {
    await Promise.all([loadPlans(), loadSettings()]);
    const pre = sessionStorage.getItem('adm_status'); if (pre) { MS.status = pre; MS.page = 1; sessionStorage.removeItem('adm_status'); }
    const chipsBox = h('div', { class: 'chips' }); const tableBox = h('div'); const pager = h('div', { class: 'pager' });
    const search = inp(MS.q, { type: 'search', placeholder: 'بحث بالاسم / الهوية / الجوال', 'aria-label': 'بحث', style: { width: 'min(320px, 100%)' } });
    let timer;
    search.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => { MS.q = search.value.trim(); MS.page = 1; draw(); }, 250); });
    root.append(pageHead('المشتركون', 'إضافة وتعديل وتجديد اشتراكات الأعضاء', search,
      h('a', { class: 'b', href: '/api/admin/export/members.csv', download: 'members.csv' }, icon('download', 18), 'تصدير Excel'), addBtnEl('مشترك جديد', () => memberForm())), chipsBox, tableBox, pager);
    async function draw() {
      const r = await api(`/admin/members?q=${encodeURIComponent(MS.q)}&status=${MS.status}`);
      if (!alive()) return; const c = r.counts;
      const chip = (k, l, n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': MS.status === k ? 'true' : 'false', onclick: () => { MS.status = k; MS.page = 1; draw(); } }, l, h('b', { text: n }));
      chipsBox.replaceChildren(chip('all', 'الكل', c.total), chip('active', 'فعّال', c.active + c.upcoming), chip('expiring', 'ينتهي قريباً', c.expiring), chip('expired', 'منتهي', c.expired), chip('disabled', 'معطّل', c.disabled));
      const per = 25; const pages = Math.max(1, Math.ceil(r.members.length / per)); MS.page = Math.min(MS.page, pages);
      const rows = r.members.slice((MS.page - 1) * per, MS.page * per);
      if (!rows.length) { tableBox.replaceChildren(h('p', { class: 'empty card-a', text: MS.q || MS.status !== 'all' ? 'لا توجد نتائج مطابقة.' : 'لا يوجد مشتركون بعد. أضف أول مشترك.' })); pager.replaceChildren(); return; }
      tableBox.replaceChildren(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, ...['المشترك', 'الهوية / الإقامة', 'الجوال', 'الباقة', 'الانتهاء', 'الحالة', ''].map((t) => h('th', { text: t })))),
        h('tbody', {}, ...rows.map((m) => h('tr', { class: m.active ? '' : 'dim' },
          h('td', {}, h('strong', { text: m.full_name }), m.notes ? h('small', { text: m.notes.slice(0, 60) }) : null),
          h('td', {}, ltr(m.national_id)), h('td', {}, ltr(m.phone)), h('td', { text: m.plan_name || '—' }),
          h('td', {}, FC.fmtDate(m.end_date), h('small', { text: leftText(m) })), h('td', {}, badge(m.status)),
          h('td', {}, h('div', { class: 'acts' },
            h('button', { class: 'b sm ico-only pri', type: 'button', title: 'تجديد', 'aria-label': 'تجديد', onclick: () => renewModal(m) }, icon('refresh', 16)),
            h('a', { class: 'b sm ico-only', title: 'واتساب', 'aria-label': 'واتساب', href: waMember(m), target: '_blank', rel: 'noopener' }, icon('chat', 16)),
            h('button', { class: 'b sm ico-only', type: 'button', title: 'تعديل', 'aria-label': 'تعديل', onclick: () => memberForm(m) }, icon('edit', 16)),
            h('button', { class: 'b sm ico-only danger', type: 'button', title: 'حذف', 'aria-label': 'حذف', onclick: async () => {
              if (await ask(`حذف المشترك «${m.full_name}» نهائياً؟ لا يمكن التراجع.`, 'حذف')) { await run(() => api(`/admin/members/${m.id}`, { method: 'DELETE' }), 'تم الحذف'); reload(); }
            } }, icon('trash', 16))))))))));
      pager.replaceChildren(pages > 1 ? h('button', { class: 'b sm', type: 'button', disabled: MS.page <= 1, onclick: () => { MS.page--; draw(); } }, 'السابق') : null,
        pages > 1 ? h('span', { text: `${MS.page} / ${pages}` }) : null,
        pages > 1 ? h('button', { class: 'b sm', type: 'button', disabled: MS.page >= pages, onclick: () => { MS.page++; draw(); } }, 'التالي') : null);
    }
    await draw();
  };

  async function moveItem(table, list, i, d) {
    const j = i + d; if (j < 0 || j >= list.length) return;
    const ids = list.map((x) => x.id); [ids[i], ids[j]] = [ids[j], ids[i]];
    await run(() => api('/admin/reorder/' + table, { method: 'POST', body: { ids } })); reload();
  }
  const ordCtl = (table, list, i) => [
    h('button', { class: 'b sm ico-only', type: 'button', 'aria-label': 'أعلى', disabled: i === 0, onclick: () => moveItem(table, list, i, -1) }, icon('up', 16)),
    h('button', { class: 'b sm ico-only', type: 'button', 'aria-label': 'أسفل', disabled: i === list.length - 1, onclick: () => moveItem(table, list, i, 1) }, icon('down', 16))];

  function planForm(p) {
    const edit = !!p; p = p || { duration_days: 30, visible: true };
    const name = inp(p.name, { maxlength: 60 });
    const nameEn = inp(p.name_en || '', { maxlength: 60, class: 'input ltr' });
    const price = inp(p.price ?? '', { type: 'number', min: 0, step: '0.01', inputmode: 'decimal', class: 'input ltr' });
    const old = inp(p.old_price ?? '', { type: 'number', min: 0, step: '0.01', class: 'input ltr' });
    const per = inp(p.period_label || '', { maxlength: 30, placeholder: '/ شهر' });
    const perEn = inp(p.period_label_en || '', { maxlength: 30, placeholder: '/ month', class: 'input ltr' });
    const dur = inp(p.duration_days, { type: 'number', min: 1, max: 3650, class: 'input ltr' });
    const badgeI = inp(p.badge || '', { maxlength: 30, placeholder: 'مثال: الأكثر طلباً' });
    const badgeEn = inp(p.badge_en || '', { maxlength: 30, placeholder: 'e.g. Most popular', class: 'input ltr' });
    const feats = area((p.features || []).join('\n'), { rows: 5 });
    const featsEn = area((p.features_en || []).join('\n'), { rows: 5, class: 'input ltr' });
    const fe = check('باقة مميّزة (تُبرز في الموقع)', p.featured); const vi = check('ظاهرة في الموقع', p.visible !== false);
    formModal(edit ? 'تعديل باقة' : 'إضافة باقة', h('div', { class: 'form-grid' },
      field('اسم الباقة (عربي)', name, { full: true }), field('Plan name (English)', nameEn, { full: true }), field(`السعر (${S.settings.currency || ''})`, price), field('السعر قبل الخصم (اختياري)', old, { help: 'يظهر مشطوباً' }),
      field('نص المدة (عربي)', per, { help: 'مثال: / 3 أشهر' }), field('Period label (English)', perEn), field('مدة الاشتراك بالأيام', dur, { help: 'تُستخدم لحساب تاريخ الانتهاء' }),
      field('شارة (عربي)', badgeI), field('Badge (English)', badgeEn), field('المزايا (عربي، كل ميزة في سطر)', feats, { full: true }), field('Features (English, one per line)', featsEn, { full: true }),
      h('div', {}, fe.el), h('div', {}, vi.el)),
    async () => {
      const body = { name: name.value, name_en: nameEn.value, price: price.value, old_price: old.value, period_label: per.value, period_label_en: perEn.value, duration_days: dur.value, badge: badgeI.value, badge_en: badgeEn.value, features: feats.value, features_en: featsEn.value, featured: fe.cb.checked, visible: vi.cb.checked };
      await api(edit ? `/admin/plans/${p.id}` : '/admin/plans', { method: edit ? 'PUT' : 'POST', body }); FC.toast('تم الحفظ'); reload();
    });
  }
  VIEWS.plans = async (root) => {
    const plans = await loadPlans(); await loadSettings();
    root.append(pageHead('الباقات والأسعار', 'أي تعديل هنا يظهر فوراً في الموقع', addBtnEl('باقة جديدة', () => planForm())),
      plans.length ? h('div', { class: 'rows' }, ...plans.map((p, i) => h('div', { class: 'row-i' + (p.visible ? '' : ' off') },
        h('div', { class: 'grow' }, h('h3', { text: p.name }),
          h('small', { text: `${FC.money(p.price)} ${S.settings.currency || ''}` + (p.old_price ? ` (قبل: ${FC.money(p.old_price)})` : '') + ` — ${p.duration_days} يوم — ${p.members_count} مشترك` }),
          h('div', {}, p.featured ? h('span', { class: 'pill red', text: 'مميّزة' }) : null, p.visible ? null : h('span', { class: 'pill', text: 'مخفية' }))),
        h('div', { class: 'acts' }, ...ordCtl('plans', plans, i),
          h('button', { class: 'b sm ico-only', type: 'button', 'aria-label': p.visible ? 'إخفاء' : 'إظهار', title: p.visible ? 'إخفاء' : 'إظهار', onclick: async () => { await run(() => api(`/admin/plans/${p.id}`, { method: 'PUT', body: { visible: !p.visible } })); reload(); } }, icon(p.visible ? 'eye' : 'eyeOff', 16)),
          h('button', { class: 'b sm', type: 'button', onclick: () => planForm(p) }, icon('edit', 16), 'تعديل'),
          h('button', { class: 'b sm ico-only danger', type: 'button', 'aria-label': 'حذف', onclick: async () => {
            if (await ask(`حذف باقة «${p.name}»؟ المشتركون الحاليون يحتفظون بتواريخ اشتراكهم.`, 'حذف')) { await run(() => api(`/admin/plans/${p.id}`, { method: 'DELETE' }), 'تم الحذف'); reload(); }
          } }, icon('trash', 16)))))) : h('p', { class: 'empty card-a', text: 'لا توجد باقات. أضف أول باقة.' }));
  };

  function offerForm(o) {
    const edit = !!o; o = o || { visible: true };
    const title = inp(o.title, { maxlength: 80 }); const titleEn = inp(o.title_en || '', { maxlength: 80, class: 'input ltr' });
    const desc = area(o.description || '', { rows: 3, maxlength: 400 }); const descEn = area(o.description_en || '', { rows: 3, maxlength: 400, class: 'input ltr' });
    const badgeI = inp(o.badge || '', { maxlength: 30, placeholder: 'مثال: -20%' }); const badgeEn = inp(o.badge_en || '', { maxlength: 30, placeholder: 'e.g. 20% off', class: 'input ltr' }); const until = inp(o.valid_until || '', { type: 'date' }); const vi = check('ظاهر في الموقع', o.visible !== false);
    formModal(edit ? 'تعديل عرض' : 'إضافة عرض', h('div', { class: 'form-grid' },
      field('عنوان العرض (عربي)', title, { full: true }), field('Offer title (English)', titleEn, { full: true }), field('الوصف (عربي)', desc, { full: true }), field('Description (English)', descEn, { full: true }), field('الشارة (عربي)', badgeI, { help: 'النص الكبير على جانب العرض' }), field('Badge (English)', badgeEn),
      field('ينتهي العرض في', until, { help: 'اتركه فارغاً لعرض بدون تاريخ. يختفي تلقائياً بعد التاريخ.' }), h('div', { class: 'full' }, vi.el)),
    async () => {
      const body = { title: title.value, title_en: titleEn.value, description: desc.value, description_en: descEn.value, badge: badgeI.value, badge_en: badgeEn.value, valid_until: until.value, visible: vi.cb.checked };
      await api(edit ? `/admin/offers/${o.id}` : '/admin/offers', { method: edit ? 'PUT' : 'POST', body }); FC.toast('تم الحفظ'); reload();
    });
  }
  VIEWS.offers = async (root) => {
    const offers = (await api('/admin/offers')).offers; const today = (S.stats && S.stats.today) || '';
    root.append(pageHead('العروض', 'تظهر العروض في قسم «العروض» بالموقع وتختفي تلقائياً عند انتهاء تاريخها', addBtnEl('عرض جديد', () => offerForm())),
      offers.length ? h('div', { class: 'rows' }, ...offers.map((o, i) => { const gone = o.valid_until && today && o.valid_until < today; return h('div', { class: 'row-i' + (o.visible && !gone ? '' : ' off') },
        h('div', { class: 'grow' }, h('h3', { text: o.title }), h('small', { text: o.description || '' }),
          h('div', {}, o.badge ? h('span', { class: 'pill red', text: o.badge }) : null, o.valid_until ? h('span', { class: 'pill', text: (gone ? 'انتهى ' : 'حتى ') + FC.fmtDate(o.valid_until) }) : null, o.visible ? null : h('span', { class: 'pill', text: 'مخفي' }))),
        h('div', { class: 'acts' }, ...ordCtl('offers', offers, i),
          h('button', { class: 'b sm ico-only', type: 'button', 'aria-label': o.visible ? 'إخفاء' : 'إظهار', onclick: async () => { await run(() => api(`/admin/offers/${o.id}`, { method: 'PUT', body: { visible: !o.visible } })); reload(); } }, icon(o.visible ? 'eye' : 'eyeOff', 16)),
          h('button', { class: 'b sm', type: 'button', onclick: () => offerForm(o) }, icon('edit', 16), 'تعديل'),
          h('button', { class: 'b sm ico-only danger', type: 'button', 'aria-label': 'حذف', onclick: async () => { if (await ask(`حذف العرض «${o.title}»؟`, 'حذف')) { await run(() => api(`/admin/offers/${o.id}`, { method: 'DELETE' }), 'تم الحذف'); reload(); } } }, icon('trash', 16)))); })) : h('p', { class: 'empty card-a', text: 'لا توجد عروض. قسم العروض لن يظهر في الموقع حتى تضيف عرضاً.' }));
  };

  const TYPES = {
    hero: { label: 'الواجهة الرئيسية', desc: 'أول شاشة: الشعار والعنوان وأزرار الدعوة للإجراء', unique: true, items: { title: 'الأزرار', add: 'إضافة زر', max: 3, cfg: [{ k: 'btn', label: 'نص الزر' }, { k: 'link', label: 'الرابط', ltr: true }], hint: 'الزر الأول بارز والباقي إطار. للانتقال لقسم اكتب #المعرّف مثل #pricing' } },
    text: { label: 'نص + أرقام', desc: 'فقرة تعريفية مع أرقام متحركة اختيارية', body: true, items: { title: 'الأرقام (اختياري)', add: 'إضافة رقم', max: 6, cfg: [{ k: 'value', label: 'الرقم', ltr: true }, { k: 'label', label: 'الوصف' }] } },
    cards: { label: 'بطاقات', desc: 'برامج، مدربون، مزايا… بأيقونة أو صورة', items: { title: 'البطاقات', add: 'إضافة بطاقة', cfg: [{ k: 'title', label: 'العنوان' }, { k: 'icon', label: 'الأيقونة', kind: 'icon' }, { k: 'text', label: 'النص', kind: 'area', full: true }, { k: 'image', label: 'صورة (تُستخدم بدل الأيقونة)', kind: 'image', full: true }, { k: 'phone', label: 'هاتف (اختياري)', ltr: true }, { k: 'email', label: 'بريد إلكتروني (اختياري)', ltr: true }] } },
    gallery: { label: 'معرض صور', desc: 'شبكة صور مع تكبير عند الضغط', items: { title: 'الصور', add: 'إضافة صورة', cfg: [{ k: 'image', label: 'الصورة', kind: 'image', full: true }, { k: 'caption', label: 'تعليق (اختياري)', full: true }] } },
    faq: { label: 'أسئلة شائعة', desc: 'أسئلة وأجوبة قابلة للطي', items: { title: 'الأسئلة', add: 'إضافة سؤال', cfg: [{ k: 'q', label: 'السؤال', full: true }, { k: 'a', label: 'الجواب', kind: 'area', full: true }] } },
    pricing: { label: 'الباقات والأسعار', desc: 'يعرض الباقات من تبويب «الباقات والأسعار»', unique: true, managed: 'الباقات والأسعار' },
    offers: { label: 'العروض', desc: 'يعرض العروض الحالية من تبويب «العروض»', unique: true, managed: 'العروض' },
    schedule: { label: 'جدول الحصص', desc: 'تقويم شهري للحصص من تبويب «جدول الحصص»', unique: true, managed: 'جدول الحصص' },
    contact: { label: 'التواصل', desc: 'الهاتف والواتساب والعنوان من «الإعدادات»', unique: true, managed: 'الإعدادات' },
  };

  function sectionForm(s, type) {
    const edit = !!s; const T = TYPES[type]; s = s || { visible: true, items: [] };
    const title = inp(s.title || '', { maxlength: 120 }); const titleEn = inp(s.title_en || '', { maxlength: 120, class: 'input ltr' });
    const sub = inp(s.subtitle || '', { maxlength: 300 }); const subEn = inp(s.subtitle_en || '', { maxlength: 300, class: 'input ltr' });
    const nav = inp(s.nav_label || '', { maxlength: 30, placeholder: 'اتركه فارغاً لإخفائه من القائمة' });
    const navEn = inp(s.nav_label_en || '', { maxlength: 30, class: 'input ltr', placeholder: 'Leave blank to hide' });
    const anchor = inp(s.anchor || '', { class: 'input ltr', maxlength: 40, placeholder: 'auto' });
    const body = T.body ? area(s.body || '', { rows: 6, maxlength: 5000 }) : null;
    const bodyEn = T.body ? area(s.body_en || '', { rows: 6, maxlength: 5000, class: 'input ltr' }) : null;
    const vi = check('ظاهر في الموقع', s.visible !== false);
    const rep = T.items ? repeater(T.items.cfg, s.items, { addLabel: T.items.add, max: T.items.max || 40 }) : null;
    formModal((edit ? 'تعديل قسم: ' : 'قسم جديد: ') + T.label, [
      T.managed ? h('p', { class: 'note-box', text: `محتوى هذا القسم يُدار من «${T.managed}». هنا تعدّل العنوان والظهور والترتيب فقط.` }) : null,
      h('div', { class: 'form-grid' },
        field('العنوان (عربي)', title, { full: true }), field('Title (English)', titleEn, { full: true }),
        field('العنوان الفرعي (عربي)', sub, { full: true }), field('Subtitle (English)', subEn, { full: true }),
        field('الاسم في قائمة التنقل (عربي)', nav, { help: 'يظهر كرابط في أعلى الموقع' }), field('Navigation label (English)', navEn), field('المعرّف (Anchor)', anchor, { help: 'إنجليزي فقط، يُستخدم في الرابط #pricing' }),
        body ? field('النص (عربي)', body, { full: true, help: 'كل سطر فارغ يبدأ فقرة جديدة' }) : null,
        bodyEn ? field('Body text (English)', bodyEn, { full: true }) : null,
        h('div', { class: 'full' }, vi.el),
        rep ? h('h3', { class: 'full', text: T.items.title }) : null,
        rep && T.items.hint ? h('p', { class: 'full help', style: { color: 'var(--mute)' }, text: T.items.hint }) : null,
        rep ? h('div', { class: 'full' }, rep.el) : null)],
    async () => {
      const payload = { type, title: title.value, title_en: titleEn.value, subtitle: sub.value, subtitle_en: subEn.value, nav_label: nav.value, nav_label_en: navEn.value, anchor: anchor.value, body: body ? body.value : '', body_en: bodyEn ? bodyEn.value : '', visible: vi.cb.checked, items: rep ? rep.get() : [] };
      await api(edit ? `/admin/sections/${s.id}` : '/admin/sections', { method: edit ? 'PUT' : 'POST', body: payload }); FC.toast('تم الحفظ'); reload();
    }, { wide: true });
  }
  function typePicker(existing) {
    const taken = new Set(existing.map((s) => s.type));
    const mod = modal('اختر نوع القسم', h('div', { class: 'type-grid' }, ...Object.entries(TYPES).map(([k, t]) => {
      const off = t.unique && taken.has(k);
      return h('button', { class: 'type-btn', type: 'button', disabled: off, onclick: () => { mod.close(); sectionForm(null, k); } }, h('b', { text: t.label }), h('small', { text: off ? 'موجود بالفعل في الصفحة' : t.desc }));
    })));
  }
  VIEWS.sections = async (root) => {
    const secs = (await api('/admin/sections')).sections;
    root.append(pageHead('أقسام الموقع', 'أضف أو احذف أو رتّب أقسام الصفحة الرئيسية. الترتيب هنا هو ترتيب الظهور.', addBtnEl('قسم جديد', () => typePicker(secs))),
      h('div', { class: 'rows' }, ...secs.map((s, i) => { const T = TYPES[s.type] || { label: s.type };
        return h('div', { class: 'row-i' + (s.visible ? '' : ' off') },
          h('div', { class: 'grow' }, h('h3', { text: s.title || T.label }), h('small', { text: s.subtitle ? s.subtitle.slice(0, 90) : '' }),
            h('div', {}, h('span', { class: 'pill red', text: T.label }), s.nav_label ? h('span', { class: 'pill', text: 'في القائمة: ' + s.nav_label }) : null, s.visible ? null : h('span', { class: 'pill', text: 'مخفي' }))),
          h('div', { class: 'acts' }, ...ordCtl('sections', secs, i),
            h('button', { class: 'b sm ico-only', type: 'button', 'aria-label': s.visible ? 'إخفاء' : 'إظهار', title: s.visible ? 'إخفاء' : 'إظهار', onclick: async () => { await run(() => api(`/admin/sections/${s.id}`, { method: 'PUT', body: { visible: !s.visible } })); reload(); } }, icon(s.visible ? 'eye' : 'eyeOff', 16)),
            h('button', { class: 'b sm', type: 'button', onclick: () => sectionForm(s, s.type) }, icon('edit', 16), 'تعديل'),
            h('button', { class: 'b sm ico-only danger', type: 'button', 'aria-label': 'حذف', onclick: async () => { if (await ask(`حذف قسم «${s.title || T.label}» من الموقع؟`, 'حذف')) { await run(() => api(`/admin/sections/${s.id}`, { method: 'DELETE' }), 'تم حذف القسم'); reload(); } } }, icon('trash', 16)))); })));
  };

  VIEWS.schedule = async (root, alive) => {
    await loadSettings(); const st = S.stats || await api('/admin/stats'); const today = st.today;
    const cache = {}; const calRoot = h('div'); const dayBox = h('div', { class: 'day-a' });
    let cal;
    const titles = () => [...new Set(Object.values(cache).flat().map((c) => c.title))];
    async function load(month, force) {
      if (force || !cache[month]) cache[month] = (await api('/admin/classes?month=' + month)).classes;
      if (!alive()) return;
      if (!(cal.sel && cal.sel.startsWith(month))) cal.sel = month === today.slice(0, 7) ? today : month + '-01';
      cal.setData(FC.groupByDate(cache[month])); show(cal.sel);
    }
    function show(d) {
      const items = (cache[cal.month] || []).filter((c) => c.date === d);
      dayBox.replaceChildren(h('h3', { text: FC.fmtDateLong(d) }),
        ...items.map((c) => h('div', { class: 'cls-a' },
          h('div', { class: 't' }, FC.fmtTime(c.start_time), c.end_time ? h('small', { text: 'حتى ' + FC.fmtTime(c.end_time) }) : null),
          h('div', {}, h('strong', { text: c.title }), c.tag ? h('span', { class: 'tag', text: c.tag }) : null, (c.trainer || c.notes) ? h('small', { text: ' ' + [c.trainer, c.notes].filter(Boolean).join(' — '), style: { display: 'block' } }) : null),
          h('div', { class: 'acts', style: { display: 'flex', gap: '.3rem' } },
            h('button', { class: 'b sm ico-only', type: 'button', 'aria-label': 'تعديل', onclick: () => classForm(c) }, icon('edit', 16)),
            h('button', { class: 'b sm ico-only danger', type: 'button', 'aria-label': 'حذف', onclick: async () => { if (await ask(`حذف حصة «${c.title}»؟`, 'حذف')) { await run(() => api(`/admin/classes/${c.id}`, { method: 'DELETE' }), 'تم الحذف'); load(cal.month, true); } } }, icon('trash', 16))))),
        items.length ? null : h('p', { class: 'empty', text: 'لا توجد حصص في هذا اليوم.' }),
        h('button', { class: 'b pri', type: 'button', onclick: () => classForm(null, d) }, icon('plus', 18), 'إضافة حصة'));
    }
    function classForm(c, date) {
      const edit = !!c; c = c || { date, start_time: '18:00', end_time: '19:30' };
      const dl = h('datalist', { id: 'cls-titles' }, ...titles().map((t) => h('option', { value: t })));
      const d = inp(c.date, { type: 'date' }); const s = inp(c.start_time, { type: 'time' }); const e = inp(c.end_time || '', { type: 'time' });
      const title = inp(c.title || '', { maxlength: 80, list: 'cls-titles', placeholder: 'مثال: ملاكمة' }); const titleEn = inp(c.title_en || '', { maxlength: 80, class: 'input ltr', placeholder: 'e.g. Boxing' });
      const tr = inp(c.trainer || '', { maxlength: 60 }); const trEn = inp(c.trainer_en || '', { maxlength: 60, class: 'input ltr' });
      const tag = inp(c.tag || '', { maxlength: 30, placeholder: 'مثال: مبتدئين' }); const tagEn = inp(c.tag_en || '', { maxlength: 30, class: 'input ltr' });
      const notes = inp(c.notes || '', { maxlength: 200 }); const notesEn = inp(c.notes_en || '', { maxlength: 200, class: 'input ltr' });
      const rep = inp('0', { type: 'number', min: 0, max: 26, class: 'input ltr' });
      formModal(edit ? 'تعديل حصة' : 'إضافة حصة', h('div', { class: 'form-grid' }, dl,
        field('اسم الحصة (عربي)', title, { full: true }), field('Class name (English)', titleEn, { full: true }), field('التاريخ', d, { full: true }), field('من', s), field('إلى', e),
        field('المدرب (عربي)', tr), field('Coach (English)', trEn), field('وسم (عربي)', tag), field('Tag (English)', tagEn), field('ملاحظة (عربي)', notes, { full: true }), field('Notes (English)', notesEn, { full: true }),
        edit ? null : field('تكرار أسبوعي', rep, { full: true, help: 'عدد الأسابيع الإضافية. مثال: 3 = تتكرر الحصة نفس اليوم 3 مرات بعد هذا الأسبوع.' })),
      async () => {
        const body = { date: d.value, start_time: s.value, end_time: e.value, title: title.value, title_en: titleEn.value, trainer: tr.value, trainer_en: trEn.value, tag: tag.value, tag_en: tagEn.value, notes: notes.value, notes_en: notesEn.value };
        if (!edit) body.repeat_weeks = rep.value;
        const r = await api(edit ? `/admin/classes/${c.id}` : '/admin/classes', { method: edit ? 'PUT' : 'POST', body });
        FC.toast(edit ? 'تم الحفظ' : (r.created > 1 ? `تمت إضافة ${r.created} حصص` : 'تمت إضافة الحصة'));
        const mth = body.date.slice(0, 7);
        if (mth !== cal.month) { cal.y = +mth.slice(0, 4); cal.m = +mth.slice(5); cal.sel = body.date; cal.render(); }
        else cal.sel = body.date;
        Object.keys(cache).forEach((k) => delete cache[k]); await load(cal.month, true);
      });
    }
    function copyModal() {
      const [y, m] = cal.month.split('-').map(Number); const nx = m === 12 ? `${y + 1}-01` : `${y}-${FC.pad(m + 1)}`;
      const to = inp(nx, { type: 'month', class: 'input ltr' });
      formModal('نسخ حصص الشهر', [h('p', { class: 'note-box', text: `ستُنسخ حصص ${FC.MONTHS[m - 1]} ${y} إلى الشهر المختار بنفس أيام الأسبوع. الحصص المكرّرة تُتجاهل.` }), field('إلى شهر', to)],
        async () => { const r = await api('/admin/classes/copy-month', { method: 'POST', body: { from: cal.month, to: to.value } }); FC.toast(`تم نسخ ${r.created} حصة` + (r.skipped ? ` (تم تجاهل ${r.skipped})` : '')); Object.keys(cache).forEach((k) => delete cache[k]); await load(cal.month, true); }, { saveLabel: 'نسخ' });
    }
    root.append(pageHead('جدول الحصص', 'اختر يوماً من التقويم لإضافة أو تعديل الحصص. يظهر الجدول للزوار وللمشتركين.',
      h('button', { class: 'b', type: 'button', onclick: copyModal }, icon('copy', 18), 'نسخ الشهر'), addBtnEl('حصة جديدة', () => classForm(null, cal.sel))),
      h('div', { class: 'sched-a' }, h('div', { class: 'cal-box' }, calRoot), dayBox));
    cal = new FC.Calendar(calRoot, { weekStart: S.settings.week_start, today, onMonth: (m) => load(m), onSelect: show });
    await load(cal.month);
  };

  VIEWS.notify = async (root) => {
    const [members, list] = await Promise.all([api('/admin/members'), api('/admin/notifications')]); await loadSettings();
    const c = members.counts;
    const target = sel([['all', `كل المشتركين الفعّالين`], ['active', 'أصحاب الاشتراكات السارية'], ['expiring', `ينتهي قريباً (${c.expiring})`], ['expired', `منتهي (${c.expired})`], ['member', 'مشترك محدد']], 'all');
    const one = sel(members.members.map((m) => [m.id, `${m.full_name} — ${m.phone}`]), ''); const oneF = field('المشترك', one); oneF.hidden = true;
    target.addEventListener('change', () => { oneF.hidden = target.value !== 'member'; });
    const msg = area('', { rows: 3, maxlength: 300, placeholder: 'اكتب رسالة تظهر داخل حساب المشترك…' });
    const msgEn = area('', { rows: 3, maxlength: 300, class: 'input ltr', placeholder: 'Write an in-account notification…' });
    const sendWa = h('input', { type: 'checkbox', disabled: !list.whatsapp.marketing });
    const err = h('div', { class: 'form-error', hidden: true });
    const send = h('button', { class: 'b pri', type: 'button' }, icon('send', 18), 'إرسال');
    send.addEventListener('click', async () => {
      err.hidden = true; send.disabled = true;
      try { const r = await api('/admin/notify', { method: 'POST', body: { target: target.value, member_id: one.value, message: msg.value, message_en: msgEn.value, send_whatsapp: sendWa.checked } }); FC.toast(`أُضيفت الرسالة داخل حساب ${r.sent} مشترك` + (sendWa.checked ? `، وأُدرجت في قائمة واتساب للموافقين (${r.whatsapp_queued})` : '')); msg.value = ''; msgEn.value = ''; reload(); }
      catch (e) { err.textContent = e.message; err.hidden = false; send.disabled = false; }
    });
    const labels = { expired: 'انتهاء', expiring: 'اقتراب انتهاء', renewed: 'تجديد', custom: 'رسالة' };
    root.append(pageHead('التنبيهات', 'تنبيهات الانتهاء تُرسل تلقائياً داخل حساب المشترك. من هنا يمكنك إرسال رسائل إضافية.'),
      h('div', { class: 'cols two' },
        h('section', { class: 'card-a' }, h('h2', {}, icon('send', 22), 'رسالة جديدة'), h('div', { class: 'form-grid' }, h('div', { class: 'full' }, err), field('إلى', target, { full: true }), h('div', { class: 'full' }, oneF), field('الرسالة (عربي)', msg, { full: true }), field('Notification (English)', msgEn, { full: true }), h('label', { class: 'full admin-consent' }, sendWa, h('span', { text: list.whatsapp.marketing ? `إرسال قالب العرض عبر واتساب للمشتركين الذين وافقوا (${list.whatsapp.eligible_marketing})` : 'إرسال واتساب غير مهيأ. أضف بيانات Meta وقالب العروض في ملف إعدادات الخادم.' })), h('div', { class: 'full' }, send)),
          h('p', { class: 'help', style: { color: 'var(--mute)', marginTop: '1rem', lineHeight: 1.7 }, text: `حالة واتساب: دخول ${list.whatsapp.authentication ? 'جاهز' : 'غير مهيأ'} · تنبيهات الاشتراك ${list.whatsapp.utility ? 'جاهزة' : 'غير مهيأة'} · رسائل العروض ${list.whatsapp.marketing ? 'جاهزة' : 'غير مهيأة'}. الرسائل ترسل فقط لمن وافق على استقبالها.` })),
        h('section', { class: 'card-a' }, h('h2', {}, icon('bell', 22), 'آخر التنبيهات'),
          list.notifications.length ? h('ul', { class: 'nt' }, ...list.notifications.slice(0, 40).map((n) => h('li', {}, h('strong', { text: n.full_name }), ' ', h('span', { class: 'pill', text: labels[n.kind] || n.kind }), n.read_at ? h('span', { class: 'pill', text: 'مقروء' }) : null, h('small', { text: n.message, style: { display: 'block' } })))) : h('p', { class: 'empty', text: 'لا توجد تنبيهات بعد.' }))));
  };

  VIEWS.settings = async (root) => {
    const s = await loadSettings(); const F = {};
    const t = (k, label, o = {}) => { F[k] = inp(s[k] || '', { maxlength: 300, ...(o.ltr ? { class: 'input ltr' } : {}), ...(o.attrs || {}) }); return field(label, F[k], o); };
    const ta = (k, label, o = {}) => { F[k] = area(s[k] || '', { rows: o.rows || 3, maxlength: 400 }); return field(label, F[k], { full: true, help: o.help }); };
    F.week_start = sel([['0', 'الأحد'], ['6', 'السبت'], ['5', 'الجمعة']], s.week_start || '0');
    const save = h('button', { class: 'b pri', type: 'button' }, icon('check', 18), 'حفظ الإعدادات');
    const err = h('div', { class: 'form-error', hidden: true });
    save.addEventListener('click', async () => {
      err.hidden = true; save.disabled = true;
      try { const body = {}; Object.keys(F).forEach((k) => { body[k] = F[k].value; }); await api('/admin/settings', { method: 'PUT', body }); await loadSettings(); FC.toast('تم حفظ الإعدادات'); }
      catch (e) { err.textContent = e.message; err.hidden = false; }
      save.disabled = false;
    });
    const cur = inp(''), nw = inp(''), nw2 = inp(''); [cur, nw, nw2].forEach((i) => { i.type = 'password'; i.autocomplete = i === cur ? 'current-password' : 'new-password'; i.classList.add('ltr'); });
    const perr = h('div', { class: 'form-error', hidden: true });
    const pbtn = h('button', { class: 'b', type: 'button', text: 'تغيير كلمة المرور' });
    pbtn.addEventListener('click', async () => {
      perr.hidden = true;
      if (nw.value.length < 12) { perr.textContent = 'كلمة المرور يجب ألا تقل عن 12 حرفاً'; perr.hidden = false; return; }
      if (nw.value !== nw2.value) { perr.textContent = 'كلمتا المرور الجديدتان غير متطابقتين'; perr.hidden = false; return; }
      try { await api('/admin/password', { method: 'POST', body: { current: cur.value, next: nw.value } }); FC.toast('تم تغيير كلمة المرور'); cur.value = nw.value = nw2.value = ''; }
      catch (e) { perr.textContent = e.message; perr.hidden = false; }
    });
    const block = (title, ...els) => h('section', { class: 'card-a', style: { marginBottom: '1.2rem' } }, h('h2', { text: title }), h('div', { class: 'form-grid' }, ...els));
    root.append(pageHead('الإعدادات', 'معلومات النادي والتواصل ورسائل التنبيه', save), err,
      block('معلومات النادي بالعربية', t('club_name', 'اسم النادي'), t('tagline', 'الوصف المختصر'), ta('meta_description', 'وصف الموقع في محركات البحث', { rows: 2 }),
        t('marquee', 'الشريط المتحرك', { help: 'كلمات مفصولة بفاصلة', full: true })),
      block('Club information in English', t('club_name_en', 'Club name'), t('tagline_en', 'Short description'), ta('meta_description_en', 'Search description', { rows: 2 }),
        t('marquee_en', 'Moving text', { help: 'Separate phrases with commas', full: true })),
      block('التواصل', t('phone', 'رقم الهاتف', { ltr: true }), t('whatsapp', 'رقم واتساب', { ltr: true, help: 'مثال: 05XXXXXXXX. يُستخدم لأزرار الاشتراك والتجديد.' }), t('email', 'البريد الإلكتروني', { ltr: true }),
        t('address', 'العنوان'), t('address_en', 'Address (English)'), t('hours', 'ساعات العمل'), t('hours_en', 'Hours (English)'), t('map_url', 'رابط الموقع على الخرائط', { ltr: true, help: 'رابط Google Maps يبدأ بـ https://' })),
      block('حسابات التواصل الاجتماعي', t('instagram', 'انستغرام (رابط)', { ltr: true }), t('x', 'إكس (رابط)', { ltr: true }), t('snapchat', 'سناب شات (رابط)', { ltr: true }), t('tiktok', 'تيك توك (رابط)', { ltr: true })),
      block('الموقع والاشتراكات', t('currency', 'العملة (عربي)'), t('currency_en', 'Currency (English)', { ltr: true }), t('country_code', 'مفتاح الدولة لواتساب', { ltr: true, help: '966 للسعودية' }), field('أول يوم في الأسبوع بالتقويم', F.week_start),
        t('expiring_days', 'التنبيه قبل الانتهاء بـ (أيام)', { ltr: true, attrs: { type: 'number', min: 0, max: 30 } }), t('footer_text', 'نص أسفل الموقع', { full: true }), t('footer_text_en', 'Footer text (English)', { full: true })),
      block('رسائل الاشتراك بالعربية', h('p', { class: 'full help', style: { color: 'var(--mute)' }, text: 'المتغيرات المتاحة: {name} اسم المشترك — {club} اسم النادي — {date} تاريخ الانتهاء' }),
        ta('msg_expired', 'رسالة انتهاء الاشتراك'), ta('msg_expiring', 'رسالة قرب الانتهاء'), ta('msg_renewed', 'رسالة التجديد')),
      block('Membership notifications in English', ta('msg_expired_en', 'Expiration message'), ta('msg_expiring_en', 'Upcoming expiration message'), ta('msg_renewed_en', 'Renewal message')),
      block('كلمة مرور المسؤول', h('div', { class: 'full' }, perr), field('كلمة المرور الحالية', cur, { full: true }), field('الجديدة (12 حرفاً على الأقل)', nw), field('تأكيد الجديدة', nw2), h('div', { class: 'full' }, pbtn)));
  };

  async function boot() {
    try { await api('/admin/me'); } catch (e) { return loginView(); }
    if (!shellEl || !document.body.contains(shellEl)) { navBtns = {}; shell(); }
    await loadSettings().catch(() => {});
    route();
  }
  window.addEventListener('hashchange', () => { if (shellEl && document.body.contains(shellEl)) route(); });
  boot();
})();
