'use client';
import { useState } from 'react';
import Link from 'next/link';
import { text, type DashboardStats, type Locale, type PublicSite } from '@fightclub/shared';
import { api } from '@/lib/api';
import { CataloguePanel } from './catalogue';
import { ContentPanel } from './content';
import { MembersPanel } from './members';
import { DeliveryTable, MessagesPanel } from './messages';
import { SchedulePanel } from './schedule';
import { SettingsPanel } from './settings';
import {
  Empty,
  Feedback,
  Field,
  PanelTitle,
  ResourceState,
  jsonRequest,
  label,
  say,
  submit,
  useMutation,
  useResource,
} from './ui';
import './portal.css';
type Panel =
  | 'dashboard'
  | 'members'
  | 'plans'
  | 'offers'
  | 'coaches'
  | 'content'
  | 'schedule'
  | 'messages'
  | 'settings';
const panels: Panel[] = [
  'dashboard',
  'members',
  'schedule',
  'plans',
  'offers',
  'coaches',
  'content',
  'messages',
  'settings',
];
const panelIcons: Record<Panel, string> = {
  dashboard: '◫',
  members: '♙',
  schedule: '▦',
  plans: '◇',
  offers: '✦',
  coaches: '♧',
  content: '▤',
  messages: '✉',
  settings: '⚙',
};
function AdminLogin({ locale, onSuccess }: { locale: Locale; onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const action = useMutation(onSuccess);
  async function login() {
    await action.run(() =>
      api<{ username: string }>('/admin/login', jsonRequest('POST', { username, password })),
    );
  }
  return (
    <div className="portal-auth-wrap">
      <section className="portal-auth">
        <div className="portal-wordmark">
          FIGHT CLUB<span>{say(locale, 'Club operations', 'إدارة النادي')}</span>
        </div>
        <h1>{say(locale, 'Admin sign in', 'دخول الإدارة')}</h1>
        <p>
          {say(
            locale,
            'Use your staff account to manage the club.',
            'استخدم حساب الإدارة لإدارة النادي.',
          )}
        </p>
        <form onSubmit={submit(login)}>
          <Field label={label(locale, 'username')}>
            <input
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label={label(locale, 'password')}>
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Feedback action={action} locale={locale} />
          <button className="primary" type="submit" disabled={action.pending}>
            {label(locale, action.pending ? 'loading' : 'signin')}
          </button>
        </form>
        <Link href={`/${locale}`}>
          {say(locale, 'Back to the club website', 'العودة إلى موقع النادي')}
        </Link>
      </section>
    </div>
  );
}
function Overview({ locale }: { locale: Locale }) {
  const resource = useResource<DashboardStats>('/admin/stats');
  return (
    <>
      <PanelTitle title={label(locale, 'dashboard')}>
        <button onClick={resource.reload}>{say(locale, 'Refresh', 'تحديث')}</button>
      </PanelTitle>
      <ResourceState resource={resource} locale={locale}>
        {resource.data && (
          <>
            <div className="portal-stats">
              {(['total', 'active', 'expiring', 'expired', 'upcoming', 'suspended'] as const).map(
                (key) => (
                  <div key={key}>
                    <span>{label(locale, key)}</span>
                    <strong>{resource.data?.[key]}</strong>
                  </div>
                ),
              )}
            </div>
            <section className="portal-editor">
              <h3>{label(locale, 'today')}</h3>
              {resource.data.todayClasses.length ? (
                <ul className="portal-class-list">
                  {resource.data.todayClasses.map((session) => (
                    <li key={session.id}>
                      <time dir="ltr">
                        {session.startTime} - {session.endTime}
                      </time>
                      <div>
                        <strong>{text(session.title, locale)}</strong>
                        <span>
                          {text(session.ageGroup, locale)} · {session.room}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty locale={locale} />
              )}
            </section>
            <h3>{label(locale, 'recent')}</h3>
            <DeliveryTable messages={resource.data.recentMessages} locale={locale} />
          </>
        )}
      </ResourceState>
    </>
  );
}
export function AdminPortal({ locale }: { locale: Locale }) {
  const me = useResource<{ username: string }>('/admin/me');
  const [panel, setPanel] = useState<Panel>('dashboard');
  const [dirtyContent, setDirtyContent] = useState(false);
  const [requestedPanel, setRequestedPanel] = useState<Panel | null>(null);
  function navigate(next: Panel) {
    if (next === panel) return;
    if (panel === 'content' && dirtyContent) setRequestedPanel(next);
    else setPanel(next);
  }
  const [signedOut, setSignedOut] = useState(false);
  const site = useResource<PublicSite>(me.data && !signedOut ? '/admin/site' : null);
  const logout = useMutation();
  async function signOut() {
    const result = await logout.run(() =>
      api<{ ok: boolean }>('/admin/logout', jsonRequest('POST')),
    );
    if (result) {
      setSignedOut(true);
      me.reload();
    }
  }
  if (me.loading && !me.data)
    return (
      <div className="portal-root" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <p className="portal-empty" role="status">
          {label(locale, 'loading')}
        </p>
      </div>
    );
  if (me.error && me.errorStatus !== 401 && !signedOut)
    return (
      <main className="portal-root" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <div className="portal-auth-wrap">
          <ResourceState locale={locale} resource={me}>
            <span />
          </ResourceState>
        </div>
      </main>
    );
  if (!me.data || signedOut)
    return (
      <main className="portal-root" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <AdminLogin
          locale={locale}
          onSuccess={() => {
            setSignedOut(false);
            me.reload();
          }}
        />
      </main>
    );
  return (
    <main className="portal-root portal-admin" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <aside className="portal-sidebar">
        <Link className="portal-wordmark" href={`/${locale}`}>
          FIGHT CLUB<span>{say(locale, 'Club operations', 'إدارة النادي')}</span>
        </Link>
        <nav aria-label={say(locale, 'Admin navigation', 'تنقل الإدارة')}>
          {panels.map((item) => (
            <button
              key={item}
              aria-current={panel === item ? 'page' : undefined}
              className={panel === item ? 'active' : ''}
              onClick={() => navigate(item)}
            >
              <span aria-hidden>{panelIcons[item]}</span>
              {label(locale, item)}
            </button>
          ))}
        </nav>
        <div className="portal-sidebar-bottom">
          <span>{me.data.username}</span>
          <Link href={`/${locale === 'ar' ? 'en' : 'ar'}/admin`}>
            {locale === 'ar' ? 'English' : 'العربية'}
          </Link>
          <button disabled={logout.pending} onClick={() => void signOut()}>
            {label(locale, 'logout')}
          </button>
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar">
          <div>
            <span>{say(locale, 'Staff workspace', 'مساحة عمل الإدارة')}</span>
            <h1>{label(locale, panel)}</h1>
          </div>
          <Link href={`/${locale}`} target="_blank">
            {say(locale, 'Open website', 'فتح الموقع')}
          </Link>
        </header>
        <div className="portal-panel">
          {requestedPanel && (
            <div className="portal-alert" role="alert">
              <p>
                {say(
                  locale,
                  'Discard your unsaved content edits and leave this panel? Saved drafts will remain.',
                  'تجاهل تعديلات المحتوى غير المحفوظة ومغادرة القسم؟ ستبقى المسودات المحفوظة.',
                )}
              </p>
              <div className="portal-actions">
                <button
                  className="danger"
                  onClick={() => {
                    setPanel(requestedPanel);
                    setRequestedPanel(null);
                    setDirtyContent(false);
                  }}
                >
                  {say(locale, 'Discard and leave', 'تجاهل ومغادرة')}
                </button>
                <button onClick={() => setRequestedPanel(null)}>
                  {say(locale, 'Keep editing', 'متابعة التحرير')}
                </button>
              </div>
            </div>
          )}
          <Feedback action={logout} locale={locale} />
          {panel === 'dashboard' ? (
            <Overview locale={locale} />
          ) : panel === 'messages' ? (
            <MessagesPanel locale={locale} />
          ) : (
            <ResourceState resource={site} locale={locale}>
              {site.data && (
                <>
                  {panel === 'members' && <MembersPanel locale={locale} site={site.data} />}
                  {(panel === 'plans' || panel === 'offers' || panel === 'coaches') && (
                    <CataloguePanel
                      key={panel}
                      kind={panel}
                      locale={locale}
                      site={site.data}
                      reload={site.reload}
                    />
                  )}
                  {panel === 'content' && (
                    <ContentPanel
                      locale={locale}
                      site={site.data}
                      reload={site.reload}
                      onDirtyChange={setDirtyContent}
                    />
                  )}
                  {panel === 'schedule' && <SchedulePanel locale={locale} site={site.data} />}
                  {panel === 'settings' && (
                    <SettingsPanel
                      locale={locale}
                      settings={site.data.settings}
                      reload={site.reload}
                      onCredentialChange={() => {
                        setSignedOut(true);
                        me.reload();
                      }}
                    />
                  )}
                </>
              )}
            </ResourceState>
          )}
        </div>
      </div>
    </main>
  );
}
