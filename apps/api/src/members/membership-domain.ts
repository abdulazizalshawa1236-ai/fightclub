import type { MembershipStatus } from '@fightclub/shared';
export function todayRiyadh(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function remainingDays(end: string, today: string): number {
  return Math.max(0, Math.round((Date.parse(end) - Date.parse(today)) / 86400000) + 1);
}
export function membershipStatus(
  start: string,
  end: string,
  suspended: boolean,
  warning: number,
  today = todayRiyadh(),
): MembershipStatus {
  if (suspended) return 'suspended';
  if (today < start) return 'upcoming';
  if (today > end) return 'expired';
  return remainingDays(end, today) <= warning ? 'expiring' : 'active';
}
export function renewalDates(
  start: string,
  end: string,
  duration: number,
  today = todayRiyadh(),
): { startDate: string; endDate: string } {
  return end >= today
    ? { startDate: start, endDate: addDays(end, duration) }
    : { startDate: today, endDate: addDays(today, duration - 1) };
}
