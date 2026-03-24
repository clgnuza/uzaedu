import { BadRequestException, Body, Controller, Get, Param, Post, Query, Header } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SchoolReviewsService } from './school-reviews.service';
import { UserRole } from '../types/enums';
import { ListSchoolsForReviewsDto } from './dto/list-schools-for-reviews.dto';
import { ToggleLikeDto } from './dto/toggle-like.dto';
import { ReportContentDto } from './dto/report-content.dto';

/**
 * Herkese açık endpoint'ler – okul listesi, detay, değerlendirmeler, sorular.
 * Yorum/oylama için ana controller (auth gerekli) kullanılır.
 * Rate limit: 120 istek/dakika (IP bazlı).
 */
@Controller('school-reviews-public')
@Throttle({ public: { limit: 120, ttl: 60000 } })
export class SchoolReviewsPublicController {
  constructor(private readonly service: SchoolReviewsService) {}

  /** İl listesi (filtre için). */
  @Get('cities')
  @Header('Cache-Control', 'public, max-age=300')
  async listCities() {
    return this.service.listCities();
  }

  /** İlçe listesi (il seçildiyse). */
  @Get('districts')
  @Header('Cache-Control', 'public, max-age=300')
  async listDistricts(@Query('city') city?: string) {
    return this.service.listDistricts(city?.trim() || undefined);
  }

  /** Değerlendirme kriterleri (okulları görüntülemek için). */
  @Get('criteria')
  @Header('Cache-Control', 'public, max-age=60')
  async listCriteria() {
    return this.service.listCriteria();
  }

  /** Anasayfa istatistikleri. */
  @Get('home-stats')
  @Header('Cache-Control', 'public, max-age=60')
  async getHomeStats() {
    return this.service.getHomeStats();
  }

  /** Son değerlendirmeler (tüm okullar, anasayfa widget). */
  @Get('recent-reviews')
  @Header('Cache-Control', 'public, max-age=60')
  async listRecentReviews(@Query('limit') limit?: number) {
    return this.service.listRecentReviews(limit ? Number(limit) : 10);
  }

  /** Son sorulan sorular (tüm okullar, anasayfa widget). */
  @Get('recent-questions')
  @Header('Cache-Control', 'public, max-age=60')
  async listRecentQuestions(@Query('limit') limit?: number) {
    return this.service.listRecentQuestions(limit ? Number(limit) : 10);
  }

  /** Son cevaplar (KVK: okul adı + tarih, kişi bilgisi yok). */
  @Get('recent-answers')
  @Header('Cache-Control', 'public, max-age=60')
  async listRecentAnswers(@Query('limit') limit?: number) {
    return this.service.listRecentAnswers(limit ? Number(limit) : 10);
  }

  /** En çok bakılan okullar (sidebar için). */
  @Get('top-schools')
  @Header('Cache-Control', 'public, max-age=60')
  async listTopViewedSchools(@Query('limit') limit?: number) {
    return this.service.listTopViewedSchools(limit ? Number(limit) : 10);
  }

  /** Okul listesi – herkese açık. */
  @Get('schools')
  @Header('Cache-Control', 'public, max-age=60')
  async listSchools(@Query() dto: ListSchoolsForReviewsDto) {
    const scope = { role: UserRole.teacher, schoolId: null };
    return this.service.listSchools(dto, scope);
  }

  /** Okul detay + istatistik – herkese açık. */
  @Get('schools/:id')
  @Header('Cache-Control', 'public, max-age=60')
  async getSchoolDetail(@Param('id') id: string) {
    const scope = { role: UserRole.teacher, schoolId: null };
    return this.service.getSchoolDetail(id, scope);
  }

  /** Okulun değerlendirmeleri – herkese açık. anonymous_id query ile beğeni durumu döner. */
  @Get('schools/:id/reviews')
  @Header('Cache-Control', 'public, max-age=60')
  async listReviews(
    @Param('id') schoolId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('anonymous_id') anonymousId?: string,
  ) {
    const actorKey = anonymousId ? `a:${anonymousId}` : undefined;
    return this.service.listReviews(schoolId, page ? Number(page) : 1, limit ? Number(limit) : 20, undefined, actorKey, sort || 'newest');
  }

  /** Okulun soruları – herkese açık. anonymous_id query ile beğeni durumu döner. */
  @Get('schools/:id/questions')
  @Header('Cache-Control', 'public, max-age=60')
  async listQuestions(
    @Param('id') schoolId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('sort') sort?: string,
    @Query('anonymous_id') anonymousId?: string,
  ) {
    const actorKey = anonymousId ? `a:${anonymousId}` : undefined;
    return this.service.listQuestions(schoolId, page ? Number(page) : 1, limit ? Number(limit) : 20, undefined, actorKey, sort || 'newest');
  }

  /** Değerlendirme beğen / beğenmekten vazgeç. Giriş yok – body'de anonymous_id gerekli. */
  @Post('reviews/:id/like')
  async toggleReviewLike(@Param('id') reviewId: string, @Body() dto: ToggleLikeDto) {
    if (!dto.anonymous_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için anonymous_id gönderin.' });
    }
    return this.service.toggleReviewLike(reviewId, { anonymousId: dto.anonymous_id });
  }

  /** Soru beğen / beğenmekten vazgeç. Giriş yok – body'de anonymous_id gerekli. */
  @Post('questions/:id/like')
  async toggleQuestionLike(@Param('id') questionId: string, @Body() dto: ToggleLikeDto) {
    if (!dto.anonymous_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için anonymous_id gönderin.' });
    }
    return this.service.toggleQuestionLike(questionId, { anonymousId: dto.anonymous_id });
  }

  /** Cevap beğen / beğenmekten vazgeç. Giriş yok – body'de anonymous_id gerekli. */
  @Post('answers/:id/like')
  async toggleAnswerLike(@Param('id') answerId: string, @Body() dto: ToggleLikeDto) {
    if (!dto.anonymous_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için anonymous_id gönderin.' });
    }
    return this.service.toggleAnswerLike(answerId, { anonymousId: dto.anonymous_id });
  }

  /** Değerlendirme beğenme / beğenmekten vazgeç. Giriş yok – body'de anonymous_id gerekli. */
  @Post('reviews/:id/dislike')
  async toggleReviewDislike(@Param('id') reviewId: string, @Body() dto: ToggleLikeDto) {
    if (!dto.anonymous_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için anonymous_id gönderin.' });
    }
    return this.service.toggleReviewDislike(reviewId, { anonymousId: dto.anonymous_id });
  }

  /** Soru beğenme / beğenmekten vazgeç. Giriş yok – body'de anonymous_id gerekli. */
  @Post('questions/:id/dislike')
  async toggleQuestionDislike(@Param('id') questionId: string, @Body() dto: ToggleLikeDto) {
    if (!dto.anonymous_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için anonymous_id gönderin.' });
    }
    return this.service.toggleQuestionDislike(questionId, { anonymousId: dto.anonymous_id });
  }

  /** Cevap beğenme / beğenmekten vazgeç. Giriş yok – body'de anonymous_id gerekli. */
  @Post('answers/:id/dislike')
  async toggleAnswerDislike(@Param('id') answerId: string, @Body() dto: ToggleLikeDto) {
    if (!dto.anonymous_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için anonymous_id gönderin.' });
    }
    return this.service.toggleAnswerDislike(answerId, { anonymousId: dto.anonymous_id });
  }

  /** Değerlendirme bildir (uygunsuz içerik). Body: { reason?, comment?, anonymous_id? } */
  @Post('reviews/:id/report')
  async reportReview(@Param('id') reviewId: string, @Body() dto: ReportContentDto) {
    const actorKey = dto.anonymous_id ? `a:${dto.anonymous_id}` : null;
    if (!actorKey) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bildirmek için anonymous_id gönderin.' });
    }
    return this.service.reportContent('review', reviewId, { anonymousId: dto.anonymous_id, reason: dto.reason, comment: dto.comment });
  }

  /** Soru bildir (uygunsuz içerik). */
  @Post('questions/:id/report')
  async reportQuestion(@Param('id') questionId: string, @Body() dto: ReportContentDto) {
    if (!dto.anonymous_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bildirmek için anonymous_id gönderin.' });
    }
    return this.service.reportContent('question', questionId, { anonymousId: dto.anonymous_id, reason: dto.reason, comment: dto.comment });
  }

  /** Cevap bildir (uygunsuz içerik). */
  @Post('answers/:id/report')
  async reportAnswer(@Param('id') answerId: string, @Body() dto: ReportContentDto) {
    if (!dto.anonymous_id) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bildirmek için anonymous_id gönderin.' });
    }
    return this.service.reportContent('answer', answerId, { anonymousId: dto.anonymous_id, reason: dto.reason, comment: dto.comment });
  }
}
