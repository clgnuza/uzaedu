import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository, type FindOptionsWhere } from 'typeorm';
import { YollukGlobalSettings } from './entities/yolluk-global-settings.entity';
import { YollukCalculation, YollukCalculationStatus } from './entities/yolluk-calculation.entity';
import { User } from '../users/entities/user.entity';
import { School } from '../schools/entities/school.entity';
import { UserRole, TeacherSchoolMembershipStatus } from '../types/enums';
import { effectiveTeacherSchoolMembership } from '../common/utils/teacher-school-membership';
import { NotificationsService } from '../notifications/notifications.service';
import { YollukPdfService } from './yolluk-pdf.service';
import {
  computeYolluk,
  mergeDereceRates,
  mergeEkGostergeRates,
  type DenetimInputs,
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
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    private readonly notificationsService: NotificationsService,
    private readonly yollukPdfService: YollukPdfService,
  ) {}

  private parseRates(row: YollukGlobalSettings): YollukRateParams {
    const defaultDaily = parseFloat(String(row.default_daily_tl ?? '0'));
    const kmf = parseFloat(String(row.km_daily_fraction ?? '0.05'));
    return {
      default_daily_tl: Number.isFinite(defaultDaily) && defaultDaily > 0 ? defaultDaily : 850,
      derece_daily_tl: mergeDereceRates(
        Number.isFinite(defaultDaily) && defaultDaily > 0 ? defaultDaily : 850,
        row.derece_rates_json as Record<string, unknown> | null,
      ),
      ek_gosterge_daily_tl: mergeEkGostergeRates(row.ek_gosterge_rates_json as Record<string, unknown> | null),
      denetim_mission_day_cap: row.denetim_mission_day_cap ?? 30,
      km_daily_fraction: Number.isFinite(kmf) && kmf >= 0 && kmf <= 1 ? kmf : 0.05,
      memur_fixed_multiplier:
        typeof row.memur_fixed_multiplier === 'number' && Number.isFinite(row.memur_fixed_multiplier) && row.memur_fixed_multiplier > 0
          ? Math.floor(row.memur_fixed_multiplier)
          : 20,
      aile_per_multiplier:
        typeof row.aile_per_multiplier === 'number' && Number.isFinite(row.aile_per_multiplier) && row.aile_per_multiplier > 0
          ? Math.floor(row.aile_per_multiplier)
          : 10,
      aile_fixed_cap_multiplier:
        typeof row.aile_fixed_cap_multiplier === 'number' &&
        Number.isFinite(row.aile_fixed_cap_multiplier) &&
        row.aile_fixed_cap_multiplier > 0
          ? Math.floor(row.aile_fixed_cap_multiplier)
          : 40,
      rules_version: row.rules_version,
    };
  }

  serializeSettingsRow(row: YollukGlobalSettings): Record<string, unknown> {
    const r = this.parseRates(row);
    const derece_daily_tl: Record<string, string> = {};
    for (let i = 1; i <= 15; i++) derece_daily_tl[String(i)] = r.derece_daily_tl[i].toFixed(2);
    const ek_gosterge_daily_tl: Record<string, string> = {};
    for (const [k, v] of Object.entries(r.ek_gosterge_daily_tl)) {
      if (typeof v === 'number' && Number.isFinite(v)) ek_gosterge_daily_tl[k] = v.toFixed(2);
    }
    return {
      id: row.id,
      fiscal_year: row.fiscal_year,
      default_daily_tl: row.default_daily_tl,
      derece_rates_json: row.derece_rates_json,
      derece_daily_tl,
      ek_gosterge_rates_json: row.ek_gosterge_rates_json,
      ek_gosterge_daily_tl,
      denetim_mission_day_cap: r.denetim_mission_day_cap,
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
      ek_gosterge_daily_tl: { ...r.ek_gosterge_daily_tl },
      denetim_mission_day_cap: r.denetim_mission_day_cap,
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

  async listFiscalYearsWithSettings(): Promise<number[]> {
    const rows = await this.settingsRepo.find({ select: ['fiscal_year'], order: { fiscal_year: 'DESC' } });
    return rows.map((r) => r.fiscal_year);
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
    const defDaily = Number(dto.default_daily_tl);
    if (!Number.isFinite(defDaily) || defDaily < 0) {
      throw new BadRequestException({ code: 'INVALID_DEFAULT_DAILY', message: 'default_daily_tl geçersiz.' });
    }
    const base = {
      fiscal_year: dto.fiscal_year,
      default_daily_tl: defDaily.toFixed(2),
      km_daily_fraction: km.toFixed(5),
      memur_fixed_multiplier: dto.memur_fixed_multiplier ?? 20,
      aile_per_multiplier: dto.aile_per_multiplier ?? 10,
      aile_fixed_cap_multiplier: dto.aile_fixed_cap_multiplier ?? 40,
      rules_version: dto.rules_version?.trim() || '6245-summary-1',
    };
    const extra: Partial<
      Pick<YollukGlobalSettings, 'derece_rates_json' | 'ek_gosterge_rates_json' | 'denetim_mission_day_cap'>
    > = {};
    if (dto.derece_rates_json !== undefined) {
      extra.derece_rates_json = dto.derece_rates_json;
    }
    if (dto.ek_gosterge_rates_json !== undefined) {
      extra.ek_gosterge_rates_json = dto.ek_gosterge_rates_json;
    }
    if (dto.denetim_mission_day_cap !== undefined) {
      extra.denetim_mission_day_cap = dto.denetim_mission_day_cap;
    }
    if (existing) {
      Object.assign(existing, base, extra);
      return this.settingsRepo.save(existing);
    }
    return this.settingsRepo.save(
      this.settingsRepo.create({
        ...base,
        derece_rates_json: dto.derece_rates_json ?? null,
        ek_gosterge_rates_json: dto.ek_gosterge_rates_json ?? null,
        denetim_mission_day_cap: dto.denetim_mission_day_cap ?? 30,
      }),
    );
  }

  private normalizeInput(raw: GeciciInputs | SurekliInputs | DenetimInputs): YollukCalculationInputs {
    if (raw.kind === 'gecici') {
      return {
        kind: 'gecici',
        mission_days: raw.mission_days,
        yol_masrafi_tl: raw.yol_masrafi_tl,
        konaklama_tl: raw.konaklama_tl,
        diger_tl: raw.diger_tl,
        derece: raw.derece,
        gundelik_tl_override: raw.gundelik_tl_override,
        ek_gosterge_band: raw.ek_gosterge_band,
        tasit_ucreti_tl: raw.tasit_ucreti_tl,
        taksi_tl: raw.taksi_tl,
        ...(raw.bildirim ? { bildirim: raw.bildirim } : {}),
      };
    }
    if (raw.kind === 'denetim') {
      return {
        kind: 'denetim',
        mission_days: raw.mission_days,
        yol_masrafi_tl: raw.yol_masrafi_tl,
        konaklama_tl: raw.konaklama_tl,
        diger_tl: raw.diger_tl,
        derece: raw.derece,
        gundelik_tl_override: raw.gundelik_tl_override,
        ek_gosterge_band: raw.ek_gosterge_band,
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
      ek_gosterge_band: raw.ek_gosterge_band,
      ydm_km_mode: raw.ydm_km_mode,
      tasit_ucreti_tl: raw.tasit_ucreti_tl,
      eski_mahal: raw.eski_mahal,
      yeni_mahal: raw.yeni_mahal,
      rayic_ucreti_tl: raw.rayic_ucreti_tl,
      es_dahil: raw.es_dahil,
      cocuk_dahil_adet: raw.cocuk_dahil_adet,
      ...(raw.bildirim_meta ? { bildirim_meta: raw.bildirim_meta } : {}),
    };
  }

  async preview(
    fiscalYear: number | undefined,
    rawInput: GeciciInputs | SurekliInputs | DenetimInputs,
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
      input: GeciciInputs | SurekliInputs | DenetimInputs;
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

  async patchCalculation(actor: User, id: string, dto: { input: GeciciInputs | SurekliInputs | DenetimInputs; title?: string | null }) {
    const c = await this.calcRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    this.assertCanManageCalculation(actor, c);
    if (c.archived_at) {
      throw new BadRequestException({ code: 'ARCHIVED_LOCKED', message: 'Arşivlenmiş kayıt düzenlenemez.' });
    }
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
    const c = await this.calcRepo.findOne({ where: { id }, relations: ['school'] });
    if (!c) throw new NotFoundException();
    this.assertCanManageCalculation(actor, c);
    if (c.archived_at) {
      throw new BadRequestException({ code: 'ARCHIVED_LOCKED', message: 'Arşivlenmiş kayıt kesinleştirilemez.' });
    }
    if (c.status === 'final') return c;
    const schoolName = (c.school?.name ?? '').trim();
    c.status = 'final';
    c.finalized_at = new Date();
    const saved = await this.calcRepo.save(c);
    const res = saved.result as {
      total_tl?: number;
      effective_daily_tl?: number;
      lines?: Array<{ key?: string; label?: string; amount_tl?: number }>;
    };
    const total = Number(res?.total_tl ?? 0);
    const eff = res?.effective_daily_tl;
    const lineRows = Array.isArray(res?.lines) ? res!.lines! : [];
    const lines: { key: string; label: string; amount_tl: number }[] = [];
    for (const row of lineRows) {
      if (!row || typeof row !== 'object') continue;
      const amt = typeof row.amount_tl === 'number' ? row.amount_tl : parseFloat(String(row.amount_tl));
      if (!Number.isFinite(amt)) continue;
      const label = typeof row.label === 'string' ? row.label.trim().slice(0, 200) : '';
      const key = typeof row.key === 'string' ? row.key.trim().slice(0, 64) : '';
      lines.push({
        key: key || `i_${lines.length}`,
        label: label || key || 'Satır',
        amount_tl: Math.round((amt + Number.EPSILON) * 100) / 100,
      });
      if (lines.length >= 48) break;
    }
    const fyRaw = saved.rules_snapshot?.fiscal_year;
    const fiscalYear = typeof fyRaw === 'number' && Number.isFinite(fyRaw) ? fyRaw : undefined;
    const k = saved.kind;
    const title =
      k === 'surekli'
        ? 'Sürekli görev yolluğunuz kesinleşti'
        : k === 'gecici'
          ? 'Geçici görev yolluğunuz kesinleşti'
          : k === 'denetim'
            ? 'Denetim yolluğunuz kesinleşti'
            : 'Yolluk hesabınız kesinleşti';
    const ozetFr =
      k === 'surekli'
        ? 'sürekli görev (yer değiştirme) yolluk özetinizi'
        : k === 'gecici'
          ? 'geçici görev yolluk özetinizi'
          : k === 'denetim'
            ? 'denetim yolluk özetinizi'
            : 'yurt içi yolluk özetinizi';
    const body = schoolName
      ? `${schoolName} okulunuz ${ozetFr} kesinleştirdi. Bildirimlerde özet tabloyu görebilirsiniz; tam kayıt ve PDF için «Yolluk hesaplarım» sayfasına gidin.`
      : `Okulunuz ${ozetFr} kesinleştirdi. Bildirimlerde özet tabloyu görebilirsiniz; tam kayıt ve PDF için «Yolluk hesaplarım» sayfasına gidin.`;
    await this.notificationsService.createInboxEntry({
      user_id: c.teacher_user_id,
      event_type: 'yolluk.calculation_finalized',
      entity_id: c.id,
      target_screen: 'yolluk-hesaplama/benim',
      title,
      body,
      metadata: {
        yolluk_calculation_id: saved.id,
        school_id: saved.school_id,
        kind: saved.kind,
        school_name: schoolName || undefined,
        fiscal_year: fiscalYear,
        calc_title: saved.title,
        total_tl: Math.round((total + Number.EPSILON) * 100) / 100,
        effective_daily_tl:
          typeof eff === 'number' && Number.isFinite(eff) ? Math.round((eff + Number.EPSILON) * 100) / 100 : undefined,
        lines,
        finalized_at_iso: saved.finalized_at?.toISOString() ?? undefined,
      },
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
    if (actor.role === UserRole.teacher && actor.id === c.teacher_user_id && c.status === 'final' && !c.archived_at) {
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

  async listForSchool(
    actor: User,
    schoolIdQuery?: string,
    archived: 'active' | 'archived' | 'all' = 'active',
  ): Promise<YollukCalculation[]> {
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
    const where: FindOptionsWhere<YollukCalculation> = { school_id: schoolId };
    if (archived === 'active') where.archived_at = IsNull();
    else if (archived === 'archived') where.archived_at = Not(IsNull());
    return this.calcRepo.find({
      where,
      order: { created_at: 'DESC' },
      take: 200,
    });
  }

  async listForTeacher(actor: User): Promise<YollukCalculation[]> {
    if (actor.role !== UserRole.teacher) throw new ForbiddenException();
    return this.calcRepo.find({
      where: {
        teacher_user_id: actor.id,
        status: 'final' as YollukCalculationStatus,
        archived_at: IsNull(),
      },
      order: { finalized_at: 'DESC', created_at: 'DESC' },
      take: 100,
    });
  }

  private assertCanPdf(actor: User, c: YollukCalculation) {
    if (actor.role === UserRole.superadmin) return;
    if (actor.role === UserRole.school_admin && actor.school_id === c.school_id) return;
    if (
      actor.role === UserRole.teacher &&
      actor.id === c.teacher_user_id &&
      c.status === 'final' &&
      !c.archived_at
    ) {
      return;
    }
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
    const mudurBelge =
      (c.school_id ? await this.resolveBelgeMudurAdi(c.school_id) : '') ||
      (c.school?.principalName ?? '').trim();
    const yt = (c.teacher?.evrakDefaults?.yolluk_teacher ?? {}) as { iban?: string };
    const teacherIban =
      typeof yt.iban === 'string' ? yt.iban.replace(/\s/g, '').toUpperCase().slice(0, 34) : '';
    return this.yollukPdfService.buildOfficialReportPdf({
      schoolName,
      teacherName,
      preparerName,
      teacherIban: teacherIban || undefined,
      mudur_adi_belge: mudurBelge || undefined,
      calculation: {
        id: c.id,
        kind: c.kind,
        status: c.status,
        title: c.title,
        created_at: c.created_at,
        finalized_at: c.finalized_at,
        archived_at: c.archived_at,
        inputs: c.inputs,
        result: (c.result ?? {}) as {
          total_tl?: number;
          lines?: Array<{ key: string; label: string; amount_tl: number }>;
        },
        rules_snapshot: c.rules_snapshot ?? {},
      },
    });
  }

  async archive(actor: User, id: string): Promise<YollukCalculation> {
    const c = await this.calcRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    this.assertCanManageCalculation(actor, c);
    if (c.archived_at) return c;
    c.archived_at = new Date();
    return this.calcRepo.save(c);
  }

  async unarchive(actor: User, id: string): Promise<YollukCalculation> {
    const c = await this.calcRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    this.assertCanManageCalculation(actor, c);
    if (!c.archived_at) return c;
    c.archived_at = null;
    return this.calcRepo.save(c);
  }

  async deleteCalculation(actor: User, id: string): Promise<void> {
    const c = await this.calcRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    this.assertCanManageCalculation(actor, c);
    const isArchived = !!c.archived_at;
    if (!isArchived && c.status !== 'draft') {
      throw new BadRequestException({
        code: 'DELETE_NOT_ALLOWED',
        message: 'Kesin kayıt silinemez; önce arşivleyin veya taslak silin.',
      });
    }
    await this.calcRepo.delete({ id: c.id });
  }

  async getYollukContext(actor: User, schoolIdParam: string | undefined, teacherUserId: string | undefined) {
    if (actor.role !== UserRole.school_admin && actor.role !== UserRole.superadmin) {
      throw new ForbiddenException();
    }
    let schoolId: string | null = null;
    if (actor.role === UserRole.school_admin) schoolId = actor.school_id;
    else if (actor.role === UserRole.superadmin) schoolId = schoolIdParam?.trim() || null;
    let school: School | null = null;
    if (schoolId) {
      school = await this.schoolRepo.findOne({ where: { id: schoolId } });
    }
    let teacher: Record<string, unknown> | null = null;
    if (teacherUserId?.trim()) {
      const t = await this.userRepo.findOne({ where: { id: teacherUserId.trim() } });
      if (!t || t.role !== UserRole.teacher) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğretmen bulunamadı.' });
      if (actor.role === UserRole.school_admin && t.school_id !== actor.school_id) {
        throw new ForbiddenException();
      }
      teacher = {
        id: t.id,
        display_name: t.display_name,
        teacher_title: t.teacherTitle,
        teacher_branch: t.teacherBranch,
        evrak_defaults: t.evrakDefaults ?? null,
      };
    }
    return {
      school: school
        ? {
            id: school.id,
            name: school.name,
            city: school.city,
            district: school.district,
            principal_name: school.principalName,
            yolluk_school_template: this.buildSchoolYollukTemplate(school, await this.resolveBelgeMudurAdi(school.id)),
          }
        : null,
      teacher,
    };
  }

  /** Okul müdürü adı: belge/evrak ayarı (okul yöneticisi profili) → yoksa okul kaydındaki müdür adı */
  private async resolveBelgeMudurAdi(schoolId: string): Promise<string> {
    const admins = await this.userRepo.find({
      where: { school_id: schoolId, role: UserRole.school_admin },
      select: ['id', 'evrakDefaults'],
      order: { created_at: 'ASC' },
    });
    for (const a of admins) {
      const m = (a.evrakDefaults?.mudur_adi ?? '').trim();
      if (m) return m;
    }
    return '';
  }

  /** Okul kaydı (il/ilçe, kurum adı, müdür) → geçici bildirim üst alanları */
  private buildSchoolYollukTemplate(
    school: School,
    belgeMudurAdi: string,
  ): {
    dairesi: string;
    birim_yetkilisi_unvan: string;
    gorev_yeri: string;
  } {
    const district = (school.district ?? '').trim();
    const city = (school.city ?? '').trim();
    const name = (school.name ?? '').trim();
    const principal = (belgeMudurAdi.trim() || (school.principalName ?? '').trim());
    let dairesi = '';
    if (name) {
      dairesi = `${name} Okul Müdürlüğü`;
    } else if (district && city) {
      dairesi = `${district} / ${city} Okul Müdürlüğü`;
    } else if (district) {
      dairesi = `${district} Okul Müdürlüğü`;
    } else if (city) {
      dairesi = `${city} Okul Müdürlüğü`;
    } else {
      dairesi = 'Okul Müdürlüğü';
    }
    const birim_yetkilisi_unvan = principal ? `Okul müdürü (${principal})` : 'Okul müdürü';
    let gorev_yeri = '';
    if (name && district && city) {
      gorev_yeri = `${name} · ${district} / ${city}`;
    } else if (name && district) {
      gorev_yeri = `${name} · ${district}`;
    } else if (name && city) {
      gorev_yeri = `${name} · ${city}`;
    } else {
      gorev_yeri = name || [district, city].filter(Boolean).join(' · ');
    }
    return { dairesi, birim_yetkilisi_unvan, gorev_yeri };
  }

  async patchTeacherYollukProfile(actor: User, teacherUserId: string, patch: Record<string, unknown>) {
    if (actor.role !== UserRole.school_admin && actor.role !== UserRole.superadmin) {
      throw new ForbiddenException();
    }
    const t = await this.userRepo.findOne({ where: { id: teacherUserId } });
    if (!t || t.role !== UserRole.teacher) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Öğretmen bulunamadı.' });
    if (actor.role === UserRole.school_admin && t.school_id !== actor.school_id) throw new ForbiddenException();
    const incoming = { ...(t.evrakDefaults ?? {}) } as Record<string, unknown>;
    const prev = (incoming.yolluk_teacher && typeof incoming.yolluk_teacher === 'object' && !Array.isArray(incoming.yolluk_teacher))
      ? (incoming.yolluk_teacher as Record<string, unknown>)
      : {};
    const next = { ...prev, ...patch } as Record<string, unknown>;
    if (typeof next.iban === 'string') {
      next.iban = next.iban.replace(/\s/g, '').toUpperCase().slice(0, 34);
    }
    if (next.kadro_derecesi != null && next.kadro_derecesi !== '') {
      const n = typeof next.kadro_derecesi === 'number' ? next.kadro_derecesi : parseInt(String(next.kadro_derecesi).trim(), 10);
      if (Number.isFinite(n) && n >= 1 && n <= 15) next.kadro_derecesi = Math.floor(n);
      else delete next.kadro_derecesi;
    }
    incoming.yolluk_teacher = next;
    t.evrakDefaults = incoming as User['evrakDefaults'];
    await this.userRepo.save(t);
    return { ok: true, yolluk_teacher: next };
  }
}
