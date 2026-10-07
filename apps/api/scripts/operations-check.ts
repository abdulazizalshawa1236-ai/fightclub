import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { createHmac, randomInt, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import express from 'express';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { RuntimeConfig } from '../src/core/config';
import { DatabaseService } from '../src/core/database';
import { CryptoService } from '../src/core/crypto';
import { MembersService } from '../src/members/members.service';
import { CatalogueService } from '../src/operations/catalogue.service';
import { ScheduleService } from '../src/operations/schedule.service';
import { CommunicationsService } from '../src/operations/communications.service';
import { ProviderUnknown, WhatsAppService } from '../src/operations/whatsapp.service';
import { WebhookController } from '../src/operations/webhook.controller';
import { todayRiyadh } from '../src/members/membership-domain';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ quiet: true });
class NoNetworkWhatsApp extends WhatsAppService {
  calls = 0;
  override configured(): boolean {
    return true;
  }
  override async send(): Promise<string> {
    this.calls++;
    throw new ProviderUnknown('Simulated network timeout after provider accepted request');
  }
}
async function main(): Promise<void> {
  const original = process.env.DATABASE_URL;
  if (!original || !['127.0.0.1', 'localhost'].includes(new URL(original).hostname))
    throw new Error('Operations checks require a local database');
  const schema = `operations_check_${randomUUID().replace(/-/g, '')}`;
  const rootDb = new Pool({ connectionString: original });
  let db: DatabaseService | undefined, server: Server | undefined;
  try {
    await rootDb.query(`CREATE SCHEMA ${schema}`);
    const url = new URL(original);
    url.searchParams.set('options', `-c search_path=${schema}`);
    process.env.DATABASE_URL = url.toString();
    const runtime = new RuntimeConfig();
    db = new DatabaseService(runtime);
    const migrationDirectory = resolve(
      process.cwd().endsWith('apps/api') ? process.cwd() : resolve(process.cwd(), 'apps/api'),
      'migrations',
    );
    for (const file of (await readdir(migrationDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort())
      await db.query(await readFile(resolve(migrationDirectory, file), 'utf8'));
    for (const table of [
      'plans',
      'sports',
      'coaches',
      'offers',
      'site_settings',
      'content_revisions',
    ])
      await db.query(`INSERT INTO ${table} SELECT * FROM public.${table}`);
    await db.query(
      "SELECT setval(pg_get_serial_sequence('content_revisions','revision'),COALESCE((SELECT max(revision) FROM content_revisions),1))",
    );
    const catalogue = new CatalogueService(db),
      schedule = new ScheduleService(db),
      members = new MembersService(db, new CryptoService(runtime)),
      network = new NoNetworkWhatsApp(),
      communications = new CommunicationsService(db, network),
      actor = randomUUID();
    const initialPublic = await catalogue.site(),
      initialDraft = await catalogue.site(true),
      marker = `Fixture ${randomUUID()}`;
    const block = {
      id: 'regression-section',
      type: 'about' as const,
      title: { ar: 'قسم اختبار', en: marker },
      body: { ar: 'اختبار معزول', en: 'Isolated verification' },
      visible: true,
      position: 99,
      items: [],
    };
    const draft = await catalogue.draft(
      { blocks: [...initialDraft.blocks, block], expectedRevision: initialDraft.revision },
      actor,
    );
    assert.equal((await catalogue.site()).revision, initialPublic.revision);
    assert.equal(
      (await catalogue.site()).blocks.some((item) => item.title.en === marker),
      false,
    );
    await assert.rejects(
      catalogue.draft(
        { blocks: initialDraft.blocks, expectedRevision: initialDraft.revision },
        actor,
      ),
    );
    await assert.rejects(catalogue.publish({ expectedRevision: initialDraft.revision }, actor));
    await catalogue.publish({ expectedRevision: draft.revision }, actor);
    assert.equal(
      (await catalogue.site()).blocks.some((item) => item.title.en === marker),
      true,
    );
    const restored = await catalogue.restore(
      String(initialPublic.revision),
      { expectedRevision: draft.revision },
      actor,
    );
    assert.equal((await catalogue.site()).revision, draft.revision);
    assert.equal(
      (await catalogue.site(true)).blocks.some((item) => item.title.en === marker),
      false,
    );
    await catalogue.publish({ expectedRevision: restored.revision }, actor);
    assert.deepEqual((await catalogue.site()).blocks, initialPublic.blocks);
    process.stdout.write(
      'PASS content draft isolation, stale revision conflicts, publish and restore\n',
    );
    const sport = (
      await db.query<{ id: string }>(
        "SELECT id FROM sports WHERE archived_at IS NULL AND (data->>'available')::boolean ORDER BY id LIMIT 1",
      )
    ).rows[0];
    assert.ok(sport);
    const classData = {
      startTime: '09:00',
      endTime: '10:00',
      sportId: sport.id,
      title: { ar: 'حصة اختبار', en: 'Check class' },
      ageGroup: { ar: 'بالغ', en: 'Adult' },
      coachId: null,
      room: 'Check room',
      notes: { ar: '', en: '' },
      status: 'scheduled',
    };
    for (const date of ['2026-03-02', '2026-03-09', '2026-03-30'])
      await schedule.save({ ...classData, date }, actor);
    const collision = await schedule.save(
      { ...classData, date: '2026-02-09', startTime: '09:30', endTime: '10:30' },
      actor,
    );
    await assert.rejects(
      schedule.save(
        { ...classData, date: '2026-03-02', startTime: '09:30', endTime: '10:30' },
        actor,
      ),
    );
    const copy = { from: '2026-03', to: '2026-02', preview: true, idempotencyKey: randomUUID() };
    const preview = await schedule.copy(copy, actor);
    assert.equal(preview.created, 1);
    assert.equal(preview.skipped, 1);
    assert.equal(preview.conflicts.length, 1);
    await assert.rejects(schedule.copy({ ...copy, preview: false }, actor));
    assert.equal((await schedule.list('2026-02')).classes.length, 1);
    await schedule.cancel(collision.id, actor);
    const copied = await schedule.copy({ ...copy, preview: false }, actor);
    assert.equal(copied.created, 2);
    assert.equal(copied.skipped, 1);
    assert.deepEqual(copied.classes.map((item) => item.date).sort(), ['2026-02-02', '2026-02-09']);
    assert.deepEqual(await schedule.copy({ ...copy, preview: false }, actor), copied);
    await assert.rejects(schedule.copy({ ...copy, to: '2026-04', preview: false }, actor));
    assert.equal(
      (await schedule.list('2026-02')).classes.filter((item) => item.status === 'scheduled').length,
      2,
    );
    process.stdout.write(
      'PASS schedule weekday occurrence, fifth week skip, conflict rollback and retry idempotency\n',
    );
    const plan = (
      await db.query<{ id: string }>(
        "SELECT id FROM plans WHERE archived_at IS NULL AND (data->>'visible')::boolean ORDER BY id LIMIT 1",
      )
    ).rows[0];
    assert.ok(plan);
    const member = await members.create(
      {
        fullName: 'Operations check fixture',
        nationalId: `1${randomInt(100000000, 999999999)}`,
        phone: '966501234567',
        ageGroup: 'adult',
        preferredLanguage: 'en',
        planId: plan.id,
        startDate: todayRiyadh(),
        sports: [sport.id],
        notes: 'Isolated schema fixture',
      },
      actor,
    );
    assert.ok(member.membership);
    await db.query('UPDATE members SET phone_verified_at=now() WHERE id=$1', [member.id]);
    const enqueue = async (
      phoneVersion = 1,
      status = 'queued',
      claimedAt: Date | null = null,
    ): Promise<string> => {
      const id = randomUUID();
      await db!.query(
        "INSERT INTO outbox(id,member_id,event,payload,category,status,event_key,claimed_at) VALUES($1,$2,'renewed',$3,'utility',$4,$5,$6)",
        [
          id,
          member.id,
          JSON.stringify({
            membershipId: member.membership?.id,
            membershipVersion: member.membership?.version,
            phoneVersion,
          }),
          status,
          `fixture:${id}`,
          claimedAt,
        ],
      );
      return id;
    };
    const state = async (id: string) => {
      const row = (
        await db!.query<{
          status: string;
          attempts: number;
          claim_token: string | null;
          provider_id: string | null;
        }>('SELECT status,attempts,claim_token,provider_id FROM outbox WHERE id=$1', [id])
      ).rows[0];
      assert.ok(row);
      return row;
    };
    const noConsent = await enqueue();
    await communications.dispatchOne();
    assert.equal((await state(noConsent)).status, 'suppressed');
    assert.equal(network.calls, 0);
    await members.preferences(member.id, { updates: true, marketing: false, locale: 'en' });
    const stalePhone = await enqueue(0);
    await communications.dispatchOne();
    assert.equal((await state(stalePhone)).status, 'suppressed');
    assert.equal(network.calls, 0);
    const uncertain = await enqueue();
    await communications.dispatchOne();
    const claimed = await state(uncertain);
    assert.equal(claimed.status, 'unknown');
    assert.equal(claimed.attempts, 1);
    assert.ok(claimed.claim_token);
    assert.equal(network.calls, 1);
    assert.equal(await communications.dispatchOne(), false);
    assert.equal(network.calls, 1);
    const interrupted = await enqueue(1, 'sending', new Date(Date.now() - 180000));
    await communications.recover();
    assert.equal((await state(interrupted)).status, 'unknown');
    process.stdout.write(
      'PASS notification consent and phone fencing, durable claim, uncertain result without duplicate retry\n',
    );
    const secret = `test-only-${randomUUID()}`;
    process.env.META_APP_SECRET = secret;
    const webhook = new WebhookController(db);
    const app = express();
    app.use(
      express.json({
        verify(req, _response, buffer) {
          Object.defineProperty(req, 'rawBody', { value: buffer });
        },
      }),
    );
    app.post('/webhook', async (req, res) => {
      try {
        const request: RawBodyRequest<Request> = req;
        res.json(await webhook.receive(request));
      } catch (error) {
        res
          .status(
            error instanceof Error && 'getStatus' in error && typeof error.getStatus === 'function'
              ? error.getStatus()
              : 500,
          )
          .json({ failed: true });
      }
    });
    server = await new Promise<Server>((resolve) => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const provider = `check-${randomUUID()}`,
      callback = async (status: string, timestamp: number, valid = true) => {
        const payload = JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    statuses: [
                      {
                        id: provider,
                        status,
                        timestamp: String(timestamp),
                        biz_opaque_callback_data: uncertain,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        });
        const signature = `sha256=${createHmac('sha256', valid ? secret : 'wrong-secret')
          .update(payload)
          .digest('hex')}`;
        return fetch(`http://127.0.0.1:${address.port}/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-hub-signature-256': signature },
          body: payload,
        });
      };
    assert.equal((await callback('read', 200)).status, 200);
    assert.equal((await state(uncertain)).status, 'read');
    assert.equal((await callback('delivered', 100)).status, 200);
    assert.equal((await callback('sent', 300)).status, 200);
    assert.equal((await callback('read', 200)).status, 200);
    assert.equal((await state(uncertain)).status, 'read');
    assert.equal((await callback('failed', 400, false)).status, 403);
    assert.equal(
      (
        await db.query<{ count: string }>(
          'SELECT count(*) FROM whatsapp_receipts WHERE provider_id=$1',
          [provider],
        )
      ).rows[0]?.count,
      '1',
    );
    assert.equal((await state(uncertain)).provider_id, provider);
    process.stdout.write(
      'PASS signed receipts, correlation reconciliation, duplicates and out-of-order status protection\n',
    );
  } finally {
    if (server)
      await new Promise<void>((resolve, reject) =>
        server!.close((error) => (error ? reject(error) : resolve())),
      );
    if (db) await db.onModuleDestroy();
    process.env.DATABASE_URL = original;
    await rootDb.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await rootDb.end();
  }
}
void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Operations checks failed'}\n`);
  process.exitCode = 1;
});
