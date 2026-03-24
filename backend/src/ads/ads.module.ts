import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfigModule } from '../app-config/app-config.module';
import { Ad } from './entities/ad.entity';
import { AdsService } from './ads.service';
import { AdsAdminController } from './ads-admin.controller';
import { AdsPublicController } from './ads-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ad]), AppConfigModule],
  controllers: [AdsAdminController, AdsPublicController],
  providers: [AdsService],
  exports: [AdsService],
})
export class AdsModule {}
