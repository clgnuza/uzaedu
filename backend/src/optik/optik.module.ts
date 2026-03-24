import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../app-config/app-config.module';
import { MarketModule } from '../market/market.module';
import { SchoolsModule } from '../schools/schools.module';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { OptikController } from './optik.controller';
import { OptikAdminController } from './optik-admin.controller';
import { OptikService } from './optik.service';
import { OptikAdminService } from './optik-admin.service';
import { OptikFormPdfService } from './optik-form-pdf.service';
import { OptikFormTemplate } from './entities/optik-form-template.entity';
import { OptikRubricTemplate } from './entities/optik-rubric-template.entity';
import { OptikUsageLog } from './entities/optik-usage-log.entity';

@Module({
  imports: [
    AppConfigModule,
    MarketModule,
    SchoolsModule,
    TypeOrmModule.forFeature([OptikFormTemplate, OptikRubricTemplate, OptikUsageLog]),
  ],
  controllers: [OptikController, OptikAdminController],
  providers: [OptikService, OptikAdminService, OptikFormPdfService, RequireSchoolModuleGuard],
  exports: [OptikService],
})
export class OptikModule {}
