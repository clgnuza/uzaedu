import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppConfigService } from '../app-config/app-config.service';
import { Ad, type AdPlatform, type AdProvider, type WebSurface } from './entities/ad.entity';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import { ListAdsDto } from './dto/list-ads.dto';
import { ListActiveAdsDto } from './dto/list-active-ads.dto';
import { GOOGLE_AD_POLICY_LINKS } from './ads.constants';

export type AdsPublicMeta = {
  ads_enabled: boolean;
  web_targeting_requires_cookie?: boolean;
  server_time: string;
  /** Dönen kayıtlara göre birincil entegrasyon */
  client_hint?: 'adsense_web' | 'admob_native' | 'custom';
  /** Web: web_public; mobil: mobile_app_config — reklam/GDPR şeffaflığı */
  privacy_policy_url?: string | null;
  /**
   * true: kişiselleştirilmiş reklam rızası yok; istemci NPA / sınırlı reklam (Consent Mode, UMP) kullanmalı.
   * API targeting reklamları zaten filtreler; bu bayrak SDK/etiket tarafını hizalar.
   */
  non_personalized_ads_recommended: boolean;
  policy_links: typeof GOOGLE_AD_POLICY_LINKS;
};

@Injectable()
export class AdsService {
  constructor(
    @InjectRepository(Ad)
    private readonly repo: Repository<Ad>,
    private readonly appConfig: AppConfigService,
  ) {}

  async listAdmin(dto: ListAdsDto): Promise<{ total: number; page: number; limit: number; items: Ad[] }> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const qb = this.repo.createQueryBuilder('a').orderBy('a.priority', 'DESC').addOrderBy('a.created_at', 'DESC');
    if (dto.platform) qb.andWhere('a.platform = :platform', { platform: dto.platform });
    if (dto.placement?.trim()) qb.andWhere('a.placement = :placement', { placement: dto.placement.trim() });
    if (dto.search?.trim()) {
      const s = `%${dto.search.trim()}%`;
      qb.andWhere('(a.title ILIKE :s OR a.placement ILIKE :s)', { s });
    }
    if (dto.ad_provider) qb.andWhere('a.ad_provider = :ap', { ap: dto.ad_provider });
    if (dto.web_surface) {
      qb.andWhere('(a.web_surface IS NULL OR a.web_surface = :wall OR a.web_surface = :ws)', {
        wall: 'all',
        ws: dto.web_surface,
      });
    }
    if (dto.active !== undefined) qb.andWhere('a.active = :active', { active: dto.active });
    const skip = (page - 1) * limit;
    const [items, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { total, page, limit, items };
  }

  async findOneAdmin(id: string): Promise<Ad> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reklam bulunamadı.' });
    return row;
  }

  async create(dto: CreateAdDto, createdBy: string | null): Promise<Ad> {
    const provider = dto.ad_provider ?? 'custom';
    this.assertProviderPlatform(provider, dto.platform);
    this.assertWebSurfaceOnlyForWeb(dto.platform, dto.web_surface);
    const web_surface = this.normalizeWebSurface(dto.platform, dto.web_surface);

    const entity = this.repo.create({
      platform: dto.platform,
      ad_provider: provider,
      web_surface,
      placement: dto.placement.trim(),
      format: dto.format.trim(),
      title: dto.title.trim(),
      payload: dto.payload ?? {},
      consent_mode: dto.consent_mode ?? 'contextual',
      active: dto.active ?? true,
      priority: dto.priority ?? 0,
      starts_at: dto.starts_at ?? null,
      ends_at: dto.ends_at ?? null,
      created_by: createdBy,
    });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateAdDto): Promise<Ad> {
    const row = await this.findOneAdmin(id);
    const nextPlatform = (dto.platform ?? row.platform) as AdPlatform;
    const nextProvider = (dto.ad_provider ?? row.ad_provider) as AdProvider;
    const mergedWs = dto.web_surface !== undefined ? dto.web_surface : row.web_surface;
    this.assertProviderPlatform(nextProvider, nextPlatform);
    this.assertWebSurfaceOnlyForWeb(nextPlatform, mergedWs === null ? undefined : mergedWs);
    const web_surface = this.normalizeWebSurface(nextPlatform, mergedWs);

    if (dto.platform !== undefined) row.platform = dto.platform;
    if (dto.ad_provider !== undefined) row.ad_provider = dto.ad_provider;
    row.web_surface = web_surface;
    if (dto.placement !== undefined) row.placement = dto.placement.trim();
    if (dto.format !== undefined) row.format = dto.format.trim();
    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.payload !== undefined) row.payload = dto.payload;
    if (dto.consent_mode !== undefined) row.consent_mode = dto.consent_mode;
    if (dto.active !== undefined) row.active = dto.active;
    if (dto.priority !== undefined) row.priority = dto.priority;
    if (dto.starts_at !== undefined) row.starts_at = dto.starts_at;
    if (dto.ends_at !== undefined) row.ends_at = dto.ends_at;
    return this.repo.save(row);
  }

  async remove(id: string): Promise<void> {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reklam bulunamadı.' });
  }

  async listActiveWithMeta(dto: ListActiveAdsDto): Promise<{ items: Ad[]; meta: AdsPublicMeta }> {
    const platform = dto.platform;
    const [web, mobile, webPublic] = await Promise.all([
      this.appConfig.getWebExtrasConfig(),
      this.appConfig.getMobileAppConfig(),
      platform === 'web' ? this.appConfig.getWebPublicConfig() : Promise.resolve(null),
    ]);
    const adsEnabled = platform === 'web' ? web.ads_enabled !== false : mobile.ads_enabled !== false;
    const items = adsEnabled ? await this.fetchActiveAdsFiltered(dto, web) : [];
    const providers = new Set(items.map((a) => a.ad_provider));
    let client_hint: AdsPublicMeta['client_hint'];
    if (providers.size === 1 && providers.has('adsense')) client_hint = 'adsense_web';
    else if (providers.size === 1 && providers.has('admob')) client_hint = 'admob_native';
    else if (items.length === 0) client_hint = platform === 'web' ? 'adsense_web' : 'admob_native';
    else client_hint = 'custom';

    const personalizedOk = this.targetingConsentGranted(dto, platform, web);
    const privacy_policy_url =
      platform === 'web' ? webPublic?.privacy_policy_url ?? null : mobile.privacy_policy_url;

    return {
      items,
      meta: {
        ads_enabled: adsEnabled,
        web_targeting_requires_cookie: platform === 'web' ? web.ads_web_targeting_requires_cookie_consent : undefined,
        server_time: new Date().toISOString(),
        client_hint,
        privacy_policy_url,
        non_personalized_ads_recommended: !personalizedOk,
        policy_links: GOOGLE_AD_POLICY_LINKS,
      },
    };
  }

  /** Kişiselleştirilmiş/targeting reklam göstermek için istemci rızası yeterli mi (API filtreleri ile uyumlu) */
  private targetingConsentGranted(
    dto: ListActiveAdsDto,
    platform: 'web' | 'ios' | 'android',
    web: { ads_web_targeting_requires_cookie_consent: boolean },
  ): boolean {
    if (dto.targeting_allowed !== true) return false;
    if (platform === 'web' && web.ads_web_targeting_requires_cookie_consent && dto.cookie_consent !== 'accepted') {
      return false;
    }
    return true;
  }

  private assertProviderPlatform(provider: AdProvider, platform: AdPlatform): void {
    if (provider === 'adsense' && platform !== 'web') {
      throw new BadRequestException({
        code: 'AD_PROVIDER_PLATFORM',
        message: 'Google AdSense yalnızca web platformunda kullanılabilir.',
      });
    }
    if (provider === 'admob' && platform === 'web') {
      throw new BadRequestException({
        code: 'AD_PROVIDER_PLATFORM',
        message: 'Google AdMob yalnızca iOS veya Android uygulama envanteridir.',
      });
    }
  }

  private assertWebSurfaceOnlyForWeb(
    platform: AdPlatform,
    web_surface: 'desktop' | 'mobile' | 'all' | null | undefined,
  ): void {
    if (platform !== 'web' && web_surface !== undefined && web_surface !== null) {
      throw new BadRequestException({
        code: 'WEB_SURFACE_PLATFORM',
        message: 'web_surface yalnızca platform=web için kullanılabilir.',
      });
    }
  }

  private normalizeWebSurface(platform: AdPlatform, ws: WebSurface | null | undefined): WebSurface | null {
    if (platform !== 'web') return null;
    if (ws === null || ws === undefined) return 'all';
    return ws;
  }

  private async fetchActiveAdsFiltered(
    dto: ListActiveAdsDto,
    web: { ads_web_targeting_requires_cookie_consent: boolean },
  ): Promise<Ad[]> {
    const platform = dto.platform;
    const now = new Date();
    const qb = this.repo
      .createQueryBuilder('a')
      .where('a.active = :active', { active: true })
      .andWhere('a.platform = :platform', { platform })
      .andWhere('(a.starts_at IS NULL OR a.starts_at <= :now)', { now })
      .andWhere('(a.ends_at IS NULL OR a.ends_at >= :now)', { now })
      .orderBy('a.priority', 'DESC')
      .addOrderBy('a.created_at', 'DESC');
    if (dto.placement?.trim()) {
      qb.andWhere('a.placement = :placement', { placement: dto.placement.trim() });
    }
    if (platform === 'web' && dto.web_surface && dto.web_surface !== 'all') {
      qb.andWhere('(a.web_surface IS NULL OR a.web_surface = :wall OR a.web_surface = :ws)', {
        wall: 'all',
        ws: dto.web_surface,
      });
    }
    const rows = await qb.getMany();
    return rows.filter((ad) => this.passesConsentPolicy(ad, platform, web, dto));
  }

  private passesConsentPolicy(
    ad: Ad,
    platform: 'web' | 'ios' | 'android',
    web: { ads_web_targeting_requires_cookie_consent: boolean },
    dto: ListActiveAdsDto,
  ): boolean {
    if (ad.consent_mode !== 'targeting') return true;
    return this.targetingConsentGranted(dto, platform, web);
  }
}
