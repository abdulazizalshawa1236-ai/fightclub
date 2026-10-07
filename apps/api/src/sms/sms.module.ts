import { Module } from '@nestjs/common';
import { SmsHttpClient } from './sms-http.client';
import { SmsService } from './sms.service';
@Module({ providers: [SmsHttpClient, SmsService], exports: [SmsService] })
export class SmsModule {}
