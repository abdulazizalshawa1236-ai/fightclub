import { Injectable } from '@nestjs/common';
export function isLoopbackAddress(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}
function localPreviewFlag(): boolean {
  const value = process.env.LOCAL_OTP_PREVIEW;
  if (value !== undefined && value !== 'true' && value !== 'false')
    throw new Error('LOCAL_OTP_PREVIEW must be true or false');
  return value === 'true';
}
@Injectable()
export class RuntimeConfig {
  readonly databaseUrl = required('DATABASE_URL');
  readonly appOrigin = required('APP_ORIGIN');
  readonly production = process.env.NODE_ENV === 'production';
  readonly development = process.env.NODE_ENV === 'development';
  readonly encryptionKey = hexKey('DATA_ENCRYPTION_KEY');
  readonly digestKey = hexKey('IDENTITY_DIGEST_KEY');
  readonly port = Number(process.env.PORT || 4100);
  readonly localOtpPreview = localPreviewFlag();
  constructor() {
    if (!this.localOtpPreview) return;
    const origin = new URL(this.appOrigin);
    const loopbackOrigin = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
    if (
      !this.development ||
      !loopbackOrigin ||
      !['http:', 'https:'].includes(origin.protocol) ||
      origin.username ||
      origin.password ||
      origin.pathname !== '/' ||
      origin.search ||
      origin.hash ||
      process.env.TRUST_PROXY === '1'
    ) {
      throw new Error(
        'Local OTP preview requires development mode, a loopback APP_ORIGIN, and TRUST_PROXY disabled',
      );
    }
  }
  permitsLocalOtp(ip: string): boolean {
    return this.localOtpPreview && isLoopbackAddress(ip);
  }
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
