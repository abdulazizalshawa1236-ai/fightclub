import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import type { ClassSession } from '@fightclub/shared';
import { renderMembershipReminder } from '@fightclub/shared';

config({ path: resolve(__dirname, '../../../.env'), quiet: true });
// Canonical projection of every class in the supplied SQLite snapshot, independently
// calculated from the original rows, not from the migration's weekly rules.
const sourceDigest = '487bad3a95d42c71d389d10ce3d50d67f2fb8f073c8d62511ed825146c817f1b';
// SQLite REAL prices are normalized to JSON numbers (2199.0 and 2199 are equal).
const recordsDigest = 'b173bd5b2469714915b5bab9dfe50ed778a13ebb72649a46c33a5547e3248059';
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, item]) => [key, canonical(item)]),
    );
  return value;
}
async function main(): Promise<void> {
  assert.equal(
    renderMembershipReminder('{name} / {club} / {date} / {name} / {unknown}', {
      name: '$& {date}',
      club: 'Fight Club',
      date: '2027-01-04',
    }),
    '$& {date} / Fight Club / 2027-01-04 / $& {date} / {unknown}',
  );
  assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const schema = `schedule_check_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET LOCAL search_path TO ${schema}`);
    await client.query(await readFile(resolve(__dirname, '../migrations/001_initial.sql'), 'utf8'));
    const migration = await readFile(
      resolve(__dirname, '../migrations/006_restore_source_schedule.sql'),
      'utf8',
    );
    await client.query(migration);
    const classes = (
      await client.query<{ data: ClassSession }>(
        "SELECT data FROM classes ORDER BY data->>'date',data->>'startTime',data->'title'->>'en',data->'ageGroup'->>'en' COLLATE \"C\"",
      )
    ).rows.map(({ data }) => ({
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      sportId: data.sportId,
      title: { ar: data.title.ar, en: data.title.en },
      ageGroup: { ar: data.ageGroup.ar, en: data.ageGroup.en },
      coachId: data.coachId,
      room: data.room,
      notes: { ar: data.notes.ar, en: data.notes.en },
      status: data.status,
    }));
    assert.equal(classes.length, 1565);
    assert.equal(createHash('sha256').update(JSON.stringify(classes)).digest('hex'), sourceDigest);
    assert.equal(classes.filter((item) => item.date.startsWith('2026-10')).length, 130);
    assert.ok(classes.every((item) => new Date(`${item.date}T12:00:00Z`).getUTCDay() !== 5));

    async function prepareRepeat(): Promise<void> {
      await client.query('DROP TABLE source_schedule');
      await client.query("DELETE FROM audit_events WHERE action='schedule.imported'");
    }
    const original = (
      await client.query<{ id: string; data: ClassSession }>('SELECT * FROM classes LIMIT 1')
    ).rows[0];
    assert.ok(original);
    await client.query(
      "UPDATE classes SET data=jsonb_set(data,'{notes,en}','\"Staff edit\"') WHERE id=$1",
      [original.id],
    );
    await prepareRepeat();
    await client.query(migration);
    assert.equal(
      (
        await client.query<{ note: string }>(
          "SELECT data->'notes'->>'en' AS note FROM classes WHERE id=$1",
          [original.id],
        )
      ).rows[0].note,
      'Staff edit',
    );
    // An equivalent staff-created record has a different UUID and must not duplicate.
    const equivalent = (
      await client.query<{ id: string }>('SELECT id FROM classes WHERE id<>$1 LIMIT 1', [
        original.id,
      ])
    ).rows[0];
    const equivalentId = randomUUID();
    await client.query(
      "UPDATE classes SET id=$2::uuid,data=jsonb_set(data,'{id}',to_jsonb($2::uuid)) WHERE id=$1",
      [equivalent.id, equivalentId],
    );
    await prepareRepeat();
    await client.query(migration);
    assert.equal(
      (await client.query<{ count: string }>('SELECT count(*) FROM classes')).rows[0].count,
      '1565',
    );

    // A staff booking occupying a supplied hall fails the entire migration.
    await prepareRepeat();
    await client.query('SAVEPOINT collision');
    const collisionId = randomUUID();
    await client.query('INSERT INTO classes(id,data) VALUES($1,$2)', [
      collisionId,
      JSON.stringify({
        ...original.data,
        id: collisionId,
        title: { ar: 'حصة أخرى', en: 'Staff booking' },
      }),
    ]);
    await assert.rejects(client.query(migration), /conflicts with existing staff classes/);
    await client.query('ROLLBACK TO SAVEPOINT collision');
    await client.query(
      await readFile(resolve(__dirname, '../migrations/007_preserve_source_data.sql'), 'utf8'),
    );
    const records = (
      await client.query<{
        source_table: string;
        source_key: string;
        data: Record<string, unknown>;
      }>(
        'SELECT source_table,source_key,data FROM source_import_records ORDER BY source_table COLLATE "C",source_key COLLATE "C"',
      )
    ).rows;
    assert.equal(records.length, 1622);
    assert.equal(
      createHash('sha256')
        .update(JSON.stringify(canonical(records)))
        .digest('hex'),
      recordsDigest,
    );
    assert.ok(records.every((record) => !Object.hasOwn(record.data, 'password_hash')));
    await client.query(
      await readFile(resolve(__dirname, '../migrations/008_preserve_source_content.sql'), 'utf8'),
    );
    const snapshot = (
      await client.query<{ data: unknown }>(
        "SELECT data FROM source_import_records WHERE source_table='site_snapshot'",
      )
    ).rows[0];
    assert.equal(
      createHash('sha256')
        .update(JSON.stringify(canonical(snapshot.data)))
        .digest('hex'),
      '89d13b29289a9871f3d28ce8135c09a0d83cb2be6a8f998b8b1d9f81adc1217c',
    );
    assert.equal(
      (await client.query<{ count: string }>('SELECT count(*) FROM source_import_records')).rows[0]
        .count,
      '1634',
    );
    process.stdout.write(
      'PASS: all supplied classes and source records match; edits, deduplication and conflict rollback preserved.\n',
    );
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
}
void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Source schedule verification failed'}\n`,
  );
  process.exitCode = 1;
});
