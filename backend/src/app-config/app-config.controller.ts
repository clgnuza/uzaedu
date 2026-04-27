import { Body, Controller, ForbiddenException, Get, Header, Patch, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsOptional,
  IsString,
  IsNumber,
  IsArray,
  IsBoolean,
  IsIn,
  MaxLength,
  ValidateNested,
  IsObject,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import {
  AppConfigService,
  R2ConfigForAdmin,
  SchoolReviewsConfig,
  SchoolReviewsContentRules,
  SchoolReviewsPenaltyRules,
  DersSaatiConfig,
  YayinSeoConfig,
  WebPublicConfig,
  LegalPagesConfig,
  OptikConfig,
  MailConfigForAdmin,
  MailTemplatesStored,
  WebExtrasConfig,
  GdprConfig,
  CaptchaConfigForAdmin,
  MobileAppConfig,
  WelcomeModuleConfig,
  MarketPolicyConfig,
  DevOpsConfig,
  ExamDutyFeeCatalog,
} from './app-config.service';

class UpdateDevOpsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  git_repo_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  git_default_branch?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  cicd_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  production_api_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  production_web_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(12000)
  deploy_notes?: string | null;
}

class UpdateR2Dto {
  @IsOptional()
  @IsString()
  r2_account_id?: string | null;

  @IsOptional()
  @IsString()
  r2_access_key_id?: string | null;

  @IsOptional()
  @IsString()
  r2_secret_access_key?: string | null;

  @IsOptional()
  @IsString()
  r2_bucket?: string | null;

  @IsOptional()
  @IsString()
  r2_public_url?: string | null;

  /** Dosya boyutu limiti (MB). 0.1–50 arası. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  upload_max_size_mb?: number | null;

  /** İzin verilen dosya türleri, örn. ["image/jpeg","image/png"] */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  upload_allowed_types?: string[] | null;
}

class UpdateYayinSeoDto {
  @IsOptional()
  @IsString()
  title?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  og_image?: string | null;

  @IsOptional()
  @IsIn(['index', 'noindex'])
  robots?: 'index' | 'noindex';

  @IsOptional()
  @IsString()
  keywords?: string | null;

  @IsOptional()
  @IsString()
  site_url?: string | null;

  @IsOptional()
  @IsString()
  site_name?: string | null;
}

class UpdateOptikDto {
  @IsOptional()
  @IsBoolean()
  module_enabled?: boolean;

  @IsOptional()
  @IsIn(['tr', 'en'])
  default_language?: 'tr' | 'en';

  @IsOptional()
  @IsString()
  openai_api_key?: string | null;

  @IsOptional()
  @IsString()
  openai_model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  openai_temperature?: number;

  @IsOptional()
  @IsIn(['google', 'azure', 'openai_vision', 'placeholder'])
  ocr_provider?: 'google' | 'azure' | 'openai_vision' | 'placeholder';

  @IsOptional()
  @IsString()
  ocr_google_project_id?: string | null;

  @IsOptional()
  @IsString()
  ocr_google_credentials?: string | null;

  @IsOptional()
  @IsString()
  ocr_google_location?: string | null;

  @IsOptional()
  @IsString()
  ocr_google_processor_id?: string | null;

  @IsOptional()
  @IsString()
  ocr_azure_endpoint?: string | null;

  @IsOptional()
  @IsString()
  ocr_azure_api_key?: string | null;

  @IsOptional()
  @IsString()
  ocr_azure_model?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ocr_timeout_seconds?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  ocr_retry_count?: number | null;

  @IsOptional()
  @IsIn(['tr', 'en'])
  ocr_language_hint?: 'tr' | 'en' | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  confidence_threshold?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grade_modes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  daily_limit_per_user?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  key_text_cache_ttl_hours?: number;
}

class LegalPageBlockDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600)
  meta_description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(600000)
  body_html?: string;
}

class UpdateLegalPagesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => LegalPageBlockDto)
  privacy?: LegalPageBlockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegalPageBlockDto)
  terms?: LegalPageBlockDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LegalPageBlockDto)
  cookies?: LegalPageBlockDto;
}

class UpdateWebPublicDto {
  @IsOptional()
  @IsString()
  contact_email?: string | null;

  @IsOptional()
  @IsString()
  contact_phone?: string | null;

  @IsOptional()
  @IsString()
  footer_tagline?: string | null;

  @IsOptional()
  @IsString()
  social_x?: string | null;

  @IsOptional()
  @IsString()
  social_facebook?: string | null;

  @IsOptional()
  @IsString()
  social_instagram?: string | null;

  @IsOptional()
  @IsString()
  social_youtube?: string | null;

  @IsOptional()
  @IsString()
  privacy_policy_url?: string | null;

  @IsOptional()
  @IsString()
  terms_url?: string | null;

  @IsOptional()
  @IsString()
  footer_copyright_suffix?: string | null;

  @IsOptional()
  footer_nav_items?: unknown;

  @IsOptional()
  @IsString()
  header_brand_subtitle?: string | null;

  @IsOptional()
  @IsString()
  header_shell_style?: string | null;

  @IsOptional()
  @IsString()
  header_shell_density?: string | null;

  @IsOptional()
  header_shell_accent?: boolean;
}

class UpdateMailDto {
  @IsOptional()
  @IsBoolean()
  mail_enabled?: boolean;

  @IsOptional()
  @IsString()
  smtp_host?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  smtp_port?: number | null;

  @IsOptional()
  @IsString()
  smtp_user?: string | null;

  @IsOptional()
  @IsString()
  smtp_pass?: string | null;

  @IsOptional()
  @IsString()
  smtp_from?: string | null;

  @IsOptional()
  @IsString()
  smtp_from_name?: string | null;

  @IsOptional()
  @IsBoolean()
  smtp_secure?: boolean;

  @IsOptional()
  @IsString()
  mail_app_base_url?: string | null;

  @IsOptional()
  @IsString()
  contact_form_notify_email?: string | null;
}

class UpdateWelcomeModuleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  popup_enabled?: boolean;

  @IsOptional()
  @IsIn(['zodiac_auto'])
  popup_mode?: 'zodiac_auto';

  @IsOptional()
  @IsString()
  fallback_message?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cache_ttl_welcome?: number;

  @IsOptional()
  @IsObject()
  by_day?: Record<string, string>;
}

class UpdateWebExtrasDto {
  @IsOptional()
  @IsString()
  gtm_id?: string | null;

  @IsOptional()
  @IsString()
  ga4_measurement_id?: string | null;

  @IsOptional()
  @IsBoolean()
  maintenance_enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(600000)
  maintenance_message_html?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  maintenance_allowed_exact?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  maintenance_allowed_prefixes?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cache_ttl_yayin_seo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cache_ttl_web_public?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cache_ttl_legal_pages?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cache_ttl_web_extras?: number;

  @IsOptional()
  @IsBoolean()
  global_robots_noindex?: boolean;

  @IsOptional()
  @IsString()
  default_og_image_url?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  meta_description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  google_site_verification?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  recaptcha_site_key?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  pwa_short_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  theme_color?: string | null;

  @IsOptional()
  @IsString()
  favicon_url?: string | null;

  @IsOptional()
  @IsString()
  app_store_url?: string | null;

  @IsOptional()
  @IsString()
  play_store_url?: string | null;

  @IsOptional()
  @IsString()
  help_center_url?: string | null;

  @IsOptional()
  @IsBoolean()
  support_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  ads_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  ads_web_targeting_requires_cookie_consent?: boolean;

  @IsOptional()
  @IsObject()
  guest_public_web_shell_nav?: unknown;
}

class UpdateGdprDto {
  @IsOptional()
  @IsBoolean()
  cookie_banner_enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cookie_banner_title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accept_button_label?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reject_button_label?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(600000)
  cookie_banner_body_html?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  consent_version?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  data_controller_name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  dpo_email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cookie_policy_path?: string;

  @IsOptional()
  @IsBoolean()
  reject_button_visible?: boolean;

  @IsOptional()
  @IsIn(['gradient', 'minimal', 'brand'])
  cookie_banner_visual?: 'gradient' | 'minimal' | 'brand';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cache_ttl_gdpr?: number;
}

class UpdateCaptchaDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(['none', 'recaptcha_v2', 'recaptcha_v3', 'turnstile', 'hcaptcha'])
  provider?: 'none' | 'recaptcha_v2' | 'recaptcha_v3' | 'turnstile' | 'hcaptcha';

  @IsOptional()
  @IsString()
  site_key?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(2048)
  secret_key?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  v3_min_score?: number;

  @IsOptional()
  @IsBoolean()
  protect_login?: boolean;

  @IsOptional()
  @IsBoolean()
  protect_register?: boolean;

  @IsOptional()
  @IsBoolean()
  protect_forgot_password?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cache_ttl_captcha?: number;
}

class UpdateMobileAppDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cache_ttl_mobile_config?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ios_min_version?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  android_min_version?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ios_latest_version?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  android_latest_version?: string | null;

  @IsOptional()
  @IsBoolean()
  force_update_ios?: boolean;

  @IsOptional()
  @IsBoolean()
  force_update_android?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(600000)
  update_message?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ios_bundle_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  android_application_id?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  ios_app_store_id?: string | null;

  @IsOptional()
  @IsString()
  app_store_url?: string | null;

  @IsOptional()
  @IsString()
  play_store_url?: string | null;

  @IsOptional()
  @IsString()
  marketing_url?: string | null;

  @IsOptional()
  @IsString()
  faq_url?: string | null;

  @IsOptional()
  @IsString()
  privacy_policy_url?: string | null;

  @IsOptional()
  @IsString()
  terms_url?: string | null;

  @IsOptional()
  @IsString()
  help_center_url?: string | null;

  @IsOptional()
  @IsString()
  support_email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  universal_link_host?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  url_scheme?: string | null;

  @IsOptional()
  @IsString()
  api_base_url_public?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  config_schema_version?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  default_locale?: string | null;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supported_locales?: string[];

  @IsOptional()
  @IsBoolean()
  mobile_maintenance_enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(600000)
  mobile_maintenance_message?: string | null;

  @IsOptional()
  @IsBoolean()
  in_app_review_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  push_notifications_enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  ads_enabled?: boolean;

  @IsOptional()
  @IsObject()
  feature_flags?: Record<string, boolean>;
}

class SchoolReviewsPenaltyRulesPatchDto implements Partial<SchoolReviewsPenaltyRules> {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  strikes_until_ban?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  ban_duration_days?: number;

  @IsOptional()
  @IsBoolean()
  reset_strikes_on_ban?: boolean;
}

class UpdateSchoolReviewsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  rating_min?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  rating_max?: number;

  @IsOptional()
  @IsIn(['auto', 'moderation'])
  moderation_mode?: 'auto' | 'moderation';

  @IsOptional()
  @IsBoolean()
  allow_questions?: boolean;

  @IsOptional()
  @IsBoolean()
  questions_require_moderation?: boolean;

  @IsOptional()
  @IsObject()
  content_rules?: SchoolReviewsContentRules;

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolReviewsPenaltyRulesPatchDto)
  penalty_rules?: SchoolReviewsPenaltyRulesPatchDto;
}

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly service: AppConfigService) {}

  @Get('r2')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getR2(): Promise<R2ConfigForAdmin> {
    return this.service.getR2ConfigForAdmin();
  }

  @Post('r2/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async testR2(): Promise<{ ok: boolean; message: string }> {
    return this.service.testR2Connection();
  }

  @Patch('r2')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateR2(@Body() dto: UpdateR2Dto): Promise<{ success: boolean }> {
    await this.service.updateR2Config(dto);
    return { success: true };
  }

  @Get('school-reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async getSchoolReviewsConfig(): Promise<SchoolReviewsConfig> {
    return this.service.getSchoolReviewsConfig();
  }

  @Patch('school-reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('school_reviews')
  async updateSchoolReviewsConfig(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: UpdateSchoolReviewsDto,
  ): Promise<{ success: boolean }> {
    if (payload.user.role === UserRole.moderator && dto.enabled !== undefined) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Modül aç/kapa yalnızca süper yönetici tarafından değiştirilebilir.',
      });
    }
    if (payload.user.role === UserRole.moderator && dto.penalty_rules !== undefined) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Ceza kuralları yalnızca süper yönetici tarafından değiştirilebilir.',
      });
    }
    await this.service.updateSchoolReviewsConfig(dto);
    return { success: true };
  }

  @Get('ders-saati')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getDersSaatiConfig(): Promise<DersSaatiConfig> {
    return this.service.getDersSaatiConfig();
  }

  @Patch('ders-saati')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async updateDersSaatiConfig(@Body() dto: DersSaatiConfig): Promise<{ success: boolean }> {
    await this.service.updateDersSaatiConfig(dto);
    return { success: true };
  }

  @Get('yayin-seo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getYayinSeoConfig(): Promise<YayinSeoConfig> {
    return this.service.getYayinSeoConfig();
  }

  @Patch('yayin-seo')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateYayinSeoConfig(@Body() dto: UpdateYayinSeoDto): Promise<{ success: boolean }> {
    await this.service.updateYayinSeoConfig(dto);
    return { success: true };
  }

  @Get('web-public')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getWebPublicConfig(): Promise<WebPublicConfig> {
    return this.service.getWebPublicConfig();
  }

  @Patch('web-public')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateWebPublicConfig(@Body() dto: UpdateWebPublicDto): Promise<{ success: boolean }> {
    await this.service.updateWebPublicConfig(dto as Partial<WebPublicConfig>);
    return { success: true };
  }

  @Get('legal-pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getLegalPagesConfig(): Promise<LegalPagesConfig> {
    return this.service.getLegalPagesConfig();
  }

  @Patch('legal-pages')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateLegalPagesConfig(@Body() dto: UpdateLegalPagesDto): Promise<{ success: boolean }> {
    await this.service.updateLegalPagesConfig(dto);
    return { success: true };
  }

  @Get('web-extras')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getWebExtrasConfig(): Promise<WebExtrasConfig> {
    return this.service.getWebExtrasConfig();
  }

  @Patch('web-extras')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateWebExtrasConfig(@Body() dto: UpdateWebExtrasDto): Promise<{ success: boolean }> {
    await this.service.updateWebExtrasConfig(dto as Partial<WebExtrasConfig>);
    return { success: true };
  }

  @Get('gdpr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getGdprConfig(): Promise<GdprConfig> {
    return this.service.getGdprConfig();
  }

  @Patch('gdpr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateGdprConfig(@Body() dto: UpdateGdprDto): Promise<{ success: boolean }> {
    await this.service.updateGdprConfig(dto);
    return { success: true };
  }

  @Get('captcha')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getCaptchaConfig(): Promise<CaptchaConfigForAdmin> {
    return this.service.getCaptchaConfigForAdmin();
  }

  @Patch('captcha')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateCaptchaConfig(@Body() dto: UpdateCaptchaDto): Promise<{ success: boolean }> {
    await this.service.updateCaptchaConfig(dto);
    return { success: true };
  }

  @Get('mobile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getMobileAppConfig(): Promise<MobileAppConfig> {
    return this.service.getMobileAppConfig();
  }

  @Patch('mobile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateMobileAppConfig(@Body() dto: UpdateMobileAppDto): Promise<{ success: boolean }> {
    await this.service.updateMobileAppConfig(dto);
    return { success: true };
  }

  @Get('devops')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getDevOpsConfig(): Promise<DevOpsConfig> {
    return this.service.getDevOpsConfig();
  }

  @Patch('devops')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateDevOpsConfig(@Body() dto: UpdateDevOpsDto): Promise<{ success: boolean }> {
    await this.service.updateDevOpsConfig(dto);
    return { success: true };
  }

  @Get('market-policy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('market_policy')
  async getMarketPolicyConfig(): Promise<MarketPolicyConfig> {
    return this.service.getMarketPolicyConfig();
  }

  @Patch('market-policy')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('market_policy')
  async updateMarketPolicyConfig(
    @Body() dto: Partial<MarketPolicyConfig>,
  ): Promise<{ success: boolean }> {
    await this.service.updateMarketPolicyConfig(dto);
    return { success: true };
  }

  @Get('welcome-module')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getWelcomeModuleConfig(): Promise<WelcomeModuleConfig> {
    return this.service.getWelcomeModuleConfig();
  }

  @Patch('welcome-module')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateWelcomeModuleConfig(@Body() dto: UpdateWelcomeModuleDto): Promise<{ success: boolean }> {
    await this.service.updateWelcomeModuleConfig(dto);
    return { success: true };
  }

  @Get('optik')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getOptikConfig(): Promise<OptikConfig> {
    return this.service.getOptikConfig();
  }

  @Patch('optik')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateOptikConfig(@Body() dto: UpdateOptikDto): Promise<{ success: boolean }> {
    await this.service.updateOptikConfig(dto);
    return { success: true };
  }

  @Post('optik/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async testOptikConnection(): Promise<{ ok: boolean; message: string }> {
    return this.service.testOptikConnection();
  }

  @Get('mail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getMailConfig(): Promise<MailConfigForAdmin> {
    return this.service.getMailConfig();
  }

  @Patch('mail')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateMailConfig(@Body() dto: UpdateMailDto): Promise<{ success: boolean }> {
    await this.service.updateMailConfig(dto as Partial<MailConfigForAdmin>);
    return { success: true };
  }

  @Post('mail/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async testMailConnection(): Promise<{ ok: boolean; message: string }> {
    return this.service.testMailConnection();
  }

  @Get('mail-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getMailTemplates() {
    return this.service.getMailTemplatesMerged();
  }

  @Patch('mail-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async patchMailTemplates(@Body() dto: MailTemplatesStored): Promise<{ success: boolean }> {
    await this.service.updateMailTemplates(dto ?? {});
    return { success: true };
  }

  @Get('exam-duty-sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async getExamDutySyncConfig() {
    return this.service.getExamDutySyncConfig();
  }

  @Patch('exam-duty-sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateExamDutySyncConfig(
    @Body()
    dto: {
      gpt_enabled?: boolean;
      openai_api_key?: string | null;
      default_times?: Record<string, string>;
      /** Kutu bildirimleri: Son başvuru, Onay, Sınav±1 gün — İstanbul HH:mm (yayın ayrı, anında) */
      notification_times?: Partial<{
        deadline: string;
        approval_day: string;
        exam_minus_1d: string;
        exam_plus_1d: string;
      }>;
      sync_options?: {
        skip_past_exam_date?: boolean;
        recheck_max_count?: number;
        fetch_timeout_ms?: number;
        log_gpt_usage?: boolean;
        add_draft_without_dates?: boolean;
        max_new_per_sync?: number;
        sync_schedule_times?: string[];
        notify_superadmin_on_sync_items?: boolean;
        auto_publish_gpt_sync_duties?: boolean;
        dedupe_exam_schedule?: boolean;
        /** 0–14: bir sonraki scrape sync’te içerik kontrolü yapılacak slayt (1–15) */
        scrape_slider_slot_index?: number;
      };
    },
  ): Promise<{ success: boolean }> {
    await this.service.updateExamDutySyncConfig(dto);
    return { success: true };
  }

  /** Sınav görev ücret referans tablosu — giriş gerekmez (öğretmen paneli). */
  @Get('exam-duty-fees/public')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')
  async getExamDutyFeeCatalogPublic(): Promise<ExamDutyFeeCatalog> {
    return this.service.getExamDutyFeeCatalog();
  }

  @Get('exam-duty-fees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async getExamDutyFeeCatalogAdmin(): Promise<ExamDutyFeeCatalog> {
    return this.service.getExamDutyFeeCatalog();
  }

  @Patch('exam-duty-fees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async updateExamDutyFeeCatalog(
    @Body() body: ExamDutyFeeCatalog,
  ): Promise<{ success: boolean }> {
    await this.service.updateExamDutyFeeCatalog(body);
    return { success: true };
  }
}
