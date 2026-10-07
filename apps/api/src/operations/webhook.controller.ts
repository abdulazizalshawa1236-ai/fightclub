import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  HttpCode,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { RawBodyRequest } from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../core/database';
const statusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['sent', 'delivered', 'read', 'failed']),
  timestamp: z.string().regex(/^\d+$/),
  biz_opaque_callback_data: z.string().optional(),
  errors: z.array(z.object({ code: z.number().optional() })).optional(),
});
const webhookSchema = z.object({
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({ value: z.object({ statuses: z.array(statusSchema).optional() }) }),
      ),
    }),
  ),
});
export function verifiedSignature(
  body: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const supplied = Buffer.from(signature.slice(7), 'hex'),
    expected = createHmac('sha256', secret).update(body).digest();
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
@Controller('whatsapp/webhook')
export class WebhookController {
  constructor(private readonly db: DatabaseService) {}
  @Get() verify(@Query() query: Record<string, string>, @Res() response: Response): void {
    if (
      !process.env.META_VERIFY_TOKEN ||
      query['hub.mode'] !== 'subscribe' ||
      query['hub.verify_token'] !== process.env.META_VERIFY_TOKEN
    )
      throw new ForbiddenException();
    response.type('text/plain').send(query['hub.challenge']);
  }
  @Post() @HttpCode(200) async receive(
    @Req() request: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const secret = process.env.META_APP_SECRET;
    if (
      !secret ||
      !request.rawBody ||
      !verifiedSignature(request.rawBody, request.get('x-hub-signature-256'), secret)
    )
      throw new ForbiddenException();
    const parsed = webhookSchema.safeParse(request.body);
    if (!parsed.success) throw new BadRequestException('Invalid WhatsApp webhook');
    for (const entry of parsed.data.entry)
      for (const change of entry.changes)
        for (const item of change.value.statuses || []) {
          const status = item.status === 'sent' ? 'accepted' : item.status,
            error = item.errors?.[0]?.code;
          await this.db.transaction(async (client) => {
            await client.query(
              `INSERT INTO whatsapp_receipts(provider_id,correlation_id,status,occurred_at,error) VALUES($1,$2,$3,to_timestamp($4),$5) ON CONFLICT(provider_id) DO UPDATE SET status=excluded.status,occurred_at=excluded.occurred_at,error=excluded.error,correlation_id=coalesce(excluded.correlation_id,whatsapp_receipts.correlation_id) WHERE (excluded.status='read' OR (whatsapp_receipts.status<>'read' AND (excluded.status='delivered' OR (whatsapp_receipts.status<>'delivered' AND excluded.occurred_at>=whatsapp_receipts.occurred_at))))`,
              [
                item.id,
                item.biz_opaque_callback_data || null,
                status,
                Number(item.timestamp),
                error ? `Meta error ${error}` : null,
              ],
            );
            const receipt = (
              await client.query<{ status: string; error: string | null }>(
                'SELECT status,error FROM whatsapp_receipts WHERE provider_id=$1',
                [item.id],
              )
            ).rows[0];
            if (receipt)
              await client.query(
                `UPDATE outbox SET status=$2,provider_id=$1,error=$3,updated_at=now() WHERE (provider_id=$1 OR id::text=$4) AND (status IN ('sending','unknown','accepted','failed') OR (status='delivered' AND $2='read'))`,
                [item.id, receipt.status, receipt.error, item.biz_opaque_callback_data || null],
              );
          });
        }
    return { received: true };
  }
}
