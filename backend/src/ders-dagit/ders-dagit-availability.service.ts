import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DersDagitStudio } from './entities/ders-dagit-studio.entity';
import {
  DersDagitAvailabilitySubmission,
  type AvailabilitySubmissionStatus,
} from './entities/ders-dagit-availability-submission.entity';
import { DersDagitTeacherConfig } from './entities/ders-dagit-teacher-config.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { NotificationsService } from '../notifications/notifications.service';
import {
  approvedPeriodsSubsetOfRequest,
  mergeTeacherAvailabilityPolicy,
  normalizeAvailabilityPeriods,
  parseTeacherAvailabilityPolicy,
  periodKeys,
  periodsKeySetEqual,
  type TeacherAvailabilityPolicy,
} from './ders-dagit-teacher-availability.settings';

@Injectable()
export class DersDagitAvailabilityService {
  constructor(
    @InjectRepository(DersDagitStudio)
    private readonly studioRepo: Repository<DersDagitStudio>,
    @InjectRepository(DersDagitAvailabilitySubmission)
    private readonly submissionRepo: Repository<DersDagitAvailabilitySubmission>,
    @InjectRepository(DersDagitTeacherConfig)
    private readonly teacherConfigRepo: Repository<DersDagitTeacherConfig>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notifications: NotificationsService,
  ) {}

  private async loadStudio(studioId: string): Promise<DersDagitStudio> {
    const studio = await this.studioRepo.findOne({ where: { id: studioId } });
    if (!studio) throw new NotFoundException();
    return studio;
  }

  private policyFromStudio(studio: DersDagitStudio): TeacherAvailabilityPolicy {
    return parseTeacherAvailabilityPolicy(studio.settings);
  }

  private isCollectionOpen(studio: DersDagitStudio, policy: TeacherAvailabilityPolicy): boolean {
    return studio.preference_window_open && policy.collection_enabled;
  }

  private async schoolAdminIds(schoolId: string): Promise<string[]> {
    const rows = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.school_admin },
      select: ['id'],
    });
    return rows.map((r) => r.id);
  }

  private async teacherIdsInStudio(studioId: string): Promise<string[]> {
    const rows = await this.teacherConfigRepo.find({
      where: { studio_id: studioId },
      select: ['user_id'],
    });
    return rows.map((r) => r.user_id);
  }

  private async notify(
    userId: string,
    event: string,
    title: string,
    body: string,
    meta: Record<string, unknown>,
    targetScreen = 'ders-programi',
  ) {
    await this.notifications.createInboxEntry({
      user_id: userId,
      event_type: event,
      target_screen: targetScreen,
      title,
      body,
      metadata: meta,
    });
  }

  private studioLabel(studio: DersDagitStudio): string {
    return studio.name?.trim() || 'Ders programı';
  }

  private isDeadlinePassed(policy: TeacherAvailabilityPolicy): boolean {
    if (!policy.deadline?.trim()) return false;
    const end = new Date(policy.deadline);
    return !Number.isNaN(end.getTime()) && Date.now() > end.getTime();
  }

  private isFinalizedStatus(status: string | undefined): boolean {
    return status === 'approved' || status === 'partially_approved';
  }

  private teacherMayModify(
    studio: DersDagitStudio,
    policy: TeacherAvailabilityPolicy,
    submission: DersDagitAvailabilitySubmission | null,
  ): boolean {
    if (!this.isCollectionOpen(studio, policy)) return false;
    if (this.isDeadlinePassed(policy)) return false;
    if (!submission) return true;
    if (this.isFinalizedStatus(submission.status)) return false;
    return submission.status === 'draft' || submission.status === 'submitted' || submission.status === 'rejected';
  }

  private editLockedReason(
    studio: DersDagitStudio,
    policy: TeacherAvailabilityPolicy,
    submission: DersDagitAvailabilitySubmission | null,
  ): string | null {
    if (!this.isCollectionOpen(studio, policy)) return 'Okul tercih penceresini kapattı.';
    if (this.isDeadlinePassed(policy)) return 'Son gönderim tarihi geçti.';
    if (submission && this.isFinalizedStatus(submission.status)) return 'İdare kararı verildi; değişiklik yapılamaz.';
    return null;
  }

  private async latestSubmission(studioId: string, userId: string) {
    return this.submissionRepo.findOne({
      where: { studio_id: studioId, user_id: userId },
      order: { updated_at: 'DESC' },
    });
  }

  private async activeDraft(studioId: string, userId: string) {
    return this.submissionRepo.findOne({
      where: { studio_id: studioId, user_id: userId, status: 'draft' },
      order: { updated_at: 'DESC' },
    });
  }

  async getPolicyBundle(studioId: string) {
    const studio = await this.loadStudio(studioId);
    const policy = this.policyFromStudio(studio);
    const pending = await this.submissionRepo.count({
      where: { studio_id: studioId, status: 'submitted' },
    });
    return {
      preference_window_open: studio.preference_window_open,
      workflow_status: studio.workflow_status,
      policy,
      pending_submissions: pending,
    };
  }

  async updatePolicy(
    studioId: string,
    dto: {
      open?: boolean;
      policy?: Partial<TeacherAvailabilityPolicy>;
    },
    actorId: string,
  ) {
    const studio = await this.loadStudio(studioId);
    const prevOpen = studio.preference_window_open;
    const prevPolicy = this.policyFromStudio(studio);

    if (dto.open !== undefined) {
      studio.preference_window_open = dto.open;
      studio.workflow_status = dto.open ? 'collecting_prefs' : studio.workflow_status === 'collecting_prefs' ? 'ready' : studio.workflow_status;
    }
    if (dto.policy) {
      studio.settings = mergeTeacherAvailabilityPolicy(studio.settings ?? {}, dto.policy);
    }
    await this.studioRepo.save(studio);

    const policy = this.policyFromStudio(studio);
    const opened = dto.open === true && !prevOpen && studio.preference_window_open;
    if (opened && policy.notify_teachers_on_open && policy.collection_enabled) {
      const teachers = await this.teacherIdsInStudio(studioId);
      const label = this.studioLabel(studio);
      for (const uid of teachers) {
        await this.notify(
          uid,
          'timetable.availability_window_open',
          `Program öncesi müsaitlik — ${label}`,
          `Okulunuz, ders programı hazırlanmadan önce uygun olmadığınız gün ve ders saatlerini girmenizi istiyor. Menüden DersDağıt → Müsaitlik tercihleri sayfasına giderek işaretleyin.`,
          { studio_id: studioId },
        );
      }
    }

    return this.getPolicyBundle(studioId);
  }

  async getTeacherContext(studioId: string, userId: string) {
    const studio = await this.loadStudio(studioId);
    const policy = this.policyFromStudio(studio);
    const config = await this.teacherConfigRepo.findOne({ where: { studio_id: studioId, user_id: userId } });
    const submission = await this.latestSubmission(studioId, userId);
    const applied = normalizeAvailabilityPeriods(config?.unavailable_periods ?? []);
    const mayModify = this.teacherMayModify(studio, policy, submission);
    const deadlinePassed = this.isDeadlinePassed(policy);

    return {
      collection_open: this.isCollectionOpen(studio, policy),
      deadline_passed: deadlinePassed,
      policy,
      preference_window_open: studio.preference_window_open,
      applied_periods: applied,
      edit_locked_reason: this.editLockedReason(studio, policy, submission),
      submission: submission
        ? {
            id: submission.id,
            status: submission.status,
            periods: normalizeAvailabilityPeriods(submission.periods),
            approved_periods: submission.approved_periods
              ? normalizeAvailabilityPeriods(submission.approved_periods)
              : null,
            teacher_note: submission.teacher_note,
            admin_reply: submission.admin_reply,
            submitted_at: submission.submitted_at,
            reviewed_at: submission.reviewed_at,
            updated_at: submission.updated_at,
          }
        : null,
      can_edit: mayModify,
      can_submit:
        mayModify &&
        policy.require_admin_approval &&
        (!submission || submission.status === 'draft' || submission.status === 'rejected'),
      can_update_submission: mayModify && submission?.status === 'submitted',
      can_withdraw: mayModify && submission?.status === 'submitted',
      can_delete: mayModify && !!submission,
    };
  }

  async saveDraft(
    studioId: string,
    userId: string,
    dto: { periods: unknown; teacher_note?: string | null },
  ) {
    const studio = await this.loadStudio(studioId);
    const policy = this.policyFromStudio(studio);
    if (!this.isCollectionOpen(studio, policy)) {
      throw new BadRequestException({ code: 'PREF_WINDOW_CLOSED', message: 'Tercih penceresi kapalı.' });
    }
    if (this.isDeadlinePassed(policy)) {
      throw new BadRequestException({ code: 'DEADLINE_PASSED', message: 'Son gönderim tarihi geçti.' });
    }

    const periods = normalizeAvailabilityPeriods(dto.periods);
    let row = await this.activeDraft(studioId, userId);
    const latest = await this.latestSubmission(studioId, userId);

    if (latest?.status === 'submitted' && this.teacherMayModify(studio, policy, latest)) {
      latest.periods = periods;
      if (dto.teacher_note !== undefined) latest.teacher_note = dto.teacher_note?.trim() || null;
      await this.submissionRepo.save(latest);
      await this.notifyAdminsSubmissionUpdated(studio, latest, userId);
      return this.getTeacherContext(studioId, userId);
    }

    if (latest?.status === 'submitted') {
      throw new BadRequestException({
        code: 'PENDING_REVIEW',
        message: 'Başvuru düzenlenemiyor.',
      });
    }

    if (!policy.require_admin_approval) {
      await this.applyPeriodsToTeacherConfig(studioId, userId, periods);
      return this.getTeacherContext(studioId, userId);
    }

    if (!row) {
      row = this.submissionRepo.create({
        studio_id: studioId,
        user_id: userId,
        status: 'draft',
        periods,
        teacher_note: dto.teacher_note?.trim() || null,
      });
    } else {
      row.periods = periods;
      if (dto.teacher_note !== undefined) row.teacher_note = dto.teacher_note?.trim() || null;
      row.status = 'draft';
    }
    await this.submissionRepo.save(row);
    return this.getTeacherContext(studioId, userId);
  }

  async submitForReview(studioId: string, userId: string, teacherNote?: string) {
    const studio = await this.loadStudio(studioId);
    const policy = this.policyFromStudio(studio);
    if (!this.isCollectionOpen(studio, policy)) {
      throw new BadRequestException({ code: 'PREF_WINDOW_CLOSED', message: 'Tercih penceresi kapalı.' });
    }
    if (this.isDeadlinePassed(policy)) {
      throw new BadRequestException({ code: 'DEADLINE_PASSED', message: 'Son gönderim tarihi geçti.' });
    }
    if (!policy.require_admin_approval) {
      throw new BadRequestException({ code: 'NO_APPROVAL_FLOW', message: 'Bu stüdyoda onay akışı kapalı.' });
    }

    let row = await this.activeDraft(studioId, userId);
    const latest = await this.latestSubmission(studioId, userId);
    if (latest?.status === 'submitted') {
      throw new BadRequestException({
        code: 'ALREADY_SUBMITTED',
        message: 'Zaten gönderildi. Son tarihe kadar düzenleyip kaydedebilir veya gönderiyi geri alabilirsiniz.',
      });
    }
    if (!row && latest?.status === 'rejected') {
      row = this.submissionRepo.create({
        studio_id: studioId,
        user_id: userId,
        status: 'draft',
        periods: latest.periods,
        teacher_note: teacherNote?.trim() ?? latest.teacher_note,
      });
    }
    if (!row) throw new BadRequestException({ code: 'NO_DRAFT', message: 'Önce tercihlerinizi işaretleyin.' });

    row.status = 'submitted';
    row.submitted_at = new Date();
    if (teacherNote !== undefined) row.teacher_note = teacherNote.trim() || null;
    await this.submissionRepo.save(row);

    const teacher = await this.userRepo.findOne({ where: { id: userId }, select: ['display_name', 'email'] });
    const teacherLabel = teacher?.display_name?.trim() || teacher?.email || 'Bir öğretmen';
    const studioName = this.studioLabel(studio);
    const admins = await this.schoolAdminIds(studio.school_id);
    for (const adminId of admins) {
      await this.notify(
        adminId,
        'timetable.availability_submitted',
        `Müsaitlik onayı bekliyor — ${teacherLabel}`,
        `${teacherLabel}, «${studioName}» için uygunluk tercihini gönderdi. DersDağıt → Ayarlar bölümünden onaylayabilir veya reddedebilirsiniz.`,
        { studio_id: studioId, submission_id: row.id, user_id: userId },
      );
    }

    return this.getTeacherContext(studioId, userId);
  }

  private async notifyAdminsSubmissionUpdated(
    studio: DersDagitStudio,
    row: DersDagitAvailabilitySubmission,
    userId: string,
  ) {
    const teacher = await this.userRepo.findOne({ where: { id: userId }, select: ['display_name', 'email'] });
    const label = teacher?.display_name?.trim() || teacher?.email || 'Öğretmen';
    const studioName = this.studioLabel(studio);
    const admins = await this.schoolAdminIds(studio.school_id);
    for (const adminId of admins) {
      await this.notify(
        adminId,
        'timetable.availability_submitted',
        `Müsaitlik güncellendi — ${label}`,
        `${label} «${studioName}» başvurusunu son tarihe kadar güncelledi.`,
        { studio_id: studio.id, submission_id: row.id, user_id: userId, revised: true },
      );
    }
  }

  async withdrawSubmission(studioId: string, userId: string) {
    const studio = await this.loadStudio(studioId);
    const policy = this.policyFromStudio(studio);
    const row = await this.submissionRepo.findOne({
      where: { studio_id: studioId, user_id: userId, status: 'submitted' },
      order: { updated_at: 'DESC' },
    });
    if (!row) {
      throw new BadRequestException({ code: 'NOT_SUBMITTED', message: 'Geri alınacak gönderi yok.' });
    }
    if (!this.teacherMayModify(studio, policy, row)) {
      throw new BadRequestException({ code: 'LOCKED', message: 'Bu başvuru artık düzenlenemez.' });
    }
    row.status = 'draft';
    row.submitted_at = null;
    await this.submissionRepo.save(row);
    return this.getTeacherContext(studioId, userId);
  }

  async deleteSubmission(studioId: string, userId: string) {
    const studio = await this.loadStudio(studioId);
    const policy = this.policyFromStudio(studio);
    const row = await this.latestSubmission(studioId, userId);
    if (!row) throw new NotFoundException();
    if (!this.teacherMayModify(studio, policy, row)) {
      throw new BadRequestException({ code: 'LOCKED', message: 'Bu başvuru silinemez.' });
    }
    await this.submissionRepo.remove(row);
    return this.getTeacherContext(studioId, userId);
  }

  private async applyPeriodsToTeacherConfig(studioId: string, userId: string, periods: Array<{ day_of_week: number; lesson_num?: number }>) {
    let config = await this.teacherConfigRepo.findOne({ where: { studio_id: studioId, user_id: userId } });
    if (!config) {
      config = this.teacherConfigRepo.create({ studio_id: studioId, user_id: userId, unavailable_periods: periods });
    } else {
      config.unavailable_periods = periods;
    }
    await this.teacherConfigRepo.save(config);
  }

  async listSubmissions(studioId: string, status?: AvailabilitySubmissionStatus) {
    const where: { studio_id: string; status?: AvailabilitySubmissionStatus } = { studio_id: studioId };
    if (status) where.status = status;
    const rows = await this.submissionRepo.find({
      where,
      order: { submitted_at: 'DESC', updated_at: 'DESC' },
      take: 200,
    });
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const users =
      userIds.length > 0
        ? await this.userRepo.find({ where: { id: In(userIds) }, select: ['id', 'display_name', 'email'] })
        : [];
    const nameMap = new Map(users.map((u) => [u.id, u.display_name?.trim() || u.email || '—']));
    return rows.map((r) => this.mapSubmissionRow(r, nameMap));
  }

  private mapSubmissionRow(
    r: DersDagitAvailabilitySubmission,
    nameMap: Map<string, string>,
  ) {
    return {
      id: r.id,
      user_id: r.user_id,
      teacher_name: nameMap.get(r.user_id) ?? r.user_id.slice(0, 8),
      status: r.status,
      periods: normalizeAvailabilityPeriods(r.periods),
      approved_periods: r.approved_periods ? normalizeAvailabilityPeriods(r.approved_periods) : null,
      teacher_note: r.teacher_note,
      admin_reply: r.admin_reply,
      submitted_at: r.submitted_at,
      reviewed_at: r.reviewed_at,
      updated_at: r.updated_at,
    };
  }

  async getSubmission(studioId: string, submissionId: string) {
    const row = await this.submissionRepo.findOne({ where: { id: submissionId, studio_id: studioId } });
    if (!row) throw new NotFoundException();
    const user = await this.userRepo.findOne({
      where: { id: row.user_id },
      select: ['id', 'display_name', 'email'],
    });
    const config = await this.teacherConfigRepo.findOne({
      where: { studio_id: studioId, user_id: row.user_id },
    });
    const nameMap = new Map<string, string>([
      [row.user_id, user?.display_name?.trim() || user?.email || '—'],
    ]);
    return {
      ...this.mapSubmissionRow(row, nameMap),
      current_applied_periods: normalizeAvailabilityPeriods(config?.unavailable_periods ?? []),
    };
  }

  async moderateSubmission(
    studioId: string,
    submissionId: string,
    adminUserId: string,
    dto: {
      status: 'approved' | 'partially_approved' | 'rejected';
      approved_periods?: unknown;
      admin_reply?: string;
    },
  ) {
    const row = await this.submissionRepo.findOne({ where: { id: submissionId, studio_id: studioId } });
    if (!row) throw new NotFoundException();
    if (row.status !== 'submitted') {
      throw new BadRequestException({ code: 'NOT_PENDING', message: 'Yalnızca bekleyen başvurular işlenir.' });
    }

    const studio = await this.loadStudio(studioId);
    const policy = this.policyFromStudio(studio);
    row.reviewed_at = new Date();
    row.reviewed_by = adminUserId;
    row.admin_reply = dto.admin_reply?.trim() || null;

    if (dto.status === 'approved' || dto.status === 'partially_approved') {
      const requested = normalizeAvailabilityPeriods(row.periods);
      const approved = normalizeAvailabilityPeriods(
        dto.approved_periods !== undefined ? dto.approved_periods : row.periods,
      );
      const subsetOfRequest = approvedPeriodsSubsetOfRequest(requested, approved);
      const full = periodsKeySetEqual(requested, approved);
      if (subsetOfRequest && !policy.allow_partial_approval && !full && approved.length > 0) {
        throw new BadRequestException({
          code: 'PARTIAL_NOT_ALLOWED',
          message: 'Bu stüdyoda kısmi onay kapalı; öğretmen talebinin tamamını onaylayın, ızgarayı düzenleyin veya reddedin.',
        });
      }
      row.status =
        !subsetOfRequest || full || approved.length === 0 ? 'approved' : 'partially_approved';
      row.approved_periods = approved;
      await this.applyPeriodsToTeacherConfig(studioId, row.user_id, approved);
      const studioName = this.studioLabel(studio);
      const reqN = periodKeys(requested, 12).size;
      const appN = periodKeys(approved, 12).size;
      if (!subsetOfRequest) {
        await this.notify(
          row.user_id,
          'timetable.availability_approved',
          'Müsaitlik tercihiniz idare tarafından düzenlendi',
          `«${studioName}»: İdare talebinizi inceleyip programa ${appN} kısıt işledi (öğretmen talebinden farklı olabilir).${row.admin_reply ? ` Not: ${row.admin_reply}` : ''}`,
          { studio_id: studioId, submission_id: row.id },
        );
      } else if (full || approved.length === 0) {
        await this.notify(
          row.user_id,
          'timetable.availability_approved',
          approved.length === 0 ? 'Tüm saatleriniz uygun kabul edildi' : 'Müsaitlik tercihiniz onaylandı',
          approved.length === 0
            ? `«${studioName}»: İdare tüm saatlerinizi uygun gördü; önceki kısıtlar kaldırıldı.`
            : `«${studioName}»: İdareniz tüm talebinizi programa işledi (${appN} kısıt).`,
          { studio_id: studioId, submission_id: row.id },
        );
      } else {
        await this.notify(
          row.user_id,
          'timetable.availability_partial',
          'Müsaitlik talebiniz kısmen onaylandı',
          `«${studioName}»: ${appN} saat onaylandı, talebinizin bir bölümü reddedildi.${row.admin_reply ? ` Not: ${row.admin_reply}` : ''}`,
          { studio_id: studioId, submission_id: row.id },
        );
      }
    } else {
      row.status = 'rejected';
      row.approved_periods = null;
      const studioName = this.studioLabel(studio);
      const reply =
        dto.admin_reply?.trim() ||
        'İdare tercihlerinizi bu haliyle kabul etmedi. Pencere hâlâ açıksa düzenleyip yeniden gönderebilirsiniz.';
      await this.notify(
        row.user_id,
        'timetable.availability_rejected',
        'Müsaitlik tercihiniz reddedildi',
        `«${studioName}»: ${reply}`,
        { studio_id: studioId, submission_id: row.id },
      );
    }

    await this.submissionRepo.save(row);
    return this.getSubmission(studioId, submissionId);
  }

  /** Solver: ham preference tablosu yalnızca onay gerekmiyorsa */
  shouldUseLegacyPreferences(studio: DersDagitStudio): boolean {
    const policy = this.policyFromStudio(studio);
    return this.isCollectionOpen(studio, policy) && !policy.require_admin_approval;
  }
}
