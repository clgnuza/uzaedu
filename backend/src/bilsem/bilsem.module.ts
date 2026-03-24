import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BilsemCalendarItem } from './entities/bilsem-calendar-item.entity';
import { BilsemCalendarAssignment } from './entities/bilsem-calendar-assignment.entity';
import { BilsemOutcomeSet } from './entities/bilsem-outcome-set.entity';
import { BilsemOutcomeItem } from './entities/bilsem-outcome-item.entity';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { BilsemService } from './bilsem.service';
import { BilsemYillikPlanService } from './bilsem-yillik-plan.service';
import { BilsemController } from './bilsem.controller';
import { BilsemCalendarReminderService } from './bilsem-calendar-reminder.service';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      BilsemCalendarItem,
      BilsemCalendarAssignment,
      BilsemOutcomeSet,
      BilsemOutcomeItem,
      WorkCalendar,
      Notification,
      School,
      User,
    ]),
    WorkCalendarModule,
    NotificationsModule,
  ],
  controllers: [BilsemController],
  providers: [BilsemService, BilsemYillikPlanService, BilsemCalendarReminderService, RequireSchoolModuleGuard],
  exports: [BilsemService, BilsemYillikPlanService],
})
export class BilsemModule {}
