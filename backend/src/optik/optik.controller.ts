import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { OptikService } from './optik.service';
import { OcrRequestDto } from './dto/ocr-request.dto';
import { GradeRequestDto } from './dto/grade-request.dto';

class GradeBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeRequestDto)
  requests!: GradeRequestDto[];
}

@Controller('optik')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard)
@RequireSchoolModule('optical')
export class OptikController {
  constructor(private readonly optik: OptikService) {}

  /** Modül durumu – Flutter'da "hazır mı" kontrolü için */
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async status() {
    return this.optik.getStatus();
  }

  /** Öğretmen/school_admin: Aktif form şablonlarını listele (sistem + okul + kendi) */
  @Get('form-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async listFormTemplates(@CurrentUser() payload: CurrentUserPayload) {
    return this.optik.listFormTemplatesForUser(
      payload.userId,
      payload.schoolId,
      payload.role,
    );
  }

  /** Form şablonu PDF olarak indir. ?prepend_blank=1: Oncesine bos sayfa (yazili kagidi icin) */
  @Get('form-templates/:id/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async getFormTemplatePdf(
    @Param('id') id: string,
    @Query('prepend_blank') prependBlankStr: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
    @Res() res: Response,
  ) {
    try {
      const prependBlank = prependBlankStr ? Math.min(5, Math.max(0, parseInt(prependBlankStr, 10) || 0)) : 0;
      const { pdf, template } = await this.optik.generateFormPdf(
        id,
        payload.userId,
        payload.schoolId,
        payload.role,
        prependBlank > 0 ? { prependBlank } : undefined,
      );
      const filename = `${(template.slug || template.id).replace(/[^a-z0-9-]/gi, '-')}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'PDF oluşturulamadı';
      res.status(500).json({ code: 'PDF_GENERATION_FAILED', message: msg });
    }
  }

  @Post('ocr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async ocr(@Body() dto: OcrRequestDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.optik.ocr(
      dto.image_base64,
      dto.language_hint ?? 'tr',
      payload.user,
      payload?.schoolId ?? null,
    );
  }

  @Post('grade')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async grade(@Body() dto: GradeRequestDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.optik.grade(dto, payload.user, payload?.schoolId ?? null);
  }

  @Post('grade/batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async gradeBatch(@Body() dto: GradeBatchDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.optik.gradeBatch(dto.requests, payload.user, payload?.schoolId ?? null);
  }
}
