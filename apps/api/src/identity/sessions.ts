import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { CookieOptions, Request } from 'express';
import { PoolClient } from 'pg';
import { DatabaseService } from '../core/database';
import { CryptoService } from '../core/crypto';
import { RuntimeConfig } from '../core/config';
export interface CookieResponse {
  cookie(name: string, value: string, options: CookieOptions): unknown;
  clearCookie(name: string, options: CookieOptions): unknown;
}
export type Actor = { id: string; kind: 'admin' | 'member'; username?: string };
export interface ActorRequest extends Request {
  actor?: Actor;
}
export function actorOf(req: ActorRequest): Actor {
  if (!req.actor) throw new UnauthorizedException();
  return req.actor;
}
@Injectable()
export class SessionService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
    private readonly config: RuntimeConfig,
  ) {}
  async issue(
    kind: Actor['kind'],
    id: string,
    res: CookieResponse,
    identityVersion: number | null = null,
    client?: PoolClient,
  ): Promise<void> {
    const token = randomBytes(32).toString('base64url');
    const sql =
      "INSERT INTO sessions(token_digest,kind,actor_id,identity_version,expires_at) VALUES($1,$2,$3,$4,now()+interval '12 hours')";
    const params = [this.crypto.digest(token), kind, id, identityVersion];
    if (client) await client.query(sql, params);
    else await this.db.query(sql, params);
    res.cookie(`fc_${kind}`, token, {
      httpOnly: true,
      secure: this.config.production,
      sameSite: 'strict',
      path: '/api',
      maxAge: 43200000,
    });
  }
  async resolve(req: ActorRequest, kind: Actor['kind']): Promise<Actor> {
    const cookies: unknown = req.cookies;
    const token =
      typeof cookies === 'object' && cookies !== null && `fc_${kind}` in cookies
        ? Reflect.get(cookies, `fc_${kind}`)
        : undefined;
    if (typeof token !== 'string' || token.length > 100)
      throw new UnauthorizedException({ code: 'SESSION_REQUIRED', message: 'Please sign in.' });
    const result = await this.db.query<{ id: string; username?: string }>(
      kind === 'admin'
        ? "SELECT a.id,a.username FROM sessions s JOIN admins a ON a.id=s.actor_id WHERE s.token_digest=$1 AND s.kind='admin' AND s.expires_at>now()"
        : "SELECT m.id FROM sessions s JOIN members m ON m.id=s.actor_id WHERE s.token_digest=$1 AND s.kind='member' AND s.expires_at>now() AND m.access_enabled AND m.archived_at IS NULL AND m.phone_verified_at IS NOT NULL AND s.identity_version=m.identity_version",
      [this.crypto.digest(token)],
    );
    const row = result.rows[0];
    if (!row)
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Your session has expired. Please sign in again.',
      });
    req.actor = { ...row, kind };
    return req.actor;
  }
  async revoke(req: ActorRequest, res: CookieResponse, kind: Actor['kind']): Promise<void> {
    const cookies: unknown = req.cookies;
    const token =
      typeof cookies === 'object' && cookies !== null
        ? Reflect.get(cookies, `fc_${kind}`)
        : undefined;
    if (typeof token === 'string')
      await this.db.query('DELETE FROM sessions WHERE token_digest=$1', [
        this.crypto.digest(token),
      ]);
    res.clearCookie(`fc_${kind}`, {
      path: '/api',
      httpOnly: true,
      secure: this.config.production,
      sameSite: 'strict',
    });
  }
}
