import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationPushSettings } from './entities/notification-push-settings.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { User } from '../users/entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationPreferencesController } from '../notification-preferences/notification-preferences.controller';
import { WebPushService } from './web-push.service';
import { PushController } from '../push/push.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      NotificationPushSettings,
      PushSubscription,
      User,
    ]),
    MailModule,
  ],
  controllers: [NotificationsController, NotificationPreferencesController, PushController],
  providers: [NotificationsService, WebPushService],
  exports: [NotificationsService, WebPushService],
})
export class NotificationsModule {}
