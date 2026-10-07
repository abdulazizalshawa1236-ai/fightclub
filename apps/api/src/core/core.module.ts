import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database';
import { RuntimeConfig } from './config';
import { CryptoService } from './crypto';
import { RateLimitService } from './rate-limit';
@Global()
@Module({
  providers: [RuntimeConfig, DatabaseService, CryptoService, RateLimitService],
  exports: [RuntimeConfig, DatabaseService, CryptoService, RateLimitService],
})
export class CoreModule {}
