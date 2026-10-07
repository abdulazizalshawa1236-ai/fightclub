import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import type { ClassSession } from '@fightclub/shared';
import { DatabaseService } from '../core/database';
import { parse, dateSchema, uuidSchema } from '../core/validation';
const localized = z.object({ ar: z.string().max(4000), en: z.string().max(4000) }).strict();
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const classSchema = z
  .object({
    date: dateSchema,
    startTime: clock,
    endTime: clock,
    sportId: z.string().min(1).max(80),
    title: localized,
    ageGroup: localized,
    coachId: z.string().max(80).nullable(),
    room: z.string().min(1).max(100),
    notes: localized,
    status: z.enum(['scheduled', 'cancelled']),
  })
  .strict()
  .refine((x) => x.endTime > x.startTime, 'End time must follow start time');
const copySchema = z
  .object({
    from: monthSchema,
    to: monthSchema,
    preview: z.boolean(),
    idempotencyKey: z.string().min(16).max(100),
  })
  .strict()
  .refine((x) => x.from !== x.to, 'Select different months');
export function copyDate(date: string, to: string): string | null {
  const source = new Date(`${date}T12:00:00Z`),
    weekday = source.getUTCDay(),
    occurrence = Math.floor((source.getUTCDate() - 1) / 7),
    first = new Date(`${to}-01T12:00:00Z`),
    day = 1 + ((weekday - first.getUTCDay() + 7) % 7) + 7 * occurrence;
  const target = new Date(first);
  target.setUTCDate(day);
  return target.toISOString().slice(0, 7) === to ? target.toISOString().slice(0, 10) : null;
}
function clashes(a: ClassSession, b: ClassSession): boolean {
  return (
    a.id !== b.id &&
    a.status === 'scheduled' &&
    b.status === 'scheduled' &&
    a.date === b.date &&
    a.startTime < b.endTime &&
    b.startTime < a.endTime &&
    (a.room === b.room || (a.coachId !== null && a.coachId === b.coachId))
  );
}
@Injectable()
export class ScheduleService {
  constructor(private readonly db: DatabaseService) {}
  async list(month: unknown): Promise<{ classes: ClassSession[] }> {
    const value = parse(monthSchema, month);
    const result = await this.db.query<{ data: ClassSession }>(
      "SELECT data FROM classes WHERE left(data->>'date',7)=$1 ORDER BY data->>'date',data->>'startTime'",
      [value],
    );
    return { classes: result.rows.map((x) => x.data) };
  }
  async save(input: unknown, actor: string, id?: string): Promise<ClassSession> {
    const data = parse(classSchema, input),
      key = id ? parse(uuidSchema, id) : randomUUID(),
      item: ClassSession = { ...data, id: key };
    return this.db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('club.schedule'))");
      if (id && !(await client.query('SELECT id FROM classes WHERE id=$1', [id])).rowCount)
        throw new NotFoundException('Class not found');
      for (const [table, ref] of [
        ['sports', data.sportId],
        ['coaches', data.coachId],
      ] as const) {
        if (
          ref &&
          !(
            await client.query(`SELECT id FROM ${table} WHERE id=$1 AND archived_at IS NULL`, [ref])
          ).rowCount
        )
          throw new BadRequestException('Sport or coach not available');
      }
      const rows = (
        await client.query<{ data: ClassSession }>(
          "SELECT data FROM classes WHERE data->>'date'=$1",
          [data.date],
        )
      ).rows;
      if (rows.some((x) => clashes(item, x.data)))
        throw new ConflictException('The room or coach already has a class at this time');
      await client.query(
        'INSERT INTO classes(id,data) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET data=excluded.data',
        [key, JSON.stringify(item)],
      );
      await client.query('INSERT INTO audit_events(id,actor,action,details) VALUES($1,$2,$3,$4)', [
        randomUUID(),
        actor,
        id ? 'class.updated' : 'class.created',
        JSON.stringify(item),
      ]);
      return item;
    });
  }
  async cancel(id: string, actor: string): Promise<void> {
    parse(uuidSchema, id);
    await this.db.transaction(async (client) => {
      const row = (
        await client.query<{ data: ClassSession }>(
          'SELECT data FROM classes WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row) throw new NotFoundException('Class not found');
      await client.query('UPDATE classes SET data=$2 WHERE id=$1', [
        id,
        JSON.stringify({ ...row.data, status: 'cancelled' }),
      ]);
      await client.query(
        "INSERT INTO audit_events(id,actor,action,details) VALUES($1,$2,'class.cancelled',$3)",
        [randomUUID(), actor, JSON.stringify({ id })],
      );
    });
  }
  async copy(
    input: unknown,
    actor: string,
  ): Promise<{ classes: ClassSession[]; created: number; skipped: number; conflicts: string[] }> {
    const data = parse(copySchema, input),
      digest = createHash('sha256')
        .update(JSON.stringify({ from: data.from, to: data.to }))
        .digest('hex');
    return this.db.transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('club.schedule'))");
      const prior = (
        await client.query<{
          request_digest: string;
          result: {
            classes: ClassSession[];
            created: number;
            skipped: number;
            conflicts: string[];
          };
        }>('SELECT * FROM schedule_copies WHERE idempotency_key=$1', [data.idempotencyKey])
      ).rows[0];
      if (prior) {
        if (prior.request_digest !== digest)
          throw new ConflictException('Copy key already used for different months');
        return prior.result;
      }
      const source = (
        await client.query<{ data: ClassSession }>(
          "SELECT data FROM classes WHERE left(data->>'date',7)=$1 AND data->>'status'='scheduled'",
          [data.from],
        )
      ).rows;
      const existing = (
        await client.query<{ data: ClassSession }>(
          "SELECT data FROM classes WHERE left(data->>'date',7)=$1",
          [data.to],
        )
      ).rows.map((x) => x.data);
      const copies: ClassSession[] = [],
        conflicts: string[] = [];
      let skipped = 0;
      for (const { data: item } of source) {
        const date = copyDate(item.date, data.to);
        if (!date) {
          skipped++;
          continue;
        }
        const copy = { ...item, id: randomUUID(), date };
        if (
          existing.some(
            (x) =>
              x.date === date &&
              x.startTime === copy.startTime &&
              x.endTime === copy.endTime &&
              x.sportId === copy.sportId &&
              x.room === copy.room &&
              x.coachId === copy.coachId,
          )
        ) {
          skipped++;
          continue;
        }
        if ([...existing, ...copies].some((x) => clashes(copy, x))) {
          conflicts.push(`${date} ${copy.startTime} ${copy.room}`);
          continue;
        }
        copies.push(copy);
      }
      const result = { classes: copies, created: copies.length, skipped, conflicts };
      if (data.preview) return result;
      if (conflicts.length)
        throw new ConflictException({
          code: 'SCHEDULE_CONFLICT',
          message: 'Resolve room or coach conflicts before copying',
          conflicts,
        });
      for (const item of copies)
        await client.query('INSERT INTO classes(id,data) VALUES($1,$2)', [
          item.id,
          JSON.stringify(item),
        ]);
      await client.query(
        'INSERT INTO schedule_copies(idempotency_key,request_digest,result) VALUES($1,$2,$3)',
        [data.idempotencyKey, digest, JSON.stringify(result)],
      );
      await client.query(
        "INSERT INTO audit_events(id,actor,action,details) VALUES($1,$2,'schedule.copied',$3)",
        [
          randomUUID(),
          actor,
          JSON.stringify({ from: data.from, to: data.to, created: copies.length }),
        ],
      );
      return result;
    });
  }
}
