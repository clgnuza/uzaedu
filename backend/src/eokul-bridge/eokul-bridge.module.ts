import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EokulBridgeController } from './eokul-bridge.controller';
import { EokulBridgeService } from './eokul-bridge.service';
import { EokulBridgeVeliIzinPdfService } from './eokul-bridge-veli-izin-pdf.service';
import { ButterflyExamModule } from '../butterfly-exam/butterfly-exam.module';
import { MessagingModule } from '../messaging/messaging.module';
import { DersDagitModule } from '../ders-dagit/ders-dagit.module';
import { School } from '../schools/entities/school.entity';
import { Student } from '../students/entities/student.entity';
import { SchoolClass } from '../classes-subjects/entities/school-class.entity';
import { EokulBridgeOgrenciDosyaImportService } from './eokul-bridge-ogrenci-dosya-import.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([School, Student, SchoolClass]),
    ButterflyExamModule,
    MessagingModule,
    DersDagitModule,
  ],
  controllers: [EokulBridgeController],
  providers: [EokulBridgeService, EokulBridgeVeliIzinPdfService, EokulBridgeOgrenciDosyaImportService],
  exports: [EokulBridgeService],
})
export class EokulBridgeModule {}
