import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { School } from '../schools/entities/school.entity';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { YillikPlanIcerik } from './entities/yillik-plan-icerik.entity';
import { YillikPlanMeta } from './entities/yillik-plan-meta.entity';
import { YillikPlanSubmission } from './entities/yillik-plan-submission.entity';
import { YillikPlanSubmissionEvent } from './entities/yillik-plan-submission-event.entity';
import { YillikPlanIcerikService } from './yillik-plan-icerik.service';
import { YillikPlanIcerikController } from './yillik-plan-icerik.controller';
import { YillikPlanSubmissionController } from './yillik-plan-submission.controller';
import { YillikPlanSubmissionModerationController } from './yillik-plan-submission-moderation.controller';
import { YillikPlanSubmissionService } from './yillik-plan-submission.service';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { MebModule } from '../meb/meb.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([YillikPlanIcerik, YillikPlanMeta, YillikPlanSubmission, YillikPlanSubmissionEvent, School]),
    MulterModule.register({ storage: multer.memoryStorage() }),
    WorkCalendarModule,
    MebModule,
    AppConfigModule,
    MarketModule,
  ],
  controllers: [YillikPlanIcerikController, YillikPlanSubmissionController, YillikPlanSubmissionModerationController],
  providers: [YillikPlanIcerikService, YillikPlanSubmissionService, RequireSchoolModuleGuard],
  exports: [YillikPlanIcerikService, YillikPlanSubmissionService],
})
export class YillikPlanIcerikModule {}
