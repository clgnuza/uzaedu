import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { Student } from '../students/entities/student.entity';
import { SchoolClass } from '../classes-subjects/entities/school-class.entity';
import { ButterflyBuilding } from './entities/butterfly-building.entity';
import { ButterflyRoom } from './entities/butterfly-room.entity';
import { ButterflyExamPlan } from './entities/butterfly-exam-plan.entity';
import { ButterflySeatAssignment } from './entities/butterfly-seat-assignment.entity';
import { ButterflyExamProctor } from './entities/butterfly-exam-proctor.entity';
import { ButterflyModuleTeacher } from './entities/butterfly-module-teacher.entity';
import { User } from '../users/entities/user.entity';
import { ButterflyExamService } from './butterfly-exam.service';
import { ButterflyExamPdfService } from './butterfly-exam-pdf.service';
import { ButterflyExamController } from './butterfly-exam.controller';
import { ButterflyExamPublicController } from './butterfly-exam-public.controller';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { MarketModule } from '../market/market.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ButterflyBuilding,
      ButterflyRoom,
      ButterflyExamPlan,
      ButterflySeatAssignment,
      ButterflyExamProctor,
      ButterflyModuleTeacher,
      School,
      Student,
      SchoolClass,
      User,
    ]),
    MarketModule,
    NotificationsModule,
  ],
  controllers: [ButterflyExamController, ButterflyExamPublicController],
  providers: [ButterflyExamService, ButterflyExamPdfService, RequireSchoolModuleGuard],
  exports: [ButterflyExamService],
})
export class ButterflyExamModule {}
