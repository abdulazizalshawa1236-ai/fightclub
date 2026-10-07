import { Injectable } from '@nestjs/common';
import { createCipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { RuntimeConfig } from './config';
@Injectable()
export class CryptoService {
  constructor(private readonly config: RuntimeConfig) {}
  digest(value: string): string {
    return createHmac('sha256', this.config.digestKey).update(value).digest('hex');
  }
  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.config.encryptionKey, iv);
    return [
      iv.toString('hex'),
      Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]).toString('hex'),
      cipher.getAuthTag().toString('hex'),
    ].join(':');
  }
  equal(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
