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
import { OptikScanResult } from './entities/optik-scan-result.entity';
import { OptikExamSession } from './entities/optik-exam-session.entity';
import { OptikReportsService } from './optik-reports.service';
import { OptikSessionsService } from './optik-sessions.service';
import { OptikReportPdfService } from './optik-report-pdf.service';
import { OptikOmrAdvancedService } from './optik-omr-advanced.service';
import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    AppConfigModule,
    MarketModule,
    SchoolsModule,
    TypeOrmModule.forFeature([
      OptikFormTemplate,
      OptikRubricTemplate,
      OptikUsageLog,
      OptikScanResult,
      OptikExamSession,
      School,
      User,
    ]),
  ],
  controllers: [OptikController, OptikAdminController],
  providers: [
    OptikService,
    OptikAdminService,
    OptikFormPdfService,
    OptikReportsService,
    OptikSessionsService,
    OptikReportPdfService,
    OptikOmrAdvancedService,
    RequireSchoolModuleGuard,
  ],
  exports: [OptikService],
})
export class OptikModule {}
