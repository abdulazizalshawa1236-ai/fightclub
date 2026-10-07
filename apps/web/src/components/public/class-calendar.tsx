'use client';

import { useEffect, useId, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronLeft, ChevronRight, RefreshCw, Clock } from 'lucide-react';
import { text, type ClassSession, type Locale, type PublicSite } from '@fightclub/shared';
import { selectChoice } from './selection-keyboard';

type ScheduleState = { status: 'loading' | 'ready' | 'error'; classes: ClassSession[] };
function moveMonth(month: string, direction: number): string {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + direction);
  return date.toISOString().slice(0, 7);
}
export function ClassCalendar({
  site,
  locale,
  today,
}: {
  site: PublicSite;
  locale: Locale;
  today: string;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [retry, setRetry] = useState(0);
  const [schedule, setSchedule] = useState<ScheduleState>({ status: 'loading', classes: [] });
  const ar = locale === 'ar';
  const weekStart = site.settings.weekStart ?? 0;
  const reduced = useReducedMotion();
  const selectionId = useId();
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setSchedule({ status: 'loading', classes: [] });
      try {
        const response = await fetch(`/api/public/schedule?month=${month}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (!response.ok) throw new Error('Schedule unavailable');
        const result: { classes: ClassSession[] } = await response.json();
        if (!Array.isArray(result.classes)) throw new Error('Invalid schedule');
        if (!controller.signal.aborted) setSchedule({ status: 'ready', classes: result.classes });
      } catch {
        if (!controller.signal.aborted) setSchedule({ status: 'error', classes: [] });
      }
    }
    void load();
    return () => controller.abort();
  }, [month, retry]);
  function navigate(direction: number) {
    const next = moveMonth(month, direction);
    setMonth(next);
    setSelected(`${next}-01`);
  }
  const first = new Date(`${month}-01T12:00:00Z`);
  const days = new Date(first.getUTCFullYear(), first.getUTCMonth() + 1, 0).getDate();
  const monthTitle = new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(first);
  const classes = schedule.classes
    .filter((session) => session.date === selected)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const monthDates = Array.from(
    { length: days },
    (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`,
  );
  return (
    <div className="fc-calendar-layout">
      <div className="fc-calendar">
        <div className="fc-calendar-toolbar">
          <h3>{monthTitle}</h3>
          <div>
            <button
              aria-label={ar ? 'الشهر السابق' : 'Previous month'}
              onClick={() => navigate(-1)}
            >
              {ar ? <ChevronRight /> : <ChevronLeft />}
            </button>
            <button aria-label={ar ? 'الشهر التالي' : 'Next month'} onClick={() => navigate(1)}>
              {ar ? <ChevronLeft /> : <ChevronRight />}
            </button>
          </div>
        </div>
        <div className="fc-weekdays">
          {Array.from({ length: 7 }, (_, day) => (
            <span key={day}>
              {new Intl.DateTimeFormat(ar ? 'ar-SA' : 'en-GB', {
                weekday: 'short',
                timeZone: 'UTC',
              }).format(new Date(Date.UTC(2026, 0, 4 + weekStart + day)))}
            </span>
          ))}
        </div>
        <div
          className="fc-days"
          onKeyDown={(event) => selectChoice(event, monthDates, selected, setSelected, ar, 7)}
        >
          {Array.from({ length: (first.getUTCDay() - weekStart + 7) % 7 }, (_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {Array.from({ length: days }, (_, index) => {
            const date = `${month}-${String(index + 1).padStart(2, '0')}`;
            const hasClass = schedule.classes.some(
              (session) => session.date === date && session.status === 'scheduled',
            );
            return (
              <button
                key={date}
                aria-label={new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory' : 'en-GB', {
                  dateStyle: 'full',
                  timeZone: 'UTC',
                }).format(new Date(`${date}T12:00:00Z`))}
                aria-pressed={date === selected}
                className={date === today ? 'fc-today' : ''}
                onClick={() => setSelected(date)}
              >
                {date === selected && (
                  <motion.span
                    className="fc-day-highlight"
                    layoutId={reduced ? undefined : `${selectionId}-day`}
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    aria-hidden="true"
                  />
                )}
                <span className="fc-day-number">
                  {new Intl.NumberFormat(locale).format(index + 1)}
                </span>
                {hasClass && <i aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <p className="fc-calendar-key">
          <i />
          {ar
            ? 'توجد حصص في هذا اليوم. التوقيت بتوقيت الرياض.'
            : 'Classes on this day. All times are Riyadh time.'}
        </p>
      </div>
      <div className="fc-day-detail" aria-live="polite" aria-busy={schedule.status === 'loading'}>
        <motion.div
          key={`${selected}-${schedule.status}`}
          initial={reduced ? false : { opacity: 0.65, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <h3>
            {new Intl.DateTimeFormat(ar ? 'ar-SA-u-ca-gregory' : 'en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              timeZone: 'UTC',
            }).format(new Date(`${selected}T12:00:00Z`))}
          </h3>
          {schedule.status === 'loading' && (
            <p className="fc-empty">{ar ? 'جارٍ تحميل الحصص…' : 'Loading classes…'}</p>
          )}
          {schedule.status === 'error' && (
            <div className="fc-empty">
              <p>
                {ar
                  ? 'تعذر تحميل الجدول. أعد المحاولة أو تواصل مع النادي لتأكيد المواعيد.'
                  : 'The schedule could not be loaded. Retry or contact the club to confirm class times.'}
              </p>
              <button
                className="fc-button fc-button-light"
                onClick={() => setRetry((value) => value + 1)}
              >
                <RefreshCw size={17} />
                {ar ? 'إعادة المحاولة' : 'Retry'}
              </button>
            </div>
          )}
          {schedule.status === 'ready' && classes.length === 0 && (
            <p className="fc-empty">
              {ar
                ? 'لا توجد حصص منشورة لهذا اليوم.'
                : 'No classes have been published for this day.'}
            </p>
          )}
          {schedule.status === 'ready' &&
            classes.map((session) => (
              <article
                className={`fc-class ${session.status === 'cancelled' ? 'fc-class-cancelled' : ''}`}
                key={session.id}
              >
                <div className="fc-class-time">
                  <Clock size={16} />
                  <bdi>
                    {session.startTime} / {session.endTime}
                  </bdi>
                </div>
                <h4>{text(session.title, locale)}</h4>
                <p>
                  {text(session.ageGroup, locale)}
                  {session.room ? ` · ${session.room}` : ''}
                </p>
                {session.coachId && (
                  <p>
                    {text(
                      site.coaches.find((coach) => coach.id === session.coachId)?.name ?? {
                        ar: 'المدرب سيحدد لاحقاً',
                        en: 'Coach to be confirmed',
                      },
                      locale,
                    )}
                  </p>
                )}
                {text(session.notes, locale) && <p>{text(session.notes, locale)}</p>}
                {session.status === 'cancelled' && (
                  <strong>{ar ? 'الحصة ملغاة' : 'Class cancelled'}</strong>
                )}
              </article>
            ))}
        </motion.div>
      </div>
    </div>
  );
}
