import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { RuntimeConfig } from '../src/core/config';
import { CryptoService } from '../src/core/crypto';
import { DatabaseService } from '../src/core/database';
import { MembersService } from '../src/members/members.service';
import { todayRiyadh } from '../src/members/membership-domain';

config({ path: resolve(process.cwd(), '../../.env'), quiet: true });
config({ quiet: true });
const DEMO_NAME = 'Stakeholder Demo Member (synthetic)';
const DEMO_IDENTITY = '1999999977';
const DEMO_PHONE = '966500000077';

async function provision(): Promise<void> {
  if (process.env.APP_ENV !== 'test' || process.env.HOSTED_OTP_DEMO !== 'false')
    throw new Error(
      'Demo provisioning requires APP_ENV=test and HOSTED_OTP_DEMO=false during bootstrap',
    );
  const runtime = new RuntimeConfig();
  const db = new DatabaseService(runtime);
  const crypto = new CryptoService(runtime);
  try {
    const existing = (
      await db.query<{ id: string; full_name: string; phone: string }>(
        'SELECT id,full_name,phone FROM members WHERE national_id_digest=$1',
        [crypto.digest(DEMO_IDENTITY)],
      )
    ).rows[0];
    if (existing && (existing.full_name !== DEMO_NAME || existing.phone !== DEMO_PHONE))
      throw new Error('Demo identity is occupied by another record; no member data was changed');
    if (existing) {
      process.stdout.write(`${existing.id}\n`);
      return;
    }
    if ((await db.query('SELECT id FROM members LIMIT 1')).rowCount)
      throw new Error('Provision the stakeholder demo only into a fresh, isolated test database');
    const catalogue = (
      await db.query<{ id: string }>(
        "SELECT id FROM plans WHERE archived_at IS NULL AND (data->>'visible')::boolean AND (data->>'sportLimit')::int=1 ORDER BY id LIMIT 1",
      )
    ).rows[0];
    const sport = (
      await db.query<{ id: string }>(
        "SELECT id FROM sports WHERE archived_at IS NULL AND (data->>'available')::boolean ORDER BY id LIMIT 1",
      )
    ).rows[0];
    if (!catalogue || !sport) throw new Error('Seed the source plans and sports first');
    const member = await new MembersService(db, crypto).create(
      {
        fullName: DEMO_NAME,
        nationalId: DEMO_IDENTITY,
        phone: DEMO_PHONE,
        ageGroup: 'adult',
        preferredLanguage: 'ar',
        planId: catalogue.id,
        startDate: todayRiyadh(),
        sports: [sport.id],
        notes: 'Synthetic stakeholder demonstration account. No SMS or WhatsApp delivery.',
        consent: { updates: false, marketing: false },
      },
      'test.provisioning',
    );
    process.stdout.write(`${member.id}\n`);
  } finally {
    await db.onModuleDestroy();
  }
}
void provision().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Demo provisioning failed'}\n`);
  process.exitCode = 1;
});
