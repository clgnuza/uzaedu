import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessagingSettings } from './entities/messaging-settings.entity';
import { MessagingCampaign } from './entities/messaging-campaign.entity';
import { MessagingRecipient } from './entities/messaging-recipient.entity';
import { MessagingContactGroup } from './entities/messaging-contact-group.entity';
import { MessagingGroupMember } from './entities/messaging-group-member.entity';
import { MessagingUserPreference } from './entities/messaging-user-preference.entity';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { WhatsAppService } from './whatsapp.service';
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
      School,
      User,
    ]),
    MarketModule,
    NotificationsModule,
  ],
  controllers: [MessagingController],
  providers: [MessagingService, WhatsAppService, RequireSchoolModuleGuard],
  exports: [MessagingService],
})
export class MessagingModule {}
