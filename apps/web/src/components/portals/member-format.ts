import type { Locale } from '@fightclub/shared';

export function memberDate(value: string, locale: Locale, compact = false): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    calendar: 'gregory',
    timeZone: 'Asia/Riyadh',
    day: 'numeric',
    month: compact ? 'short' : 'long',
    ...(compact ? {} : { year: 'numeric' }),
  }).format(new Date(value.length === 10 ? `${value}T12:00:00+03:00` : value));
}

export function memberWeekday(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    calendar: 'gregory',
    timeZone: 'Asia/Riyadh',
    weekday: 'long',
  }).format(new Date(`${value}T12:00:00+03:00`));
}

export function memberTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-GB', {
    timeZone: 'Asia/Riyadh',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(`2026-01-01T${value.slice(0, 5)}:00+03:00`));
}
