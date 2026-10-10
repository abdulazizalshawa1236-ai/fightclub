import 'server-only';
import { cache } from 'react';
import type { PublicSite } from '@fightclub/shared';
export const getPublicSite = cache(async (): Promise<PublicSite> => {
  const response = await fetch(
    `${process.env.API_ORIGIN || 'http://127.0.0.1:4100'}/api/public/site`,
    {
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
      headers: process.env.API_PROTECTION_BYPASS
        ? { 'x-vercel-protection-bypass': process.env.API_PROTECTION_BYPASS }
        : undefined,
    },
  );
  if (!response.ok) throw new Error('Club content is temporarily unavailable');
  return response.json() as Promise<PublicSite>;
});
