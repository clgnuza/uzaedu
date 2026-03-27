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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { TeacherTimetableService } from './teacher-timetable.service';

@Controller('teacher-timetable')
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
          class_sections?: string[];
        };
        entry_count = Array.isArray(o.entries) ? o.entries.length : 0;
        lesson_times_count = Array.isArray(o.lesson_times) ? o.lesson_times.length : 0;
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
    @Body() body: { valid_from: string; valid_until?: string | null },
  ) {
    if (!body.valid_from) {
      throw new BadRequestException({ code: 'INVALID_INPUT', message: 'valid_from gereklidir.' });
    }
    return this.service.updatePlanDates(id, payload.schoolId ?? null, body.valid_from, body.valid_until ?? null);
  }

  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ext = (path.extname(file.originalname ?? '') || '').toLowerCase();
        const ok = ext === '.xlsx' || ext === '.xls' ||
          file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
          file.mimetype === 'application/vnd.ms-excel';
        cb(null, !!ok);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException({ code: 'FILE_REQUIRED', message: 'Excel dosyası (.xlsx veya .xls) yükleyin.' });
    }
    const schoolId = payload.schoolId ?? null;
    if (!schoolId) throw new BadRequestException({ code: 'FORBIDDEN', message: 'Okul bilgisi bulunamadı.' });
    const tempPath = path.join(os.tmpdir(), `tt-${Date.now()}.xlsx`);
    try {
      fs.writeFileSync(tempPath, file.buffer);
      return this.service.uploadFromExcel(schoolId, tempPath);
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch {
        /* ignore */
      }
    }
  }

  @Delete()
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async clear(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.clear(payload.schoolId ?? null);
  }
}
