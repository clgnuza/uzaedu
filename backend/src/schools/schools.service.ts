import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { School } from './entities/school.entity';
import { UserRole, SchoolStatus } from '../types/enums';
import { CreateSchoolDto } from './dto/create-school.dto';
import { BulkCreateSchoolDto } from './dto/bulk-create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { ListSchoolsDto } from './dto/list-schools.dto';
import { paginate } from '../common/dtos/pagination.dto';
import { AuditService } from '../audit/audit.service';

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
      if (dto.type) qb.andWhere('s.type = :type', { type: dto.type });
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

  /** Kayıt ekranı: sadece aktif okullar, arama (auth gerekmez) */
  async listForRegister(search: string, limit = 20): Promise<{ items: { id: string; name: string; city: string | null; district: string | null }[] }> {
    const take = Math.min(Math.max(1, limit), 40);
    const qb = this.schoolRepo
      .createQueryBuilder('s')
      .select(['s.id', 's.name', 's.city', 's.district'])
      .where('s.status = :st', { st: SchoolStatus.aktif })
      .orderBy('s.name', 'ASC')
      .take(take);
    const q = search?.trim();
    if (q) {
      qb.andWhere('(LOWER(s.name) LIKE LOWER(:q) OR LOWER(COALESCE(s.city,\'\')) LIKE LOWER(:q) OR LOWER(COALESCE(s.district,\'\')) LIKE LOWER(:q))', {
        q: `%${q}%`,
      });
    }
    const rows = await qb.getMany();
    return {
      items: rows.map((s) => ({
        id: s.id,
        name: s.name,
        city: s.city ?? null,
        district: s.district ?? null,
      })),
    };
  }
}
