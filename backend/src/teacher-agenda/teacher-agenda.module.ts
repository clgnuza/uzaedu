import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { AgendaNote } from './entities/agenda-note.entity';
import { AgendaNoteAttachment } from './entities/agenda-note-attachment.entity';
import { AgendaTask } from './entities/agenda-task.entity';
import { AgendaReminder } from './entities/agenda-reminder.entity';
import { AgendaSchoolEvent } from './entities/agenda-school-event.entity';
import { AgendaSchoolEventAssignment } from './entities/agenda-school-event-assignment.entity';
import { AgendaPlatformEvent } from './entities/agenda-platform-event.entity';
import { AgendaNoteTemplate } from './entities/agenda-note-template.entity';
import { AgendaStudentNote } from './entities/agenda-student-note.entity';
import { AgendaParentMeeting } from './entities/agenda-parent-meeting.entity';
import { TeacherEvaluationCriterion } from './entities/teacher-evaluation-criterion.entity';
import { TeacherStudentList } from './entities/teacher-student-list.entity';
import { TeacherEvaluationScore } from './entities/teacher-evaluation-score.entity';
import { TeacherAgendaService } from './teacher-agenda.service';
import { TeacherAgendaImportService } from './teacher-agenda-import.service';
import { TeacherAgendaController } from './teacher-agenda.controller';
import { Student } from '../students/entities/student.entity';
import { StudentsModule } from '../students/students.module';
import { DutyModule } from '../duty/duty.module';
import { ExamDutiesModule } from '../exam-duties/exam-duties.module';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module';
import { BilsemModule } from '../bilsem/bilsem.module';
import { TeacherTimetableModule } from '../teacher-timetable/teacher-timetable.module';
import { SchoolsModule } from '../schools/schools.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Student,
      AgendaNote,
      AgendaNoteAttachment,
      AgendaTask,
      AgendaReminder,
      AgendaSchoolEvent,
      AgendaSchoolEventAssignment,
      AgendaPlatformEvent,
      AgendaNoteTemplate,
      AgendaStudentNote,
      AgendaParentMeeting,
      TeacherEvaluationCriterion,
      TeacherStudentList,
      TeacherEvaluationScore,
    ]),
    StudentsModule,
    DutyModule,
    ExamDutiesModule,
    AcademicCalendarModule,
    BilsemModule,
    TeacherTimetableModule,
    SchoolsModule,
    NotificationsModule,
  ],
  controllers: [TeacherAgendaController],
  providers: [TeacherAgendaService, TeacherAgendaImportService, RequireSchoolModuleGuard],
  exports: [TeacherAgendaService, TeacherAgendaImportService, TypeOrmModule],
})
export class TeacherAgendaModule {}
