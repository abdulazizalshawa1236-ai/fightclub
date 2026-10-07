import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { text } from '@fightclub/shared';
import { getPublicSite } from '../../lib/server';
import { PublicWebsite } from '../../components/public/public-website';

export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const { settings } = await getPublicSite();
  return {
    title: `${text(settings.name, locale)} | ${text(settings.tagline, locale)}`,
    description: `${text(settings.tagline, locale)}. ${text(settings.address, locale)}`,
    alternates: { canonical: `/${locale}`, languages: { ar: '/ar', en: '/en' } },
  };
}

export default async function ClubPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  const site = await getPublicSite();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return <PublicWebsite site={site} locale={locale} today={today} />;
}
