import {
  BadRequestException,
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
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { OptikService } from './optik.service';
import { OcrRequestDto } from './dto/ocr-request.dto';
import { GradeRequestDto } from './dto/grade-request.dto';
import { CreateUserFormTemplateDto, UpdateUserFormTemplateDto } from './dto/user-form-template.dto';
import { parsePrependBlankQuery } from './optik-form-pdf.service';
import { OptikReportsService } from './optik-reports.service';
import { OptikSessionsService } from './optik-sessions.service';
import { CreateOptikScanResultDto } from './dto/create-scan-result.dto';
import {
  CreateExamSessionDto,
  UpdateAnswerKeyDto,
  UpdateOpenQuestionsDto,
} from './dto/create-exam-session.dto';
import { GradeSessionOpenDto, ManualOpenScoresDto } from './dto/grade-session-open.dto';
import { UpdateQuestionOutcomesDto, UpdateSessionLinksDto } from './dto/update-session-links.dto';

function pdfAttachmentDisposition(filename: string): string {
  const safe = filename.replace(/["\r\n]/g, '_');
  return `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

class GradeBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeRequestDto)
  requests!: GradeRequestDto[];
}

@Controller('optik')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('optical')
export class OptikController {
  constructor(
    private readonly optik: OptikService,
    private readonly reports: OptikReportsService,
    private readonly sessions: OptikSessionsService,
  ) {}

  /** Modül durumu – PWA / web istemci */
  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async status(@CurrentUser() payload: CurrentUserPayload) {
    return this.optik.getStatus(payload.userId);
  }

  @Get('rubric-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async listRubrics() {
    return this.optik.listRubricsForTeacher();
  }

  @Get('form-templates/:id/scan-layout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getScanLayout(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return this.optik.getScanLayout(id, payload.userId, payload.schoolId, payload.role);
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

  @Post('form-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async createFormTemplate(
    @Body() dto: CreateUserFormTemplateDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.optik.createCustomFormTemplate(
      dto,
      payload.userId,
      payload.schoolId,
      payload.role,
    );
  }

  @Patch('form-templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateFormTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateUserFormTemplateDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.optik.updateCustomFormTemplate(
      id,
      dto,
      payload.userId,
      payload.schoolId,
      payload.role,
    );
  }

  @Delete('form-templates/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async deleteFormTemplate(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    await this.optik.deleteCustomFormTemplate(id, payload.userId, payload.schoolId, payload.role);
    return { success: true };
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
      const prependBlank = parsePrependBlankQuery(prependBlankStr);
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

  @Post('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async createSession(@Body() dto: CreateExamSessionDto, @CurrentUser() payload: CurrentUserPayload) {
    const row = await this.sessions.createSession(dto, payload.userId, payload.schoolId ?? null);
    return { id: row.id, title: row.title };
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async listSessions(
    @Query('butterfly_plan_id') butterflyPlanId: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.listSessions(
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
      butterflyPlanId,
    );
  }

  @Get('sessions/by-butterfly/:planId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async listSessionsByButterfly(
    @Param('planId') planId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.findByButterflyPlan(
      planId,
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
    );
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getSession(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    return this.sessions.getSession(id, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async deleteSession(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    return this.sessions.deleteSession(id, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Patch('sessions/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateSessionStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.updateSessionStatus(
      id,
      body.status,
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
    );
  }

  @Patch('sessions/:id/answer-key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateAnswerKey(
    @Param('id') id: string,
    @Body() dto: UpdateAnswerKeyDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.updateAnswerKey(id, dto, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Patch('sessions/:id/links')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateSessionLinks(
    @Param('id') id: string,
    @Body() dto: UpdateSessionLinksDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.updateSessionLinks(id, dto, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Patch('sessions/:id/question-outcomes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateQuestionOutcomes(
    @Param('id') id: string,
    @Body() dto: UpdateQuestionOutcomesDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.updateQuestionOutcomes(id, dto, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Get('sessions/:id/outcome-insights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getOutcomeInsights(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    return this.sessions.getOutcomeInsights(id, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Patch('sessions/:id/open-questions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async updateOpenQuestions(
    @Param('id') id: string,
    @Body() dto: UpdateOpenQuestionsDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.updateOpenQuestions(id, dto, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Post('sessions/:id/grade-open')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async gradeSessionOpen(
    @Param('id') id: string,
    @Body() dto: GradeSessionOpenDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.gradeSessionOpen(id, dto, payload.user, payload.schoolId ?? null, payload.role);
  }

  @Post('sessions/:id/open-scores')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async saveManualOpenScores(
    @Param('id') id: string,
    @Body() dto: ManualOpenScoresDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.saveManualOpenScores(id, dto, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Get('sessions/:id/report')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getSessionReport(
    @Param('id') id: string,
    @Query('student_ids') studentIdsStr: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const classStudentIds = studentIdsStr?.split(',').filter(Boolean);
    return this.sessions.getSessionReport(
      id,
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
      classStudentIds,
    );
  }

  @Get('sessions/:id/export/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async exportSessionPdf(
    @Param('id') id: string,
    @Query('type') type: string,
    @Query('student_id') student_id: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
    @Res() res: Response,
  ) {
    if (!type?.trim()) {
      throw new BadRequestException('type parametresi gerekli');
    }
    const { buffer, filename } = await this.sessions.exportSessionPdf(
      id,
      type as 'class_list' | 'summary' | 'item_analysis' | 'outcome' | 'student',
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
      student_id,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', pdfAttachmentDisposition(filename));
    res.send(buffer);
  }

  @Get('sessions/:id/export.csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async exportSessionCsv(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const csv = await this.sessions.exportSessionCsv(
      id,
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="optik-${id.slice(0, 8)}.csv"`);
    res.send('\uFEFF' + csv);
  }

  @Get('sessions/:id/export/eokul')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async exportEokul(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
    @Res() res: Response,
  ) {
    const csv = await this.sessions.exportEokulCsv(
      id,
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eokul-${id.slice(0, 8)}.csv"`);
    res.send('\uFEFF' + csv);
  }

  @Post('sessions/:id/scans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async createSessionScan(
    @Param('id') id: string,
    @Body() dto: CreateOptikScanResultDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.sessions.createSessionScan(
      id,
      { ...dto, session_id: id },
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
    );
  }

  @Post('scan-results')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async createScanResult(
    @Body() dto: CreateOptikScanResultDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const row = await this.reports.createScanResult(dto, payload.userId, payload.schoolId ?? null);
    return { id: row.id, scanned_at: row.scannedAt.toISOString() };
  }

  @Get('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getReports(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('class_id') class_id?: string,
    @Query('subject_id') subject_id?: string,
    @Query('template_id') template_id?: string,
    @Query('exam_type') exam_type?: string,
    @Query('kind') kind?: string,
    @Query('session_id') session_id?: string,
  ) {
    return this.reports.getFullReport(payload.userId, payload.schoolId ?? null, payload.role, {
      from,
      to,
      class_id,
      subject_id,
      template_id,
      exam_type,
      kind,
      session_id,
    });
  }

  @Get('reports/export/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async exportReportPdf(
    @CurrentUser() payload: CurrentUserPayload,
    @Res() res: Response,
    @Query('type') type: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('class_id') class_id?: string,
    @Query('subject_id') subject_id?: string,
    @Query('template_id') template_id?: string,
    @Query('exam_type') exam_type?: string,
    @Query('kind') kind?: string,
    @Query('session_id') session_id?: string,
  ) {
    if (type !== 'period_summary') {
      throw new BadRequestException('type=period_summary gerekli');
    }
    const { buffer, filename } = await this.reports.exportPeriodPdf(
      payload.userId,
      payload.schoolId ?? null,
      payload.role,
      { from, to, class_id, subject_id, template_id, exam_type, kind, session_id },
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', pdfAttachmentDisposition(filename));
    res.send(buffer);
  }

  @Get('reports/scans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async listReportScans(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('class_id') class_id?: string,
    @Query('subject_id') subject_id?: string,
    @Query('template_id') template_id?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.reports.listScanDetails(payload.userId, payload.schoolId ?? null, payload.role, {
      from,
      to,
      class_id,
      subject_id,
      template_id,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Delete('scan-results/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async deleteScanResult(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    return this.reports.deleteScanResult(id, payload.userId, payload.schoolId ?? null, payload.role);
  }

  @Post('ocr')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async ocr(@Body() dto: OcrRequestDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.optik.ocr(
      dto.image_base64,
      dto.language_hint ?? 'tr',
      payload.user,
      payload?.schoolId ?? null,
      dto.kind ?? 'STUDENT',
    );
  }

  @Post('grade')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async grade(@Body() dto: GradeRequestDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.optik.grade(dto, payload.user, payload?.schoolId ?? null, {
      userId: payload.userId,
      schoolId: payload.schoolId,
      role: payload.role,
    });
  }

  @Post('grade/batch')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async gradeBatch(@Body() dto: GradeBatchDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.optik.gradeBatch(dto.requests, payload.user, payload?.schoolId ?? null, {
      userId: payload.userId,
      schoolId: payload.schoolId,
      role: payload.role,
    });
  }
}
