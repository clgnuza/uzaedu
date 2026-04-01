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
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireAnySchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { DocumentTemplatesService } from './document-templates.service';
import { ListDocumentTemplatesDto } from './dto/list-document-templates.dto';
import { CreateDocumentTemplateDto } from './dto/create-document-template.dto';
import { UpdateDocumentTemplateDto } from './dto/update-document-template.dto';

@Controller('document-templates')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireAnySchoolModule('document', 'bilsem')
export class DocumentTemplatesController {
  constructor(private readonly service: DocumentTemplatesService) {}

  /** Teacher, superadmin, moderator: MEB ders listesi (grade, section'a göre).
   * has_plan_content=1: öğretmen evrak için sadece plan içeriği oluşturulmuş dersler. */
  @Get('subjects')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getSubjects(
    @Query('grade') grade?: string,
    @Query('section') section?: string,
    @Query('has_plan_content') hasPlanContent?: string,
    @Query('academic_year') academicYear?: string,
    @Query('curriculum_model') curriculumModel?: string,
    @Query('ana_grup') anaGrup?: string,
    @Query('alt_grup') altGrup?: string,
  ) {
    return this.service.getSubjects(
      grade ? parseInt(grade, 10) : undefined,
      section || undefined,
      hasPlanContent === '1' || hasPlanContent === 'true',
      academicYear || undefined,
      curriculumModel?.trim() || undefined,
      anaGrup?.trim() || undefined,
      altGrup !== undefined ? altGrup : undefined,
    );
  }

  /** Teacher, superadmin, moderator: sub_type, school_type, academic_year, evrak_types (katalogdan) */
  @Get('options')
  @SkipThrottle({ default: true })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getOptions(@Query('type') type?: string) {
    return this.service.getOptions(type || undefined);
  }

  /** Admin: Katalog listesi – şablon formunda seçim için (evrak_type, sub_type, school_type, section, subject) */
  @Get('catalog')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getCatalog(
    @Query('category') category?: string,
    @Query('parent_code') parentCode?: string,
    @Query('grade') grade?: string,
    @Query('section') section?: string,
  ) {
    return this.service.getCatalogList({
      category: category as any,
      parentCode: parentCode || undefined,
      grade: grade ? parseInt(grade, 10) : undefined,
      section: section || undefined,
    });
  }

  /** Teacher, superadmin, moderator: Şablon listesi (filtreli) */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async list(@Query() dto: ListDocumentTemplatesDto) {
    return this.service.findAll(dto);
  }

  /** Teacher: İndirme URL'i (signed veya doğrudan) — :id/download, daha özel route önce */
  @Get(':id/download')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getDownloadUrl(@Param('id') id: string) {
    return this.service.getDownloadUrl(id);
  }

  /** Teacher, superadmin, moderator: Tek şablon detay */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Superadmin, moderator: Yeni şablon */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async create(@Body() dto: CreateDocumentTemplateDto) {
    return this.service.create(dto);
  }

  /** Superadmin, moderator: Şablon güncelle */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async update(@Param('id') id: string, @Body() dto: UpdateDocumentTemplateDto) {
    return this.service.update(id, dto);
  }

  /** Superadmin, moderator: Şablon sil */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { ok: true };
  }
}
