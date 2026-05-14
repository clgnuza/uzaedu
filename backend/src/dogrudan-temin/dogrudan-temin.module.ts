import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketModule } from '../market/market.module';
import { UploadModule } from '../upload/upload.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { School } from '../schools/entities/school.entity';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { DtFile } from './entities/dt-file.entity';
import { DtItem } from './entities/dt-item.entity';
import { DtVendor } from './entities/dt-vendor.entity';
import { DtQuote } from './entities/dt-quote.entity';
import { DtQuoteItem } from './entities/dt-quote-item.entity';
import { DtBudgetAccount } from './entities/dt-budget-account.entity';
import { DtBudgetBlock } from './entities/dt-budget-block.entity';
import { DtAward } from './entities/dt-award.entity';
import { DtGeneratedDoc } from './entities/dt-generated-doc.entity';
import { DtPayment } from './entities/dt-payment.entity';
import { DtMaterialLibrary } from './entities/dt-material-library.entity';
import { DtMaterialCategory } from './entities/dt-material-category.entity';
import { DtAcceptanceCommission } from './entities/dt-acceptance-commission.entity';
import { DtAcceptanceCommissionMember } from './entities/dt-acceptance-commission-member.entity';
import { DtSchoolProcurementSettings } from './entities/dt-school-procurement-settings.entity';
import { DtFileDocumentRegistry } from './entities/dt-file-document-registry.entity';
import { User } from '../users/entities/user.entity';
import { DogrudanTeminService } from './dogrudan-temin.service';
import { DogrudanTeminController } from './dogrudan-temin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DtFile,
      DtItem,
      DtVendor,
      DtQuote,
      DtQuoteItem,
      DtBudgetAccount,
      DtBudgetBlock,
      DtAward,
      DtGeneratedDoc,
      DtPayment,
      DtMaterialLibrary,
      DtMaterialCategory,
      DtAcceptanceCommission,
      DtAcceptanceCommissionMember,
      DtSchoolProcurementSettings,
      DtFileDocumentRegistry,
      User,
      School,
    ]),
    MarketModule,
    UploadModule,
    AppConfigModule,
  ],
  controllers: [DogrudanTeminController],
  providers: [DogrudanTeminService, RequireSchoolModuleGuard],
  exports: [DogrudanTeminService],
})
export class DogrudanTeminModule {}

