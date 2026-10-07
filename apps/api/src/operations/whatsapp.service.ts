import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { z } from 'zod';
import type { Locale } from '@fightclub/shared';

export class ProviderRejected extends Error {
  constructor(
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
  }
}
export class ProviderUnknown extends Error {}
const responseSchema = z.object({ messages: z.array(z.object({ id: z.string() })).min(1) });
@Injectable()
export class WhatsAppService {
  configured(event: string): boolean {
    return Boolean(
      process.env.META_PHONE_NUMBER_ID && process.env.META_ACCESS_TOKEN && this.template(event),
    );
  }
  template(event: string): string | undefined {
    const names: Record<string, string> = {
      login: 'META_AUTH_TEMPLATE',
      expiring: 'META_EXPIRING_TEMPLATE',
      expired: 'META_EXPIRED_TEMPLATE',
      renewed: 'META_RENEWED_TEMPLATE',
      offer: 'META_MARKETING_TEMPLATE',
    };
    const key = names[event];
    return key ? process.env[key] : undefined;
  }
  async sendAuthentication(
    phone: string,
    code: string,
    locale: Locale,
    challengeId: string,
  ): Promise<string> {
    if (!this.configured('login'))
      throw new ServiceUnavailableException({
        code: 'WHATSAPP_UNAVAILABLE',
        message: 'WhatsApp verification is currently unavailable. Contact the club.',
      });
    return this.send(phone, 'login', locale, [code], challengeId, true);
  }
  async send(
    phone: string,
    event: string,
    locale: Locale,
    parameters: string[],
    correlationId: string,
    authentication = false,
  ): Promise<string> {
    const template = this.template(event);
    if (!template || !this.configured(event))
      throw new ProviderRejected(false, 'Approved WhatsApp template or credentials missing');
    const components: unknown[] = [
      { type: 'body', parameters: parameters.map((text) => ({ type: 'text', text })) },
    ];
    if (authentication)
      components.push({
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [{ type: 'text', text: parameters[0] }],
      });
    let response: Response;
    try {
      response = await fetch(
        `https://graph.facebook.com/${process.env.META_GRAPH_VERSION || 'v23.0'}/${process.env.META_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.META_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            biz_opaque_callback_data: correlationId,
            template: {
              name: template,
              language: { code: locale === 'ar' ? 'ar' : 'en' },
              components,
            },
          }),
          signal: AbortSignal.timeout(12000),
        },
      );
    } catch {
      throw new ProviderUnknown(
        'Provider response unknown; await delivery webhook before operator reconciliation',
      );
    }
    if (!response.ok)
      throw new ProviderRejected(
        response.status === 429,
        `Meta rejected delivery with HTTP ${response.status}`,
      );
    const parsed = responseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success)
      throw new ProviderUnknown('Provider accepted request without a usable message receipt');
    const id = parsed.data.messages[0]?.id;
    if (!id) throw new ProviderUnknown('Provider receipt missing');
    return id;
  }
}
