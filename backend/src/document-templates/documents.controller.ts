import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireAnySchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { User } from '../users/entities/user.entity';
import { DocumentGenerateService } from './document-generate.service';
import { DocumentGenerationService } from './document-generation.service';
import { GenerateDocumentDto } from './dto/generate-document.dto';

@Controller('documents')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireAnySchoolModule('document', 'bilsem')
export class DocumentsController {
  constructor(
    private readonly generateService: DocumentGenerateService,
    private readonly generationService: DocumentGenerationService,
  ) {}

  /**
   * Form + merge ile evrak üretir.
   * requiresMerge=true olan şablonlar için kullanılır.
   */
  @Post('generate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async generate(
    @Body() dto: GenerateDocumentDto,
    @CurrentUser() payload: { user: User },
  ) {
    return this.generateService.generate(dto, payload.user);
  }

  /**
   * Merge sonucunu önizleme olarak döndürür (xlsx için tablo verisi).
   */
  @Post('preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async preview(
    @Body() dto: GenerateDocumentDto,
    @CurrentUser() payload: { user: User },
  ) {
    return this.generateService.preview(dto, payload.user);
  }

  /**
   * Kullanıcının son evrak üretimlerini listeler (arşiv).
   */
  @Get('generations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async listGenerations(
    @CurrentUser() payload: { user: User },
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) : 20;
    return this.generationService.findAllByUser(payload.user.id, limitNum);
  }

  @Delete('generations/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async deleteGeneration(
    @Param('id') id: string,
    @CurrentUser() payload: { user: User },
  ) {
    await this.generationService.deleteForUser(id, payload.user.id);
    return { ok: true };
  }

  /**
   * Arşivdeki kayıt için tekrar evrak üretir ve indirme URL'i döner.
   */
  @Post('generations/:id/redownload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async redownload(
    @Param('id') id: string,
    @CurrentUser() payload: { user: User },
  ) {
    const gen = await this.generationService.findOneForUser(id, payload.user.id);
    if (!gen.templateId || !gen.template) {
      throw new BadRequestException({
        code: 'TEMPLATE_DELETED',
        message: 'Şablon artık mevcut değil. Bu evrak için tekrar indirme yapılamaz.',
      });
    }
    return this.generateService.generate(
      { template_id: gen.templateId, form_data: gen.formData ?? {} },
      payload.user,
      { skipSave: true },
    );
  }
}
