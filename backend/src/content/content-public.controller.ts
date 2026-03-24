import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AppConfigService } from '../app-config/app-config.service';

/** Public content endpoints (auth yok) – metadata, yayın SEO vb. */
@Controller('content')
@Throttle({ default: { limit: 60, ttl: 60000 } })
export class ContentPublicController {
  constructor(private readonly appConfig: AppConfigService) {}

  /** Public: Haber Yayın sayfası SEO metadata – generateMetadata için */
  @Get('yayin-seo')
  async getYayinSeo(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('yayin_seo');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getYayinSeoConfig();
  }

  /** Public: footer / iletişim / sosyal – yayın ve web sayfaları */
  @Get('web-public')
  async getWebPublic(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('web_public');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getWebPublicConfig();
  }

  /** Public: gizlilik / şartlar / çerez sayfa içerikleri */
  @Get('legal-pages')
  async getLegalPages(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('legal_pages');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getLegalPagesConfig();
  }

  /** Public: analitik, bakım, önbellek TTL, robots, OG, mağaza linkleri (site key: CAPTCHA veya eski alan birleşimi) */
  @Get('web-extras')
  async getWebExtras(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('web_extras');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getWebExtrasConfig();
  }

  /** Public: CAPTCHA (site key, sağlayıcı — gizli anahtar yok) */
  @Get('captcha')
  async getCaptchaPublic(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('captcha');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getCaptchaPublic();
  }

  /** Public: çerez banner / GDPR yapılandırması */
  @Get('gdpr')
  async getGdpr(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('gdpr');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getGdprConfig();
  }

  /** Public: iOS/Android uzaktan yapılandırma (sürüm, mağaza, bayraklar) */
  @Get('mobile-config')
  async getMobileConfig(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('mobile_config');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getMobileAppConfig();
  }

  /** Public: modül fiyatları (jeton/ek ders) + Android/iOS IAP ürün listeleri */
  @Get('market-policy')
  async getMarketPolicy(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getPublicCacheMaxAge('market_policy');
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getMarketPolicyConfig();
  }

  /** Kamu: bugünün hoşgeldin / motive mesajı (Türkiye takvimi). */
  @Get('welcome-today')
  async getWelcomeToday(@Res({ passthrough: true }) res: Response) {
    const maxAge = await this.appConfig.getWelcomeModulePublicCacheMaxAge();
    res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
    return this.appConfig.getWelcomeTodayPublic();
  }
}
