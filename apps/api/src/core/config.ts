import { Injectable } from '@nestjs/common';
@Injectable()
export class RuntimeConfig {
  readonly databaseUrl = required('DATABASE_URL');
  readonly appOrigin = required('APP_ORIGIN');
  readonly production = process.env.NODE_ENV === 'production';
  readonly encryptionKey = hexKey('DATA_ENCRYPTION_KEY');
  readonly digestKey = hexKey('IDENTITY_DIGEST_KEY');
  readonly port = Number(process.env.PORT || 4100);
}
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
function hexKey(name: string): Buffer {
  const value = required(name);
  if (!/^[a-f0-9]{64}$/i.test(value))
    throw new Error(`${name} must contain 64 hexadecimal characters`);
  return Buffer.from(value, 'hex');
}
