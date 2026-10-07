'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  Clock3,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Settings2,
  ShieldCheck,
} from 'lucide-react';
import {
  text,
  whatsappLink,
  type Locale,
  type PublicSite,
  type MemberDashboard,
} from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Feedback,
  ResourceState,
  Status,
  jsonRequest,
  label,
  say,
  useMutation,
  useResource,
} from './ui';
import { selectChoice } from '../public/selection-keyboard';
import { MemberBrand, MemberLogin } from './member-login';
import { MemberClasses, MemberPreferences, MemberRenewal, MemberUpdates } from './member-sections';
import { memberDate, memberTime, memberWeekday } from './member-format';
import './portal.css';
import './member.css';

type MemberTab = 'overview' | 'classes' | 'updates' | 'preferences';
const tabs: MemberTab[] = ['overview', 'classes', 'updates', 'preferences'];
const tabContent = {
  overview: { en: 'Overview', ar: 'نظرة عامة', Icon: LayoutDashboard },
  classes: { en: 'Club classes', ar: 'حصص النادي', Icon: CalendarDays },
  updates: { en: 'Updates', ar: 'المستجدات', Icon: Bell },
  preferences: { en: 'Preferences', ar: 'التفضيلات', Icon: Settings2 },
};

function MembershipPass({
  locale,
  dashboard,
  catalogue,
  renewalUrl,
}: {
  locale: Locale;
  dashboard: MemberDashboard;
  catalogue: PublicSite | null;
  renewalUrl: string | null;
}) {
  const membership = dashboard.member.membership;
  const reduced = useReducedMotion();
  if (!membership)
    return (
      <section className="member-pass member-pass-empty">
        <ShieldCheck size={32} />
        <h2>{say(locale, 'Your membership', 'اشتراكك')}</h2>
        <p>
          {say(
            locale,
            'No membership has been assigned. Please contact club reception.',
            'لم يتم تعيين اشتراك. تواصل مع استقبال النادي.',
          )}
        </p>
        <Link className="member-inline-link" href={`/${locale}#contact`}>
          {say(locale, 'Contact the club', 'تواصل مع النادي')}
          <ArrowUpRight size={17} />
        </Link>
      </section>
    );
  const active = membership.status === 'active' || membership.status === 'expiring';
  const duration =
    Math.floor(
      (Date.parse(`${membership.endDate}T00:00:00+03:00`) -
        Date.parse(`${membership.startDate}T00:00:00+03:00`)) /
        86400000,
    ) + 1;
  const remaining = active ? Math.min(Math.max(membership.daysLeft, 0), Math.max(duration, 0)) : 0;
  const remainingPercent = duration > 0 ? (remaining / duration) * 100 : 0;
  const sports = membership.sports
    .map((id) => catalogue?.sports.find((sport) => sport.id === id))
    .filter((sport) => sport !== undefined);
  const stateText = {
    active: say(
      locale,
      'Your membership is active. Keep your training going.',
      'اشتراكك نشط. واصل تدريبك.',
    ),
    expiring: say(
      locale,
      'Your membership ends soon. Contact the club to renew.',
      'اشتراكك ينتهي قريباً. تواصل مع النادي للتجديد.',
    ),
    expired: say(
      locale,
      'Your membership has ended. Contact the club to renew.',
      'انتهى اشتراكك. تواصل مع النادي للتجديد.',
    ),
    upcoming: say(
      locale,
      'Your membership starts on the date below.',
      'يبدأ اشتراكك في التاريخ الموضّح أدناه.',
    ),
    suspended: say(
      locale,
      'Your membership is suspended. Please contact reception.',
      'اشتراكك موقوف. تواصل مع الاستقبال.',
    ),
  };
  return (
    <section className={`member-pass member-pass-${membership.status}`}>
      <div className="member-pass-header">
        <span className="member-pass-label">{say(locale, 'Your membership', 'اشتراكك')}</span>
        <Status status={membership.status} locale={locale} />
      </div>
      <h2>{text(membership.planName, locale)}</h2>
      <p className="member-pass-state">{stateText[membership.status]}</p>
      <div className="member-pass-sports">
        {sports.map((sport) => (
          <span key={sport.id}>{text(sport.name, locale)}</span>
        ))}
        {!sports.length && (
          <span>
            {say(
              locale,
              'Contact reception for your registered sports.',
              'تواصل مع الاستقبال لمعرفة رياضات اشتراكك.',
            )}
          </span>
        )}
      </div>
      {active && (
        <div className="member-remaining">
          <div>
            <strong>
              {new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-GB').format(remaining)}
            </strong>
            <span>{label(locale, 'daysLeft')}</span>
          </div>
          <div
            className="member-period-track"
            role="meter"
            aria-label={say(locale, 'Membership days remaining', 'الأيام المتبقية من الاشتراك')}
            aria-valuemin={0}
            aria-valuemax={Math.max(duration, 1)}
            aria-valuenow={remaining}
          >
            <motion.span
              initial={false}
              animate={{ width: `${remainingPercent}%` }}
              transition={{ duration: reduced ? 0 : 0.5 }}
            />
          </div>
        </div>
      )}
      <dl className="member-pass-dates">
        <div>
          <dt>{label(locale, 'start')}</dt>
          <dd>{memberDate(membership.startDate, locale)}</dd>
        </div>
        <div>
          <dt>{label(locale, 'end')}</dt>
          <dd>{memberDate(membership.endDate, locale)}</dd>
        </div>
      </dl>
      <MemberRenewal locale={locale} url={renewalUrl} />
    </section>
  );
}

function MemberSession({
  locale,
  onSessionChange,
}: {
  locale: Locale;
  onSessionChange: () => void;
}) {
  const resource = useResource<MemberDashboard>('/member/me');
  const catalogue = useResource<PublicSite>('/public/site');
  const logout = useMutation();
  const [tab, setTab] = useState<MemberTab>('overview');
  const reduced = useReducedMotion();
  const instanceId = useId();
  useEffect(() => {
    if (logout.errorStatus === 401) onSessionChange();
  }, [logout.errorStatus, onSessionChange]);
  function navigateTab(next: MemberTab) {
    setTab(next);
    requestAnimationFrame(() => document.getElementById(`${instanceId}-tab-${next}`)?.focus());
  }
  async function signOut() {
    const result = await logout.run(() =>
      api<{ ok: boolean }>('/member/logout', jsonRequest('POST')),
    );
    if (result) onSessionChange();
  }
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  if (resource.loading && !resource.data)
    return (
      <main className="portal-root member-experience" dir={dir}>
        <div className="member-state-shell">
          <MemberBrand locale={locale} />
          <div className="member-loading" role="status">
            <LoaderCircle className="member-spin" size={27} />
            <p>{label(locale, 'loading')}</p>
          </div>
        </div>
      </main>
    );
  if (resource.error && resource.errorStatus !== 401)
    return (
      <main className="portal-root member-experience" dir={dir}>
        <div className="member-state-shell">
          <MemberBrand locale={locale} />
          <div className="member-error-panel">
            <ResourceState locale={locale} resource={resource}>
              <span />
            </ResourceState>
            <Link href={`/${locale}`}>
              {say(locale, 'Back to the club website', 'العودة إلى موقع النادي')}
            </Link>
          </div>
        </div>
      </main>
    );
  if (!resource.data)
    return (
      <main className="portal-root member-experience" dir={dir}>
        <MemberLogin locale={locale} onSuccess={onSessionChange} />
      </main>
    );
  const dashboard = resource.data;
  const membership = dashboard.member.membership;
  const message =
    locale === 'ar'
      ? `مرحباً، أرغب في تجديد اشتراكي.\nالاسم: ${dashboard.member.fullName}\nالباقة: ${membership?.planName.ar ?? 'غير محددة'}\nتاريخ انتهاء الاشتراك: ${membership?.endDate ?? ''}\nأرجو تأكيد السعر والتوفر وإجراءات الدفع.`
      : `Hello, I would like to renew my membership.\nName: ${dashboard.member.fullName}\nPackage: ${membership?.planName.en ?? 'Not assigned'}\nMembership end date: ${membership?.endDate ?? ''}\nPlease confirm the price, availability and payment instructions.`;
  const renewalUrl = whatsappLink(dashboard.settings, message);
  const now = Date.now();
  const classes = dashboard.classes
    .filter(
      (session) =>
        session.status === 'scheduled' &&
        Date.parse(`${session.date}T${session.startTime.slice(0, 5)}:00+03:00`) > now,
    )
    .sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  const nextClass = classes[0];
  const unread = dashboard.announcements.filter((announcement) => !announcement.read).length;
  return (
    <main className="portal-root member-experience" dir={dir}>
      <header className="member-topbar member-dashboard-topbar">
        <MemberBrand locale={locale} />
        <nav aria-label={say(locale, 'Account links', 'روابط الحساب')}>
          <Link className="member-public-link" href={`/${locale}`}>
            {say(locale, 'Club website', 'موقع النادي')}
            <ArrowUpRight size={15} />
          </Link>
          <Link className="member-language" href={`/${locale === 'ar' ? 'en' : 'ar'}/account`}>
            {locale === 'ar' ? 'English' : 'العربية'}
          </Link>
          <button
            className="member-signout"
            aria-label={label(locale, 'logout')}
            disabled={logout.pending}
            onClick={() => void signOut()}
          >
            <LogOut size={16} />
            <span>{label(locale, 'logout')}</span>
          </button>
        </nav>
      </header>
      <div className="member-dashboard-shell">
        <Feedback action={logout} locale={locale} />
        {logout.pending && (
          <p className="member-session-status" role="status">
            {say(locale, 'Signing out…', 'جارٍ تسجيل الخروج…')}
          </p>
        )}
        <div inert={logout.pending}>
          <section className="member-welcome-block">
            <div>
              <p>{say(locale, 'Welcome back', 'أهلاً بعودتك')}</p>
              <h1>{dashboard.member.fullName}</h1>
              <span>
                {say(
                  locale,
                  'Keep showing up. Every round counts.',
                  'واصل الحضور. كل جولة تصنع الفرق.',
                )}
              </span>
            </div>
            <span className="member-welcome-date">
              <CalendarDays size={17} />
              {memberDate(new Date().toISOString(), locale)}
            </span>
          </section>
          <nav
            className="member-tabs"
            role="tablist"
            aria-label={say(locale, 'Member dashboard', 'لوحة العضو')}
            onKeyDown={(event) => selectChoice(event, tabs, tab, setTab, locale === 'ar')}
          >
            {tabs.map((value) => {
              const { Icon } = tabContent[value];
              return (
                <button
                  id={`${instanceId}-tab-${value}`}
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  aria-controls={`${instanceId}-panel-${value}`}
                  tabIndex={tab === value ? 0 : -1}
                  onClick={() => setTab(value)}
                >
                  {tab === value && (
                    <motion.span
                      className="member-tab-indicator"
                      layoutId={reduced ? undefined : `${instanceId}-selection`}
                      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="member-tab-label">
                    <Icon size={18} />
                    {tabContent[value][locale]}
                    {value === 'updates' && unread > 0 && (
                      <span className="member-unread-count">{unread}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
          <ResourceState locale={locale} resource={resource}>
            {tabs.map((value) => (
              <motion.div
                key={value}
                id={`${instanceId}-panel-${value}`}
                role="tabpanel"
                aria-labelledby={`${instanceId}-tab-${value}`}
                tabIndex={0}
                hidden={tab !== value}
                className="member-tab-panel"
                initial={false}
                animate={tab === value ? { opacity: 1, y: 0 } : { opacity: 0, y: reduced ? 0 : 6 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
              >
                {value === 'overview' && (
                  <>
                    <div className="member-overview-grid">
                      <MembershipPass
                        locale={locale}
                        dashboard={dashboard}
                        catalogue={catalogue.data}
                        renewalUrl={renewalUrl}
                      />
                      <div className="member-overview-side">
                        <section className="member-next-class">
                          <span className="member-section-icon">
                            <CalendarDays size={23} />
                          </span>
                          <h2>{say(locale, 'Next club class', 'حصة النادي القادمة')}</h2>
                          {nextClass ? (
                            <>
                              <p className="member-next-date">
                                {memberWeekday(nextClass.date, locale)}
                                <span>{memberDate(nextClass.date, locale, true)}</span>
                              </p>
                              <h3>{text(nextClass.title, locale)}</h3>
                              <p className="member-next-time">
                                <Clock3 size={17} />
                                {memberTime(nextClass.startTime, locale)} /{' '}
                                {memberTime(nextClass.endTime, locale)}
                              </p>
                              <span className="member-muted">
                                {text(nextClass.ageGroup, locale)}
                              </span>
                              <button
                                className="member-next-link"
                                onClick={() => navigateTab('classes')}
                              >
                                {say(locale, 'Explore club classes', 'استعرض حصص النادي')}
                                <ArrowUpRight size={18} />
                              </button>
                            </>
                          ) : (
                            <>
                              <p>
                                {say(
                                  locale,
                                  'No upcoming classes match your membership right now.',
                                  'لا توجد حصص قادمة مطابقة لاشتراكك حالياً.',
                                )}
                              </p>
                              <Link className="member-inline-link" href={`/${locale}#schedule`}>
                                {say(locale, 'View full schedule', 'عرض الجدول الكامل')}
                                <ArrowUpRight size={17} />
                              </Link>
                            </>
                          )}
                        </section>
                        <button
                          className="member-update-shortcut"
                          onClick={() => navigateTab('updates')}
                        >
                          <Bell size={22} />
                          <span>
                            <strong>{say(locale, 'Club updates', 'مستجدات النادي')}</strong>
                            <small>
                              {say(
                                locale,
                                unread ? `${unread} unread announcements` : 'You’re up to date',
                                unread ? `${unread} إعلانات غير مقروءة` : 'اطّلعت على كل المستجدات',
                              )}
                            </small>
                          </span>
                          <ArrowUpRight size={18} />
                        </button>
                      </div>
                    </div>
                    <div className="member-overview-footer">
                      <ShieldCheck size={18} />
                      <p>
                        {say(
                          locale,
                          'Need to change your plan or membership details? Contact club reception.',
                          'تحتاج لتعديل باقتك أو بيانات اشتراكك؟ تواصل مع استقبال النادي.',
                        )}
                      </p>
                      <Link href={`/${locale}#contact`}>
                        {say(locale, 'Contact the club', 'تواصل مع النادي')}
                      </Link>
                    </div>
                  </>
                )}
                {value === 'classes' && (
                  <MemberClasses locale={locale} classes={classes} catalogue={catalogue.data} />
                )}
                {value === 'updates' && (
                  <MemberUpdates
                    locale={locale}
                    dashboard={dashboard}
                    reload={resource.reload}
                    onSessionExpired={onSessionChange}
                  />
                )}
                {value === 'preferences' && (
                  <MemberPreferences
                    locale={locale}
                    dashboard={dashboard}
                    reload={resource.reload}
                    onSessionExpired={onSessionChange}
                  />
                )}
              </motion.div>
            ))}
          </ResourceState>
        </div>
        <footer className="member-footer">
          <span>FIGHT CLUB</span>
          <p>{say(locale, 'Your next round is waiting.', 'جولتك القادمة تنتظرك.')}</p>
          <Link href={`/${locale}#contact`}>{say(locale, 'Need help?', 'تحتاج مساعدة؟')}</Link>
        </footer>
      </div>
    </main>
  );
}

export function MemberPortal({ locale }: { locale: Locale }) {
  const [sessionRevision, setSessionRevision] = useState(0);
  return (
    <MemberSession
      key={sessionRevision}
      locale={locale}
      onSessionChange={() => setSessionRevision((value) => value + 1)}
    />
  );
}
