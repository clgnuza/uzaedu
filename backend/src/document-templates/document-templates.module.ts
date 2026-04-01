import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { DocumentTemplate } from './entities/document-template.entity';
import { DocumentCatalog } from './entities/document-catalog.entity';
import { DocumentGeneration } from './entities/document-generation.entity';
import { DocumentTemplatesController } from './document-templates.controller';
import { DocumentConfigController } from './document-config.controller';
import { DocumentsController } from './documents.controller';
import { DocumentTemplatesService } from './document-templates.service';
import { DocumentCatalogService } from './document-catalog.service';
import { DocumentGenerateService } from './document-generate.service';
import { DocumentGenerationService } from './document-generation.service';
import { EntitlementModule } from '../entitlements/entitlement.module';
import { UploadModule } from '../upload/upload.module';
import { YillikPlanIcerikModule } from '../yillik-plan-icerik/yillik-plan-icerik.module';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { BilsemModule } from '../bilsem/bilsem.module';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentTemplate, DocumentCatalog, DocumentGeneration, School]),
    EntitlementModule,
    UploadModule,
    YillikPlanIcerikModule,
    WorkCalendarModule,
    BilsemModule,
    MarketModule,
  ],
  controllers: [DocumentTemplatesController, DocumentConfigController, DocumentsController],
  providers: [
    RequireSchoolModuleGuard,
    DocumentTemplatesService,
    DocumentCatalogService,
    DocumentGenerateService,
    DocumentGenerationService,
  ],
  exports: [DocumentTemplatesService, DocumentCatalogService],
})
export class DocumentTemplatesModule {}
