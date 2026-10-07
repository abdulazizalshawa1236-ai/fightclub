'use client';
import { useState } from 'react';
import type { Locale, Localized, MessageDelivery } from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Empty,
  Feedback,
  Field,
  LocalizedField,
  PanelTitle,
  ResourceState,
  Toggle,
  blankLocalized,
  jsonRequest,
  label,
  say,
  useMutation,
  useResource,
} from './ui';
export function DeliveryTable({
  messages,
  locale,
}: {
  messages: MessageDelivery[];
  locale: Locale;
}) {
  return messages.length ? (
    <div className="portal-table-scroll">
      <table className="portal-table">
        <thead>
          <tr>
            <th>{label(locale, 'name')}</th>
            <th>{say(locale, 'Category / event', 'الفئة / الحدث')}</th>
            <th>{label(locale, 'status')}</th>
            <th>{label(locale, 'date')}</th>
          </tr>
        </thead>
        <tbody>
          {messages.map((message) => (
            <tr key={message.id}>
              <td>{message.memberName}</td>
              <td>
                {label(locale, message.category)}
                <small>{label(locale, message.event)}</small>
              </td>
              <td>
                <span className={`portal-status delivery-${label(locale, message.status)}`}>
                  {label(locale, message.status)}
                </span>
                {message.error && <small className="portal-error-text">{message.error}</small>}
              </td>
              <td>{new Date(message.createdAt).toLocaleString(locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty locale={locale} />
  );
}
export function MessagesPanel({ locale }: { locale: Locale }) {
  const resource = useResource<{
    messages: MessageDelivery[];
    configured: { authentication: boolean; utility: boolean; marketing: boolean };
  }>('/admin/messages');
  const [title, setTitle] = useState<Localized>({ ...blankLocalized });
  const [body, setBody] = useState<Localized>({ ...blankLocalized });
  const [target, setTarget] = useState('all');
  const [memberId, setMemberId] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [result, setResult] = useState<{ id: string; recipients: number } | null>(null);
  const action = useMutation(() => {
    resource.reload();
    setConfirmation(false);
  });
  async function send() {
    const response = await action.run(() =>
      api<{ id: string; recipients: number }>(
        '/admin/announcements',
        jsonRequest('POST', {
          title,
          body,
          target,
          ...(target === 'member' ? { memberId } : {}),
          sendWhatsapp,
        }),
      ),
    );
    if (response) {
      setResult(response);
      setTitle({ ...blankLocalized });
      setBody({ ...blankLocalized });
    }
  }
  return (
    <>
      <PanelTitle title={label(locale, 'messages')}>
        <button onClick={resource.reload}>
          {say(locale, 'Refresh delivery', 'تحديث حالات الإرسال')}
        </button>
      </PanelTitle>
      <ResourceState resource={resource} locale={locale}>
        <div className="portal-provider-status">
          {resource.data &&
            Object.entries(resource.data.configured).map(([category, configured]) => (
              <div key={category}>
                <strong>{label(locale, category)}</strong>
                <span
                  className={`portal-status ${configured ? 'status-active' : 'status-expired'}`}
                >
                  {say(
                    locale,
                    configured ? 'Template configured' : 'Template unavailable',
                    configured ? 'القالب مهيأ' : 'القالب غير متاح',
                  )}
                </span>
              </div>
            ))}
        </div>
      </ResourceState>
      <p className="portal-hint">
        {say(
          locale,
          'WhatsApp automation uses approved Meta templates and recorded consent. Accepted means Meta accepted the message, not that the member received it.',
          'تستخدم رسائل واتساب الآلية قوالب Meta المعتمدة والموافقات المسجلة. حالة accepted تعني قبول Meta للرسالة وليس استلام العضو لها.',
        )}
      </p>
      <section className="portal-editor">
        <h3>{say(locale, 'Create announcement', 'إضافة إعلان')}</h3>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setConfirmation(true);
          }}
        >
          <LocalizedField label={label(locale, 'title')} value={title} onChange={setTitle} />
          <LocalizedField label={label(locale, 'body')} value={body} onChange={setBody} multiline />
          <div className="portal-form-grid">
            <Field label={say(locale, 'Audience', 'الجمهور')}>
              <select
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value);
                  setSendWhatsapp(false);
                }}
              >
                <option value="all">{say(locale, 'All members', 'كل الأعضاء')}</option>
                <option value="active">{say(locale, 'Active members', 'الأعضاء النشطون')}</option>
                <option value="marketing">
                  {say(locale, 'Marketing opted-in members', 'الأعضاء الموافقون على التسويق')}
                </option>
                <option value="member">{say(locale, 'One member', 'عضو واحد')}</option>
              </select>
            </Field>
            {target === 'member' && (
              <Field label={say(locale, 'Member record ID', 'معرّف سجل العضو')}>
                <input required value={memberId} onChange={(e) => setMemberId(e.target.value)} />
              </Field>
            )}
          </div>
          <Toggle
            label={say(
              locale,
              'Also send an approved marketing WhatsApp template',
              'إرسال قالب تسويقي معتمد عبر واتساب أيضاً',
            )}
            checked={sendWhatsapp}
            onChange={(value) => {
              setSendWhatsapp(value);
              if (value) setTarget('marketing');
            }}
          />
          <p className="portal-hint">
            {say(
              locale,
              'The announcement appears in the member portal. WhatsApp delivery includes only members with marketing consent, regardless of selected audience.',
              'يظهر الإعلان في بوابة العضو. تقتصر رسائل واتساب على الأعضاء الموافقين على التسويق، مهما كان الجمهور المحدد.',
            )}
          </p>
          <button className="primary" type="submit" disabled={action.pending}>
            {say(locale, 'Review announcement', 'مراجعة الإعلان')}
          </button>
        </form>
        {confirmation && (
          <div className="portal-alert">
            <h3>{say(locale, 'Confirm publication', 'تأكيد النشر')}</h3>
            <p>{title[locale]}</p>
            <p>{body[locale]}</p>
            <p>
              {say(
                locale,
                sendWhatsapp
                  ? 'Publish in portal and queue consent-eligible WhatsApp recipients.'
                  : 'Publish in member portal only.',
                sendWhatsapp
                  ? 'نشر في البوابة وإضافة رسائل واتساب للموافقين إلى قائمة الإرسال.'
                  : 'نشر في بوابة الأعضاء فقط.',
              )}
            </p>
            <div className="portal-actions">
              <button className="primary" disabled={action.pending} onClick={() => void send()}>
                {say(locale, 'Publish announcement', 'نشر الإعلان')}
              </button>
              <button onClick={() => setConfirmation(false)}>{label(locale, 'cancel')}</button>
            </div>
          </div>
        )}
        <Feedback action={action} locale={locale} />
        {result && (
          <p role="status">
            {say(locale, 'WhatsApp messages queued', 'رسائل واتساب في قائمة الإرسال')}:{' '}
            {result.recipients}
          </p>
        )}
      </section>
      <h3>{say(locale, 'Delivery log', 'سجل الإرسال')}</h3>
      <ResourceState resource={resource} locale={locale}>
        {resource.data && <DeliveryTable locale={locale} messages={resource.data.messages} />}
      </ResourceState>
    </>
  );
}
