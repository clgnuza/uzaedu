import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { DutyPlan } from './entities/duty-plan.entity';
import { DutySlot } from './entities/duty-slot.entity';
import { DutyLog } from './entities/duty-log.entity';
import { DutyArea } from './entities/duty-area.entity';
import { DutySwapRequest } from './entities/duty-swap-request.entity';
import { DutyPreference } from './entities/duty-preference.entity';
import { DutyAbsence } from './entities/duty-absence.entity';
import { DutyCoverage } from './entities/duty-coverage.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { DutyService } from './duty.service';
import { DutyController } from './duty.controller';
import { DutyReminderService } from './duty-reminder.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { Notification } from '../notifications/entities/notification.entity';
import { TeacherTimetableModule } from '../teacher-timetable/teacher-timetable.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DutyPlan, DutySlot, DutyLog, DutyArea, DutySwapRequest, DutyPreference, DutyAbsence, DutyCoverage, User, Notification, School, WorkCalendar]),
    NotificationsModule,
    TeacherTimetableModule,
    MarketModule,
  ],
  controllers: [DutyController],
  providers: [DutyService, DutyReminderService, RequireSchoolModuleGuard],
  exports: [DutyService],
})
export class DutyModule {}
