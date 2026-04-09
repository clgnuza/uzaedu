import { Controller, Get, Post, Param, Query, Body, Req, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XMLParser } from 'fast-xml-parser';
import { AnnouncementsService } from './announcements.service';
import { TvDevicesService } from '../tv-devices/tv-devices.service';
import { SmartBoardService } from '../smart-board/smart-board.service';
import { TeacherTimetableService } from '../teacher-timetable/teacher-timetable.service';
import { School } from '../schools/entities/school.entity';
import {
  getTvAnnouncementsCacheEntry,
  pruneTvAnnouncementsCache,
  tvAnnouncementsCacheSet,
} from './tv-announcements-cache';

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? req.ip ?? '';
  if (req.headers['x-real-ip']) return String(req.headers['x-real-ip']).trim();
  return req.ip ?? '';
}

function isIpAllowed(clientIp: string, allowedIps: string | null | undefined): boolean {
  if (!allowedIps?.trim()) return true;
  const parts = allowedIps.split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return true;
  for (const part of parts) {
    if (clientIp === part) return true;
    if (part.endsWith('.') && clientIp.startsWith(part)) return true;
  }
  return false;
}

/** Hava durumu (Open-Meteo) – şehir adı ile */
type WeatherResult = { city: string; temp: string; code: number } | null;

function toTvItem(a: { id: string; title: string; summary: string | null; body: string | null }): object {
  return { id: a.id, title: a.title, summary: a.summary, body: a.body };
}

function toTvItems(items: Array<{
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  category: string;
  show_on_tv?: boolean;
  tv_audience?: string | null;
  attachment_url?: string | null;
  youtube_url?: string | null;
  tv_slide_duration_seconds?: number | null;
  tv_wait_for_video_end?: boolean;
  creator?: { display_name: string | null } | null;
}>): object[] {
  return items.map((a) => ({
    id: a.id,
    title: a.title,
    summary: a.summary,
    body: a.body,
    category: a.category ?? 'general',
    show_on_tv: a.show_on_tv ?? true,
    tv_audience: a.tv_audience ?? 'both',
    attachment_url: a.attachment_url ?? null,
    youtube_url: a.youtube_url ?? null,
    tv_slide_duration_seconds: a.tv_slide_duration_seconds ?? null,
    tv_wait_for_video_end: a.tv_wait_for_video_end ?? false,
    creator_display_name: a.creator?.display_name ?? null,
  }));
}

@Controller('tv')
export class TvPublicController {
  constructor(
    private readonly announcementsService: AnnouncementsService,
    private readonly tvDevicesService: TvDevicesService,
    private readonly smartBoardService: SmartBoardService,
    private readonly teacherTimetableService: TeacherTimetableService,
    @InjectRepository(School)
    private readonly schoolRepo: Repository<School>,
  ) {}

  /** TV yanıtındaki okul bloğu (tv_visible_cards vb. ayarlar anında yansısın diye önbellek isabetinde de yeniden okunur). */
  private async buildTvSchoolPayload(schoolId: string): Promise<
    | {
        id: string;
        name: string;
        tv_weather_city?: string | null;
        tv_welcome_image_url?: string | null;
        tv_youtube_url?: string | null;
        tv_default_slide_duration?: number | null;
        tv_rss_url?: string | null;
        tv_rss_marquee_duration?: number | null;
        tv_rss_marquee_font_size?: number | null;
        tv_ticker_marquee_duration?: number | null;
        tv_ticker_font_size?: number | null;
        tv_ticker_text_transform?: string | null;
        tv_night_mode_start?: string | null;
        tv_night_mode_end?: string | null;
        tv_logo_url?: string | null;
        tv_card_position?: string | null;
        tv_logo_position?: string | null;
        tv_logo_size?: string | null;
        tv_theme?: string | null;
        tv_primary_color?: string | null;
        tv_visible_cards?: string | null;
        tv_countdown_card_title?: string | null;
        tv_countdown_font_size?: number | null;
        tv_countdown_separator?: string | null;
        tv_countdown_targets?: string | null;
        tv_meal_card_title?: string | null;
        tv_meal_font_size?: number | null;
        tv_meal_schedule?: string | null;
        tv_duty_card_title?: string | null;
        tv_duty_font_size?: number | null;
        tv_duty_schedule?: string | null;
        tv_gunun_sozu_rss_url?: string | null;
        tv_gunun_sozu_font_size?: number | null;
        tv_gunun_sozu_marquee_duration?: number | null;
        tv_gunun_sozu_text_transform?: string | null;
        tv_special_days_calendar?: string | null;
        tv_timetable_schedule?: string | null;
        tv_birthday_card_title?: string | null;
        tv_birthday_font_size?: number | null;
        tv_birthday_calendar?: string | null;
        tv_now_in_class_bar_title?: string | null;
        tv_now_in_class_bar_font_size?: number | null;
        tv_now_in_class_bar_marquee_duration?: number | null;
      }
    | undefined
  > {
    const s = await this.schoolRepo.findOne({
      where: { id: schoolId },
      select: [
        'id',
        'name',
        'tv_weather_city',
        'tv_welcome_image_url',
        'tv_youtube_url',
        'tv_default_slide_duration',
        'tv_rss_url',
        'tv_rss_marquee_duration',
        'tv_rss_marquee_font_size',
        'tv_ticker_marquee_duration',
        'tv_ticker_font_size',
        'tv_ticker_text_transform',
        'tv_night_mode_start',
        'tv_night_mode_end',
        'tv_logo_url',
        'tv_card_position',
        'tv_logo_position',
        'tv_logo_size',
        'tv_theme',
        'tv_primary_color',
        'tv_visible_cards',
        'tv_countdown_card_title',
        'tv_countdown_font_size',
        'tv_countdown_separator',
        'tv_countdown_targets',
        'tv_meal_card_title',
        'tv_meal_font_size',
        'tv_meal_schedule',
        'tv_duty_card_title',
        'tv_duty_font_size',
        'tv_duty_schedule',
        'tv_gunun_sozu_rss_url',
        'tv_gunun_sozu_font_size',
        'tv_gunun_sozu_marquee_duration',
        'tv_gunun_sozu_text_transform',
        'tv_special_days_calendar',
        'tv_timetable_schedule',
        'tv_timetable_use_school_plan',
        'tv_birthday_card_title',
        'tv_birthday_font_size',
        'tv_birthday_calendar',
        'tv_now_in_class_bar_title',
        'tv_now_in_class_bar_font_size',
        'tv_now_in_class_bar_marquee_duration',
      ],
    });
    if (!s) return undefined;
    let tvTimetable = s.tv_timetable_schedule;
    const useSchoolPlan = s.tv_timetable_use_school_plan !== false;
    if (useSchoolPlan && schoolId?.trim()) {
      try {
        const built = await this.teacherTimetableService.buildTvTimetableScheduleJsonForTv(schoolId.trim());
        tvTimetable = built;
      } catch {
        tvTimetable = null;
      }
    }
    return {
      id: s.id,
      name: s.name,
      tv_weather_city: s.tv_weather_city,
      tv_welcome_image_url: s.tv_welcome_image_url,
      tv_youtube_url: s.tv_youtube_url,
      tv_default_slide_duration: s.tv_default_slide_duration,
      tv_rss_url: s.tv_rss_url,
      tv_rss_marquee_duration: s.tv_rss_marquee_duration,
      tv_rss_marquee_font_size: s.tv_rss_marquee_font_size,
      tv_ticker_marquee_duration: s.tv_ticker_marquee_duration,
      tv_ticker_font_size: s.tv_ticker_font_size,
      tv_ticker_text_transform: s.tv_ticker_text_transform,
      tv_night_mode_start: s.tv_night_mode_start,
      tv_night_mode_end: s.tv_night_mode_end,
      tv_logo_url: s.tv_logo_url,
      tv_card_position: s.tv_card_position,
      tv_logo_position: s.tv_logo_position,
      tv_logo_size: s.tv_logo_size,
      tv_theme: s.tv_theme,
      tv_primary_color: s.tv_primary_color,
      tv_visible_cards: s.tv_visible_cards,
      tv_countdown_card_title: s.tv_countdown_card_title,
      tv_countdown_font_size: s.tv_countdown_font_size,
      tv_countdown_separator: s.tv_countdown_separator,
      tv_countdown_targets: s.tv_countdown_targets,
      tv_meal_card_title: s.tv_meal_card_title,
      tv_meal_font_size: s.tv_meal_font_size,
      tv_meal_schedule: s.tv_meal_schedule,
      tv_duty_card_title: s.tv_duty_card_title,
      tv_duty_font_size: s.tv_duty_font_size,
      tv_duty_schedule: s.tv_duty_schedule,
      tv_gunun_sozu_rss_url: s.tv_gunun_sozu_rss_url,
      tv_gunun_sozu_font_size: s.tv_gunun_sozu_font_size,
      tv_gunun_sozu_marquee_duration: s.tv_gunun_sozu_marquee_duration,
      tv_gunun_sozu_text_transform: s.tv_gunun_sozu_text_transform,
      tv_special_days_calendar: s.tv_special_days_calendar,
      tv_timetable_schedule: tvTimetable,
      tv_birthday_card_title: s.tv_birthday_card_title,
      tv_birthday_font_size: s.tv_birthday_font_size,
      tv_birthday_calendar: s.tv_birthday_calendar,
      tv_now_in_class_bar_title: s.tv_now_in_class_bar_title,
      tv_now_in_class_bar_font_size: s.tv_now_in_class_bar_font_size,
      tv_now_in_class_bar_marquee_duration: s.tv_now_in_class_bar_marquee_duration,
    };
  }

  /**
   * Son kullanıcı TV ekranları için herkese açık duyuru listesi.
   * Örn: GET /api/tv/announcements/corridor
   * Query: school_id (opsiyonel) – verilirse sadece o okulun duyuruları ve okul adı döner.
   */
  @Get('announcements/:audience')
  async listForAudience(
    @Req() req: Request,
    @Param('audience') audience: string,
    @Query('school_id') schoolId?: string,
    @Query('device_id') deviceId?: string,
    @Query('nocache') nocache?: string,
  ) {
    if (schoolId?.trim()) {
      const school = await this.schoolRepo.findOne({
        where: { id: schoolId.trim() },
        select: ['tv_allowed_ips'],
      });
      if (school?.tv_allowed_ips) {
        const clientIp = getClientIp(req);
        if (!isIpAllowed(clientIp, school.tv_allowed_ips)) {
          throw new ForbiddenException({
            code: 'TV_ACCESS_RESTRICTED',
            message: 'TV sayfası sadece okul ağından erişilebilir.',
          });
        }
      }
    }

    const cacheKey = `${audience}|${schoolId?.trim() ?? ''}|${deviceId?.trim() ?? ''}`;
    if (nocache !== '1') {
      pruneTvAnnouncementsCache();
      const hit = getTvAnnouncementsCacheEntry(cacheKey);
      if (hit && hit.expires > Date.now()) {
        if (schoolId?.trim()) {
          const freshSchool = await this.buildTvSchoolPayload(schoolId.trim());
          return { ...hit.payload, school: freshSchool } as Record<string, unknown>;
        }
        return hit.payload;
      }
    }

    const audienceVal =
      audience === 'teachers'
        ? 'teachers'
        : audience === 'corridor'
          ? 'corridor'
          : audience === 'classroom'
            ? 'classroom'
            : undefined;
    const rawItems = await this.announcementsService.listForTv(audienceVal, schoolId);
    const items = toTvItems(rawItems);

    const urgent = await this.announcementsService.getUrgentOverride(schoolId);

    const school = schoolId?.trim() ? await this.buildTvSchoolPayload(schoolId.trim()) : undefined;

    let current_slot: { lesson_num: number; subject: string; teacher_name: string; class_section: string | null } | null = null;
    if (audience === 'classroom' && schoolId?.trim() && deviceId?.trim()) {
      current_slot =
        (await this.smartBoardService.getDisplaySlotForDevice(schoolId.trim(), deviceId.trim())) ?? null;
    }

    const payload = {
      items,
      school,
      urgent: urgent ? toTvItem(urgent) : null,
      current_slot,
    };
    if (nocache !== '1') {
      tvAnnouncementsCacheSet(cacheKey, payload as Record<string, unknown>);
    }
    return payload;
  }

  /**
   * RSS feed – okul tv_rss_url'den haber başlıklarını çeker (TRT Haber, MEB vb.).
   * GET /api/tv/rss-feed?school_id=xxx
   * Yanıt: { items: [{ title }] } veya { items: [] } (hata/boş).
   */
  @Get('rss-feed')
  async getRssFeed(@Req() req: Request, @Query('school_id') schoolId?: string): Promise<{ items: Array<{ title: string }> }> {
    if (!schoolId?.trim()) return { items: [] };
    const schoolForIp = await this.schoolRepo.findOne({
      where: { id: schoolId.trim() },
      select: ['tv_allowed_ips'],
    });
    if (schoolForIp?.tv_allowed_ips) {
      const clientIp = getClientIp(req);
      if (!isIpAllowed(clientIp, schoolForIp.tv_allowed_ips)) {
        throw new ForbiddenException({
          code: 'TV_ACCESS_RESTRICTED',
          message: 'TV sayfası sadece okul ağından erişilebilir.',
        });
      }
    }
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId.trim() },
      select: ['tv_rss_url'],
    });
    const url = school?.tv_rss_url?.trim();
    if (!url) return { items: [] };
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'OgretmenPro-TV/1.0',
          Accept: 'application/rss+xml, application/xml; charset=utf-8',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { items: [] };
      const buffer = await res.arrayBuffer();
      const charset = res.headers.get('content-type')?.match(/charset=([^;]+)/i)?.[1]?.trim()?.toLowerCase() ?? 'utf-8';
      const xml = new TextDecoder(charset === 'utf-8' || charset === 'utf8' ? 'utf-8' : 'iso-8859-9').decode(buffer);
      const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: true,
      });
      const obj = parser.parse(xml);
      const channel = obj?.rss?.channel ?? obj?.feed;
      const rawItems = channel?.item ?? channel?.entry ?? [];
      const items = (Array.isArray(rawItems) ? rawItems : [rawItems])
        .filter(Boolean)
        .map((entry: Record<string, unknown>) => {
          const t = entry.title;
          let title = '';
          if (typeof t === 'string') title = t;
          else if (t && typeof t === 'object' && '#text' in t) title = String((t as { '#text'?: string })['#text'] ?? '');
          else if (t && typeof t === 'object' && '_' in t) title = String((t as { _?: string })._ ?? '');
          else if (t != null) title = String(t);
          return { title: title.trim() };
        })
        .filter((x: { title: string }) => x.title.length > 0)
        .slice(0, 20);
      return { items };
    } catch {
      return { items: [] };
    }
  }

  /**
   * Günün Sözü feed – okul tv_gunun_sozu_rss_url'den sözleri çeker.
   * Desteklenen formatlar:
   * - Standart: title=söz, description=yazar
   * - Webnode (emrah-okur vb): title=tarih, description="söz...    Yazar"
   * GET /api/tv/quote-feed?school_id=xxx
   * Yanıt: { items: [{ quote, author? }] } veya { items: [] }.
   */
  @Get('quote-feed')
  async getQuoteFeed(@Req() req: Request, @Query('school_id') schoolId?: string): Promise<{ items: Array<{ quote: string; author?: string }> }> {
    if (!schoolId?.trim()) return { items: [] };
    const schoolForIp = await this.schoolRepo.findOne({
      where: { id: schoolId.trim() },
      select: ['tv_allowed_ips'],
    });
    if (schoolForIp?.tv_allowed_ips) {
      const clientIp = getClientIp(req);
      if (!isIpAllowed(clientIp, schoolForIp.tv_allowed_ips)) {
        throw new ForbiddenException({
          code: 'TV_ACCESS_RESTRICTED',
          message: 'TV sayfası sadece okul ağından erişilebilir.',
        });
      }
    }
    const school = await this.schoolRepo.findOne({
      where: { id: schoolId.trim() },
      select: ['tv_gunun_sozu_rss_url'],
    });
    const url = school?.tv_gunun_sozu_rss_url?.trim();
    if (!url) return { items: [] };
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'OgretmenPro-TV/1.0',
          Accept: 'application/rss+xml, application/xml; charset=utf-8',
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { items: [] };
      const buffer = await res.arrayBuffer();
      const charset = res.headers.get('content-type')?.match(/charset=([^;]+)/i)?.[1]?.trim()?.toLowerCase() ?? 'utf-8';
      const xml = new TextDecoder(charset === 'utf-8' || charset === 'utf8' ? 'utf-8' : 'iso-8859-9').decode(buffer);
      const parser = new XMLParser({
        ignoreAttributes: false,
        trimValues: true,
      });
      const obj = parser.parse(xml);
      const channel = obj?.rss?.channel ?? obj?.feed;
      const rawItems = channel?.item ?? channel?.entry ?? [];
      const arr = Array.isArray(rawItems) ? rawItems : [rawItems];
      const dateLike = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/;
      const items = arr
        .filter(Boolean)
        .map((entry: Record<string, unknown>) => {
          const getStr = (v: unknown): string => {
            if (typeof v === 'string') return v;
            if (v && typeof v === 'object' && '#text' in v) return String((v as { '#text'?: string })['#text'] ?? '');
            if (v && typeof v === 'object' && '_' in v) return String((v as { _?: string })._ ?? '');
            return v != null ? String(v) : '';
          };
          const rawTitle = getStr(entry.title).trim();
          const rawDescHtml = getStr(entry.description ?? entry.summary ?? entry.content).replace(/<[^>]+>/g, '');
          const rawDesc = rawDescHtml.replace(/\s+/g, ' ').trim();
          let quote = '';
          let author = '';
          const descWithSpaces = rawDescHtml.replace(/&nbsp;/gi, ' ').replace(/\r\n/g, '\n').trim();
          if (rawDesc.length > 10 && dateLike.test(rawTitle)) {
            const parts = descWithSpaces.split(/\s{2,}|\n\s*/).map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
            if (parts.length >= 2) {
              const last = parts[parts.length - 1] ?? '';
              if (last.length > 0 && last.length < 80 && !/[,;:!?]/.test(last)) {
                author = last;
                quote = parts.slice(0, -1).join(' ').trim();
              }
            }
            if (!quote) quote = rawDesc;
          } else {
            quote = rawDesc.length > rawTitle.length ? rawDesc : rawTitle;
            if (rawDesc.length > 0 && rawDesc !== quote) author = rawDesc.slice(0, 100);
          }
          quote = quote.trim();
          return { quote, author: author || undefined };
        })
        .filter((x: { quote: string }) => x.quote.length > 0)
        .slice(0, 30);
      return { items };
    } catch {
      return { items: [] };
    }
  }

  /**
   * Otomatik hava durumu – Open-Meteo API.
   * GET /api/tv/weather?city=Antalya
   * Yanıt: { city, temp, code } veya null (hata/şehir bulunamadı).
   */
  @Get('weather')
  async getWeather(@Query('city') city?: string): Promise<WeatherResult> {
    if (!city || !city.trim()) return null;
    const name = city.trim();
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=tr`,
      );
      const geoData = (await geoRes.json()) as { results?: Array<{ latitude: number; longitude: number; name: string }> };
      const loc = geoData.results?.[0];
      if (!loc) return null;
      const forecastRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,weather_code&timezone=Europe/Istanbul`,
      );
      const forecast = (await forecastRes.json()) as {
        current?: { temperature_2m: number; weather_code: number };
      };
      const current = forecast.current;
      if (!current) return null;
      return {
        city: loc.name,
        temp: `${Math.round(current.temperature_2m)}°`,
        code: current.weather_code,
      };
    } catch {
      return null;
    }
  }

  /**
   * TV eşleştirme ekranı – okul adı/konum (JWT yok). tv_allowed_ips varsa duyuru listesiyle aynı IP kuralı.
   * GET /api/tv/school-info?school_id=uuid
   */
  @Get('school-info')
  async getSchoolInfoForTvPairing(@Req() req: Request, @Query('school_id') schoolId?: string) {
    const sid = schoolId?.trim();
    if (!sid) {
      return { ok: false as const, message: 'school_id gerekli' };
    }
    const school = await this.schoolRepo.findOne({
      where: { id: sid },
      select: ['id', 'name', 'city', 'district', 'tv_allowed_ips'],
    });
    if (!school) {
      return { ok: false as const, message: 'Okul bulunamadı' };
    }
    if (school.tv_allowed_ips) {
      const clientIp = getClientIp(req);
      if (!isIpAllowed(clientIp, school.tv_allowed_ips)) {
        throw new ForbiddenException({
          code: 'TV_ACCESS_RESTRICTED',
          message: 'TV sayfası sadece okul ağından erişilebilir.',
        });
      }
    }
    return {
      ok: true as const,
      school: {
        id: school.id,
        name: school.name,
        city: school.city,
        district: school.district,
      },
    };
  }

  /**
   * Cihaz eşleştirme – pairing_code ile device_id, school_id, display_group döner.
   * POST /api/tv/pair body: { pairing_code }
   */
  @Post('pair')
  async pair(@Body() body: { pairing_code?: string }) {
    const code = body?.pairing_code?.trim();
    if (!code) return { ok: false, message: 'pairing_code gerekli' };
    const result = await this.tvDevicesService.pairByCode(code);
    if (!result) return { ok: false, message: 'Geçersiz kod' };
    return { ok: true, ...result };
  }

  /**
   * Cihaz heartbeat – TV oynatıcı periyodik çağırır.
   * POST /api/tv/heartbeat body: { device_id }
   */
  @Post('heartbeat')
  async heartbeat(@Body() body: { device_id?: string }) {
    const id = body?.device_id?.trim();
    if (!id) return { ok: false };
    return this.tvDevicesService.heartbeat(id);
  }
}

