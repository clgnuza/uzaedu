import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingSettings } from './entities/messaging-settings.entity';
import { MessagingCampaign } from './entities/messaging-campaign.entity';
import { MessagingRecipient } from './entities/messaging-recipient.entity';
import { MessagingContactGroup } from './entities/messaging-contact-group.entity';
import { MessagingGroupMember } from './entities/messaging-group-member.entity';
import { MessagingUserPreference } from './entities/messaging-user-preference.entity';
import { MessagingTemplate } from './entities/messaging-template.entity';
import { MessagingOptOut } from './entities/messaging-opt-out.entity';
import { MessagingContactPreference } from './entities/messaging-contact-preference.entity';
import { MessagingDeliveryEvent } from './entities/messaging-delivery-event.entity';
import { MessagingInboundMessage } from './entities/messaging-inbound-message.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { MessagingWebhookController } from './messaging-webhook.controller';
import { MessagingWebhookService } from './messaging-webhook.service';
import { MessagingSchoolNeedsService } from './messaging-school-needs.service';
import { MessagingBridgeService } from './messaging-bridge.service';
import { MessagingVeliDirectory } from './entities/messaging-veli-directory.entity';
import { MessagingSchedulerService } from './messaging-scheduler.service';
import { WhatsAppService } from './whatsapp.service';
import { SmsService } from './sms.service';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { MarketModule } from '../market/market.module';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MessagingSettings,
      MessagingCampaign,
      MessagingRecipient,
      MessagingContactGroup,
      MessagingGroupMember,
      MessagingUserPreference,
      MessagingTemplate,
      MessagingOptOut,
      MessagingContactPreference,
      MessagingDeliveryEvent,
      MessagingInboundMessage,
      MessagingVeliDirectory,
      School,
      User,
    ]),
    MarketModule,
    NotificationsModule,
  ],
  controllers: [MessagingController, MessagingWebhookController],
  providers: [
    MessagingService,
    MessagingSchedulerService,
    MessagingWebhookService,
    MessagingSchoolNeedsService,
    MessagingBridgeService,
    WhatsAppService,
    SmsService,
    RequireSchoolModuleGuard,
  ],
  exports: [MessagingService, MessagingBridgeService, MessagingSchoolNeedsService],
})
export class MessagingModule {}
