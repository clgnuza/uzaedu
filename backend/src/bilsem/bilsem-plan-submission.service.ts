import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BilsemPlanSubmission, BilsemPlanSubmissionStatus } from './entities/bilsem-plan-submission.entity';
import { BilsemPlanSubmissionEvent } from './entities/bilsem-plan-submission-event.entity';
import { CreateBilsemPlanSubmissionDto } from './dto/create-bilsem-plan-submission.dto';
import { UpdateBilsemPlanSubmissionDto } from './dto/update-bilsem-plan-submission.dto';
import { validateBilsemMergedPlanItems, YillikPlanIcerikService } from '../yillik-plan-icerik/yillik-plan-icerik.service';
import { DocumentCatalog } from '../document-templates/entities/document-catalog.entity';
import { User } from '../users/entities/user.entity';
import type { ParsedPlanRow } from '../meb/meb-fetch.service';
import { parsePlanPastePayload } from '../yillik-plan-icerik/plan-paste-parser';
import { BilsemPlanCreatorRewardService } from './bilsem-plan-creator-reward.service';
import { BilsemYillikPlanService } from './bilsem-yillik-plan.service';
import type {
  BilsemModerationDashboard,
  BilsemModerationHistoryRow,
  BilsemPlanAuthorSummary,
  BilsemModerationValidationResult,
  BilsemPlanSubmissionMineRow,
  BilsemPlanSubmissionModerationQueueRow,
} from './bilsem-plan-submission-list.types';

@Injectable()
export class BilsemPlanSubmissionService {
  constructor(
    @InjectRepository(BilsemPlanSubmission)
    private readonly submissionRepo: Repository<BilsemPlanSubmission>,
    @InjectRepository(BilsemPlanSubmissionEvent)
    private readonly eventRepo: Repository<BilsemPlanSubmissionEvent>,
    @InjectRepository(DocumentCatalog)
    private readonly catalogRepo: Repository<DocumentCatalog>,
    private readonly yillikPlanIcerikService: YillikPlanIcerikService,
    private readonly bilsemYillikPlanService: BilsemYillikPlanService,
    private readonly planCreatorReward: BilsemPlanCreatorRewardService,
  ) {}

  /** Superadmin’in BİLSEM ders kataloğu (yalnızca ana_grup tanımlı aktif dersler). */
  async listBilsemPlanDraftSubjects(): Promise<{
    items: { code: string; label: string; ana_grup: string }[];
  }> {
    const rows = await this.catalogRepo
      .createQueryBuilder('c')
      .where('c.category = :cat', { cat: 'subject' })
      .andWhere('c.is_active = true')
      .andWhere('c.ana_grup IS NOT NULL')
      .andWhere("TRIM(c.ana_grup) != ''")
      .orderBy('c.sort_order', 'ASC')
      .addOrderBy('c.label', 'ASC')
      .getMany();
    return {
      items: rows.map((c) => ({
        code: c.code,
        label: c.label,
        ana_grup: c.anaGrup!,
      })),
    };
  }

  private itemsJsonFromImportOrItems(dto: {
    items_import?: string;
    items?: CreateBilsemPlanSubmissionDto['items'];
  }): string {
    const imp = dto.items_import?.trim();
    if (imp) {
      const { rows } = parsePlanPastePayload(imp);
      if (!rows.length) {
        throw new BadRequestException({
          code: 'IMPORT_NO_ROWS',
          message: 'İçe aktarımdan geçerli hafta satırı çıkmadı (week_order 1–38, başlık satırı gerekir).',
        });
      }
      const itemsJson = JSON.stringify(rows);
      this.parseItemsJson(itemsJson);
      return itemsJson;
    }
    if (dto.items?.length) {
      const itemsJson = JSON.stringify(dto.items);
      this.parseItemsJson(itemsJson);
      return itemsJson;
    }
    throw new BadRequestException({
      code: 'ITEMS_REQUIRED',
      message: '"items" dizisi veya "items_import" (JSON dizi / UTF-8 CSV metni) zorunludur.',
    });
  }

  private parseItemsJson(itemsJson: string): ParsedPlanRow[] {
    let data: unknown;
    try {
      data = JSON.parse(itemsJson);
    } catch {
      throw new BadRequestException({ code: 'INVALID_JSON', message: 'items_json geçersiz JSON.' });
    }
    if (!Array.isArray(data) || data.length === 0) {
      throw new BadRequestException({ code: 'ITEMS_EMPTY', message: 'En az bir hafta verisi gerekir.' });
    }
    const out: ParsedPlanRow[] = [];
    for (const el of data) {
      if (!el || typeof el !== 'object') continue;
      const o = el as Record<string, unknown>;
      const wo = Number(o.week_order ?? o.weekOrder ?? o.hafta);
      if (!Number.isFinite(wo) || wo < 1 || wo > 38) continue;
      const ders = Number(o.ders_saati ?? o.dersSaati ?? 2);
      out.push({
        week_order: Math.round(wo),
        unite: o.unite != null ? String(o.unite) : null,
        konu: o.konu != null ? String(o.konu) : null,
        kazanimlar:
          o.kazanimlar != null
            ? String(o.kazanimlar)
            : o.ogrenme_ciktilari != null
              ? String(o.ogrenme_ciktilari)
              : null,
        ders_saati: Number.isFinite(ders) && ders >= 0 ? Math.round(ders) : 2,
        belirli_gun_haftalar: o.belirli_gun_haftalar != null ? String(o.belirli_gun_haftalar) : null,
        surec_bilesenleri: o.surec_bilesenleri != null ? String(o.surec_bilesenleri) : null,
        olcme_degerlendirme: o.olcme_degerlendirme != null ? String(o.olcme_degerlendirme) : null,
        sosyal_duygusal: o.sosyal_duygusal != null ? String(o.sosyal_duygusal) : null,
        degerler: o.degerler != null ? String(o.degerler) : null,
        okuryazarlik_becerileri: o.okuryazarlik_becerileri != null ? String(o.okuryazarlik_becerileri) : null,
        zenginlestirme: o.zenginlestirme != null ? String(o.zenginlestirme) : null,
        okul_temelli_planlama: o.okul_temelli_planlama != null ? String(o.okul_temelli_planlama) : null,
      });
    }
    if (out.length === 0) {
      throw new BadRequestException({
        code: 'ITEMS_INVALID',
        message: 'Geçerli week_order (1–38 öğretim haftası) içeren satır yok. Tatil satırları kayda alınmaz.',
      });
    }
    return out;
  }

  private static badRequestMessage(e: unknown): string {
    if (e instanceof BadRequestException) {
      const r = e.getResponse();
      if (typeof r === 'object' && r && 'message' in r) {
        const m = (r as { message?: string | string[] }).message;
        if (Array.isArray(m)) return m.join(' ');
        if (typeof m === 'string') return m;
      }
    }
    return e instanceof Error ? e.message : String(e);
  }

  private parsedPlanRowsToBulkItems(
    parsed: ParsedPlanRow[],
  ): Array<{
    week_order: number;
    unite?: string;
    konu?: string;
    kazanimlar?: string;
    ders_saati?: number;
    belirli_gun_haftalar?: string;
    surec_bilesenleri?: string;
    olcme_degerlendirme?: string;
    sosyal_duygusal?: string;
    degerler?: string;
    okuryazarlik_becerileri?: string;
    zenginlestirme?: string;
    okul_temelli_planlama?: string;
  }> {
    return parsed.map((r) => ({
      week_order: r.week_order,
      unite: r.unite ?? undefined,
      konu: r.konu ?? undefined,
      kazanimlar: r.kazanimlar ?? undefined,
      ders_saati: r.ders_saati,
      belirli_gun_haftalar: r.belirli_gun_haftalar ?? undefined,
      surec_bilesenleri: r.surec_bilesenleri ?? undefined,
      olcme_degerlendirme: r.olcme_degerlendirme ?? undefined,
      sosyal_duygusal: r.sosyal_duygusal ?? undefined,
      degerler: r.degerler ?? undefined,
      okuryazarlik_becerileri: r.okuryazarlik_becerileri ?? undefined,
      zenginlestirme: r.zenginlestirme ?? undefined,
      okul_temelli_planlama: r.okul_temelli_planlama ?? undefined,
    }));
  }

  /** Katalog + items_json (yıllık plan içe aktarma kuralları) — yayın öncesi. */
  async buildValidationForPublish(s: BilsemPlanSubmission): Promise<BilsemModerationValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let parsed: ParsedPlanRow[] = [];
    try {
      parsed = this.parseItemsJson(s.itemsJson);
    } catch (e) {
      errors.push(BilsemPlanSubmissionService.badRequestMessage(e));
      return { ok: false, errors, warnings, catalogMatch: false };
    }
    const bulk = this.parsedPlanRowsToBulkItems(parsed);
    const v = validateBilsemMergedPlanItems(bulk, {
      ana_grup: s.anaGrup,
      plan_grade: s.planGrade,
    });
    errors.push(...v.errors);
    warnings.push(...v.warnings);
    const { items: catItems } = await this.listBilsemPlanDraftSubjects();
    const catalogMatch = catItems.some(
      (c) =>
        c.code.trim() === s.subjectCode.trim() &&
        c.ana_grup.trim().toLowerCase() === s.anaGrup.trim().toLowerCase(),
    );
    if (!catalogMatch) {
      errors.push('Ders kodu ve ana grup BİLSEM ders kataloğunda eşleşmiyor (güncel kataloga bakın).');
    }
    return { ok: errors.length === 0, errors, warnings, catalogMatch };
  }

  async validateForModeration(id: string): Promise<BilsemModerationValidationResult> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    }
    return this.buildValidationForPublish(s);
  }

  private weekCountFromItemsJson(raw: string): number {
    try {
      const j = JSON.parse(raw) as unknown;
      if (!Array.isArray(j)) return 0;
      return j.filter((el) => {
        if (!el || typeof el !== 'object') return false;
        const o = el as Record<string, unknown>;
        const wo = Number(o.week_order ?? o.weekOrder ?? o.hafta);
        return Number.isFinite(wo) && wo >= 1 && wo <= 38;
      }).length;
    } catch {
      return 0;
    }
  }

  private toMineRow(s: BilsemPlanSubmission): BilsemPlanSubmissionMineRow {
    return {
      id: s.id,
      status: s.status,
      subjectCode: s.subjectCode,
      subjectLabel: s.subjectLabel,
      anaGrup: s.anaGrup,
      altGrup: s.altGrup,
      academicYear: s.academicYear,
      planGrade: s.planGrade,
      weekCount: this.weekCountFromItemsJson(s.itemsJson),
      submittedAt: s.submittedAt ? s.submittedAt.toISOString() : null,
      decidedAt: s.decidedAt ? s.decidedAt.toISOString() : null,
      publishedAt: s.publishedAt ? s.publishedAt.toISOString() : null,
      rewardJetonPerGeneration:
        s.status === 'published' ? String(s.rewardJetonPerGeneration ?? '0.25') : null,
      updatedAt: s.updatedAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
    };
  }

  private static reviewerLabel(u: User | null | undefined): string | null {
    if (!u) return null;
    return u.display_name?.trim() || u.email || null;
  }

  private async appendEvent(
    submissionId: string,
    actorUserId: string,
    from: BilsemPlanSubmissionStatus | null,
    to: BilsemPlanSubmissionStatus,
    note?: string | null,
  ): Promise<void> {
    await this.eventRepo.save(
      this.eventRepo.create({
        submissionId,
        actorUserId,
        fromStatus: from,
        toStatus: to,
        note: note?.trim() || null,
      }),
    );
  }

  async createDraft(
    authorUserId: string,
    schoolId: string | null,
    dto: CreateBilsemPlanSubmissionDto,
  ): Promise<BilsemPlanSubmission> {
    const itemsJson = this.itemsJsonFromImportOrItems(dto);
    const row = this.submissionRepo.create({
      authorUserId,
      schoolId,
      status: 'draft',
      subjectCode: dto.subject_code.trim(),
      subjectLabel: dto.subject_label.trim(),
      anaGrup: dto.ana_grup.trim(),
      altGrup: dto.alt_grup?.trim() ? dto.alt_grup.trim() : null,
      academicYear: dto.academic_year.trim(),
      planGrade: dto.plan_grade != null ? dto.plan_grade : null,
      tabloAltiNot: dto.tablo_alti_not?.trim() || null,
      itemsJson,
      rewardJetonPerGeneration: '0.25',
    });
    const saved = await this.submissionRepo.save(row);
    await this.appendEvent(saved.id, authorUserId, null, 'draft', null);
    return saved;
  }

  async updateDraft(
    id: string,
    authorUserId: string,
    dto: UpdateBilsemPlanSubmissionDto,
  ): Promise<BilsemPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.authorUserId !== authorUserId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece yazar düzenleyebilir.' });
    }
    if (s.status !== 'draft') {
      throw new ConflictException({ code: 'NOT_DRAFT', message: 'Yalnızca taslak düzenlenebilir.' });
    }
    if (dto.subject_label !== undefined) s.subjectLabel = dto.subject_label.trim();
    if (dto.ana_grup !== undefined) s.anaGrup = dto.ana_grup.trim();
    if (dto.alt_grup !== undefined) s.altGrup = dto.alt_grup?.trim() ? dto.alt_grup.trim() : null;
    if (dto.academic_year !== undefined) s.academicYear = dto.academic_year.trim();
    if (dto.tablo_alti_not !== undefined) s.tabloAltiNot = dto.tablo_alti_not?.trim() || null;
    if (dto.items_import !== undefined && dto.items_import.trim()) {
      s.itemsJson = this.itemsJsonFromImportOrItems({
        items_import: dto.items_import,
        items: undefined,
      });
    } else if (dto.items !== undefined) {
      const itemsJson = JSON.stringify(dto.items);
      this.parseItemsJson(itemsJson);
      s.itemsJson = itemsJson;
    }
    return this.submissionRepo.save(s);
  }

  async submit(id: string, authorUserId: string): Promise<BilsemPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.authorUserId !== authorUserId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece yazar gönderebilir.' });
    }
    if (s.status !== 'draft') {
      throw new ConflictException({ code: 'INVALID_STATE', message: 'Yalnızca taslak incelemeye gönderilebilir.' });
    }
    this.parseItemsJson(s.itemsJson);
    const prev = s.status;
    s.status = 'pending_review';
    s.submittedAt = new Date();
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, authorUserId, prev, 'pending_review', null);
    return saved;
  }

  async withdraw(id: string, authorUserId: string): Promise<BilsemPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.authorUserId !== authorUserId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Sadece yazar geri çekebilir.' });
    }
    if (s.status !== 'draft' && s.status !== 'pending_review') {
      throw new ConflictException({ code: 'INVALID_STATE', message: 'Bu durumda geri çekilemez.' });
    }
    const prev = s.status;
    s.status = 'withdrawn';
    s.decidedAt = new Date();
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, authorUserId, prev, 'withdrawn', null);
    return saved;
  }

  async listMine(authorUserId: string): Promise<BilsemPlanSubmissionMineRow[]> {
    const rows = await this.submissionRepo.find({
      where: { authorUserId },
      order: { updatedAt: 'DESC' },
      take: 100,
    });
    return rows.map((s) => this.toMineRow(s));
  }

  async listPending(filters?: {
    academic_year?: string;
    ana_grup?: string;
    q?: string;
  }): Promise<BilsemPlanSubmissionModerationQueueRow[]> {
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.author', 'author')
      .where('s.status = :st', { st: 'pending_review' });
    if (filters?.academic_year?.trim()) {
      qb.andWhere('s.academicYear = :ay', { ay: filters.academic_year.trim() });
    }
    if (filters?.ana_grup?.trim()) {
      qb.andWhere('s.anaGrup = :ana', { ana: filters.ana_grup.trim() });
    }
    if (filters?.q?.trim()) {
      const l = `%${filters.q.trim()}%`;
      qb.andWhere('(s.subjectLabel ILIKE :l OR s.subjectCode ILIKE :l OR author.email ILIKE :l OR author.display_name ILIKE :l)', {
        l,
      });
    }
    qb.orderBy('s.submittedAt', 'ASC').addOrderBy('s.createdAt', 'ASC').take(200);
    const rows = await qb.getMany();
    return rows.map((s) => ({
      ...this.toMineRow(s),
      authorUserId: s.authorUserId,
      authorEmail: s.author?.email ?? null,
      authorDisplayName: s.author ? (s.author as User).display_name ?? null : null,
    }));
  }

  async getOne(id: string, viewerUserId: string, role: string): Promise<BilsemPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id }, relations: ['author'] });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    const isMod = role === 'superadmin' || role === 'moderator';
    if (!isMod && s.authorUserId !== viewerUserId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu kayda erişemezsiniz.' });
    }
    return s;
  }

  async publish(
    id: string,
    reviewerUserId: string,
    body: { reward_jeton_per_generation?: number; review_note?: string | null },
  ): Promise<{ submission: BilsemPlanSubmission; imported_weeks: number }> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.status !== 'pending_review') {
      throw new ConflictException({ code: 'INVALID_STATE', message: 'Yalnızca incelemedeki gönderimler yayınlanır.' });
    }
    const check = await this.buildValidationForPublish(s);
    if (!check.ok) {
      throw new BadRequestException({
        code: 'PUBLISH_VALIDATION_FAILED',
        message: check.errors[0] ?? 'Yayın öncesi doğrulama başarısız.',
        errors: check.errors,
        warnings: check.warnings,
      });
    }
    const items = this.parseItemsJson(s.itemsJson);
    const reward =
      body.reward_jeton_per_generation != null && Number.isFinite(body.reward_jeton_per_generation)
        ? Math.min(50, Math.max(0, body.reward_jeton_per_generation))
        : Number.parseFloat(String(s.rewardJetonPerGeneration ?? '0.25')) || 0.25;

    const rows = await this.yillikPlanIcerikService.bulkCreate({
      subject_code: s.subjectCode,
      subject_label: s.subjectLabel,
      grade: null,
      plan_grade: s.planGrade,
      academic_year: s.academicYear,
      curriculum_model: 'bilsem',
      ana_grup: s.anaGrup,
      alt_grup: s.altGrup ?? undefined,
      submission_id: s.id,
      items: items.map((r) => ({
        week_order: r.week_order,
        unite: r.unite ?? undefined,
        konu: r.konu ?? undefined,
        kazanimlar: r.kazanimlar ?? undefined,
        ders_saati: r.ders_saati,
        belirli_gun_haftalar: r.belirli_gun_haftalar ?? undefined,
        surec_bilesenleri: r.surec_bilesenleri ?? undefined,
        olcme_degerlendirme: r.olcme_degerlendirme ?? undefined,
        sosyal_duygusal: r.sosyal_duygusal ?? undefined,
        degerler: r.degerler ?? undefined,
        okuryazarlik_becerileri: r.okuryazarlik_becerileri ?? undefined,
        zenginlestirme: r.zenginlestirme ?? undefined,
        okul_temelli_planlama: r.okul_temelli_planlama ?? undefined,
      })),
    });
    if (s.tabloAltiNot?.trim()) {
      await this.yillikPlanIcerikService.upsertMeta(
        s.subjectCode,
        s.anaGrup,
        s.academicYear,
        s.tabloAltiNot.trim(),
        'bilsem',
        s.altGrup ?? null,
      );
    }
    await this.bilsemYillikPlanService.replaceOutcomeSetFromBilsemPlan({
      subject_code: s.subjectCode,
      subject_label: s.subjectLabel,
      academic_year: s.academicYear,
      ana_grup: s.anaGrup,
      items: rows.map((r) => ({
        week_order: r.weekOrder,
        unite: r.unite,
        konu: r.konu,
        kazanimlar: r.kazanimlar,
        ders_saati: r.dersSaati,
        surec_bilesenleri: r.surecBilesenleri,
        olcme_degerlendirme: r.olcmeDegerlendirme,
        sosyal_duygusal: r.sosyalDuygusal,
        degerler: r.degerler,
        okuryazarlik_becerileri: r.okuryazarlikBecerileri,
        belirli_gun_haftalar: r.belirliGunHaftalar,
        zenginlestirme: r.zenginlestirme,
        okul_temelli_planlama: r.okulTemelliPlanlama,
      })),
    });
    const prev = s.status;
    s.status = 'published';
    s.reviewerUserId = reviewerUserId;
    s.reviewNote = body.review_note?.trim() || null;
    s.decidedAt = new Date();
    s.publishedAt = new Date();
    s.rewardJetonPerGeneration = String(reward);
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, reviewerUserId, prev, 'published', s.reviewNote);
    return { submission: saved, imported_weeks: rows.length };
  }

  async unpublish(
    id: string,
    actorUserId: string,
    body: { note?: string | null },
  ): Promise<{ submission: BilsemPlanSubmission; removed_rows: number }> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.status !== 'published') {
      throw new ConflictException({ code: 'INVALID_STATE', message: 'Yalnızca yayındaki plan yayından kaldırılabilir.' });
    }
    const removed = await this.yillikPlanIcerikService.deleteBilsemRowsBySubmissionId(s.id);
    const tablo = s.tabloAltiNot?.trim() || null;
    if (tablo) {
      const current = await this.yillikPlanIcerikService.getMeta(
        s.subjectCode,
        s.anaGrup,
        s.academicYear,
        'bilsem',
        s.altGrup ?? null,
      );
      if (current != null && current.trim() === tablo) {
        await this.yillikPlanIcerikService.upsertMeta(
          s.subjectCode,
          s.anaGrup,
          s.academicYear,
          null,
          'bilsem',
          s.altGrup ?? null,
        );
      }
    }
    const prev = s.status;
    s.status = 'pending_review';
    s.publishedAt = null;
    s.decidedAt = null;
    s.reviewerUserId = null;
    s.reviewNote = null;
    const note = body.note?.trim() || null;
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, actorUserId, prev, 'pending_review', note);
    return { submission: saved, removed_rows: removed };
  }

  async reject(id: string, reviewerUserId: string, reviewNote?: string | null): Promise<BilsemPlanSubmission> {
    const s = await this.submissionRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Gönderim bulunamadı.' });
    if (s.status !== 'pending_review') {
      throw new ConflictException({ code: 'INVALID_STATE', message: 'Yalnızca incelemedeki gönderimler reddedilir.' });
    }
    const prev = s.status;
    s.status = 'rejected';
    s.reviewerUserId = reviewerUserId;
    s.reviewNote = reviewNote?.trim() || null;
    s.decidedAt = new Date();
    const saved = await this.submissionRepo.save(s);
    await this.appendEvent(saved.id, reviewerUserId, prev, 'rejected', s.reviewNote);
    return saved;
  }

  async getAuthorSummary(authorUserId: string): Promise<BilsemPlanAuthorSummary> {
    const [draft, pending, published, rejected, withdrawn, reward] = await Promise.all([
      this.submissionRepo.count({ where: { authorUserId, status: 'draft' } }),
      this.submissionRepo.count({ where: { authorUserId, status: 'pending_review' } }),
      this.submissionRepo.count({ where: { authorUserId, status: 'published' } }),
      this.submissionRepo.count({ where: { authorUserId, status: 'rejected' } }),
      this.submissionRepo.count({ where: { authorUserId, status: 'withdrawn' } }),
      this.planCreatorReward.getCreatorRewardSummary(authorUserId),
    ]);
    return {
      counts: { draft, pending_review: pending, published, rejected, withdrawn },
      planWordUsageCount: reward.planWordUsageCount,
      totalJetonCredited: reward.totalJetonCredited,
      bySubmission: reward.bySubmission,
    };
  }

  async getModerationDashboard(): Promise<BilsemModerationDashboard> {
    const [pending, published, rejected, withdrawn] = await Promise.all([
      this.submissionRepo.count({ where: { status: 'pending_review' } }),
      this.submissionRepo.count({ where: { status: 'published' } }),
      this.submissionRepo.count({ where: { status: 'rejected' } }),
      this.submissionRepo.count({ where: { status: 'withdrawn' } }),
    ]);
    return { pending, published, rejected, withdrawn };
  }

  async listModerationHistory(
    rawLimit?: number,
    filters?: { academic_year?: string; ana_grup?: string; q?: string },
  ): Promise<BilsemModerationHistoryRow[]> {
    const limit = Math.min(100, Math.max(1, rawLimit ?? 30));
    const qb = this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.author', 'author')
      .leftJoinAndSelect('s.reviewer', 'reviewer')
      .where('s.status IN (:...st)', { st: ['published', 'rejected'] as const });
    if (filters?.academic_year?.trim()) {
      qb.andWhere('s.academicYear = :ay', { ay: filters.academic_year.trim() });
    }
    if (filters?.ana_grup?.trim()) {
      qb.andWhere('s.anaGrup = :ana', { ana: filters.ana_grup.trim() });
    }
    if (filters?.q?.trim()) {
      const l = `%${filters.q.trim()}%`;
      qb.andWhere('(s.subjectLabel ILIKE :l OR s.subjectCode ILIKE :l OR author.email ILIKE :l OR author.display_name ILIKE :l)', {
        l,
      });
    }
    qb.orderBy('s.decidedAt', 'DESC', 'NULLS LAST').addOrderBy('s.updatedAt', 'DESC').take(limit);
    const rows = await qb.getMany();
    return rows.map((s) => {
      const rev = s.reviewer as User | null | undefined;
      return {
        ...this.toMineRow(s),
        authorUserId: s.authorUserId,
        authorEmail: s.author?.email ?? null,
        authorDisplayName: s.author ? s.author.display_name?.trim() || null : null,
        reviewerUserId: s.reviewerUserId,
        reviewerLabel: BilsemPlanSubmissionService.reviewerLabel(rev),
      };
    });
  }

  async getSubmissionUsageForAuthor(
    submissionId: string,
    authorUserId: string,
  ): Promise<{ usageCount: number; totalJeton: string } | null> {
    return this.planCreatorReward.getUsageForPublishedSubmission(submissionId, authorUserId);
  }
}
