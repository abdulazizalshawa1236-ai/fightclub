import { Module } from '@nestjs/common';
import { SmsModule } from '../sms/sms.module';
import { IdentityModule } from '../identity/identity.module';
import { WhatsAppModule } from './whatsapp.module';
import { CatalogueService } from './catalogue.service';
import { CatalogueController, PublicController } from './catalogue.controller';
import { ScheduleService } from './schedule.service';
import { CommunicationsService } from './communications.service';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { OperationsController } from './operations.controller';
import { WebhookController } from './webhook.controller';
@Module({
  imports: [IdentityModule, WhatsAppModule, SmsModule],
  providers: [CatalogueService, ScheduleService, CommunicationsService, MediaService],
  controllers: [
    CatalogueController,
    PublicController,
    OperationsController,
    WebhookController,
    MediaController,
  ],
  exports: [CommunicationsService],
})
export class OperationsModule {}
