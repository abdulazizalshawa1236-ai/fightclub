'use client';

import { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  MapPin,
  MessageCircle,
  Settings2,
  UserRound,
} from 'lucide-react';
import {
  text,
  type ClassSession,
  type Locale,
  type MemberDashboard,
  type PublicSite,
} from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Empty,
  Feedback,
  Field,
  FormButtons,
  Toggle,
  jsonRequest,
  label,
  say,
  submit,
  useMutation,
} from './ui';
import { memberDate, memberTime, memberWeekday } from './member-format';

const PREFERENCE_CONFIRM_TIMEOUT_MS = 10000;

export function MemberPreferences({
  locale,
  dashboard,
  reload,
  onSessionExpired,
}: {
  locale: Locale;
  dashboard: MemberDashboard;
  reload: () => void;
  onSessionExpired: () => void;
}) {
  const [draft, setDraft] = useState<{
    consent: MemberDashboard['member']['consent'];
    language: Locale;
  } | null>(null);
  const [confirmed, setConfirmed] = useState<{
    consent: MemberDashboard['member']['consent'];
    language: Locale;
  } | null>(null);
  const consent = draft?.consent ?? dashboard.member.consent;
  const preferredLanguage = draft?.language ?? dashboard.member.preferredLanguage;
  function setConsent(next: MemberDashboard['member']['consent']) {
    setDraft({ consent: next, language: preferredLanguage });
    setConfirmed(null);
    action.clear();
  }
  function setPreferredLanguage(next: Locale) {
    setDraft({ consent, language: next });
    setConfirmed(null);
    action.clear();
  }
  const action = useMutation(reload);
  useEffect(() => {
    if (action.errorStatus === 401) onSessionExpired();
  }, [action.errorStatus, onSessionExpired]);
  useEffect(() => {
    if (
      confirmed &&
      dashboard.member.consent.updates === confirmed.consent.updates &&
      dashboard.member.consent.marketing === confirmed.consent.marketing &&
      dashboard.member.preferredLanguage === confirmed.language
    ) {
      setDraft(null);
      setConfirmed(null);
    }
  }, [dashboard.member, confirmed]);
  async function save() {
    const submitted = { consent, language: preferredLanguage };
    const result = await action.run(async () => {
      await api<{ ok: boolean }>(
        '/member/preferences',
        jsonRequest('PUT', { ...consent, locale: preferredLanguage }),
      );
      const fresh = await api<MemberDashboard>('/member/me', {
        signal: AbortSignal.timeout(PREFERENCE_CONFIRM_TIMEOUT_MS),
      });
      if (
        fresh.member.consent.updates !== submitted.consent.updates ||
        fresh.member.consent.marketing !== submitted.consent.marketing ||
        fresh.member.preferredLanguage !== submitted.language
      ) {
        throw new Error(
          say(
            locale,
            'Your preferences changed while saving. Review your choices and save again.',
            'تغيّرت تفضيلاتك أثناء الحفظ. راجع اختياراتك واحفظها مجدداً.',
          ),
        );
      }
      return fresh;
    });
    if (result) setConfirmed(submitted);
  }
  return (
    <section className="member-panel member-preferences-panel">
      <div className="member-section-heading">
        <div>
          <span className="member-section-icon">
            <Settings2 size={21} />
          </span>
          <h2>{say(locale, 'Make it yours', 'تفضيلاتك، كما تحب')}</h2>
          <p>
            {say(locale, 'Choose how you hear from Fight Club.', 'اختر طريقة تواصلك مع فايت كلوب.')}
          </p>
        </div>
      </div>
      <form onSubmit={submit(save)}>
        <fieldset className="member-preference-fields" disabled={action.pending}>
          <div className="member-preference-row">
            <div>
              <h3>{label(locale, 'updates')}</h3>
              <p>
                {say(
                  locale,
                  'Renewal confirmations and membership reminders on WhatsApp.',
                  'تأكيدات التجديد وتذكيرات الاشتراك عبر واتساب.',
                )}
              </p>
            </div>
            <Toggle
              label={label(locale, 'updates')}
              checked={consent.updates}
              onChange={(updates) => setConsent({ ...consent, updates })}
            />
          </div>
          <div className="member-preference-row">
            <div>
              <h3>{label(locale, 'marketing')}</h3>
              <p>
                {say(
                  locale,
                  'Offers and promotions from the club on WhatsApp.',
                  'العروض والتخفيضات من النادي عبر واتساب.',
                )}
              </p>
            </div>
            <Toggle
              label={label(locale, 'marketing')}
              checked={consent.marketing}
              onChange={(marketing) => setConsent({ ...consent, marketing })}
            />
          </div>
          <div className="member-preference-language">
            <Field label={say(locale, 'Preferred message language', 'لغة الرسائل المفضلة')}>
              <select
                value={preferredLanguage}
                onChange={(event) =>
                  setPreferredLanguage(event.target.value === 'en' ? 'en' : 'ar')
                }
              >
                <option value="ar">العربية</option>
                <option value="en">English</option>
              </select>
            </Field>
          </div>
          <p className="member-muted member-preference-note">
            {say(
              locale,
              'Consent for SMS login verification is requested separately when you sign in.',
              'يتم طلب الموافقة على رمز الدخول برسالة نصية بشكل منفصل عند تسجيل الدخول.',
            )}
          </p>
          <Feedback action={action} locale={locale} />
          <FormButtons pending={action.pending} locale={locale} />
        </fieldset>
      </form>
    </section>
  );
}

export function MemberClasses({
  locale,
  classes,
  catalogue,
}: {
  locale: Locale;
  classes: ClassSession[];
  catalogue: PublicSite | null;
}) {
  const [sportId, setSportId] = useState('all');
  const [date, setDate] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const instanceId = useId();
  const sports = [...new Set(classes.map((session) => session.sportId))];
  const dates = [...new Set(classes.map((session) => session.date))].sort();
  const selected = classes.filter(
    (session) =>
      (sportId === 'all' || session.sportId === sportId) &&
      (date === 'all' || session.date === date),
  );
  const sportName = (id: string) => {
    const sport = catalogue?.sports.find((value) => value.id === id);
    return sport
      ? text(sport.name, locale)
      : text(
          classes.find((session) => session.sportId === id)?.title ?? {
            ar: 'حصة تدريبية',
            en: 'Training class',
          },
          locale,
        );
  };
  return (
    <section className="member-panel">
      <div className="member-section-heading">
        <div>
          <h2>{say(locale, 'Find your next round', 'اختر جولتك القادمة')}</h2>
          <p>
            {say(
              locale,
              'Club classes matching the sports on your membership. Check times and age groups before attending.',
              'حصص النادي المطابقة لرياضات اشتراكك. راجع المواعيد والفئات العمرية قبل الحضور.',
            )}
          </p>
        </div>
        <Link className="member-inline-link" href={`/${locale}#schedule`}>
          <CalendarDays size={17} />
          {say(locale, 'Full schedule', 'الجدول الكامل')}
        </Link>
      </div>
      {classes.length > 0 && (
        <div className="member-class-filters">
          <Field label={label(locale, 'sport')}>
            <select
              value={sportId}
              onChange={(event) => {
                setSportId(event.target.value);
                setExpanded(null);
              }}
            >
              <option value="all">{say(locale, 'All sports', 'كل الرياضات')}</option>
              {sports.map((id) => (
                <option value={id} key={id}>
                  {sportName(id)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={label(locale, 'date')}>
            <select
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setExpanded(null);
              }}
            >
              <option value="all">{say(locale, 'All dates', 'كل الأيام')}</option>
              {dates.map((value) => (
                <option value={value} key={value}>
                  {memberWeekday(value, locale)}، {memberDate(value, locale, true)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      )}
      <div className="member-class-items">
        {selected.map((session) => {
          const open = expanded === session.id;
          const detailId = `${instanceId}-${session.id}`;
          const coach = catalogue?.coaches.find((value) => value.id === session.coachId);
          return (
            <article className={`member-class-item${open ? ' is-expanded' : ''}`} key={session.id}>
              <button
                type="button"
                className="member-class-trigger"
                aria-expanded={open}
                aria-controls={detailId}
                onClick={() => setExpanded(open ? null : session.id)}
              >
                <span className="member-class-day">
                  <strong>{memberDate(session.date, locale, true)}</strong>
                  <small>{memberWeekday(session.date, locale)}</small>
                </span>
                <span className="member-class-summary">
                  <strong>{text(session.title, locale)}</strong>
                  <span>
                    <Clock3 size={15} />
                    {memberTime(session.startTime, locale)}
                    <span className="member-class-age">{text(session.ageGroup, locale)}</span>
                  </span>
                </span>
                <ChevronDown className="member-class-chevron" size={19} />
              </button>
              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    id={detailId}
                    className="member-class-detail"
                    initial={{ height: reduced ? 'auto' : 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: reduced ? 'auto' : 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.2 }}
                  >
                    <div className="member-class-detail-inner">
                      <dl>
                        <div>
                          <dt>
                            <Clock3 size={15} />
                            {label(locale, 'time')}
                          </dt>
                          <dd>
                            {memberTime(session.startTime, locale)} /{' '}
                            {memberTime(session.endTime, locale)}
                          </dd>
                        </div>
                        <div>
                          <dt>
                            <UserRound size={15} />
                            {label(locale, 'age')}
                          </dt>
                          <dd>{text(session.ageGroup, locale)}</dd>
                        </div>
                        {session.room && (
                          <div>
                            <dt>
                              <MapPin size={15} />
                              {label(locale, 'room')}
                            </dt>
                            <dd>{session.room}</dd>
                          </div>
                        )}
                        {coach && (
                          <div>
                            <dt>
                              <UserRound size={15} />
                              {label(locale, 'coach')}
                            </dt>
                            <dd>{text(coach.name, locale)}</dd>
                          </div>
                        )}
                      </dl>
                      {text(session.notes, locale) && <p>{text(session.notes, locale)}</p>}
                      <span className="member-small-status">
                        <Check size={14} />
                        {label(locale, session.status)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </article>
          );
        })}
      </div>
      {!selected.length && (
        <Empty
          locale={locale}
          text={say(
            locale,
            classes.length
              ? 'No classes match these filters. Choose another sport or date.'
              : 'No upcoming classes match your membership. Check the full schedule or ask reception.',
            classes.length
              ? 'لا توجد حصص مطابقة. جرّب رياضة أو يوماً آخر.'
              : 'لا توجد حصص قادمة مطابقة لاشتراكك. راجع الجدول الكامل أو تواصل مع الاستقبال.',
          )}
        />
      )}
      {(sportId !== 'all' || date !== 'all') && (
        <button
          className="member-text-button"
          onClick={() => {
            setSportId('all');
            setDate('all');
          }}
        >
          {say(locale, 'Clear filters', 'مسح الفلاتر')}
        </button>
      )}
    </section>
  );
}

export function MemberUpdates({
  locale,
  dashboard,
  reload,
  onSessionExpired,
}: {
  locale: Locale;
  dashboard: MemberDashboard;
  reload: () => void;
  onSessionExpired: () => void;
}) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const action = useMutation(reload);
  useEffect(() => {
    if (action.errorStatus === 401) onSessionExpired();
  }, [action.errorStatus, onSessionExpired]);
  const unread = dashboard.announcements.filter((announcement) => !announcement.read);
  const selected = unreadOnly ? unread : dashboard.announcements;
  async function markRead(ids: string[]) {
    await action.run(() =>
      api<{ ok: boolean }>('/member/announcements/read', jsonRequest('POST', { ids })),
    );
  }
  return (
    <section className="member-panel">
      <div className="member-section-heading">
        <div>
          <h2>{say(locale, 'From your club', 'من ناديك')}</h2>
          <p>
            {say(
              locale,
              'Announcements and updates from Fight Club.',
              'إعلانات ومستجدات فايت كلوب.',
            )}
          </p>
        </div>
        {unread.length > 0 && (
          <button
            disabled={action.pending}
            onClick={() => void markRead(unread.map((announcement) => announcement.id))}
          >
            <Check size={16} />
            {say(locale, 'Mark all as read', 'تحديد الكل كمقروء')}
          </button>
        )}
      </div>
      <div
        className="member-update-filters"
        role="group"
        aria-label={say(locale, 'Filter announcements', 'تصفية الإعلانات')}
      >
        <button aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>
          {say(locale, 'All updates', 'كل المستجدات')}
        </button>
        <button aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>
          {say(locale, 'Unread', 'غير المقروءة')}
          <span>{unread.length}</span>
        </button>
      </div>
      <Feedback action={action} locale={locale} />
      <div className="member-update-list">
        {selected.map((announcement) => (
          <article
            className={`member-update${announcement.read ? ' is-read' : ''}`}
            key={announcement.id}
          >
            <span className="member-update-icon">
              <Bell size={20} />
            </span>
            <div>
              <div className="member-update-meta">
                <time dateTime={announcement.createdAt}>
                  {memberDate(announcement.createdAt, locale)}
                </time>
                {!announcement.read && <span>{say(locale, 'New', 'جديد')}</span>}
              </div>
              <h3>{text(announcement.title, locale)}</h3>
              <p>{text(announcement.body, locale)}</p>
              {!announcement.read && (
                <button
                  className="member-text-button"
                  disabled={action.pending}
                  onClick={() => void markRead([announcement.id])}
                >
                  <Check size={15} />
                  {say(locale, 'Mark as read', 'تحديد كمقروء')}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!selected.length && (
        <div className="member-empty-state">
          <Bell size={30} />
          <h3>
            {say(
              locale,
              unreadOnly ? 'You’re all caught up' : 'No club updates yet',
              unreadOnly ? 'قرأت كل المستجدات' : 'لا توجد مستجدات بعد',
            )}
          </h3>
          <p>
            {say(
              locale,
              unreadOnly
                ? 'There are no unread announcements.'
                : 'New announcements from the club will appear here.',
              unreadOnly ? 'لا توجد إعلانات غير مقروءة.' : 'ستظهر إعلانات النادي الجديدة هنا.',
            )}
          </p>
        </div>
      )}
    </section>
  );
}

export function MemberRenewal({ locale, url }: { locale: Locale; url: string | null }) {
  return (
    <div className="member-renewal">
      {url ? (
        <a className="portal-button primary" href={url} target="_blank" rel="noreferrer">
          <MessageCircle size={18} />
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
      <small>
        {say(
          locale,
          'Staff confirms renewal after payment.',
          'تؤكد الإدارة التجديد بعد إتمام الدفع.',
        )}
      </small>
    </div>
  );
}
