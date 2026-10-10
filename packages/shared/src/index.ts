export type Locale = 'ar' | 'en';
export type Localized = { ar: string; en: string };
export type MembershipStatus = 'active' | 'expiring' | 'expired' | 'upcoming' | 'suspended';
export type Sport = { id: string; name: Localized; description: Localized; available: boolean };
export type Coach = {
  id: string;
  name: Localized;
  bio: Localized;
  image: string;
  sports: string[];
};
export type Plan = {
  id: string;
  name: Localized;
  price: number;
  oldPrice: number | null;
  currency: string;
  durationDays: number;
  durationLabel: Localized;
  sportLimit: number | null;
  benefits: Localized[];
  featured: boolean;
  visible: boolean;
  badge?: Localized;
  position?: number;
};
export type Offer = {
  id: string;
  title: Localized;
  description: Localized;
  badge: Localized;
  terms: Localized;
  startsOn: string;
  endsOn: string;
  visible: boolean;
};
export type ContentBlock = {
  id: string;
  type:
    | 'hero'
    | 'about'
    | 'programs'
    | 'plans'
    | 'offers'
    | 'schedule'
    | 'coaches'
    | 'corporate'
    | 'faq'
    | 'contact'
    | 'gallery';
  title: Localized;
  body: Localized;
  visible: boolean;
  position: number;
  items: { title: Localized; body: Localized; image?: string }[];
};
export type ClubSettings = {
  name: Localized;
  tagline: Localized;
  phone: string;
  whatsapp: string;
  email: string;
  address: Localized;
  hours: Localized;
  mapUrl: string;
  instagram: string;
  warningDays: number;
  metaDescription?: Localized;
  currencyLabel?: Localized;
  countryCode?: string;
  marquee?: Localized;
  weekStart?: number;
  footerText?: Localized;
  socialLinks?: { x: string; snapchat: string; tiktok: string };
  notificationText?: { expiring: Localized; expired: Localized; renewed: Localized };
};
export type PublicSite = {
  settings: ClubSettings;
  plans: Plan[];
  sports: Sport[];
  coaches: Coach[];
  offers: Offer[];
  blocks: ContentBlock[];
  revision: number;
};
export type ClassSession = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  sportId: string;
  title: Localized;
  ageGroup: Localized;
  coachId: string | null;
  room: string;
  notes: Localized;
  status: 'scheduled' | 'cancelled';
};
export type MemberLoginChallenge = {
  challengeId: string;
  maskedPhone: string;
  developmentCode?: string;
  demoCode?: string;
};
export type Consent = { updates: boolean; marketing: boolean };
export type Membership = {
  id: string;
  planId: string;
  planName: Localized;
  price: number | null;
  startDate: string;
  endDate: string;
  sports: string[];
  status: MembershipStatus;
  daysLeft: number;
  version: number;
};
export type Member = {
  id: string;
  fullName: string;
  phone: string;
  nationalIdMasked: string;
  ageGroup: 'adult' | 'child';
  notes: string;
  accessEnabled: boolean;
  verified: boolean;
  preferredLanguage: Locale;
  consent: Consent;
  membership: Membership | null;
  createdAt: string;
};
export type MemberInput = {
  fullName: string;
  nationalId: string;
  phone: string;
  ageGroup: 'adult' | 'child';
  preferredLanguage: Locale;
  planId: string;
  startDate: string;
  endDate?: string;
  sports: string[];
  notes: string;
  accessEnabled?: boolean;
  consent?: Consent;
};
export type Announcement = {
  id: string;
  title: Localized;
  body: Localized;
  createdAt: string;
  read: boolean;
};
export type MemberDashboard = {
  member: Pick<
    Member,
    'id' | 'fullName' | 'phone' | 'preferredLanguage' | 'consent' | 'membership'
  >;
  classes: ClassSession[];
  announcements: Announcement[];
  settings: ClubSettings;
};
export type DashboardStats = {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  upcoming: number;
  suspended: number;
  todayClasses: ClassSession[];
  recentMessages: MessageDelivery[];
};
export type MessageDelivery = {
  id: string;
  memberName: string;
  channel: 'sms' | 'whatsapp' | 'local' | 'demo';
  category: 'authentication' | 'utility' | 'marketing';
  event: string;
  status:
    | 'queued'
    | 'sending'
    | 'accepted'
    | 'delivered'
    | 'read'
    | 'failed'
    | 'suppressed'
    | 'unknown'
    | 'preview';
  error: string | null;
  createdAt: string;
};
export type ApiError = { code: string; message: string };
export function text(value: Localized, locale: Locale): string {
  return value[locale] || value.ar;
}
export function renderMembershipReminder(
  wording: string,
  values: { name: string; club: string; date: string },
): string {
  return wording.replace(
    /\{(name|club|date)\}/g,
    (_, key: 'name' | 'club' | 'date') => values[key],
  );
}
export function whatsappLink(settings: ClubSettings, message: string): string {
  let phone = settings.whatsapp.replace(/\D/g, '');
  if (phone.startsWith('00')) phone = phone.slice(2);
  if (phone.startsWith('0')) phone = '966' + phone.slice(1);
  return /^\d{8,15}$/.test(phone)
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : '';
}
export function planRequest(site: PublicSite, plan: Plan, locale: Locale): string {
  const label = text(plan.name, locale);
  return locale === 'ar'
    ? `مرحباً، أرغب بطلب باقة ${label} من ${site.settings.name.ar}.\nالسعر: ${plan.price} ${plan.currency}\nالمدة: ${text(plan.durationLabel, locale)} (${plan.durationDays} يوماً)\nالاسم الكامل:\nطفل أم بالغ:\nالرياضة المطلوبة:\nالأوقات المفضلة:\nأرجو تأكيد التوفر وإجراءات الدفع.`
    : `Hello, I would like to request ${label} at ${site.settings.name.en}.\nPrice: ${plan.price} ${plan.currency}\nDuration: ${text(plan.durationLabel, locale)} (${plan.durationDays} days)\nFull name:\nChild or adult:\nRequested sport:\nPreferred times:\nPlease confirm availability and payment instructions.`;
}

export { seedSite } from './seed';
