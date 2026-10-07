import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import '../globals.css';
export const metadata: Metadata = {
  title: { default: 'Fight Club | فايت كلوب', template: '%s | Fight Club' },
  icons: { icon: '/assets/favicon.png', apple: '/assets/apple-touch-icon.png' },
};
import './public.css';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <body>{children}</body>
    </html>
  );
}
