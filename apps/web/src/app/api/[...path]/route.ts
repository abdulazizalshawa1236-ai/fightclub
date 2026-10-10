import 'server-only';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUEST_HEADERS = [
  'accept',
  'content-type',
  'cookie',
  'origin',
  'user-agent',
  'x-hub-signature-256',
] as const;
const RESPONSE_HEADERS = ['content-type', 'content-disposition', 'cache-control'] as const;
const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

async function proxy(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(process.env.API_ORIGIN || 'http://127.0.0.1:4100');
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (process.env.API_PROTECTION_BYPASS)
    headers.set('x-vercel-protection-bypass', process.env.API_PROTECTION_BYPASS);
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (
    process.env.VERCEL === '1' &&
    process.env.TRUSTED_PROXY_SECRET &&
    clientIp &&
    isIP(clientIp)
  ) {
    headers.set('x-fc-client-ip', clientIp);
    headers.set(
      'x-fc-client-signature',
      createHmac('sha256', process.env.TRUSTED_PROXY_SECRET).update(clientIp).digest('hex'),
    );
  }
  let body: ArrayBuffer | undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES)
      return Response.json({ code: 'REQUEST_TOO_LARGE' }, { status: 413 });
    body = await request.arrayBuffer();
    if (body.byteLength > MAX_REQUEST_BYTES)
      return Response.json({ code: 'REQUEST_TOO_LARGE' }, { status: 413 });
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
    });
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie())
      responseHeaders.append('set-cookie', cookie);
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return Response.json(
      {
        code: 'API_UNAVAILABLE',
        message: 'The club service is temporarily unavailable. Please try again.',
      },
      { status: 503 },
    );
  }
}

export {
  proxy as GET,
  proxy as HEAD,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
  proxy as OPTIONS,
};
