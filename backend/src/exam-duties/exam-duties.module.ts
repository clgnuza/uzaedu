import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExamDuty } from './entities/exam-duty.entity';
import { ExamDutyPreference } from './entities/exam-duty-preference.entity';
import { ExamDutyNotificationLog } from './entities/exam-duty-notification-log.entity';
import { ExamDutyAssignment } from './entities/exam-duty-assignment.entity';
import { ExamDutySyncSource } from './entities/exam-duty-sync-source.entity';
import { User } from '../users/entities/user.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { ExamDutiesService } from './exam-duties.service';
import { ExamDutyPreferencesService } from './exam-duty-preferences.service';
import { ExamDutySchedulerService } from './exam-duty-scheduler.service';
import { ExamDutySyncService } from './exam-duty-sync.service';
import { ExamDutyGptService } from './exam-duty-gpt.service';
import { ExamDutiesController } from './exam-duties.controller';
import { ExamDutiesAdminController } from './exam-duties-admin.controller';
import { ExamDutyPreferencesController } from './exam-duty-preferences.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExamDuty,
      ExamDutyPreference,
      ExamDutyNotificationLog,
      ExamDutyAssignment,
      ExamDutySyncSource,
      User,
      NotificationPreference,
    ]),
    NotificationsModule,
    AppConfigModule,
  ],
  controllers: [
    ExamDutiesController,
    ExamDutiesAdminController,
    ExamDutyPreferencesController,
  ],
  providers: [ExamDutiesService, ExamDutyPreferencesService, ExamDutySchedulerService, ExamDutySyncService, ExamDutyGptService],
  exports: [ExamDutiesService],
})
export class ExamDutiesModule {}
