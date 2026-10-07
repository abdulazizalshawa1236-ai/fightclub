import { Injectable, HttpException } from '@nestjs/common';
import { DatabaseService } from './database';
import { CryptoService } from './crypto';
@Injectable()
export class RateLimitService {
  constructor(
    private readonly db: DatabaseService,
    private readonly crypto: CryptoService,
  ) {}
  async take(key: string, limit: number, windowSeconds: number): Promise<void> {
    const result = await this.db.query<{ count: number }>(
      "INSERT INTO rate_limits(key,window_start,count) VALUES($1,now(),1) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.window_start < now()-$2::integer*interval '1 second' THEN 1 ELSE rate_limits.count+1 END,window_start=CASE WHEN rate_limits.window_start < now()-$2::integer*interval '1 second' THEN now() ELSE rate_limits.window_start END RETURNING count",
      [this.crypto.digest(key), windowSeconds],
    );
    if ((result.rows[0]?.count || 0) > limit)
      throw new HttpException(
        { code: 'RATE_LIMITED', message: 'Too many attempts. Please try again later.' },
        429,
      );
  }
}
