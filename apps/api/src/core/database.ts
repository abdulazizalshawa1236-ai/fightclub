import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { RuntimeConfig } from './config';
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  constructor(config: RuntimeConfig) {
    this.pool = new Pool({
      connectionString: config.databaseUrl,
      max: 12,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
  }
  query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(sql, params);
  }
  async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await action(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
