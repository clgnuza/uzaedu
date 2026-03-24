import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { School } from '../schools/entities/school.entity';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { SchoolReview } from './entities/school-review.entity';
import { SchoolReviewCriteria } from './entities/school-review-criteria.entity';
import { SchoolQuestion } from './entities/school-question.entity';
import { SchoolQuestionAnswer } from './entities/school-question-answer.entity';
import { SchoolReviewLike } from './entities/school-review-like.entity';
import { SchoolReviewDislike } from './entities/school-review-dislike.entity';
import { SchoolQuestionLike } from './entities/school-question-like.entity';
import { SchoolQuestionDislike } from './entities/school-question-dislike.entity';
import { SchoolAnswerLike } from './entities/school-answer-like.entity';
import { SchoolAnswerDislike } from './entities/school-answer-dislike.entity';
import { SchoolContentReport } from './entities/school-content-report.entity';
import { SchoolFavorite } from './entities/school-favorite.entity';
import { SchoolReviewsService } from './school-reviews.service';
import { SchoolReviewsController } from './school-reviews.controller';
import { SchoolReviewsPublicController } from './school-reviews-public.controller';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([School, SchoolReview, SchoolReviewCriteria, SchoolQuestion, SchoolQuestionAnswer, SchoolReviewLike, SchoolReviewDislike, SchoolQuestionLike, SchoolQuestionDislike, SchoolAnswerLike, SchoolAnswerDislike, SchoolContentReport, SchoolFavorite]),
    AppConfigModule,
  ],
  controllers: [SchoolReviewsController, SchoolReviewsPublicController],
  providers: [SchoolReviewsService, RequireSchoolModuleGuard],
  exports: [SchoolReviewsService],
})
export class SchoolReviewsModule {}
