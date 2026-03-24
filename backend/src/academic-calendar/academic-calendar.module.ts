import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicCalendarItem } from './entities/academic-calendar-item.entity';
import { BelirliGunHaftaGorev } from './entities/belirli-gun-hafta-gorev.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AcademicCalendarService } from './academic-calendar.service';
import { AcademicCalendarController } from './academic-calendar.controller';
import { BelirliGunHaftaReminderService } from './belirli-gun-hafta-reminder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AcademicCalendarItem, BelirliGunHaftaGorev, School, User, WorkCalendar, Notification]),
    WorkCalendarModule,
    NotificationsModule,
  ],
  controllers: [AcademicCalendarController],
  providers: [AcademicCalendarService, BelirliGunHaftaReminderService],
  exports: [AcademicCalendarService],
})
export class AcademicCalendarModule {}
