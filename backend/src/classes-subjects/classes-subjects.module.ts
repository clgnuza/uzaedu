import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchoolClass } from './entities/school-class.entity';
import { SchoolSubject } from './entities/school-subject.entity';
import { Student } from '../students/entities/student.entity';
import { ClassesSubjectsService } from './classes-subjects.service';
import { ClassesSubjectsController } from './classes-subjects.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([SchoolClass, SchoolSubject, Student]),
  ],
  controllers: [ClassesSubjectsController],
  providers: [ClassesSubjectsService],
  exports: [ClassesSubjectsService],
})
export class ClassesSubjectsModule {}
