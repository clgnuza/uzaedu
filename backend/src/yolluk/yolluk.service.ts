import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { YollukGlobalSettings } from './entities/yolluk-global-settings.entity';
import { YollukCalculation, YollukCalculationStatus } from './entities/yolluk-calculation.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, TeacherSchoolMembershipStatus } from '../types/enums';
import { effectiveTeacherSchoolMembership } from '../common/utils/teacher-school-membership';
import { NotificationsService } from '../notifications/notifications.service';
import { YollukPdfService } from './yolluk-pdf.service';
import {
  computeYolluk,
  mergeDereceRates,
  type GeciciInputs,
  type SurekliInputs,
  type YollukCalculationInputs,
  type YollukRateParams,
} from './yolluk-calculator.engine';
import { UpsertYollukSettingsDto } from './dto/yolluk-api.dto';

@Injectable()
export class YollukService {
  constructor(
    @InjectRepository(YollukGlobalSettings)
    private readonly settingsRepo: Repository<YollukGlobalSettings>,
    @InjectRepository(YollukCalculation)
    private readonly calcRepo: Repository<YollukCalculation>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly yollukPdfService: YollukPdfService,
  ) {}

  private parseRates(row: YollukGlobalSettings): YollukRateParams {
    const defaultDaily = parseFloat(row.default_daily_tl);
    return {
      default_daily_tl: defaultDaily,
      derece_daily_tl: mergeDereceRates(defaultDaily, row.derece_rates_json as Record<string, unknown> | null),
      km_daily_fraction: parseFloat(row.km_daily_fraction),
      memur_fixed_multiplier: row.memur_fixed_multiplier,
      aile_per_multiplier: row.aile_per_multiplier,
      aile_fixed_cap_multiplier: row.aile_fixed_cap_multiplier,
      rules_version: row.rules_version,
    };
  }

  serializeSettingsRow(row: YollukGlobalSettings): Record<string, unknown> {
    const r = this.parseRates(row);
    const derece_daily_tl: Record<string, string> = {};
    for (let i = 1; i <= 15; i++) derece_daily_tl[String(i)] = r.derece_daily_tl[i].toFixed(2);
    return {
      id: row.id,
      fiscal_year: row.fiscal_year,
      default_daily_tl: row.default_daily_tl,
      derece_rates_json: row.derece_rates_json,
      derece_daily_tl,
      km_daily_fraction: row.km_daily_fraction,
      memur_fixed_multiplier: row.memur_fixed_multiplier,
      aile_per_multiplier: row.aile_per_multiplier,
      aile_fixed_cap_multiplier: row.aile_fixed_cap_multiplier,
      rules_version: row.rules_version,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private snapshotFromRow(row: YollukGlobalSettings): Record<string, unknown> {
    const r = this.parseRates(row);
    const derece_daily_tl: Record<string, number> = {};
    for (let i = 1; i <= 15; i++) derece_daily_tl[i] = r.derece_daily_tl[i];
    return {
      fiscal_year: row.fiscal_year,
      default_daily_tl: r.default_daily_tl,
      derece_daily_tl,
      km_daily_fraction: r.km_daily_fraction,
      memur_fixed_multiplier: r.memur_fixed_multiplier,
      aile_per_multiplier: r.aile_per_multiplier,
      aile_fixed_cap_multiplier: r.aile_fixed_cap_multiplier,
      rules_version: r.rules_version,
    };
  }

  async getSettingsForYear(year: number): Promise<YollukGlobalSettings | null> {
    return this.settingsRepo.findOne({ where: { fiscal_year: year } });
  }

  async getActiveSettingsYear(): Promise<number> {
    const row = await this.settingsRepo.find({ order: { fiscal_year: 'DESC' }, take: 1 });
    if (!row.length) return new Date().getFullYear();
    return row[0].fiscal_year;
  }

  async getActiveSettings(): Promise<YollukGlobalSettings> {
    const y = await this.getActiveSettingsYear();
    const row = await this.getSettingsForYear(y);
    if (!row) {
      throw new NotFoundException({
        code: 'YOLLUK_SETTINGS_MISSING',
        message: 'Yolluk parametreleri tanımlı değil. Süper yönetici ayarlarını girsin.',
      });
    }
    return row;
  }

  async upsertSettings(dto: UpsertYollukSettingsDto): Promise<YollukGlobalSettings> {
    const existing = await this.getSettingsForYear(dto.fiscal_year);
    const km = dto.km_daily_fraction ?? 0.05;
    const base = {
      fiscal_year: dto.fiscal_year,
      default_daily_tl: dto.default_daily_tl.toFixed(2),
      km_daily_fraction: km.toFixed(5),
      memur_fixed_multiplier: dto.memur_fixed_multiplier ?? 20,
      aile_per_multiplier: dto.aile_per_multiplier ?? 10,
      aile_fixed_cap_multiplier: dto.aile_fixed_cap_multiplier ?? 40,
      rules_version: dto.rules_version?.trim() || '6245-summary-1',
    };
    const extra: Partial<Pick<YollukGlobalSettings, 'derece_rates_json'>> = {};
    if (dto.derece_rates_json !== undefined) {
      extra.derece_rates_json = dto.derece_rates_json;
    }
    if (existing) {
      await this.settingsRepo.update({ id: existing.id }, { ...base, ...extra });
      const u = await this.getSettingsForYear(dto.fiscal_year);
      if (!u) throw new Error('yolluk settings update');
      return u;
    }
    return this.settingsRepo.save(
      this.settingsRepo.create({
        ...base,
        derece_rates_json: dto.derece_rates_json ?? null,
      }),
    );
  }

  private normalizeInput(raw: GeciciInputs | SurekliInputs): YollukCalculationInputs {
    if (raw.kind === 'gecici') {
      return {
        kind: 'gecici',
        mission_days: raw.mission_days,
        yol_masrafi_tl: raw.yol_masrafi_tl,
        konaklama_tl: raw.konaklama_tl,
        diger_tl: raw.diger_tl,
        derece: raw.derece,
        gundelik_tl_override: raw.gundelik_tl_override,
        tasit_ucreti_tl: raw.tasit_ucreti_tl,
        taksi_tl: raw.taksi_tl,
      };
    }
    return {
      kind: 'surekli',
      mesafe_km: raw.mesafe_km,
      aile_ferdi_sayisi: raw.aile_ferdi_sayisi,
      derece: raw.derece,
      gundelik_tl_override: raw.gundelik_tl_override,
      ydm_km_mode: raw.ydm_km_mode,
      tasit_ucreti_tl: raw.tasit_ucreti_tl,
      eski_mahal: raw.eski_mahal,
      yeni_mahal: raw.yeni_mahal,
    };
  }

  async preview(
    fiscalYear: number | undefined,
    rawInput: GeciciInputs | SurekliInputs,
  ): Promise<{ rates: YollukRateParams; result: ReturnType<typeof computeYolluk> }> {
    const year = fiscalYear ?? (await this.getActiveSettingsYear());
    const row = await this.getSettingsForYear(year);
    if (!row) {
      throw new NotFoundException({
        code: 'YOLLUK_SETTINGS_MISSING',
        message: `${year} için yolluk ayarı yok.`,
      });
    }
    const rates = this.parseRates(row);
    const input = this.normalizeInput(rawInput);
    const result = computeYolluk(rates, input);
    return { rates, result };
  }

  private async assertTeacherAtSchool(teacherUserId: string, schoolId: string): Promise<User> {
    const u = await this.userRepo.findOne({ where: { id: teacherUserId } });
    if (!u || u.role !== UserRole.teacher) {
      throw new BadRequestException({ code: 'INVALID_TEACHER', message: 'Geçersiz öğretmen.' });
    }
    if (u.school_id !== schoolId) {
      throw new ForbiddenException({ code: 'TEACHER_NOT_IN_SCHOOL', message: 'Öğretmen bu okula bağlı değil.' });
    }
    const eff = effectiveTeacherSchoolMembership(u);
    if (eff !== TeacherSchoolMembershipStatus.approved) {
      throw new ForbiddenException({
        code: 'TEACHER_NOT_APPROVED',
        message: 'Öğretmen okul üyeliği onaylı değil.',
      });
    }
    return u;
  }

  private resolveSchoolId(actor: User, dtoSchoolId: string | null | undefined): string {
    if (actor.role === UserRole.superadmin) {
      const sid = dtoSchoolId?.trim();
      if (!sid) {
        throw new BadRequestException({ code: 'SCHOOL_ID_REQUIRED', message: 'school_id gerekli.' });
      }
      return sid;
    }
    if (actor.role === UserRole.school_admin) {
      if (!actor.school_id) {
        throw new ForbiddenException({ code: 'NO_SCHOOL', message: 'Okul atanmamış.' });
      }
      return actor.school_id;
    }
    throw new ForbiddenException();
  }

  async createCalculation(
    actor: User,
    dto: {
      teacher_user_id: string;
      input: GeciciInputs | SurekliInputs;
      title?: string | null;
      school_id?: string | null;
      fiscal_year?: number;
    },
  ): Promise<YollukCalculation> {
    const schoolId = this.resolveSchoolId(actor, dto.school_id);
    await this.assertTeacherAtSchool(dto.teacher_user_id, schoolId);
    const year = dto.fiscal_year ?? (await this.getActiveSettingsYear());
    const row = await this.getSettingsForYear(year);
    if (!row) {
      throw new NotFoundException({ code: 'YOLLUK_SETTINGS_MISSING', message: `${year} ayarı yok.` });
    }
    const rates = this.parseRates(row);
    const input = this.normalizeInput(dto.input);
    const result = computeYolluk(rates, input);
    return this.calcRepo.save(
      this.calcRepo.create({
        school_id: schoolId,
        teacher_user_id: dto.teacher_user_id,
        kind: input.kind,
        status: 'draft',
        title: dto.title?.trim() || null,
        inputs: dto.input as unknown as Record<string, unknown>,
        result: result as unknown as Record<string, unknown>,
        rules_snapshot: this.snapshotFromRow(row),
        created_by_user_id: actor.id,
        finalized_at: null,
      }),
    );
  }

  async patchCalculation(actor: User, id: string, dto: { input: GeciciInputs | SurekliInputs; title?: string | null }) {
    const c = await this.calcRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    this.assertCanManageCalculation(actor, c);
    if (c.status === 'final') {
      throw new BadRequestException({ code: 'FINAL_LOCKED', message: 'Kesinleşmiş kayıt düzenlenemez.' });
    }
    if (dto.input.kind !== c.kind) {
      throw new BadRequestException({ code: 'KIND_MISMATCH', message: 'Hesap türü değiştirilemez.' });
    }
    const year = (c.rules_snapshot?.fiscal_year as number) ?? (await this.getActiveSettingsYear());
    const row = await this.getSettingsForYear(year);
    if (!row) throw new NotFoundException({ code: 'YOLLUK_SETTINGS_MISSING', message: 'Ayar bulunamadı.' });
    const rates = this.parseRates(row);
    const input = this.normalizeInput(dto.input);
    const result = computeYolluk(rates, input);
    c.inputs = dto.input as unknown as Record<string, unknown>;
    c.result = result as unknown as Record<string, unknown>;
    c.rules_snapshot = this.snapshotFromRow(row);
    if (dto.title !== undefined) c.title = dto.title?.trim() || null;
    return this.calcRepo.save(c);
  }

  async finalize(actor: User, id: string): Promise<YollukCalculation> {
    const c = await this.calcRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    this.assertCanManageCalculation(actor, c);
    if (c.status === 'final') return c;
    c.status = 'final';
    c.finalized_at = new Date();
    const saved = await this.calcRepo.save(c);
    const total = (saved.result as { total_tl?: number })?.total_tl ?? 0;
    await this.notificationsService.createInboxEntry({
      user_id: c.teacher_user_id,
      event_type: 'yolluk.calculation_finalized',
      entity_id: c.id,
      target_screen: 'yolluk-hesaplama/benim',
      title: 'Yolluk hesabınız hazır',
      body: `Okul tarafından yolluk hesabınız kesinleştirildi. Toplam (özet): ${Number(total).toFixed(2)} TL. Detay için Yolluk hesaplarım sayfasına gidin.`,
      metadata: { yolluk_calculation_id: c.id, school_id: c.school_id, kind: c.kind },
    });
    return saved;
  }

  private assertCanManageCalculation(actor: User, c: YollukCalculation) {
    if (actor.role === UserRole.superadmin) return;
    if (actor.role === UserRole.school_admin && actor.school_id === c.school_id) return;
    throw new ForbiddenException();
  }

  private assertCanRead(actor: User, c: YollukCalculation) {
    if (actor.role === UserRole.superadmin) return;
    if (actor.role === UserRole.school_admin && actor.school_id === c.school_id) return;
    if (
      actor.role === UserRole.teacher &&
      actor.id === c.teacher_user_id &&
      c.status === 'final'
    ) {
      return;
    }
    throw new ForbiddenException();
  }

  async getOne(actor: User, id: string): Promise<YollukCalculation> {
    const c = await this.calcRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    this.assertCanRead(actor, c);
    return c;
  }

  async listForSchool(actor: User, schoolIdQuery?: string): Promise<YollukCalculation[]> {
    let schoolId: string | null = null;
    if (actor.role === UserRole.superadmin) {
      schoolId = schoolIdQuery?.trim() ?? null;
      if (!schoolId) return [];
    } else if (actor.role === UserRole.school_admin) {
      schoolId = actor.school_id;
    } else {
      throw new ForbiddenException();
    }
    if (!schoolId) return [];
    return this.calcRepo.find({
      where: { school_id: schoolId },
      order: { created_at: 'DESC' },
      take: 200,
    });
  }

  async listForTeacher(actor: User): Promise<YollukCalculation[]> {
    if (actor.role !== UserRole.teacher) throw new ForbiddenException();
    return this.calcRepo.find({
      where: { teacher_user_id: actor.id, status: 'final' as YollukCalculationStatus },
      order: { finalized_at: 'DESC', created_at: 'DESC' },
      take: 100,
    });
  }

  private assertCanPdf(actor: User, c: YollukCalculation) {
    if (actor.role === UserRole.superadmin) return;
    if (actor.role === UserRole.school_admin && actor.school_id === c.school_id) return;
    if (actor.role === UserRole.teacher && actor.id === c.teacher_user_id && c.status === 'final') return;
    throw new ForbiddenException();
  }

  async buildOfficialPdf(actor: User, id: string): Promise<Buffer> {
    const c = await this.calcRepo.findOne({
      where: { id },
      relations: ['school', 'teacher', 'createdBy'],
    });
    if (!c) throw new NotFoundException();
    this.assertCanPdf(actor, c);
    const schoolName = c.school?.name ?? '';
    const teacherName = (c.teacher?.display_name ?? '').trim() || c.teacher?.email || '—';
    const preparerName = (c.createdBy?.display_name ?? '').trim() || c.createdBy?.email || '—';
    return this.yollukPdfService.buildOfficialReportPdf({
      schoolName,
      teacherName,
      preparerName,
      calculation: {
        id: c.id,
        kind: c.kind,
        status: c.status,
        title: c.title,
        created_at: c.created_at,
        finalized_at: c.finalized_at,
        inputs: c.inputs,
        result: (c.result ?? {}) as {
          total_tl?: number;
          lines?: Array<{ key: string; label: string; amount_tl: number }>;
        },
        rules_snapshot: c.rules_snapshot ?? {},
      },
    });
  }
}
