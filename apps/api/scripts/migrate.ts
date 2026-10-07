import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Pool } from 'pg';
config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ quiet: true });
async function migrate(): Promise<void> {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock(49277401)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const path = resolve(process.cwd(), 'migrations');
    for (const name of (await readdir(path)).filter((name) => name.endsWith('.sql')).sort()) {
      const sql = await readFile(resolve(path, name), 'utf8'),
        checksum = createHash('sha256').update(sql).digest('hex');
      const previous = (
        await client.query<{ checksum: string }>(
          'SELECT checksum FROM schema_migrations WHERE name=$1',
          [name],
        )
      ).rows[0];
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error(`Migration ${name} changed after application`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(name,checksum) VALUES($1,$2)', [
          name,
          checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      process.stdout.write(`Applied ${name}\n`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(49277401)');
    client.release();
    await pool.end();
  }
}
void migrate().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Migration failed'}\n`);
  process.exitCode = 1;
});
