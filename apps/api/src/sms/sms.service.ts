import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { Locale } from '@fightclub/shared';
import { ProviderRejected, ProviderUnknown } from '../core/delivery-errors';
import { SmsHttpClient } from './sms-http.client';
const rejectionResponse = z.object({ statusCode: z.literal(201), rejected: z.string() });
const acceptedResponse = z.object({
  statusCode: z.literal(201),
  messageId: z.union([z.number().int().positive().safe(), z.string().regex(/^[1-9]\d{0,39}$/)]),
  totalCount: z.number().int().min(0).max(1),
  accepted: z.string(),
  rejected: z.string(),
});
function recipientList(value: string): string[] | null {
  if (!value.startsWith('[') || !value.endsWith(']')) return null;
  const body = value.slice(1, -1).trim();
  if (!body) return [];
  const entries = body.split(',').map((entry) => entry.trim());
  if (entries.at(-1) === '') entries.pop();
  return entries.every((entry) => /^\d{8,15}$/.test(entry)) ? entries : null;
}
@Injectable()
export class SmsService {
  constructor(private readonly http: SmsHttpClient) {}
  configured(): boolean {
    return (
      process.env.SMS_PROVIDER === 'taqnyat' &&
      Boolean(process.env.TAQNYAT_BEARER_TOKEN?.trim()) &&
      Boolean(process.env.TAQNYAT_SENDER?.trim())
    );
  }
  assertConfigured(): void {
    if (!this.configured())
      throw new ServiceUnavailableException({
        code: 'SMS_UNAVAILABLE',
        message: 'SMS verification is currently unavailable. Please contact the club.',
      });
  }
  async sendAuthentication(phone: string, code: string, locale: Locale): Promise<string> {
    this.assertConfigured();
    if (!/^9665\d{8}$/.test(phone) || !/^\d{6}$/.test(code))
      throw new ProviderRejected(false, 'Invalid SMS authentication request');
    const bearer = process.env.TAQNYAT_BEARER_TOKEN?.trim(),
      sender = process.env.TAQNYAT_SENDER?.trim();
    if (!bearer || !sender)
      throw new ServiceUnavailableException({
        code: 'SMS_UNAVAILABLE',
        message: 'SMS verification is currently unavailable. Please contact the club.',
      });
    const body =
      locale === 'ar'
        ? `رمز الدخول إلى فايت كلوب: ${code}. صالح لمدة 5 دقائق. لا تشارك الرمز مع أي شخص.`
        : `Your Fight Club login code is ${code}. Valid for 5 minutes. Do not share this code.`;
    let response: Response;
    try {
      response = await this.http.post({ recipients: [phone], body, sender }, bearer);
    } catch {
      throw new ProviderUnknown('SMS provider outcome is unknown. Do not automatically retry.');
    }
    if (response.status >= 400 && response.status < 500)
      throw new ProviderRejected(
        false,
        `SMS provider rejected request with HTTP ${response.status}`,
      );
    if (response.status !== 201)
      throw new ProviderUnknown(
        'SMS provider returned an uncertain response. Do not automatically retry.',
      );
    const raw: unknown = await response.json().catch(() => null);
    const rejection = rejectionResponse.safeParse(raw);
    if (rejection.success && recipientList(rejection.data.rejected)?.includes(phone))
      throw new ProviderRejected(false, 'SMS provider rejected the recipient');
    const parsed = acceptedResponse.safeParse(raw);
    if (!parsed.success) throw new ProviderUnknown('SMS provider receipt is missing or malformed.');
    const accepted = recipientList(parsed.data.accepted),
      rejected = recipientList(parsed.data.rejected);
    if (
      !accepted ||
      !rejected ||
      parsed.data.totalCount !== 1 ||
      accepted.length !== 1 ||
      accepted[0] !== phone ||
      rejected.length !== 0
    )
      throw new ProviderUnknown('SMS provider did not confirm this recipient was accepted.');
    return String(parsed.data.messageId);
  }
}
