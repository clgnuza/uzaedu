import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementRead } from './entities/announcement-read.entity';
import { School } from '../schools/entities/school.entity';
import { AnnouncementsService } from './announcements.service';
import { AnnouncementsController } from './announcements.controller';
import { TvPublicController } from './tv-public.controller';
import { TvDevicesModule } from '../tv-devices/tv-devices.module';
import { SmartBoardModule } from '../smart-board/smart-board.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement, AnnouncementRead, School]),
    TvDevicesModule,
    SmartBoardModule,
  ],
  controllers: [AnnouncementsController, TvPublicController],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
