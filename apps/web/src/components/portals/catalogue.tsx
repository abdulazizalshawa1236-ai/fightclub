'use client';
import { useState } from 'react';
import {
  text,
  type Coach,
  type Locale,
  type Offer,
  type Plan,
  type PublicSite,
} from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Empty,
  Feedback,
  Field,
  FormButtons,
  LocalizedField,
  PanelTitle,
  Toggle,
  blankLocalized,
  dateToday,
  jsonRequest,
  label,
  say,
  submit,
  useMutation,
} from './ui';

type CatalogueKind = 'plans' | 'offers' | 'coaches';
type CatalogueRecord = Plan | Offer | Coach;
function withoutId<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const { id, ...values } = record;
  void id;
  return values;
}
function recordName(record: CatalogueRecord, locale: Locale): string {
  return text('title' in record ? record.title : record.name, locale);
}
function PhotoField({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: string;
  onChange: (url: string) => void;
}) {
  const action = useMutation();
  async function upload(file: File) {
    await action.run(async () => {
      const form = new FormData();
      form.append('file', file);
      const result = await api<{ url: string }>('/admin/media', { method: 'POST', body: form });
      onChange(result.url);
      return result;
    });
  }
  return (
    <div>
      <Field label={label(locale, 'image')}>
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} />
      </Field>
      <Field
        label={label(locale, 'upload')}
        hint={say(
          locale,
          'JPEG, PNG, or WebP. Maximum 8 MB.',
          'JPEG أو PNG أو WebP. بحد أقصى 8 ميجابايت.',
        )}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={action.pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </Field>
      <Feedback action={action} locale={locale} />
    </div>
  );
}
export { PhotoField };
function PlanEditor({
  record,
  locale,
  onSave,
  onCancel,
}: {
  record?: Plan;
  locale: Locale;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Plan, 'id'>>(() =>
    record
      ? withoutId(record)
      : {
          name: { ...blankLocalized },
          price: 0,
          oldPrice: null,
          currency: 'SAR',
          durationDays: 90,
          durationLabel: { ...blankLocalized },
          sportLimit: 1,
          benefits: [],
          featured: false,
          visible: true,
        },
  );
  const action = useMutation(onSave);
  const set = <K extends keyof Omit<Plan, 'id'>>(key: K, value: Omit<Plan, 'id'>[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    await action.run(() =>
      api<Plan>(
        record ? `/admin/plans/${record.id}` : '/admin/plans',
        jsonRequest(record ? 'PUT' : 'POST', form),
      ),
    );
  }
  return (
    <form onSubmit={submit(save)}>
      <LocalizedField
        label={label(locale, 'name')}
        value={form.name}
        onChange={(value) => set('name', value)}
      />
      <div className="portal-form-grid">
        <Field label={label(locale, 'price')}>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => set('price', Number(e.target.value))}
          />
        </Field>
        <Field label={say(locale, 'Previous price (optional)', 'السعر السابق (اختياري)')}>
          <input
            type="number"
            min={form.price}
            step="0.01"
            value={form.oldPrice ?? ''}
            onChange={(e) => set('oldPrice', e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <Field label={label(locale, 'duration')}>
          <input
            required
            type="number"
            min="1"
            max="1095"
            value={form.durationDays}
            onChange={(e) => set('durationDays', Number(e.target.value))}
          />
        </Field>
        <Field
          label={say(locale, 'Sport limit (blank for all)', 'عدد الرياضات (فارغ لكل الرياضات)')}
        >
          <input
            type="number"
            min="1"
            max="2"
            value={form.sportLimit ?? ''}
            onChange={(e) => set('sportLimit', e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
      </div>
      <LocalizedField
        label={say(locale, 'Duration label', 'وصف المدة')}
        value={form.durationLabel}
        onChange={(value) => set('durationLabel', value)}
      />
      <fieldset className="portal-repeater">
        <legend>{say(locale, 'Benefits', 'المزايا')}</legend>
        {form.benefits.map((benefit, index) => (
          <div className="portal-repeat-row" key={index}>
            <LocalizedField
              label={`${say(locale, 'Benefit', 'ميزة')} ${index + 1}`}
              value={benefit}
              onChange={(value) =>
                set(
                  'benefits',
                  form.benefits.map((current, i) => (i === index ? value : current)),
                )
              }
            />
            <button
              type="button"
              onClick={() =>
                set(
                  'benefits',
                  form.benefits.filter((_, i) => i !== index),
                )
              }
            >
              {label(locale, 'remove')}
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set('benefits', [...form.benefits, { ...blankLocalized }])}
        >
          {say(locale, 'Add benefit', 'إضافة ميزة')}
        </button>
      </fieldset>
      <div className="portal-checks">
        <Toggle
          label={label(locale, 'visible')}
          checked={form.visible}
          onChange={(value) => set('visible', value)}
        />
        <Toggle
          label={say(locale, 'Featured package', 'باقة مميزة')}
          checked={form.featured}
          onChange={(value) => set('featured', value)}
        />
      </div>
      <Feedback action={action} locale={locale} />
      <FormButtons pending={action.pending} locale={locale} onCancel={onCancel} />
    </form>
  );
}
function OfferEditor({
  record,
  locale,
  onSave,
  onCancel,
}: {
  record?: Offer;
  locale: Locale;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Offer, 'id'>>(() =>
    record
      ? withoutId(record)
      : {
          title: { ...blankLocalized },
          description: { ...blankLocalized },
          badge: { ...blankLocalized },
          terms: { ...blankLocalized },
          startsOn: dateToday(),
          endsOn: dateToday(),
          visible: true,
        },
  );
  const action = useMutation(onSave);
  const set = <K extends keyof Omit<Offer, 'id'>>(key: K, value: Omit<Offer, 'id'>[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    await action.run(() =>
      api<Offer>(
        record ? `/admin/offers/${record.id}` : '/admin/offers',
        jsonRequest(record ? 'PUT' : 'POST', form),
      ),
    );
  }
  return (
    <form onSubmit={submit(save)}>
      <LocalizedField
        label={label(locale, 'title')}
        value={form.title}
        onChange={(value) => set('title', value)}
      />
      <LocalizedField
        label={label(locale, 'body')}
        value={form.description}
        onChange={(value) => set('description', value)}
        multiline
      />
      <LocalizedField
        label={say(locale, 'Badge', 'شارة العرض')}
        value={form.badge}
        onChange={(value) => set('badge', value)}
      />
      <LocalizedField
        label={say(locale, 'Terms', 'الشروط')}
        value={form.terms}
        onChange={(value) => set('terms', value)}
        multiline
      />
      <div className="portal-form-grid">
        <Field label={label(locale, 'start')}>
          <input
            type="date"
            required
            value={form.startsOn}
            onChange={(e) => set('startsOn', e.target.value)}
          />
        </Field>
        <Field label={label(locale, 'end')}>
          <input
            type="date"
            min={form.startsOn}
            required
            value={form.endsOn}
            onChange={(e) => set('endsOn', e.target.value)}
          />
        </Field>
      </div>
      <Toggle
        label={label(locale, 'visible')}
        checked={form.visible}
        onChange={(value) => set('visible', value)}
      />
      <Feedback action={action} locale={locale} />
      <FormButtons pending={action.pending} locale={locale} onCancel={onCancel} />
    </form>
  );
}
function CoachEditor({
  record,
  locale,
  site,
  onSave,
  onCancel,
}: {
  record?: Coach;
  locale: Locale;
  site: PublicSite;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Omit<Coach, 'id'>>(() =>
    record
      ? withoutId(record)
      : { name: { ...blankLocalized }, bio: { ...blankLocalized }, image: '', sports: [] },
  );
  const action = useMutation(onSave);
  const set = <K extends keyof Omit<Coach, 'id'>>(key: K, value: Omit<Coach, 'id'>[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  async function save() {
    await action.run(() =>
      api<Coach>(
        record ? `/admin/coaches/${record.id}` : '/admin/coaches',
        jsonRequest(record ? 'PUT' : 'POST', form),
      ),
    );
  }
  return (
    <form onSubmit={submit(save)}>
      <LocalizedField
        label={label(locale, 'name')}
        value={form.name}
        onChange={(value) => set('name', value)}
      />
      <LocalizedField
        label={say(locale, 'Bio and achievements', 'السيرة والإنجازات')}
        value={form.bio}
        onChange={(value) => set('bio', value)}
        multiline
      />
      <PhotoField locale={locale} value={form.image} onChange={(value) => set('image', value)} />
      <fieldset className="portal-checks">
        <legend>{label(locale, 'sports')}</legend>
        {site.sports.map((sport) => (
          <Toggle
            key={sport.id}
            label={text(sport.name, locale)}
            checked={form.sports.includes(sport.id)}
            onChange={(checked) =>
              set(
                'sports',
                checked ? [...form.sports, sport.id] : form.sports.filter((id) => id !== sport.id),
              )
            }
          />
        ))}
      </fieldset>
      <Feedback action={action} locale={locale} />
      <FormButtons pending={action.pending} locale={locale} onCancel={onCancel} />
    </form>
  );
}
export function CataloguePanel({
  kind,
  locale,
  site,
  reload,
}: {
  kind: CatalogueKind;
  locale: Locale;
  site: PublicSite;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CatalogueRecord | null>(null);
  const action = useMutation(() => {
    setRemoving(null);
    reload();
  });
  const records: CatalogueRecord[] =
    kind === 'plans' ? site.plans : kind === 'offers' ? site.offers : site.coaches;
  const record = records.find((item) => item.id === editing);
  const saved = () => {
    setEditing(null);
    reload();
  };
  async function remove() {
    if (removing)
      await action.run(() =>
        api<{ archived: true }>(`/admin/${kind}/${removing.id}`, jsonRequest('DELETE')),
      );
  }
  return (
    <>
      <PanelTitle title={label(locale, kind)}>
        <button
          className="primary"
          onClick={() => {
            setEditing('new');
            setRemoving(null);
          }}
        >
          {label(locale, 'add')}
        </button>
      </PanelTitle>
      {editing ? (
        <section className="portal-editor">
          {kind === 'plans' ? (
            <PlanEditor
              key={editing}
              record={record && 'price' in record ? record : undefined}
              locale={locale}
              onSave={saved}
              onCancel={() => setEditing(null)}
            />
          ) : kind === 'offers' ? (
            <OfferEditor
              key={editing}
              record={record && 'startsOn' in record ? record : undefined}
              locale={locale}
              onSave={saved}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <CoachEditor
              key={editing}
              record={record && 'bio' in record ? record : undefined}
              locale={locale}
              site={site}
              onSave={saved}
              onCancel={() => setEditing(null)}
            />
          )}
        </section>
      ) : (
        <>
          {removing && (
            <div className="portal-alert">
              <p>
                {say(
                  locale,
                  'Remove from the catalogue? Existing membership history will be preserved.',
                  'حذف من القائمة؟ سيبقى سجل الاشتراكات الحالية محفوظاً.',
                )}{' '}
                <strong>{recordName(removing, locale)}</strong>
              </p>
              <div className="portal-actions">
                <button className="danger" disabled={action.pending} onClick={() => void remove()}>
                  {label(locale, 'confirm')}
                </button>
                <button onClick={() => setRemoving(null)}>{label(locale, 'cancel')}</button>
              </div>
            </div>
          )}
          <Feedback action={action} locale={locale} />
          {records.length ? (
            <div className="portal-table-scroll">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{label(locale, 'name')}</th>
                    <th>{label(locale, 'status')}</th>
                    <th>{label(locale, 'edit')}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{recordName(item, locale)}</strong>
                        {'price' in item && (
                          <small>
                            {item.price} SAR · {item.durationDays} {say(locale, 'days', 'يوماً')}
                          </small>
                        )}
                        {'endsOn' in item && (
                          <small>
                            {item.startsOn} / {item.endsOn}
                          </small>
                        )}
                      </td>
                      <td>
                        {'visible' in item
                          ? say(
                              locale,
                              item.visible ? 'Visible' : 'Hidden',
                              item.visible ? 'ظاهر' : 'مخفي',
                            )
                          : say(locale, 'Published', 'منشور')}
                      </td>
                      <td>
                        <div className="portal-actions">
                          <button onClick={() => setEditing(item.id)}>
                            {label(locale, 'edit')}
                          </button>
                          <button
                            className="danger"
                            onClick={() => {
                              action.clear();
                              setRemoving(item);
                            }}
                          >
                            {label(locale, 'remove')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty locale={locale} />
          )}
        </>
      )}
    </>
  );
}
