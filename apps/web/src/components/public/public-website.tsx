'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState, type PointerEvent } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import {
  ArrowUpRight,
  CalendarDays,
  Menu,
  X,
  MessageCircle,
  MapPin,
  Phone,
  Mail,
  Instagram,
  ChevronDown,
} from 'lucide-react';
import {
  text,
  whatsappLink,
  type ContentBlock,
  type PublicSite,
  type Locale,
} from '@fightclub/shared';
import { PlanSelector } from './plan-selector';
import { ClassCalendar } from './class-calendar';
import { selectChoice } from './selection-keyboard';

function sectionLink(site: PublicSite, type: ContentBlock['type']): string {
  return `#${site.blocks.find((block) => block.visible && block.type === type)?.id ?? 'main'}`;
}
function clubMessage(locale: Locale): string {
  return locale === 'ar'
    ? 'مرحباً فايت كلوب، أرغب بالاستفسار عن التدريب والاشتراك.\nالاسم الكامل:\nطفل أم بالغ:\nالرياضة المطلوبة:\nالأوقات المفضلة:'
    : 'Hello Fight Club, I would like to ask about training and membership.\nFull name:\nChild or adult:\nRequested sport:\nPreferred times:';
}
function SectionIntro({ block, locale }: { block: ContentBlock; locale: Locale }) {
  return (
    <header className="fc-section-heading">
      <h2>{text(block.title, locale)}</h2>
      {text(block.body, locale) && <p>{text(block.body, locale)}</p>}
    </header>
  );
}
function WhatsAppButton({
  site,
  locale,
  className = '',
  message,
  label,
}: {
  site: PublicSite;
  locale: Locale;
  className?: string;
  message?: string;
  label?: string;
}) {
  const href = whatsappLink(site.settings, message ?? clubMessage(locale));
  return href ? (
    <a className={`fc-button ${className}`} href={href} target="_blank" rel="noopener noreferrer">
      <MessageCircle size={18} aria-hidden="true" />
      {label || (locale === 'ar' ? 'انضم عبر واتساب' : 'Join via WhatsApp')}
    </a>
  ) : (
    <a className={`fc-button ${className}`} href={sectionLink(site, 'contact')}>
      {locale === 'ar' ? 'تواصل مع النادي' : 'Contact the club'}
    </a>
  );
}
function Hero({ site, locale, block }: { site: PublicSite; locale: Locale; block: ContentBlock }) {
  const ref = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const rotation = useTransform(scrollYProgress, [0, 1], [-5, 6]);
  const heroImage = block.items.find((item) => item.image)?.image ?? '/assets/logo-inner.png';
  const pointerX = useSpring(0, { stiffness: 100, damping: 22 });
  const pointerY = useSpring(0, { stiffness: 100, damping: 22 });
  const tiltX = useTransform(pointerY, [-7, 7], [3, -3]);
  const tiltY = useTransform(pointerX, [-9, 9], [-4, 4]);
  function followPointer(event: PointerEvent<HTMLDivElement>) {
    if (
      reducedMotion ||
      event.pointerType !== 'mouse' ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    )
      return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX.set(
      Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5)) * 18,
    );
    pointerY.set(
      Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5)) * 14,
    );
  }
  return (
    <section className="fc-hero" id={block.id} ref={ref} aria-labelledby={`${block.id}-title`}>
      <div className="fc-hero-body fc-container">
        <div className="fc-hero-copy">
          <p className="fc-location">
            <MapPin size={15} />
            {text(site.settings.address, locale)}
          </p>
          <motion.h1
            id={`${block.id}-title`}
            initial={reducedMotion ? false : { opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {text(block.title, locale)}
          </motion.h1>
          <p>{text(block.body, locale)}</p>
          <div className="fc-hero-actions">
            <WhatsAppButton
              site={site}
              locale={locale}
              label={block.items[0] ? text(block.items[0].title, locale) : undefined}
            />
            <a className="fc-button fc-button-outline" href={sectionLink(site, 'schedule')}>
              <CalendarDays size={18} />
              {block.items[1]
                ? text(block.items[1].title, locale)
                : locale === 'ar'
                  ? 'جدول الحصص'
                  : 'View class schedule'}
            </a>
          </div>
          <Link href={`/${locale}/account`} className="fc-member-link">
            {locale === 'ar'
              ? 'مشترك بالفعل؟ ادخل إلى حسابك'
              : 'Already a member? Access your account'}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
        <motion.div
          className="fc-hero-brand"
          style={reducedMotion ? undefined : { y, rotate: rotation }}
          onPointerMove={followPointer}
          onPointerLeave={() => {
            pointerX.set(0);
            pointerY.set(0);
          }}
        >
          <motion.div
            className="fc-hero-interactive"
            style={
              reducedMotion
                ? undefined
                : { x: pointerX, y: pointerY, rotateX: tiltX, rotateY: tiltY }
            }
          >
            <svg className="fc-ring-lines" viewBox="0 0 600 560" fill="none" aria-hidden="true">
              <motion.path
                d="M40 125L500 40L570 430L110 515Z M54 160L508 77L563 398L105 480Z M62 194L513 108L557 366L100 446Z"
                stroke="currentColor"
                strokeWidth="2"
                initial={reducedMotion ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 1.4, ease: 'easeInOut' }}
              />
              <path d="M40 125L110 515M500 40L570 430" stroke="currentColor" strokeWidth="9" />
            </svg>
            <div className="fc-hero-logo">
              <Image
                src={heroImage}
                unoptimized={heroImage.startsWith('http')}
                alt={text(site.settings.name, locale)}
                fill
                priority
                sizes="(max-width: 800px) 85vw, 42vw"
              />
            </div>
            <span className="fc-hero-caption">{text(site.settings.tagline, locale)}</span>
          </motion.div>
        </motion.div>
      </div>
      <div
        className="fc-sport-ticker"
        aria-label={locale === 'ar' ? 'رياضات النادي' : 'Club disciplines'}
      >
        <div>
          {site.sports
            .filter((sport) => sport.available)
            .map((sport) => (
              <a key={sport.id} href={sectionLink(site, 'programs')}>
                {text(sport.name, locale)}
                <span aria-hidden="true">✦</span>
              </a>
            ))}
        </div>
      </div>
    </section>
  );
}
function Programs({
  block,
  site,
  locale,
}: {
  block: ContentBlock;
  site: PublicSite;
  locale: Locale;
}) {
  const sports = block.items.length
    ? block.items.map((item, index) => ({
        id: `${block.id}-${index}`,
        name: item.title,
        description: item.body,
        image: item.image,
      }))
    : site.sports.filter((sport) => sport.available);
  const [activeId, setActiveId] = useState(sports[0]?.id ?? '');
  const active = sports.find((sport) => sport.id === activeId) ?? sports[0];
  const reduced = useReducedMotion();
  return (
    <section id={block.id} className="fc-section fc-programs">
      <div className="fc-container">
        <SectionIntro block={block} locale={locale} />
        <div className="fc-program-layout">
          <div
            className="fc-program-options"
            role="group"
            aria-label={text(block.title, locale)}
            onKeyDown={(event) =>
              selectChoice(
                event,
                sports.map((sport) => sport.id),
                active?.id ?? '',
                setActiveId,
                locale === 'ar',
              )
            }
          >
            {sports.map((sport) => (
              <button
                type="button"
                key={sport.id}
                aria-pressed={sport.id === active?.id}
                onClick={() => setActiveId(sport.id)}
              >
                <span>{text(sport.name, locale)}</span>
                <ArrowUpRight size={23} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="fc-program-detail" aria-live="polite">
            <motion.div className="fc-mat" aria-hidden="true">
              <motion.div
                animate={{
                  rotate: reduced
                    ? 45
                    : 45 +
                      Math.max(
                        0,
                        sports.findIndex((sport) => sport.id === active?.id),
                      ) *
                        8,
                }}
                transition={{ type: 'spring', stiffness: 110, damping: 22 }}
              />
              <motion.div
                animate={{
                  rotate: reduced
                    ? 45
                    : 45 -
                      Math.max(
                        0,
                        sports.findIndex((sport) => sport.id === active?.id),
                      ) *
                        5,
                }}
                transition={{ type: 'spring', stiffness: 110, damping: 22 }}
              />
              <motion.span
                key={active?.id}
                initial={false}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.2 }}
              >
                FC
              </motion.span>
            </motion.div>
            <AnimatePresence mode="wait">
              {active && (
                <motion.div
                  key={active.id}
                  initial={reduced ? false : { opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3>{text(active.name, locale)}</h3>
                  <p>{text(active.description, locale)}</p>
                  <a className="fc-text-link" href={sectionLink(site, 'schedule')}>
                    {locale === 'ar' ? 'اكتشف مواعيد التدريب' : 'Explore training times'}
                    <CalendarDays size={18} />
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {block.items
          .filter((item) => item.image)
          .map((item, index) => (
            <article className="fc-editorial-item" key={index}>
              <Image
                src={item.image!}
                unoptimized={Boolean(item.image?.startsWith('http'))}
                alt={text(item.title, locale)}
                width={640}
                height={420}
              />
              <h3>{text(item.title, locale)}</h3>
              <p>{text(item.body, locale)}</p>
            </article>
          ))}
      </div>
    </section>
  );
}
function PublicBlock({
  block,
  site,
  locale,
  today,
}: {
  block: ContentBlock;
  site: PublicSite;
  locale: Locale;
  today: string;
}) {
  if (block.type === 'hero') return <Hero site={site} locale={locale} block={block} />;
  if (block.type === 'programs') return <Programs site={site} locale={locale} block={block} />;
  if (block.type === 'about')
    return (
      <section className="fc-section fc-about" id={block.id}>
        <div className="fc-container fc-about-layout">
          <h2>{text(block.title, locale)}</h2>
          <div>
            <p>{text(block.body, locale)}</p>
            {block.items.map((item, index) => (
              <article key={index}>
                <h3>{text(item.title, locale)}</h3>
                <p>{text(item.body, locale)}</p>
                {item.image && (
                  <Image
                    src={item.image}
                    unoptimized={item.image.startsWith('http')}
                    width={720}
                    height={480}
                    alt={text(item.title, locale)}
                  />
                )}
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  if (block.type === 'plans')
    return (
      <section id={block.id} className="fc-section fc-plans">
        <div className="fc-container">
          <SectionIntro block={block} locale={locale} />
          <PlanSelector site={site} locale={locale} />
        </div>
      </section>
    );
  if (block.type === 'schedule')
    return (
      <section id={block.id} className="fc-section fc-schedule">
        <div className="fc-container">
          <SectionIntro block={block} locale={locale} />
          <ClassCalendar site={site} locale={locale} today={today} />
        </div>
      </section>
    );
  if (block.type === 'offers') {
    const offers = site.offers.filter(
      (offer) => offer.visible && offer.startsOn <= today && offer.endsOn >= today,
    );
    return (
      <section className="fc-section fc-offers" id={block.id}>
        <div className="fc-container">
          <SectionIntro block={block} locale={locale} />
          {offers.length ? (
            <div className="fc-offer-grid">
              {offers.map((offer) => (
                <article key={offer.id}>
                  <span className="fc-tag">{text(offer.badge, locale)}</span>
                  <h3>{text(offer.title, locale)}</h3>
                  <p>{text(offer.description, locale)}</p>
                  <p>
                    {locale === 'ar' ? 'من' : 'From'} <bdi>{offer.startsOn}</bdi>{' '}
                    {locale === 'ar' ? 'إلى' : 'to'} <bdi>{offer.endsOn}</bdi>
                  </p>
                  <details>
                    <summary>{locale === 'ar' ? 'الشروط' : 'Terms'}</summary>
                    <p>{text(offer.terms, locale)}</p>
                  </details>
                  <WhatsAppButton
                    site={site}
                    locale={locale}
                    message={
                      locale === 'ar'
                        ? `مرحباً، أود الاستفسار عن عرض ${offer.title.ar}`
                        : `Hello, I would like to ask about ${offer.title.en}`
                    }
                  />
                </article>
              ))}
            </div>
          ) : (
            <p className="fc-empty">
              {locale === 'ar'
                ? 'لا توجد عروض سارية حالياً. يمكنك الاطلاع على باقات الاشتراك.'
                : 'There are no active offers right now. Explore our membership plans.'}
            </p>
          )}
        </div>
      </section>
    );
  }
  if (block.type === 'coaches')
    return (
      <section id={block.id} className="fc-section fc-coaches">
        <div className="fc-container">
          <SectionIntro block={block} locale={locale} />
          <div className="fc-coach-grid">
            {site.coaches.map((coach) => (
              <article className="fc-coach" key={coach.id}>
                <div className="fc-coach-image">
                  <Image
                    src={coach.image}
                    unoptimized={coach.image.startsWith('http')}
                    alt={text(coach.name, locale)}
                    fill
                    sizes="(max-width: 560px) 85vw, (max-width: 1000px) 40vw, 25vw"
                  />
                </div>
                <h3>{text(coach.name, locale)}</h3>
                <p>{text(coach.bio, locale)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  if (block.type === 'corporate')
    return (
      <section id={block.id} className="fc-section fc-corporate">
        <div className="fc-container">
          <SectionIntro block={block} locale={locale} />
          <div className="fc-corporate-items">
            {block.items.map((item, index) => (
              <article key={index}>
                <h3>{text(item.title, locale)}</h3>
                <p>{text(item.body, locale)}</p>
              </article>
            ))}
          </div>
          <WhatsAppButton
            site={site}
            locale={locale}
            message={
              locale === 'ar'
                ? 'مرحباً، أود الاستفسار عن برامج الشركات في فايت كلوب.\nاسم الجهة:\nعدد المشاركين:\nالأوقات المطلوبة:'
                : 'Hello, I would like to ask about Fight Club corporate programs.\nOrganization:\nGroup size:\nPreferred times:'
            }
          />
        </div>
      </section>
    );
  if (block.type === 'faq')
    return (
      <section id={block.id} className="fc-section fc-faq">
        <div className="fc-container fc-faq-layout">
          <SectionIntro block={block} locale={locale} />
          <div>
            {block.items.map((item, index) => (
              <details key={index}>
                <summary>
                  {text(item.title, locale)}
                  <ChevronDown size={20} />
                </summary>
                <p>{text(item.body, locale)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
    );
  if (block.type === 'contact')
    return (
      <section id={block.id} className="fc-section fc-contact">
        <div className="fc-container fc-contact-layout">
          <div>
            <SectionIntro block={block} locale={locale} />
            <WhatsAppButton site={site} locale={locale} />
          </div>
          <div className="fc-contact-details">
            <a href={`tel:${site.settings.phone}`}>
              <Phone size={20} />
              <bdi>{site.settings.phone}</bdi>
            </a>
            <a href={`mailto:${site.settings.email}`}>
              <Mail size={20} />
              <bdi>{site.settings.email}</bdi>
            </a>
            <p>
              <MapPin size={20} />
              {text(site.settings.address, locale)}
            </p>
            {text(site.settings.hours, locale) && <p>{text(site.settings.hours, locale)}</p>}
            {site.settings.mapUrl && (
              <a href={site.settings.mapUrl} target="_blank" rel="noopener noreferrer">
                {locale === 'ar' ? 'افتح الخريطة' : 'Open map'}
                <ArrowUpRight size={18} />
              </a>
            )}
            {site.settings.instagram && (
              <a href={site.settings.instagram} target="_blank" rel="noopener noreferrer">
                <Instagram size={20} />
                Instagram
              </a>
            )}
          </div>
        </div>
      </section>
    );
  return (
    <section id={block.id} className="fc-section">
      <div className="fc-container">
        <SectionIntro block={block} locale={locale} />
        <div className="fc-gallery">
          {block.items.map((item, index) => (
            <article key={index}>
              {item.image && (
                <Image
                  src={item.image}
                  unoptimized={item.image.startsWith('http')}
                  alt={text(item.title, locale)}
                  width={800}
                  height={600}
                  sizes="(max-width: 700px) 90vw, 40vw"
                />
              )}
              <h3>{text(item.title, locale)}</h3>
              <p>{text(item.body, locale)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PublicWebsite({
  site,
  locale,
  today,
}: {
  site: PublicSite;
  locale: Locale;
  today: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ar = locale === 'ar';
  const blocks = site.blocks
    .filter((block) => block.visible)
    .sort((a, b) => a.position - b.position);
  const navTypes = ['programs', 'plans', 'schedule', 'coaches', 'contact'];
  const links = blocks.filter((block) => navTypes.includes(block.type));
  return (
    <div className="fc-website">
      <a href="#main" className="fc-skip">
        {ar ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <header className="fc-nav">
        <div className="fc-container fc-nav-inner">
          <Link
            className="fc-nav-logo"
            href={`/${locale}`}
            aria-label={text(site.settings.name, locale)}
          >
            <Image src="/assets/logo-inner.png" alt="" width={108} height={75} priority />
          </Link>
          <nav
            id="fc-menu"
            className={menuOpen ? 'fc-nav-menu fc-nav-menu-open' : 'fc-nav-menu'}
            aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}
          >
            {links.map((block) => (
              <a href={`#${block.id}`} key={block.id} onClick={() => setMenuOpen(false)}>
                {text(block.title, locale)}
              </a>
            ))}
          </nav>
          <div className="fc-nav-actions">
            <Link href={`/${ar ? 'en' : 'ar'}`} lang={ar ? 'en' : 'ar'} className="fc-language">
              {ar ? 'English' : 'العربية'}
            </Link>
            <Link href={`/${locale}/account`} className="fc-nav-member">
              {ar ? 'دخول المشتركين' : 'Member login'}
              <ArrowUpRight size={15} />
            </Link>
            <button
              className="fc-menu-button"
              aria-expanded={menuOpen}
              aria-controls="fc-menu"
              aria-label={
                menuOpen ? (ar ? 'إغلاق القائمة' : 'Close menu') : ar ? 'فتح القائمة' : 'Open menu'
              }
              onClick={() => setMenuOpen((value) => !value)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main id="main">
        {blocks.map((block) => (
          <PublicBlock key={block.id} block={block} site={site} locale={locale} today={today} />
        ))}
      </main>
      <footer className="fc-footer">
        <div className="fc-container">
          <p>
            © {today.slice(0, 4)} {text(site.settings.name, locale)}
          </p>
          <span>{text(site.settings.tagline, locale)}</span>
          <Link href={`/${locale}/admin`}>{ar ? 'إدارة النادي' : 'Club administration'}</Link>
        </div>
      </footer>
      <div className="fc-mobile-cta">
        <WhatsAppButton site={site} locale={locale} />
        <a href={sectionLink(site, 'schedule')} aria-label={ar ? 'جدول الحصص' : 'Class schedule'}>
          <CalendarDays size={23} />
        </a>
      </div>
    </div>
  );
}
