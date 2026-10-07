import { Module } from '@nestjs/common';
import { AdminGuard, MemberGuard } from './guards';
import { IdentityController } from './identity.controller';
import { IdentityService } from './identity.service';
import { SessionService } from './sessions';
import { SmsModule } from '../sms/sms.module';
@Module({
  imports: [SmsModule],
  controllers: [IdentityController],
  providers: [IdentityService, SessionService, AdminGuard, MemberGuard],
  exports: [SessionService, AdminGuard, MemberGuard],
})
export class IdentityModule {}
