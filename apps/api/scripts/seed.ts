import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(__dirname, '../../../.env'), quiet: true });
import { Pool } from 'pg';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { seedSite } from '@fightclub/shared';
async function main(): Promise<void> {
  if (
    !process.env.DATABASE_URL ||
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD ||
    Buffer.byteLength(process.env.ADMIN_PASSWORD) > 72 ||
    process.env.ADMIN_PASSWORD.length < 12
  )
    throw new Error('Set database URL and strong admin credentials before seeding');
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('club.seed'))");
    await client.query(
      'INSERT INTO admins(id,username,password_hash) VALUES($1,$2,$3) ON CONFLICT(username) DO NOTHING',
      [randomUUID(), process.env.ADMIN_USERNAME, await hash(process.env.ADMIN_PASSWORD, 12)],
    );
    for (const [table, items] of [
      ['plans', seedSite.plans],
      ['sports', seedSite.sports],
      ['coaches', seedSite.coaches],
      ['offers', seedSite.offers],
    ] as const)
      for (const item of items)
        await client.query(
          `INSERT INTO ${table}(id,data) VALUES($1,$2) ON CONFLICT(id) DO NOTHING`,
          [item.id, JSON.stringify(item)],
        );
    await client.query(
      'INSERT INTO site_settings(id,data) VALUES(1,$1) ON CONFLICT(id) DO NOTHING',
      [JSON.stringify(seedSite.settings)],
    );
    if (!(await client.query('SELECT revision FROM content_revisions LIMIT 1')).rowCount)
      await client.query('INSERT INTO content_revisions(blocks,published) VALUES($1,true)', [
        JSON.stringify(seedSite.blocks),
      ]);
    await client.query('COMMIT');
    process.stdout.write(
      'Source catalogue seeded without overwriting existing edits. No members or schedules invented.\n',
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
void main().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
});
