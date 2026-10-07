import { Module } from '@nestjs/common';
import { IdentityModule } from '../identity/identity.module';
import { MemberPortalController, MembersController } from './members.controller';
import { MembersService } from './members.service';
@Module({
  imports: [IdentityModule],
  controllers: [MembersController, MemberPortalController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
