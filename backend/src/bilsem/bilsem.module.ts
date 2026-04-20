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
import { MarketModule } from '../market/market.module';
import { YillikPlanIcerikModule } from '../yillik-plan-icerik/yillik-plan-icerik.module';
import { BilsemPlanSubmission } from './entities/bilsem-plan-submission.entity';
import { BilsemPlanSubmissionEvent } from './entities/bilsem-plan-submission-event.entity';
import { MarketPlanCreatorRewardLedger } from './entities/market-plan-creator-reward-ledger.entity';
import { YillikPlanIcerik } from '../yillik-plan-icerik/entities/yillik-plan-icerik.entity';
import { BilsemPlanSubmissionService } from './bilsem-plan-submission.service';
import { BilsemPlanSubmissionController } from './bilsem-plan-submission.controller';
import { BilsemPlanSubmissionModerationController } from './bilsem-plan-submission-moderation.controller';
import { BilsemPlanCreatorRewardService } from './bilsem-plan-creator-reward.service';

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
      BilsemPlanSubmission,
      BilsemPlanSubmissionEvent,
      MarketPlanCreatorRewardLedger,
      YillikPlanIcerik,
    ]),
    WorkCalendarModule,
    NotificationsModule,
    MarketModule,
    YillikPlanIcerikModule,
  ],
  controllers: [BilsemController, BilsemPlanSubmissionController, BilsemPlanSubmissionModerationController],
  providers: [
    BilsemService,
    BilsemYillikPlanService,
    BilsemCalendarReminderService,
    BilsemPlanSubmissionService,
    BilsemPlanCreatorRewardService,
    RequireSchoolModuleGuard,
  ],
  exports: [BilsemService, BilsemYillikPlanService, BilsemPlanCreatorRewardService],
})
export class BilsemModule {}
