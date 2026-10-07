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
import { SmsService } from '../src/sms/sms.service';
import { SmsHttpClient, SmsRequest } from '../src/sms/sms-http.client';
import { HttpException } from '@nestjs/common';
import { ProviderRejected, ProviderUnknown } from '../src/core/delivery-errors';
import { addDays, todayRiyadh } from '../src/members/membership-domain';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ quiet: true });
class CapturingSmsClient extends SmsHttpClient {
  calls = 0;
  payload: SmsRequest | undefined;
  mode:
    'numeric' | 'string' | 'rejected' | 'unknown' | 'wrongPhone' | 'unauthorized' | 'malformed' =
    'numeric';
  override async post(payload: SmsRequest, bearer: string): Promise<Response> {
    this.calls++;
    this.payload = payload;
    assert.equal(bearer, 'regression-test-token');
    if (this.mode === 'unknown') throw new Error('Simulated transport failure');
    if (this.mode === 'unauthorized') return Response.json({ statusCode: 401 }, { status: 401 });
    if (this.mode === 'malformed')
      return Response.json(
        {
          statusCode: 201,
          messageId: 'unexpected',
          totalCount: 1,
          accepted: '[broken]',
          rejected: '[]',
        },
        { status: 201 },
      );
    return Response.json(
      {
        statusCode: 201,
        messageId: this.mode === 'string' ? '5829452722' : 5452899970,
        totalCount: this.mode === 'rejected' ? 0 : 1,
        accepted:
          this.mode === 'rejected'
            ? '[]'
            : `[${this.mode === 'wrongPhone' ? '966599999999' : payload.recipients[0]},]`,
        rejected: this.mode === 'rejected' ? `[${payload.recipients[0]},]` : '[]',
      },
      { status: 201 },
    );
  }
}
function errorCode(error: unknown, code: string): boolean {
  if (!(error instanceof HttpException)) return false;
  const response = error.getResponse();
  return typeof response === 'object' && 'code' in response && response.code === code;
}
async function verifySmsWireFormat(): Promise<void> {
  const previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (input, init) => {
    requests++;
    assert.equal(input, 'https://api.taqnyat.sa/v1/messages');
    assert.equal(init?.method, 'POST');
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('authorization'), 'Bearer test-wire-token');
    assert.equal(headers.get('content-type'), 'application/json');
    assert.equal(typeof init?.body, 'string');
    if (typeof init?.body !== 'string') throw new Error('Expected JSON request');
    const body: unknown = JSON.parse(init.body);
    assert.deepEqual(body, {
      recipients: ['966501234567'],
      body: 'Verification wire fixture',
      sender: 'TestApproved',
    });
    assert.ok(init.signal);
    return Response.json({ statusCode: 201 }, { status: 201 });
  };
  try {
    await new SmsHttpClient().post(
      { recipients: ['966501234567'], body: 'Verification wire fixture', sender: 'TestApproved' },
      'test-wire-token',
    );
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = previous;
  }
  process.stdout.write(
    'PASS Taqnyat endpoint, bearer header and single-recipient JSON wire format\n',
  );
}
async function withEnvironment(
  values: Record<string, string | undefined>,
  action: () => Promise<void>,
): Promise<void> {
  const previous = new Map(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await action();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
async function verifyPreviewStartupGates(): Promise<void> {
  const safe = {
    LOCAL_OTP_PREVIEW: 'true',
    NODE_ENV: 'development',
    APP_ORIGIN: 'http://127.0.0.1:3100',
    TRUST_PROXY: '0',
  };
  for (const unsafe of [
    { NODE_ENV: 'production' },
    { NODE_ENV: 'test' },
    { APP_ORIGIN: 'https://club.example.com' },
    { TRUST_PROXY: '1' },
    { APP_ORIGIN: 'http://localhost.attacker.test' },
  ]) {
    await withEnvironment({ ...safe, ...unsafe }, async () =>
      assert.throws(() => new RuntimeConfig()),
    );
  }
  await withEnvironment(safe, async () => {
    const config = new RuntimeConfig();
    assert.equal(config.permitsLocalOtp('127.0.0.1'), true);
    assert.equal(config.permitsLocalOtp('::1'), true);
    assert.equal(config.permitsLocalOtp('::ffff:127.0.0.1'), true);
    assert.equal(config.permitsLocalOtp('192.0.2.1'), false);
  });
  process.stdout.write(
    'PASS preview startup production, public-origin, proxy and request-IP gates\n',
  );
}
async function verifyLocalPreview(
  db: DatabaseService,
  crypto: CryptoService,
  sms: SmsService,
  smsClient: CapturingSmsClient,
  memberId: string,
  nationalId: string,
  phone: string,
  response: CookieResponse,
): Promise<void> {
  const ip = '127.0.0.1',
    input = { nationalId, phone, authConsent: true, locale: 'en' };
  const previousProof = (
    await db.query<{ proof: string | null }>(
      'SELECT phone_verified_at::text proof FROM members WHERE id=$1',
      [memberId],
    )
  ).rows[0]?.proof;
  await db.query('UPDATE members SET phone_verified_at=NULL WHERE id=$1', [memberId]);
  let localToken: string | undefined;
  const capture: CookieResponse = {
    cookie(name, value, options) {
      if (name === 'fc_member') localToken = value;
      return response.cookie(name, value, options);
    },
    clearCookie(name, options) {
      return response.clearCookie(name, options);
    },
  };
  await db.query('DELETE FROM rate_limits WHERE key=ANY($1::text[])', [
    [
      crypto.digest(`member-id:${nationalId}`),
      crypto.digest(`member-phone:${phone}`),
      crypto.digest(`member-ip:${ip}`),
      crypto.digest(`verify:${ip}`),
    ],
  ]);
  await withEnvironment(
    {
      LOCAL_OTP_PREVIEW: 'true',
      NODE_ENV: 'development',
      APP_ORIGIN: 'http://127.0.0.1:3100',
      TRUST_PROXY: '0',
    },
    async () => {
      const runtime = new RuntimeConfig(),
        localSessions = new SessionService(db, crypto, runtime);
      const identity = new IdentityService(
          db,
          crypto,
          new RateLimitService(db, crypto),
          localSessions,
          sms,
          runtime,
        ),
        calls = smsClient.calls;
      await assert.rejects(identity.memberLogin(input, '192.0.2.1'), (error) =>
        errorCode(error, 'LOCAL_PREVIEW_FORBIDDEN'),
      );
      const challenge = await identity.memberLogin(input, ip);
      assert.ok(challenge.developmentCode);
      const stored = (
        await db.query<{
          delivery_status: string;
          code_digest: string;
          channel: string;
          status: string;
          provider_id: string | null;
          payload: unknown;
        }>(
          'SELECT c.delivery_status,c.code_digest,o.channel,o.status,o.provider_id,o.payload FROM login_challenges c JOIN outbox o ON o.id=c.id WHERE c.id=$1',
          [challenge.challengeId],
        )
      ).rows[0];
      assert.ok(stored);
      assert.equal(stored.delivery_status, 'local_preview');
      assert.equal(stored.channel, 'local');
      assert.equal(stored.status, 'preview');
      assert.equal(stored.provider_id, null);
      assert.equal(
        stored.code_digest,
        crypto.digest(`${challenge.challengeId}:${challenge.developmentCode}`),
      );
      assert.deepEqual(stored.payload, { challengeId: challenge.challengeId });
      await assert.rejects(
        identity.memberVerify(
          { challengeId: challenge.challengeId, code: challenge.developmentCode },
          '192.0.2.1',
          capture,
        ),
      );
      const results = await Promise.allSettled([
        identity.memberVerify(
          { challengeId: challenge.challengeId, code: challenge.developmentCode },
          ip,
          capture,
        ),
        identity.memberVerify(
          { challengeId: challenge.challengeId, code: challenge.developmentCode },
          ip,
          capture,
        ),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.ok(localToken);
      const request = { cookies: { fc_member: localToken }, ip };
      assert.equal((await localSessions.resolve(request, 'member')).id, memberId);
      await assert.rejects(localSessions.resolve({ ...request, ip: '192.0.2.1' }, 'member'));
      assert.equal(
        (
          await db.query<{ proof: string | null }>(
            'SELECT phone_verified_at::text proof FROM members WHERE id=$1',
            [memberId],
          )
        ).rows[0]?.proof,
        null,
      );
      assert.equal(
        (
          await db.query<{ eligible: string }>(
            'SELECT count(*) eligible FROM members WHERE id=$1 AND marketing_consent AND access_enabled AND archived_at IS NULL AND phone_verified_at IS NOT NULL',
            [memberId],
          )
        ).rows[0]?.eligible,
        '0',
      );
      const bounded = await identity.memberLogin(input, ip);
      assert.ok(bounded.developmentCode);
      for (let attempt = 0; attempt < 5; attempt++)
        await assert.rejects(
          identity.memberVerify({ challengeId: bounded.challengeId, code: '000000' }, ip, capture),
        );
      await assert.rejects(
        identity.memberVerify(
          { challengeId: bounded.challengeId, code: bounded.developmentCode },
          ip,
          capture,
        ),
      );
      const expired = await identity.memberLogin(input, ip);
      assert.ok(expired.developmentCode);
      await db.query(
        "UPDATE login_challenges SET expires_at=now()-interval '1 second' WHERE id=$1",
        [expired.challengeId],
      );
      await assert.rejects(
        identity.memberVerify(
          { challengeId: expired.challengeId, code: expired.developmentCode },
          ip,
          capture,
        ),
      );
      const disabled = await identity.memberLogin(input, ip);
      assert.ok(disabled.developmentCode);
      await withEnvironment({ LOCAL_OTP_PREVIEW: 'false' }, async () => {
        const normalConfig = new RuntimeConfig(),
          normalSessions = new SessionService(db, crypto, normalConfig);
        assert.ok(localToken);
        await assert.rejects(
          normalSessions.resolve({ cookies: { fc_member: localToken }, ip }, 'member'),
        );
        const normal = new IdentityService(
          db,
          crypto,
          new RateLimitService(db, crypto),
          normalSessions,
          sms,
          normalConfig,
        );
        await assert.rejects(
          normal.memberVerify(
            { challengeId: disabled.challengeId, code: disabled.developmentCode },
            ip,
            capture,
          ),
        );
      });
      if (previousProof) {
        await db.query('UPDATE members SET phone_verified_at=$2::timestamptz WHERE id=$1', [
          memberId,
          previousProof,
        ]);
        const keepProof = await identity.memberLogin(input, ip);
        assert.ok(keepProof.developmentCode);
        await identity.memberVerify(
          { challengeId: keepProof.challengeId, code: keepProof.developmentCode },
          ip,
          capture,
        );
        assert.equal(
          (
            await db.query<{ proof: string }>(
              'SELECT phone_verified_at::text proof FROM members WHERE id=$1',
              [memberId],
            )
          ).rows[0]?.proof,
          previousProof,
        );
      }
      assert.equal(smsClient.calls, calls);
      assert.equal(
        (
          await db.query<{ source: string }>(
            "SELECT source FROM consent_events WHERE member_id=$1 AND source='member.login.local_preview' LIMIT 1",
            [memberId],
          )
        ).rows[0]?.source,
        'member.login.local_preview',
      );
    },
  );
  process.stdout.write(
    'PASS local preview hash-only storage, no provider send, concurrency, expiry, attempt bounds, session fencing and no fabricated phone verification\n',
  );
}
async function main(): Promise<void> {
  if (
    !process.env.DATABASE_URL ||
    !['127.0.0.1', 'localhost'].includes(new URL(process.env.DATABASE_URL).hostname)
  )
    throw new Error('Regression checks require a local database');
  await verifyPreviewStartupGates();
  await verifySmsWireFormat();
  const previousPreview = process.env.LOCAL_OTP_PREVIEW;
  process.env.LOCAL_OTP_PREVIEW = 'false';
  const runtime = new RuntimeConfig(),
    db = new DatabaseService(runtime),
    crypto = new CryptoService(runtime),
    sessions = new SessionService(db, crypto, runtime),
    members = new MembersService(db, crypto),
    smsClient = new CapturingSmsClient(),
    sms = new SmsService(smsClient),
    identity = new IdentityService(
      db,
      crypto,
      new RateLimitService(db, crypto),
      sessions,
      sms,
      runtime,
    );
  const originalSms = {
    provider: process.env.SMS_PROVIDER,
    token: process.env.TAQNYAT_BEARER_TOKEN,
    sender: process.env.TAQNYAT_SENDER,
  };
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
    phone = `9665${randomInt(10000000, 99999999)}`;
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
    delete process.env.TAQNYAT_BEARER_TOKEN;
    const loginInput = { nationalId: idNumber, phone, authConsent: true, locale: 'en' };
    await assert.rejects(identity.memberLogin(loginInput, 'sms-preflight-local'), (error) =>
      errorCode(error, 'SMS_UNAVAILABLE'),
    );
    assert.equal(
      (
        await db.query<{ total: string }>(
          'SELECT count(*) total FROM login_challenges WHERE member_id=$1',
          [member.id],
        )
      ).rows[0]?.total,
      '0',
    );
    assert.equal(smsClient.calls, 0);
    process.env.SMS_PROVIDER = 'taqnyat';
    process.env.TAQNYAT_BEARER_TOKEN = 'regression-test-token';
    process.env.TAQNYAT_SENDER = 'TestApproved';
    assert.equal(await sms.sendAuthentication(phone, '123456', 'ar'), '5452899970');
    assert.deepEqual(smsClient.payload?.recipients, [phone]);
    assert.equal(smsClient.payload?.sender, 'TestApproved');
    assert.match(smsClient.payload?.body || '', /123456/);
    smsClient.mode = 'string';
    assert.equal(await sms.sendAuthentication(phone, '123456', 'en'), '5829452722');
    smsClient.mode = 'rejected';
    await assert.rejects(sms.sendAuthentication(phone, '123456', 'en'), ProviderRejected);
    smsClient.mode = 'wrongPhone';
    await assert.rejects(sms.sendAuthentication(phone, '123456', 'en'), ProviderUnknown);
    smsClient.mode = 'unauthorized';
    await assert.rejects(sms.sendAuthentication(phone, '123456', 'en'), ProviderRejected);
    smsClient.mode = 'malformed';
    await assert.rejects(sms.sendAuthentication(phone, '123456', 'en'), ProviderUnknown);
    smsClient.mode = 'numeric';
    const issued = await identity.memberLogin(loginInput, 'sms-issued-local');
    const issuedCode = smsClient.payload?.body.match(/\b(\d{6})\b/)?.[1];
    assert.ok(issuedCode);
    const outcomes = await Promise.allSettled([
      identity.memberVerify(
        { challengeId: issued.challengeId, code: issuedCode },
        'sms-issued-local',
        response,
      ),
      identity.memberVerify(
        { challengeId: issued.challengeId, code: issuedCode },
        'sms-issued-local',
        response,
      ),
    ]);
    assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(
      (
        await db.query<{ channel: string; status: string }>(
          'SELECT channel,status FROM outbox WHERE id=$1',
          [issued.challengeId],
        )
      ).rows[0]?.channel,
      'sms',
    );
    assert.deepEqual((await members.get(member.id)).consent, { updates: false, marketing: true });
    smsClient.mode = 'unknown';
    const calls = smsClient.calls;
    await assert.rejects(identity.memberLogin(loginInput, 'sms-unknown-local'), (error) =>
      errorCode(error, 'SMS_DELIVERY_FAILED'),
    );
    assert.equal(smsClient.calls, calls + 1);
    const unknown = (
      await db.query<{ status: string; consumed: boolean }>(
        "SELECT o.status,c.consumed_at IS NOT NULL consumed FROM outbox o JOIN login_challenges c ON c.id=o.id WHERE o.member_id=$1 AND o.status='unknown'",
        [member.id],
      )
    ).rows[0];
    assert.equal(unknown?.status, 'unknown');
    assert.equal(unknown?.consumed, true);
    process.stdout.write(
      'PASS SMS preflight without challenge writes, numeric/string receipts, recipient rejection, concurrent single use, consent preservation and unknown outcome without retry\n',
    );
    await verifyLocalPreview(db, crypto, sms, smsClient, member.id, idNumber, phone, response);
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
    if (previousPreview === undefined) delete process.env.LOCAL_OTP_PREVIEW;
    else process.env.LOCAL_OTP_PREVIEW = previousPreview;
    for (const [key, value] of [
      ['SMS_PROVIDER', originalSms.provider],
      ['TAQNYAT_BEARER_TOKEN', originalSms.token],
      ['TAQNYAT_SENDER', originalSms.sender],
    ] as const) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
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
