import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { IncomingHttpHeaders } from 'node:http';

export function clientIpOf(request: { ip?: string; headers: IncomingHttpHeaders }): string {
  const secret = process.env.TRUSTED_PROXY_SECRET;
  const ip = request.headers['x-fc-client-ip'];
  const signature = request.headers['x-fc-client-signature'];
  if (
    secret &&
    typeof ip === 'string' &&
    isIP(ip) &&
    typeof signature === 'string' &&
    /^[a-f0-9]{64}$/.test(signature)
  ) {
    const expected = createHmac('sha256', secret).update(ip).digest();
    if (timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return ip;
  }
  return request.ip || 'unknown';
}
