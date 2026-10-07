import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { MessageDelivery, Locale, ClubSettings } from '@fightclub/shared';
import { text, renderMembershipReminder } from '@fightclub/shared';
import { SmsService } from '../sms/sms.service';
import { DatabaseService } from '../core/database';
import { parse, uuidSchema } from '../core/validation';
import { WhatsAppService } from './whatsapp.service';
import { ProviderRejected, ProviderUnknown } from '../core/delivery-errors';
const translated = z
  .object({ ar: z.string().min(1).max(3000), en: z.string().min(1).max(3000) })
  .strict();
const announcement = z
  .object({
    title: translated,
    body: translated,
    target: z.enum(['all', 'active', 'member', 'marketing']),
    memberId: uuidSchema.optional(),
    sendWhatsapp: z.boolean(),
  })
  .strict()
  .refine((x) => x.target !== 'member' || !!x.memberId, 'Select a member');
interface Pending {
  id: string;
  member_id: string | null;
  event: string;
  category: 'authentication' | 'utility' | 'marketing';
  payload: Record<string, unknown>;
  attempts: number;
}
interface Recipient {
  full_name: string;
  phone: string;
  identity_version: number;
  preferred_language: Locale;
  updates_consent: boolean;
  marketing_consent: boolean;
  access_enabled: boolean;
  archived_at: Date | null;
}
@Injectable()
export class CommunicationsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly whatsapp: WhatsAppService,
    private readonly sms: SmsService,
  ) {}
  async list(): Promise<{
    messages: MessageDelivery[];
    configured: { authentication: boolean; utility: boolean; marketing: boolean };
  }> {
    const rows = await this.db.query<{
      id: string;
      full_name: string | null;
      channel: MessageDelivery['channel'];
      category: MessageDelivery['category'];
      event: string;
      status: MessageDelivery['status'];
      error: string | null;
      created_at: Date;
    }>(
      'SELECT o.*,m.full_name FROM outbox o LEFT JOIN members m ON m.id=o.member_id ORDER BY o.created_at DESC LIMIT 200',
    );
    return {
      messages: rows.rows.map((x) => ({
        id: x.id,
        memberName: x.full_name || '',
        channel: x.channel,
        category: x.category,
        event: x.event,
        status: x.status,
        error: x.error,
        createdAt: x.created_at.toISOString(),
      })),
      configured: {
        authentication: this.sms.configured(),
        utility: ['expiring', 'expired', 'renewed'].every((e) => this.whatsapp.configured(e)),
        marketing: this.whatsapp.configured('offer'),
      },
    };
  }
  async announce(input: unknown, actor: string): Promise<{ id: string; recipients: number }> {
    const data = parse(announcement, input);
    if (data.sendWhatsapp && data.target !== 'marketing')
      throw new BadRequestException(
        'WhatsApp broadcasts require the marketing audience and opted-in recipients',
      );
    return this.db.transaction(async (client) => {
      const id = randomUUID();
      if (
        data.memberId &&
        !(
          await client.query('SELECT id FROM members WHERE id=$1 AND archived_at IS NULL', [
            data.memberId,
          ])
        ).rowCount
      )
        throw new BadRequestException('Member unavailable');
      await client.query(
        'INSERT INTO announcements(id,title,body,target,member_id) VALUES($1,$2,$3,$4,$5)',
        [
          id,
          JSON.stringify(data.title),
          JSON.stringify(data.body),
          data.target,
          data.memberId || null,
        ],
      );
      let recipients = 0;
      if (data.sendWhatsapp) {
        const members = (
          await client.query<{ id: string; identity_version: number }>(
            'SELECT id,identity_version FROM members WHERE marketing_consent AND phone_verified_at IS NOT NULL AND access_enabled AND archived_at IS NULL',
          )
        ).rows;
        for (const member of members) {
          await client.query(
            "INSERT INTO outbox(id,member_id,event,payload,category,event_key) VALUES($1,$2,'offer',$3,'marketing',$4) ON CONFLICT(event_key) DO NOTHING",
            [
              randomUUID(),
              member.id,
              JSON.stringify({ announcementId: id, phoneVersion: member.identity_version }),
              `announcement:${id}:${member.id}`,
            ],
          );
          recipients++;
        }
      }
      await client.query(
        "INSERT INTO audit_events(id,actor,action,details) VALUES($1,$2,'announcement.created',$3)",
        [randomUUID(), actor, JSON.stringify({ id, target: data.target, recipients })],
      );
      return { id, recipients };
    });
  }
  async enqueueExpiry(): Promise<void> {
    await this.db.transaction(async (client) => {
      const settings = (
        await client.query<{ data: ClubSettings }>('SELECT data FROM site_settings WHERE id=1')
      ).rows[0]?.data;
      const warning = settings?.warningDays ?? 3;
      await client.query(
        `INSERT INTO outbox(id,member_id,event,payload,category,event_key)
 SELECT gen_random_uuid(),m.member_id,CASE WHEN m.end_date < (now() AT TIME ZONE 'Asia/Riyadh')::date THEN 'expired' ELSE 'expiring' END,
 jsonb_build_object('membershipId',m.id,'membershipVersion',m.version,'endDate',to_char(m.end_date,'YYYY-MM-DD'),'phoneVersion',p.identity_version),'utility',
 m.id::text||':'||m.version::text||':'||CASE WHEN m.end_date < (now() AT TIME ZONE 'Asia/Riyadh')::date THEN 'expired' ELSE 'expiring' END
 FROM memberships m JOIN members p ON p.id=m.member_id WHERE m.current AND NOT m.suspended AND m.start_date<=(now() AT TIME ZONE 'Asia/Riyadh')::date AND (m.end_date<(now() AT TIME ZONE 'Asia/Riyadh')::date OR m.end_date-(now() AT TIME ZONE 'Asia/Riyadh')::date+1<=$1::integer) AND p.archived_at IS NULL AND p.access_enabled AND p.updates_consent AND p.phone_verified_at IS NOT NULL ON CONFLICT(event_key) DO NOTHING`,
        [warning],
      );
    });
  }
  async recover(): Promise<void> {
    await this.db.query(
      "UPDATE outbox SET status='unknown',error='Worker interrupted during provider request; awaiting receipt or operator reconciliation',updated_at=now() WHERE status='sending' AND claimed_at<now()-interval '2 minutes'",
    );
    await this.db.query(
      `UPDATE outbox o SET status=r.status,provider_id=r.provider_id,error=r.error,updated_at=now() FROM whatsapp_receipts r WHERE o.channel='whatsapp' AND (o.provider_id=r.provider_id OR o.id::text=r.correlation_id) AND (o.status IN ('sending','unknown','accepted') OR (o.status='delivered' AND r.status='read'))`,
    );
  }
  async dispatchOne(): Promise<boolean> {
    const pending = await this.db.transaction(async (client) => {
      const row = (
        await client.query<Pending>(
          "SELECT * FROM outbox WHERE channel='whatsapp' AND status='queued' AND next_attempt_at<=now() AND category<>'authentication' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
        )
      ).rows[0];
      if (!row) return null;
      await client.query(
        "UPDATE outbox SET status='sending',attempts=attempts+1,claim_token=$2,claimed_at=now(),updated_at=now() WHERE id=$1",
        [row.id, randomUUID()],
      );
      return row;
    });
    if (!pending) return false;
    return this.db.transaction(async (client) => {
      const finish = async (status: string, error: string | null) => {
        await client.query('UPDATE outbox SET status=$2,error=$3,updated_at=now() WHERE id=$1', [
          pending.id,
          status,
          error,
        ]);
      };
      if (!pending.member_id) {
        await finish('suppressed', 'Member unavailable');
        return true;
      }
      const recipient = (
        await client.query<Recipient>('SELECT * FROM members WHERE id=$1 FOR UPDATE', [
          pending.member_id,
        ])
      ).rows[0];
      if (
        !recipient ||
        recipient.archived_at ||
        !recipient.access_enabled ||
        (pending.category === 'utility'
          ? !recipient.updates_consent
          : !recipient.marketing_consent) ||
        typeof pending.payload.phoneVersion !== 'number' ||
        pending.payload.phoneVersion !== recipient.identity_version
      ) {
        await finish('suppressed', 'Consent, access or verified phone changed');
        return true;
      }
      const verified = (
        await client.query<{ verified: boolean }>(
          'SELECT phone_verified_at IS NOT NULL AS verified FROM members WHERE id=$1',
          [pending.member_id],
        )
      ).rows[0]?.verified;
      if (!verified) {
        await finish('suppressed', 'Phone has not been verified');
        return true;
      }
      let params: string[] = [];
      if (pending.category === 'utility') {
        const membership = (
          await client.query<{
            id: string;
            version: number;
            current: boolean;
            suspended: boolean;
            start_date: string;
            end_date: string;
            plan_snapshot: { name: { ar: string; en: string } };
          }>(
            'SELECT id,version,current,suspended,start_date::text,end_date::text,plan_snapshot FROM memberships WHERE member_id=$1 AND current',
            [pending.member_id],
          )
        ).rows[0];
        if (
          !membership ||
          membership.suspended ||
          (typeof pending.payload.membershipId === 'string' &&
            pending.payload.membershipId !== membership.id) ||
          (typeof pending.payload.membershipVersion === 'number' &&
            pending.payload.membershipVersion !== membership.version)
        ) {
          await finish('suppressed', 'Membership changed since notification was queued');
          return true;
        }
        const today =
          (
            await client.query<{ today: string }>(
              "SELECT to_char(now() AT TIME ZONE 'Asia/Riyadh','YYYY-MM-DD') AS today",
            )
          ).rows[0]?.today || '';
        if (
          (pending.event === 'expired' && membership.end_date >= today) ||
          (pending.event === 'expiring' &&
            (membership.end_date < today || membership.start_date > today))
        ) {
          await finish('suppressed', 'Membership status no longer matches event');
          return true;
        }
        const settings = (
          await client.query<{ data: ClubSettings }>('SELECT data FROM site_settings WHERE id=1')
        ).rows[0]?.data;
        const days =
          Math.round((Date.parse(membership.end_date) - Date.parse(today)) / 86400000) + 1;
        if (pending.event === 'expiring' && days > (settings?.warningDays ?? 3)) {
          await finish('suppressed', 'Reminder warning period changed');
          return true;
        }
        const copy =
          settings?.notificationText?.[pending.event as 'expiring' | 'expired' | 'renewed'];
        const fallback: Record<string, { ar: string; en: string }> = {
          expiring: {
            ar: 'اشتراكك على وشك الانتهاء. تواصل معنا للتجديد.',
            en: 'Your membership is ending soon. Contact us to renew.',
          },
          expired: {
            ar: 'انتهى اشتراكك. تواصل معنا لمتابعة تدريبك.',
            en: 'Your membership has expired. Contact us to continue training.',
          },
          renewed: {
            ar: 'تم تجديد اشتراكك. نتطلع لرؤيتك في التدريب.',
            en: 'Your membership has been renewed. See you at training.',
          },
        };
        params = [
          text(membership.plan_snapshot.name, recipient.preferred_language),
          membership.end_date,
          renderMembershipReminder(
            text(
              copy || fallback[pending.event] || { ar: '', en: '' },
              recipient.preferred_language,
            ),
            {
              name: recipient.full_name,
              club: settings ? text(settings.name, recipient.preferred_language) : '',
              date: membership.end_date,
            },
          ),
        ];
      } else {
        const message = (
          await client.query<{
            title: { ar: string; en: string };
            body: { ar: string; en: string };
          }>('SELECT title,body FROM announcements WHERE id=$1', [pending.payload.announcementId])
        ).rows[0];
        if (!message) {
          await finish('suppressed', 'Announcement unavailable');
          return true;
        }
        params = [
          text(message.title, recipient.preferred_language),
          text(message.body, recipient.preferred_language),
        ];
      }
      if (!this.whatsapp.configured(pending.event)) {
        await finish('failed', 'Approved template or Meta credentials missing');
        return true;
      }
      try {
        const provider = await this.whatsapp.send(
          recipient.phone,
          pending.event,
          recipient.preferred_language,
          params,
          pending.id,
        );
        const receipt = (
          await client.query<{ status: string; error: string | null }>(
            'SELECT status,error FROM whatsapp_receipts WHERE provider_id=$1 OR correlation_id=$2 ORDER BY occurred_at DESC LIMIT 1',
            [provider, pending.id],
          )
        ).rows[0];
        await client.query(
          'UPDATE outbox SET status=$2,provider_id=$3,error=$4,updated_at=now() WHERE id=$1',
          [pending.id, receipt?.status || 'accepted', provider, receipt?.error || null],
        );
      } catch (error) {
        if (error instanceof ProviderRejected && error.retryable && pending.attempts < 4)
          await client.query(
            "UPDATE outbox SET status='queued',error=$2,next_attempt_at=now()+($3::integer * interval '1 second'),updated_at=now() WHERE id=$1",
            [pending.id, error.message, Math.min(3600, 30 * 2 ** pending.attempts)],
          );
        else
          await finish(
            error instanceof ProviderUnknown ? 'unknown' : 'failed',
            error instanceof Error ? error.message : 'Delivery failed',
          );
      }
      return true;
    });
  }
}
