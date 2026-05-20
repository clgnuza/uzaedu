import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { TeacherTimetableService, type TimetableEntry } from './teacher-timetable.service';

function timetableUploadExt(file: Express.Multer.File): string {
  const fromName = (path.extname(file.originalname ?? '') || '').toLowerCase();
  if (['.xlsx', '.xls', '.pdf'].includes(fromName)) return fromName;
  const mime = String(file.mimetype ?? '').toLowerCase();
  if (mime.includes('openxmlformats-officedocument.spreadsheetml')) return '.xlsx';
  if (mime === 'application/vnd.ms-excel') return '.xls';
  if (mime === 'application/pdf') return '.pdf';
  const buf = file.buffer;
  if (buf?.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return '.pdf';
  if (buf?.length >= 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return '.xls';
  if (buf?.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) && (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08))
    return '.xlsx';
  return '.xlsx';
}

/** Admin program sayfası çoklu GET + React Strict Mode; global throttle 429 üretmesin. */
@Controller('teacher-timetable')
@SkipThrottle({ default: true, auth: true, public: true })
@UseGuards(JwtAuthGuard)
export class TeacherTimetableController {
  constructor(private readonly service: TeacherTimetableService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async list(@CurrentUser() payload: CurrentUserPayload, @Query('date') date?: string) {
    return this.service.getBySchool(payload.schoolId ?? null, date);
  }

  @Get('plan-info')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getPlanInfo(@CurrentUser() payload: CurrentUserPayload, @Query('date') date?: string) {
    return this.service.getActivePlanInfo(payload.schoolId ?? null, date);
  }

  @Get('distinct-class-sections')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getDistinctClassSections(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') querySchoolId?: string,
  ) {
    const schoolId =
      (payload.user.role as UserRole) === UserRole.superadmin && querySchoolId
        ? querySchoolId
        : payload.schoolId ?? null;
    return this.service.getDistinctClassSections(schoolId);
  }

  /** Duyuru TV ayarları: okul planından üretilecek grid önizlemesi (IP kısıtı yok). */
  @Get('tv-schedule-preview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async tvSchedulePreview(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') querySchoolId?: string,
  ) {
    const schoolId =
      (payload.user.role as UserRole) === UserRole.superadmin && querySchoolId
        ? querySchoolId
        : payload.schoolId ?? null;
    if (!schoolId) {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul seçin veya school_id verin.' });
    }
    const json = await this.service.buildTvTimetableScheduleJsonForTv(schoolId);
    let entry_count = 0;
    let lesson_times_count = 0;
    const class_sections: string[] = [];
    const sample_entries: Array<{ day: number; lesson: number; class: string; subject: string }> = [];
    if (json) {
      try {
        const o = JSON.parse(json) as {
          entries?: Array<{ day: number; lesson: number; class: string; subject: string }>;
          lesson_times?: unknown[];
          lesson_times_weekend?: unknown[];
          class_sections?: string[];
        };
        entry_count = Array.isArray(o.entries) ? o.entries.length : 0;
        const nWd = Array.isArray(o.lesson_times) ? o.lesson_times.length : 0;
        const nWk = Array.isArray(o.lesson_times_weekend) ? o.lesson_times_weekend.length : 0;
        lesson_times_count = Math.max(nWd, nWk);
        if (Array.isArray(o.class_sections)) class_sections.push(...o.class_sections);
        if (Array.isArray(o.entries)) sample_entries.push(...o.entries.slice(0, 8));
      } catch {
        /* ignore */
      }
    }
    return {
      empty: !json || entry_count === 0,
      entry_count,
      lesson_times_count,
      class_sections,
      sample_entries,
    };
  }

  @Get('me')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getMe(@CurrentUser() payload: CurrentUserPayload, @Query('date') date?: string) {
    return this.service.getByMe(payload.schoolId ?? null, payload.userId, date);
  }

  /** Öğretmen: okul + kişisel program özeti; çakışma tespiti (çift kişisel programda aynı slotta farklı ders). */
  @Get('me/program-overview')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async getMeProgramOverview(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.getTeacherProgramOverview(payload.schoolId ?? null, payload.userId);
  }

  @Get('my-programs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async listMyPrograms(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.listPersonalPrograms(payload.schoolId ?? null, payload.userId);
  }

  @Post('my-programs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async createMyProgram(
    @CurrentUser() payload: CurrentUserPayload,
    @Body()
    body: { name: string; academic_year?: string; term?: string; entries?: { day_of_week: number; lesson_num: number; class_section: string; subject: string }[] },
  ) {
    return this.service.createPersonalProgram(payload.schoolId ?? null, payload.userId, body);
  }

  @Get('my-programs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async getMyProgram(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.service.getPersonalProgramById(id, payload.schoolId ?? null, payload.userId);
  }

  @Patch('my-programs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async updateMyProgram(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body()
    body: { name?: string; academic_year?: string; term?: string; entries?: { day_of_week: number; lesson_num: number; class_section: string; subject: string }[] },
  ) {
    return this.service.updatePersonalProgram(id, payload.schoolId ?? null, payload.userId, body);
  }

  @Delete('my-programs/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async deleteMyProgram(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.service.deletePersonalProgram(id, payload.schoolId ?? null, payload.userId);
  }

  @Post('import-from-admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async importFromAdmin(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.importFromAdmin(payload.schoolId ?? null, payload.userId);
  }

  @Get('max-lessons')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getMaxLessons(@CurrentUser() payload: CurrentUserPayload) {
    const max = await this.service.getMaxLessons(payload.schoolId ?? null);
    return { max_lessons: max };
  }

  @Get('example-template')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  @Header('Content-Disposition', 'attachment; filename="ogretmen-ders-programi-ornek.xlsx"')
  async downloadExample(@CurrentUser() payload: CurrentUserPayload): Promise<StreamableFile> {
    if (!payload.schoolId) throw new BadRequestException({ code: 'FORBIDDEN', message: 'Okul bilgisi bulunamadı.' });
    const max = await this.service.getSchoolConfigMaxLessons(payload.schoolId);
    const buffer = this.service.generateExampleExcel(max);
    return new StreamableFile(buffer);
  }

  @Get('by-date')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.teacher)
  async getByDate(
    @Query('date') date: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!date) return {};
    return this.service.getByDate(payload.schoolId ?? null, date.slice(0, 10));
  }

  @Get('plans')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async listPlans(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.listPlans(payload.schoolId ?? null);
  }

  @Get('plans/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async getPlanById(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.service.getPlanById(id, payload.schoolId ?? null);
  }

  @Delete('plans/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async deleteDraftPlan(@CurrentUser() payload: CurrentUserPayload, @Param('id') id: string) {
    return this.service.deleteDraftPlan(id, payload.schoolId ?? null);
  }

  @Post('plans/:id/publish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async publishPlan(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: { valid_from: string; valid_until?: string | null },
  ) {
    if (!body.valid_from) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'valid_from gereklidir.' });
    }
    return this.service.publishPlan(id, payload.schoolId ?? null, payload.userId, body.valid_from, body.valid_until ?? null);
  }

  @Patch('plans/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async updatePlan(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: { valid_from?: string; valid_until?: string | null; name?: string | null },
  ) {
    return this.service.patchSchoolPlan(id, payload.schoolId ?? null, body);
  }

  @Post('plans/:id/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async restorePlan(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
    @Body() body: { valid_from: string; valid_until?: string | null },
  ) {
    if (!body.valid_from) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'valid_from gereklidir.' });
    }
    return this.service.restoreArchivedPlan(
      id,
      payload.schoolId ?? null,
      payload.userId,
      body.valid_from,
      body.valid_until ?? null,
    );
  }

  @Post('plans/:id/archive')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async archivePlan(
    @CurrentUser() payload: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    return this.service.archivePublishedPlan(id, payload.schoolId ?? null);
  }

  @Post('upload-gpt-reconcile')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'file_pdf', maxCount: 1 },
        { name: 'file_xls', maxCount: 1 },
      ],
      {
        limits: { fileSize: 8 * 1024 * 1024 },
        fileFilter: (_req, file, cb) => {
          const ext = (path.extname(file.originalname ?? '') || '').toLowerCase();
          const field = file.fieldname;
          if (field === 'file_pdf') cb(null, ext === '.pdf');
          else if (field === 'file_xls') cb(null, ext === '.xlsx' || ext === '.xls');
          else cb(null, false);
        },
      },
    ),
  )
  async uploadGptReconcile(
    @CurrentUser() payload: CurrentUserPayload,
    @Req() req: Request,
    @Query('preview') preview?: string,
  ) {
    const files = (req as Request & { files?: Record<string, Express.Multer.File[]> }).files;
    const pdf = files?.file_pdf?.[0];
    const xls = files?.file_xls?.[0];
    if (!pdf?.buffer || !xls?.buffer) {
      throw new BadRequestException({
        code: 'GPT_RECONCILE_FILES_REQUIRED',
        message: 'GPT uzlaştırma için hem PDF (öğretmen) hem Excel (kurumsal program) yükleyin.',
      });
    }
    const schoolId = payload.schoolId ?? null;
    if (!schoolId) throw new BadRequestException({ code: 'FORBIDDEN', message: 'Okul bilgisi bulunamadı.' });
    const pdfPath = path.join(os.tmpdir(), `tt-pdf-${Date.now()}.pdf`);
    const xlsPath = path.join(os.tmpdir(), `tt-xls-${Date.now()}${timetableUploadExt(xls)}`);
    try {
      fs.writeFileSync(pdfPath, pdf.buffer);
      fs.writeFileSync(xlsPath, xls.buffer);
      const isPreview = preview === '1' || preview === 'true';
      return await this.service.uploadFromGptReconcile(schoolId, pdfPath, xlsPath, { preview: isPreview });
    } finally {
      for (const p of [pdfPath, xlsPath]) {
        try {
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {
          /* ignore */
        }
      }
    }
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = (path.extname(file.originalname ?? '') || '').toLowerCase();
        const mime = String(file.mimetype ?? '').toLowerCase();
        const ok =
          ext === '.xlsx' || ext === '.xls' || ext === '.pdf' ||
          mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          mime === 'application/vnd.ms-excel' ||
          mime === 'application/pdf' ||
          (mime === 'application/octet-stream' && (ext === '.xlsx' || ext === '.xls' || ext === '.pdf'));
        cb(null, !!ok);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() payload: CurrentUserPayload,
    @Req() req: Request,
    @Query('mode') modeRaw: string | undefined,
    @Query('preview') preview?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Dosya yükleyin (.xlsx/.xls veya GPT için .pdf).',
      });
    }
    const schoolId = payload.schoolId ?? null;
    if (!schoolId) throw new BadRequestException({ code: 'FORBIDDEN', message: 'Okul bilgisi bulunamadı.' });
    const bodyMode =
      typeof req.body === 'object' && req.body !== null && 'mode' in req.body
        ? String((req.body as { mode?: unknown }).mode ?? '').trim()
        : '';
    const mode = String(bodyMode || modeRaw || 'template').toLowerCase() === 'gpt' ? 'gpt' : 'template';
    const ext = timetableUploadExt(file);
    if (mode === 'template' && ext === '.pdf') {
      throw new BadRequestException({
        code: 'PDF_USE_GPT_MODE',
        message: 'PDF’yi «e-Okul / GPT ile yükle» bölümünden yükleyin; şablon yüklemesi yalnızca Excel kabul eder.',
      });
    }
    if (mode === 'gpt' && ext !== '.pdf' && ext !== '.xlsx' && ext !== '.xls') {
      throw new BadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'GPT yüklemesi için .pdf, .xlsx veya .xls seçin.',
      });
    }
    const tempPath = path.join(os.tmpdir(), `tt-${Date.now()}${ext}`);
    try {
      fs.writeFileSync(tempPath, file.buffer);
      const isPreview = preview === '1' || preview === 'true';
      return await this.service.uploadFromExcel(schoolId, tempPath, mode, { preview: isPreview });
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        /* ignore */
      }
    }
  }

  @Post('plans/draft-from-entries')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async saveDraftFromEntries(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: { entries?: TimetableEntry[]; errors?: string[] },
  ) {
    const schoolId = payload.schoolId ?? null;
    const entries = Array.isArray(body?.entries) ? body.entries : [];
    const errors = Array.isArray(body?.errors) ? body.errors.map(String) : [];
    return this.service.saveDraftFromPreviewEntries(schoolId, entries, errors);
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async clear(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.clear(payload.schoolId ?? null);
  }
}
