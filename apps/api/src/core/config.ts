import { Injectable } from '@nestjs/common';
export function isLoopbackAddress(ip: string): boolean {
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}
function booleanFlag(name: string): boolean {
  const value = process.env[name];
  if (value !== undefined && value !== 'true' && value !== 'false')
    throw new Error(`${name} must be true or false`);
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
  readonly localOtpPreview = booleanFlag('LOCAL_OTP_PREVIEW');
  readonly hostedOtpDemo = booleanFlag('HOSTED_OTP_DEMO');
  readonly demoMemberId = process.env.DEMO_MEMBER_ID;
  constructor() {
    if (this.hostedOtpDemo) {
      const origin = new URL(this.appOrigin);
      if (
        this.localOtpPreview ||
        process.env.APP_ENV !== 'test' ||
        origin.protocol !== 'https:' ||
        origin.origin !== this.appOrigin ||
        process.env.DEMO_ORIGIN !== this.appOrigin ||
        !this.demoMemberId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          this.demoMemberId,
        )
      )
        throw new Error(
          'Hosted OTP demo requires APP_ENV=test, matching canonical HTTPS APP_ORIGIN and DEMO_ORIGIN, one DEMO_MEMBER_ID, and local preview disabled',
        );
    }
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
  permitsHostedOtp(memberId: string): boolean {
    return this.hostedOtpDemo && memberId === this.demoMemberId;
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
