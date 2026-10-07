import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { IdentityModule } from './identity/identity.module';
import { MembersModule } from './members/members.module';
import { OperationsModule } from './operations/operations.module';
@Module({ imports: [CoreModule, IdentityModule, MembersModule, OperationsModule] })
export class AppModule {}
