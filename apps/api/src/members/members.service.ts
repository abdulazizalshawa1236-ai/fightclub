import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PoolClient, QueryResultRow } from 'pg';
import { z } from 'zod';
import type {
  Member,
  MemberDashboard,
  Membership,
  Plan,
  ClubSettings,
  ClassSession,
  Announcement,
} from '@fightclub/shared';
import { DatabaseService } from '../core/database';
import { CryptoService } from '../core/crypto';
import { dateSchema, nationalIdSchema, parse, phoneSchema } from '../core/validation';
import {
  addDays,
  membershipStatus,
  remainingDays,
  renewalDates,
  todayRiyadh,
} from './membership-domain';
const memberInput = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    nationalId: nationalIdSchema,
    phone: phoneSchema,
    ageGroup: z.enum(['adult', 'child']),
    preferredLanguage: z.enum(['ar', 'en']),
    planId: z.string().min(1).max(100),
    startDate: dateSchema,
    endDate: dateSchema.optional(),
    sports: z.array(z.string().min(1).max(80)).min(1).max(8),
    notes: z.string().max(4000).optional(),
    accessEnabled: z.boolean().optional(),
    consent: z.object({ updates: z.boolean(), marketing: z.boolean() }).optional(),
  })
  .strict();
const memberPatch = memberInput
  .partial()
  .extend({
    expectedVersion: z.number().int().positive().optional(),
    accessEnabled: z.boolean().optional(),
  })
  .strict();
const renewInput = z
  .object({
    planId: z.string().min(1).max(100),
    sports: z.array(z.string().min(1)).min(1).max(8),
    expectedVersion: z.number().int().positive(),
    idempotencyKey: z.string().uuid(),
  })
  .strict();
const statusInput = z
  .object({ suspended: z.boolean(), expectedVersion: z.number().int().positive() })
  .strict();
interface MemberRow extends QueryResultRow {
  id: string;
  full_name: string;
  phone: string;
  national_id_last4: string;
  age_group: 'adult' | 'child';
  notes: string;
  access_enabled: boolean;
  phone_verified_at: Date | null;
  preferred_language: 'ar' | 'en';
  updates_consent: boolean;
  marketing_consent: boolean;
  identity_version: number;
  created_at: Date;
  membership: MembershipRow | null;
  warning_days: number;
}
interface MembershipRow {
  id: string;
  plan_id: string;
  plan_snapshot: Plan;
  start_date: string;
  end_date: string;
  sports: string[];
  suspended: boolean;
  version: number;
}
const memberSelect = `SELECT m.*, ms.membership, COALESCE((settings.data->>'warningDays')::integer,14) warning_days FROM members m LEFT JOIN LATERAL (SELECT jsonb_build_object('id',id,'plan_id',plan_id,'plan_snapshot',plan_snapshot,'start_date',start_date::text,'end_date',end_date::text,'sports',sports,'suspended',suspended,'version',version) membership FROM memberships WHERE member_id=m.id AND current) ms ON true LEFT JOIN site_settings settings ON settings.id=1`;
function membershipView(row: MembershipRow, warning: number): Membership {
  return {
    id: row.id,
    planId: row.plan_id,
    planName: row.plan_snapshot.name,
    price: row.plan_snapshot.price,
    startDate: row.start_date,
    endDate: row.end_date,
    sports: row.sports,
    status: membershipStatus(row.start_date, row.end_date, row.suspended, warning),
    daysLeft: remainingDays(row.end_date, todayRiyadh()),
    version: row.version,
  };
}
function view(row: MemberRow): Member {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    nationalIdMasked: `******${row.national_id_last4}`,
    ageGroup: row.age_group,
    notes: row.notes,
    accessEnabled: row.access_enabled,
    verified: !!row.phone_verified_at,
    preferredLanguage: row.preferred_language,
    consent: { updates: row.updates_consent, marketing: row.marketing_consent },
    membership: row.membership ? membershipView(row.membership, row.warning_days) : null,
    createdAt: row.created_at.toISOString(),
  };
}
@Injectable()
export class MembersService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
  ) {}
  async get(id: string, client?: PoolClient): Promise<Member> {
    const query = client ? client.query.bind(client) : this.db.query.bind(this.db);
    const result = await query<MemberRow>(
      `${memberSelect} WHERE m.id=$1 AND m.archived_at IS NULL`,
      [id],
    );
    const row = result.rows[0];
    if (!row)
      throw new NotFoundException({ code: 'MEMBER_NOT_FOUND', message: 'Member not found.' });
    return view(row);
  }
  async list(
    q = '',
    status = '',
    page = 1,
  ): Promise<{ members: Member[]; total: number; page: number }> {
    if (q.length > 120 || !Number.isInteger(page) || page < 1 || page > 100000)
      throw new BadRequestException('Invalid search or page');
    if (status && !['active', 'expiring', 'expired', 'upcoming', 'suspended'].includes(status))
      throw new BadRequestException('Invalid status');
    const search = q.replace(/[%_\\]/g, '\\$&');
    const statusSql = `CASE WHEN (ms.membership->>'suspended')::boolean THEN 'suspended' WHEN ms.membership->>'start_date'>$5 THEN 'upcoming' WHEN ms.membership->>'end_date'<$5 THEN 'expired' WHEN (ms.membership->>'end_date')::date-$5::date+1<=COALESCE((settings.data->>'warningDays')::integer,14) THEN 'expiring' ELSE 'active' END`;
    const result = await this.db.query<MemberRow & { total: string }>(
      `${memberSelect.replace('SELECT m.*', 'SELECT count(*) OVER() total,m.*')} WHERE m.archived_at IS NULL AND ($1='' OR m.full_name ILIKE $2 ESCAPE '\\' OR m.phone ILIKE $2 ESCAPE '\\' OR m.national_id_digest=$3) AND ($4='' OR ms.membership IS NOT NULL AND (${statusSql})=$4) ORDER BY m.created_at DESC LIMIT 20 OFFSET $6`,
      [q, `%${search}%`, this.crypto.digest(q), status, todayRiyadh(), (page - 1) * 20],
    );
    return { members: result.rows.map(view), total: Number(result.rows[0]?.total || 0), page };
  }
  private async plan(client: PoolClient, id: string, sports: string[]): Promise<Plan> {
    const result = await client.query<{ data: Plan }>(
      'SELECT data FROM plans WHERE id=$1 AND archived_at IS NULL FOR SHARE',
      [id],
    );
    const plan = result.rows[0]?.data;
    if (!plan || !plan.visible)
      throw new BadRequestException({
        code: 'PLAN_UNAVAILABLE',
        message: 'This plan is unavailable.',
      });
    if (
      new Set(sports).size !== sports.length ||
      (plan.sportLimit !== null && sports.length > plan.sportLimit)
    )
      throw new BadRequestException({
        code: 'INVALID_SPORTS',
        message: 'Select sports within the plan allowance.',
      });
    const valid = (
      await client.query<{ id: string }>(
        "SELECT id FROM sports WHERE id=ANY($1::text[]) AND archived_at IS NULL AND (data->>'available')::boolean",
        [sports],
      )
    ).rows;
    if (valid.length !== sports.length)
      throw new BadRequestException({
        code: 'SPORT_UNAVAILABLE',
        message: 'One or more selected sports are unavailable.',
      });
    return plan;
  }
  private async record(
    client: PoolClient,
    actor: string,
    id: string,
    action: string,
    before: unknown,
    after: unknown,
    key?: string,
    digest?: string,
  ): Promise<void> {
    await client.query(
      'INSERT INTO audit_events(id,member_id,actor,action,details) VALUES($1,$2,$3,$4,$5)',
      [randomUUID(), id, actor, action, JSON.stringify({ before, after })],
    );
    if (action.startsWith('membership.'))
      await client.query(
        'INSERT INTO membership_operations(id,member_id,action,before_data,after_data,idempotency_key,request_digest) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [
          randomUUID(),
          id,
          action,
          JSON.stringify(before),
          JSON.stringify(after),
          key || null,
          digest || null,
        ],
      );
  }
  private async event(
    client: PoolClient,
    id: string,
    event: string,
    membership: Membership,
  ): Promise<void> {
    const identity = (
      await client.query<{ identity_version: number }>(
        'SELECT identity_version FROM members WHERE id=$1',
        [id],
      )
    ).rows[0];
    await client.query(
      "INSERT INTO outbox(id,member_id,event,payload,category,event_key,dedupe_key) VALUES($1,$2,$3,$4,'utility',$5,$5)",
      [
        randomUUID(),
        id,
        event,
        JSON.stringify({
          membershipId: membership.id,
          membershipVersion: membership.version,
          phoneVersion: identity?.identity_version,
          endDate: membership.endDate,
        }),
        `${event}:${membership.id}:${membership.version}`,
      ],
    );
  }
  async create(input: unknown, actor: string): Promise<Member> {
    const data = parse(memberInput, input);
    return this.db.transaction(async (client) => {
      const plan = await this.plan(client, data.planId, data.sports),
        id = randomUUID();
      const end = data.endDate || addDays(data.startDate, plan.durationDays - 1);
      if (end < data.startDate) throw new BadRequestException('End date must follow start date');
      await client.query(
        'INSERT INTO members(id,full_name,national_id_digest,national_id_encrypted,national_id_last4,phone,age_group,preferred_language,notes,updates_consent,marketing_consent,access_enabled) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
        [
          id,
          data.fullName,
          this.crypto.digest(data.nationalId),
          this.crypto.encrypt(data.nationalId),
          data.nationalId.slice(-4),
          data.phone,
          data.ageGroup,
          data.preferredLanguage,
          data.notes ?? '',
          data.consent?.updates || false,
          data.consent?.marketing || false,
          data.accessEnabled ?? true,
        ],
      );
      await client.query(
        'INSERT INTO memberships(id,member_id,plan_id,plan_snapshot,start_date,end_date,sports) VALUES($1,$2,$3,$4,$5,$6,$7)',
        [randomUUID(), id, plan.id, JSON.stringify(plan), data.startDate, end, data.sports],
      );
      const member = await this.get(id, client);
      await this.record(client, actor, id, 'member.created', null, member);
      if (data.consent) await this.consent(client, id, data.consent, 'admin.member.create');
      return member;
    });
  }
  private async lock(client: PoolClient, id: string): Promise<Member> {
    const row = (
      await client.query<{ id: string }>(
        'SELECT id FROM members WHERE id=$1 AND archived_at IS NULL FOR UPDATE',
        [id],
      )
    ).rows[0];
    if (!row) throw new NotFoundException('Member not found');
    return this.get(id, client);
  }
  async edit(id: string, input: unknown, actor: string): Promise<Member> {
    const data = parse(memberPatch, input);
    return this.db.transaction(async (client) => {
      const before = await this.lock(client, id);
      const raw = (
        await client.query<{ national_id_digest: string }>(
          'SELECT national_id_digest FROM members WHERE id=$1',
          [id],
        )
      ).rows[0];
      const identityChanged = !!(
        (data.phone && data.phone !== before.phone) ||
        (data.nationalId && this.crypto.digest(data.nationalId) !== raw?.national_id_digest)
      );
      await client.query(
        `UPDATE members SET full_name=COALESCE($2,full_name),phone=COALESCE($3,phone),age_group=COALESCE($4,age_group),preferred_language=COALESCE($5,preferred_language),notes=COALESCE($6,notes),access_enabled=COALESCE($7,access_enabled),national_id_digest=COALESCE($8,national_id_digest),national_id_encrypted=COALESCE($9,national_id_encrypted),national_id_last4=COALESCE($10,national_id_last4),identity_version=identity_version+CASE WHEN $11 THEN 1 ELSE 0 END,phone_verified_at=CASE WHEN $11 THEN NULL ELSE phone_verified_at END,updates_consent=COALESCE($12,updates_consent),marketing_consent=COALESCE($13,marketing_consent) WHERE id=$1`,
        [
          id,
          data.fullName ?? null,
          data.phone ?? null,
          data.ageGroup ?? null,
          data.preferredLanguage ?? null,
          data.notes ?? null,
          data.accessEnabled ?? null,
          data.nationalId ? this.crypto.digest(data.nationalId) : null,
          data.nationalId ? this.crypto.encrypt(data.nationalId) : null,
          data.nationalId?.slice(-4) ?? null,
          identityChanged,
          data.consent?.updates ?? null,
          data.consent?.marketing ?? null,
        ],
      );
      if (identityChanged || data.accessEnabled === false) {
        await client.query('DELETE FROM sessions WHERE actor_id=$1', [id]);
        await client.query(
          'UPDATE login_challenges SET consumed_at=now() WHERE member_id=$1 AND consumed_at IS NULL',
          [id],
        );
      }
      const changesMembership =
        data.planId !== undefined ||
        data.startDate !== undefined ||
        data.endDate !== undefined ||
        data.sports !== undefined;
      if (changesMembership) {
        if (!before.membership || data.expectedVersion !== before.membership.version)
          throw new ConflictException({
            code: 'MEMBERSHIP_CHANGED',
            message: 'Membership changed. Refresh and try again.',
          });
        const plan = await this.plan(
          client,
          data.planId || before.membership.planId,
          data.sports || before.membership.sports,
        );
        const start = data.startDate || before.membership.startDate,
          end =
            data.endDate ||
            (data.planId || data.startDate
              ? addDays(start, plan.durationDays - 1)
              : before.membership.endDate);
        if (end < start) throw new BadRequestException('End date must follow start date');
        await client.query('UPDATE memberships SET current=false WHERE member_id=$1 AND current', [
          id,
        ]);
        await client.query(
          'INSERT INTO memberships(id,member_id,plan_id,plan_snapshot,start_date,end_date,sports,suspended,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            randomUUID(),
            id,
            plan.id,
            JSON.stringify(plan),
            start,
            end,
            data.sports || before.membership.sports,
            before.membership.status === 'suspended',
            before.membership.version + 1,
          ],
        );
      }
      const after = await this.get(id, client);
      await this.record(
        client,
        actor,
        id,
        changesMembership ? 'membership.edited' : 'member.edited',
        before,
        after,
      );
      if (data.consent) await this.consent(client, id, data.consent, 'admin.member.edit');
      return after;
    });
  }
  async renew(id: string, input: unknown, actor: string): Promise<Member> {
    const data = parse(renewInput, input),
      digest = this.crypto.digest(JSON.stringify({ memberId: id, ...data }));
    return this.db.transaction(async (client) => {
      const before = await this.lock(client, id);
      const existing = (
        await client.query<{ member_id: string; request_digest: string; after_data: Member }>(
          'SELECT member_id,request_digest,after_data FROM membership_operations WHERE idempotency_key=$1',
          [data.idempotencyKey],
        )
      ).rows[0];
      if (existing) {
        if (existing.member_id !== id || existing.request_digest !== digest)
          throw new ConflictException({
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'This request key was used for a different renewal.',
          });
        return existing.after_data;
      }
      const current = before.membership;
      if (!current || current.version !== data.expectedVersion)
        throw new ConflictException({
          code: 'MEMBERSHIP_CHANGED',
          message: 'Membership changed. Refresh and try again.',
        });
      if (current.status === 'suspended')
        throw new ConflictException({
          code: 'MEMBERSHIP_SUSPENDED',
          message: 'Reactivate the membership before renewing.',
        });
      const plan = await this.plan(client, data.planId, data.sports),
        dates = renewalDates(current.startDate, current.endDate, plan.durationDays);
      await client.query('UPDATE memberships SET current=false WHERE id=$1', [current.id]);
      await client.query(
        'INSERT INTO memberships(id,member_id,plan_id,plan_snapshot,start_date,end_date,sports,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
        [
          randomUUID(),
          id,
          plan.id,
          JSON.stringify(plan),
          dates.startDate,
          dates.endDate,
          data.sports,
          current.version + 1,
        ],
      );
      const after = await this.get(id, client);
      await this.record(
        client,
        actor,
        id,
        'membership.renewed',
        before,
        after,
        data.idempotencyKey,
        digest,
      );
      if (after.membership) await this.event(client, id, 'renewed', after.membership);
      return after;
    });
  }
  async status(id: string, input: unknown, actor: string): Promise<Member> {
    const data = parse(statusInput, input);
    return this.db.transaction(async (client) => {
      const before = await this.lock(client, id);
      if (!before.membership || before.membership.version !== data.expectedVersion)
        throw new ConflictException({
          code: 'MEMBERSHIP_CHANGED',
          message: 'Refresh the membership before updating.',
        });
      await client.query('UPDATE memberships SET suspended=$2,version=version+1 WHERE id=$1', [
        before.membership.id,
        data.suspended,
      ]);
      const after = await this.get(id, client);
      await this.record(client, actor, id, 'membership.status.changed', before, after);
      return after;
    });
  }
  async archive(id: string, actor: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const before = await this.lock(client, id);
      await client.query(
        'UPDATE members SET archived_at=now(),access_enabled=false,identity_version=identity_version+1 WHERE id=$1',
        [id],
      );
      await client.query('DELETE FROM sessions WHERE actor_id=$1', [id]);
      await client.query(
        'UPDATE login_challenges SET consumed_at=now() WHERE member_id=$1 AND consumed_at IS NULL',
        [id],
      );
      await this.record(client, actor, id, 'member.archived', before, { archived: true });
    });
  }
  async export(): Promise<string> {
    const rows = (
      await this.db.query<MemberRow>(
        `${memberSelect} WHERE m.archived_at IS NULL ORDER BY m.full_name`,
      )
    ).rows;
    const escape = (value: string) =>
      `"${(/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replace(/"/g, '""')}"`;
    const csv = [
      ['Name', 'ID (masked)', 'Phone', 'Package', 'Start date', 'End date', 'Status'],
      ...rows.map((row) => {
        const member = view(row);
        return [
          member.fullName,
          member.nationalIdMasked,
          member.phone,
          member.membership?.planName.en || '',
          member.membership?.startDate || '',
          member.membership?.endDate || '',
          member.membership?.status || '',
        ];
      }),
    ];
    return '\uFEFF' + csv.map((row) => row.map(escape).join(',')).join('\r\n');
  }
  async audit(memberId?: string): Promise<{
    events: { id: string; action: string; createdAt: string; actor: string; details: unknown }[];
  }> {
    const rows = (
      await this.db.query<{
        id: string;
        action: string;
        created_at: Date;
        actor: string;
        details: unknown;
      }>(
        'SELECT * FROM audit_events WHERE ($1::uuid IS NULL OR member_id=$1) ORDER BY created_at DESC LIMIT 200',
        [memberId || null],
      )
    ).rows;
    return {
      events: rows.map((row) => ({
        id: row.id,
        action: row.action,
        createdAt: row.created_at.toISOString(),
        actor: row.actor,
        details: row.details,
      })),
    };
  }
  async dashboard(id: string): Promise<MemberDashboard> {
    const member = await this.get(id);
    const today = todayRiyadh();
    const [settings, classes, announcements] = await Promise.all([
      this.db.query<{ data: ClubSettings }>('SELECT data FROM site_settings WHERE id=1'),
      this.db.query<{ id: string; data: ClassSession }>(
        "SELECT id,data FROM classes WHERE data->>'date'>=$1 AND data->>'status'='scheduled' AND data->>'sportId'=ANY($2::text[]) ORDER BY data->>'date',data->>'startTime' LIMIT 15",
        [today, member.membership?.sports || []],
      ),
      this.db.query<{
        id: string;
        title: Announcement['title'];
        body: Announcement['body'];
        created_at: Date;
        read: boolean;
      }>(
        "SELECT a.*,r.announcement_id IS NOT NULL read FROM announcements a LEFT JOIN announcement_reads r ON r.announcement_id=a.id AND r.member_id=$1 WHERE a.target='all' OR a.member_id=$1 OR (a.target='marketing' AND $2) OR (a.target='active' AND $3) ORDER BY a.created_at DESC LIMIT 50",
        [
          id,
          member.consent.marketing,
          !!member.membership && ['active', 'expiring'].includes(member.membership.status),
        ],
      ),
    ]);
    if (!settings.rows[0]) throw new NotFoundException('Club settings unavailable');
    const { fullName, phone, preferredLanguage, consent, membership } = member;
    return {
      member: { id, fullName, phone, preferredLanguage, consent, membership },
      settings: settings.rows[0].data,
      classes: classes.rows.map((row) => ({ ...row.data, id: row.id })),
      announcements: announcements.rows.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.created_at.toISOString(),
        read: row.read,
      })),
    };
  }
  private async consent(
    client: PoolClient,
    id: string,
    preferences: { updates: boolean; marketing: boolean },
    source: string,
  ): Promise<void> {
    for (const [category, allowed] of [
      ['updates', preferences.updates],
      ['marketing', preferences.marketing],
    ] as const)
      await client.query(
        'INSERT INTO consent_events(id,member_id,category,allowed,source) VALUES($1,$2,$3,$4,$5)',
        [randomUUID(), id, category, allowed, source],
      );
  }
  async preferences(id: string, input: unknown): Promise<void> {
    const data = parse(
      z
        .object({ updates: z.boolean(), marketing: z.boolean(), locale: z.enum(['ar', 'en']) })
        .strict(),
      input,
    );
    await this.db.transaction(async (client) => {
      await this.lock(client, id);
      await client.query(
        'UPDATE members SET updates_consent=$2,marketing_consent=$3,preferred_language=$4 WHERE id=$1',
        [id, data.updates, data.marketing, data.locale],
      );
      await this.consent(client, id, data, 'member.preferences');
      await this.record(client, id, id, 'member.preferences.changed', null, {
        updates: data.updates,
        marketing: data.marketing,
        locale: data.locale,
      });
    });
  }
  async readAnnouncements(id: string, input: unknown): Promise<void> {
    const data = parse(z.object({ ids: z.array(z.string().uuid()).max(50) }).strict(), input);
    const member = await this.get(id);
    await this.db.query(
      "INSERT INTO announcement_reads(member_id,announcement_id) SELECT $1,id FROM announcements WHERE id=ANY($2::uuid[]) AND (target='all' OR member_id=$1 OR (target='marketing' AND $3) OR (target='active' AND $4)) ON CONFLICT DO NOTHING",
      [
        id,
        data.ids,
        member.consent.marketing,
        !!member.membership && ['active', 'expiring'].includes(member.membership.status),
      ],
    );
  }
}
