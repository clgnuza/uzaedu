import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { School } from '../schools/entities/school.entity';
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
import { CreateCriteriaDto } from './dto/create-criteria.dto';
import { UpdateCriteriaDto } from './dto/update-criteria.dto';
import { UserRole } from '../types/enums';
import { AppConfigService } from '../app-config/app-config.service';
import type { SchoolReviewsContentRules } from '../app-config/app-config.service';
import { ListSchoolsForReviewsDto } from './dto/list-schools-for-reviews.dto';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { CreateAnswerDto } from './dto/create-answer.dto';
import { UpdateAnswerDto } from './dto/update-answer.dto';
import { ListContentReportsAdminDto } from './dto/list-content-reports-admin.dto';
import { ListModerationQueueDto } from './dto/list-moderation-queue.dto';
import { paginate } from '../common/dtos/pagination.dto';

/** Varsayılan kriterler — puanlama 1–10 (1: çok zayıf, 10: çok iyi). */
const CRITERIA_SCORE_MIN = 1;
const CRITERIA_SCORE_MAX = 10;

const DEFAULT_CRITERIA = [
  {
    slug: 'fiziksel_ortam',
    label: 'Fiziksel Ortam ve İş Güvenliği',
    hint: 'Sınıf/ofis, hijyen, güvenlik (1–10)',
    sort_order: 1,
  },
  {
    slug: 'yonetim_destek',
    label: 'Yönetim ve İdari Destek',
    hint: 'Şeffaflık, çözüm üretme, öğretmeni dinleme',
    sort_order: 2,
  },
  {
    slug: 'is_yuku_denge',
    label: 'İş Yükü ve Görev Dağılımı',
    hint: '1: aşırı yoğun / adaletsiz … 10: dengeli',
    sort_order: 3,
  },
  {
    slug: 'mesleki_gelisim',
    label: 'Mesleki Gelişim ve Öğrenme Fırsatları',
    hint: 'Eğitim, seminer, paylaşım ortamı',
    sort_order: 4,
  },
  {
    slug: 'teknoloji_materyal',
    label: 'Teknoloji ve Öğretim Kaynakları',
    hint: 'Donanım, yazılım, materyal erişimi',
    sort_order: 5,
  },
  {
    slug: 'iletisim_katilim',
    label: 'İletişim ve Katılım Kültürü',
    hint: 'Görüş bildirme, geri bildirim',
    sort_order: 6,
  },
  {
    slug: 'kurum_kulturu',
    label: 'Kurum Kültürü ve İş Birliği',
    hint: 'Saygı, güven, takım çalışması',
    sort_order: 7,
  },
  {
    slug: 'konum_ulasim',
    label: 'Konum ve Ulaşım',
    hint: '1: çok zor … 10: kolay erişim',
    sort_order: 8,
  },
];

@Injectable()
export class SchoolReviewsService implements OnModuleInit {
  private readonly logger = new Logger(SchoolReviewsService.name);

  constructor(
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    @InjectRepository(SchoolReview)
    private readonly reviewRepo: Repository<SchoolReview>,
    @InjectRepository(SchoolReviewCriteria)
    private readonly criteriaRepo: Repository<SchoolReviewCriteria>,
    @InjectRepository(SchoolQuestion)
    private readonly questionRepo: Repository<SchoolQuestion>,
    @InjectRepository(SchoolQuestionAnswer)
    private readonly answerRepo: Repository<SchoolQuestionAnswer>,
    @InjectRepository(SchoolReviewLike)
    private readonly likeRepo: Repository<SchoolReviewLike>,
    @InjectRepository(SchoolReviewDislike)
    private readonly dislikeRepo: Repository<SchoolReviewDislike>,
    @InjectRepository(SchoolQuestionLike)
    private readonly questionLikeRepo: Repository<SchoolQuestionLike>,
    @InjectRepository(SchoolQuestionDislike)
    private readonly questionDislikeRepo: Repository<SchoolQuestionDislike>,
    @InjectRepository(SchoolAnswerLike)
    private readonly answerLikeRepo: Repository<SchoolAnswerLike>,
    @InjectRepository(SchoolAnswerDislike)
    private readonly answerDislikeRepo: Repository<SchoolAnswerDislike>,
    @InjectRepository(SchoolContentReport)
    private readonly reportRepo: Repository<SchoolContentReport>,
    @InjectRepository(SchoolFavorite)
    private readonly favoriteRepo: Repository<SchoolFavorite>,
    private readonly appConfig: AppConfigService,
  ) {}

  private async ensureModuleEnabled(): Promise<void> {
    const cfg = await this.appConfig.getSchoolReviewsConfig();
    if (!cfg.enabled) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'Okul değerlendirme modülü şu an kapalı.' });
    }
  }

  private normalizeForBlockedTermMatch(s: string): string {
    return s.replace(/\s+/g, ' ').trim().toLocaleLowerCase('tr-TR');
  }

  /** Yönetici listesi: alt dizi eşleşirse (TR büyük/küçük harf duyarsız) kayıt reddedilir. */
  private assertNoBlockedTerms(text: string | null | undefined, rules: SchoolReviewsContentRules): void {
    if (!rules.profanity_block_enabled || rules.blocked_terms.length === 0) return;
    const t = text?.trim();
    if (!t) return;
    const hay = this.normalizeForBlockedTermMatch(t);
    for (const term of rules.blocked_terms) {
      const n = this.normalizeForBlockedTermMatch(term);
      if (n.length < 2) continue;
      if (hay.includes(n)) {
        throw new BadRequestException({
          code: 'CONTENT_POLICY',
          message:
            'Metniniz yönetici tarafından engellenen ifadeler içeriyor. Lütfen düzenleyip tekrar deneyin.',
        });
      }
    }
  }

  /** Herkese açık: bildirim formu seçenekleri ve günlük limit. */
  getReportRulesPublic() {
    return this.appConfig.getSchoolReviewsReportRulesPublic();
  }

  /** Aktif kriterler listesi (öğretmen için). */
  async listCriteria(): Promise<SchoolReviewCriteria[]> {
    await this.ensureModuleEnabled();
    return this.criteriaRepo.find({
      where: { is_active: true },
      order: { sort_order: 'ASC', label: 'ASC' },
    });
  }

  /** Superadmin: tüm kriterler (aktif + pasif). */
  async listCriteriaAdmin(): Promise<SchoolReviewCriteria[]> {
    return this.criteriaRepo.find({
      order: { sort_order: 'ASC', label: 'ASC' },
    });
  }

  /** Superadmin: kriter oluştur. */
  async createCriteria(dto: CreateCriteriaDto): Promise<SchoolReviewCriteria> {
    const existing = await this.criteriaRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ForbiddenException({
        code: 'ALREADY_EXISTS',
        message: 'Bu slug zaten kullanılıyor.',
      });
    }
    const minS = dto.min_score ?? CRITERIA_SCORE_MIN;
    const maxS = dto.max_score ?? CRITERIA_SCORE_MAX;
    if (minS > maxS) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Minimum puan, maksimumdan büyük olamaz.' });
    }
    const c = this.criteriaRepo.create({
      slug: dto.slug.trim().toLowerCase().replace(/\s+/g, '_'),
      label: dto.label.trim(),
      hint: dto.hint?.trim() || null,
      sort_order: dto.sort_order ?? 0,
      min_score: minS,
      max_score: maxS,
      is_active: dto.is_active ?? true,
    });
    return this.criteriaRepo.save(c);
  }

  /** Superadmin: kriter güncelle. */
  async updateCriteria(id: string, dto: UpdateCriteriaDto): Promise<SchoolReviewCriteria> {
    const c = await this.criteriaRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kriter bulunamadı.' });
    if (dto.label !== undefined) c.label = dto.label.trim();
    if (dto.hint !== undefined) c.hint = dto.hint?.trim() || null;
    if (dto.sort_order !== undefined) c.sort_order = dto.sort_order;
    if (dto.min_score !== undefined) c.min_score = dto.min_score;
    if (dto.max_score !== undefined) c.max_score = dto.max_score;
    if (dto.is_active !== undefined) c.is_active = dto.is_active;
    if (c.min_score > c.max_score) {
      throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Minimum puan, maksimumdan büyük olamaz.' });
    }
    return this.criteriaRepo.save(c);
  }

  /** Superadmin: kriter sil. */
  async deleteCriteria(id: string): Promise<{ success: boolean }> {
    const c = await this.criteriaRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Kriter bulunamadı.' });
    await this.criteriaRepo.remove(c);
    return { success: true };
  }

  /** İl listesi (filtre için, alfabetik). */
  async listCities(): Promise<string[]> {
    await this.ensureModuleEnabled();
    const rows = await this.schoolRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.city')
      .where('s.city IS NOT NULL')
      .andWhere("s.city != ''")
      .orderBy('s.city', 'ASC')
      .getRawMany<{ city: string }>();
    return rows.map((r) => r.city).filter(Boolean);
  }

  /** Anasayfa istatistikleri (okul sayısı, değerlendirme sayısı vb.). */
  async getHomeStats(): Promise<{ school_count: number; review_count: number; question_count: number }> {
    await this.ensureModuleEnabled();
    const [schoolCount, reviewCount, questionCount] = await Promise.all([
      this.schoolRepo.count(),
      this.reviewRepo.count({ where: { status: 'approved' } }),
      this.questionRepo.count({ where: { status: 'approved' } }),
    ]);
    return { school_count: schoolCount, review_count: reviewCount, question_count: questionCount };
  }

  /** Tüm okullardan son değerlendirmeler (anasayfa widget). */
  async listRecentReviews(limit: number = 10) {
    await this.ensureModuleEnabled();
    const items = await this.reviewRepo.find({
      where: { status: 'approved' },
      relations: ['school', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
    return items.map((r) => ({
      id: r.id,
      school_id: r.school_id,
      school_name: r.school?.name ?? 'Okul',
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      author_display_name: r.is_anonymous ? 'Öğretmen' : (r.user?.display_name || 'Öğretmen'),
    }));
  }

  /** Tüm okullardan son sorulan sorular (anasayfa widget). */
  async listRecentQuestions(limit: number = 10) {
    await this.ensureModuleEnabled();
    const items = await this.questionRepo.find({
      where: { status: 'approved' },
      relations: ['school', 'user'],
      order: { created_at: 'DESC' },
      take: limit,
    });
    return items.map((q) => ({
      id: q.id,
      school_id: q.school_id,
      school_name: q.school?.name ?? 'Okul',
      question: q.question,
      created_at: q.created_at,
      author_display_name: q.is_anonymous ? 'Öğretmen' : (q.user?.display_name || 'Öğretmen'),
    }));
  }

  /** Son cevaplar (KVK: sadece okul adı, aktivite tipi, tarih – kişi bilgisi yok). */
  async listRecentAnswers(limit: number = 10) {
    await this.ensureModuleEnabled();
    const items = await this.answerRepo.find({
      where: { status: 'approved' },
      relations: { question: { school: true } },
      order: { created_at: 'DESC' },
      take: limit,
    });
    return items
      .filter((a) => a.question?.school_id)
      .map((a) => ({
        id: a.id,
        school_id: a.question!.school_id,
        school_name: a.question!.school?.name ?? 'Okul',
        created_at: a.created_at,
      }));
  }

  /** En çok görüntülenen okullar (review_view_count'a göre). */
  async listTopViewedSchools(limit: number = 10): Promise<(School & { review_view_count: number; avg_rating: number | null })[]> {
    await this.ensureModuleEnabled();
    const schools = await this.schoolRepo
      .createQueryBuilder('s')
      .where('(s.review_view_count IS NOT NULL AND s.review_view_count > 0)')
      .orderBy('s.review_view_count', 'DESC')
      .take(limit)
      .getMany();
    if (schools.length === 0) return [];
    const ids = schools.map((s) => s.id);
    const stats = await this.reviewRepo
      .createQueryBuilder('r')
      .select('r.school_id', 'school_id')
      .addSelect('AVG(r.rating)', 'avg_rating')
      .where('r.school_id IN (:...ids)', { ids })
      .andWhere('r.status = :status', { status: 'approved' })
      .groupBy('r.school_id')
      .getRawMany<{ school_id: string; avg_rating: string }>();
    const avgMap = new Map(stats.map((s) => [s.school_id, parseFloat(s.avg_rating)]));
    return schools.map((s) => ({
      ...s,
      review_view_count: Number((s as { review_view_count?: number }).review_view_count ?? 0),
      avg_rating: avgMap.get(s.id) ?? null,
    }));
  }

  /** İlçe listesi (il verilirse o ile sınırlı). */
  async listDistricts(city?: string): Promise<string[]> {
    await this.ensureModuleEnabled();
    const qb = this.schoolRepo
      .createQueryBuilder('s')
      .select('DISTINCT s.district')
      .where('s.district IS NOT NULL')
      .andWhere("s.district != ''");
    if (city) {
      qb.andWhere('LOWER(s.city) = LOWER(:city)', { city });
    }
    const rows = await qb.orderBy('s.district', 'ASC').getRawMany<{ district: string }>();
    return rows.map((r) => r.district).filter(Boolean);
  }

  /** Okul listesi – filtreli, sayfalı. Teacher ve superadmin. */
  async listSchools(dto: ListSchoolsForReviewsDto, scope: { role: UserRole; schoolId: string | null }) {
    await this.ensureModuleEnabled();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.schoolRepo
      .createQueryBuilder('s')
      .orderBy('s.name', 'ASC');

    if (scope.role === UserRole.school_admin && scope.schoolId) {
      qb.andWhere('s.id = :schoolId', { schoolId: scope.schoolId });
    } else {
      if (dto.city) qb.andWhere('LOWER(s.city) = LOWER(:city)', { city: dto.city.trim() });
      if (dto.district) qb.andWhere('LOWER(s.district) = LOWER(:district)', { district: dto.district.trim() });
      if (dto.type) qb.andWhere('s.type = :type', { type: dto.type });
      if (dto.segment) qb.andWhere('s.segment = :segment', { segment: dto.segment });
      if (dto.search?.trim()) {
        qb.andWhere('LOWER(s.name) LIKE LOWER(:search)', { search: `%${dto.search.trim()}%` });
      }
    }

    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    if (items.length === 0) return paginate([], total, page, limit);
    const ids = items.map((s) => s.id);
    const stats = await this.reviewRepo
      .createQueryBuilder('r')
      .select('r.school_id', 'school_id')
      .addSelect('AVG(r.rating)', 'avg_rating')
      .addSelect('COUNT(r.id)', 'review_count')
      .where('r.school_id IN (:...ids)', { ids })
      .andWhere('r.status = :status', { status: 'approved' })
      .groupBy('r.school_id')
      .getRawMany<{ school_id: string; avg_rating: string; review_count: string }>();
    const questionCounts = await this.questionRepo
      .createQueryBuilder('q')
      .select('q.school_id', 'school_id')
      .addSelect('COUNT(q.id)', 'question_count')
      .where('q.school_id IN (:...ids)', { ids })
      .andWhere('q.status = :status', { status: 'approved' })
      .groupBy('q.school_id')
      .getRawMany<{ school_id: string; question_count: string }>();
    const statMap = new Map(stats.map((s) => [s.school_id, s]));
    const qMap = new Map(questionCounts.map((q) => [q.school_id, q]));
    const enriched = items.map((s) => {
      const st = statMap.get(s.id);
      const qc = qMap.get(s.id);
      return {
        ...s,
        avg_rating: st?.avg_rating ? parseFloat(st.avg_rating) : null,
        review_count: st ? parseInt(st.review_count, 10) : 0,
        question_count: qc ? parseInt(qc.question_count, 10) : 0,
      };
    });
    return paginate(enriched, total, page, limit);
  }

  /** Okul detay + istatistik (ortalama puan, kriter ortalamaları, yorum/soru sayısı). userId varsa is_favorited eklenir. */
  async getSchoolDetail(schoolId: string, scope: { role: UserRole; schoolId: string | null }, userId?: string) {
    await this.ensureModuleEnabled();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    if (scope.role === UserRole.school_admin && school.id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }

    // Görüntülenme sayısını artır
    const viewCount = Number((school as { review_view_count?: number }).review_view_count ?? 0);
    await this.schoolRepo.increment({ id: schoolId }, 'review_view_count', 1);

    const [criteria, cfg, avgResult, reviewCount, questionCount, reviewsWithCriteria, ratingDistributionRaw] =
      await Promise.all([
        this.listCriteria(),
        this.appConfig.getSchoolReviewsConfig(),
        this.reviewRepo
          .createQueryBuilder('r')
          .select('AVG(r.rating)', 'avg')
          .where('r.school_id = :schoolId', { schoolId })
          .andWhere('r.status = :status', { status: 'approved' })
          .getRawOne<{ avg: string | null }>(),
        this.reviewRepo.count({ where: { school_id: schoolId, status: 'approved' } }),
        this.questionRepo.count({ where: { school_id: schoolId, status: 'approved' } }),
        this.reviewRepo.find({
          where: { school_id: schoolId, status: 'approved' },
          select: ['id', 'criteria_ratings'],
        }),
        this.reviewRepo
          .createQueryBuilder('r')
          .select('r.rating', 'rating')
          .addSelect('COUNT(r.id)', 'cnt')
          .where('r.school_id = :schoolId', { schoolId })
          .andWhere('r.status = :status', { status: 'approved' })
          .groupBy('r.rating')
          .getRawMany<{ rating: string; cnt: string }>(),
      ]);

    const avgRating = avgResult?.avg ? parseFloat(avgResult.avg) : null;
    const rMin = cfg.rating_min;
    const rMax = cfg.rating_max;
    const rating_distribution: Record<number, number> = {};
    for (let s = rMin; s <= rMax; s++) rating_distribution[s] = 0;
    for (const row of ratingDistributionRaw) {
      const rating = parseInt(row.rating, 10);
      if (rating >= rMin && rating <= rMax) rating_distribution[rating] = parseInt(row.cnt, 10);
    }
    const criteriaAverages: Record<string, number> = {};
    if (criteria.length > 0 && reviewsWithCriteria.length > 0) {
      for (const c of criteria) {
        const values = reviewsWithCriteria
          .map((r) => r.criteria_ratings?.[c.slug])
          .filter((v): v is number => typeof v === 'number');
        if (values.length > 0) {
          criteriaAverages[c.slug] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
        }
      }
    }

    const currentViewCount = Number((school as { review_view_count?: number }).review_view_count ?? 0);
    let is_favorited = false;
    if (userId) {
      const fav = await this.favoriteRepo.findOne({ where: { user_id: userId, school_id: schoolId } });
      is_favorited = !!fav;
    }
    return {
      ...school,
      review_view_count: currentViewCount + 1,
      avg_rating: avgRating != null ? Math.round(avgRating * 10) / 10 : null,
      review_count: reviewCount,
      question_count: questionCount,
      criteria,
      criteria_averages: Object.keys(criteriaAverages).length > 0 ? criteriaAverages : null,
      rating_distribution,
      is_favorited: userId ? is_favorited : undefined,
    };
  }

  /** Favorilere ekle. Sadece teacher rolü. */
  async addFavorite(schoolId: string, userId: string): Promise<{ added: boolean }> {
    await this.ensureModuleEnabled();
    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });
    const existing = await this.favoriteRepo.findOne({ where: { user_id: userId, school_id: schoolId } });
    if (existing) return { added: false };
    await this.favoriteRepo.save({ user_id: userId, school_id: schoolId });
    return { added: true };
  }

  /** Favorilerden çıkar. */
  async removeFavorite(schoolId: string, userId: string): Promise<{ removed: boolean }> {
    await this.ensureModuleEnabled();
    const result = await this.favoriteRepo.delete({ user_id: userId, school_id: schoolId });
    return { removed: (result.affected ?? 0) > 0 };
  }

  /** Kullanıcının favori okulları listesi (öğretmen). */
  async listFavorites(
    userId: string,
  ): Promise<(School & { avg_rating: number | null; review_count: number; question_count: number })[]> {
    await this.ensureModuleEnabled();
    const favs = await this.favoriteRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      relations: ['school'],
    });
    const schools = favs.map((f) => f.school).filter(Boolean) as School[];
    if (schools.length === 0) return [];
    const ids = schools.map((s) => s.id);
    const [stats, questionCounts] = await Promise.all([
      this.reviewRepo
        .createQueryBuilder('r')
        .select('r.school_id', 'school_id')
        .addSelect('AVG(r.rating)', 'avg_rating')
        .addSelect('COUNT(r.id)', 'review_count')
        .where('r.school_id IN (:...ids)', { ids })
        .andWhere('r.status = :status', { status: 'approved' })
        .groupBy('r.school_id')
        .getRawMany<{ school_id: string; avg_rating: string; review_count: string }>(),
      this.questionRepo
        .createQueryBuilder('q')
        .select('q.school_id', 'school_id')
        .addSelect('COUNT(q.id)', 'question_count')
        .where('q.school_id IN (:...ids)', { ids })
        .andWhere('q.status = :status', { status: 'approved' })
        .groupBy('q.school_id')
        .getRawMany<{ school_id: string; question_count: string }>(),
    ]);
    const statMap = new Map(stats.map((s) => [s.school_id, s]));
    const qMap = new Map(questionCounts.map((q) => [q.school_id, q]));
    const enriched: (School & { avg_rating: number | null; review_count: number; question_count: number })[] = schools.map((s) => {
      const st = statMap.get(s.id);
      const qc = qMap.get(s.id);
      return {
        ...s,
        avg_rating: st?.avg_rating ? parseFloat(st.avg_rating) : null,
        review_count: st ? parseInt(st.review_count, 10) : 0,
        question_count: qc ? parseInt(qc.question_count, 10) : 0,
      };
    });
    return enriched;
  }

  /** Değerlendirme oluştur. */
  async createReview(schoolId: string, userId: string, dto: CreateReviewDto) {
    await this.ensureModuleEnabled();
    const cfg = await this.appConfig.getSchoolReviewsConfig();
    const criteria = await this.listCriteria();

    let rating: number;
    let criteriaRatings: Record<string, number> | null = null;

    if (criteria.length > 0) {
      if (!dto.criteria_ratings || Object.keys(dto.criteria_ratings).length === 0) {
        throw new ForbiddenException({
          code: 'VALIDATION_ERROR',
          message: 'Lütfen tüm kriterlere puan verin.',
        });
      }
      const values: number[] = [];
      for (const c of criteria) {
        const v = dto.criteria_ratings[c.slug];
        if (v == null) continue;
        if (v < c.min_score || v > c.max_score) {
          throw new ForbiddenException({
            code: 'VALIDATION_ERROR',
            message: `${c.label} için puan ${c.min_score}-${c.max_score} arasında olmalıdır.`,
          });
        }
        values.push(v);
        criteriaRatings = criteriaRatings || {};
        criteriaRatings[c.slug] = v;
      }
      if (values.length < criteria.length) {
        throw new ForbiddenException({
          code: 'VALIDATION_ERROR',
          message: 'Lütfen tüm kriterlere puan verin.',
        });
      }
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      rating = Math.round(avg);
      rating = Math.max(cfg.rating_min, Math.min(cfg.rating_max, rating));
    } else {
      const r = Math.round(Number(dto.rating ?? cfg.rating_min));
      if (r < cfg.rating_min || r > cfg.rating_max) {
        throw new ForbiddenException({
          code: 'VALIDATION_ERROR',
          message: `Puan ${cfg.rating_min}-${cfg.rating_max} arasında olmalıdır.`,
        });
      }
      rating = r;
    }

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });

    const existing = await this.reviewRepo.findOne({ where: { school_id: schoolId, user_id: userId } });
    if (existing) {
      throw new ForbiddenException({
        code: 'ALREADY_EXISTS',
        message: 'Bu okula zaten değerlendirme yaptınız. Güncellemek için mevcut değerlendirmenizi düzenleyin.',
      });
    }

    this.assertNoBlockedTerms(dto.comment ?? '', cfg.content_rules);

    const status = cfg.moderation_mode === 'moderation' ? 'pending' : 'approved';
    const review = this.reviewRepo.create({
      school_id: schoolId,
      user_id: userId,
      rating,
      criteria_ratings: criteriaRatings,
      is_anonymous: dto.is_anonymous ?? false,
      comment: dto.comment?.trim() || null,
      status,
    });
    return this.reviewRepo.save(review);
  }

  /** Değerlendirme güncelle – sadece kendi yorumu. */
  async updateReview(reviewId: string, userId: string, dto: UpdateReviewDto) {
    await this.ensureModuleEnabled();
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Değerlendirme bulunamadı.' });
    if (review.user_id !== userId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu değerlendirmeyi düzenleyemezsiniz.' });
    }

    const criteria = await this.listCriteria();
    const cfg = await this.appConfig.getSchoolReviewsConfig();
    if (dto.criteria_ratings && criteria.length > 0) {
      const values: number[] = [];
      for (const c of criteria) {
        const v = dto.criteria_ratings[c.slug];
        if (v != null) {
          if (v < c.min_score || v > c.max_score) {
            throw new ForbiddenException({
              code: 'VALIDATION_ERROR',
              message: `${c.label} için puan ${c.min_score}-${c.max_score} arasında olmalıdır.`,
            });
          }
          values.push(v);
        }
      }
      if (values.length === criteria.length) {
        review.criteria_ratings = dto.criteria_ratings;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        let next = Math.round(avg);
        next = Math.max(cfg.rating_min, Math.min(cfg.rating_max, next));
        review.rating = next;
      }
    }
    if (dto.rating !== undefined && criteria.length === 0) {
      const r = Math.round(Number(dto.rating));
      if (r < cfg.rating_min || r > cfg.rating_max) {
        throw new ForbiddenException({
          code: 'VALIDATION_ERROR',
          message: `Puan ${cfg.rating_min}-${cfg.rating_max} arasında olmalıdır.`,
        });
      }
      review.rating = r;
    }
    if (dto.is_anonymous !== undefined) review.is_anonymous = dto.is_anonymous;
    if (dto.comment !== undefined) {
      this.assertNoBlockedTerms(dto.comment ?? '', cfg.content_rules);
      review.comment = dto.comment?.trim() || null;
    }
    return this.reviewRepo.save(review);
  }

  /** Değerlendirme sil – sadece kendi yorumu. */
  async deleteReview(reviewId: string, userId: string) {
    await this.ensureModuleEnabled();
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Değerlendirme bulunamadı.' });
    if (review.user_id !== userId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu değerlendirmeyi silemezsiniz.' });
    }
    await this.reviewRepo.remove(review);
    return { success: true };
  }

  /** Okula ait değerlendirmeler listesi. sort: newest | most_liked | rating_high | rating_low */
  async listReviews(schoolId: string, page: number = 1, limit: number = 20, userId?: string, actorKey?: string, sort: string = 'newest') {
    await this.ensureModuleEnabled();
    const validSort = ['newest', 'most_liked', 'rating_high', 'rating_low'].includes(sort) ? sort : 'newest';
    let items: SchoolReview[];
    let total: number;
    if (validSort === 'most_liked') {
      const idsResult = await this.reviewRepo.query(
        `SELECT r.id FROM school_reviews r
         LEFT JOIN school_review_likes l ON l.review_id = r.id
         WHERE r.school_id = $1 AND r.status = 'approved'
         GROUP BY r.id
         ORDER BY COUNT(l.id) DESC, r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [schoolId, limit, (page - 1) * limit],
      );
      const ids = idsResult.map((row: { id: string }) => row.id);
      total = await this.reviewRepo.count({ where: { school_id: schoolId, status: 'approved' } });
      items = ids.length === 0 ? [] : await this.reviewRepo.find({ where: { id: In(ids) }, relations: ['user'] });
      items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    } else {
      const order: Record<string, 'ASC' | 'DESC'> =
        validSort === 'rating_high' ? { rating: 'DESC', created_at: 'DESC' } : validSort === 'rating_low' ? { rating: 'ASC', created_at: 'DESC' } : { created_at: 'DESC' };
      [items, total] = await this.reviewRepo.findAndCount({
        where: { school_id: schoolId, status: 'approved' },
        relations: ['user'],
        order,
        skip: (page - 1) * limit,
        take: limit,
      });
    }
    if (userId && page === 1) {
      const ownReview = await this.reviewRepo.findOne({
        where: { school_id: schoolId, user_id: userId },
        relations: ['user'],
      });
      if (ownReview && ownReview.status !== 'hidden' && !items.some((r) => r.id === ownReview.id)) {
        items = [ownReview, ...items].slice(0, limit);
        total += 1;
      }
    }
    const reviewIds = items.map((r) => r.id);
    let likeCounts: Record<string, number> = {};
    let dislikeCounts: Record<string, number> = {};
    let userLikedIds: Set<string> = new Set();
    let userDislikedIds: Set<string> = new Set();
    if (reviewIds.length > 0) {
      const [likeRows, dislikeRows] = await Promise.all([
        this.likeRepo
          .createQueryBuilder('l')
          .select('l.review_id', 'review_id')
          .addSelect('COUNT(*)', 'cnt')
          .where('l.review_id IN (:...ids)', { ids: reviewIds })
          .groupBy('l.review_id')
          .getRawMany<{ review_id: string; cnt: string }>(),
        this.dislikeRepo
          .createQueryBuilder('d')
          .select('d.review_id', 'review_id')
          .addSelect('COUNT(*)', 'cnt')
          .where('d.review_id IN (:...ids)', { ids: reviewIds })
          .groupBy('d.review_id')
          .getRawMany<{ review_id: string; cnt: string }>(),
      ]);
      likeRows.forEach((c) => { likeCounts[c.review_id] = parseInt(c.cnt, 10); });
      dislikeRows.forEach((c) => { dislikeCounts[c.review_id] = parseInt(c.cnt, 10); });
      const key = actorKey ?? (userId ? `u:${userId}` : undefined);
      if (key) {
        const [liked, disliked] = await Promise.all([
          this.likeRepo.find({ where: { review_id: In(reviewIds), actor_key: key }, select: ['review_id'] }),
          this.dislikeRepo.find({ where: { review_id: In(reviewIds), actor_key: key }, select: ['review_id'] }),
        ]);
        liked.forEach((l) => userLikedIds.add(l.review_id));
        disliked.forEach((d) => userDislikedIds.add(d.review_id));
      }
    }
    const sanitized = items.map((r) => ({
      id: r.id,
      rating: r.rating,
      criteria_ratings: r.criteria_ratings,
      comment: r.comment,
      created_at: r.created_at,
      is_anonymous: r.is_anonymous,
      status: r.status,
      author_display_name: r.is_anonymous ? 'Öğretmen' : (r.user?.display_name || 'Öğretmen'),
      is_own: !!userId && r.user_id === userId,
      like_count: likeCounts[r.id] ?? 0,
      dislike_count: dislikeCounts[r.id] ?? 0,
      user_has_liked: userLikedIds.has(r.id),
      user_has_disliked: userDislikedIds.has(r.id),
    }));
    return paginate(sanitized, total, page, limit);
  }

  /** Değerlendirmeyi beğen / beğenmekten vazgeç (toggle). Beğen eklenirken beğenme kaldırılır. */
  async toggleReviewLike(reviewId: string, options: { userId?: string; anonymousId?: string }) {
    const { userId, anonymousId } = options;
    const actorKey = userId ? `u:${userId}` : anonymousId ? `a:${anonymousId}` : null;
    if (!actorKey) {
      throw new ForbiddenException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için giriş yapın veya anonymous_id gönderin.' });
    }
    await this.ensureModuleEnabled();
    const review = await this.reviewRepo.findOne({ where: { id: reviewId, status: 'approved' } });
    if (!review) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Değerlendirme bulunamadı.' });
    const existingLike = await this.likeRepo.findOne({ where: { review_id: reviewId, actor_key: actorKey } });
    if (existingLike) {
      await this.likeRepo.remove(existingLike);
      const [likeCount, dislikeCount] = await Promise.all([
        this.likeRepo.count({ where: { review_id: reviewId } }),
        this.dislikeRepo.count({ where: { review_id: reviewId } }),
      ]);
      return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: false };
    }
    await this.dislikeRepo.delete({ review_id: reviewId, actor_key: actorKey });
    await this.likeRepo.save(
      this.likeRepo.create({ review_id: reviewId, actor_key: actorKey, user_id: userId || null }),
    );
    const [likeCount, dislikeCount] = await Promise.all([
      this.likeRepo.count({ where: { review_id: reviewId } }),
      this.dislikeRepo.count({ where: { review_id: reviewId } }),
    ]);
    return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: true, user_has_disliked: false };
  }

  /** Değerlendirmeyi beğenme / beğenmekten vazgeç (toggle). Beğenme eklenirken beğeni kaldırılır. */
  async toggleReviewDislike(reviewId: string, options: { userId?: string; anonymousId?: string }) {
    const { userId, anonymousId } = options;
    const actorKey = userId ? `u:${userId}` : anonymousId ? `a:${anonymousId}` : null;
    if (!actorKey) {
      throw new ForbiddenException({ code: 'VALIDATION_ERROR', message: 'Beğenmemek için giriş yapın veya anonymous_id gönderin.' });
    }
    await this.ensureModuleEnabled();
    const review = await this.reviewRepo.findOne({ where: { id: reviewId, status: 'approved' } });
    if (!review) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Değerlendirme bulunamadı.' });
    const existingDislike = await this.dislikeRepo.findOne({ where: { review_id: reviewId, actor_key: actorKey } });
    if (existingDislike) {
      await this.dislikeRepo.remove(existingDislike);
      const [likeCount, dislikeCount] = await Promise.all([
        this.likeRepo.count({ where: { review_id: reviewId } }),
        this.dislikeRepo.count({ where: { review_id: reviewId } }),
      ]);
      return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: false };
    }
    await this.likeRepo.delete({ review_id: reviewId, actor_key: actorKey });
    await this.dislikeRepo.save(
      this.dislikeRepo.create({ review_id: reviewId, actor_key: actorKey, user_id: userId || null }),
    );
    const [likeCount, dislikeCount] = await Promise.all([
      this.likeRepo.count({ where: { review_id: reviewId } }),
      this.dislikeRepo.count({ where: { review_id: reviewId } }),
    ]);
    return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: true };
  }

  /** Soru oluştur. */
  async createQuestion(schoolId: string, userId: string, dto: CreateQuestionDto) {
    await this.ensureModuleEnabled();
    const cfg = await this.appConfig.getSchoolReviewsConfig();
    if (!cfg.allow_questions) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'Soru özelliği kapalı.' });
    }

    const school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Okul bulunamadı.' });

    this.assertNoBlockedTerms(dto.question, cfg.content_rules);

    const status = cfg.questions_require_moderation ? 'pending' : 'approved';
    const question = this.questionRepo.create({
      school_id: schoolId,
      user_id: userId,
      question: dto.question.trim(),
      is_anonymous: dto.is_anonymous ?? false,
      status,
    });
    return this.questionRepo.save(question);
  }

  /** Soruya cevap ver. */
  async createAnswer(questionId: string, userId: string, dto: CreateAnswerDto) {
    await this.ensureModuleEnabled();
    const cfg = await this.appConfig.getSchoolReviewsConfig();
    if (!cfg.allow_questions) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'Soru/cevap özelliği kapalı.' });
    }

    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Soru bulunamadı.' });
    if (question.status !== 'approved') {
      throw new ForbiddenException({ code: 'NOT_FOUND', message: 'Bu soruya cevap verilemez.' });
    }

    this.assertNoBlockedTerms(dto.answer, cfg.content_rules);

    const status = cfg.questions_require_moderation ? 'pending' : 'approved';
    const answer = this.answerRepo.create({
      question_id: questionId,
      user_id: userId,
      answer: dto.answer.trim(),
      is_anonymous: dto.is_anonymous ?? false,
      status,
    });
    return this.answerRepo.save(answer);
  }

  /** Okula ait sorular listesi. sort: newest | most_answers | most_liked */
  async listQuestions(
    schoolId: string,
    page: number = 1,
    limit: number = 20,
    userId?: string | null,
    actorKey?: string,
    sort: string = 'newest',
  ) {
    await this.ensureModuleEnabled();
    const validSort = ['newest', 'most_answers', 'most_liked'].includes(sort) ? sort : 'newest';
    let items: any[];
    let total: number;
    if (validSort === 'most_answers') {
      const idsResult = await this.questionRepo.query(
        `SELECT q.id FROM school_questions q
         LEFT JOIN school_question_answers a ON a.question_id = q.id AND a.status = 'approved'
         WHERE q.school_id = $1 AND q.status = 'approved'
         GROUP BY q.id
         ORDER BY COUNT(a.id) DESC, q.created_at DESC
         LIMIT $2 OFFSET $3`,
        [schoolId, limit, (page - 1) * limit],
      );
      const ids = idsResult.map((row: { id: string }) => row.id);
      total = await this.questionRepo.count({ where: { school_id: schoolId, status: 'approved' } });
      items = ids.length === 0 ? [] : await this.questionRepo.find({ where: { id: In(ids) }, relations: ['user', 'answers', 'answers.user'] });
      items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    } else if (validSort === 'most_liked') {
      const idsResult = await this.questionRepo.query(
        `SELECT q.id FROM school_questions q
         LEFT JOIN school_question_likes l ON l.question_id = q.id
         WHERE q.school_id = $1 AND q.status = 'approved'
         GROUP BY q.id
         ORDER BY COUNT(l.id) DESC, q.created_at DESC
         LIMIT $2 OFFSET $3`,
        [schoolId, limit, (page - 1) * limit],
      );
      const ids = idsResult.map((row: { id: string }) => row.id);
      total = await this.questionRepo.count({ where: { school_id: schoolId, status: 'approved' } });
      items = ids.length === 0 ? [] : await this.questionRepo.find({ where: { id: In(ids) }, relations: ['user', 'answers', 'answers.user'] });
      items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    } else {
      [items, total] = await this.questionRepo.findAndCount({
        where: { school_id: schoolId, status: 'approved' },
        relations: ['user', 'answers', 'answers.user'],
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    }
    if (userId && page === 1) {
      const ownPending = await this.questionRepo.find({
        where: { school_id: schoolId, user_id: userId, status: 'pending' },
        relations: ['user', 'answers', 'answers.user'],
        order: { created_at: 'DESC' },
      });
      const toPrepend = ownPending.filter((q) => !items.some((it) => it.id === q.id));
      if (toPrepend.length > 0) {
        items = [...toPrepend, ...items].slice(0, limit);
        total += toPrepend.length;
      }
    }
    const questionIds = items.map((q) => q.id);
    const answerIds = items.flatMap((q) =>
      (q.answers || []).filter((a: SchoolQuestionAnswer) => a.status === 'approved').map((a: SchoolQuestionAnswer) => a.id),
    );
    const key = actorKey ?? (userId ? `u:${userId}` : undefined);

    let questionLikeCounts: Record<string, number> = {};
    let questionDislikeCounts: Record<string, number> = {};
    let questionLikedIds: Set<string> = new Set();
    let questionDislikedIds: Set<string> = new Set();
    let answerLikeCounts: Record<string, number> = {};
    let answerDislikeCounts: Record<string, number> = {};
    let answerLikedIds: Set<string> = new Set();
    let answerDislikedIds: Set<string> = new Set();

    if (questionIds.length > 0) {
      const [qLikeRows, qDislikeRows] = await Promise.all([
        this.questionLikeRepo.createQueryBuilder('l').select('l.question_id', 'question_id').addSelect('COUNT(*)', 'cnt').where('l.question_id IN (:...ids)', { ids: questionIds }).groupBy('l.question_id').getRawMany<{ question_id: string; cnt: string }>(),
        this.questionDislikeRepo.createQueryBuilder('d').select('d.question_id', 'question_id').addSelect('COUNT(*)', 'cnt').where('d.question_id IN (:...ids)', { ids: questionIds }).groupBy('d.question_id').getRawMany<{ question_id: string; cnt: string }>(),
      ]);
      qLikeRows.forEach((c) => { questionLikeCounts[c.question_id] = parseInt(c.cnt, 10); });
      qDislikeRows.forEach((c) => { questionDislikeCounts[c.question_id] = parseInt(c.cnt, 10); });
      if (key) {
        const [liked, disliked] = await Promise.all([
          this.questionLikeRepo.find({ where: { question_id: In(questionIds), actor_key: key }, select: ['question_id'] }),
          this.questionDislikeRepo.find({ where: { question_id: In(questionIds), actor_key: key }, select: ['question_id'] }),
        ]);
        liked.forEach((l) => questionLikedIds.add(l.question_id));
        disliked.forEach((d) => questionDislikedIds.add(d.question_id));
      }
    }
    if (answerIds.length > 0) {
      const [aLikeRows, aDislikeRows] = await Promise.all([
        this.answerLikeRepo.createQueryBuilder('l').select('l.answer_id', 'answer_id').addSelect('COUNT(*)', 'cnt').where('l.answer_id IN (:...ids)', { ids: answerIds }).groupBy('l.answer_id').getRawMany<{ answer_id: string; cnt: string }>(),
        this.answerDislikeRepo.createQueryBuilder('d').select('d.answer_id', 'answer_id').addSelect('COUNT(*)', 'cnt').where('d.answer_id IN (:...ids)', { ids: answerIds }).groupBy('d.answer_id').getRawMany<{ answer_id: string; cnt: string }>(),
      ]);
      aLikeRows.forEach((c) => { answerLikeCounts[c.answer_id] = parseInt(c.cnt, 10); });
      aDislikeRows.forEach((c) => { answerDislikeCounts[c.answer_id] = parseInt(c.cnt, 10); });
      if (key) {
        const [liked, disliked] = await Promise.all([
          this.answerLikeRepo.find({ where: { answer_id: In(answerIds), actor_key: key }, select: ['answer_id'] }),
          this.answerDislikeRepo.find({ where: { answer_id: In(answerIds), actor_key: key }, select: ['answer_id'] }),
        ]);
        liked.forEach((l) => answerLikedIds.add(l.answer_id));
        disliked.forEach((d) => answerDislikedIds.add(d.answer_id));
      }
    }

    const sanitized = items.map((q) => ({
      id: q.id,
      question: q.question,
      status: q.status,
      created_at: q.created_at,
      is_anonymous: q.is_anonymous ?? false,
      author_display_name: q.is_anonymous ? 'Öğretmen' : (q.user?.display_name || 'Öğretmen'),
      is_own: !!userId && q.user_id === userId,
      like_count: questionLikeCounts[q.id] ?? 0,
      dislike_count: questionDislikeCounts[q.id] ?? 0,
      user_has_liked: questionLikedIds.has(q.id),
      user_has_disliked: questionDislikedIds.has(q.id),
      answers: (q.answers || [])
        .filter(
          (a: SchoolQuestionAnswer) =>
            a.status === 'approved' || (!!userId && a.user_id === userId && a.status === 'pending'),
        )
        .map((a: SchoolQuestionAnswer) => ({
          id: a.id,
          answer: a.answer,
          status: a.status,
          created_at: a.created_at,
          is_anonymous: a.is_anonymous ?? false,
          author_display_name: a.is_anonymous ? 'Öğretmen' : (a.user?.display_name || 'Öğretmen'),
          is_own: !!userId && a.user_id === userId,
          like_count: answerLikeCounts[a.id] ?? 0,
          dislike_count: answerDislikeCounts[a.id] ?? 0,
          user_has_liked: answerLikedIds.has(a.id),
          user_has_disliked: answerDislikedIds.has(a.id),
        })),
    }));
    return paginate(sanitized, total, page, limit);
  }

  /** Soruyu beğen / beğenmekten vazgeç (toggle). Beğen eklenirken beğenme kaldırılır. */
  async toggleQuestionLike(questionId: string, options: { userId?: string; anonymousId?: string }) {
    const { userId, anonymousId } = options;
    const actorKey = userId ? `u:${userId}` : anonymousId ? `a:${anonymousId}` : null;
    if (!actorKey) throw new ForbiddenException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için giriş yapın veya anonymous_id gönderin.' });
    await this.ensureModuleEnabled();
    const question = await this.questionRepo.findOne({ where: { id: questionId, status: 'approved' } });
    if (!question) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Soru bulunamadı.' });
    const existingLike = await this.questionLikeRepo.findOne({ where: { question_id: questionId, actor_key: actorKey } });
    if (existingLike) {
      await this.questionLikeRepo.remove(existingLike);
      const [likeCount, dislikeCount] = await Promise.all([this.questionLikeRepo.count({ where: { question_id: questionId } }), this.questionDislikeRepo.count({ where: { question_id: questionId } })]);
      return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: false };
    }
    await this.questionDislikeRepo.delete({ question_id: questionId, actor_key: actorKey });
    await this.questionLikeRepo.save(this.questionLikeRepo.create({ question_id: questionId, actor_key: actorKey, user_id: userId || null }));
    const [likeCount, dislikeCount] = await Promise.all([this.questionLikeRepo.count({ where: { question_id: questionId } }), this.questionDislikeRepo.count({ where: { question_id: questionId } })]);
    return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: true, user_has_disliked: false };
  }

  /** Soruyu beğenme / beğenmekten vazgeç (toggle). Beğenme eklenirken beğeni kaldırılır. */
  async toggleQuestionDislike(questionId: string, options: { userId?: string; anonymousId?: string }) {
    const { userId, anonymousId } = options;
    const actorKey = userId ? `u:${userId}` : anonymousId ? `a:${anonymousId}` : null;
    if (!actorKey) throw new ForbiddenException({ code: 'VALIDATION_ERROR', message: 'Beğenmemek için giriş yapın veya anonymous_id gönderin.' });
    await this.ensureModuleEnabled();
    const question = await this.questionRepo.findOne({ where: { id: questionId, status: 'approved' } });
    if (!question) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Soru bulunamadı.' });
    const existingDislike = await this.questionDislikeRepo.findOne({ where: { question_id: questionId, actor_key: actorKey } });
    if (existingDislike) {
      await this.questionDislikeRepo.remove(existingDislike);
      const [likeCount, dislikeCount] = await Promise.all([this.questionLikeRepo.count({ where: { question_id: questionId } }), this.questionDislikeRepo.count({ where: { question_id: questionId } })]);
      return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: false };
    }
    await this.questionLikeRepo.delete({ question_id: questionId, actor_key: actorKey });
    await this.questionDislikeRepo.save(this.questionDislikeRepo.create({ question_id: questionId, actor_key: actorKey, user_id: userId || null }));
    const [likeCount, dislikeCount] = await Promise.all([this.questionLikeRepo.count({ where: { question_id: questionId } }), this.questionDislikeRepo.count({ where: { question_id: questionId } })]);
    return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: true };
  }

  /** Cevabı beğen / beğenmekten vazgeç (toggle). Beğen eklenirken beğenme kaldırılır. */
  async toggleAnswerLike(answerId: string, options: { userId?: string; anonymousId?: string }) {
    const { userId, anonymousId } = options;
    const actorKey = userId ? `u:${userId}` : anonymousId ? `a:${anonymousId}` : null;
    if (!actorKey) throw new ForbiddenException({ code: 'VALIDATION_ERROR', message: 'Beğenmek için giriş yapın veya anonymous_id gönderin.' });
    await this.ensureModuleEnabled();
    const answer = await this.answerRepo.findOne({ where: { id: answerId, status: 'approved' } });
    if (!answer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cevap bulunamadı.' });
    const existingLike = await this.answerLikeRepo.findOne({ where: { answer_id: answerId, actor_key: actorKey } });
    if (existingLike) {
      await this.answerLikeRepo.remove(existingLike);
      const [likeCount, dislikeCount] = await Promise.all([this.answerLikeRepo.count({ where: { answer_id: answerId } }), this.answerDislikeRepo.count({ where: { answer_id: answerId } })]);
      return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: false };
    }
    await this.answerDislikeRepo.delete({ answer_id: answerId, actor_key: actorKey });
    await this.answerLikeRepo.save(this.answerLikeRepo.create({ answer_id: answerId, actor_key: actorKey, user_id: userId || null }));
    const [likeCount, dislikeCount] = await Promise.all([this.answerLikeRepo.count({ where: { answer_id: answerId } }), this.answerDislikeRepo.count({ where: { answer_id: answerId } })]);
    return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: true, user_has_disliked: false };
  }

  /** Cevabı beğenme / beğenmekten vazgeç (toggle). Beğenme eklenirken beğeni kaldırılır. */
  async toggleAnswerDislike(answerId: string, options: { userId?: string; anonymousId?: string }) {
    const { userId, anonymousId } = options;
    const actorKey = userId ? `u:${userId}` : anonymousId ? `a:${anonymousId}` : null;
    if (!actorKey) throw new ForbiddenException({ code: 'VALIDATION_ERROR', message: 'Beğenmemek için giriş yapın veya anonymous_id gönderin.' });
    await this.ensureModuleEnabled();
    const answer = await this.answerRepo.findOne({ where: { id: answerId, status: 'approved' } });
    if (!answer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cevap bulunamadı.' });
    const existingDislike = await this.answerDislikeRepo.findOne({ where: { answer_id: answerId, actor_key: actorKey } });
    if (existingDislike) {
      await this.answerDislikeRepo.remove(existingDislike);
      const [likeCount, dislikeCount] = await Promise.all([this.answerLikeRepo.count({ where: { answer_id: answerId } }), this.answerDislikeRepo.count({ where: { answer_id: answerId } })]);
      return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: false };
    }
    await this.answerLikeRepo.delete({ answer_id: answerId, actor_key: actorKey });
    await this.answerDislikeRepo.save(this.answerDislikeRepo.create({ answer_id: answerId, actor_key: actorKey, user_id: userId || null }));
    const [likeCount, dislikeCount] = await Promise.all([this.answerLikeRepo.count({ where: { answer_id: answerId } }), this.answerDislikeRepo.count({ where: { answer_id: answerId } })]);
    return { like_count: likeCount, dislike_count: dislikeCount, user_has_liked: false, user_has_disliked: true };
  }

  /** Uygunsuz içerik bildir. Aynı içerik için aynı actor zaten bildirmişse sessizce başarı döner. */
  async reportContent(
    entityType: 'review' | 'question' | 'answer',
    entityId: string,
    options: { userId?: string; anonymousId?: string; reason?: string; comment?: string },
  ) {
    const { userId, anonymousId, reason = 'diger', comment } = options;
    const actorKey = userId ? `u:${userId}` : anonymousId ? `a:${anonymousId}` : null;
    if (!actorKey) {
      throw new ForbiddenException({ code: 'VALIDATION_ERROR', message: 'Bildirmek için giriş yapın veya anonymous_id gönderin.' });
    }
    await this.ensureModuleEnabled();

    const cr = (await this.appConfig.getSchoolReviewsConfig()).content_rules;
    type RK = 'spam' | 'uygunsuz' | 'yanlis_bilgi' | 'diger';
    const allKeys: RK[] = ['spam', 'uygunsuz', 'yanlis_bilgi', 'diger'];
    let r: RK = typeof reason === 'string' && allKeys.includes(reason as RK) ? (reason as RK) : 'diger';
    if (!cr.reasons[r].enabled) r = 'diger';

    this.assertNoBlockedTerms(comment, cr);

    if (entityType === 'review') {
      const exists = await this.reviewRepo.findOne({ where: { id: entityId, status: 'approved' } });
      if (!exists) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Değerlendirme bulunamadı.' });
    } else if (entityType === 'question') {
      const exists = await this.questionRepo.findOne({ where: { id: entityId, status: 'approved' } });
      if (!exists) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Soru bulunamadı.' });
    } else {
      const exists = await this.answerRepo.findOne({ where: { id: entityId, status: 'approved' } });
      if (!exists) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cevap bulunamadı.' });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await this.reportRepo.findOne({
      where: { entity_type: entityType, entity_id: entityId, reporter_actor_key: actorKey },
    });
    if (existing) {
      return { success: true, message: 'Bu içerik zaten bildirildi.' };
    }

    const totalToday = await this.reportRepo
      .createQueryBuilder('r')
      .where('r.reporter_actor_key = :actorKey', { actorKey })
      .andWhere('r.created_at >= :since', { since: oneDayAgo })
      .getCount();
    const limit = cr.daily_report_limit_per_actor;
    if (totalToday >= limit) {
      throw new ForbiddenException({
        code: 'RATE_LIMIT',
        message: `Bugün en fazla ${limit} bildirim yapabilirsiniz.`,
      });
    }

    await this.reportRepo.save(
      this.reportRepo.create({
        entity_type: entityType,
        entity_id: entityId,
        reporter_actor_key: actorKey,
        reporter_user_id: userId || null,
        reason: r,
        comment: comment?.trim() || null,
      }),
    );
    return { success: true, message: 'Bildiriminiz alındı. İnceleme yapılacaktır.' };
  }

  /** Soru güncelle – sadece kendi sorusu. */
  async updateQuestion(questionId: string, userId: string, dto: UpdateQuestionDto) {
    await this.ensureModuleEnabled();
    const cfg = await this.appConfig.getSchoolReviewsConfig();
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Soru bulunamadı.' });
    if (question.user_id !== userId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu soruyu düzenleyemezsiniz.' });
    }
    this.assertNoBlockedTerms(dto.question, cfg.content_rules);
    question.question = dto.question.trim();
    return this.questionRepo.save(question);
  }

  /** Soru sil – sadece kendi sorusu. */
  async deleteQuestion(questionId: string, userId: string) {
    await this.ensureModuleEnabled();
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Soru bulunamadı.' });
    if (question.user_id !== userId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu soruyu silemezsiniz.' });
    }
    await this.questionRepo.remove(question);
    return { success: true };
  }

  /** Cevap güncelle – sadece kendi cevabı. */
  async updateAnswer(answerId: string, userId: string, dto: UpdateAnswerDto) {
    await this.ensureModuleEnabled();
    const cfg = await this.appConfig.getSchoolReviewsConfig();
    const answer = await this.answerRepo.findOne({ where: { id: answerId } });
    if (!answer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cevap bulunamadı.' });
    if (answer.user_id !== userId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu cevabı düzenleyemezsiniz.' });
    }
    this.assertNoBlockedTerms(dto.answer, cfg.content_rules);
    answer.answer = dto.answer.trim();
    return this.answerRepo.save(answer);
  }

  /** Cevap sil – sadece kendi cevabı. */
  async deleteAnswer(answerId: string, userId: string) {
    await this.ensureModuleEnabled();
    const answer = await this.answerRepo.findOne({ where: { id: answerId } });
    if (!answer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cevap bulunamadı.' });
    if (answer.user_id !== userId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu cevabı silemezsiniz.' });
    }
    await this.answerRepo.remove(answer);
    return { success: true };
  }

  /** School admin raporu – sadece kendi okuluna ait. Kriter bazlı ortalamalar dahil. */
  async getSchoolReport(schoolId: string, scopeSchoolId: string) {
    if (schoolId !== scopeSchoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    const cfg = await this.appConfig.getSchoolReviewsConfig();
    if (!cfg.enabled) {
      throw new ForbiddenException({ code: 'MODULE_DISABLED', message: 'Okul değerlendirme modülü kapalı.' });
    }

    const [criteria, avgResult, reviewCount, questionCount, recentReviews, recentQuestions, reviewsWithCriteria] = await Promise.all([
      this.listCriteria(),
      this.reviewRepo
        .createQueryBuilder('r')
        .select('AVG(r.rating)', 'avg')
        .where('r.school_id = :schoolId', { schoolId })
        .andWhere('r.status = :status', { status: 'approved' })
        .getRawOne<{ avg: string | null }>(),
      this.reviewRepo.count({ where: { school_id: schoolId, status: 'approved' } }),
      this.questionRepo.count({ where: { school_id: schoolId, status: 'approved' } }),
      this.reviewRepo.find({
        where: { school_id: schoolId, status: 'approved' },
        select: ['id', 'rating', 'comment', 'created_at', 'criteria_ratings'],
        order: { created_at: 'DESC' },
        take: 10,
      }),
      this.questionRepo.find({
        where: { school_id: schoolId, status: 'approved' },
        relations: ['answers', 'answers.user'],
        order: { created_at: 'DESC' },
        take: 10,
      }),
      this.reviewRepo.find({
        where: { school_id: schoolId, status: 'approved' },
        select: ['id', 'criteria_ratings'],
      }),
    ]);

    const avgRating = avgResult?.avg ? parseFloat(avgResult.avg) : null;
    const criteriaAverages: Record<string, number> = {};
    if (criteria.length > 0 && reviewsWithCriteria.length > 0) {
      for (const c of criteria) {
        const values = reviewsWithCriteria
          .map((r) => r.criteria_ratings?.[c.slug])
          .filter((v): v is number => typeof v === 'number');
        if (values.length > 0) {
          criteriaAverages[c.slug] = Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
        }
      }
    }

    return {
      school_id: schoolId,
      avg_rating: avgRating != null ? Math.round(avgRating * 10) / 10 : null,
      review_count: reviewCount,
      question_count: questionCount,
      criteria: criteria.length > 0 ? criteria : null,
      criteria_averages: Object.keys(criteriaAverages).length > 0 ? criteriaAverages : null,
      recent_reviews: recentReviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        criteria_ratings: r.criteria_ratings ?? null,
        comment: r.comment,
        created_at: r.created_at,
      })),
      recent_questions: recentQuestions.map((q) => {
        const approvedAnswers = (q.answers || []).filter((a) => a.status === 'approved');
        return {
          id: q.id,
          question: q.question,
          created_at: q.created_at,
          answer_count: approvedAnswers.length,
          answers: approvedAnswers.map((a) => ({
            id: a.id,
            answer: a.answer,
            created_at: a.created_at,
            is_anonymous: a.is_anonymous ?? false,
            author_display_name: a.is_anonymous ? 'Öğretmen' : (a.user?.display_name || 'Öğretmen'),
          })),
        };
      }),
    };
  }

  /** Süper yönetici / moderatör: onay bekleyen yorum, soru, cevap kuyruğu */
  async listModerationQueue(dto: ListModerationQueueDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 20, 100);
    const offset = (page - 1) * limit;
    const t = dto.entity_type ?? null;

    const total =
      t === 'review'
        ? await this.reviewRepo.count({ where: { status: 'pending' } })
        : t === 'question'
          ? await this.questionRepo.count({ where: { status: 'pending' } })
          : t === 'answer'
            ? await this.answerRepo.count({ where: { status: 'pending' } })
            : (
                await Promise.all([
                  this.reviewRepo.count({ where: { status: 'pending' } }),
                  this.questionRepo.count({ where: { status: 'pending' } }),
                  this.answerRepo.count({ where: { status: 'pending' } }),
                ])
              ).reduce((a, b) => a + b, 0);

    const rows = await this.reviewRepo.query(
      `
      SELECT u.entity_type, u.id, u.school_id, u.school_name, u.content_preview, u.created_at
      FROM (
        SELECT 'review'::text AS entity_type, r.id::text AS id, r.school_id::text AS school_id, sch.name AS school_name,
          LEFT(COALESCE(NULLIF(trim(r.comment), ''), r.rating::text || ' puan'), 400) AS content_preview, r.created_at
        FROM school_reviews r
        INNER JOIN schools sch ON sch.id = r.school_id
        WHERE r.status = 'pending'
        UNION ALL
        SELECT 'question'::text, q.id::text, q.school_id::text, sch.name, LEFT(q.question, 400), q.created_at
        FROM school_questions q
        INNER JOIN schools sch ON sch.id = q.school_id
        WHERE q.status = 'pending'
        UNION ALL
        SELECT 'answer'::text, a.id::text, sq.school_id::text, sch.name, LEFT(a.answer, 400), a.created_at
        FROM school_question_answers a
        INNER JOIN school_questions sq ON sq.id = a.question_id
        INNER JOIN schools sch ON sch.id = sq.school_id
        WHERE a.status = 'pending'
      ) u
      WHERE ($1::varchar IS NULL OR u.entity_type = $1)
      ORDER BY u.created_at DESC
      LIMIT $2 OFFSET $3
      `,
      [t ?? null, limit, offset],
    );

    const items = (rows as Record<string, unknown>[]).map((row) => ({
      entity_type: row.entity_type as 'review' | 'question' | 'answer',
      id: String(row.id),
      school_id: String(row.school_id),
      school_name: row.school_name != null ? String(row.school_name) : null,
      content_preview: row.content_preview != null ? String(row.content_preview) : '',
      created_at:
        row.created_at instanceof Date ? (row.created_at as Date).toISOString() : String(row.created_at),
    }));

    return paginate(items, total, page, limit);
  }

  async moderateReview(reviewId: string, dto: { status: 'approved' | 'hidden' }) {
    await this.ensureModuleEnabled();
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Değerlendirme bulunamadı.' });
    if (dto.status === 'approved') {
      if (review.status !== 'pending') {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Yalnızca beklemedeki değerlendirme onaylanabilir.',
        });
      }
      review.status = 'approved';
    } else {
      if (review.status === 'hidden') {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bu içerik zaten gizlenmiş.' });
      }
      review.status = 'hidden';
    }
    return this.reviewRepo.save(review);
  }

  async moderateQuestion(questionId: string, dto: { status: 'approved' | 'hidden' }) {
    await this.ensureModuleEnabled();
    const question = await this.questionRepo.findOne({ where: { id: questionId } });
    if (!question) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Soru bulunamadı.' });
    if (dto.status === 'approved') {
      if (question.status !== 'pending') {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Yalnızca beklemedeki soru onaylanabilir.',
        });
      }
      question.status = 'approved';
    } else {
      if (question.status === 'hidden') {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bu içerik zaten gizlenmiş.' });
      }
      question.status = 'hidden';
    }
    return this.questionRepo.save(question);
  }

  async moderateAnswer(answerId: string, dto: { status: 'approved' | 'hidden' }) {
    await this.ensureModuleEnabled();
    const answer = await this.answerRepo.findOne({ where: { id: answerId } });
    if (!answer) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Cevap bulunamadı.' });
    if (dto.status === 'approved') {
      if (answer.status !== 'pending') {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Yalnızca beklemedeki cevap onaylanabilir.',
        });
      }
      answer.status = 'approved';
    } else {
      if (answer.status === 'hidden') {
        throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Bu içerik zaten gizlenmiş.' });
      }
      answer.status = 'hidden';
    }
    return this.answerRepo.save(answer);
  }

  /** Süper yönetici / moderatör: uygunsuz içerik bildirimleri (okul adı + metin özeti). */
  async listContentReportsAdmin(dto: ListContentReportsAdminDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const offset = (page - 1) * limit;
    const entityType = dto.entity_type ?? null;
    const reason = dto.reason?.trim() || null;

    const rows = await this.reportRepo.query(
      `
      SELECT r.id, r.entity_type, r.entity_id::text AS entity_id, r.reason, r.comment, r.created_at, r.reporter_actor_key,
        r.reporter_user_id::text AS reporter_user_id,
        COALESCE(rev.school_id, sq.school_id, sq2.school_id)::text AS school_id,
        sch.name AS school_name,
        CASE
          WHEN r.entity_type = 'review' THEN LEFT(COALESCE(rev.comment, ''), 320)
          WHEN r.entity_type = 'question' THEN LEFT(COALESCE(sq.question, ''), 320)
          WHEN r.entity_type = 'answer' THEN LEFT(COALESCE(ans.answer, ''), 320)
          ELSE NULL
        END AS content_preview
      FROM school_content_reports r
      LEFT JOIN school_reviews rev ON r.entity_type = 'review' AND r.entity_id = rev.id
      LEFT JOIN school_questions sq ON r.entity_type = 'question' AND r.entity_id = sq.id
      LEFT JOIN school_question_answers ans ON r.entity_type = 'answer' AND r.entity_id = ans.id
      LEFT JOIN school_questions sq2 ON ans.question_id = sq2.id
      LEFT JOIN schools sch ON sch.id = COALESCE(rev.school_id, sq.school_id, sq2.school_id)
      WHERE ($1::varchar IS NULL OR r.entity_type = $1)
        AND ($2::varchar IS NULL OR r.reason = $2)
      ORDER BY r.created_at DESC
      LIMIT $3 OFFSET $4
      `,
      [entityType, reason, limit, offset],
    );

    const countRow = await this.reportRepo.query(
      `
      SELECT COUNT(*)::int AS c
      FROM school_content_reports r
      WHERE ($1::varchar IS NULL OR r.entity_type = $1)
        AND ($2::varchar IS NULL OR r.reason = $2)
      `,
      [entityType, reason],
    );
    const total = countRow[0]?.c ?? 0;

    const items = (rows as Record<string, unknown>[]).map((row) => ({
      id: String(row.id),
      entity_type: row.entity_type as string,
      entity_id: String(row.entity_id),
      reason: String(row.reason),
      comment: row.comment ? String(row.comment) : null,
      created_at:
        row.created_at instanceof Date ? (row.created_at as Date).toISOString() : String(row.created_at),
      reporter_kind: row.reporter_user_id ? ('registered' as const) : ('guest' as const),
      school_id: row.school_id ? String(row.school_id) : null,
      school_name: row.school_name ? String(row.school_name) : null,
      content_preview: row.content_preview != null ? String(row.content_preview) : null,
    }));

    return paginate(items, total, page, limit);
  }

  async onModuleInit(): Promise<void> {
    const count = await this.criteriaRepo.count();
    if (count === 0) {
      for (const item of DEFAULT_CRITERIA) {
        await this.criteriaRepo.save(
          this.criteriaRepo.create({
            slug: item.slug,
            label: item.label,
            hint: item.hint,
            sort_order: item.sort_order,
            min_score: CRITERIA_SCORE_MIN,
            max_score: CRITERIA_SCORE_MAX,
          }),
        );
      }
    }
    try {
      const { updated } = await this.normalizeCriteriaScoreRange();
      if (updated > 0) {
        this.logger.log(`Değerlendirme kriterleri: ${updated} satır 1–10 aralığına çekildi.`);
      }
    } catch (err) {
      this.logger.error('Kriter puan aralığı (1–10) senkronu başarısız', err);
    }
  }

  /**
   * Tüm kriterleri siler ve varsayılan 1–10 kriter setini yükler.
   * Mevcut değerlendirmelerdeki criteria_ratings (JSON) eski slug’larla kalır; süper yönetici bilinçli kullanmalıdır.
   */
  async reseedDefaultCriteria(): Promise<{ inserted: number }> {
    await this.criteriaRepo.clear();
    for (const item of DEFAULT_CRITERIA) {
      await this.criteriaRepo.save(
        this.criteriaRepo.create({
          slug: item.slug,
          label: item.label,
          hint: item.hint,
          sort_order: item.sort_order,
          min_score: CRITERIA_SCORE_MIN,
          max_score: CRITERIA_SCORE_MAX,
        }),
      );
    }
    return { inserted: DEFAULT_CRITERIA.length };
  }

  /** 1–10 dışındaki kriter satırlarını düzeltir (slug/başlık değişmez). */
  async normalizeCriteriaScoreRange(): Promise<{ updated: number }> {
    const r = await this.criteriaRepo
      .createQueryBuilder()
      .update(SchoolReviewCriteria)
      .set({ min_score: CRITERIA_SCORE_MIN, max_score: CRITERIA_SCORE_MAX })
      .where('min_score <> :min OR max_score <> :max', {
        min: CRITERIA_SCORE_MIN,
        max: CRITERIA_SCORE_MAX,
      })
      .execute();
    return { updated: r.affected ?? 0 };
  }
}
