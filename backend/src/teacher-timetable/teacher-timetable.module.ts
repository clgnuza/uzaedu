import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherTimetable } from './entities/teacher-timetable.entity';
import { TeacherPersonalProgram } from './entities/teacher-personal-program.entity';
import { TeacherPersonalProgramEntry } from './entities/teacher-personal-program-entry.entity';
import { SchoolTimetablePlan } from './entities/school-timetable-plan.entity';
import { SchoolTimetablePlanEntry } from './entities/school-timetable-plan-entry.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { TeacherTimetableService } from './teacher-timetable.service';
import { TeacherTimetableController } from './teacher-timetable.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    NotificationsModule,
    TypeOrmModule.forFeature([
      TeacherTimetable,
      TeacherPersonalProgram,
      TeacherPersonalProgramEntry,
      SchoolTimetablePlan,
      SchoolTimetablePlanEntry,
      User,
      School,
    ]),
  ],
  controllers: [TeacherTimetableController],
  providers: [TeacherTimetableService],
  exports: [TeacherTimetableService],
})
export class TeacherTimetableModule {}
