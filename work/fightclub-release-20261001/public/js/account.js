(function () {
  'use strict';
  const { h, icon, api } = FC;
  const app = document.getElementById('app');
  let ctx = {};
  const tr = (ar, en) => FC.loc(ar, en);
  const errorText = (e) => {
    if (FC.lang !== 'en') return e.message;
    const known = {
      'تعذّر الاتصال بالخادم. تحقق من الإنترنت.': 'Could not connect to the server. Check your internet connection.',
      'رقم الهوية/الإقامة أو رقم الجوال غير صحيح': 'The ID or mobile number is incorrect.',
      'هذا الحساب معطّل، تواصل مع إدارة النادي': 'This account is disabled. Please contact the club.',
      'تجاوزت عدد طلبات الرمز. حاول بعد ساعة.': 'Too many code requests. Try again in an hour.',
      'محاولات كثيرة. حاول بعد 15 دقيقة.': 'Too many attempts. Try again in 15 minutes.',
      'وافق على استلام رمز الدخول عبر واتساب للمتابعة': 'Agree to receive a sign-in code on WhatsApp to continue.',
      'تسجيل الدخول برمز واتساب غير مفعّل بعد. تواصل مع إدارة النادي.': 'WhatsApp sign-in is not configured yet. Please contact the club.',
      'تعذّر إرسال رمز واتساب. تحقق من الرقم أو تواصل مع إدارة النادي.': 'Could not send a WhatsApp code. Check the number or contact the club.',
      'رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً.': 'The verification code is incorrect or expired. Request a new one.',
      'رمز التحقق غير صحيح أو انتهت صلاحيته.': 'The verification code is incorrect or expired.',
      'هذا الحساب غير متاح. تواصل مع إدارة النادي.': 'This account is unavailable. Please contact the club.',
      'يجب تسجيل الدخول': 'Please sign in to continue.',
    };
    return known[e.message] || 'Something went wrong. Please try again.';
  };

  function loginFrame(form) {
    app.replaceChildren(h('div', { class: 'login' },
      h('div', { class: 'login-logo' }, h('img', { src: '/assets/logo-main.jpg', alt: tr('فايت كلوب', 'Fight Club') })), form));
  }

  function loginView(msg) {
    const err = h('div', { class: 'form-error', role: 'alert', hidden: !msg, text: msg || '' });
    const idIn = h('input', { class: 'input ltr', name: 'national_id', id: 'nid', inputmode: 'numeric', autocomplete: 'username', maxlength: '14', required: true, placeholder: '1XXXXXXXXX' });
    const phIn = h('input', { class: 'input ltr', name: 'phone', id: 'ph', type: 'tel', inputmode: 'tel', autocomplete: 'tel', maxlength: '18', required: true, placeholder: '05XXXXXXXX' });
    const authConsent = h('input', { type: 'checkbox', required: true, id: 'auth-consent' });
    const updatesConsent = h('input', { type: 'checkbox', id: 'updates-consent' });
    const marketingConsent = h('input', { type: 'checkbox', id: 'marketing-consent' });
    const btn = h('button', { class: 'btn', type: 'submit', text: tr('إرسال رمز الدخول عبر واتساب', 'Send sign-in code on WhatsApp') });
    const form = h('form', { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); err.hidden = true;
      if (!idIn.value.trim() || !phIn.value.trim()) { err.textContent = tr('أدخل رقم الهوية/الإقامة ورقم الجوال', 'Enter your ID or residency number and mobile number.'); err.hidden = false; return; }
      if (!authConsent.checked) { err.textContent = tr('وافق على استلام رمز الدخول عبر واتساب للمتابعة', 'Agree to receive a sign-in code on WhatsApp to continue.'); err.hidden = false; return; }
      btn.disabled = true; btn.textContent = tr('جارٍ إرسال الرمز…', 'Sending code…');
      try {
        const result = await api('/member/login', { method: 'POST', body: { national_id: idIn.value, phone: phIn.value, auth_consent: true, lang: FC.lang } });
        verifyView(result, { updates: updatesConsent.checked, marketing: marketingConsent.checked });
      } catch (ex) { err.textContent = errorText(ex); err.hidden = false; btn.disabled = false; btn.textContent = tr('إرسال رمز الدخول عبر واتساب', 'Send sign-in code on WhatsApp'); }
    } },
      h('div', {}, h('h1', { text: tr('دخول المشتركين', 'Member sign in') })),
      h('p', { class: 'sub', text: tr('أدخل رقم الهوية أو الإقامة والجوال المسجل لدى النادي. سنرسل رمز تحقق إلى واتساب.', 'Enter the ID or residency number and mobile registered with the club. We will send a verification code on WhatsApp.') }),
      err,
      h('div', { class: 'field' }, h('label', { for: 'nid', text: tr('رقم الهوية / الإقامة', 'ID / Residency number') }), idIn),
      h('div', { class: 'field' }, h('label', { for: 'ph', text: tr('رقم الجوال', 'Mobile number') }), phIn),
      h('label', { class: 'consent-row', for: 'auth-consent' }, authConsent, h('span', { text: tr('أوافق على استلام رمز تحقق لمرة واحدة عبر واتساب لتسجيل الدخول.', 'I agree to receive a one-time WhatsApp verification code to sign in.') })),
      h('label', { class: 'consent-row', for: 'updates-consent' }, updatesConsent, h('span', { text: tr('أرغب باستلام رسائل واتساب المتعلقة بحسابي واشتراكي.', 'Send me WhatsApp messages about my account and membership.') })),
      h('label', { class: 'consent-row', for: 'marketing-consent' }, marketingConsent, h('span', { text: tr('أرغب باستلام العروض والأخبار عبر واتساب.', 'Send me offers and club news on WhatsApp.') })),
      btn);
    loginFrame(form);
    idIn.focus();
  }

  function verifyView(challenge, consent) {
    const err = h('div', { class: 'form-error', role: 'alert', hidden: true });
    const codeIn = h('input', { class: 'input ltr', name: 'code', id: 'otp-code', inputmode: 'numeric', autocomplete: 'one-time-code', maxlength: '6', required: true, placeholder: '••••••' });
    const btn = h('button', { class: 'btn', type: 'submit', text: tr('تحقق ودخول', 'Verify and sign in') });
    const form = h('form', { novalidate: true, onsubmit: async (e) => {
      e.preventDefault(); err.hidden = true;
      btn.disabled = true; btn.textContent = tr('جارٍ التحقق…', 'Verifying…');
      try {
        await api('/member/login/verify', { method: 'POST', body: { challenge_id: challenge.challenge_id, code: codeIn.value, whatsapp_updates_opt_in: consent.updates, whatsapp_marketing_opt_in: consent.marketing, lang: FC.lang } });
        await dashboard();
      } catch (ex) { err.textContent = errorText(ex); err.hidden = false; btn.disabled = false; btn.textContent = tr('تحقق ودخول', 'Verify and sign in'); }
    } },
      h('div', {}, h('h1', { text: tr('تحقق من رقمك', 'Verify your number') })),
      h('p', { class: 'sub', text: tr(`أدخل الرمز المرسل إلى واتساب ${challenge.masked_phone}. صلاحية الرمز خمس دقائق.`, `Enter the code sent to WhatsApp ${challenge.masked_phone}. The code expires in five minutes.`) }),
      err,
      h('div', { class: 'field' }, h('label', { for: 'otp-code', text: tr('رمز التحقق', 'Verification code') }), codeIn),
      btn,
      h('button', { class: 'btn ghost', type: 'button', onclick: () => loginView() }, tr('طلب رمز جديد', 'Request a new code')));
    loginFrame(form);
    codeIn.focus();
  }

  const statusLabel = (status) => ({
    active: tr('فعّال', 'Active'), expiring: tr('ينتهي قريباً', 'Expiring soon'),
    expired: tr('منتهي', 'Expired'), upcoming: tr('لم يبدأ بعد', 'Upcoming'), disabled: tr('معطّل', 'Disabled'),
  }[status] || status);
  const KIND_ICON = { expired: 'alert', expiring: 'clock', renewed: 'check', custom: 'bell' };

  function ring(m) {
    const c = m.status === 'expired' ? 'var(--red)' : m.status === 'expiring' ? 'var(--warn)' : 'var(--ok)';
    const left = Math.max(0, m.days_left);
    const pct = m.status === 'expired' ? 0 : Math.min(1, (left + 1) / m.total_days);
    const big = m.status === 'expired' ? '0' : String(left);
    const label = m.status === 'expired' ? tr('منتهي', 'Expired') : left === 0 ? tr('ينتهي اليوم', 'Expires today') : FC.lang === 'en' ? (left === 1 ? 'day left' : 'days left') : 'يوم متبقي';
    const el = h('div', { class: 'ring', style: { '--c': c }, role: 'img', 'aria-label': `${big} ${label}` });
    el.innerHTML = '<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" cx="60" cy="60" r="54"/></svg>';
    el.append(h('div', { class: 'mid' }, h('b', { text: big }), h('span', { text: label })));
    requestAnimationFrame(() => requestAnimationFrame(() => { el.querySelector('.fg').style.strokeDashoffset = String(339.29 * (1 - pct)); }));
    return el;
  }

  async function dashboard() {
    let me; let site;
    try { [me, site] = await Promise.all([api('/member/me'), api('/site')]); }
    catch (e) { if (e.status === 401) return loginView(); app.replaceChildren(h('p', { class: 'acc-loading', text: errorText(e) })); return; }
    const m = me.member; const club = me.club;
    ctx = { site, settings: site.settings };
    const waUrl = (t) => FC.waLink(site.settings, t);
    const renewLink = waUrl(tr(`مرحباً، أنا ${m.full_name} وأرغب بتجديد اشتراكي في ${club.name}`, `Hello, I am ${m.full_name} and would like to renew my membership at ${club.name_en || club.name}.`));
    const first = m.full_name.split(' ')[0];

    const blocks = [];
    blocks.push(h('div', { class: 'dash-head' },
      h('div', {}, h('h1', { text: tr(`أهلاً ${first}`, `Welcome, ${first}`) }), h('p', { text: FC.lang === 'en' ? (club.name_en || club.name) : club.name }),
        h('p', { class: 'membership-code', text: tr('حساب المشترك', 'Member account') })),
      h('button', { class: 'btn ghost sm', type: 'button', onclick: async () => { await api('/member/logout', { method: 'POST' }); loginView(); } }, icon('logout', 18), tr('تسجيل الخروج', 'Sign out'))));

    if (m.status === 'expired' || m.status === 'expiring') {
      const exp = m.status === 'expired';
      const acts = h('div', { class: 'acts' },
        renewLink ? h('a', { class: 'btn sm', href: renewLink, target: '_blank', rel: 'noopener' }, icon('chat', 18), tr('جدّد عبر واتساب', 'Renew on WhatsApp')) : null,
        club.phone ? h('a', { class: 'btn ghost sm', href: 'tel:' + club.phone.replace(/[^\d+]/g, '') }, icon('phone', 18), tr('اتصل بالنادي', 'Call the club')) : null);
      const lead = icon(exp ? 'alert' : 'clock', 28); lead.classList.add('lead');
      const dl = m.days_left; const dayWord = dl === 1 ? 'يوم' : dl === 2 ? 'يومين' : 'أيام';
      const title = exp ? tr('انتهى اشتراكك', 'Your membership has expired') : FC.lang === 'en' ? (dl === 0 ? 'Your membership expires today' : `Your membership expires in ${dl} ${dl === 1 ? 'day' : 'days'}`) : (dl === 0 ? 'ينتهي اشتراكك اليوم' : `ينتهي اشتراكك خلال ${dl === 1 || dl === 2 ? dayWord : dl + ' ' + dayWord}`);
      const description = exp ? tr(`انتهى اشتراكك بتاريخ ${FC.fmtDate(m.end_date)}. جدّد الآن للعودة إلى التدريب.`, `Your membership expired on ${FC.fmtDate(m.end_date)}. Renew now to return to training.`) : tr(`تاريخ الانتهاء ${FC.fmtDate(m.end_date)}. جدّد قبل الانتهاء حتى لا ينقطع تدريبك.`, `Your membership ends on ${FC.fmtDate(m.end_date)}. Renew before then to keep training.`);
      blocks.push(h('div', { class: 'alert' + (exp ? '' : ' warn'), role: 'alert' }, lead,
        h('div', {}, h('h2', { text: title }), h('p', { text: description }), acts)));
    }

    blocks.push(h('section', { class: 'panel sub-card', 'aria-label': tr('اشتراكك', 'Your membership') }, ring(m),
      h('div', { class: 'sub-info' },
        h('h2', {}, m.plan_name ? tr(`باقة ${m.plan_name}`, `${m.plan_name_en || m.plan_name} plan`) : tr('اشتراكك', 'Your membership'), h('span', { class: 'badge ' + m.status, text: statusLabel(m.status) })),
        h('div', { class: 'kv' },
          h('div', {}, h('small', { text: tr('بداية الاشتراك', 'Membership starts') }), h('strong', { text: FC.fmtDate(m.start_date) })),
          h('div', {}, h('small', { text: tr('نهاية الاشتراك', 'Membership ends') }), h('strong', { text: FC.fmtDate(m.end_date) })),
          h('div', {}, h('small', { text: tr('رقم الجوال', 'Mobile number') }), h('strong', { class: 'ltr', style: { direction: 'ltr', display: 'inline-block' }, text: m.phone }))))));

    const notes = me.notifications;
    const noteList = notes.length ? h('ul', { class: 'notes' }, ...notes.map((n) => h('li', { class: `note k-${n.kind}` + (n.read_at ? '' : ' unread') },
      icon(KIND_ICON[n.kind] || 'bell', 22), h('div', {},
        h('span', { text: FC.lang === 'en' ? (n.message_en || n.message) : n.message }),
        h('time', { text: FC.fmtDate(n.created_at.slice(0, 10)) })))))
      : h('p', { class: 'empty-note', text: tr('لا توجد تنبيهات حالياً.', 'No notifications yet.') });
    blocks.push(h('section', { class: 'panel', 'aria-label': tr('التنبيهات', 'Notifications') },
      h('h2', {}, icon('bell', 24), tr('التنبيهات', 'Notifications'), me.unread ? h('span', { class: 'badge expired', text: tr(me.unread + ' جديد', `${me.unread} new`) }) : null),
      noteList));
    if (me.unread) api('/member/notifications/read', { method: 'POST' }).catch(() => {});

    const calRoot = h('div'); const title = h('h3'); const list = h('div', { class: 'day-list' }); const cache = {};
    const cal = new FC.Calendar(calRoot, { weekStart: site.settings.week_start, today: site.today, onMonth: load, onSelect: show });
    function show(d) {
      const items = (cache[cal.month] || {})[d] || [];
      title.textContent = FC.fmtDateLong(d);
      list.replaceChildren(...(items.length ? items.map((c) => h('div', { class: 'cls' },
        h('div', { class: 'cls-time' }, FC.fmtTime(c.start_time), c.end_time ? h('small', { text: tr('حتى ', 'until ') + FC.fmtTime(c.end_time) }) : null),
        h('div', {}, h('h4', {}, FC.value(c, 'title'), FC.value(c, 'tag') ? h('span', { class: 'tag', text: FC.value(c, 'tag') }) : null),
          (FC.value(c, 'trainer') || FC.value(c, 'notes')) ? h('p', { text: [FC.value(c, 'trainer') && tr('المدرب: ', 'Coach: ') + FC.value(c, 'trainer'), FC.value(c, 'notes')].filter(Boolean).join(' — ') }) : null))) : [h('p', { class: 'empty-note', text: tr('لا توجد حصص في هذا اليوم.', 'No classes scheduled for this day.') })]));
    }
    async function load(month) {
      try {
        if (!cache[month]) cache[month] = FC.groupByDate((await api('/schedule?month=' + month)).classes);
        cal.setData(cache[month]);
        if (!(cal.sel && cal.sel.startsWith(month))) cal.sel = month === site.today.slice(0, 7) ? site.today : (Object.keys(cache[month]).sort()[0] || month + '-01');
        cal.render(); show(cal.sel);
      } catch (e) { list.replaceChildren(h('p', { class: 'empty-note', text: tr('تعذّر تحميل الجدول.', 'Could not load the schedule.') })); }
    }
    load(cal.month);
    blocks.push(h('section', { class: 'panel', 'aria-label': tr('جدول الحصص', 'Class schedule') },
      h('h2', {}, icon('calendar', 24), tr('جدول الحصص', 'Class schedule')),
      h('div', { class: 'acc-sched' }, calRoot, h('div', { class: 'day-box' }, title, list))));

    app.replaceChildren(h('div', { class: 'dash' }, ...blocks));
  }

  const languageToggle = document.getElementById('language-toggle');
  const backLink = document.getElementById('site-back');
  function updateLanguageChrome() {
    if (languageToggle) languageToggle.textContent = tr('English', 'العربية');
    if (backLink) backLink.textContent = tr('العودة للموقع', 'Back to website');
    document.title = tr('حسابي | فايت كلوب', 'My account | Fight Club');
  }
  updateLanguageChrome();
  if (languageToggle) languageToggle.addEventListener('click', async () => {
    FC.setLang(FC.lang === 'ar' ? 'en' : 'ar'); updateLanguageChrome();
    try { await api('/member/me'); await dashboard(); } catch (_) { loginView(); }
  });
  (async function () {
    try { await api('/member/me'); await dashboard(); } catch (e) { loginView(); }
  })();
})();
