import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { randomInt, randomUUID } from 'node:crypto';
import { hash } from 'bcrypt';
import assert from 'node:assert/strict';
import { RuntimeConfig } from '../src/core/config';
import { DatabaseService } from '../src/core/database';
import { CryptoService } from '../src/core/crypto';
import { RateLimitService } from '../src/core/rate-limit';
import { CookieResponse, SessionService } from '../src/identity/sessions';
import { IdentityService } from '../src/identity/identity.service';
import { MembersService } from '../src/members/members.service';
import { WhatsAppService } from '../src/operations/whatsapp.service';
import { addDays, todayRiyadh } from '../src/members/membership-domain';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ quiet: true });
async function main(): Promise<void> {
  if (
    !process.env.DATABASE_URL ||
    !['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL).hostname)
  )
    throw new Error('Regression checks require a local database');
  const runtime = new RuntimeConfig(),
    db = new DatabaseService(runtime),
    crypto = new CryptoService(runtime),
    sessions = new SessionService(db, crypto, runtime),
    members = new MembersService(db, crypto),
    identity = new IdentityService(
      db,
      crypto,
      new RateLimitService(db, crypto),
      sessions,
      new WhatsAppService(),
    );
  const cookies = new Map<string, string>();
  const response: CookieResponse = {
    cookie(name, value) {
      cookies.set(name, value);
    },
    clearCookie(name) {
      cookies.delete(name);
    },
  };
  const idNumber = `1${randomInt(100000000, 999999999)}`,
    phone = '966501234567';
  let memberId: string | undefined;
  const adminId = randomUUID(),
    username = `check-${adminId.slice(0, 8)}`,
    password = 'Regression-only-password-435';
  try {
    const catalogue = (
      await db.query<{ id: string; data: { durationDays: number } }>(
        "SELECT id,data FROM plans WHERE archived_at IS NULL AND (data->>'visible')::boolean ORDER BY id LIMIT 1",
      )
    ).rows[0];
    assert.ok(catalogue, 'Seed a visible plan before regression checks');
    const sport = (
      await db.query<{ id: string }>(
        "SELECT id FROM sports WHERE archived_at IS NULL AND (data->>'available')::boolean ORDER BY id LIMIT 1",
      )
    ).rows[0];
    assert.ok(sport, 'Seed an available sport before regression checks');
    const member = await members.create(
      {
        fullName: 'Regression check member',
        nationalId: idNumber,
        phone,
        ageGroup: 'adult',
        preferredLanguage: 'en',
        planId: catalogue.id,
        startDate: todayRiyadh(),
        sports: [sport.id],
        notes: 'Transient integration fixture',
        consent: { updates: false, marketing: true },
      },
      adminId,
    );
    memberId = member.id;
    assert.ok(member.membership);
    const input = {
      planId: catalogue.id,
      sports: [sport.id],
      expectedVersion: member.membership.version,
      idempotencyKey: randomUUID(),
    };
    const [first, second] = await Promise.all([
      members.renew(member.id, input, adminId),
      members.renew(member.id, input, adminId),
    ]);
    assert.deepEqual(first, second);
    assert.equal(first.membership?.version, member.membership.version + 1);
    const plan = catalogue;
    assert.equal(
      first.membership?.endDate,
      addDays(member.membership.endDate, plan.data.durationDays),
    );
    await assert.rejects(members.renew(member.id, { ...input, sports: ['muay-thai'] }, adminId));
    await assert.rejects(
      members.renew(member.id, { ...input, idempotencyKey: randomUUID() }, adminId),
    );
    assert.equal(
      (
        await db.query<{ total: string }>(
          "SELECT count(*) total FROM membership_operations WHERE member_id=$1 AND action='membership.renewed'",
          [member.id],
        )
      ).rows[0]?.total,
      '1',
    );
    process.stdout.write(
      'PASS concurrent renewal retry, payload conflict, stale version, durable ledger\n',
    );
    const challengeId = randomUUID(),
      code = '123456';
    await db.query(
      "INSERT INTO login_challenges(id,member_id,phone,identity_version,code_digest,expires_at,delivery_status) VALUES($1,$2,$3,1,$4,now()+interval '5 minutes','accepted')",
      [challengeId, member.id, phone, crypto.digest(`${challengeId}:${code}`)],
    );
    await identity.memberVerify({ challengeId, code }, 'integration-local', response);
    assert.ok(cookies.get('fc_member'));
    const verified = await members.get(member.id);
    assert.equal(verified.verified, true);
    assert.deepEqual(verified.consent, { updates: false, marketing: true });
    await assert.rejects(
      identity.memberVerify({ challengeId, code }, 'integration-local', response),
    );
    const challenge2 = randomUUID();
    await db.query(
      "INSERT INTO login_challenges(id,member_id,phone,identity_version,code_digest,expires_at,delivery_status) VALUES($1,$2,$3,1,$4,now()+interval '5 minutes','accepted')",
      [challenge2, member.id, phone, crypto.digest(`${challenge2}:${code}`)],
    );
    await members.edit(member.id, { phone: '966501234568' }, adminId);
    assert.equal((await members.get(member.id)).verified, false);
    assert.equal((await members.get(member.id)).notes, 'Transient integration fixture');
    await assert.rejects(
      identity.memberVerify({ challengeId: challenge2, code }, 'integration-local', response),
    );
    assert.equal(
      (
        await db.query<{ total: string }>('SELECT count(*) total FROM sessions WHERE actor_id=$1', [
          member.id,
        ])
      ).rows[0]?.total,
      '0',
    );
    process.stdout.write(
      'PASS OTP atomic consume, unchanged consent, replacement phone revocation\n',
    );
    await db.query('INSERT INTO admins(id,username,password_hash) VALUES($1,$2,$3)', [
      adminId,
      username,
      await hash(password, 12),
    ]);
    await identity.adminLogin({ username, password }, 'integration-admin', response);
    assert.ok(cookies.get('fc_admin'));
    await assert.rejects(
      identity.credentials(
        adminId,
        { currentPassword: 'incorrect', newPassword: 'Replacement-secret-456' },
        response,
      ),
    );
    await identity.credentials(
      adminId,
      { currentPassword: password, newPassword: 'Replacement-secret-456' },
      response,
    );
    assert.equal(
      (
        await db.query<{ total: string }>('SELECT count(*) total FROM sessions WHERE actor_id=$1', [
          adminId,
        ])
      ).rows[0]?.total,
      '0',
    );
    await assert.rejects(
      identity.adminLogin({ username, password }, 'integration-admin', response),
    );
    process.stdout.write('PASS admin current-password check and session revocation\n');
  } finally {
    await db.transaction(async (client) => {
      if (memberId) {
        for (const table of [
          'announcement_reads',
          'consent_events',
          'outbox',
          'login_challenges',
          'audit_events',
          'membership_operations',
          'memberships',
        ])
          await client.query(`DELETE FROM ${table} WHERE member_id=$1`, [memberId]);
        await client.query('DELETE FROM sessions WHERE actor_id=$1', [memberId]);
        await client.query('DELETE FROM members WHERE id=$1', [memberId]);
      }
      await client.query('DELETE FROM sessions WHERE actor_id=$1', [adminId]);
      await client.query('DELETE FROM audit_events WHERE actor=$1', [adminId]);
      await client.query('DELETE FROM admins WHERE id=$1', [adminId]);
    });
    await db.onModuleDestroy();
  }
}
void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Integration failed'}\n`);
  process.exitCode = 1;
});
