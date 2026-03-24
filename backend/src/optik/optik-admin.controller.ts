import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../types/enums';
import { OptikAdminService } from './optik-admin.service';
import { OptikFormPdfService } from './optik-form-pdf.service';
import { SchoolsService } from '../schools/schools.service';
import { MARKET_MODULE_KEYS } from '../app-config/market-policy.defaults';

class CreateFormTemplateDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  formType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  questionCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  choiceCount?: number;

  @IsOptional()
  @IsString()
  pageSize?: string;

  @IsOptional()
  @IsObject()
  roiConfig?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  examType?: string;

  @IsOptional()
  @IsString()
  gradeLevel?: string | null;

  @IsOptional()
  @IsString()
  subjectHint?: string | null;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

class CreateRubricTemplateDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  mode!: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsArray()
  criteria?: Array<{ criterion: string; max_points: number; weight?: number }>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  sortOrder?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

@Controller('optik/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class OptikAdminController {
  constructor(
    private readonly admin: OptikAdminService,
    private readonly formPdf: OptikFormPdfService,
    private readonly schools: SchoolsService,
  ) {}

  @Get('form-templates')
  async listFormTemplates() {
    return this.admin.listFormTemplates();
  }

  @Post('form-templates')
  async createFormTemplate(@Body() dto: CreateFormTemplateDto) {
    return this.admin.createFormTemplate(dto);
  }

  @Patch('form-templates/:id')
  async updateFormTemplate(@Param('id') id: string, @Body() dto: Partial<CreateFormTemplateDto>) {
    return this.admin.updateFormTemplate(id, dto);
  }

  @Delete('form-templates/:id')
  async deleteFormTemplate(@Param('id') id: string) {
    await this.admin.deleteFormTemplate(id);
    return { success: true };
  }

  /** Superadmin: PDF indir. Daha spesifik rota (pdf) PATCH/DELETE :id'dan sonra ama farkli path */
  @Get('form-templates/:id/pdf')
  async getFormTemplatePdf(
    @Param('id') id: string,
    @Query('prepend_blank') prependBlankStr: string | undefined,
    @Res() res: Response,
  ) {
    const template = await this.admin.getFormTemplateById(id);
    const prependBlank = prependBlankStr ? Math.min(5, Math.max(0, parseInt(prependBlankStr, 10) || 0)) : 0;
    const pdf = await this.formPdf.generatePdf(template, prependBlank > 0 ? { prependBlank } : undefined);
    const filename = `${(template.slug || template.id).replace(/[^a-z0-9-]/gi, '-')}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf));
  }

  @Get('rubric-templates')
  async listRubricTemplates() {
    return this.admin.listRubricTemplates();
  }

  @Post('rubric-templates')
  async createRubricTemplate(@Body() dto: CreateRubricTemplateDto) {
    return this.admin.createRubricTemplate(dto);
  }

  @Patch('rubric-templates/:id')
  async updateRubricTemplate(@Param('id') id: string, @Body() dto: Partial<CreateRubricTemplateDto>) {
    return this.admin.updateRubricTemplate(id, dto);
  }

  @Delete('rubric-templates/:id')
  async deleteRubricTemplate(@Param('id') id: string) {
    await this.admin.deleteRubricTemplate(id);
    return { success: true };
  }

  @Get('usage-stats')
  async getUsageStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.admin.getUsageStats(from, to);
  }

  @Get('schools-with-optik')
  async getSchoolsWithOptik() {
    const list = await this.schools.list(
      { page: 1, limit: 500 },
      { role: UserRole.superadmin, schoolId: null },
    );
    const items = list.items ?? [];
    return items.map((s) => ({
      id: s.id,
      name: s.name,
      city: s.city,
      district: s.district,
      enabled_modules: s.enabled_modules ?? [],
      optik_enabled:
        !s.enabled_modules || s.enabled_modules.length === 0
          ? true
          : s.enabled_modules.includes('optical'),
    }));
  }

  @Patch('schools/:id/optik-module')
  async setSchoolOptikModule(
    @Param('id') id: string,
    @Body() dto: { enabled: boolean },
  ) {
    const school = await this.schools.findById(id);
    const ALL_EXCEPT_OPTIK = MARKET_MODULE_KEYS.filter((k) => k !== 'optical');
    let mods = school.enabled_modules ?? null;
    const hasOptik = !mods || mods.length === 0 || mods.includes('optical');
    if (dto.enabled && !hasOptik) {
      mods = mods && mods.length > 0 ? [...mods, 'optical'] : null;
    } else if (!dto.enabled && hasOptik) {
      mods = mods && mods.length > 0 ? mods.filter((m) => m !== 'optical') : ALL_EXCEPT_OPTIK;
      if (mods.length === 0) mods = ALL_EXCEPT_OPTIK;
    }
    await this.schools.update(
      id,
      { enabled_modules: mods },
      { role: UserRole.superadmin, schoolId: null },
    );
    return { success: true, optik_enabled: dto.enabled };
  }
}
