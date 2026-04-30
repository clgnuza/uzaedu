import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { AppConfigService } from '../app-config/app-config.service';
import { ContentService } from './content.service';
import { ListContentItemsDto } from './dto/list-content-items.dto';

/** Public content endpoints (auth yok) – metadata, yayın SEO vb. */
@Controller('content')
/** Çoklu throttler (default/auth/public); admin shell + Strict Mode aynı anda çok GET — hepsini atla. */
@SkipThrottle({ default: true, auth: true, public: true })
export class ContentPublicController {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly contentService: ContentService,
  ) {}

  /** Public: Haber Yayın sayfası SEO metadata – generateMetadata için */
  @Get('yayin-seo')
  async getYayinSeo(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('yayin_seo');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return this.appConfig.getYayinSeoConfig();
  }

  /** Public: footer / iletişim / sosyal – yayın ve web sayfaları */
  @Get('web-public')
  async getWebPublic(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('web_public');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return this.appConfig.getWebPublicConfig();
  }

  /** Public: gizlilik / şartlar / çerez sayfa içerikleri */
  @Get('legal-pages')
  async getLegalPages(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('legal_pages');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return this.appConfig.getLegalPagesConfig();
  }

  /** Public: analitik, bakım, önbellek TTL, robots, OG, mağaza linkleri */
  @Get('web-extras')
  async getWebExtras(@Res({ passthrough: true }) res: Response) {
    const cfg = await this.appConfig.getWebExtrasConfig();
    const maxAge = cfg.cache_ttl_web_extras;
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return cfg;
  }

  /** Public: CAPTCHA (site key, sağlayıcı — gizli anahtar yok) */
  @Get('captcha')
  async getCaptchaPublic(@Res({ passthrough: true }) res: Response) {
    const c = await this.appConfig.getCaptchaConfig();
    const maxAge = c.cache_ttl_captcha;
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return this.appConfig.captchaConfigToPublic(c);
  }

  /** Public: çerez banner / GDPR yapılandırması */
  @Get('gdpr')
  async getGdpr(@Res({ passthrough: true }) res: Response) {
    const g = await this.appConfig.getGdprConfig();
    const maxAge = g.cache_ttl_gdpr;
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return g;
  }

  /** Public: iOS/Android uzaktan yapılandırma (sürüm, mağaza, bayraklar) */
  @Get('mobile-config')
  async getMobileConfig(@Res({ passthrough: true }) res: Response) {
    const m = await this.appConfig.getMobileAppConfig();
    const maxAge = m.cache_ttl_mobile_config;
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return m;
  }

  /** Public: modül fiyatları (jeton/ek ders) + Android/iOS IAP ürün listeleri */
  @Get('market-policy')
  async getMarketPolicy(@Res({ passthrough: true }) res: Response) {
    const mp = await this.appConfig.getMarketPolicyConfig();
    const maxAge = mp.cache_ttl_market_policy;
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return mp;
  }

  /** Kamu: bugünün hoşgeldin / motive mesajı (Türkiye takvimi). */
  @Get('welcome-today')
  async getWelcomeToday(@Res({ passthrough: true }) res: Response) {
    const cfg = await this.appConfig.getWelcomeModuleConfig();
    const maxAge = this.appConfig.getWelcomeModulePublicMaxAge(cfg);
    res.setHeader('Cache-Control', `public, max-age=${maxAge}, s-maxage=${maxAge}, stale-while-revalidate=600`);
    return this.appConfig.getWelcomeTodayPublic(cfg);
  }

  /** Giriş yapmadan haber listesi (web anasayfa → Haberler). */
  @Get('public/channels')
  getChannelsPublic() {
    return this.contentService.getChannels();
  }

  @Get('public/meb-sources')
  getMebSourcesPublic() {
    return this.contentService.getMebSources();
  }

  @Get('public/items')
  listItemsPublic(@Query() dto: ListContentItemsDto) {
    return this.contentService.listItems(dto);
  }
}
