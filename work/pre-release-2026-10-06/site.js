(function () {
  'use strict';
  const { h, icon, api, safeUrl } = FC;
  const main = document.getElementById('main');
  const navEl = document.getElementById('nav');
  const footEl = document.getElementById('footer');
  let site = null;

  const tr = (ar, en) => FC.loc(ar, en);
  const val = (o, k) => FC.value(o, k);
  const clubName = () => FC.lang === 'en' ? (site.settings.club_name_en || site.settings.club_name) : site.settings.club_name;
  const lines = (t) => String(t || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const belt = () => h('div', { class: 'belt', 'aria-hidden': 'true' }, h('span'),
    h('i', { svg: '<svg width="34" height="24" viewBox="0 0 34 24" fill="currentColor"><path d="M17 5 27 12 17 19 7 12Z"/><path d="M11 9 3 3M23 9 31 3M11 15 3 21M23 15 31 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>' }), h('span'));
  const head = (s) => (val(s, 'title') || val(s, 'subtitle')) ? h('div', { class: 'sec-head rv' }, val(s, 'title') && h('h2', { text: val(s, 'title') }), val(s, 'subtitle') && h('p', { text: val(s, 'subtitle') }), belt()) : null;
  const wa = (text) => FC.waLink(site.settings, text);
  const stagger = (els) => els.forEach((el, i) => el.style.setProperty('--d', Math.min(i, 8) * 0.07 + 's'));

  function splash() {
    let seen = false;
    try { seen = sessionStorage.getItem('fc_splash'); sessionStorage.setItem('fc_splash', '1'); } catch (_) {}
    if (seen || FC.reduceMotion) { document.body.classList.add('ready'); return; }
    const el = h('div', { class: 'splash done', 'aria-hidden': 'true' }, h('img', { src: '/assets/logo-main.jpg', alt: '' }));
    document.body.append(el);
    setTimeout(() => document.body.classList.add('ready'), 1400);
    setTimeout(() => el.remove(), 1950);
  }

  function buildNav(sections) {
    const s = site.settings;
    const links = sections.filter((x) => val(x, 'nav_label')).map((x) => h('a', { href: '#' + x.anchor, 'data-target': x.anchor, text: val(x, 'nav_label') }));
    const switchLanguage = () => { FC.setLang(FC.lang === 'ar' ? 'en' : 'ar'); location.reload(); };
    const langButton = h('button', { class: 'lang-switch', type: 'button', onclick: switchLanguage, text: tr('English', 'العربية'), 'aria-label': tr('التبديل إلى الإنجليزية', 'Switch to Arabic') });
    const burger = h('button', { class: 'burger', type: 'button', 'aria-label': tr('القائمة', 'Menu'), 'aria-expanded': 'false', onclick: () => {
      const open = navEl.classList.toggle('open'); burger.setAttribute('aria-expanded', open);
    } }, FC.icon('menu', 22));
    const nav = h('nav', { class: 'nav-links', 'aria-label': tr('التنقل الرئيسي', 'Main navigation'), onclick: (e) => { if (e.target.closest('a')) { navEl.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); } } },
      ...links, langButton, h('a', { class: 'm-only', href: '/account', text: tr('دخول المشتركين', 'Member sign in') }));
    navEl.replaceChildren(h('div', { class: 'wrap nav-in' },
      h('a', { class: 'nav-logo', href: '#home', 'aria-label': clubName() }, h('img', { src: '/assets/logo-inner.png', alt: clubName() })),
      nav,
      h('div', { class: 'nav-cta' }, h('a', { class: 'btn sm', href: '/account' }, FC.icon('users', 18), tr('دخول المشتركين', 'Member sign in')), burger)));
    const onScroll = () => navEl.classList.toggle('solid', window.scrollY > 40);
    onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
    const map = new Map(links.map((a) => [a.dataset.target, a]));
    if ('IntersectionObserver' in window && map.size) {
      const spy = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { map.forEach((a) => a.classList.remove('on')); const a = map.get(e.target.id); if (a) a.classList.add('on'); }
      }), { rootMargin: '-45% 0px -50% 0px' });
      map.forEach((_, id) => { const t = document.getElementById(id); if (t) spy.observe(t); });
    }
  }
  function buildFooter(sections) {
    const s = site.settings;
    const links = sections.filter((x) => val(x, 'nav_label')).map((x) => h('a', { href: '#' + x.anchor, text: val(x, 'nav_label') }));
    footEl.replaceChildren(h('div', { class: 'wrap foot-in' },
      h('img', { src: '/assets/logo-inner.png', alt: clubName() }),
      h('div', { class: 'foot-links' }, ...links, h('a', { href: '/account', text: tr('دخول المشتركين', 'Member sign in') })),
      h('p', { class: 'foot-copy', text: `© ${new Date().getFullYear()} ${clubName()}. ${FC.lang === 'en' ? (s.footer_text_en || s.footer_text || '') : (s.footer_text || '')}` })));
  }

  function sparks(cv, hero) {
    if (FC.reduceMotion) return;
    const ctx = cv.getContext('2d');
    let w = 0; let hh = 0; let run = false; const parts = [];
    const N = window.innerWidth < 700 ? 22 : 46;
    const size = () => { const r = hero.getBoundingClientRect(); const d = Math.min(window.devicePixelRatio || 1, 2); w = cv.width = r.width * d; hh = cv.height = r.height * d; };
    const make = (init) => ({ x: Math.random() * w, y: init ? Math.random() * hh : hh + 10, vy: -(0.25 + Math.random() * 0.9) * (w / 900 + 0.6), vx: (Math.random() - 0.5) * 0.35, s: 1.5 + Math.random() * 3.2, a: 0.25 + Math.random() * 0.6, hot: Math.random() < 0.12 });
    size(); for (let i = 0; i < N; i++) parts.push(make(true));
    const tick = () => {
      if (!run) return;
      ctx.clearRect(0, 0, w, hh);
      for (const p of parts) {
        p.x += p.vx + Math.sin(p.y / 70) * 0.25; p.y += p.vy;
        if (p.y < -10) Object.assign(p, make(false));
        ctx.globalAlpha = p.a * Math.min(1, p.y / (hh * 0.35));
        ctx.fillStyle = p.hot ? '#ffd2d4' : '#e8343a';
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(0.7); ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 1.8); ctx.restore();
      }
      requestAnimationFrame(tick);
    };
    new IntersectionObserver((es) => { run = es[0].isIntersecting; if (run) requestAnimationFrame(tick); }).observe(hero);
    window.addEventListener('resize', size);
  }

  function hero(s) {
    const cv = h('canvas', { 'aria-hidden': 'true' });
    const tl = h('div', { class: 'streak tl', 'aria-hidden': 'true' });
    const br = h('div', { class: 'streak br', 'aria-hidden': 'true' });
    const btns = (s.items || []).slice(0, 3).map((b, i) => h('a', { class: 'btn' + (i ? ' ghost' : ''), href: safeUrl(b.link) || '#', text: val(b, 'btn') || '' }));
    const el = h('section', { class: 'hero shake', id: s.anchor || 'home' },
      tl, br, cv, h('div', { class: 'flash', 'aria-hidden': 'true' }),
      h('div', { class: 'wrap hero-in' },
        h('img', { class: 'hero-logo', src: '/assets/logo-interior.png', alt: clubName(), width: 1200, height: 640, fetchpriority: 'high' }),
        val(s, 'title') && h('h1', { text: val(s, 'title') }),
        val(s, 'subtitle') && h('p', { class: 'hero-sub', text: val(s, 'subtitle') }),
        btns.length ? h('div', { class: 'hero-btns' }, ...btns) : null),
      h('div', { class: 'scroll-cue', 'aria-hidden': 'true' }));
    sparks(cv, el);
    if (!FC.reduceMotion && window.matchMedia('(pointer:fine)').matches) {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
        tl.style.transform = `translate(${x * 18}px, ${y * 14}px)`; br.style.transform = `translate(${x * -18}px, ${y * -14}px)`;
      });
    }
    return el;
  }

  function ribbon() {
    const words = String(FC.lang === 'en' ? (site.settings.marquee_en || site.settings.marquee) : site.settings.marquee || '').split(',').map((x) => x.trim()).filter(Boolean);
    if (!words.length) return null;
    let unit = words.slice(); while (unit.length < 8) unit = unit.concat(words);
    const mk = (hidden) => unit.map((w) => h('span', { text: w, 'aria-hidden': hidden ? 'true' : null }));
    return h('div', { class: 'ribbon', 'aria-hidden': 'true' }, h('div', { class: 'ribbon-track' }, ...mk(false), ...mk(true)));
  }

  function text(s) {
    const stats = (s.items || []).filter((i) => i.value);
    return [head(s), h('div', { class: 'about' + (stats.length ? ' has-stats' : '') },
      val(s, 'body') ? h('div', { class: 'prose rv' }, ...lines(val(s, 'body')).map((p) => h('p', { text: p }))) : null,
      stats.length ? h('div', { class: 'stats' }, ...stats.map((i) => h('div', { class: 'stat rv' }, h('div', {}, h('b', { 'data-count': i.value, text: i.value }), h('span', { text: val(i, 'label') || '' }))))) : null)];
  }
  function cards(s) {
    const items = (s.items || []).map((i) => {
      const img = safeUrl(i.image);
      return h('article', { class: 'card rv' },
        img ? h('div', { class: 'card-img-wrap' }, h('img', { class: 'card-img', src: img, alt: val(i, 'title') || '', loading: 'lazy' })) : null,
        h('div', { class: 'card-body' }, !img && i.icon ? h('div', { class: 'card-ico' }, icon(i.icon, 28)) : null,
          val(i, 'title') && h('h3', { text: val(i, 'title') }), val(i, 'text') && h('p', { text: val(i, 'text') })));
    });
    stagger(items);
    return [head(s), h('div', { class: 'cards' }, ...items)];
  }
  function gallery(s) {
    const items = (s.items || []).filter((i) => safeUrl(i.image)).map((i) => h('button', { type: 'button', class: 'g-item rv', 'aria-label': val(i, 'caption') || tr('عرض الصورة', 'View image'), onclick: () => lightbox(safeUrl(i.image), val(i, 'caption')) },
      h('img', { src: safeUrl(i.image), alt: val(i, 'caption') || '', loading: 'lazy' }), val(i, 'caption') ? h('span', { text: val(i, 'caption') }) : null));
    stagger(items);
    return [head(s), h('div', { class: 'gallery' }, ...items)];
  }
  function lightbox(src, cap) {
    const close = () => { box.remove(); document.removeEventListener('keydown', esc); };
    const esc = (e) => { if (e.key === 'Escape') close(); };
    const box = h('div', { class: 'lightbox', role: 'dialog', 'aria-label': cap || tr('صورة', 'Image'), onclick: close }, h('img', { src, alt: cap || '' }));
    document.body.append(box); document.addEventListener('keydown', esc);
  }
  function faq(s) {
    return [head(s), h('div', { class: 'faq' }, ...(s.items || []).filter((i) => val(i, 'q')).map((i) => h('details', { class: 'rv' },
      h('summary', {}, h('span', { text: val(i, 'q') }), icon('chevD', 22)), h('div', { class: 'ans', text: val(i, 'a') || '' }))))];
  }
  function pricing(s) {
    const cur = FC.lang === 'en' ? (site.settings.currency_en || 'SAR') : site.settings.currency;
    const plans = site.plans.map((p) => {
      const planName = val(p, 'name');
      const link = wa(tr(`مرحباً، أرغب بالاشتراك في باقة (${p.name}) - ${site.settings.club_name}`, `Hello, I would like to join the ${planName} plan at ${clubName()}.`)) || '#contact';
      return h('article', { class: 'plan rv' + (p.featured ? ' featured' : '') },
        p.featured ? h('span', { class: 'plan-badge', text: val(p, 'badge') || tr('الأكثر طلباً', 'Most popular') }) : (val(p, 'badge') ? h('span', { class: 'plan-badge', text: val(p, 'badge') }) : null),
        h('h3', { text: planName }),
        h('div', { class: 'price' }, h('b', { text: FC.money(p.price) }), h('span', { class: 'cur', text: cur }), val(p, 'period_label') && h('span', { class: 'per', text: val(p, 'period_label') }),
          p.old_price ? h('s', { text: `${FC.money(p.old_price)} ${cur}` }) : null),
        h('ul', {}, ...(FC.lang === 'en' && p.features_en.length ? p.features_en : p.features).map((f) => h('li', {}, icon('check', 18), h('span', { text: f })))),
        h('a', { class: 'btn' + (p.featured ? '' : ' dark'), href: link, target: link.startsWith('http') ? '_blank' : null, rel: 'noopener', text: tr('اشترك الآن', 'Join now') }));
    });
    stagger(plans);
    return [head(s), plans.length ? h('div', { class: 'plans' }, ...plans) : h('p', { class: 'empty-note', text: tr('ستتوفر الباقات قريباً.', 'Membership plans will be available soon.') })];
  }
  function offers(s) {
    if (!site.offers.length) return null;
    const items = site.offers.map((o) => {
      const link = wa(tr(`مرحباً، أرغب بالاستفادة من عرض (${o.title}) - ${site.settings.club_name}`, `Hello, I would like to use the ${val(o, 'title')} offer at ${clubName()}.`));
      return h('article', { class: 'offer rv' },
        h('div', { class: 'offer-tag', text: val(o, 'badge') || tr('عرض', 'Offer') }),
        h('div', { class: 'offer-body' }, h('h3', { text: val(o, 'title') }), val(o, 'description') && h('p', { text: val(o, 'description') }),
          o.valid_until && h('small', { text: tr('ينتهي العرض: ', 'Offer ends: ') + FC.fmtDate(o.valid_until) }),
          link ? h('a', { class: 'btn sm', href: link, target: '_blank', rel: 'noopener', text: tr('استفد من العرض', 'Claim offer') }) : null));
    });
    stagger(items);
    return [head(s), h('div', { class: 'offers' }, ...items)];
  }

  function schedule(s) {
    const cache = {};
    const calRoot = h('div', { class: 'rv' });
    const list = h('div', { class: 'day-list' });
    const title = h('h3');
    const panel = h('div', { class: 'day-panel rv' }, title, list);
    const cal = new FC.Calendar(calRoot, { weekStart: site.settings.week_start, today: site.today, onMonth: load, onSelect: show });
    function show(d) {
      const items = (cache[cal.month] || {})[d] || [];
      title.textContent = FC.fmtDateLong(d);
      list.replaceChildren(...(items.length ? items.map((c, i) => {
        const row = h('div', { class: 'cls', style: { animationDelay: i * 0.06 + 's' } },
          h('div', { class: 'cls-time' }, FC.fmtTime(c.start_time), c.end_time ? h('small', { text: tr('حتى ', 'until ') + FC.fmtTime(c.end_time) }) : null),
          h('div', {}, h('h4', {}, FC.value(c, 'title'), FC.value(c, 'tag') ? h('span', { class: 'tag', text: FC.value(c, 'tag') }) : null),
            (FC.value(c, 'trainer') || FC.value(c, 'notes')) ? h('p', { text: [FC.value(c, 'trainer') && tr('المدرب: ', 'Coach: ') + FC.value(c, 'trainer'), FC.value(c, 'notes')].filter(Boolean).join(' — ') }) : null));
        return row;
      }) : [h('p', { class: 'empty-note', text: tr('لا توجد حصص في هذا اليوم.', 'No classes scheduled for this day.') })]));
    }
    async function load(month) {
      try {
        if (!cache[month]) cache[month] = FC.groupByDate((await api('/schedule?month=' + month)).classes);
        cal.setData(cache[month]);
        const dates = Object.keys(cache[month]).sort();
        if (!(cal.sel && cal.sel.startsWith(month))) cal.sel = month === site.today.slice(0, 7) ? site.today : (dates[0] || month + '-01');
        cal.render(); show(cal.sel);
      } catch (e) { list.replaceChildren(h('p', { class: 'empty-note', text: tr('تعذّر تحميل الجدول. حدّث الصفحة وحاول مجدداً.', 'Could not load the schedule. Refresh the page and try again.') })); }
    }
    load(cal.month);
    return [head(s), h('div', { class: 'sched' }, calRoot, panel)];
  }

  function contact(s) {
    const st = site.settings;
    const box = [];
    const item = (ico, label, val, href, ltr) => {
      const tag = href ? 'a' : 'div';
      return h(tag, { class: 'c-item rv', href: href || null, target: href && href.startsWith('http') ? '_blank' : null, rel: href ? 'noopener' : null },
        icon(ico, 26), h('small', { text: label }), h('strong', { class: ltr ? 'ltr' : '', text: val }));
    };
    if (st.phone) box.push(item('phone', tr('اتصل بنا', 'Call us'), st.phone, 'tel:' + st.phone.replace(/[^\d+]/g, ''), true));
    const w = wa(tr('مرحباً، أرغب بالاستفسار عن النادي', `Hello, I would like to ask about ${clubName()}.`));
    if (w) box.push(item('chat', 'WhatsApp', tr('تواصل معنا مباشرة', 'Message us directly'), w));
    if (st.email) box.push(item('mail', tr('البريد الإلكتروني', 'Email'), st.email, 'mailto:' + st.email, true));
    if (st.address || st.address_en) box.push(item('pin', tr('العنوان', 'Address'), FC.lang === 'en' ? (st.address_en || st.address) : st.address, safeUrl(st.map_url) || null));
    if (st.hours || st.hours_en) box.push(item('clock', tr('ساعات العمل', 'Hours'), FC.lang === 'en' ? (st.hours_en || st.hours) : st.hours));
    const soc = [['instagram', 'انستغرام', 'Instagram'], ['x', 'إكس', 'X'], ['snapchat', 'سناب شات', 'Snapchat'], ['tiktok', 'تيك توك', 'TikTok']].filter(([k]) => safeUrl(st[k]))
      .map(([k, ar, en]) => h('a', { href: safeUrl(st[k]), target: '_blank', rel: 'noopener', text: tr(ar, en) }));
    stagger(box);
    return [head(s), box.length ? h('div', { class: 'contact' }, ...box) : null, soc.length ? h('div', { class: 'socials' }, ...soc) : null];
  }

  const RENDER = { text, cards, gallery, faq, pricing, offers, schedule, contact };

  function render() {
    FC.setLang(FC.lang);
    const s = site.settings;
    const title = FC.lang === 'en' ? (s.club_name_en || s.club_name) : s.club_name;
    const heroSection = site.sections.find((x) => x.type === 'hero');
    const heroTitle = heroSection ? val(heroSection, 'title') : '';
    document.title = `${title}${heroTitle ? ' | ' + heroTitle : ''}`;
    const description = FC.lang === 'en' ? (s.meta_description_en || s.meta_description) : s.meta_description;
    const meta = document.querySelector('meta[name="description"]'); if (meta) meta.content = description || '';
    const ogTitle = document.querySelector('meta[property="og:title"]'); if (ogTitle) ogTitle.content = document.title;
    const ogDescription = document.querySelector('meta[property="og:description"]'); if (ogDescription) ogDescription.content = description || '';
    const secs = site.sections;
    buildNav(secs); buildFooter(secs);
    const frag = document.createDocumentFragment();
    let alt = false; let first = true;
    for (const s of secs) {
      if (s.type === 'hero') {
        const hs = hero(s); frag.append(hs); const rb = ribbon(); if (rb) frag.append(rb); first = false; continue;
      }
      const fn = RENDER[s.type]; if (!fn) continue;
      const inner = fn(s); if (!inner) continue;
      alt = !alt;
      frag.append(h('section', { class: 'sec' + (alt ? '' : ' alt'), id: s.anchor || 'section-' + s.id }, h('div', { class: 'wrap' }, ...inner.filter(Boolean))));
    }
    main.replaceChildren(frag);
    if (first) main.style.paddingTop = '90px';
    observe();
    if (location.hash) { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) setTimeout(() => t.scrollIntoView(), 50); }
  }

  function countUp(el) {
    const m = /^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/.exec(el.dataset.count || '');
    if (!m || FC.reduceMotion) return;
    const target = parseFloat(m[2].replace(/,/g, '')); const dec = (m[2].split('.')[1] || '').length; const comma = m[2].includes(',');
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1300); const v = target * (1 - Math.pow(1 - k, 3));
      el.textContent = m[1] + (comma ? v.toLocaleString('en-US', { maximumFractionDigits: dec }) : v.toFixed(dec)) + m[3];
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function observe() {
    const els = document.querySelectorAll('.rv');
    if (!('IntersectionObserver' in window) || FC.reduceMotion) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in'); io.unobserve(e.target);
      e.target.querySelectorAll('[data-count]').forEach(countUp);
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((e) => io.observe(e));
  }

  async function start() {
    try { site = await api('/site'); } catch (e) {
      main.replaceChildren(h('div', { class: 'boot' }, h('div', { style: { textAlign: 'center' } }, h('p', { text: tr('تعذّر تحميل الموقع.', 'Could not load the website.') }), h('br'), h('button', { class: 'btn', onclick: () => location.reload(), text: tr('إعادة المحاولة', 'Try again') }))));
      return;
    }
    splash(); render();
  }
  start();
})();
