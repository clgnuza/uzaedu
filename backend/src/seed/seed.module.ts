import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { SiteMapItem } from '../site-map/entities/site-map-item.entity';
import { AcademicCalendarItem } from '../academic-calendar/entities/academic-calendar-item.entity';
import { DtSchoolProcurementSettings } from '../dogrudan-temin/entities/dt-school-procurement-settings.entity';
import { DtVendor } from '../dogrudan-temin/entities/dt-vendor.entity';
import { DtFile } from '../dogrudan-temin/entities/dt-file.entity';
import { DtItem } from '../dogrudan-temin/entities/dt-item.entity';
import { DtFileDocumentRegistry } from '../dogrudan-temin/entities/dt-file-document-registry.entity';
import { DtAcceptanceCommission } from '../dogrudan-temin/entities/dt-acceptance-commission.entity';
import { DtAcceptanceCommissionMember } from '../dogrudan-temin/entities/dt-acceptance-commission-member.entity';
import { DtQuote } from '../dogrudan-temin/entities/dt-quote.entity';
import { DtQuoteItem } from '../dogrudan-temin/entities/dt-quote-item.entity';
import { DtAward } from '../dogrudan-temin/entities/dt-award.entity';
import { DtBudgetAccount } from '../dogrudan-temin/entities/dt-budget-account.entity';
import { DtBudgetBlock } from '../dogrudan-temin/entities/dt-budget-block.entity';
import { DtPayment } from '../dogrudan-temin/entities/dt-payment.entity';
import { WorkCalendarModule } from '../work-calendar/work-calendar.module';
import { BilsemModule } from '../bilsem/bilsem.module';
import { SeedController } from './seed.controller';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      School,
      SiteMapItem,
      AcademicCalendarItem,
      DtSchoolProcurementSettings,
      DtVendor,
      DtFile,
      DtItem,
      DtFileDocumentRegistry,
      DtAcceptanceCommission,
      DtAcceptanceCommissionMember,
      DtQuote,
      DtQuoteItem,
      DtAward,
      DtBudgetAccount,
      DtBudgetBlock,
      DtPayment,
    ]),
    WorkCalendarModule,
    BilsemModule,
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
