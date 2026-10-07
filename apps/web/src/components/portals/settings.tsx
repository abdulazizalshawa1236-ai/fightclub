'use client';
import { useState } from 'react';
import type { ClubSettings, Locale } from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Feedback,
  Field,
  FormButtons,
  LocalizedField,
  PanelTitle,
  jsonRequest,
  label,
  say,
  submit,
  useMutation,
} from './ui';
export function SettingsPanel({
  locale,
  settings,
  reload,
  onCredentialChange,
}: {
  locale: Locale;
  settings: ClubSettings;
  reload: () => void;
  onCredentialChange: () => void;
}) {
  const [form, setForm] = useState(settings);
  const [currentPassword, setCurrentPassword] = useState('');
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const reminderDefaults = {
    expiring: {
      ar: 'اشتراكك على وشك الانتهاء. تواصل معنا للتجديد.',
      en: 'Your membership is ending soon. Contact us to renew.',
    },
    expired: {
      ar: 'انتهى اشتراكك. تواصل معنا لمتابعة تدريبك.',
      en: 'Your membership has expired. Contact us to continue training.',
    },
    renewed: {
      ar: 'تم تجديد اشتراكك. نتطلع لرؤيتك في التدريب.',
      en: 'Your membership has been renewed. See you at training.',
    },
  };
  const action = useMutation(reload);
  const credentials = useMutation();
  const set = <K extends keyof ClubSettings>(key: K, value: ClubSettings[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    await action.run(() => api<ClubSettings>('/admin/settings', jsonRequest('PUT', form)));
  }
  async function changeCredentials() {
    const result = await credentials.run(async () => {
      if (newPassword !== confirmPassword)
        throw new Error(say(locale, 'New passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
      return api<{ username: string }>(
        '/admin/credentials',
        jsonRequest('POST', {
          currentPassword,
          ...(username ? { username } : {}),
          ...(newPassword ? { newPassword } : {}),
        }),
      );
    });
    if (result) onCredentialChange();
  }
  return (
    <>
      <PanelTitle title={label(locale, 'settings')} />
      <section className="portal-editor">
        <h3>{say(locale, 'Club details', 'بيانات النادي')}</h3>
        <form onSubmit={submit(save)}>
          <LocalizedField
            label={label(locale, 'name')}
            value={form.name}
            onChange={(value) => set('name', value)}
          />
          <LocalizedField
            label={say(locale, 'Tagline', 'الشعار النصي')}
            value={form.tagline}
            onChange={(value) => set('tagline', value)}
          />
          <div className="portal-form-grid">
            <Field label={label(locale, 'phone')}>
              <input
                type="tel"
                required
                dir="ltr"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
            <Field label="WhatsApp">
              <input
                type="tel"
                required
                dir="ltr"
                value={form.whatsapp}
                onChange={(e) => set('whatsapp', e.target.value)}
              />
            </Field>
            <Field label={say(locale, 'Email', 'البريد الإلكتروني')}>
              <input
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label={say(locale, 'Map URL', 'رابط الخريطة')}>
              <input
                type="url"
                dir="ltr"
                value={form.mapUrl}
                onChange={(e) => set('mapUrl', e.target.value)}
              />
            </Field>
            <Field label="Instagram">
              <input
                type="url"
                dir="ltr"
                value={form.instagram}
                onChange={(e) => set('instagram', e.target.value)}
              />
            </Field>
            <Field label={say(locale, 'Expiry warning (days)', 'تنبيه انتهاء الاشتراك (أيام)')}>
              <input
                type="number"
                required
                min="0"
                max="90"
                value={form.warningDays}
                onChange={(e) => set('warningDays', Number(e.target.value))}
              />
            </Field>
          </div>
          <LocalizedField
            label={say(locale, 'Address', 'العنوان')}
            value={form.address}
            onChange={(value) => set('address', value)}
          />
          <LocalizedField
            label={say(locale, 'Opening hours', 'ساعات العمل')}
            value={form.hours}
            onChange={(value) => set('hours', value)}
          />
          <fieldset>
            <legend>{say(locale, 'Membership reminder wording', 'صياغة رسائل الاشتراك')}</legend>
            {(['expiring', 'expired', 'renewed'] as const).map((event) => (
              <LocalizedField
                key={event}
                label={say(
                  locale,
                  event === 'renewed'
                    ? 'Renewed'
                    : event === 'expired'
                      ? 'Expired'
                      : 'Expiring soon',
                  event === 'renewed'
                    ? 'تجديد الاشتراك'
                    : event === 'expired'
                      ? 'انتهاء الاشتراك'
                      : 'قرب انتهاء الاشتراك',
                )}
                value={form.notificationText?.[event] ?? reminderDefaults[event]}
                onChange={(value) =>
                  set('notificationText', {
                    ...(form.notificationText ?? reminderDefaults),
                    [event]: value,
                  })
                }
                multiline
              />
            ))}
            <p className="portal-hint">
              {say(
                locale,
                'Wording fills the reminder text parameter in the approved utility template. The template must accept package, end date, and reminder text.',
                'تملأ الصياغة متغير نص التذكير في القالب الخدمي المعتمد. يجب أن يقبل القالب الباقة وتاريخ النهاية ونص التذكير.',
              )}
            </p>
          </fieldset>
          <Feedback action={action} locale={locale} />
          <FormButtons pending={action.pending} locale={locale} />
        </form>
      </section>
      <section className="portal-editor">
        <h3>{say(locale, 'Admin credentials', 'بيانات دخول الإدارة')}</h3>
        <p className="portal-hint">
          {say(
            locale,
            'Your current password is required. All admin sessions end after a credential change.',
            'كلمة المرور الحالية مطلوبة. تنتهي جميع جلسات الإدارة بعد تغيير بيانات الدخول.',
          )}
        </p>
        <form onSubmit={submit(changeCredentials)}>
          <div className="portal-form-grid">
            <Field label={say(locale, 'Current password', 'كلمة المرور الحالية')}>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>
            <Field label={say(locale, 'New username (optional)', 'اسم المستخدم الجديد (اختياري)')}>
              <input
                autoComplete="username"
                minLength={3}
                maxLength={100}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>
            <Field label={say(locale, 'New password (optional)', 'كلمة المرور الجديدة (اختياري)')}>
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </Field>
            <Field label={say(locale, 'Confirm new password', 'تأكيد كلمة المرور الجديدة')}>
              <input
                type="password"
                required={Boolean(newPassword)}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </Field>
          </div>
          <Feedback action={credentials} locale={locale} />
          <FormButtons pending={credentials.pending} locale={locale} />
        </form>
      </section>
    </>
  );
}
