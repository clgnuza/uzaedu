import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { TeacherTimetable } from '../teacher-timetable/entities/teacher-timetable.entity';
import { SchoolTimetablePlan } from '../teacher-timetable/entities/school-timetable-plan.entity';
import { SorumlulukGroup } from './entities/sorumluluk-group.entity';
import { SorumlulukStudent } from './entities/sorumluluk-student.entity';
import { SorumlulukSession } from './entities/sorumluluk-session.entity';
import { SorumlulukSessionStudent } from './entities/sorumluluk-session-student.entity';
import { SorumlulukSessionProctor } from './entities/sorumluluk-session-proctor.entity';
import { SorumlulukExamService } from './sorumluluk-exam.service';
import { SorumlulukExamPdfService } from './sorumluluk-exam-pdf.service';
import { SorumlulukExamController } from './sorumluluk-exam.controller';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { MarketModule } from '../market/market.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SorumlulukGroup,
      SorumlulukStudent,
      SorumlulukSession,
      SorumlulukSessionStudent,
      SorumlulukSessionProctor,
      User,
      School,
      TeacherTimetable,
      SchoolTimetablePlan,
    ]),
    MarketModule,
    NotificationsModule,
  ],
  controllers: [SorumlulukExamController],
  providers: [SorumlulukExamService, SorumlulukExamPdfService, RequireSchoolModuleGuard],
  exports: [SorumlulukExamService],
})
export class SorumlulukExamModule {}
