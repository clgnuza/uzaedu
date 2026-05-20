import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartBoardDevice } from './entities/smart-board-device.entity';
import { SmartBoardDeviceSchedule } from './entities/smart-board-device-schedule.entity';
import { SmartBoardAuthorizedTeacher } from './entities/smart-board-authorized-teacher.entity';
import { SmartBoardSession } from './entities/smart-board-session.entity';
import { TvClassroomUsbToken } from './entities/tv-classroom-usb-token.entity';
import { SmartBoardQrSession } from './entities/smart-board-qr-session.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { SmartBoardService } from './smart-board.service';
import { SmartBoardController } from './smart-board.controller';
import { SmartBoardSessionScheduler } from './smart-board-session.scheduler';
import { SchoolsModule } from '../schools/schools.module';
import { AuditModule } from '../audit/audit.module';
import { TeacherTimetableModule } from '../teacher-timetable/teacher-timetable.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { MarketModule } from '../market/market.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SmartBoardDevice,
      SmartBoardDeviceSchedule,
      SmartBoardAuthorizedTeacher,
      SmartBoardSession,
      TvClassroomUsbToken,
      SmartBoardQrSession,
      User,
      School,
    ]),
    SchoolsModule,
    AuditModule,
    TeacherTimetableModule,
    NotificationsModule,
    MarketModule,
  ],
  controllers: [SmartBoardController],
  providers: [SmartBoardService, SmartBoardSessionScheduler, RequireSchoolModuleGuard],
  exports: [SmartBoardService],
})
export class SmartBoardModule {}
