import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { TvDevice } from './entities/tv-device.entity';
import { TvDevicesService } from './tv-devices.service';
import { TvDevicesController } from './tv-devices.controller';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [TypeOrmModule.forFeature([TvDevice, School]), MarketModule],
  controllers: [TvDevicesController],
  providers: [TvDevicesService, RequireSchoolModuleGuard],
  exports: [TvDevicesService],
})
export class TvDevicesModule {}
