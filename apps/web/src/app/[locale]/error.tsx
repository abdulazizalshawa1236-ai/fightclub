'use client';
import { useParams } from 'next/navigation';
export default function SiteError({ reset }: { reset: () => void }) {
  const { locale } = useParams<{ locale: string }>();
  const ar = locale === 'ar';
  return (
    <main
      style={{
        minHeight: '80vh',
        display: 'grid',
        placeContent: 'center',
        padding: '32px',
        textAlign: 'center',
      }}
    >
      <h1>{ar ? 'تعذر تحميل الموقع الآن' : 'The club website is temporarily unavailable'}</h1>
      <p>
        {ar
          ? 'حاول مرة أخرى، أو تواصل مع النادي للاستفسار.'
          : 'Try again, or contact the club for current details.'}
      </p>
      <button onClick={reset} className="fc-button">
        {ar ? 'إعادة المحاولة' : 'Try again'}
      </button>
      <a href="tel:0530335050" style={{ marginTop: 24 }} dir="ltr">
        0530335050
      </a>
    </main>
  );
}
