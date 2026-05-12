import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { YollukGlobalSettings } from './entities/yolluk-global-settings.entity';
import { YollukCalculation } from './entities/yolluk-calculation.entity';
import { User } from '../users/entities/user.entity';
import { YollukService } from './yolluk.service';
import { YollukPdfService } from './yolluk-pdf.service';
import { YollukController } from './yolluk.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([YollukGlobalSettings, YollukCalculation, User]), NotificationsModule],
  controllers: [YollukController],
  providers: [YollukService, YollukPdfService],
  exports: [YollukService],
})
export class YollukModule {}
