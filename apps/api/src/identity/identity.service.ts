import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { MemberLoginChallenge } from '@fightclub/shared';
import { RuntimeConfig } from '../core/config';
import { CryptoService } from '../core/crypto';
import { DatabaseService } from '../core/database';
import { RateLimitService } from '../core/rate-limit';
import { parse, nationalIdSchema, phoneSchema, uuidSchema } from '../core/validation';
import { CookieResponse, SessionService } from './sessions';
import { ProviderUnknown } from '../core/delivery-errors';
import { SmsService } from '../sms/sms.service';
const credentials = z
  .object({ username: z.string().min(3).max(80), password: z.string().min(1).max(72) })
  .strict();
const changeCredentials = z
  .object({
    currentPassword: z.string().min(1).max(72),
    username: z.string().min(3).max(80).optional(),
    newPassword: z
      .string()
      .min(12)
      .refine((value) => Buffer.byteLength(value, 'utf8') <= 72)
      .optional(),
  })
  .strict()
  .refine((value) => value.username || value.newPassword, 'Provide a username or password');
const login = z
  .object({
    nationalId: nationalIdSchema,
    phone: phoneSchema,
    authConsent: z.literal(true),
    locale: z.enum(['ar', 'en']),
  })
  .strict();
const verify = z.object({ challengeId: uuidSchema, code: z.string().regex(/^\d{6}$/) }).strict();
@Injectable()
export class IdentityService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly rates: RateLimitService,
    private readonly sessions: SessionService,
    private readonly sms: SmsService,
    private readonly config: RuntimeConfig,
  ) {}
  async adminLogin(input: unknown, ip: string, res: CookieResponse): Promise<{ username: string }> {
    const data = parse(credentials, input);
    await Promise.all([
      this.rates.take(`admin:${ip}`, 10, 900),
      this.rates.take(`admin-user:${data.username}`, 10, 900),
    ]);
    return this.db.transaction(async (client) => {
      const row = (
        await client.query<{ id: string; username: string; password_hash: string }>(
          'SELECT * FROM admins WHERE username=$1 FOR UPDATE',
          [data.username],
        )
      ).rows[0];
      const valid = await compare(
        data.password,
        row?.password_hash || '$2b$12$lsFMqEVdIJ.Hsf25vgISzuC51GktLtupUIjGWYKVPXAxom/KDqpyy',
      );
      if (!row || !valid)
        throw new UnauthorizedException({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid username or password.',
        });
      await this.sessions.issue('admin', row.id, res, null, client);
      return { username: row.username };
    });
  }
  async credentials(
    id: string,
    input: unknown,
    res: CookieResponse,
  ): Promise<{ username: string }> {
    const data = parse(changeCredentials, input);
    const result = await this.db.transaction(async (client) => {
      const row = (
        await client.query<{ username: string; password_hash: string }>(
          'SELECT * FROM admins WHERE id=$1 FOR UPDATE',
          [id],
        )
      ).rows[0];
      if (!row || !(await compare(data.currentPassword, row.password_hash)))
        throw new UnauthorizedException({
          code: 'INVALID_PASSWORD',
          message: 'Current password is incorrect.',
        });
      const password = data.newPassword ? await hash(data.newPassword, 12) : row.password_hash;
      const username = data.username || row.username;
      await client.query('UPDATE admins SET username=$2,password_hash=$3 WHERE id=$1', [
        id,
        username,
        password,
      ]);
      await client.query('DELETE FROM sessions WHERE actor_id=$1', [id]);
      await client.query('INSERT INTO audit_events(id,actor,action,details) VALUES($1,$2,$3,$4)', [
        randomUUID(),
        id,
        'admin.credentials.changed',
        JSON.stringify({
          usernameChanged: username !== row.username,
          passwordChanged: !!data.newPassword,
        }),
      ]);
      return { username };
    });
    res.clearCookie('fc_admin', { path: '/api' });
    return result;
  }
  async memberLogin(input: unknown, ip: string): Promise<MemberLoginChallenge> {
    const data = parse(login, input);
    const localPreview = this.config.localOtpPreview;
    const hostedDemo = this.config.hostedOtpDemo;
    const preview = localPreview || hostedDemo;
    if (localPreview && !this.config.permitsLocalOtp(ip))
      throw new ForbiddenException({
        code: 'LOCAL_PREVIEW_FORBIDDEN',
        message: 'Local OTP preview is available only on this computer.',
      });
    if (!preview) this.sms.assertConfigured();
    await Promise.all([
      this.rates.take(`member-ip:${ip}`, 10, 900),
      this.rates.take(`member-id:${data.nationalId}`, 5, 900),
      this.rates.take(`member-phone:${data.phone}`, 5, 900),
    ]);
    const row = (
      await this.db.query<{ id: string; phone: string; identity_version: number }>(
        'SELECT id,phone,identity_version FROM members WHERE national_id_digest=$1 AND phone=$2 AND access_enabled AND archived_at IS NULL',
        [this.crypto.digest(data.nationalId), data.phone],
      )
    ).rows[0];
    if (!row)
      throw new UnauthorizedException({
        code: 'MEMBER_NOT_FOUND',
        message: 'These details could not be verified. Please contact the club.',
      });
    if (hostedDemo && !this.config.permitsHostedOtp(row.id))
      throw new ForbiddenException({
        code: 'DEMO_MEMBER_REQUIRED',
        message: 'Hosted demonstrations are available only for the designated test member.',
      });
    const challengeId = randomUUID(),
      code = String(randomInt(100000, 1000000));
    await this.db.transaction(async (client) => {
      const current = (
        await client.query<{ phone: string; identity_version: number }>(
          'SELECT phone,identity_version FROM members WHERE id=$1 AND access_enabled AND archived_at IS NULL FOR UPDATE',
          [row.id],
        )
      ).rows[0];
      if (
        !current ||
        current.phone !== row.phone ||
        current.identity_version !== row.identity_version
      )
        throw new UnauthorizedException('Member details changed. Please sign in again.');
      await client.query(
        'UPDATE login_challenges SET consumed_at=now() WHERE member_id=$1 AND consumed_at IS NULL',
        [row.id],
      );
      await client.query(
        "INSERT INTO login_challenges(id,member_id,phone,identity_version,code_digest,expires_at,delivery_status) VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes',$6)",
        [
          challengeId,
          row.id,
          row.phone,
          row.identity_version,
          this.crypto.digest(`${challengeId}:${code}`),
          hostedDemo ? 'hosted_demo' : localPreview ? 'local_preview' : 'sending',
        ],
      );
      await client.query(
        "INSERT INTO outbox(id,member_id,event,payload,category,status,event_key,claimed_at,channel) VALUES($1,$2,'login_code',$3,'authentication',$5,$4,CASE WHEN $6='sms' THEN now() ELSE NULL END,$6)",
        [
          challengeId,
          row.id,
          JSON.stringify({ challengeId }),
          `login:${challengeId}`,
          preview ? 'preview' : 'sending',
          hostedDemo ? 'demo' : localPreview ? 'local' : 'sms',
        ],
      );
      await client.query(
        "INSERT INTO consent_events(id,member_id,category,allowed,source) VALUES($1,$2,'authentication',true,$3)",
        [
          randomUUID(),
          row.id,
          hostedDemo
            ? 'member.login.hosted_demo'
            : localPreview
              ? 'member.login.local_preview'
              : 'member.login.sms',
        ],
      );
    });
    const challenge = {
      challengeId,
      maskedPhone: `+${row.phone.slice(0, 3)} ******${row.phone.slice(-3)}`,
    };
    if (hostedDemo) return { ...challenge, demoCode: code };
    if (localPreview) return { ...challenge, developmentCode: code };
    let providerId: string;
    try {
      providerId = await this.sms.sendAuthentication(row.phone, code, data.locale);
    } catch (error) {
      await this.db.query(
        "UPDATE login_challenges SET consumed_at=now(),delivery_status='failed' WHERE id=$1",
        [challengeId],
      );
      await this.db.query(
        "UPDATE outbox SET status=$2,error='Authentication delivery unavailable',updated_at=now() WHERE id=$1 AND status IN ('sending','queued')",
        [challengeId, error instanceof ProviderUnknown ? 'unknown' : 'failed'],
      );
      throw new ServiceUnavailableException({
        code: 'SMS_DELIVERY_FAILED',
        message: 'The login code could not be sent. Please try again later.',
      });
    }
    await this.db.transaction(async (client) => {
      await client.query("UPDATE login_challenges SET delivery_status='accepted' WHERE id=$1", [
        challengeId,
      ]);
      await client.query(
        "UPDATE outbox SET provider_id=$2,status=CASE WHEN status='sending' THEN 'accepted' ELSE status END,updated_at=now() WHERE id=$1",
        [challengeId, providerId],
      );
    });
    return challenge;
  }
  async memberVerify(input: unknown, ip: string, res: CookieResponse): Promise<void> {
    const data = parse(verify, input);
    await this.rates.take(`verify:${ip}`, 30, 900);
    const result = await this.db.transaction(async (client) => {
      const challenge = (
        await client.query<{ member_id: string }>(
          'SELECT member_id FROM login_challenges WHERE id=$1',
          [data.challengeId],
        )
      ).rows[0];
      if (!challenge) return false;
      const member = (
        await client.query<{ phone: string; identity_version: number }>(
          'SELECT phone,identity_version FROM members WHERE id=$1 AND access_enabled AND archived_at IS NULL FOR UPDATE',
          [challenge.member_id],
        )
      ).rows[0];
      const row = (
        await client.query<{
          member_id: string;
          phone: string;
          identity_version: number;
          code_digest: string;
          attempts: number;
          expires_at: Date;
          consumed_at: Date | null;
          delivery_status: string;
        }>('SELECT * FROM login_challenges WHERE id=$1 FOR UPDATE', [data.challengeId])
      ).rows[0];
      if (
        !row ||
        row.consumed_at ||
        row.attempts >= 5 ||
        row.expires_at.getTime() <= Date.now() ||
        !(
          row.delivery_status === 'accepted' ||
          (row.delivery_status === 'local_preview' && this.config.permitsLocalOtp(ip)) ||
          (row.delivery_status === 'hosted_demo' && this.config.permitsHostedOtp(row.member_id))
        )
      )
        return false;
      await client.query('UPDATE login_challenges SET attempts=attempts+1 WHERE id=$1', [
        data.challengeId,
      ]);
      if (
        !member ||
        member.phone !== row.phone ||
        member.identity_version !== row.identity_version ||
        !this.crypto.equal(row.code_digest, this.crypto.digest(`${data.challengeId}:${data.code}`))
      )
        return false;
      await client.query('UPDATE login_challenges SET consumed_at=now() WHERE id=$1', [
        data.challengeId,
      ]);
      const localPreview = row.delivery_status === 'local_preview';
      const hostedDemo = row.delivery_status === 'hosted_demo';
      if (!localPreview && !hostedDemo)
        await client.query('UPDATE members SET phone_verified_at=now() WHERE id=$1', [
          row.member_id,
        ]);
      await this.sessions.issue(
        'member',
        row.member_id,
        res,
        row.identity_version,
        client,
        localPreview,
        hostedDemo,
      );
      return true;
    });
    if (!result)
      throw new UnauthorizedException({
        code: 'INVALID_CODE',
        message: 'The code is incorrect, expired, or already used.',
      });
  }
}
