import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const password = randomBytes(24).toString('hex');
const values = {
  NODE_ENV: 'development',
  PORT: '4100',
  APP_ORIGIN: 'http://127.0.0.1:3100',
  API_ORIGIN: 'http://127.0.0.1:4100',
  POSTGRES_PASSWORD: password,
  DATABASE_URL: `postgresql://fightclub:${password}@127.0.0.1:56432/fightclub`,
  DATA_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
  IDENTITY_DIGEST_KEY: randomBytes(32).toString('hex'),
  ADMIN_USERNAME: 'club-admin',
  ADMIN_PASSWORD: randomBytes(24).toString('base64url'),
  MEDIA_STORAGE: 'local',
  SMS_PROVIDER: 'taqnyat',
  MEDIA_DIRECTORY: '.runtime/media',
  MEDIA_PUBLIC_URL: 'http://127.0.0.1:3100/api/media',
};
try {
  await writeFile(
    new URL('../.env', import.meta.url),
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n',
    { flag: 'wx', mode: 0o600 },
  );
  process.stdout.write(
    'Private .env created. Read ADMIN_USERNAME and ADMIN_PASSWORD there to sign in locally.\n',
  );
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST')
    process.stdout.write('Existing .env preserved.\n');
  else throw error;
}
