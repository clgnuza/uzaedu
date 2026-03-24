import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { DocumentCatalogService } from './document-catalog.service';
import { CreateCatalogSubjectDto } from './dto/create-catalog-subject.dto';
import { UpdateCatalogSubjectDto } from './dto/update-catalog-subject.dto';

@Controller('document-templates/config')
export class DocumentConfigController {
  constructor(private readonly catalogService: DocumentCatalogService) {}

  /** Superadmin: Ders listesi (ayarlar için). curriculum_model=bilsem → sadece ana_grup set edilmiş dersler */
  @Get('subjects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  @RequireModule('document_templates')
  async listSubjects(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('curriculum_model') curriculumModel?: string,
  ) {
    const { items, total, page: p, limit: l } = await this.catalogService.findAllAdmin({
      category: 'subject',
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 100,
      curriculumModel: curriculumModel?.trim() || undefined,
    });
    return {
      total,
      page: p,
      limit: l,
      items: items.map((c) => ({
        id: c.id,
        category: c.category,
        code: c.code,
        label: c.label,
        grade_min: c.gradeMin,
        grade_max: c.gradeMax,
        section_filter: c.sectionFilter,
        ana_grup: c.anaGrup ?? null,
        sort_order: c.sortOrder,
        is_active: c.isActive,
      })),
    };
  }

  /** Superadmin: Ders ekle */
  @Post('subjects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  @RequireModule('document_templates')
  async createSubject(@Body() dto: CreateCatalogSubjectDto) {
    return this.catalogService.createSubject({
      code: dto.code,
      label: dto.label,
      grade_min: dto.grade_min,
      grade_max: dto.grade_max,
      section_filter: dto.section_filter,
      ana_grup: dto.ana_grup,
      sort_order: dto.sort_order,
      is_active: dto.is_active,
    });
  }

  /** Superadmin: Ders güncelle */
  @Patch('subjects/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  @RequireModule('document_templates')
  async updateSubject(@Param('id') id: string, @Body() dto: UpdateCatalogSubjectDto) {
    const payload: Record<string, unknown> = {};
    if (dto.code !== undefined) payload.code = dto.code;
    if (dto.label !== undefined) payload.label = dto.label;
    if (dto.grade_min !== undefined) payload.grade_min = dto.grade_min;
    if (dto.grade_max !== undefined) payload.grade_max = dto.grade_max;
    if (dto.section_filter !== undefined) payload.section_filter = dto.section_filter;
    if (dto.ana_grup !== undefined) payload.ana_grup = dto.ana_grup;
    if (dto.sort_order !== undefined) payload.sort_order = dto.sort_order;
    if (dto.is_active !== undefined) payload.is_active = dto.is_active;
    return this.catalogService.updateSubject(id, payload as any);
  }

  /** Superadmin: Ders sil (soft delete) */
  @Delete('subjects/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  @RequireModule('document_templates')
  async deleteSubject(@Param('id') id: string) {
    await this.catalogService.deleteSubject(id);
    return { ok: true };
  }
}
