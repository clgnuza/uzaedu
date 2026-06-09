import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YillikPlanIcerikService } from './yillik-plan-icerik.service';
import { parsePlanPastePayload } from './plan-paste-parser';
import { User } from '../users/entities/user.entity';
import { CreateYillikPlanSubmissionDto } from './dto/create-yillik-plan-submission.dto';
import { UpdateYillikPlanSubmissionDto } from './dto/update-yillik-plan-submission.dto';
import { isBilsemSubjectCode } from '../bilsem/bilsem-puy-plan-constants';
import { YillikPlanSubmission, YillikPlanSubmissionStatus } from './entities/yillik-plan-submission.entity';
import { YillikPlanSubmissionEvent } from './entities/yillik-plan-submission-event.entity';

export type MebPlanModerationQueueRow = {
  id: string;
  status: string;
  subjectCode: string;
  subjectLabel: string;
  grade: number;
  section: string | null;
  academicYear: string;
  tabloAltiNot: string | null;
  weekCount: number;
  submittedAt: string | null;
  updatedAt: string;
  createdAt: string;
  authorUserId: string;
  authorEmail: string | null;
  authorDisplayName: string | null;
};

export type MebPlanModerationHistoryRow = MebPlanModerationQueueRow & {
  reviewerLabel: string | null;
  reviewNote: string | null;
  decidedAt: string | null;
  publishedAt: string | null;
};

@Injectable()
export class YillikPlanSubmissionService {
  constructor(
    @InjectRepository(YillikPlanSubmission)
    private readonly submissionRepo: Repository<YillikPlanSubmission>,
    @InjectRepository(YillikPlanSubmissionEvent)
    private readonly eventRepo: Repository<YillikPlanSubmissionEvent>,
    private readonly yillikPlanIcerikService: YillikPlanIcerikService,
  ) {}

  private itemsJsonFromImportOrItems(dto: { items_import?: string; items?: CreateYillikPlanSubmissionDto['items'] }): string {
    const imp = dto.items_import?.trim();
    if (imp) {
      const { rows } = parsePlanPastePayload(imp);
      if (!rows.length) throw new BadRequestException({ code: 'IMPORT_NO_ROWS', message: 'Geçerli hafta satırı yok.' });
      return JSON.stringify(rows);
    }
    if (dto.items?.length) return JSON.stringify(dto.items);
    throw new BadRequestException({ code: 'ITEMS_REQUIRED', message: '"items" veya "items_import" zorunludur.' });
  }

  private parseItemsJson(itemsJson: string): Array<Record<string, unknown>> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(itemsJson);
    } catch {
      throw new BadRequestException({ code: 'INVALID_JSON', message: 'items_json geçersiz.' });
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new BadRequestException({ code: 'ITEMS_EMPTY', message: 'En az bir hafta verisi gerekir.' });
    }
    const rows = parsed
      .map((el) => (el && typeof el === 'object' ? (el as Record<string, unknown>) : null))
      .filter((el): el is Record<string, unknown> => !!el)
      .map((o) => ({ ...o, week_order: Number(o.week_order ?? o.weekOrder ?? o.hafta), ders_saati: Number(o.ders_saati ?? 2) }))
      .filter((o) => Number.isFinite(o.week_order) && o.week_order >= 1 && o.week_order <= 38);
    if (!rows.length) throw new BadRequestException({ code: 'ITEMS_INVALID', message: 'Geçerli öğretim haftası yok.' });
    return rows;
  }

  private async appendEvent(submissionId: string, actorUserId: string, from: YillikPlanSubmissionStatus | null, to: YillikPlanSubmissionStatus, note?: string | null): Promise<void> {
    await this.eventRepo.save(this.eventRepo.create({ submissionId, actorUserId, fromStatus: from, toStatus: to, note: note?.trim() || null }));
  }

  private assertMebPlanSubject(subjectCode: string): void {
    if (isBilsemSubjectCode(subjectCode)) {
      throw new BadRequestException({
        code: 'BILSEM_SUBJECT_ON_MEB',
        message: 'BİLSEM ders kodu MEB plan katkısına kaydedilemez. BİLSEM menüsünden yükleyin.',
      });
    }
  }

  async createDraft(authorUserId: string, schoolId: string | null, dto: CreateYillikPlanSubmissionDto): Promise<YillikPlanSubmission> {
    this.assertMebPlanSubject(dto.subject_code);
    const itemsJson = this.itemsJsonFromImportOrItems(dto);
    this.parseItemsJson(itemsJson);
    const row = this.submissionRepo.create({
      authorUserId,
      schoolId,
      status: 'draft',
      subjectCode: dto.subject_code.trim(),
      subjectLabel: dto.subject_label.trim(),
      grade: dto.grade,
      section: dto.section?.trim() || null,
      academicYear: dto.academic_year.trim(),
      tabloAltiNot: dto.tablo_alti_not?.trim() || null,
      itemsJson,
    });
    const saved = await this.submissionRepo.save(row);
    await this.appendEvent(saved.id, authorUserId, null, 'draft');
    return saved;
  }

  async listMine(authorUserId: string): Promise<YillikPlanSubmission[]> {
    try {
      return this.submissionRepo.find({ where: { authorUserId }, order: { updatedAt: 'DESC' }, take: 100 });
    } catch {
      return [];
    }
  }

  async getOne(id: string, viewerUserId: string, role: string): Promise<YillikPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id }, relations: ['author', 'reviewer'] });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    const isMod = role === 'superadmin' || role === 'moderator';
    if (!isMod && s.authorUserId !== viewerUserId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Erişim yok.' });
    return s;
  }

  async updateDraft(id: string, authorUserId: string, dto: UpdateYillikPlanSubmissionDto): Promise<YillikPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.authorUserId !== authorUserId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece yazar günceller.' });
    if (s.status !== 'draft') throw new ConflictException({ code: 'NOT_DRAFT', message: 'Sadece taslak güncellenir.' });
    if (dto.subject_label !== undefined) s.subjectLabel = dto.subject_label.trim();
    if (dto.grade !== undefined) s.grade = Number(dto.grade);
    if (dto.section !== undefined) s.section = dto.section?.trim() || null;
    if (dto.academic_year !== undefined) s.academicYear = dto.academic_year.trim();
    if (dto.tablo_alti_not !== undefined) s.tabloAltiNot = dto.tablo_alti_not?.trim() || null;
    if (dto.items_import !== undefined && dto.items_import.trim()) {
      s.itemsJson = this.itemsJsonFromImportOrItems({ items_import: dto.items_import });
    } else if (dto.items !== undefined) {
      s.itemsJson = JSON.stringify(dto.items);
      this.parseItemsJson(s.itemsJson);
    }
    return this.submissionRepo.save(s);
  }

  async submit(id: string, authorUserId: string): Promise<YillikPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.authorUserId !== authorUserId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece yazar gönderebilir.' });
    if (s.status !== 'draft') throw new ConflictException({ code: 'INVALID_STATE', message: 'Yalnızca taslak gönderilir.' });
    this.parseItemsJson(s.itemsJson);
    const prev = s.status;
    s.status = 'pending_review';
    s.submittedAt = new Date();
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, authorUserId, prev, 'pending_review');
    return saved;
  }

  async withdraw(id: string, authorUserId: string): Promise<YillikPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.authorUserId !== authorUserId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece yazar geri çeker.' });
    if (s.status !== 'draft' && s.status !== 'pending_review') throw new ConflictException({ code: 'INVALID_STATE', message: 'Geri çekilemez.' });
    const prev = s.status;
    s.status = 'withdrawn';
    s.decidedAt = new Date();
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, authorUserId, prev, 'withdrawn');
    return saved;
  }

  private weekCountFromItemsJson(raw: string): number {
    try {
      const j = JSON.parse(raw) as unknown;
      return Array.isArray(j) ? j.length : 0;
    } catch {
      return 0;
    }
  }

  private toModerationQueueRow(s: YillikPlanSubmission): MebPlanModerationQueueRow {
    const author = s.author as User | null | undefined;
    return {
      id: s.id,
      status: s.status,
      subjectCode: s.subjectCode,
      subjectLabel: s.subjectLabel,
      grade: s.grade,
      section: s.section,
      academicYear: s.academicYear,
      tabloAltiNot: s.tabloAltiNot,
      weekCount: this.weekCountFromItemsJson(s.itemsJson),
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      updatedAt: s.updatedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      authorUserId: s.authorUserId,
      authorEmail: author?.email ?? null,
      authorDisplayName: author?.display_name?.trim() || null,
    };
  }

  async listPending(filters?: { q?: string; academic_year?: string }): Promise<MebPlanModerationQueueRow[]> {
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.author', 'author')
      .where('s.status = :st', { st: 'pending_review' });
    if (filters?.academic_year?.trim()) {
      qb.andWhere('s.academicYear = :ay', { ay: filters.academic_year.trim() });
    }
    if (filters?.q?.trim()) {
      const like = `%${filters.q.trim()}%`;
      qb.andWhere('(s.subjectLabel ILIKE :l OR s.subjectCode ILIKE :l OR author.email ILIKE :l OR author.display_name ILIKE :l)', {
        l: like,
      });
    }
    const rows = await qb.orderBy('s.submittedAt', 'ASC').addOrderBy('s.createdAt', 'ASC').take(200).getMany();
    return rows.map((s) => this.toModerationQueueRow(s));
  }

  async getModerationDashboard(): Promise<{ pending: number; published: number; rejected: number; withdrawn: number }> {
    const [pending, published, rejected, withdrawn] = await Promise.all([
      this.submissionRepo.count({ where: { status: 'pending_review' } }),
      this.submissionRepo.count({ where: { status: 'published' } }),
      this.submissionRepo.count({ where: { status: 'rejected' } }),
      this.submissionRepo.count({ where: { status: 'withdrawn' } }),
    ]);
    return { pending, published, rejected, withdrawn };
  }

  async listModerationHistory(
    limit = 30,
    filters?: { q?: string; academic_year?: string },
  ): Promise<MebPlanModerationHistoryRow[]> {
    const n = Math.min(100, Math.max(1, limit));
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.author', 'author')
      .leftJoinAndSelect('s.reviewer', 'reviewer')
      .where('s.status IN (:...st)', { st: ['published', 'rejected'] as const });
    if (filters?.academic_year?.trim()) {
      qb.andWhere('s.academicYear = :ay', { ay: filters.academic_year.trim() });
    }
    if (filters?.q?.trim()) {
      const like = `%${filters.q.trim()}%`;
      qb.andWhere('(s.subjectLabel ILIKE :l OR s.subjectCode ILIKE :l OR author.email ILIKE :l OR author.display_name ILIKE :l)', {
        l: like,
      });
    }
    const rows = await qb.orderBy('s.decidedAt', 'DESC', 'NULLS LAST').addOrderBy('s.updatedAt', 'DESC').take(n).getMany();
    return rows.map((s) => {
      const rev = s.reviewer as User | null | undefined;
      return {
        ...this.toModerationQueueRow(s),
        reviewerLabel: YillikPlanSubmissionService.reviewerLabel(rev),
        reviewNote: s.reviewNote,
        decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null,
        publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
      };
    });
  }

  async publish(id: string, reviewerUserId: string, body: { review_note?: string | null }): Promise<{ submission: YillikPlanSubmission; imported_weeks: number }> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.status !== 'pending_review') throw new ConflictException({ code: 'INVALID_STATE', message: 'Yalnızca incelemedeki kayıt yayınlanır.' });
    this.assertMebPlanSubject(s.subjectCode);
    const items = this.parseItemsJson(s.itemsJson);
    const created = await this.yillikPlanIcerikService.bulkCreate({
      subject_code: s.subjectCode,
      subject_label: s.subjectLabel,
      grade: s.grade,
      section: s.section ?? undefined,
      academic_year: s.academicYear,
      items: items.map((r) => ({
        week_order: Number(r.week_order),
        unite: (r.unite as string | undefined) ?? undefined,
        konu: (r.konu as string | undefined) ?? undefined,
        kazanimlar: (r.kazanimlar as string | undefined) ?? undefined,
        ders_saati: Number(r.ders_saati ?? 2),
        belirli_gun_haftalar: (r.belirli_gun_haftalar as string | undefined) ?? undefined,
        surec_bilesenleri: (r.surec_bilesenleri as string | undefined) ?? undefined,
        olcme_degerlendirme: (r.olcme_degerlendirme as string | undefined) ?? undefined,
        sosyal_duygusal: (r.sosyal_duygusal as string | undefined) ?? undefined,
        degerler: (r.degerler as string | undefined) ?? undefined,
        okuryazarlik_becerileri: (r.okuryazarlik_becerileri as string | undefined) ?? undefined,
        zenginlestirme: (r.zenginlestirme as string | undefined) ?? undefined,
        okul_temelli_planlama: (r.okul_temelli_planlama as string | undefined) ?? undefined,
      })),
    });
    if (s.tabloAltiNot?.trim()) {
      await this.yillikPlanIcerikService.upsertMeta(s.subjectCode, s.grade, s.academicYear, s.tabloAltiNot.trim());
    }
    const prev = s.status;
    s.status = 'published';
    s.reviewerUserId = reviewerUserId;
    s.reviewNote = body.review_note?.trim() || null;
    s.decidedAt = new Date();
    s.publishedAt = new Date();
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, reviewerUserId, prev, 'published', s.reviewNote);
    return { submission: saved, imported_weeks: created.length };
  }

  async reject(id: string, reviewerUserId: string, reviewNote?: string | null): Promise<YillikPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.status !== 'pending_review') throw new ConflictException({ code: 'INVALID_STATE', message: 'Yalnızca incelemedeki kayıt reddedilir.' });
    const prev = s.status;
    s.status = 'rejected';
    s.reviewerUserId = reviewerUserId;
    s.reviewNote = reviewNote?.trim() || null;
    s.decidedAt = new Date();
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, reviewerUserId, prev, 'rejected', s.reviewNote);
    return saved;
  }

  async unpublish(id: string, actorUserId: string, body: { note?: string | null }): Promise<YillikPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.status !== 'published') throw new ConflictException({ code: 'INVALID_STATE', message: 'Yalnızca yayındaki kayıt geri alınır.' });
    const prev = s.status;
    s.status = 'pending_review';
    s.publishedAt = null;
    s.decidedAt = null;
    s.reviewerUserId = null;
    s.reviewNote = null;
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, actorUserId, prev, 'pending_review', body.note?.trim() || null);
    return saved;
  }

  static reviewerLabel(u: User | null | undefined): string | null {
    if (!u) return null;
    return u.display_name?.trim() || u.email || null;
  }
}
