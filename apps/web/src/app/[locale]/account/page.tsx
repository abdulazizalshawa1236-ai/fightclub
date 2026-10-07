import { notFound } from 'next/navigation';
import { MemberPortal } from '@/components/portals/account';
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <MemberPortal locale={locale} />;
}
