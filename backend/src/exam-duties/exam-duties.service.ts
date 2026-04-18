import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, SelectQueryBuilder } from 'typeorm';
import { ExamDuty } from './entities/exam-duty.entity';
import { ExamDutyPreference } from './entities/exam-duty-preference.entity';
import { ExamDutyNotificationLog } from './entities/exam-duty-notification-log.entity';
import { ExamDutyAssignment } from './entities/exam-duty-assignment.entity';
import { User } from '../users/entities/user.entity';
import { NotificationPreference } from '../notifications/entities/notification-preference.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateExamDutyDto } from './dto/create-exam-duty.dto';
import { UpdateExamDutyDto } from './dto/update-exam-duty.dto';
import { ListExamDutiesDto } from './dto/list-exam-duties.dto';
import { UserRole, UserStatus } from '../types/enums';
import { paginate } from '../common/dtos/pagination.dto';
import type { ExamDutyNotificationReason } from './entities/exam-duty-notification-log.entity';

const EVENT_MAP: Record<ExamDutyNotificationReason, string> = {
  publish_now: 'exam_duty.open',
  apply_start: 'exam_duty.open',
  deadline: 'exam_duty.lastday',
  approval_day: 'exam_duty.approval_day',
  exam_minus_1d: 'exam_duty.examday',
  exam_plus_1d: 'exam_duty.reminder',
  exam_day_morning: 'exam_duty.exam_day_morning',
};

/** pref_exam_day_morning_time null/boş: eşleşecek varsayılan saat (Türkiye HH:mm) */
const DEFAULT_EXAM_DAY_MORNING_TIME = '07:00';

@Injectable()
export class ExamDutiesService {
  constructor(
    @InjectRepository(ExamDuty)
    private readonly examDutyRepo: Repository<ExamDuty>,
    @InjectRepository(ExamDutyPreference)
    private readonly prefRepo: Repository<ExamDutyPreference>,
    @InjectRepository(ExamDutyNotificationLog)
    private readonly logRepo: Repository<ExamDutyNotificationLog>,
    @InjectRepository(ExamDutyAssignment)
    private readonly assignmentRepo: Repository<ExamDutyAssignment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(NotificationPreference)
    private readonly notifPrefRepo: Repository<NotificationPreference>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Liste filtresi (sayfalama / sıralama hariç) */
  private buildExamDutyListQuery(
    dto: ListExamDutiesDto,
    isAdmin: boolean,
  ): SelectQueryBuilder<ExamDuty> {
    const qb = this.examDutyRepo.createQueryBuilder('e').where('e.deleted_at IS NULL');

    if (!isAdmin) {
      qb.andWhere('e.status = :status', { status: 'published' });
    } else if (dto.status) {
      qb.andWhere('e.status = :status', { status: dto.status });
    }

    if (dto.category_slug) {
      qb.andWhere('e.category_slug = :cat', { cat: dto.category_slug });
    }

    if (isAdmin && dto.missing_source_dates === true) {
      qb.andWhere('e.source_key IS NOT NULL');
      qb.andWhere('e.application_end IS NULL');
      qb.andWhere('e.exam_date IS NULL');
      qb.andWhere('e.exam_date_end IS NULL');
    }

    if (isAdmin && dto.missing_exam_date === true) {
      qb.andWhere('e.exam_date IS NULL');
      qb.andWhere('e.exam_date_end IS NULL');
    }

    if (isAdmin && dto.has_exam_date === true) {
      qb.andWhere('(e.exam_date IS NOT NULL OR e.exam_date_end IS NOT NULL)');
    }

    const hidePast = dto.hide_past !== false;
    if (hidePast) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      cutoff.setHours(0, 0, 0, 0);
      qb.andWhere('(e.exam_date_end IS NULL OR e.exam_date_end >= :cutoff)', { cutoff });
    }

    return qb;
  }

  /** Admin Liste sekmesi (has_exam_date) ile aynı: en az bir sınav tarihi */
  private isListTabEligible(examDuty: ExamDuty): boolean {
    return examDuty.examDate != null || examDuty.examDateEnd != null;
  }

  /** Admin: mevcut liste filtresiyle taslak / yayında sayıları */
  private async adminListStatusCounts(dto: ListExamDutiesDto): Promise<{
    draft_count: number;
    published_count: number;
  }> {
    const draftQb = this.buildExamDutyListQuery(dto, true);
    draftQb.andWhere('e.status = :st', { st: 'draft' });
    const publishedQb = this.buildExamDutyListQuery(dto, true);
    publishedQb.andWhere('e.status = :st', { st: 'published' });
    const [draft_count, published_count] = await Promise.all([
      draftQb.getCount(),
      publishedQb.getCount(),
    ]);
    return { draft_count, published_count };
  }

  /** Teacher: sadece published. Admin: tümü. */
  async list(dto: ListExamDutiesDto, isAdmin: boolean) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const qb = this.buildExamDutyListQuery(dto, isAdmin);
    qb.orderBy('e.created_at', 'DESC').skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    const base = paginate(items, total, page, limit);
    if (isAdmin) {
      const counts = await this.adminListStatusCounts(dto);
      return { ...base, ...counts };
    }
    return base;
  }

  async findById(id: string, isAdmin: boolean): Promise<ExamDuty> {
    const item = await this.examDutyRepo.findOne({ where: { id } });
    if (!item || item.deletedAt) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    if (!isAdmin && item.status !== 'published') {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    return item;
  }

  /** Öğretmen: bu sınavda görev çıktığını işaretler; sınav günü sabah hatırlatması alır. preferredExamDate: çok günlü sınavda sadece o güne bildirim. */
  async assignMe(
    examDutyId: string,
    userId: string,
    preferredExamDate: string | null,
  ): Promise<{ assigned: boolean }> {
    const duty = await this.examDutyRepo.findOne({ where: { id: examDutyId } });
    if (!duty || duty.deletedAt) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    if (duty.status !== 'published') {
      throw new BadRequestException({ code: 'NOT_PUBLISHED', message: 'Sadece yayınlanmış duyurular için görev çıktı işaretlenebilir.' });
    }
    const existing = await this.assignmentRepo.findOne({ where: { examDutyId, userId } });
    const prefDate = preferredExamDate ? new Date(preferredExamDate) : null;
    if (existing) {
      existing.preferredExamDate = prefDate;
      await this.assignmentRepo.save(existing);
      return { assigned: true };
    }
    await this.assignmentRepo.save(
      this.assignmentRepo.create({ examDutyId, userId, preferredExamDate: prefDate }),
    );
    return { assigned: true };
  }

  /** Öğretmenin bu sınavda görev çıktı olarak işaretlenmiş mi */
  async isAssigned(examDutyId: string, userId: string): Promise<boolean> {
    const one = await this.assignmentRepo.findOne({ where: { examDutyId, userId } });
    return !!one;
  }

  /** Öğretmen: görev çıktı işaretini geri alır; sınav günü sabah hatırlatması almayacak. */
  async unassignMe(examDutyId: string, userId: string): Promise<{ unassigned: boolean }> {
    const duty = await this.examDutyRepo.findOne({ where: { id: examDutyId } });
    if (!duty || duty.deletedAt) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    const existing = await this.assignmentRepo.findOne({ where: { examDutyId, userId } });
    if (!existing) return { unassigned: true }; // Zaten atanmamışsa işlem yok
    await this.assignmentRepo.remove(existing);
    return { unassigned: true };
  }

  /** Öğretmenin görev çıktı işaretlediği sınav id listesi (liste sayfası için) */
  async getMyAssignedExamDutyIds(userId: string): Promise<string[]> {
    const rows = await this.assignmentRepo.find({
      where: { userId },
      select: ['examDutyId'],
    });
    return rows.map((r) => r.examDutyId);
  }

  /** Öğretmenin atamaları, preferred_exam_date dahil (frontend tercih göstermek için) */
  async getMyAssignments(userId: string): Promise<{
    exam_duty_ids: string[];
    assignments: Array<{ exam_duty_id: string; preferred_exam_date: string | null }>;
  }> {
    const rows = await this.assignmentRepo.find({
      where: { userId },
      select: ['examDutyId', 'preferredExamDate'],
    });
    const ids = rows.map((r) => r.examDutyId);
    const assignments = rows.map((r) => {
      let prefStr: string | null = null;
      if (r.preferredExamDate) {
        const d = r.preferredExamDate instanceof Date ? r.preferredExamDate : new Date(r.preferredExamDate);
        prefStr = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
      }
      return { exam_duty_id: r.examDutyId, preferred_exam_date: prefStr };
    });
    return { exam_duty_ids: ids, assignments };
  }

  /** Öğretmenin atandığı sınav görevleri – takvim aralığında exam_date ile (ajanda entegrasyonu). */
  async getMyExamDutiesInRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<Array<{ id: string; title: string; examDate: Date | null; examDateEnd: Date | null }>> {
    const rows = await this.assignmentRepo.find({
      where: { userId },
      select: ['examDutyId'],
    });
    const ids = rows.map((r) => r.examDutyId);
    if (ids.length === 0) return [];
    const duties = await this.examDutyRepo.find({
      where: { id: In(ids), status: 'published', deletedAt: IsNull() },
      select: ['id', 'title', 'examDate', 'examDateEnd'],
    });
    const start = new Date(startDate);
    const end = new Date(endDate);
    return duties.filter((d) => {
      const d1 = d.examDate ?? d.examDateEnd;
      const d2 = d.examDateEnd ?? d.examDate;
      if (!d1) return false;
      return d1 <= end && (!d2 || d2 >= start);
    });
  }

  /** Superadmin: yeni duyuru oluştur */
  async create(dto: CreateExamDutyDto, userId: string): Promise<ExamDuty> {
    const entity = this.examDutyRepo.create({
      title: dto.title,
      categorySlug: dto.category_slug,
      summary: dto.summary ?? null,
      body: dto.body ?? null,
      sourceUrl: dto.source_url ?? null,
      applicationUrl: dto.application_url ?? null,
      applicationStart: dto.application_start ? new Date(dto.application_start) : null,
      applicationEnd: dto.application_end ? new Date(dto.application_end) : null,
      applicationApprovalEnd: dto.application_approval_end ? new Date(dto.application_approval_end) : null,
      resultDate: dto.result_date ? new Date(dto.result_date) : null,
      examDate: dto.exam_date ? new Date(dto.exam_date) : null,
      examDateEnd: dto.exam_date_end ? new Date(dto.exam_date_end) : null,
      status: 'draft',
      createdByUserId: userId,
    });
    return this.examDutyRepo.save(entity);
  }

  /** Tarih sırası: application_start <= application_end < exam_date <= exam_date_end */
  private validateDateOrder(item: ExamDuty): void {
    const a = (d: Date | null) => d?.getTime() ?? 0;
    if (item.applicationStart && item.applicationEnd && a(item.applicationEnd) < a(item.applicationStart)) {
      throw new BadRequestException({ code: 'DATE_ORDER', message: 'Son başvuru, başvuru açılıştan önce olamaz.' });
    }
    if (item.applicationEnd && (item.examDate ?? item.examDateEnd)) {
      const exam = item.examDate ?? item.examDateEnd!;
      if (a(item.applicationEnd) >= a(exam)) {
        throw new BadRequestException({ code: 'DATE_ORDER', message: 'Son başvuru, sınav tarihinden önce olmalı.' });
      }
    }
    if (item.examDate && item.examDateEnd && a(item.examDate) > a(item.examDateEnd)) {
      throw new BadRequestException({ code: 'DATE_ORDER', message: 'İlk sınav, son sınavdan sonra olamaz.' });
    }
  }

  /** Superadmin: güncelle */
  async update(id: string, dto: UpdateExamDutyDto): Promise<ExamDuty> {
    const item = await this.examDutyRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    if (item.status === 'published') {
      if (dto.title != null) item.title = dto.title;
      if (dto.summary !== undefined) item.summary = dto.summary;
      if (dto.body !== undefined) item.body = dto.body;
      if (dto.source_url !== undefined) item.sourceUrl = dto.source_url;
      if (dto.application_url !== undefined) item.applicationUrl = dto.application_url;
      if (dto.application_start !== undefined) item.applicationStart = dto.application_start ? new Date(dto.application_start) : null;
      if (dto.application_end !== undefined) item.applicationEnd = dto.application_end ? new Date(dto.application_end) : null;
      if (dto.application_approval_end !== undefined) item.applicationApprovalEnd = dto.application_approval_end ? new Date(dto.application_approval_end) : null;
      if (dto.result_date !== undefined) item.resultDate = dto.result_date ? new Date(dto.result_date) : null;
      if (dto.exam_date !== undefined) item.examDate = dto.exam_date ? new Date(dto.exam_date) : null;
      if (dto.exam_date_end !== undefined) item.examDateEnd = dto.exam_date_end ? new Date(dto.exam_date_end) : null;
    } else {
      if (dto.title != null) item.title = dto.title;
      if (dto.category_slug != null) item.categorySlug = dto.category_slug;
      if (dto.summary !== undefined) item.summary = dto.summary;
      if (dto.body !== undefined) item.body = dto.body;
      if (dto.source_url !== undefined) item.sourceUrl = dto.source_url;
      if (dto.application_url !== undefined) item.applicationUrl = dto.application_url;
      if (dto.application_start !== undefined) item.applicationStart = dto.application_start ? new Date(dto.application_start) : null;
      if (dto.application_end !== undefined) item.applicationEnd = dto.application_end ? new Date(dto.application_end) : null;
      if (dto.application_approval_end !== undefined) item.applicationApprovalEnd = dto.application_approval_end ? new Date(dto.application_approval_end) : null;
      if (dto.result_date !== undefined) item.resultDate = dto.result_date ? new Date(dto.result_date) : null;
      if (dto.exam_date !== undefined) item.examDate = dto.exam_date ? new Date(dto.exam_date) : null;
      if (dto.exam_date_end !== undefined) item.examDateEnd = dto.exam_date_end ? new Date(dto.exam_date_end) : null;
    }
    this.validateDateOrder(item);
    return this.examDutyRepo.save(item);
  }

  /** Superadmin: sil (soft delete) */
  async remove(id: string): Promise<void> {
    const item = await this.examDutyRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    item.deletedAt = new Date();
    await this.examDutyRepo.save(item);
  }

  /** Hedef kitle sayısı (publish_now için). Yayınlamadan önce önizleme. */
  async getTargetCount(id: string): Promise<{ count: number }> {
    const item = await this.examDutyRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    if (!this.isListTabEligible(item)) return { count: 0 };
    const ids = await this.getTargetUserIds(item, 'publish_now');
    return { count: ids.length };
  }

  /** Superadmin: taslak → yayın. publish_now bildirimi planlanır. */
  async publish(id: string): Promise<ExamDuty> {
    const item = await this.examDutyRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    if (item.status === 'published') {
      throw new BadRequestException({ code: 'ALREADY_PUBLISHED', message: 'Bu duyuru zaten yayınlandı.' });
    }
    item.status = 'published';
    item.publishedAt = new Date();
    await this.examDutyRepo.save(item);

    this.sendNotificationsForReason(item, 'publish_now').catch((e) => {
      console.error('[ExamDuty] publish_now send error:', e);
    });

    return item;
  }

  /** Superadmin: birden fazla taslağı toplu sil (soft delete). Sadece draft olanlar silinir. */
  async bulkDelete(ids: string[]): Promise<{ deleted: number; errors: { id: string; message: string }[] }> {
    const errors: { id: string; message: string }[] = [];
    let deleted = 0;

    for (const id of ids) {
      try {
        const item = await this.examDutyRepo.findOne({ where: { id } });
        if (!item) {
          errors.push({ id, message: 'Kayıt bulunamadı.' });
          continue;
        }
        if (item.status === 'published') {
          errors.push({ id, message: 'Yayında olan silinemez.' });
          continue;
        }
        item.deletedAt = new Date();
        await this.examDutyRepo.save(item);
        deleted++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Silinemedi';
        errors.push({ id, message: msg });
      }
    }
    return { deleted, errors };
  }

  /** Superadmin: birden fazla taslağı toplu yayınla. */
  async bulkPublish(ids: string[]): Promise<{ published: number; errors: { id: string; message: string }[] }> {
    const errors: { id: string; message: string }[] = [];
    let published = 0;

    for (const id of ids) {
      try {
        const item = await this.examDutyRepo.findOne({ where: { id } });
        if (!item) {
          errors.push({ id, message: 'Kayıt bulunamadı.' });
          continue;
        }
        if (item.status === 'published') {
          errors.push({ id, message: 'Zaten yayında.' });
          continue;
        }
        await this.publish(id);
        published++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Yayınlanamadı';
        errors.push({ id, message: msg });
      }
    }
    return { published, errors };
  }

  /** Superadmin: birden fazla taslakta aynı tarih alanını toplu güncelle. */
  async bulkUpdateDates(ids: string[], field: string, value: string): Promise<{ updated: number; errors: { id: string; message: string }[] }> {
    const colMap: Record<string, keyof ExamDuty> = {
      application_start: 'applicationStart',
      application_end: 'applicationEnd',
      application_approval_end: 'applicationApprovalEnd',
      result_date: 'resultDate',
      exam_date: 'examDate',
      exam_date_end: 'examDateEnd',
    };
    const col = colMap[field];
    if (!col) return { updated: 0, errors: [{ id: '', message: 'Geçersiz alan.' }] };

    const errors: { id: string; message: string }[] = [];
    let updated = 0;
    const dateVal = new Date(value);

    for (const id of ids) {
      try {
        const item = await this.examDutyRepo.findOne({ where: { id } });
        if (!item) {
          errors.push({ id, message: 'Kayıt bulunamadı.' });
          continue;
        }
        if (item.status === 'published') {
          errors.push({ id, message: 'Yayında olan toplu güncellenemez.' });
          continue;
        }
        switch (col) {
          case 'applicationStart': item.applicationStart = dateVal; break;
          case 'applicationEnd': item.applicationEnd = dateVal; break;
          case 'applicationApprovalEnd': item.applicationApprovalEnd = dateVal; break;
          case 'resultDate': item.resultDate = dateVal; break;
          case 'examDate': item.examDate = dateVal; break;
          case 'examDateEnd': item.examDateEnd = dateVal; break;
        }
        this.validateDateOrder(item);
        await this.examDutyRepo.save(item);
        updated++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Güncellenemedi';
        errors.push({ id, message: msg });
      }
    }
    return { updated, errors };
  }

  /**
   * Tercihe uyan teacher user_id listesi.
   * Varsayılan: bildirim açık. Sadece bu kategori için tercihte kapatmış olanlar hariç.
   * sinav_gorevi kanalı kapalıysa dahil etme.
   */
  async getTargetUserIds(examDuty: ExamDuty, reason: string): Promise<string[]> {
    if (this.getBaseReason(reason) === 'exam_day_morning') return []; // Sadece atananlara sendNotificationsForExamDayMorning ile gider
    const prefKey = this.reasonToPrefKey(reason);
    if (!prefKey) return [];

    const prefs = await this.prefRepo.find({
      where: { categorySlug: examDuty.categorySlug },
      select: ['userId', 'prefPublish', 'prefDeadline', 'prefApprovalDay', 'prefExamMinus1d', 'prefExamPlus1d'],
    });
    const optedOutIds = new Set(
      prefs
        .filter((p) => {
          if (prefKey === 'prefPublish') return p.prefPublish === false;
          if (prefKey === 'prefDeadline') return p.prefDeadline === false;
          if (prefKey === 'prefApprovalDay') return p.prefApprovalDay === false;
          if (prefKey === 'prefExamMinus1d') return p.prefExamMinus1d === false;
          if (prefKey === 'prefExamPlus1d') return p.prefExamPlus1d === false;
          return false;
        })
        .map((p) => p.userId),
    );

    const users = await this.userRepo.find({
      where: { role: UserRole.teacher, status: UserStatus.active },
      select: ['id'],
    });
    const candidateIds = users.map((u) => u.id).filter((id) => !optedOutIds.has(id));
    if (candidateIds.length === 0) return [];

    const notifPrefs = await this.notifPrefRepo.find({
      where: { user_id: In(candidateIds), channel: 'sinav_gorevi' },
      select: ['user_id', 'push_enabled'],
    });
    const disabledSet = new Set(
      notifPrefs.filter((np) => np.push_enabled === false).map((np) => np.user_id),
    );

    return candidateIds.filter((id) => !disabledSet.has(id));
  }

  /** "exam_minus_1d:2026-12-27" -> "exam_minus_1d" (multi-day için) */
  private getBaseReason(reason: string): ExamDutyNotificationReason {
    const base = reason.split(':')[0];
    return base as ExamDutyNotificationReason;
  }

  private reasonToPrefKey(reason: string): keyof ExamDutyPreference | null {
    const base = this.getBaseReason(reason);
    switch (base) {
      case 'publish_now':
      case 'apply_start':
        return 'prefPublish';
      case 'deadline':
        return 'prefDeadline';
      case 'approval_day':
        return 'prefApprovalDay';
      case 'exam_minus_1d':
        return 'prefExamMinus1d';
      case 'exam_plus_1d':
        return 'prefExamPlus1d';
      case 'exam_day_morning':
        return 'prefExamDayMorning';
      default:
        return null;
    }
  }

  /** Zaten gönderilmiş mi kontrol et */
  private async alreadySent(examDutyId: string, userId: string, reason: string): Promise<boolean> {
    const existing = await this.logRepo.findOne({
      where: { examDutyId, userId, reason },
    });
    return !!existing;
  }

  /** Belirli reason için bildirimleri gönder (reason: "exam_minus_1d" veya "exam_minus_1d:YYYY-MM-DD") */
  async sendNotificationsForReason(examDuty: ExamDuty, reason: string): Promise<{ sent: number }> {
    if (!this.isListTabEligible(examDuty)) return { sent: 0 };
    const userIds = await this.getTargetUserIds(examDuty, reason);
    if (userIds.length === 0) return { sent: 0 };

    const base = this.getBaseReason(reason);
    const eventType = EVENT_MAP[base] ?? 'exam_duty.open';
    const { title, body } = this.buildNotificationContent(examDuty, base);
    let sent = 0;

    for (const userId of userIds) {
      const already = await this.alreadySent(examDuty.id, userId, reason);
      if (already) continue;

      try {
        await this.notificationsService.createInboxEntry({
          user_id: userId,
          event_type: eventType,
          entity_id: examDuty.id,
          target_screen: 'sinav-gorevi',
          title,
          body,
          metadata: {
            exam_duty_id: examDuty.id,
            reason,
            category_slug: examDuty.categorySlug,
          },
        });
        await this.logRepo.save(
          this.logRepo.create({
            examDutyId: examDuty.id,
            userId,
            reason,
          }),
        );
        sent++;
      } catch (e) {
        console.error(`[ExamDuty] Failed to send to user ${userId}:`, e);
      }
    }
    return { sent };
  }

  /**
   * Sadece "görev çıktı" işaretleyen öğretmenlere sınav günü sabah hatırlatması gönderir.
   * Tercihte "Sınav günü sabah hatırlatma" kapalı veya sinav_gorevi kapalı olanlar hariç.
   * preferred_exam_date setli atamalarda sadece today ile eşleşen günde gönderilir.
   * currentTime (HH:mm Turkey) ile eşleşen pref_exam_day_morning_time tercihine sahip kullanıcılara gönderilir (null = varsayılan 07:00).
   */
  async sendNotificationsForExamDayMorning(
    examDuty: ExamDuty,
    today: string,
    currentTime: string,
  ): Promise<{ sent: number }> {
    const assignments = await this.assignmentRepo.find({
      where: { examDutyId: examDuty.id },
      select: ['userId', 'preferredExamDate'],
    });
    const assignedIds = assignments
      .filter((a) => {
        if (!a.preferredExamDate) return true;
        const d = a.preferredExamDate instanceof Date ? a.preferredExamDate : new Date(a.preferredExamDate);
        const prefStr = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
        return prefStr === today;
      })
      .map((a) => a.userId);
    if (assignedIds.length === 0) return { sent: 0 };

    const prefs = await this.prefRepo.find({
      where: { categorySlug: examDuty.categorySlug, userId: In(assignedIds) },
      select: ['userId', 'prefExamDayMorning', 'prefExamDayMorningTime'],
    });
    const optedOut = new Set(prefs.filter((p) => p.prefExamDayMorning === false).map((p) => p.userId));
    const normalizeTime = (t: string) => {
      const s = (t || DEFAULT_EXAM_DAY_MORNING_TIME).trim();
      const m = s.match(/^(\d{1,2}):(\d{2})$/);
      return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : DEFAULT_EXAM_DAY_MORNING_TIME;
    };
    const currentNorm = normalizeTime(currentTime);
    const matchesTime = (p: { prefExamDayMorningTime?: string | null }) =>
      normalizeTime(p.prefExamDayMorningTime ?? DEFAULT_EXAM_DAY_MORNING_TIME) === currentNorm;
    const candidateIds = assignedIds.filter((id) => {
      if (optedOut.has(id)) return false;
      const p = prefs.find((x) => x.userId === id);
      return !p || matchesTime(p);
    });
    if (candidateIds.length === 0) return { sent: 0 };

    const notifPrefs = await this.notifPrefRepo.find({
      where: { user_id: In(candidateIds), channel: 'sinav_gorevi' },
      select: ['user_id', 'push_enabled'],
    });
    const disabledSet = new Set(notifPrefs.filter((np) => np.push_enabled === false).map((np) => np.user_id));
    const userIds = candidateIds.filter((id) => !disabledSet.has(id));

    const reason = 'exam_day_morning';
    const eventType = EVENT_MAP[reason];
    const { title, body } = this.buildNotificationContent(examDuty, reason);
    let sent = 0;
    for (const userId of userIds) {
      if (await this.alreadySent(examDuty.id, userId, reason)) continue;
      try {
        await this.notificationsService.createInboxEntry({
          user_id: userId,
          event_type: eventType,
          entity_id: examDuty.id,
          target_screen: 'sinav-gorevi',
          title,
          body,
          metadata: {
            exam_duty_id: examDuty.id,
            reason,
            category_slug: examDuty.categorySlug,
          },
        });
        await this.logRepo.save(this.logRepo.create({ examDutyId: examDuty.id, userId, reason }));
        sent++;
      } catch (e) {
        console.error(`[ExamDuty] exam_day_morning failed for user ${userId}:`, e);
      }
    }
    return { sent };
  }

  private formatDateTr(d: Date | null): string {
    if (!d) return '';
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private buildNotificationContent(examDuty: ExamDuty, reason: ExamDutyNotificationReason): { title: string; body: string } {
    const baseTitle = examDuty.title.slice(0, 80);
    const fallback = examDuty.summary ?? 'Detaylar için tıklayın.';
    switch (reason) {
      case 'publish_now':
        return {
          title: `Yeni sınav görevi: ${baseTitle}`,
          body: examDuty.applicationStart && examDuty.applicationEnd
            ? `Başvuru dönemi: ${this.formatDateTr(examDuty.applicationStart)} – ${this.formatDateTr(examDuty.applicationEnd)}. Detaylar için tıklayın.`
            : fallback,
        };
      case 'apply_start':
        return {
          title: `Sınav görevi başvuruları açıldı: ${baseTitle}`,
          body: examDuty.applicationEnd
            ? `Son başvuru: ${this.formatDateTr(examDuty.applicationEnd)}. Detaylar için tıklayın.`
            : fallback,
        };
      case 'deadline':
        return {
          title: `Son başvuru yaklaşıyor: ${baseTitle}`,
          body: examDuty.applicationEnd
            ? `Son başvuru tarihi: ${this.formatDateTr(examDuty.applicationEnd)}. Başvurmayı unutmayın.`
            : fallback,
        };
      case 'approval_day':
        return {
          title: `Onay son gün: ${baseTitle}`,
          body: examDuty.applicationApprovalEnd
            ? `Başvuru onay son tarihi: ${this.formatDateTr(examDuty.applicationApprovalEnd)}. Onay durumunu kontrol edin.`
            : fallback,
        };
      case 'exam_minus_1d':
        return {
          title: `Yarın sınav: ${baseTitle}`,
          body: examDuty.examDate
            ? `Sınav tarihi: ${this.formatDateTr(examDuty.examDate)}. Detaylar için tıklayın.`
            : (examDuty.summary ?? 'Sınav detayları için tıklayın.'),
        };
      case 'exam_plus_1d':
        return {
          title: `Sınav tamamlandı: ${baseTitle}`,
          body: 'Raporlama ve sonuç için detaylara göz atın.',
        };
      case 'exam_day_morning':
        return {
          title: `Bugün sınav göreviniz var: ${baseTitle}`,
          body: examDuty.examDate
            ? `Sınav saati: ${this.formatDateTr(examDuty.examDate)}. İyi çalışmalar.`
            : 'Detaylar için tıklayın.',
        };
      default:
        return { title: baseTitle, body: examDuty.summary ?? '' };
    }
  }
}
