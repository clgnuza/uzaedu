import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { User } from '../users/entities/user.entity';
import { MailModule } from '../mail/mail.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationPreferencesController } from '../notification-preferences/notification-preferences.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, NotificationPreference, User]),
    MailModule,
  ],
  controllers: [NotificationsController, NotificationPreferencesController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
