'use client';
import { useState } from 'react';
import { text, type ClassSession, type Locale, type PublicSite } from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Empty,
  Feedback,
  Field,
  FormButtons,
  LocalizedField,
  PanelTitle,
  ResourceState,
  Status,
  blankLocalized,
  dateToday,
  jsonRequest,
  label,
  say,
  submit,
  useMutation,
  useResource,
} from './ui';
type CopyResult = {
  classes: ClassSession[];
  created: number;
  skipped: number;
  conflicts: string[];
};
function ClassEditor({
  record,
  site,
  locale,
  onSaved,
  onCancel,
}: {
  record?: ClassSession;
  site: PublicSite;
  locale: Locale;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<ClassSession, 'id'>>(() =>
    record
      ? {
          date: record.date,
          startTime: record.startTime,
          endTime: record.endTime,
          sportId: record.sportId,
          title: record.title,
          ageGroup: record.ageGroup,
          coachId: record.coachId,
          room: record.room,
          notes: record.notes,
          status: record.status,
        }
      : {
          date: dateToday(),
          startTime: '',
          endTime: '',
          sportId: '',
          title: { ...blankLocalized },
          ageGroup: { ...blankLocalized },
          coachId: null,
          room: '',
          notes: { ...blankLocalized },
          status: 'scheduled',
        },
  );
  const action = useMutation(onSaved);
  const set = <K extends keyof Omit<ClassSession, 'id'>>(
    key: K,
    value: Omit<ClassSession, 'id'>[K],
  ) => setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    await action.run(() =>
      api<ClassSession>(
        record ? `/admin/classes/${record.id}` : '/admin/classes',
        jsonRequest(record ? 'PUT' : 'POST', form),
      ),
    );
  }
  return (
    <section className="portal-editor">
      <form onSubmit={submit(save)}>
        <LocalizedField
          label={label(locale, 'title')}
          value={form.title}
          onChange={(value) => set('title', value)}
        />
        <div className="portal-form-grid">
          <Field label={label(locale, 'date')}>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </Field>
          <Field label={label(locale, 'sport')}>
            <select required value={form.sportId} onChange={(e) => set('sportId', e.target.value)}>
              <option value="">{label(locale, 'sport')}</option>
              {site.sports.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {text(sport.name, locale)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={say(locale, 'Start time (Riyadh)', 'وقت البداية (الرياض)')}>
            <input
              type="time"
              required
              value={form.startTime}
              onChange={(e) => set('startTime', e.target.value)}
            />
          </Field>
          <Field label={say(locale, 'End time (Riyadh)', 'وقت النهاية (الرياض)')}>
            <input
              type="time"
              required
              min={form.startTime}
              value={form.endTime}
              onChange={(e) => set('endTime', e.target.value)}
            />
          </Field>
          <Field label={label(locale, 'coach')}>
            <select
              value={form.coachId ?? ''}
              onChange={(e) => set('coachId', e.target.value || null)}
            >
              <option value="">{label(locale, 'none')}</option>
              {site.coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {text(coach.name, locale)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={label(locale, 'room')}>
            <input required value={form.room} onChange={(e) => set('room', e.target.value)} />
          </Field>
        </div>
        <LocalizedField
          label={label(locale, 'age')}
          value={form.ageGroup}
          onChange={(value) => set('ageGroup', value)}
        />
        <LocalizedField
          label={say(locale, 'Class notes', 'ملاحظات الحصة')}
          value={form.notes}
          onChange={(value) => set('notes', value)}
          multiline
        />
        <Field label={label(locale, 'status')}>
          <select
            value={form.status}
            onChange={(e) =>
              set('status', e.target.value === 'cancelled' ? 'cancelled' : 'scheduled')
            }
          >
            <option value="scheduled">{say(locale, 'Scheduled', 'مجدولة')}</option>
            <option value="cancelled">{say(locale, 'Cancelled', 'ملغاة')}</option>
          </select>
        </Field>
        <Feedback action={action} locale={locale} />
        <FormButtons pending={action.pending} locale={locale} onCancel={onCancel} />
      </form>
    </section>
  );
}
export function SchedulePanel({ locale, site }: { locale: Locale; site: PublicSite }) {
  const [month, setMonth] = useState(() => dateToday().slice(0, 7));
  const [editing, setEditing] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<ClassSession | null>(null);
  const [copying, setCopying] = useState(false);
  const [toMonth, setToMonth] = useState('');
  const [copyPreview, setCopyPreview] = useState<CopyResult | null>(null);
  const [copyKey, setCopyKey] = useState(() => crypto.randomUUID());
  const resource = useResource<{ classes: ClassSession[] }>(`/admin/classes?month=${month}`);
  const action = useMutation();
  const record = resource.data?.classes.find((item) => item.id === editing);
  const saved = () => {
    setEditing(null);
    resource.reload();
  };
  async function cancel() {
    if (!cancelling) return;
    const result = await action.run(() =>
      api<{ cancelled: true }>(`/admin/classes/${cancelling.id}`, jsonRequest('DELETE')),
    );
    if (result) {
      setCancelling(null);
      resource.reload();
    }
  }
  async function copy(preview: boolean) {
    const result = await action.run(() =>
      api<CopyResult>(
        '/admin/classes/copy',
        jsonRequest('POST', { from: month, to: toMonth, preview, idempotencyKey: copyKey }),
      ),
    );
    if (result) {
      setCopyPreview(result);
      if (!preview) {
        resource.reload();
        setCopyKey(crypto.randomUUID());
        setCopying(false);
      }
    }
  }
  return (
    <>
      <PanelTitle title={label(locale, 'schedule')}>
        <button
          onClick={() => {
            setCopying((value) => !value);
            setCopyPreview(null);
            action.clear();
          }}
        >
          {say(locale, 'Copy month', 'نسخ شهر')}
        </button>
        <button className="primary" onClick={() => setEditing('new')}>
          {say(locale, 'Add class', 'إضافة حصة')}
        </button>
      </PanelTitle>
      <Field label={label(locale, 'month')}>
        <input
          className="portal-month"
          type="month"
          required
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setCopyPreview(null);
            setEditing(null);
          }}
        />
      </Field>
      <Feedback action={{ ...action, success: action.success && !copying }} locale={locale} />
      {copying && (
        <form className="portal-editor" onSubmit={submit(() => copy(true))}>
          <h3>{say(locale, 'Preview before copying', 'معاينة قبل النسخ')}</h3>
          <p>
            {say(
              locale,
              'Classes keep their weekday and occurrence in the destination month, for example the first Wednesday. Duplicates, missing occurrences, and resource conflicts are reported.',
              'تحتفظ الحصص بيوم الأسبوع وترتيبه في الشهر المحدد، مثل أول أربعاء. يتم عرض التكرارات والأيام غير المتوفرة والتعارضات.',
            )}
          </p>
          <Field label={say(locale, 'Destination month', 'الشهر المستهدف')}>
            <input
              type="month"
              required
              value={toMonth}
              onChange={(e) => {
                setToMonth(e.target.value);
                setCopyPreview(null);
                setCopyKey(crypto.randomUUID());
              }}
            />
          </Field>
          <div className="portal-actions">
            <button disabled={action.pending || toMonth === month} type="submit">
              {say(locale, 'Preview copy', 'معاينة النسخ')}
            </button>
            {copyPreview && (
              <button
                className="primary"
                type="button"
                disabled={action.pending || copyPreview.conflicts.length > 0}
                onClick={() => void copy(false)}
              >
                {say(locale, 'Confirm copy', 'تأكيد النسخ')}
              </button>
            )}
          </div>
          {copyPreview && (
            <div className="portal-copy-result">
              <p>
                {say(locale, 'Classes to copy', 'حصص للنسخ')}: {copyPreview.classes.length} ·{' '}
                {say(locale, 'Skipped', 'متجاوزة')}: {copyPreview.skipped} ·{' '}
                {say(locale, 'Conflicts', 'تعارضات')}: {copyPreview.conflicts.length}
              </p>
              {copyPreview.conflicts.length > 0 && (
                <details>
                  <summary>{say(locale, 'Review conflicts', 'عرض التعارضات')}</summary>
                  <pre>{JSON.stringify(copyPreview.conflicts, null, 2)}</pre>
                </details>
              )}
            </div>
          )}
        </form>
      )}
      {editing ? (
        <ClassEditor
          key={editing}
          record={record}
          site={site}
          locale={locale}
          onSaved={saved}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <ResourceState resource={resource} locale={locale}>
          {resource.data?.classes.length ? (
            <div className="portal-table-scroll">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{label(locale, 'date')}</th>
                    <th>{label(locale, 'time')}</th>
                    <th>{label(locale, 'title')}</th>
                    <th>{label(locale, 'coach')}</th>
                    <th>{label(locale, 'room')}</th>
                    <th>{label(locale, 'status')}</th>
                    <th>{label(locale, 'edit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.classes.map((session) => (
                    <tr key={session.id}>
                      <td>{session.date}</td>
                      <td dir="ltr">
                        {session.startTime} - {session.endTime}
                      </td>
                      <td>
                        {text(session.title, locale)}
                        <small>{text(session.ageGroup, locale)}</small>
                      </td>
                      <td>
                        {site.coaches.find((coach) => coach.id === session.coachId)
                          ? text(
                              site.coaches.find((coach) => coach.id === session.coachId)!.name,
                              locale,
                            )
                          : label(locale, 'none')}
                      </td>
                      <td>{session.room}</td>
                      <td>
                        <Status status={session.status} locale={locale} />
                      </td>
                      <td>
                        <div className="portal-actions">
                          <button onClick={() => setEditing(session.id)}>
                            {label(locale, 'edit')}
                          </button>
                          <button
                            className="danger"
                            disabled={session.status === 'cancelled'}
                            onClick={() => setCancelling(session)}
                          >
                            {say(locale, 'Cancel class', 'إلغاء الحصة')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              locale={locale}
              text={say(
                locale,
                'No classes for this month. Add a class or preview a copy from another month.',
                'لا توجد حصص لهذا الشهر. أضف حصة أو انسخ من شهر آخر.',
              )}
            />
          )}
        </ResourceState>
      )}
      {cancelling && (
        <div className="portal-alert">
          <p>
            {say(
              locale,
              'Cancel this class? It will appear as cancelled in the public schedule.',
              'إلغاء هذه الحصة؟ ستظهر كملغاة في الجدول العام.',
            )}{' '}
            {text(cancelling.title, locale)} ({cancelling.date})
          </p>
          <div className="portal-actions">
            <button className="danger" disabled={action.pending} onClick={() => void cancel()}>
              {label(locale, 'confirm')}
            </button>
            <button onClick={() => setCancelling(null)}>{label(locale, 'close')}</button>
          </div>
        </div>
      )}
    </>
  );
}
