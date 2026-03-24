import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SchoolReviewsService } from './school-reviews.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { ListSchoolsForReviewsDto } from './dto/list-schools-for-reviews.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { CreateCriteriaDto } from './dto/create-criteria.dto';
import { UpdateCriteriaDto } from './dto/update-criteria.dto';
import { ReportContentDto } from './dto/report-content.dto';

@Controller('school-reviews')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard)
@RequireSchoolModule('school_reviews')
export class SchoolReviewsController {
  constructor(private readonly service: SchoolReviewsService) {}

  /** Değerlendirme kriterleri listesi (öğretmen için). */
  @Get('criteria')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async listCriteria() {
    return this.service.listCriteria();
  }

  /** Superadmin / Moderator: kriterler CRUD */
  @Get('criteria/admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async listCriteriaAdmin() {
    return this.service.listCriteriaAdmin();
  }

  @Post('criteria')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async createCriteria(@Body() dto: CreateCriteriaDto) {
    return this.service.createCriteria(dto);
  }

  @Patch('criteria/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async updateCriteria(@Param('id') id: string, @Body() dto: UpdateCriteriaDto) {
    return this.service.updateCriteria(id, dto);
  }

  @Delete('criteria/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async deleteCriteria(@Param('id') id: string) {
    return this.service.deleteCriteria(id);
  }

  /** Favori okullar listesi. Sadece teacher. */
  @Get('favorites')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async listFavorites(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.listFavorites(payload.userId);
  }

  /** Okul listesi (filtreli). Teacher, school_admin (kendi okulu), superadmin, moderator. */
  @Get('schools')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async listSchools(@Query() dto: ListSchoolsForReviewsDto, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId };
    return this.service.listSchools(dto, scope);
  }

  /** Okul detay + istatistik. Girişli kullanıcı için is_favorited dahil. */
  @Get('schools/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async getSchoolDetail(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId };
    return this.service.getSchoolDetail(id, scope, payload.userId);
  }

  /** Okulu favorilere ekle. */
  @Post('schools/:id/favorite')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async addFavorite(@Param('id') schoolId: string, @CurrentUser() payload: CurrentUserPayload) {
    return this.service.addFavorite(schoolId, payload.userId);
  }

  /** Okulu favorilerden çıkar. */
  @Delete('schools/:id/favorite')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async removeFavorite(@Param('id') schoolId: string, @CurrentUser() payload: CurrentUserPayload) {
    return this.service.removeFavorite(schoolId, payload.userId);
  }

  /** Değerlendirme oluştur. */
  @Post('schools/:id/reviews')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async createReview(
    @Param('id') schoolId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.createReview(schoolId, payload.userId, dto);
  }

  /** Değerlendirme güncelle. */
  @Patch('reviews/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateReview(
    @Param('id') reviewId: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.updateReview(reviewId, payload.userId, dto);
  }

  /** Değerlendirme beğen / beğenmekten vazgeç (toggle). */
  @Post('reviews/:id/like')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async toggleReviewLike(
    @Param('id') reviewId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.toggleReviewLike(reviewId, { userId: payload.userId });
  }

  /** Değerlendirme beğenme / beğenmekten vazgeç (toggle). */
  @Post('reviews/:id/dislike')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async toggleReviewDislike(
    @Param('id') reviewId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.toggleReviewDislike(reviewId, { userId: payload.userId });
  }

  /** Soru beğen / beğenmekten vazgeç (toggle). */
  @Post('questions/:id/like')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async toggleQuestionLike(
    @Param('id') questionId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.toggleQuestionLike(questionId, { userId: payload.userId });
  }

  /** Soru beğenme / beğenmekten vazgeç (toggle). */
  @Post('questions/:id/dislike')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async toggleQuestionDislike(
    @Param('id') questionId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.toggleQuestionDislike(questionId, { userId: payload.userId });
  }

  /** Cevap beğen / beğenmekten vazgeç (toggle). */
  @Post('answers/:id/like')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async toggleAnswerLike(
    @Param('id') answerId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.toggleAnswerLike(answerId, { userId: payload.userId });
  }

  /** Cevap beğenme / beğenmekten vazgeç (toggle). */
  @Post('answers/:id/dislike')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async toggleAnswerDislike(
    @Param('id') answerId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.toggleAnswerDislike(answerId, { userId: payload.userId });
  }

  /** Değerlendirme bildir (uygunsuz içerik). Body: { reason?, comment? } */
  @Post('reviews/:id/report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async reportReview(@Param('id') reviewId: string, @Body() dto: ReportContentDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.service.reportContent('review', reviewId, { userId: payload.userId, reason: dto.reason, comment: dto.comment });
  }

  /** Soru bildir (uygunsuz içerik). */
  @Post('questions/:id/report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async reportQuestion(@Param('id') questionId: string, @Body() dto: ReportContentDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.service.reportContent('question', questionId, { userId: payload.userId, reason: dto.reason, comment: dto.comment });
  }

  /** Cevap bildir (uygunsuz içerik). */
  @Post('answers/:id/report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async reportAnswer(@Param('id') answerId: string, @Body() dto: ReportContentDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.service.reportContent('answer', answerId, { userId: payload.userId, reason: dto.reason, comment: dto.comment });
  }

  /** Değerlendirme sil. */
  @Delete('reviews/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async deleteReview(@Param('id') reviewId: string, @CurrentUser() payload: CurrentUserPayload) {
    return this.service.deleteReview(reviewId, payload.userId);
  }

  /** Okulun değerlendirmeleri listesi. Giriş yapmışsa kendi yorumlarında is_own: true döner. */
  @Get('schools/:id/reviews')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async listReviews(
    @Param('id') schoolId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @CurrentUser() payload?: CurrentUserPayload,
  ) {
    return this.service.listReviews(
      schoolId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      payload?.userId,
      undefined,
      sort || 'newest',
    );
  }

  /** Soru oluştur. */
  @Post('schools/:id/questions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async createQuestion(
    @Param('id') schoolId: string,
    @Body() dto: CreateQuestionDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.createQuestion(schoolId, payload.userId, dto);
  }

  /** Soruya cevap ver. */
  @Post('questions/:id/answers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async createAnswer(
    @Param('id') questionId: string,
    @Body() dto: CreateAnswerDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.createAnswer(questionId, payload.userId, dto);
  }

  /** Soru güncelle. */
  @Patch('questions/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateQuestion(
    @Param('id') questionId: string,
    @Body() dto: UpdateQuestionDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.updateQuestion(questionId, payload.userId, dto);
  }

  /** Cevap güncelle. */
  @Patch('answers/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateAnswer(
    @Param('id') answerId: string,
    @Body() dto: UpdateAnswerDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.updateAnswer(answerId, payload.userId, dto);
  }

  /** Soru sil. */
  @Delete('questions/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async deleteQuestion(
    @Param('id') questionId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.deleteQuestion(questionId, payload.userId);
  }

  /** Cevap sil. */
  @Delete('answers/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async deleteAnswer(
    @Param('id') answerId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.deleteAnswer(answerId, payload.userId);
  }

  /** Okulun soruları listesi. Giriş yapmışsa kendi soru/cevaplarında is_own: true döner. */
  @Get('schools/:id/questions')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async listQuestions(
    @Param('id') schoolId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @CurrentUser() payload?: CurrentUserPayload,
  ) {
    return this.service.listQuestions(
      schoolId,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
      payload?.userId,
      undefined,
      sort || 'newest',
    );
  }

  /** School admin raporu – sadece kendi okulu. */
  @Get('report/:schoolId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async getSchoolReport(
    @Param('schoolId') schoolId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!payload.schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.getSchoolReport(schoolId, payload.schoolId);
  }
}
