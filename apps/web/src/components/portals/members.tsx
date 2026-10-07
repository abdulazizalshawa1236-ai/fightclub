'use client';
import { useState } from 'react';
import {
  text,
  whatsappLink,
  type Locale,
  type Member,
  type MemberInput,
  type PublicSite,
} from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Empty,
  Feedback,
  Field,
  FormButtons,
  PanelTitle,
  ResourceState,
  Status,
  Toggle,
  dateToday,
  jsonRequest,
  label,
  say,
  submit,
  useMutation,
  useResource,
} from './ui';

type MembersResult = { members: Member[]; total: number; page: number };
type AuditEvent = {
  id: string;
  action: string;
  createdAt: string;
  actor: string;
  details: unknown;
};
function initialMember(member?: Member): MemberInput {
  return {
    fullName: member?.fullName ?? '',
    nationalId: '',
    phone: member?.phone ?? '',
    ageGroup: member?.ageGroup ?? 'adult',
    preferredLanguage: member?.preferredLanguage ?? 'ar',
    planId: member?.membership?.planId ?? '',
    startDate: member?.membership?.startDate ?? dateToday(),
    endDate: member?.membership?.endDate,
    sports: member?.membership?.sports ?? [],
    notes: member?.notes ?? '',
  };
}
function MemberEditor({
  member,
  site,
  locale,
  onSaved,
  onCancel,
}: {
  member?: Member;
  site: PublicSite;
  locale: Locale;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<MemberInput>(() => initialMember(member));
  const [accessEnabled, setAccessEnabled] = useState(member?.accessEnabled ?? true);
  const [consent, setConsent] = useState(member?.consent ?? { updates: false, marketing: false });
  const action = useMutation(onSaved);
  const set = <K extends keyof MemberInput>(key: K, value: MemberInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const selected = site.plans.find((plan) => plan.id === form.planId);
  async function save() {
    const { nationalId, ...rest } = form;
    const payload = member
      ? {
          ...rest,
          ...(nationalId ? { nationalId } : {}),
          accessEnabled,
          consent,
          expectedVersion: member.membership?.version,
        }
      : { ...form, accessEnabled, consent };
    await action.run(() =>
      api<Member>(
        member ? `/admin/members/${member.id}` : '/admin/members',
        jsonRequest(member ? 'PATCH' : 'POST', payload),
      ),
    );
  }
  return (
    <section className="portal-editor">
      <PanelTitle
        title={say(
          locale,
          member ? 'Edit member' : 'Add member',
          member ? 'تعديل العضو' : 'إضافة عضو',
        )}
      />
      <form onSubmit={submit(save)}>
        <div className="portal-form-grid">
          <Field label={label(locale, 'name')}>
            <input
              required
              maxLength={200}
              value={form.fullName}
              onChange={(e) => set('fullName', e.target.value)}
            />
          </Field>
          <Field
            label={label(locale, 'nationalId')}
            hint={
              member
                ? say(
                    locale,
                    'Leave blank to keep the existing ID. Full IDs are never returned.',
                    'اتركه فارغاً للإبقاء على الهوية الحالية. لا تظهر الهوية كاملة.',
                  )
                : undefined
            }
          >
            <input
              required={!member}
              inputMode="numeric"
              pattern="[0-9]{10}"
              minLength={10}
              maxLength={10}
              value={form.nationalId}
              onChange={(e) => set('nationalId', e.target.value)}
            />
          </Field>
          <Field label={label(locale, 'phone')}>
            <input
              required
              type="tel"
              dir="ltr"
              placeholder="+9665…"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label={label(locale, 'age')}>
            <select
              value={form.ageGroup}
              onChange={(e) => set('ageGroup', e.target.value === 'child' ? 'child' : 'adult')}
            >
              <option value="adult">{label(locale, 'adult')}</option>
              <option value="child">{label(locale, 'child')}</option>
            </select>
          </Field>
          <Field label={label(locale, 'language')}>
            <select
              value={form.preferredLanguage}
              onChange={(e) => set('preferredLanguage', e.target.value === 'en' ? 'en' : 'ar')}
            >
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label={label(locale, 'plan')}>
            <select
              required
              value={form.planId}
              onChange={(e) => {
                set('planId', e.target.value);
                set('sports', []);
              }}
            >
              <option value="">{say(locale, 'Select a package', 'اختر الباقة')}</option>
              {site.plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {text(plan.name, locale)} ({plan.durationDays} {say(locale, 'days', 'يوماً')})
                </option>
              ))}
            </select>
          </Field>
          <Field label={label(locale, 'start')}>
            <input
              type="date"
              required
              value={form.startDate}
              onChange={(e) => set('startDate', e.target.value)}
            />
          </Field>
          <Field
            label={label(locale, 'end')}
            hint={say(
              locale,
              'Leave blank to calculate from the package duration.',
              'اتركه فارغاً لحسابه من مدة الباقة.',
            )}
          >
            <input
              type="date"
              min={form.startDate}
              value={form.endDate ?? ''}
              onChange={(e) => set('endDate', e.target.value || undefined)}
            />
          </Field>
        </div>
        <fieldset className="portal-checks">
          <legend>
            {label(locale, 'sports')}{' '}
            {selected?.sportLimit !== null &&
              selected?.sportLimit !== undefined &&
              `(${say(locale, 'maximum', 'بحد أقصى')} ${selected.sportLimit})`}
          </legend>
          {site.sports
            .filter((sport) => sport.available || form.sports.includes(sport.id))
            .map((sport) => (
              <Toggle
                key={sport.id}
                label={text(sport.name, locale)}
                checked={form.sports.includes(sport.id)}
                onChange={(checked) =>
                  set(
                    'sports',
                    checked
                      ? [...form.sports, sport.id]
                      : form.sports.filter((id) => id !== sport.id),
                  )
                }
              />
            ))}
        </fieldset>
        <Field label={label(locale, 'notes')}>
          <textarea
            value={form.notes}
            maxLength={5000}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
        <fieldset className="portal-checks">
          <legend>{say(locale, 'Access and recorded consent', 'الدخول والموافقات المسجلة')}</legend>
          <Toggle
            label={label(locale, 'enabled')}
            checked={accessEnabled}
            onChange={setAccessEnabled}
          />
          <Toggle
            label={label(locale, 'updates')}
            checked={consent.updates}
            onChange={(updates) => setConsent((current) => ({ ...current, updates }))}
          />
          <Toggle
            label={label(locale, 'marketing')}
            checked={consent.marketing}
            onChange={(marketing) => setConsent((current) => ({ ...current, marketing }))}
          />
        </fieldset>
        <p className="portal-hint">
          {say(
            locale,
            'Record consent only when the member has agreed. Changing a phone revokes verification and portal sessions.',
            'سجّل الموافقة فقط بعد موافقة العضو. تغيير الجوال يلغي توثيقه وجلسات دخوله.',
          )}
        </p>
        <Feedback action={action} locale={locale} />
        <FormButtons pending={action.pending} locale={locale} onCancel={onCancel} />
      </form>
    </section>
  );
}
function MemberDetail({
  member,
  site,
  locale,
  onChanged,
  onClose,
}: {
  member: Member;
  site: PublicSite;
  locale: Locale;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'renew' | 'archive'>('view');
  const [planId, setPlanId] = useState(member.membership?.planId ?? '');
  const [sports, setSports] = useState(member.membership?.sports ?? []);
  const [renewalKey, setRenewalKey] = useState(() => crypto.randomUUID());
  const action = useMutation(onChanged);
  const audit = useResource<{ events: AuditEvent[] }>(`/admin/audit?memberId=${member.id}`);
  if (mode === 'edit')
    return (
      <MemberEditor
        member={member}
        site={site}
        locale={locale}
        onSaved={() => {
          setMode('view');
          onChanged();
          audit.reload();
        }}
        onCancel={() => setMode('view')}
      />
    );
  async function renew() {
    const result = await action.run(() =>
      api<Member>(
        `/admin/members/${member.id}/renew`,
        jsonRequest('POST', {
          planId,
          sports,
          expectedVersion: member.membership?.version,
          idempotencyKey: renewalKey,
        }),
      ),
    );
    if (result) {
      setRenewalKey(crypto.randomUUID());
      setMode('view');
      audit.reload();
    }
  }
  async function status() {
    await action.run(() =>
      api<Member>(
        `/admin/members/${member.id}/status`,
        jsonRequest('POST', {
          suspended: member.membership?.status !== 'suspended',
          expectedVersion: member.membership?.version,
        }),
      ),
    );
    audit.reload();
  }
  async function archive() {
    const result = await action.run(() =>
      api<{ ok: boolean }>(`/admin/members/${member.id}`, jsonRequest('DELETE')),
    );
    if (result) onClose();
  }
  const accessMessage =
    locale === 'ar'
      ? `مرحباً ${member.fullName}، يمكنك الدخول إلى بوابة النادي باستخدام هويتك ورقم الجوال المسجل واستلام رمز التحقق برسالة نصية:\n${typeof window === 'undefined' ? '' : window.location.origin}/${locale}/account`
      : `Hello ${member.fullName}, access your club membership using your registered ID and mobile number and an SMS verification code:\n${typeof window === 'undefined' ? '' : window.location.origin}/${locale}/account`;
  const accessUrl = whatsappLink({ ...site.settings, whatsapp: member.phone }, accessMessage);
  return (
    <section className="portal-editor">
      <PanelTitle title={member.fullName}>
        <button onClick={onClose}>{label(locale, 'close')}</button>
      </PanelTitle>
      <dl className="portal-facts">
        <div>
          <dt>{label(locale, 'phone')}</dt>
          <dd dir="ltr">{member.phone}</dd>
        </div>
        <div>
          <dt>{label(locale, 'nationalId')}</dt>
          <dd dir="ltr">{member.nationalIdMasked}</dd>
        </div>
        <div>
          <dt>{label(locale, 'status')}</dt>
          <dd>
            {member.membership ? (
              <Status status={member.membership.status} locale={locale} />
            ) : (
              label(locale, 'none')
            )}
          </dd>
        </div>
        <div>
          <dt>{label(locale, 'plan')}</dt>
          <dd>
            {member.membership ? text(member.membership.planName, locale) : label(locale, 'none')}
          </dd>
        </div>
        <div>
          <dt>{label(locale, 'start')}</dt>
          <dd>{member.membership?.startDate ?? '-'}</dd>
        </div>
        <div>
          <dt>{label(locale, 'end')}</dt>
          <dd>{member.membership?.endDate ?? '-'}</dd>
        </div>
        <div>
          <dt>{say(locale, 'Phone verification', 'توثيق الجوال')}</dt>
          <dd>{label(locale, member.verified ? 'verified' : 'unverified')}</dd>
        </div>
      </dl>
      <p className="portal-hint">{member.notes}</p>
      <div className="portal-actions">
        <button onClick={() => setMode('edit')}>{label(locale, 'edit')}</button>
        {accessUrl && (
          <a className="portal-button" href={accessUrl} target="_blank" rel="noreferrer">
            {say(
              locale,
              'Send access instructions via WhatsApp',
              'إرسال تعليمات الدخول عبر واتساب',
            )}
          </a>
        )}
        <button
          className="primary"
          onClick={() => {
            action.clear();
            setMode('renew');
          }}
        >
          {label(locale, 'renew')}
        </button>
        {member.membership && (
          <button disabled={action.pending} onClick={() => void status()}>
            {label(locale, member.membership.status === 'suspended' ? 'reactivate' : 'suspend')}
          </button>
        )}
        <button
          className="danger"
          onClick={() => {
            action.clear();
            setMode('archive');
          }}
        >
          {label(locale, 'archive')}
        </button>
      </div>
      {mode === 'renew' && (
        <form className="portal-inline-form" onSubmit={submit(renew)}>
          <h3>{label(locale, 'renew')}</h3>
          <p>
            {say(
              locale,
              'Staff must confirm payment first. Renewal continues after a valid membership ends; an expired membership starts today.',
              'يجب على الموظف تأكيد الدفع أولاً. يبدأ التجديد بعد نهاية الاشتراك الساري، أو اليوم إذا انتهى الاشتراك.',
            )}
          </p>
          <Field label={label(locale, 'plan')}>
            <select
              required
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                setSports([]);
              }}
            >
              <option value="">{label(locale, 'plan')}</option>
              {site.plans.map((plan) => (
                <option value={plan.id} key={plan.id}>
                  {text(plan.name, locale)}
                </option>
              ))}
            </select>
          </Field>
          <fieldset className="portal-checks">
            <legend>{label(locale, 'sports')}</legend>
            {site.sports
              .filter((s) => s.available)
              .map((sport) => (
                <Toggle
                  key={sport.id}
                  label={text(sport.name, locale)}
                  checked={sports.includes(sport.id)}
                  onChange={(checked) =>
                    setSports((current) =>
                      checked ? [...current, sport.id] : current.filter((id) => id !== sport.id),
                    )
                  }
                />
              ))}
          </fieldset>
          <FormButtons pending={action.pending} locale={locale} onCancel={() => setMode('view')} />
        </form>
      )}
      {mode === 'archive' && (
        <div className="portal-alert">
          <p>
            {say(
              locale,
              'Archive this member? Portal access will end. Membership and audit records will remain for operational history.',
              'أرشفة هذا العضو؟ سيتوقف الدخول للبوابة مع الاحتفاظ بسجل الاشتراك والتغييرات.',
            )}
          </p>
          <div className="portal-actions">
            <button className="danger" disabled={action.pending} onClick={() => void archive()}>
              {label(locale, 'confirm')}
            </button>
            <button onClick={() => setMode('view')}>{label(locale, 'cancel')}</button>
          </div>
        </div>
      )}
      <Feedback action={action} locale={locale} />
      <h3>{label(locale, 'history')}</h3>
      <ResourceState resource={audit} locale={locale}>
        {audit.data?.events.length ? (
          <ul className="portal-timeline">
            {audit.data.events.map((event) => (
              <li key={event.id}>
                <strong>{event.action}</strong>
                <span>
                  {event.actor} · {new Date(event.createdAt).toLocaleString(locale)}
                </span>
                <details>
                  <summary>{say(locale, 'Details', 'التفاصيل')}</summary>
                  <pre>{JSON.stringify(event.details, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <Empty locale={locale} />
        )}
      </ResourceState>
    </section>
  );
}
export function MembersPanel({ locale, site }: { locale: Locale; site: PublicSite }) {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const resource = useResource<MembersResult>(
    `/admin/members?q=${encodeURIComponent(search)}&status=${status}&page=${page}`,
  );
  const exportAction = useMutation();
  const selected = resource.data?.members.find((member) => member.id === selectedId);
  async function exportMembers() {
    await exportAction.run(async () => {
      const response = await fetch('/api/admin/members/export', { credentials: 'same-origin' });
      if (!response.ok)
        throw new Error(
          say(
            locale,
            'Export failed. Sign in again or retry.',
            'فشل التصدير. سجّل الدخول أو حاول مجدداً.',
          ),
        );
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fightclub-members-${dateToday()}.csv`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    });
  }
  return (
    <>
      <PanelTitle title={label(locale, 'members')}>
        <button disabled={exportAction.pending} onClick={() => void exportMembers()}>
          {label(locale, 'export')}
        </button>
        <button
          className="primary"
          onClick={() => {
            setAdding(true);
            setSelectedId(null);
          }}
        >
          {say(locale, 'Add member', 'إضافة عضو')}
        </button>
      </PanelTitle>
      <Feedback action={exportAction} locale={locale} />
      {adding ? (
        <MemberEditor
          site={site}
          locale={locale}
          onSaved={() => {
            setAdding(false);
            resource.reload();
          }}
          onCancel={() => setAdding(false)}
        />
      ) : selected ? (
        <MemberDetail
          key={selected.id}
          member={selected}
          site={site}
          locale={locale}
          onChanged={resource.reload}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <>
          <form
            className="portal-toolbar"
            onSubmit={(event) => {
              event.preventDefault();
              setSearch(query);
              setPage(1);
            }}
          >
            <Field label={label(locale, 'search')}>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
            </Field>
            <Field label={label(locale, 'status')}>
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{label(locale, 'all')}</option>
                {['active', 'expiring', 'expired', 'upcoming', 'suspended'].map((value) => (
                  <option key={value} value={value}>
                    {label(locale, value)}
                  </option>
                ))}
              </select>
            </Field>
            <button type="submit">{say(locale, 'Search', 'بحث')}</button>
          </form>
          <ResourceState resource={resource} locale={locale}>
            {resource.data?.members.length ? (
              <div className="portal-table-scroll">
                <table className="portal-table">
                  <thead>
                    <tr>
                      <th>{label(locale, 'name')}</th>
                      <th>{label(locale, 'phone')}</th>
                      <th>{label(locale, 'plan')}</th>
                      <th>{label(locale, 'status')}</th>
                      <th>{label(locale, 'end')}</th>
                      <th>{label(locale, 'edit')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resource.data.members.map((member) => (
                      <tr key={member.id}>
                        <td>
                          <strong>{member.fullName}</strong>
                          <small>{member.nationalIdMasked}</small>
                        </td>
                        <td dir="ltr">{member.phone}</td>
                        <td>
                          {member.membership
                            ? text(member.membership.planName, locale)
                            : label(locale, 'none')}
                        </td>
                        <td>
                          {member.membership ? (
                            <Status status={member.membership.status} locale={locale} />
                          ) : (
                            label(locale, 'none')
                          )}
                        </td>
                        <td>{member.membership?.endDate ?? ''}</td>
                        <td>
                          <button onClick={() => setSelectedId(member.id)}>
                            {label(locale, 'edit')}
                          </button>
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
                  'No members match your search. Add a member or adjust your filters.',
                  'لا توجد نتائج. أضف عضواً أو غيّر خيارات البحث.',
                )}
              />
            )}
          </ResourceState>
          <div className="portal-pagination">
            <span>
              {resource.data?.total ?? 0} {label(locale, 'members')}
            </span>
            <button
              disabled={page <= 1 || resource.loading}
              onClick={() => setPage((current) => current - 1)}
            >
              {label(locale, 'previous')}
            </button>
            <span>{page}</span>
            <button
              disabled={resource.loading || !resource.data || page * 20 >= resource.data.total}
              onClick={() => setPage((current) => current + 1)}
            >
              {label(locale, 'next')}
            </button>
          </div>
        </>
      )}
    </>
  );
}
