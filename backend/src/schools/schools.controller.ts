import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { CreateSchoolDto } from './dto/create-school.dto';
import { BulkCreateSchoolDto } from './dto/bulk-create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';
import { ListSchoolsDto } from './dto/list-schools.dto';
import { BulkSchoolModuleDto } from './dto/bulk-school-module.dto';
import { ReconcilePreviewDto, ReconcileApplyDto } from './dto/reconcile-schools.dto';
import { MebbisKurumlistesiService } from './mebbis-kurumlistesi.service';
import { MebbisFetchDto, MebbisIlceQueryDto, MebbisTypeQueryDto } from './dto/mebbis-fetch.dto';
import {
  SchoolPlacementScoresSyncService,
  normalizePlacementUpdateScope,
} from './school-placement-scores-sync.service';
import { PlacementGptExtractService } from './placement-gpt-extract.service';
import { PlacementGptExtractDto } from './dto/placement-gpt-extract.dto';
import { PlacementSyncFeedDto } from './dto/placement-sync-feed.dto';

@Controller('schools')
@UseGuards(JwtAuthGuard)
export class SchoolsController {
  constructor(
    private readonly schoolsService: SchoolsService,
    private readonly mebbisKurumlistesi: MebbisKurumlistesiService,
    private readonly placementScoresSync: SchoolPlacementScoresSyncService,
    private readonly placementGptExtract: PlacementGptExtractService,
  ) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.moderator, UserRole.teacher)
  @RequireModule('schools')
  async list(@Query() dto: ListSchoolsDto, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId };
    return this.schoolsService.list(dto, scope);
  }

  @Get('mebbis/il-options')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  mebbisIlOptions() {
    return this.mebbisKurumlistesi.getIlOptions();
  }

  @Post('mebbis/ilce-options')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  mebbisIlceOptions(@Body() dto: MebbisIlceQueryDto) {
    return this.mebbisKurumlistesi.getIlceOptions(dto);
  }

  @Post('mebbis/type-options')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  mebbisTypeOptions(@Body() dto: MebbisTypeQueryDto) {
    return this.mebbisKurumlistesi.getTypeOptions(dto);
  }

  @Post('mebbis/fetch-rows')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  mebbisFetchRows(@Body() dto: MebbisFetchDto) {
    return this.mebbisKurumlistesi.fetchSchools(dto);
  }

  /** LGS taban puanları: env’deki JSON URL’den senkron (süperadmin manuel tetik). */
  @Post('placement-scores/sync-from-feed')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @RequireModule('schools')
  syncPlacementScoresFromFeed(@Body() body: PlacementSyncFeedDto) {
    return this.placementScoresSync.syncFromRemoteFeed(body?.update_scope);
  }

  /** CSV: kurum_kodu/institution_code, yıl, merkezî (with_exam|merkezi_lgs|…) ve yerel (without_exam|yerel_taban|…) */
  @Post('placement-scores/import-csv')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @RequireModule('schools')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  importPlacementScoresCsv(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('auto_enable_dual_track') autoRaw?: string,
    @Query('update_scope') updateScopeRaw?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'CSV dosyası (file) gerekli.' });
    }
    const auto = autoRaw !== 'false' && autoRaw !== '0';
    const scope = normalizePlacementUpdateScope(updateScopeRaw);
    const rows = this.placementScoresSync.parseCsv(file.buffer);
    return this.placementScoresSync.applyRows(rows, auto, scope);
  }

  /** Kaynak metin + GPT → yerleştirme satırları önizleme (DB yazılmaz). */
  @Post('placement-scores/gpt-preview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @RequireModule('schools')
  async previewPlacementGpt(@Body() dto: PlacementGptExtractDto) {
    const { rows, warnings, schools_considered, batches, model, context_school_ids } =
      await this.placementGptExtract.extractRows(dto);
    const update_scope = normalizePlacementUpdateScope(dto.update_scope);
    const source_scores_in_table = normalizePlacementUpdateScope(dto.source_scores_in_table);
    const city_trim = (dto.city ?? '').trim();
    const restrict_on_apply =
      (Array.isArray(dto.school_ids) && dto.school_ids.length > 0) || city_trim.length > 0;
    return {
      ok: true,
      rows,
      warnings,
      schools_considered,
      batches,
      model,
      update_scope,
      source_scores_in_table,
      city: city_trim || undefined,
      context_school_ids_count: context_school_ids.length,
      restrict_on_apply,
      sample_payload: { auto_enable_dual_track: true, update_scope, source_scores_in_table, rows },
    };
  }

  /** Kaynak metin + GPT → çıkan satırları okullara uygular (CSV ile aynı applyRows). */
  @Post('placement-scores/gpt-apply')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  @RequireModule('schools')
  async applyPlacementGpt(@Body() dto: PlacementGptExtractDto, @Query('auto_enable_dual_track') autoRaw?: string) {
    const { rows, warnings, context_school_ids } = await this.placementGptExtract.extractRows(dto);
    const auto = autoRaw !== 'false' && autoRaw !== '0';
    const scope = normalizePlacementUpdateScope(dto.update_scope);
    const city_trim = (dto.city ?? '').trim();
    const restrictOnContext =
      (Array.isArray(dto.school_ids) && dto.school_ids.length > 0) || city_trim.length > 0;
    const restrict = restrictOnContext ? context_school_ids : undefined;
    const result = await this.placementScoresSync.applyRows(rows, auto, scope, {
      restrictToSchoolIds: restrict,
    });
    return {
      ...result,
      gpt_warnings: warnings.slice(0, 300),
    };
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.moderator)
  @RequireModule('schools')
  async getById(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    const school = await this.schoolsService.findById(id);
    const role = payload.user.role as UserRole;
    if (role === UserRole.school_admin && school.id !== payload.schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu veriye erişim yetkiniz yok.' });
    }
    return school;
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async create(@Body() dto: CreateSchoolDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.schoolsService.create(dto, payload.userId);
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async bulkCreate(@Body() dto: BulkCreateSchoolDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.schoolsService.bulkCreate(dto, payload.userId);
  }

  @Post('reconcile/preview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async reconcilePreview(@Body() dto: ReconcilePreviewDto) {
    return this.schoolsService.reconcilePreview(dto.schools);
  }

  @Post('reconcile/apply')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async reconcileApply(@Body() dto: ReconcileApplyDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.schoolsService.reconcileApply(dto, payload.userId);
  }

  @Patch('bulk-enabled-modules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin)
  async bulkEnabledModules(@Body() dto: BulkSchoolModuleDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.schoolsService.bulkToggleEnabledModuleForAllSchools(dto.module_key, dto.enable, payload.userId);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId, userId: payload.userId };
    return this.schoolsService.update(id, dto, scope);
  }
}
