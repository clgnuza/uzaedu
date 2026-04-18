import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../app-config/app-config.module';
import { EntitlementModule } from '../entitlements/entitlement.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { MarketPurchaseLedger } from './entities/market-purchase-ledger.entity';
import { MarketUsageLedger } from './entities/market-usage-ledger.entity';
import { MarketSchoolCreditLedger } from './entities/market-school-credit-ledger.entity';
import { MarketUserCreditLedger } from './entities/market-user-credit-ledger.entity';
import { MarketRewardedAdLedger } from './entities/market-rewarded-ad-ledger.entity';
import { MarketPurchaseService } from './market-purchase.service';
import { MarketSchoolCreditService } from './market-school-credit.service';
import { MarketUserCreditService } from './market-user-credit.service';
import { MarketPurchaseController } from './market-purchase.controller';
import { MarketWalletService } from './market-wallet.service';
import { MarketEntitlementExchangeService } from './market-entitlement-exchange.service';
import { MarketWalletController } from './market-wallet.controller';
import { MarketModuleUsageService } from './market-module-usage.service';
import { MarketUsageService } from './market-usage.service';
import { MarketUsageController } from './market-usage.controller';
import { MarketAdminController } from './market-admin.controller';
import { MarketRewardedAdController } from './market-rewarded-ad.controller';
import { MarketRewardedAdSsvService } from './market-rewarded-ad-ssv.service';
import { ModulePeriodActivation } from './entities/module-period-activation.entity';
import { MarketModuleActivationService } from './market-module-activation.service';
import { RequireModuleActivationGuard } from './guards/require-module-activation.guard';

@Module({
  imports: [
    AppConfigModule,
    EntitlementModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      MarketPurchaseLedger,
      MarketUsageLedger,
      MarketSchoolCreditLedger,
      MarketUserCreditLedger,
      MarketRewardedAdLedger,
      ModulePeriodActivation,
      User,
      School,
    ]),
  ],
  controllers: [
    MarketPurchaseController,
    MarketWalletController,
    MarketUsageController,
    MarketAdminController,
    MarketRewardedAdController,
  ],
  providers: [
    MarketPurchaseService,
    MarketWalletService,
    MarketEntitlementExchangeService,
    MarketModuleUsageService,
    MarketUsageService,
    MarketSchoolCreditService,
    MarketUserCreditService,
    MarketRewardedAdSsvService,
    MarketModuleActivationService,
    RequireModuleActivationGuard,
  ],
  exports: [
    MarketPurchaseService,
    MarketWalletService,
    MarketModuleUsageService,
    MarketUsageService,
    MarketSchoolCreditService,
    MarketUserCreditService,
    MarketModuleActivationService,
    RequireModuleActivationGuard,
  ],
})
export class MarketModule {}
