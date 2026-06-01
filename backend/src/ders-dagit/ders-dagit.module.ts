import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DersDagitStudio,
  DersDagitClassProfile,
  DersDagitTeacherConfig,
  DersDagitSubject,
  DersDagitGroup,
  DersDagitElectivePool,
  DersDagitBuilding,
  DersDagitRoom,
  DersDagitAssignment,
  DersDagitAssignmentTeacher,
  DersDagitRuleSet,
  DersDagitPreference,
  DersDagitAvailabilitySubmission,
  DersDagitRequest,
  DersDagitProgram,
  DersDagitProgramEntry,
  DersDagitGenerationJob,
  DersDagitAuditLog,
} from './entities';
import { DersDagitService } from './ders-dagit.service';
import { DersDagitController } from './ders-dagit.controller';
import { DersDagitPublicController } from './ders-dagit-public.controller';
import { DutySlot } from '../duty/entities/duty-slot.entity';
import { DutyPlan } from '../duty/entities/duty-plan.entity';
import { DersDagitPdfService } from './ders-dagit-pdf.service';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { TeacherTimetableModule } from '../teacher-timetable/teacher-timetable.module';
import { YillikPlanIcerikModule } from '../yillik-plan-icerik/yillik-plan-icerik.module';
import { AppConfigModule } from '../app-config/app-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DersDagitAvailabilityService } from './ders-dagit-availability.service';
import { YillikPlanIcerik } from '../yillik-plan-icerik/entities/yillik-plan-icerik.entity';
import { ExtraLessonParams } from '../extra-lesson-params/entities/extra-lesson-params.entity';
import { SchoolTimetablePlan } from '../teacher-timetable/entities/school-timetable-plan.entity';
import { SchoolTimetablePlanEntry } from '../teacher-timetable/entities/school-timetable-plan-entry.entity';
import { SchoolClass } from '../classes-subjects/entities/school-class.entity';
import { SchoolSubject } from '../classes-subjects/entities/school-subject.entity';

@Module({
  imports: [
    TeacherTimetableModule,
    YillikPlanIcerikModule,
    AppConfigModule,
    NotificationsModule,
    TypeOrmModule.forFeature([
      DersDagitStudio,
      DersDagitClassProfile,
      DersDagitTeacherConfig,
      DersDagitSubject,
      DersDagitGroup,
      DersDagitElectivePool,
      DersDagitBuilding,
      DersDagitRoom,
      DersDagitAssignment,
      DersDagitAssignmentTeacher,
      DersDagitRuleSet,
      DersDagitPreference,
      DersDagitAvailabilitySubmission,
      DersDagitRequest,
      DersDagitProgram,
      DersDagitProgramEntry,
      DersDagitGenerationJob,
      DersDagitAuditLog,
      User,
      School,
      SchoolTimetablePlan,
      SchoolTimetablePlanEntry,
      DutySlot,
      DutyPlan,
      ExtraLessonParams,
      YillikPlanIcerik,
      SchoolClass,
      SchoolSubject,
    ]),
  ],
  controllers: [DersDagitController, DersDagitPublicController],
  providers: [DersDagitService, DersDagitPdfService, DersDagitAvailabilityService, RequireSchoolModuleGuard],
  exports: [DersDagitService, DersDagitAvailabilityService],
})
export class DersDagitModule {}
