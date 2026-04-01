import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import * as multer from 'multer';
import { School } from '../schools/entities/school.entity';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { YillikPlanIcerik } from './entities/yillik-plan-icerik.entity';
import { YillikPlanMeta } from './entities/yillik-plan-meta.entity';
import { YillikPlanIcerikService } from './yillik-plan-icerik.service';
import { YillikPlanGptService } from './yillik-plan-gpt.service';
import { YillikPlanIcerikController } from './yillik-plan-icerik.controller';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { MebModule } from '../meb/meb.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([YillikPlanIcerik, YillikPlanMeta, School]),
    MulterModule.register({ storage: multer.memoryStorage() }),
    WorkCalendarModule,
    MebModule,
    AppConfigModule,
    MarketModule,
  ],
  controllers: [YillikPlanIcerikController],
  providers: [YillikPlanIcerikService, YillikPlanGptService, RequireSchoolModuleGuard],
  exports: [YillikPlanIcerikService],
})
export class YillikPlanIcerikModule {}
