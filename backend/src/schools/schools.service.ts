import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { User } from '../users/entities/user.entity';
import { UserRole, SchoolStatus, SchoolType, SchoolSegment } from '../types/enums';
import { CreateSchoolDto } from './dto/create-school.dto';
import { BulkCreateSchoolDto } from './dto/bulk-create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { ListSchoolsDto } from './dto/list-schools.dto';
import { paginate } from '../common/dtos/pagination.dto';
import { AuditService } from '../audit/audit.service';
import { emailDomainFromInstitutional } from '../common/utils/institutional-email.util';
import { MARKET_MODULE_KEYS } from '../app-config/market-policy.defaults';
import { SCHOOL_TYPE_GROUP_MEMBERS } from './school-type-group.util';
import { ReconcileApplyDto, ReconcileSourceSchoolDto } from './dto/reconcile-schools.dto';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
    private readonly auditService: AuditService,
  ) {}

  async list(dto: ListSchoolsDto, scope: { role: UserRole; schoolId: string | null }) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.schoolRepo
      .createQueryBuilder('s')
      .orderBy('s.created_at', 'DESC');

    if (scope.role === UserRole.school_admin) {
      if (!scope.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için yetkiniz yok.' });
      qb.andWhere('s.id = :schoolId', { schoolId: scope.schoolId });
    } else {
      if (dto.city) qb.andWhere('LOWER(s.city) = LOWER(:city)', { city: dto.city.trim() });
      if (dto.district) qb.andWhere('LOWER(s.district) = LOWER(:district)', { district: dto.district.trim() });
      if (dto.status) qb.andWhere('s.status = :status', { status: dto.status });
      if (dto.type_group) {
        const types = SCHOOL_TYPE_GROUP_MEMBERS[dto.type_group];
        qb.andWhere('s.type IN (:...types)', { types });
      } else if (dto.type) {
        qb.andWhere('s.type = :type', { type: dto.type });
      }
      if (dto.segment) qb.andWhere('s.segment = :segment', { segment: dto.segment });
      if (dto.search?.trim()) {
        qb.andWhere('LOWER(s.name) LIKE LOWER(:search)', { search: `%${dto.search.trim()}%` });
      }
    }

    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async findById(id: string): Promise<School> {
    const school = await this.schoolRepo.findOne({ where: { id } });
    if (!school) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    return school;
  }

  async create(dto: CreateSchoolDto, userId?: string): Promise<School> {
    const school = this.schoolRepo.create({
      name: dto.name,
      type: dto.type,
      segment: dto.segment,
      city: dto.city ?? null,
      district: dto.district ?? null,
      website_url: dto.website_url?.trim() || null,
      phone: dto.phone?.trim() || null,
      fax: dto.fax?.trim() || null,
      institutionCode: dto.institution_code?.trim() || null,
      institutionalEmail: dto.institutional_email?.trim() || null,
      address: dto.address?.trim() || null,
      principalName: dto.principal_name?.trim() || null,
      about_description: dto.about_description?.trim() || null,
      status: dto.status ?? undefined,
      teacher_limit: dto.teacher_limit ?? 100,
    });
    const saved = await this.schoolRepo.save(school);
    await this.auditService.log({
      action: 'school_created',
      userId: userId ?? null,
      schoolId: saved.id,
      meta: { name: saved.name },
    });
    return saved;
  }

  async bulkCreate(dto: BulkCreateSchoolDto, userId?: string): Promise<{ created: number; ids: string[]; errors?: { row: number; message: string }[] }> {
    const ids: string[] = [];
    const errors: { row: number; message: string }[] = [];
    for (let i = 0; i < dto.schools.length; i++) {
      const item = dto.schools[i];
      try {
        const school = this.schoolRepo.create({
          name: item.name.trim(),
          type: item.type,
          segment: item.segment,
          city: item.city?.trim() || null,
          district: item.district?.trim() || null,
          website_url: item.website_url?.trim() || null,
          phone: item.phone?.trim() || null,
          fax: item.fax?.trim() || null,
          institutionCode: item.institution_code?.trim() || null,
          institutionalEmail: item.institutional_email?.trim() || null,
          address: item.address?.trim() || null,
          principalName: item.principal_name?.trim() || null,
          about_description: item.about_description?.trim() || null,
          status: item.status && Object.values(SchoolStatus).includes(item.status as SchoolStatus)
            ? (item.status as SchoolStatus)
            : SchoolStatus.deneme,
          teacher_limit: item.teacher_limit ?? 100,
        });
        const saved = await this.schoolRepo.save(school);
        ids.push(saved.id);
        await this.auditService.log({
          action: 'school_created',
          userId: userId ?? null,
          schoolId: saved.id,
          meta: { name: saved.name, bulk: true },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
        errors.push({ row: i + 1, message: msg });
      }
    }
    return { created: ids.length, ids, errors: errors.length > 0 ? errors : undefined };
  }

  async update(id: string, dto: UpdateSchoolDto, scope: { role: UserRole; schoolId: string | null; userId?: string }): Promise<School> {
    const school = await this.findById(id);
    if (scope.role === UserRole.school_admin && school.id !== scope.schoolId) {
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    // school_admin sadece TV ayarları ve temel bilgileri güncelleyebilir; status/type/segment superadmin'e özel
    const isSchoolAdmin = scope.role === UserRole.school_admin;
    if (dto.name !== undefined) school.name = dto.name;
    if (dto.city !== undefined) school.city = dto.city;
    if (dto.district !== undefined) school.district = dto.district;
    if (dto.website_url !== undefined) school.website_url = dto.website_url?.trim() || null;
    if (dto.phone !== undefined) school.phone = dto.phone?.trim() || null;
    if (dto.fax !== undefined) school.fax = dto.fax?.trim() || null;
    if (dto.institution_code !== undefined) school.institutionCode = dto.institution_code?.trim() || null;
    if (dto.institutional_email !== undefined) school.institutionalEmail = dto.institutional_email?.trim() || null;
    if (dto.address !== undefined) school.address = dto.address?.trim() || null;
    if (dto.map_url !== undefined) school.mapUrl = dto.map_url?.trim() || null;
    if (dto.school_image_url !== undefined) school.schoolImageUrl = dto.school_image_url?.trim() || null;
    if (dto.about_description !== undefined) school.about_description = dto.about_description?.trim() || null;
    if (dto.tv_weather_city !== undefined) school.tv_weather_city = dto.tv_weather_city;
    if (dto.tv_welcome_image_url !== undefined) school.tv_welcome_image_url = dto.tv_welcome_image_url;
    if (dto.tv_youtube_url !== undefined) school.tv_youtube_url = dto.tv_youtube_url;
    if (dto.tv_default_slide_duration !== undefined) school.tv_default_slide_duration = dto.tv_default_slide_duration;
    if (dto.tv_rss_url !== undefined) school.tv_rss_url = dto.tv_rss_url;
    if (dto.tv_rss_marquee_duration !== undefined) school.tv_rss_marquee_duration = dto.tv_rss_marquee_duration;
    if (dto.tv_rss_marquee_font_size !== undefined) school.tv_rss_marquee_font_size = dto.tv_rss_marquee_font_size;
    if (dto.tv_ticker_marquee_duration !== undefined) school.tv_ticker_marquee_duration = dto.tv_ticker_marquee_duration;
    if (dto.tv_ticker_font_size !== undefined) school.tv_ticker_font_size = dto.tv_ticker_font_size;
    if (dto.tv_ticker_text_transform !== undefined) school.tv_ticker_text_transform = dto.tv_ticker_text_transform;
    if (dto.tv_night_mode_start !== undefined) school.tv_night_mode_start = dto.tv_night_mode_start;
    if (dto.tv_night_mode_end !== undefined) school.tv_night_mode_end = dto.tv_night_mode_end;
    if (dto.tv_logo_url !== undefined) school.tv_logo_url = dto.tv_logo_url;
    if (dto.tv_card_position !== undefined) school.tv_card_position = dto.tv_card_position;
    if (dto.tv_logo_position !== undefined) school.tv_logo_position = dto.tv_logo_position;
    if (dto.tv_logo_size !== undefined) school.tv_logo_size = dto.tv_logo_size;
    if (dto.tv_theme !== undefined) school.tv_theme = dto.tv_theme;
    if (dto.tv_primary_color !== undefined) school.tv_primary_color = dto.tv_primary_color;
    if (dto.tv_visible_cards !== undefined) school.tv_visible_cards = dto.tv_visible_cards;
    if (dto.tv_countdown_card_title !== undefined) school.tv_countdown_card_title = dto.tv_countdown_card_title;
    if (dto.tv_countdown_font_size !== undefined) school.tv_countdown_font_size = dto.tv_countdown_font_size;
    if (dto.tv_countdown_separator !== undefined) school.tv_countdown_separator = dto.tv_countdown_separator;
    if (dto.tv_countdown_targets !== undefined) school.tv_countdown_targets = dto.tv_countdown_targets;
    if (dto.tv_meal_card_title !== undefined) school.tv_meal_card_title = dto.tv_meal_card_title;
    if (dto.tv_meal_font_size !== undefined) school.tv_meal_font_size = dto.tv_meal_font_size;
    if (dto.tv_meal_schedule !== undefined) school.tv_meal_schedule = dto.tv_meal_schedule;
    if (dto.tv_duty_card_title !== undefined) school.tv_duty_card_title = dto.tv_duty_card_title;
    if (dto.tv_duty_font_size !== undefined) school.tv_duty_font_size = dto.tv_duty_font_size;
    if (dto.tv_duty_schedule !== undefined) school.tv_duty_schedule = dto.tv_duty_schedule;
    if (dto.tv_gunun_sozu_rss_url !== undefined) school.tv_gunun_sozu_rss_url = dto.tv_gunun_sozu_rss_url;
    if (dto.tv_gunun_sozu_font_size !== undefined) school.tv_gunun_sozu_font_size = dto.tv_gunun_sozu_font_size;
    if (dto.tv_gunun_sozu_marquee_duration !== undefined) school.tv_gunun_sozu_marquee_duration = dto.tv_gunun_sozu_marquee_duration;
    if (dto.tv_gunun_sozu_text_transform !== undefined) school.tv_gunun_sozu_text_transform = dto.tv_gunun_sozu_text_transform;
    if (dto.tv_special_days_calendar !== undefined) school.tv_special_days_calendar = dto.tv_special_days_calendar;
    if (dto.tv_timetable_schedule !== undefined) school.tv_timetable_schedule = dto.tv_timetable_schedule;
    if (dto.tv_timetable_use_school_plan !== undefined) school.tv_timetable_use_school_plan = dto.tv_timetable_use_school_plan === true;
    if (dto.tv_birthday_card_title !== undefined) school.tv_birthday_card_title = dto.tv_birthday_card_title;
    if (dto.tv_birthday_font_size !== undefined) school.tv_birthday_font_size = dto.tv_birthday_font_size;
    if (dto.tv_birthday_calendar !== undefined) school.tv_birthday_calendar = dto.tv_birthday_calendar;
    if (dto.tv_now_in_class_bar_title !== undefined) school.tv_now_in_class_bar_title = dto.tv_now_in_class_bar_title;
    if (dto.tv_now_in_class_bar_font_size !== undefined) school.tv_now_in_class_bar_font_size = dto.tv_now_in_class_bar_font_size;
    if (dto.tv_now_in_class_bar_marquee_duration !== undefined) school.tv_now_in_class_bar_marquee_duration = dto.tv_now_in_class_bar_marquee_duration;
    if (dto.tv_allowed_ips !== undefined) school.tv_allowed_ips = dto.tv_allowed_ips;
    if (dto.smart_board_floor_plan_url !== undefined) school.smartBoardFloorPlanUrl = dto.smart_board_floor_plan_url?.trim() || null;
    if (dto.smart_board_floor_plans !== undefined) {
      const plans = Array.isArray(dto.smart_board_floor_plans)
        ? dto.smart_board_floor_plans
            .filter((p) => p && typeof p.label === 'string' && typeof p.url === 'string' && p.url.trim())
            .map((p) => ({ label: String(p.label).trim() || 'Kat', url: String(p.url).trim() }))
        : [];
      school.smartBoardFloorPlans = plans;
    }
    if (dto.smart_board_auto_authorize !== undefined) school.smartBoardAutoAuthorize = dto.smart_board_auto_authorize;
    if (dto.smart_board_session_timeout_minutes !== undefined) school.smartBoardSessionTimeoutMinutes = dto.smart_board_session_timeout_minutes;
    if (dto.smart_board_restrict_to_own_classes !== undefined) school.smartBoardRestrictToOwnClasses = dto.smart_board_restrict_to_own_classes;
    if (dto.smart_board_notify_on_disconnect !== undefined) school.smartBoardNotifyOnDisconnect = dto.smart_board_notify_on_disconnect;
    if (dto.smart_board_auto_disconnect_lesson_end !== undefined) school.smartBoardAutoDisconnectLessonEnd = dto.smart_board_auto_disconnect_lesson_end;
    if (dto.duty_start_time !== undefined) school.duty_start_time = dto.duty_start_time?.trim() || null;
    if (dto.duty_end_time !== undefined) school.duty_end_time = dto.duty_end_time?.trim() || null;
    if (dto.duty_teblig_duty_template !== undefined) school.duty_teblig_duty_template = dto.duty_teblig_duty_template?.trim() || null;
    if (dto.duty_teblig_coverage_template !== undefined) school.duty_teblig_coverage_template = dto.duty_teblig_coverage_template?.trim() || null;
    if (dto.merge_teacher_on_name_match !== undefined) school.mergeTeacherOnNameMatch = dto.merge_teacher_on_name_match === true;
    if (!isSchoolAdmin) {
      if (dto.type !== undefined) school.type = dto.type;
      if (dto.segment !== undefined) school.segment = dto.segment;
      if (dto.status !== undefined) school.status = dto.status;
      if (dto.teacher_limit !== undefined) school.teacher_limit = dto.teacher_limit;
      if (dto.enabled_modules !== undefined) school.enabled_modules = dto.enabled_modules;
    }
    const saved = await this.schoolRepo.save(school);
    await this.auditService.log({
      action: 'school_updated',
      userId: scope.userId ?? null,
      schoolId: id,
      meta: { fields: Object.keys(dto) },
    });
    return saved;
  }

  /**
   * Tüm okullarda tek bir modülü açar veya kapatır (web-admin tek okul toggle ile aynı mantık).
   */
  async bulkToggleEnabledModuleForAllSchools(
    moduleKey: string,
    enable: boolean,
    userId?: string,
  ): Promise<{ updated: number; total: number }> {
    if (!MARKET_MODULE_KEYS.includes(moduleKey as (typeof MARKET_MODULE_KEYS)[number])) {
      throw new BadRequestException({ code: 'INVALID_MODULE', message: 'Geçersiz modül anahtarı.' });
    }
    const keys = [...MARKET_MODULE_KEYS];
    const computeNext = (current: string[] | null | undefined): string[] | null => {
      if (enable) {
        if (current === null || current === undefined) return null;
        if (current.includes(moduleKey)) return current;
        return [...current, moduleKey];
      }
      if (current === null || current === undefined) {
        return keys.filter((k) => k !== moduleKey);
      }
      return current.filter((k) => k !== moduleKey);
    };
    const sameState = (a: string[] | null | undefined, b: string[] | null): boolean =>
      JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

    const schools = await this.schoolRepo.find({ select: ['id', 'enabled_modules'] });
    let updated = 0;
    await this.schoolRepo.manager.transaction(async (em) => {
      for (const school of schools) {
        const next = computeNext(school.enabled_modules);
        if (sameState(school.enabled_modules, next)) continue;
        await em.update(School, { id: school.id }, { enabled_modules: next });
        updated += 1;
      }
    });
    await this.auditService.log({
      action: 'school_bulk_enabled_modules',
      userId: userId ?? null,
      schoolId: null,
      meta: { module_key: moduleKey, enable, schools_updated: updated, total: schools.length },
    });
    return { updated, total: schools.length };
  }

  /** Kayıt ekranı: aktif okullar, arama (auth gerekmez) */
  async listForRegister(
    search: string,
    limit = 20,
    filters?: { city?: string; district?: string; type?: SchoolType },
  ): Promise<{
    items: {
      id: string;
      name: string;
      city: string | null;
      district: string | null;
      type: string;
      institutional_domain: string | null;
    }[];
  }> {
    const take = Math.min(Math.max(1, limit), 40);
    const qb = this.schoolRepo
      .createQueryBuilder('s')
      .select(['s.id', 's.name', 's.city', 's.district', 's.institutionalEmail', 's.type'])
      .where('s.status = :st', { st: SchoolStatus.aktif })
      .orderBy('s.name', 'ASC')
      .take(take);
    const q = search?.trim();
    if (q) {
      qb.andWhere('(LOWER(s.name) LIKE LOWER(:q) OR LOWER(COALESCE(s.city,\'\')) LIKE LOWER(:q) OR LOWER(COALESCE(s.district,\'\')) LIKE LOWER(:q))', {
        q: `%${q}%`,
      });
    }
    if (filters?.city?.trim()) {
      qb.andWhere('LOWER(s.city) = LOWER(:fcity)', { fcity: filters.city.trim() });
    }
    if (filters?.district?.trim()) {
      qb.andWhere('LOWER(s.district) = LOWER(:fdist)', { fdist: filters.district.trim() });
    }
    if (filters?.type) {
      qb.andWhere('s.type = :ftype', { ftype: filters.type });
    }
    const rows = await qb.getMany();
    return {
      items: rows.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city ?? null,
        district: s.district ?? null,
        type: s.type,
        institutional_domain: emailDomainFromInstitutional(s.institutionalEmail),
      })),
    };
  }

  async findActiveByInstitutionCode(codeRaw: string): Promise<School | null> {
    const code = codeRaw?.trim();
    if (!code) return null;
    return this.schoolRepo.findOne({
      where: { institutionCode: code, status: SchoolStatus.aktif },
    });
  }

  private normalizeInstitutionCode(raw: string | null | undefined): string | null {
    const t = raw?.trim();
    if (!t || !/^\d{4,16}$/.test(t)) return null;
    return t;
  }

  private coerceSchoolType(raw: string | null | undefined): SchoolType {
    const t = String(raw ?? 'lise').toLowerCase().trim();
    return (Object.values(SchoolType) as string[]).includes(t) ? (t as SchoolType) : SchoolType.lise;
  }

  private coerceSchoolSegment(raw: string | null | undefined): SchoolSegment {
    const s = String(raw ?? 'devlet').toLowerCase().trim();
    return s === SchoolSegment.ozel ? SchoolSegment.ozel : SchoolSegment.devlet;
  }

  private coerceStatusFromSource(raw: string | null | undefined): SchoolStatus {
    const s = String(raw ?? '').toLowerCase().trim();
    if (s === SchoolStatus.aktif || s === SchoolStatus.deneme || s === SchoolStatus.askida) return s as SchoolStatus;
    return SchoolStatus.deneme;
  }

  private desiredFromSource(row: ReconcileSourceSchoolDto) {
    return {
      name: row.name.trim(),
      type: this.coerceSchoolType(row.type),
      segment: this.coerceSchoolSegment(row.segment),
      city: row.city?.trim() || null,
      district: row.district?.trim() || null,
      address: row.address?.trim() || null,
      website_url: row.website_url?.trim() || null,
      phone: row.phone?.trim() || null,
      fax: row.fax?.trim() || null,
      institutional_email: row.institutional_email?.trim() || null,
      principal_name: row.principal_name?.trim() || null,
    };
  }

  private comparableFromSchool(s: School) {
    return {
      name: s.name,
      type: s.type,
      segment: s.segment,
      city: s.city ?? null,
      district: s.district ?? null,
      address: s.address ?? null,
      website_url: s.website_url ?? null,
      phone: s.phone ?? null,
      fax: s.fax ?? null,
      institutional_email: s.institutionalEmail ?? null,
      principal_name: s.principalName ?? null,
    };
  }

  /**
   * Kurum kodu (MEB) üzerinden kaynak liste ile DB karşılaştırması — yeni / değişen / kaynakta olmayan.
   */
  async reconcilePreview(sources: ReconcileSourceSchoolDto[]) {
    type Change = { field: string; from: string | null; to: string | null };
    const skipped_no_code: { row_index: number; name: string }[] = [];
    const codeFirstIndex = new Map<string, number>();
    const duplicate_source_codes: string[] = [];

    for (let i = 0; i < sources.length; i++) {
      const code = this.normalizeInstitutionCode(sources[i].institution_code);
      if (!code) {
        skipped_no_code.push({ row_index: i, name: sources[i].name?.trim() || '' });
        continue;
      }
      if (codeFirstIndex.has(code)) {
        if (!duplicate_source_codes.includes(code)) duplicate_source_codes.push(code);
      } else {
        codeFirstIndex.set(code, i);
      }
    }

    const codes = [...codeFirstIndex.keys()];
    const dbSchools = codes.length ? await this.schoolRepo.find({ where: { institutionCode: In(codes) } }) : [];

    const byCode = new Map<string, School[]>();
    for (const s of dbSchools) {
      const c = s.institutionCode!;
      if (!byCode.has(c)) byCode.set(c, []);
      byCode.get(c)!.push(s);
    }

    const db_duplicate_codes: { code: string; school_ids: string[] }[] = [];
    for (const [code, list] of byCode) {
      if (list.length > 1) db_duplicate_codes.push({ code, school_ids: list.map((x) => x.id) });
    }

    const sourceCodeSet = new Set(codes);
    let onlyInDbList: School[];
    if (codes.length === 0) {
      onlyInDbList = await this.schoolRepo
        .createQueryBuilder('s')
        .where('s.institutionCode IS NOT NULL')
        .andWhere("TRIM(s.institutionCode) <> ''")
        .getMany();
    } else {
      onlyInDbList = await this.schoolRepo
        .createQueryBuilder('s')
        .where('s.institutionCode IS NOT NULL')
        .andWhere('s.institutionCode NOT IN (:...codes)', { codes })
        .getMany();
    }

    const only_in_db = onlyInDbList.map((s) => ({
      school_id: s.id,
      institution_code: s.institutionCode!,
      name: s.name,
      status: s.status,
    }));

    const syncKeys = [
      'name',
      'type',
      'segment',
      'city',
      'district',
      'address',
      'website_url',
      'phone',
      'fax',
      'institutional_email',
      'principal_name',
    ] as const;

    const to_create: { row_index: number; institution_code: string }[] = [];
    const to_update: { row_index: number; school_id: string; institution_code: string; changes: Change[] }[] = [];
    const unchanged: { row_index: number; school_id: string; institution_code: string }[] = [];

    for (const [code, rowIndex] of codeFirstIndex) {
      const row = sources[rowIndex];
      const desired = this.desiredFromSource(row);
      const matches = byCode.get(code) ?? [];
      if (matches.length === 0) {
        to_create.push({ row_index: rowIndex, institution_code: code });
        continue;
      }
      const school = matches[0];
      const cur = this.comparableFromSchool(school);
      const changes: Change[] = [];
      for (const k of syncKeys) {
        const a = cur[k];
        const b = desired[k];
        const as = a != null ? String(a) : '';
        const bs = b != null ? String(b) : '';
        if (as !== bs) {
          changes.push({ field: k, from: a != null ? String(a) : null, to: b != null ? String(b) : null });
        }
      }
      if (changes.length) {
        to_update.push({ row_index: rowIndex, school_id: school.id, institution_code: code, changes });
      } else {
        unchanged.push({ row_index: rowIndex, school_id: school.id, institution_code: code });
      }
    }

    return {
      summary: {
        source_rows: sources.length,
        source_rows_with_code: codes.length,
        skipped_no_code: skipped_no_code.length,
        duplicate_source_codes,
        db_duplicate_codes,
        to_create: to_create.length,
        to_update: to_update.length,
        unchanged: unchanged.length,
        only_in_db: only_in_db.length,
      },
      to_create,
      to_update,
      unchanged,
      only_in_db,
      skipped_no_code,
    };
  }

  async reconcileApply(dto: ReconcileApplyDto, userId?: string) {
    const preview = await this.reconcilePreview(dto.schools);
    let created = 0;
    let updated = 0;
    let marked_askida = 0;
    const errors: string[] = [];

    await this.schoolRepo.manager.transaction(async (em) => {
      const repo = em.getRepository(School);

      if (dto.options.create_new) {
        for (const item of preview.to_create) {
          try {
            const row = dto.schools[item.row_index];
            const d = this.desiredFromSource(row);
            const tl =
              row.teacher_limit != null && Number.isFinite(Number(row.teacher_limit))
                ? Math.max(1, Math.floor(Number(row.teacher_limit)))
                : 100;
            const ent = repo.create({
              name: d.name,
              type: d.type,
              segment: d.segment,
              city: d.city,
              district: d.district,
              website_url: d.website_url,
              phone: d.phone,
              fax: d.fax,
              institutionCode: item.institution_code,
              institutionalEmail: d.institutional_email,
              address: d.address,
              principalName: d.principal_name,
              about_description: row.about_description?.trim() || null,
              status: this.coerceStatusFromSource(row.status),
              teacher_limit: tl,
            });
            const saved = await repo.save(ent);
            created += 1;
            await this.auditService.log({
              action: 'school_created',
              userId: userId ?? null,
              schoolId: saved.id,
              meta: { name: saved.name, reconcile: true, institution_code: item.institution_code },
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
            errors.push(`Satır ${item.row_index + 1} (yeni): ${msg}`);
          }
        }
      }

      if (dto.options.apply_updates) {
        for (const u of preview.to_update) {
          try {
            const row = dto.schools[u.row_index];
            const d = this.desiredFromSource(row);
            const school = await repo.findOne({ where: { id: u.school_id } });
            if (!school) continue;
            school.name = d.name;
            school.type = d.type;
            school.segment = d.segment;
            school.city = d.city;
            school.district = d.district;
            school.address = d.address;
            school.website_url = d.website_url;
            school.phone = d.phone;
            school.fax = d.fax;
            school.institutionalEmail = d.institutional_email;
            school.principalName = d.principal_name;
            await repo.save(school);
            updated += 1;
            await this.auditService.log({
              action: 'school_updated',
              userId: userId ?? null,
              schoolId: school.id,
              meta: { reconcile: true, fields: u.changes.map((c) => c.field) },
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
            errors.push(`Satır ${u.row_index + 1} (güncelleme): ${msg}`);
          }
        }
      }

      if (dto.options.mark_missing_in_source_askida) {
        for (const o of preview.only_in_db) {
          const school = await repo.findOne({ where: { id: o.school_id } });
          if (!school || school.status === SchoolStatus.askida) continue;
          school.status = SchoolStatus.askida;
          await repo.save(school);
          marked_askida += 1;
          await this.auditService.log({
            action: 'school_updated',
            userId: userId ?? null,
            schoolId: school.id,
            meta: { reconcile: true, mark_missing_askida: true, institution_code: o.institution_code },
          });
        }
      }
    });

    await this.auditService.log({
      action: 'school_reconcile_applied',
      userId: userId ?? null,
      schoolId: null,
      meta: {
        created,
        updated,
        marked_askida,
        options: dto.options,
        error_count: errors.length,
      },
    });

    return { created, updated, marked_askida, errors: errors.length ? errors : undefined };
  }

  async countSchoolAdmins(schoolId: string): Promise<number> {
    return this.schoolRepo.manager.getRepository(User).count({
      where: { school_id: schoolId, role: UserRole.school_admin },
    });
  }
}
