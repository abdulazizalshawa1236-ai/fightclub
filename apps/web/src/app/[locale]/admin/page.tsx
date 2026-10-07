import { notFound } from 'next/navigation';
import { AdminPortal } from '@/components/portals/admin';
export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== 'ar' && locale !== 'en') notFound();
  return <AdminPortal locale={locale} />;
}
