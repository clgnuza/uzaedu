import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../app-config/app-config.module';
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
import { MarketWalletController } from './market-wallet.controller';
import { MarketModuleUsageService } from './market-module-usage.service';
import { MarketUsageService } from './market-usage.service';
import { MarketUsageController } from './market-usage.controller';
import { MarketAdminController } from './market-admin.controller';
import { MarketRewardedAdController } from './market-rewarded-ad.controller';
import { MarketRewardedAdSsvService } from './market-rewarded-ad-ssv.service';

@Module({
  imports: [
    AppConfigModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      MarketPurchaseLedger,
      MarketUsageLedger,
      MarketSchoolCreditLedger,
      MarketUserCreditLedger,
      MarketRewardedAdLedger,
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
    MarketModuleUsageService,
    MarketUsageService,
    MarketSchoolCreditService,
    MarketUserCreditService,
    MarketRewardedAdSsvService,
  ],
  exports: [
    MarketPurchaseService,
    MarketWalletService,
    MarketModuleUsageService,
    MarketUsageService,
    MarketSchoolCreditService,
    MarketUserCreditService,
  ],
})
export class MarketModule {}
