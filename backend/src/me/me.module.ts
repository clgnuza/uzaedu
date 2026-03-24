import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { TeacherAgendaModule } from '../teacher-agenda/teacher-agenda.module';
import { MeController } from './me.controller';
import { MeDataExportService } from './me-data-export.service';
import { MeDataImportService } from './me-data-import.service';

@Module({
  imports: [UsersModule, TeacherAgendaModule],
  controllers: [MeController],
  providers: [MeDataExportService, MeDataImportService],
})
export class MeModule {}
