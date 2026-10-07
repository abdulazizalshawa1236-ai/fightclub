'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Locale, Localized } from '@fightclub/shared';
import { api, ApiFailure } from '@/lib/api';

export type Dictionary = Record<string, readonly [string, string]>;
const words: Dictionary = {
  authentication: ['Login verification', 'رموز الدخول'],
  utility: ['Membership messages', 'رسائل الاشتراك'],
  queued: ['Queued', 'في قائمة الإرسال'],
  sending: ['Sending', 'جارٍ الإرسال'],
  accepted: ['Accepted by Meta', 'قبلتها Meta'],
  delivered: ['Delivered', 'تم التسليم'],
  read: ['Read', 'مقروءة'],
  failed: ['Failed', 'فشلت'],
  suppressed: ['Suppressed', 'تم منع الإرسال'],
  unknown: ['Unconfirmed', 'غير مؤكدة'],
  renewed: ['Renewed', 'تم التجديد'],
  login_code: ['Login code', 'رمز الدخول'],
  offer: ['Offer', 'عرض'],

  dashboard: ['Overview', 'نظرة عامة'],
  members: ['Members', 'الأعضاء'],
  plans: ['Plans', 'الباقات'],
  offers: ['Offers', 'العروض'],
  coaches: ['Coaches', 'المدربون'],
  content: ['Website content', 'محتوى الموقع'],
  schedule: ['Schedule', 'الجدول'],
  messages: ['Communications', 'التواصل'],
  settings: ['Settings', 'الإعدادات'],
  logout: ['Sign out', 'تسجيل الخروج'],
  save: ['Save changes', 'حفظ التغييرات'],
  cancel: ['Cancel', 'إلغاء'],
  edit: ['Edit', 'تعديل'],
  add: ['Add', 'إضافة'],
  remove: ['Remove', 'حذف'],
  loading: ['Loading…', 'جارٍ التحميل…'],
  retry: ['Try again', 'إعادة المحاولة'],
  empty: ['No records to show.', 'لا توجد سجلات للعرض.'],
  name: ['Name', 'الاسم'],
  phone: ['Mobile number', 'رقم الجوال'],
  notes: ['Internal notes', 'ملاحظات داخلية'],
  sports: ['Sports', 'الرياضات'],
  plan: ['Package', 'الباقة'],
  start: ['Start date', 'تاريخ البداية'],
  end: ['End date', 'تاريخ النهاية'],
  adult: ['Adult', 'بالغ'],
  child: ['Child', 'طفل'],
  language: ['Language', 'اللغة'],
  age: ['Age group', 'الفئة العمرية'],
  nationalId: ['National ID / Iqama', 'الهوية الوطنية / الإقامة'],
  username: ['Username', 'اسم المستخدم'],
  password: ['Password', 'كلمة المرور'],
  signin: ['Sign in', 'تسجيل الدخول'],
  renew: ['Renew membership', 'تجديد الاشتراك'],
  suspend: ['Suspend membership', 'إيقاف الاشتراك'],
  reactivate: ['Reactivate membership', 'إعادة تفعيل الاشتراك'],
  archive: ['Archive member', 'أرشفة العضو'],
  export: ['Export CSV', 'تصدير CSV'],
  search: ['Search name, ID, or phone', 'بحث بالاسم أو الهوية أو الجوال'],
  all: ['All statuses', 'كل الحالات'],
  active: ['Active', 'نشط'],
  expiring: ['Expiring soon', 'ينتهي قريباً'],
  expired: ['Expired', 'منتهي'],
  upcoming: ['Upcoming', 'قادم'],
  suspended: ['Suspended', 'موقوف'],
  previous: ['Previous', 'السابق'],
  next: ['Next', 'التالي'],
  title: ['Title', 'العنوان'],
  body: ['Description', 'الوصف'],
  visible: ['Visible on website', 'ظاهر في الموقع'],
  price: ['Price (SAR)', 'السعر (ر.س)'],
  duration: ['Duration in days', 'المدة بالأيام'],
  image: ['Photo URL', 'رابط الصورة'],
  upload: ['Upload photo', 'رفع صورة'],
  total: ['Total members', 'إجمالي الأعضاء'],
  today: ['Today’s classes', 'حصص اليوم'],
  recent: ['Recent messages', 'الرسائل الأخيرة'],
  saved: ['Changes saved.', 'تم حفظ التغييرات.'],
  history: ['Audit history', 'سجل التغييرات'],
  error: ['Could not complete this request. Try again.', 'تعذر إتمام الطلب. حاول مرة أخرى.'],
  none: ['None', 'لا يوجد'],
  status: ['Status', 'الحالة'],
  scheduled: ['Scheduled', 'مجدولة'],
  cancelled: ['Cancelled', 'ملغاة'],
  time: ['Time', 'الوقت'],
  sport: ['Sport', 'الرياضة'],
  coach: ['Coach', 'المدرب'],
  room: ['Room', 'القاعة'],
  date: ['Date', 'التاريخ'],
  month: ['Month', 'الشهر'],
  confirm: ['Confirm', 'تأكيد'],
  close: ['Close', 'إغلاق'],
  updates: ['Membership updates', 'تحديثات الاشتراك'],
  marketing: ['Marketing offers', 'العروض التسويقية'],
  enabled: ['Portal access enabled', 'دخول بوابة العضو مفعّل'],
  verified: ['Phone verified', 'الجوال موثّق'],
  unverified: ['Phone not verified', 'الجوال غير موثّق'],
  announcements: ['Announcements', 'الإعلانات'],
  daysLeft: ['Days remaining', 'الأيام المتبقية'],
};
export function label(locale: Locale, key: string): string {
  return words[key]?.[locale === 'ar' ? 1 : 0] ?? key;
}
export function say(locale: Locale, en: string, ar: string): string {
  return locale === 'ar' ? ar : en;
}
export function jsonRequest(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  };
}
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not complete this request.';
}

type FailureDetails = { error: string; errorCode?: string | null; errorStatus?: number | null };
const arabicErrors = {
  INVALID_INPUT: 'راجع البيانات المدخلة وأكمل الحقول المطلوبة ثم حاول مرة أخرى.',
  DUPLICATE_RECORD: 'يوجد سجل بهذه البيانات بالفعل. راجع الهوية ورقم الجوال قبل الحفظ.',
  INVALID_CREDENTIALS: 'اسم المستخدم أو كلمة المرور غير صحيحين.',
  INVALID_PASSWORD: 'كلمة المرور الحالية غير صحيحة.',
  INVALID_CODE: 'رمز التحقق غير صحيح أو انتهت صلاحيته. اطلب رمزاً جديداً وحاول مرة أخرى.',
  SESSION_REQUIRED: 'سجّل الدخول للمتابعة.',
  SESSION_EXPIRED: 'انتهت جلسة الدخول. سجّل الدخول مجدداً للمتابعة.',
  WHATSAPP_UNAVAILABLE: 'إرسال رسائل واتساب غير متاح حالياً. تواصل مع إدارة النادي أو حاول لاحقاً.',
  WHATSAPP_DELIVERY_FAILED:
    'تعذر إرسال رمز الدخول عبر واتساب. حاول لاحقاً أو تواصل مع إدارة النادي.',
  ORIGIN_REJECTED: 'تعذر إرسال الطلب من هذا الموقع. افتح الموقع الرسمي للنادي وسجّل الدخول مجدداً.',
  NETWORK_UNAVAILABLE: 'تعذر الاتصال بالخدمة. تحقق من اتصال الإنترنت ثم حاول مرة أخرى.',
  REQUEST_TIMEOUT: 'استغرق الاتصال وقتاً أطول من المتوقع. حاول مرة أخرى.',
  RATE_LIMITED: 'تجاوزت عدد المحاولات المسموح. انتظر قليلاً ثم حاول مرة أخرى.',
  MEMBERSHIP_CHANGED: 'تم تعديل الاشتراك أثناء عملك. حدّث البيانات قبل الحفظ أو التجديد.',
  CONTENT_CHANGED: 'عدّل موظف آخر المحتوى. حدّث الصفحة قبل حفظ المسودة أو نشرها.',
  IDEMPOTENCY_CONFLICT:
    'تم إرسال هذه العملية مسبقاً ببيانات مختلفة. حدّث سجل العضو وتحقق من آخر تجديد قبل المتابعة.',
  MEMBERSHIP_SUSPENDED: 'الاشتراك موقوف. أعد تفعيله قبل التجديد.',
  PLAN_UNAVAILABLE: 'هذه الباقة لم تعد متاحة. حدّث القائمة واختر باقة أخرى.',
  INVALID_SPORTS: 'راجع الرياضات المختارة وعدد الرياضات المسموح في الباقة.',
  SPORT_UNAVAILABLE: 'إحدى الرياضات المختارة غير متاحة. حدّث القائمة واختر رياضة متاحة.',
  SPORT_NOT_FOUND: 'الرياضة المطلوبة غير موجودة. حدّث البيانات وحاول مرة أخرى.',
  MEMBER_NOT_FOUND:
    'لا يوجد عضو بهذه البيانات أو لا يمكنه الدخول. راجع البيانات المسجلة لدى إدارة النادي.',
  RECORD_NOT_FOUND: 'السجل المطلوب غير موجود. حدّث القائمة وحاول مرة أخرى.',
  REVISION_NOT_FOUND: 'إصدار المحتوى المطلوب غير موجود. حدّث سجل الإصدارات وحاول مرة أخرى.',
  SCHEDULE_CONFLICT:
    'توجد حصة أخرى للمدرب أو القاعة في هذا الوقت. راجع التعارضات قبل الحفظ أو النسخ.',
  SITE_NOT_INITIALIZED: 'لم تكتمل تهيئة بيانات النادي بعد. تواصل مع إدارة النادي.',
  SERVICE_UNAVAILABLE:
    'الخدمة غير متاحة مؤقتاً. حاول لاحقاً. إذا استمرت المشكلة فتواصل مع إدارة النادي.',
};
const errorsByCode: Partial<Record<string, string>> = arabicErrors;
function failureDetails(cause: unknown): FailureDetails {
  return {
    error: errorMessage(cause),
    errorCode: cause instanceof ApiFailure ? cause.code : null,
    errorStatus: cause instanceof ApiFailure ? cause.status : null,
  };
}
function translatedError(locale: Locale, failure: FailureDetails): string {
  if (locale === 'en') return failure.error;
  const known = failure.errorCode ? errorsByCode[failure.errorCode] : undefined;
  if (known) return known;
  if (/[\u0600-\u06ff]/.test(failure.error)) return failure.error;
  const status = failure.errorStatus;
  if (status === 0) return arabicErrors.NETWORK_UNAVAILABLE;
  if (status === 401) return arabicErrors.SESSION_EXPIRED;
  if (status === 403) return 'لا تملك صلاحية تنفيذ هذا الطلب. تواصل مع إدارة النادي.';
  if (status === 404) return arabicErrors.RECORD_NOT_FOUND;
  if (status === 400 || status === 422) return arabicErrors.INVALID_INPUT;
  if (status === 409)
    return 'تعارض الطلب مع البيانات الحالية. حدّث البيانات وراجع آخر التغييرات قبل المتابعة.';
  if (status === 429) return arabicErrors.RATE_LIMITED;
  if (status !== null && status !== undefined && status >= 500)
    return arabicErrors.SERVICE_UNAVAILABLE;
  return label(locale, 'error');
}

export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string>('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setErrorStatus(null);
    setErrorCode(null);
    const timeout = setTimeout(() => controller.abort('timeout'), 10000);
    api<T>(path, { signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((cause: unknown) => {
        if (controller.signal.reason === 'timeout') {
          setData(null);
          setError('Connection timed out. Please try again.');
          setErrorStatus(0);
          setErrorCode('REQUEST_TIMEOUT');
          setLoading(false);
        } else if (!controller.signal.aborted) {
          setData(null);
          const failure = failureDetails(cause);
          setError(failure.error);
          setErrorStatus(failure.errorStatus ?? null);
          setErrorCode(failure.errorCode ?? null);
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [path, revision]);
  return { data, error, errorCode, errorStatus, loading, reload };
}
export function useMutation(onSuccess?: () => void) {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  async function run<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    setError('');
    setErrorCode(null);
    setErrorStatus(null);
    setSuccess(false);
    try {
      const result = await task();
      setSuccess(true);
      onSuccess?.();
      return result;
    } catch (cause: unknown) {
      const failure = failureDetails(cause);
      setError(failure.error);
      setErrorCode(failure.errorCode ?? null);
      setErrorStatus(failure.errorStatus ?? null);
      return undefined;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  return {
    pending,
    error,
    errorCode,
    errorStatus,
    success,
    run,
    clear: () => {
      setError('');
      setErrorCode(null);
      setErrorStatus(null);
      setSuccess(false);
    },
  };
}
export function ResourceState({
  resource,
  locale,
  children,
}: {
  resource: FailureDetails & { loading: boolean; reload: () => void; data: unknown };
  locale: Locale;
  children: ReactNode;
}) {
  if (resource.loading && !resource.data)
    return (
      <p className="portal-empty" role="status">
        {label(locale, 'loading')}
      </p>
    );
  if (resource.error)
    return (
      <div className="portal-alert error" role="alert">
        <p>{translatedError(locale, resource)}</p>
        <button onClick={resource.reload}>{label(locale, 'retry')}</button>
      </div>
    );
  return <>{children}</>;
}
export function Feedback({
  action,
  locale,
}: {
  action: FailureDetails & { pending: boolean; success: boolean };
  locale: Locale;
}) {
  return (
    <div aria-live="polite">
      {action.error && (
        <p className="portal-alert error" role="alert">
          {translatedError(locale, action)}
        </p>
      )}
      {action.success && <p className="portal-alert success">{label(locale, 'saved')}</p>}
    </div>
  );
}
export function Field({
  label: caption,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="portal-field">
      <span>{caption}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Toggle({
  label: caption,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="portal-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{caption}</span>
    </label>
  );
}
export function LocalizedField({
  label: caption,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: Localized;
  onChange: (value: Localized) => void;
  multiline?: boolean;
}) {
  return (
    <fieldset className="portal-bilingual">
      <legend>{caption}</legend>
      {(['ar', 'en'] as const).map((language) => (
        <Field key={language} label={language === 'ar' ? 'العربية' : 'English'}>
          {multiline ? (
            <textarea
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              value={value[language]}
              onChange={(e) => onChange({ ...value, [language]: e.target.value })}
            />
          ) : (
            <input
              dir={language === 'ar' ? 'rtl' : 'ltr'}
              value={value[language]}
              onChange={(e) => onChange({ ...value, [language]: e.target.value })}
            />
          )}
        </Field>
      ))}
    </fieldset>
  );
}
export function FormButtons({
  pending,
  locale,
  onCancel,
}: {
  pending: boolean;
  locale: Locale;
  onCancel?: () => void;
}) {
  return (
    <div className="portal-actions">
      <button className="primary" type="submit" disabled={pending}>
        {label(locale, pending ? 'loading' : 'save')}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          {label(locale, 'cancel')}
        </button>
      )}
    </div>
  );
}
export function Status({ status, locale }: { status: string; locale: Locale }) {
  return <span className={`portal-status status-${status}`}>{label(locale, status)}</span>;
}
export function PanelTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="portal-panel-title">
      <h2>{title}</h2>
      <div className="portal-actions">{children}</div>
    </div>
  );
}
export function Empty({ locale, text }: { locale: Locale; text?: string }) {
  return <p className="portal-empty">{text || label(locale, 'empty')}</p>;
}
export function dateToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}
export function submit(handler: () => Promise<unknown>) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handler();
  };
}
export const blankLocalized: Localized = { ar: '', en: '' };
