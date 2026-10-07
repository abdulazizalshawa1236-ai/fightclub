'use client';
import { useEffect, useState } from 'react';
import { text, type ContentBlock, type Locale, type PublicSite } from '@fightclub/shared';
import { api } from '@/lib/api';
import {
  Empty,
  Feedback,
  Field,
  FormButtons,
  LocalizedField,
  PanelTitle,
  ResourceState,
  Toggle,
  blankLocalized,
  jsonRequest,
  label,
  say,
  submit,
  useMutation,
  useResource,
} from './ui';
import { PhotoField } from './catalogue';
const sectionKinds: ContentBlock['type'][] = [
  'hero',
  'about',
  'programs',
  'plans',
  'offers',
  'schedule',
  'coaches',
  'corporate',
  'faq',
  'contact',
  'gallery',
];
const sectionsAr: Record<ContentBlock['type'], string> = {
  hero: 'الواجهة الرئيسية',
  about: 'عن النادي',
  programs: 'البرامج',
  plans: 'الباقات',
  offers: 'العروض',
  schedule: 'الجدول',
  coaches: 'المدربون',
  corporate: 'برامج الشركات',
  faq: 'الأسئلة الشائعة',
  contact: 'التواصل',
  gallery: 'معرض الصور',
};
export function ContentPanel({
  locale,
  site,
  reload,
  onDirtyChange,
}: {
  locale: Locale;
  site: PublicSite;
  reload: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [blocks, setBlocks] = useState<ContentBlock[]>(() => site.blocks);
  const [revision, setRevision] = useState(site.revision);
  const [selected, setSelected] = useState<string | null>(site.blocks[0]?.id ?? null);
  const [dirty, setDirty] = useState(false);
  const [restoreId, setRestoreId] = useState<number | null>(null);
  useEffect(() => {
    onDirtyChange(dirty);
    const preventLoss = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', preventLoss);
    return () => window.removeEventListener('beforeunload', preventLoss);
  }, [dirty, onDirtyChange]);
  const history = useResource<{
    revisions: { revision: number; createdAt: string; published: boolean }[];
  }>('/admin/content/history');
  const action = useMutation();
  const selectedBlock = blocks.find((block) => block.id === selected);
  function updateBlocks(next: ContentBlock[]) {
    setBlocks(next.map((block, index) => ({ ...block, position: index })));
    setDirty(true);
    action.clear();
  }
  function update(block: ContentBlock) {
    updateBlocks(blocks.map((current) => (current.id === block.id ? block : current)));
  }
  function move(id: string, step: number) {
    const current = blocks.findIndex((block) => block.id === id);
    const target = current + step;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[current], next[target]] = [next[target]!, next[current]!];
    updateBlocks(next);
  }
  async function save() {
    const result = await action.run(() =>
      api<{ revision: number }>(
        '/admin/content',
        jsonRequest('PUT', { blocks, expectedRevision: revision }),
      ),
    );
    if (result) {
      setRevision(result.revision);
      setDirty(false);
      history.reload();
      reload();
    }
  }
  async function publish() {
    const result = await action.run(() =>
      api<{ revision: number }>(
        '/admin/content/publish',
        jsonRequest('POST', { expectedRevision: revision }),
      ),
    );
    if (result) {
      setRevision(result.revision);
      history.reload();
      reload();
    }
  }
  async function restore() {
    if (restoreId === null) return;
    const result = await action.run(async () => {
      await api<{ revision: number }>(
        `/admin/content/restore/${restoreId}`,
        jsonRequest('POST', { expectedRevision: revision }),
      );
      return api<PublicSite>('/admin/site');
    });
    if (result) {
      setBlocks(result.blocks);
      setRevision(result.revision);
      setDirty(false);
      setRestoreId(null);
      history.reload();
      reload();
    }
  }
  return (
    <>
      <PanelTitle title={label(locale, 'content')}>
        <a className="portal-button" href={`/${locale}`} target="_blank" rel="noreferrer">
          {say(locale, 'View public website', 'عرض الموقع العام')}
        </a>
        <button disabled={!dirty || action.pending} onClick={() => void save()}>
          {say(locale, 'Save draft', 'حفظ المسودة')}
        </button>
        <button
          className="primary"
          disabled={dirty || action.pending}
          onClick={() => void publish()}
        >
          {say(locale, 'Publish saved draft', 'نشر المسودة المحفوظة')}
        </button>
      </PanelTitle>
      <p className="portal-hint">
        {say(
          locale,
          'Save edits as a draft, then publish when both languages are ready. Only published sections appear on the website.',
          'احفظ التعديلات كمسودة ثم انشرها بعد تجهيز اللغتين. تظهر الأقسام المنشورة فقط في الموقع.',
        )}{' '}
        {say(locale, 'Revision', 'الإصدار')} {revision}
      </p>
      <Feedback action={action} locale={locale} />
      <div className="portal-content-workspace">
        <aside className="portal-section-list">
          <h3>{say(locale, 'Sections', 'الأقسام')}</h3>
          {blocks.map((block, index) => (
            <div key={block.id} className={selected === block.id ? 'selected' : ''}>
              <button onClick={() => setSelected(block.id)}>
                {text(block.title, locale) || say(locale, block.type, sectionsAr[block.type])}
                <small>
                  {block.visible ? say(locale, 'Visible', 'ظاهر') : say(locale, 'Hidden', 'مخفي')}
                </small>
              </button>
              <div className="portal-actions">
                <button
                  aria-label={say(locale, 'Move section up', 'نقل القسم للأعلى')}
                  disabled={index === 0}
                  onClick={() => move(block.id, -1)}
                >
                  ↑
                </button>
                <button
                  aria-label={say(locale, 'Move section down', 'نقل القسم للأسفل')}
                  disabled={index === blocks.length - 1}
                  onClick={() => move(block.id, 1)}
                >
                  ↓
                </button>
              </div>
            </div>
          ))}
          <button
            onClick={() => {
              const block: ContentBlock = {
                id: crypto.randomUUID(),
                type: 'about',
                title: { ...blankLocalized },
                body: { ...blankLocalized },
                visible: false,
                position: blocks.length,
                items: [],
              };
              updateBlocks([...blocks, block]);
              setSelected(block.id);
            }}
          >
            {say(locale, 'Add section', 'إضافة قسم')}
          </button>
        </aside>
        <section className="portal-editor">
          {selectedBlock ? (
            <form onSubmit={submit(save)}>
              <Field label={say(locale, 'Section type', 'نوع القسم')}>
                <select
                  value={selectedBlock.type}
                  onChange={(e) =>
                    update({ ...selectedBlock, type: e.target.value as ContentBlock['type'] })
                  }
                >
                  {sectionKinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {say(locale, kind, sectionsAr[kind])}
                    </option>
                  ))}
                </select>
              </Field>
              <LocalizedField
                label={label(locale, 'title')}
                value={selectedBlock.title}
                onChange={(title) => update({ ...selectedBlock, title })}
              />
              <LocalizedField
                label={label(locale, 'body')}
                value={selectedBlock.body}
                onChange={(body) => update({ ...selectedBlock, body })}
                multiline
              />
              <Toggle
                label={label(locale, 'visible')}
                checked={selectedBlock.visible}
                onChange={(visible) => update({ ...selectedBlock, visible })}
              />
              <fieldset className="portal-repeater">
                <legend>{say(locale, 'Section items', 'عناصر القسم')}</legend>
                {selectedBlock.items.map((item, index) => (
                  <div className="portal-repeat-row" key={index}>
                    <LocalizedField
                      label={label(locale, 'title')}
                      value={item.title}
                      onChange={(title) =>
                        update({
                          ...selectedBlock,
                          items: selectedBlock.items.map((current, i) =>
                            i === index ? { ...current, title } : current,
                          ),
                        })
                      }
                    />
                    <LocalizedField
                      label={label(locale, 'body')}
                      value={item.body}
                      onChange={(body) =>
                        update({
                          ...selectedBlock,
                          items: selectedBlock.items.map((current, i) =>
                            i === index ? { ...current, body } : current,
                          ),
                        })
                      }
                      multiline
                    />
                    <PhotoField
                      locale={locale}
                      value={item.image ?? ''}
                      onChange={(image) =>
                        update({
                          ...selectedBlock,
                          items: selectedBlock.items.map((current, i) =>
                            i === index
                              ? {
                                  title: current.title,
                                  body: current.body,
                                  ...(image ? { image } : {}),
                                }
                              : current,
                          ),
                        })
                      }
                    />
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        update({
                          ...selectedBlock,
                          items: selectedBlock.items.filter((_, i) => i !== index),
                        })
                      }
                    >
                      {say(locale, 'Remove item', 'حذف العنصر')}
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    update({
                      ...selectedBlock,
                      items: [
                        ...selectedBlock.items,
                        { title: { ...blankLocalized }, body: { ...blankLocalized } },
                      ],
                    })
                  }
                >
                  {say(locale, 'Add item', 'إضافة عنصر')}
                </button>
              </fieldset>
              <div className="portal-actions">
                <FormButtons locale={locale} pending={action.pending} />
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    updateBlocks(blocks.filter((block) => block.id !== selectedBlock.id));
                    setSelected(blocks.find((block) => block.id !== selectedBlock.id)?.id ?? null);
                  }}
                >
                  {say(locale, 'Remove section from draft', 'حذف القسم من المسودة')}
                </button>
              </div>
              {dirty && (
                <p className="portal-hint">
                  {say(
                    locale,
                    'Unsaved draft changes. Save before publishing or leaving this panel.',
                    'توجد تغييرات غير محفوظة. احفظها قبل النشر أو مغادرة هذا القسم.',
                  )}
                </p>
              )}
            </form>
          ) : (
            <Empty locale={locale} />
          )}
        </section>
      </div>
      <h3>{say(locale, 'Content revisions', 'إصدارات المحتوى')}</h3>
      <ResourceState resource={history} locale={locale}>
        {history.data?.revisions.length ? (
          <div className="portal-table-scroll">
            <table className="portal-table">
              <thead>
                <tr>
                  <th>{say(locale, 'Revision', 'الإصدار')}</th>
                  <th>{label(locale, 'date')}</th>
                  <th>{label(locale, 'status')}</th>
                  <th>{say(locale, 'Restore', 'استعادة')}</th>
                </tr>
              </thead>
              <tbody>
                {history.data.revisions.map((entry) => (
                  <tr key={entry.revision}>
                    <td>{entry.revision}</td>
                    <td>{new Date(entry.createdAt).toLocaleString(locale)}</td>
                    <td>
                      {entry.published
                        ? say(locale, 'Published', 'منشور')
                        : say(locale, 'Draft', 'مسودة')}
                    </td>
                    <td>
                      <button
                        disabled={action.pending}
                        onClick={() => setRestoreId(entry.revision)}
                      >
                        {say(locale, 'Restore as draft', 'استعادة كمسودة')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty locale={locale} />
        )}
      </ResourceState>
      {restoreId !== null && (
        <div className="portal-alert">
          <p>
            {say(
              locale,
              'Restore this revision as a new draft? Current unsaved edits will be discarded.',
              'استعادة هذا الإصدار كمسودة جديدة؟ سيتم تجاهل التعديلات غير المحفوظة.',
            )}{' '}
            {restoreId}
          </p>
          <div className="portal-actions">
            <button disabled={action.pending} onClick={() => void restore()}>
              {label(locale, 'confirm')}
            </button>
            <button onClick={() => setRestoreId(null)}>{label(locale, 'cancel')}</button>
          </div>
        </div>
      )}
    </>
  );
}
