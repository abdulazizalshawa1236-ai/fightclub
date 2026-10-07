'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  text,
  whatsappLink,
  type Locale,
  type PublicSite,
  type MemberDashboard,
} from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Empty,
  Feedback,
  Field,
  FormButtons,
  PanelTitle,
  ResourceState,
  Status,
  Toggle,
  jsonRequest,
  label,
  say,
  submit,
  useMutation,
  useResource,
} from './ui';
import './portal.css';
type Challenge = { challengeId: string; maskedPhone: string };
function MemberLogin({ locale, onSuccess }: { locale: Locale; onSuccess: () => void }) {
  const [nationalId, setNationalId] = useState('');
  const [phone, setPhone] = useState('');
  const [authConsent, setAuthConsent] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState('');
  const action = useMutation();
  async function request() {
    const result = await action.run(() =>
      api<Challenge>(
        '/member/login',
        jsonRequest('POST', { nationalId, phone, authConsent, locale }),
      ),
    );
    if (result) setChallenge(result);
  }
  async function verify() {
    const result = await action.run(() =>
      api<{ ok: boolean }>(
        '/member/verify',
        jsonRequest('POST', { challengeId: challenge?.challengeId, code }),
      ),
    );
    if (result) onSuccess();
  }
  return (
    <div className="portal-auth-wrap member-auth">
      <section className="portal-auth">
        <Link className="portal-wordmark" href={`/${locale}`}>
          FIGHT CLUB<span>{say(locale, 'Member area', 'بوابة الأعضاء')}</span>
        </Link>
        <h1>
          {say(
            locale,
            challenge ? 'Verify your number' : 'Your next round starts here',
            challenge ? 'تحقق من رقمك' : 'جولتك القادمة تبدأ هنا',
          )}
        </h1>
        <p>
          {say(
            locale,
            challenge
              ? `Enter the code sent by SMS to ${challenge.maskedPhone}.`
              : 'Sign in with the ID and mobile number registered by the club.',
            challenge
              ? `أدخل الرمز المرسل برسالة نصية إلى ${challenge.maskedPhone}.`
              : 'ادخل باستخدام الهوية ورقم الجوال المسجلين لدى النادي.',
          )}
        </p>
        {challenge ? (
          <form onSubmit={submit(verify)}>
            <Field label={say(locale, 'Verification code', 'رمز التحقق')}>
              <input
                autoFocus
                type="text"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                autoComplete="one-time-code"
                dir="ltr"
                className="portal-otp"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <button className="primary" type="submit" disabled={action.pending}>
              {say(locale, 'Verify and sign in', 'تحقق وسجّل الدخول')}
            </button>
            <button
              className="portal-text-button"
              type="button"
              disabled={action.pending}
              onClick={() => {
                setChallenge(null);
                setCode('');
                action.clear();
              }}
            >
              {say(
                locale,
                'Request another code or change details',
                'طلب رمز آخر أو تعديل البيانات',
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={submit(request)}>
            <Field label={label(locale, 'nationalId')}>
              <input
                required
                dir="ltr"
                inputMode="numeric"
                pattern="[0-9]{10}"
                maxLength={10}
                autoComplete="off"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
              />
            </Field>
            <Field label={label(locale, 'phone')}>
              <input
                type="tel"
                required
                dir="ltr"
                placeholder="+9665…"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </Field>
            <Toggle
              label={say(
                locale,
                'I agree to receive this login verification code by SMS.',
                'أوافق على استلام رمز التحقق للدخول برسالة نصية.',
              )}
              checked={authConsent}
              onChange={setAuthConsent}
            />
            <button className="primary" disabled={!authConsent || action.pending} type="submit">
              {say(locale, 'Send code by SMS', 'إرسال الرمز برسالة نصية')}
            </button>
          </form>
        )}
        <Feedback action={action} locale={locale} />
        <p className="portal-hint">
          {say(
            locale,
            'New to the club? Staff confirms your plan and payment before creating your membership.',
            'جديد في النادي؟ تؤكد الإدارة باقتك ودفعك قبل إنشاء العضوية.',
          )}
        </p>
        <Link href={`/${locale}#pricing`}>
          {say(locale, 'Explore membership plans', 'استعرض باقات الاشتراك')}
        </Link>
      </section>
    </div>
  );
}
function Preferences({
  locale,
  dashboard,
  reload,
}: {
  locale: Locale;
  dashboard: MemberDashboard;
  reload: () => void;
}) {
  const [consent, setConsent] = useState(dashboard.member.consent);
  const [preferredLanguage, setPreferredLanguage] = useState(dashboard.member.preferredLanguage);
  const action = useMutation(reload);
  async function save() {
    await action.run(() =>
      api<{ ok: boolean }>(
        '/member/preferences',
        jsonRequest('PUT', { ...consent, locale: preferredLanguage }),
      ),
    );
  }
  return (
    <section className="member-preferences">
      <h2>{say(locale, 'Your preferences', 'تفضيلاتك')}</h2>
      <form onSubmit={submit(save)}>
        <Toggle
          label={label(locale, 'updates')}
          checked={consent.updates}
          onChange={(updates) => setConsent((current) => ({ ...current, updates }))}
        />
        <Toggle
          label={label(locale, 'marketing')}
          checked={consent.marketing}
          onChange={(marketing) => setConsent((current) => ({ ...current, marketing }))}
        />
        <p className="portal-hint">
          {say(
            locale,
            'Choose which WhatsApp messages you receive. Consent for SMS login verification is requested separately when you sign in.',
            'اختر رسائل واتساب التي ترغب باستلامها. يتم طلب الموافقة على رمز الدخول برسالة نصية بشكل منفصل عند تسجيل الدخول.',
          )}
        </p>
        <Field label={say(locale, 'Preferred message language', 'لغة الرسائل المفضلة')}>
          <select
            value={preferredLanguage}
            onChange={(e) => setPreferredLanguage(e.target.value === 'en' ? 'en' : 'ar')}
          >
            <option value="ar">العربية</option>
            <option value="en">English</option>
          </select>
        </Field>
        <Feedback action={action} locale={locale} />
        <FormButtons pending={action.pending} locale={locale} />
      </form>
    </section>
  );
}
export function MemberPortal({ locale }: { locale: Locale }) {
  const resource = useResource<MemberDashboard>('/member/me');
  const catalogue = useResource<PublicSite>('/public/site');
  const [signedOut, setSignedOut] = useState(false);
  const logout = useMutation();
  const readAction = useMutation(resource.reload);
  async function signOut() {
    const result = await logout.run(() =>
      api<{ ok: boolean }>('/member/logout', jsonRequest('POST')),
    );
    if (result) {
      setSignedOut(true);
      resource.reload();
    }
  }
  async function markRead(ids: string[]) {
    await readAction.run(() =>
      api<{ ok: boolean }>('/member/announcements/read', jsonRequest('POST', { ids })),
    );
  }
  if (resource.loading && !resource.data)
    return (
      <main className="portal-root" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <p className="portal-empty" role="status">
          {label(locale, 'loading')}
        </p>
      </main>
    );
  if (resource.error && resource.errorStatus !== 401 && !signedOut)
    return (
      <main className="portal-root" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <div className="portal-auth-wrap">
          <ResourceState locale={locale} resource={resource}>
            <span />
          </ResourceState>
        </div>
      </main>
    );
  if (!resource.data || signedOut)
    return (
      <main className="portal-root" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <MemberLogin
          locale={locale}
          onSuccess={() => {
            setSignedOut(false);
            resource.reload();
          }}
        />
      </main>
    );
  const dashboard = resource.data;
  const membership = dashboard.member.membership;
  const renewalMessage =
    locale === 'ar'
      ? `مرحباً، أرغب في تجديد اشتراكي.\nالاسم: ${dashboard.member.fullName}\nالباقة: ${membership?.planName.ar ?? 'غير محددة'}\nتاريخ انتهاء الاشتراك: ${membership?.endDate ?? ''}\nأرجو تأكيد السعر والتوفر وإجراءات الدفع.`
      : `Hello, I would like to renew my membership.\nName: ${dashboard.member.fullName}\nPackage: ${membership?.planName.en ?? 'Not assigned'}\nMembership end date: ${membership?.endDate ?? ''}\nPlease confirm the price, availability and payment instructions.`;
  const renewalUrl = whatsappLink(dashboard.settings, renewalMessage);
  return (
    <main className="portal-root member-root" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <header className="member-header">
        <Link className="portal-wordmark" href={`/${locale}`}>
          FIGHT CLUB
        </Link>
        <nav>
          <Link href={`/${locale === 'ar' ? 'en' : 'ar'}/account`}>
            {locale === 'ar' ? 'English' : 'العربية'}
          </Link>
          <button disabled={logout.pending} onClick={() => void signOut()}>
            {label(locale, 'logout')}
          </button>
        </nav>
      </header>
      <div className="member-container">
        <Feedback action={logout} locale={locale} />
        <ResourceState resource={resource} locale={locale}>
          <section className="member-welcome">
            <p>{say(locale, 'Welcome back', 'أهلاً بعودتك')}</p>
            <h1>{dashboard.member.fullName}</h1>
            <span>
              {say(
                locale,
                'Keep showing up. Every round counts.',
                'واصل الحضور. كل جولة تصنع الفرق.',
              )}
            </span>
          </section>
          <div className="member-columns">
            <section className="member-membership">
              <PanelTitle title={say(locale, 'Your membership', 'اشتراكك')} />
              {membership ? (
                <>
                  <div className="member-membership-top">
                    <h2>{text(membership.planName, locale)}</h2>
                    <Status status={membership.status} locale={locale} />
                  </div>
                  <dl className="portal-facts">
                    <div>
                      <dt>{label(locale, 'start')}</dt>
                      <dd>{membership.startDate}</dd>
                    </div>
                    <div>
                      <dt>{label(locale, 'end')}</dt>
                      <dd>{membership.endDate}</dd>
                    </div>
                    <div>
                      <dt>{label(locale, 'daysLeft')}</dt>
                      <dd className="member-days">{membership.daysLeft}</dd>
                    </div>
                    <div>
                      <dt>{label(locale, 'sports')}</dt>
                      <dd>
                        {membership.sports
                          .map((id) => {
                            const sport = catalogue.data?.sports.find((value) => value.id === id);
                            return sport ? text(sport.name, locale) : id;
                          })
                          .join(', ')}
                      </dd>
                    </div>
                  </dl>
                  {renewalUrl ? (
                    <a
                      className="portal-button primary"
                      href={renewalUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {say(locale, 'Request renewal via WhatsApp', 'طلب التجديد عبر واتساب')}
                    </a>
                  ) : (
                    <p className="portal-alert">
                      {say(
                        locale,
                        'The club WhatsApp contact is unavailable. Please contact reception.',
                        'رقم واتساب النادي غير متاح. تواصل مع الاستقبال.',
                      )}
                    </p>
                  )}
                  <p className="portal-hint">
                    {say(
                      locale,
                      'Renewal is confirmed by club staff after payment.',
                      'تؤكد الإدارة التجديد بعد إتمام الدفع.',
                    )}
                  </p>
                </>
              ) : (
                <Empty
                  locale={locale}
                  text={say(
                    locale,
                    'No membership has been assigned. Please contact club reception.',
                    'لم يتم تعيين اشتراك. تواصل مع استقبال النادي.',
                  )}
                />
              )}
            </section>
            <Preferences
              key={dashboard.member.id}
              locale={locale}
              dashboard={dashboard}
              reload={resource.reload}
            />
          </div>
          <section className="member-section">
            <PanelTitle title={say(locale, 'Your upcoming classes', 'حصصك القادمة')} />
            {dashboard.classes.length ? (
              <ul className="portal-class-list">
                {dashboard.classes.map((session) => (
                  <li key={session.id}>
                    <div className="member-class-date">
                      <strong>{session.date}</strong>
                      <time dir="ltr">
                        {session.startTime} - {session.endTime}
                      </time>
                    </div>
                    <div>
                      <strong>{text(session.title, locale)}</strong>
                      <span>
                        {text(session.ageGroup, locale)} · {session.room}
                      </span>
                      {text(session.notes, locale) && <p>{text(session.notes, locale)}</p>}
                    </div>
                    <span>
                      {say(
                        locale,
                        session.status === 'cancelled' ? 'Cancelled' : 'Scheduled',
                        session.status === 'cancelled' ? 'ملغاة' : 'مجدولة',
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty
                locale={locale}
                text={say(
                  locale,
                  'No upcoming classes match your membership. Check the public schedule or ask reception.',
                  'لا توجد حصص قادمة مطابقة لاشتراكك. راجع الجدول العام أو تواصل مع الاستقبال.',
                )}
              />
            )}
            <Link href={`/${locale}#schedule`}>
              {say(locale, 'View full schedule', 'عرض الجدول الكامل')}
            </Link>
          </section>
          <section className="member-section">
            <PanelTitle title={label(locale, 'announcements')} />
            <Feedback action={readAction} locale={locale} />
            {dashboard.announcements.length ? (
              <div className="member-announcements">
                {dashboard.announcements.map((announcement) => (
                  <article key={announcement.id} className={announcement.read ? 'read' : 'unread'}>
                    <span>{new Date(announcement.createdAt).toLocaleDateString(locale)}</span>
                    <h3>{text(announcement.title, locale)}</h3>
                    <p>{text(announcement.body, locale)}</p>
                    {!announcement.read && (
                      <button
                        disabled={readAction.pending}
                        onClick={() => void markRead([announcement.id])}
                      >
                        {say(locale, 'Mark as read', 'تحديد كمقروء')}
                      </button>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <Empty locale={locale} />
            )}
          </section>
        </ResourceState>
      </div>
    </main>
  );
}
