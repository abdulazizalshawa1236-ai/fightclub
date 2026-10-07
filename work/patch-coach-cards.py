from pathlib import Path
p=Path('public/js/site.js')
s=p.read_text(encoding='utf-8')
old='''  function cards(s) {
    const items = (s.items || []).map((i) => {
      const img = safeUrl(i.image);
      return h('article', { class: 'card rv' },
        img ? h('div', { class: 'card-img-wrap' }, h('img', { class: 'card-img', src: img, alt: val(i, 'title') || '', loading: 'lazy' })) : null,
        h('div', { class: 'card-body' }, !img && i.icon ? h('div', { class: 'card-ico' }, icon(i.icon, 28)) : null,
          val(i, 'title') && h('h3', { text: val(i, 'title') }), val(i, 'text') && h('p', { text: val(i, 'text') })));
    });
    stagger(items);
    return [head(s), h('div', { class: 'cards' }, ...items)];
  }
'''
new='''  function cards(s) {
    const items = (s.items || []).map((i) => {
      const img = safeUrl(i.image);
      const actions = [];
      const phone = String(i.phone || '').replace(/[^\\d+]/g, '');
      const email = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(String(i.email || '')) ? String(i.email) : '';
      if (phone) actions.push(h('a', { class: 'btn ghost sm', href: 'tel:' + phone, text: tr('اتصل بالمدرب', 'Call coach') }));
      if (email) actions.push(h('a', { class: 'btn ghost sm ltr', href: 'mailto:' + email, text: tr('البريد الإلكتروني', 'Email coach') }));
      return h('article', { class: 'card rv' },
        img ? h('div', { class: 'card-img-wrap' }, h('img', { class: 'card-img', src: img, alt: val(i, 'title') || '', loading: 'lazy' })) : null,
        h('div', { class: 'card-body' }, !img && i.icon ? h('div', { class: 'card-ico' }, icon(i.icon, 28)) : null,
          val(i, 'title') && h('h3', { text: val(i, 'title') }), val(i, 'text') && h('p', { text: val(i, 'text') }),
          actions.length ? h('div', { class: 'card-actions' }, ...actions) : null));
    });
    stagger(items);
    return [head(s), h('div', { class: 'cards' }, ...items)];
  }
'''
if s.count(old)!=1: raise SystemExit(f'site cards block count {s.count(old)}')
p.write_text(s.replace(old,new),encoding='utf-8')

p=Path('src/routes/admin.js'); s=p.read_text(encoding='utf-8')
s=s.replace("'caption', 'caption_en'];", "'caption', 'caption_en', 'phone', 'email'];")
s=s.replace("if (k === 'image' || k === 'link') v = U.safeUrl(v);", "if (k === 'image' || k === 'link') v = U.safeUrl(v);\n      if (k === 'phone') v = v.replace(/[^\\d+]/g, '').slice(0, 20);\n      if (k === 'email' && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v)) v = '';" )
p.write_text(s,encoding='utf-8')

p=Path('public/js/admin.js'); s=p.read_text(encoding='utf-8')
s=s.replace("{ k: 'image', label: 'صورة (تُستخدم بدل الأيقونة)', kind: 'image', full: true }] } },", "{ k: 'image', label: 'صورة (تُستخدم بدل الأيقونة)', kind: 'image', full: true }, { k: 'phone', label: 'هاتف (اختياري)', ltr: true }, { k: 'email', label: 'بريد إلكتروني (اختياري)', ltr: true }] } },")
p.write_text(s,encoding='utf-8')

p=Path('public/css/site.css'); s=p.read_text(encoding='utf-8')
needle='.card-body { padding: 1.6rem 1.5rem 1.8rem; display: grid; gap: .65rem; align-content: start; }'
addition=needle+'\n.card-actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .35rem; }\n.card-actions .btn { font-size: .84rem; padding: .6rem .85rem; }'
if s.count(needle)!=1: raise SystemExit(f'css card-body count {s.count(needle)}')
p.write_text(s.replace(needle,addition),encoding='utf-8')
