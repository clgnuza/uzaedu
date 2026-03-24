import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExtraLessonParams } from './entities/extra-lesson-params.entity';
import { ExtraLessonLineItemTemplate } from './entities/extra-lesson-line-item-template.entity';
import { ExtraLessonParamsController } from './extra-lesson-params.controller';
import { ExtraLessonParamsService } from './extra-lesson-params.service';
import { ExtraLessonStatsService } from './extra-lesson-stats.service';
import { School } from '../schools/entities/school.entity';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExtraLessonParams, ExtraLessonLineItemTemplate, School]),
  ],
  controllers: [ExtraLessonParamsController],
  providers: [ExtraLessonParamsService, ExtraLessonStatsService, RequireSchoolModuleGuard],
  exports: [ExtraLessonParamsService],
})
export class ExtraLessonParamsModule {}
