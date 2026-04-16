import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { TeacherAgendaModule } from '../teacher-agenda/teacher-agenda.module';
import { MeController } from './me.controller';
import { MeDataExportService } from './me-data-export.service';
import { MeDataImportService } from './me-data-import.service';
import { MeUserModuleSnapshotsService } from './me-user-module-snapshots.service';
import { DutyPreference } from '../duty/entities/duty-preference.entity';
import { DutyAbsence } from '../duty/entities/duty-absence.entity';
import { DutySwapRequest } from '../duty/entities/duty-swap-request.entity';
import { MessagingUserPreference } from '../messaging/entities/messaging-user-preference.entity';
import { DocumentGeneration } from '../document-templates/entities/document-generation.entity';
import { OptikFormTemplate } from '../optik/entities/optik-form-template.entity';
import { OptikUsageLog } from '../optik/entities/optik-usage-log.entity';
import { SmartBoardDeviceSchedule } from '../smart-board/entities/smart-board-device-schedule.entity';
import { BilsemCalendarAssignment } from '../bilsem/entities/bilsem-calendar-assignment.entity';
import { BilsemGeneratedPlan } from '../bilsem/entities/bilsem-generated-plan.entity';
import { ButterflyModuleTeacher } from '../butterfly-exam/entities/butterfly-module-teacher.entity';
import { ButterflyExamProctor } from '../butterfly-exam/entities/butterfly-exam-proctor.entity';
import { SorumlulukSessionProctor } from '../sorumluluk-exam/entities/sorumluluk-session-proctor.entity';

const ME_SNAPSHOT_ENTITIES = [
  DutyPreference,
  DutyAbsence,
  DutySwapRequest,
  MessagingUserPreference,
  DocumentGeneration,
  OptikFormTemplate,
  OptikUsageLog,
  SmartBoardDeviceSchedule,
  BilsemCalendarAssignment,
  BilsemGeneratedPlan,
  ButterflyModuleTeacher,
  ButterflyExamProctor,
  SorumlulukSessionProctor,
];

@Module({
  imports: [UsersModule, TeacherAgendaModule, TypeOrmModule.forFeature(ME_SNAPSHOT_ENTITIES)],
  controllers: [MeController],
  providers: [MeDataExportService, MeDataImportService, MeUserModuleSnapshotsService],
})
export class MeModule {}
