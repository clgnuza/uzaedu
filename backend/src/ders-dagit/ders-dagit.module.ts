import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  DersDagitStudio,
  DersDagitClassProfile,
  DersDagitTeacherConfig,
  DersDagitSubject,
  DersDagitGroup,
  DersDagitBuilding,
  DersDagitRoom,
  DersDagitAssignment,
  DersDagitAssignmentTeacher,
  DersDagitRuleSet,
  DersDagitPreference,
  DersDagitRequest,
  DersDagitProgram,
  DersDagitProgramEntry,
  DersDagitGenerationJob,
  DersDagitAuditLog,
} from './entities';
import { DersDagitService } from './ders-dagit.service';
import { DersDagitController } from './ders-dagit.controller';
import { DersDagitPdfService } from './ders-dagit-pdf.service';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { TeacherTimetableModule } from '../teacher-timetable/teacher-timetable.module';
import { SchoolTimetablePlan } from '../teacher-timetable/entities/school-timetable-plan.entity';
import { SchoolTimetablePlanEntry } from '../teacher-timetable/entities/school-timetable-plan-entry.entity';

@Module({
  imports: [
    TeacherTimetableModule,
    TypeOrmModule.forFeature([
      DersDagitStudio,
      DersDagitClassProfile,
      DersDagitTeacherConfig,
      DersDagitSubject,
      DersDagitGroup,
      DersDagitBuilding,
      DersDagitRoom,
      DersDagitAssignment,
      DersDagitAssignmentTeacher,
      DersDagitRuleSet,
      DersDagitPreference,
      DersDagitRequest,
      DersDagitProgram,
      DersDagitProgramEntry,
      DersDagitGenerationJob,
      DersDagitAuditLog,
      User,
      School,
      SchoolTimetablePlan,
      SchoolTimetablePlanEntry,
    ]),
  ],
  controllers: [DersDagitController],
  providers: [DersDagitService, DersDagitPdfService, RequireSchoolModuleGuard],
  exports: [DersDagitService],
})
export class DersDagitModule {}
