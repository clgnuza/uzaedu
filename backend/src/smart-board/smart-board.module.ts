import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SmartBoardDevice } from './entities/smart-board-device.entity';
import { SmartBoardDeviceSchedule } from './entities/smart-board-device-schedule.entity';
import { SmartBoardAuthorizedTeacher } from './entities/smart-board-authorized-teacher.entity';
import { SmartBoardSession } from './entities/smart-board-session.entity';
import { User } from '../users/entities/user.entity';
import { SmartBoardService } from './smart-board.service';
import { SmartBoardController } from './smart-board.controller';
import { SchoolsModule } from '../schools/schools.module';
import { AuditModule } from '../audit/audit.module';
import { TeacherTimetableModule } from '../teacher-timetable/teacher-timetable.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SmartBoardDevice,
      SmartBoardDeviceSchedule,
      SmartBoardAuthorizedTeacher,
      SmartBoardSession,
      User,
    ]),
    SchoolsModule,
    AuditModule,
    TeacherTimetableModule,
    NotificationsModule,
  ],
  controllers: [SmartBoardController],
  providers: [SmartBoardService],
  exports: [SmartBoardService],
})
export class SmartBoardModule {}
