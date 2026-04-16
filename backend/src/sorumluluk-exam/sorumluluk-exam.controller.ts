import {
  BadRequestException, Body, Controller, Delete, ForbiddenException, Get, Param,
  Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { UserRole } from '../types/enums';
import { SorumlulukExamService } from './sorumluluk-exam.service';
import { CreateSorumlulukGroupDto } from './dto/create-group.dto';
import { CreateSorumlulukStudentDto } from './dto/create-student.dto';
import { CreateSorumlulukSessionDto, SetSessionProctorsDto } from './dto/create-session.dto';

@Controller('sorumluluk-exam')
@UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('sorumluluk_sinav')
export class SorumlulukExamController {
  constructor(private readonly service: SorumlulukExamService) {}

  private sid(payload: CurrentUserPayload, q?: string): string {
    if (payload.role === UserRole.superadmin || payload.role === UserRole.moderator) {
      const id = (q ?? '').trim();
      if (!id) throw new BadRequestException({ code: 'SCHOOL_ID', message: 'superadmin için school_id gerekli.' });
      return id;
    }
    if (!payload.schoolId) throw new BadRequestException({ code: 'NO_SCHOOL' });
    return payload.schoolId;
  }

  @Get('my-assignments')
  @Roles(UserRole.teacher)
  listMyAssignments(@CurrentUser() p: CurrentUserPayload) {
    if (!p.schoolId) throw new BadRequestException({ code: 'NO_SCHOOL', message: 'Okul bağlantısı yok.' });
    return this.service.listMyProctorAssignments(p.schoolId, p.userId);
  }

  // ── Gruplar ──────────────────────────────────────────────────────────────

  @Get('groups')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listGroups(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    this.service.assertAccess(p.role, p.schoolId, sid);
    return this.service.listGroups(sid);
  }

  @Post('groups')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createGroup(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q: string | undefined, @Body() dto: CreateSorumlulukGroupDto) {
    const sid = this.sid(p, q);
    this.service.assertAccess(p.role, p.schoolId, sid);
    return this.service.createGroup(sid, dto);
  }

  @Patch('groups/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  updateGroup(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q: string | undefined, @Body() body: Partial<CreateSorumlulukGroupDto> & { status?: string }) {
    const sid = this.sid(p, q);
    this.service.assertAccess(p.role, p.schoolId, sid);
    return this.service.updateGroup(sid, id, body);
  }

  @Delete('groups/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  deleteGroup(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    this.service.assertAccess(p.role, p.schoolId, sid);
    return this.service.deleteGroup(sid, id);
  }

  // ── Öğrenciler ────────────────────────────────────────────────────────────

  @Get('groups/:groupId/students')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listStudents(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.listStudents(sid, groupId);
  }

  @Post('groups/:groupId/students')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createStudent(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Body() dto: CreateSorumlulukStudentDto) {
    const sid = this.sid(p, q);
    return this.service.createStudent(sid, groupId, dto);
  }

  @Patch('students/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  updateStudent(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q: string | undefined, @Body() dto: Partial<CreateSorumlulukStudentDto>) {
    const sid = this.sid(p, q);
    return this.service.updateStudent(sid, id, dto);
  }

  @Delete('students/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  deleteStudent(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.deleteStudent(sid, id);
  }

  @Post('groups/:groupId/import-excel')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importExcel(
    @CurrentUser() p: CurrentUserPayload,
    @Param('groupId') groupId: string,
    @Query('school_id') q: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const sid = this.sid(p, q);
    return this.service.importStudents(sid, groupId, this._parseExcelRows(file.buffer));
  }

  @Post('groups/:groupId/import-meb')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importMeb(
    @CurrentUser() p: CurrentUserPayload,
    @Param('groupId') groupId: string,
    @Query('school_id') q: string | undefined,
    @Query('create_sessions') createSessions: string | undefined,
    @Query('auto_schedule') autoSchedule: string | undefined,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Excel dosyası gerekli');
    const sid = this.sid(p, q);
    const rows = this._parseExcelRows(file.buffer);
    return this.service.importMebAndPlan(sid, groupId, rows, {
      createSessions: createSessions === '1' || createSessions === 'true',
      autoSchedule:   autoSchedule   === '1' || autoSchedule   === 'true',
    });
  }

  private _parseExcelRows(buffer: Buffer) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx') as typeof import('xlsx');
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    return raw.map((r) => {
      const keys = Object.keys(r);
      // Geniş regex: MEB e-okul sütun adlarını kapsıyor
      const nameKey = keys.find((k) => /öğrenci.*ad|ad.*soyad|adı.*soyadı|isim|name/i.test(k)) ?? keys.find((k) => /ad/i.test(k)) ?? keys[0];
      const noKey   = keys.find((k) => /öğrenci.*no|okul.*no|numara|^no$/i.test(k));
      const clsKey  = keys.find((k) => /sınıf|şube|sinif|sube|class/i.test(k));
      // Hem "Ders1/Ders 1" hem "Sorumlu Ders" hem "1\. Ders" hem sadece sıralı sayılar (e-okul bazen sütun adı yerine sıra no yazar)
      const subjKeys = keys.filter((k) => /^ders\s*\d|^\d+\.\s*ders|sorumlu.*ders|ders.*\d|lesson|subject/i.test(k));
      // e-okul bazen "Sorumlu Dersler" sütununu virgülle liste olarak verir
      const multiKey = keys.find((k) => /sorumlu\s+dersler?$/i.test(k));
      let subjects: string[] = [];
      if (multiKey && String(r[multiKey] ?? '').trim()) {
        subjects = String(r[multiKey]).split(/[,;/\n]+/).map((s) => s.trim()).filter(Boolean);
      } else {
        subjects = subjKeys.map((k) => String(r[k] ?? '').trim()).filter(Boolean);
      }
      return {
        studentName:   String(r[nameKey] ?? '').trim(),
        studentNumber: noKey  ? String(r[noKey]  ?? '').trim() || undefined : undefined,
        className:     clsKey ? String(r[clsKey] ?? '').trim() || undefined : undefined,
        subjects,
      };
    });
  }

  // ── Oturumlar ─────────────────────────────────────────────────────────────

  @Get('groups/:groupId/sessions')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listSessions(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.listSessions(sid, groupId);
  }

  @Post('groups/:groupId/sessions')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  createSession(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Body() dto: CreateSorumlulukSessionDto) {
    const sid = this.sid(p, q);
    return this.service.createSession(sid, groupId, dto);
  }

  @Patch('sessions/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  updateSession(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q: string | undefined, @Body() body: Partial<CreateSorumlulukSessionDto> & { status?: string }) {
    const sid = this.sid(p, q);
    return this.service.updateSession(sid, id, body);
  }

  @Delete('sessions/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  deleteSession(@CurrentUser() p: CurrentUserPayload, @Param('id') id: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.deleteSession(sid, id);
  }

  // ── Oturum öğrencileri ────────────────────────────────────────────────────

  @Get('sessions/:sessionId/students')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listSessionStudents(@CurrentUser() p: CurrentUserPayload, @Param('sessionId') sessionId: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.listSessionStudents(sid, sessionId);
  }

  @Post('sessions/:sessionId/students/:studentId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  assignStudent(@CurrentUser() p: CurrentUserPayload, @Param('sessionId') sessionId: string, @Param('studentId') studentId: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.assignStudentToSession(sid, sessionId, studentId);
  }

  @Delete('sessions/:sessionId/students/:studentId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  removeStudent(@CurrentUser() p: CurrentUserPayload, @Param('sessionId') sessionId: string, @Param('studentId') studentId: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.removeStudentFromSession(sid, sessionId, studentId);
  }

  @Patch('sessions/:sessionId/students/:studentId/attendance')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  updateAttendance(@CurrentUser() p: CurrentUserPayload, @Param('sessionId') sessionId: string, @Param('studentId') studentId: string, @Query('school_id') q: string | undefined, @Body() body: { status: string }) {
    const sid = this.sid(p, q);
    return this.service.updateAttendance(sid, sessionId, studentId, body.status);
  }

  // ── Otomatik programlama ──────────────────────────────────────────────────

  @Post('groups/:groupId/auto-schedule')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  autoSchedule(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.autoSchedule(sid, groupId);
  }

  @Get('groups/:groupId/conflicts')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  getConflicts(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.getConflicts(sid, groupId);
  }

  // ── Görevlendirme ─────────────────────────────────────────────────────────

  @Post('sessions/:sessionId/proctors')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  setProctors(@CurrentUser() p: CurrentUserPayload, @Param('sessionId') sessionId: string, @Query('school_id') q: string | undefined, @Body() dto: SetSessionProctorsDto) {
    const sid = this.sid(p, q);
    return this.service.setProctors(sid, sessionId, dto.proctors ?? []);
  }

  @Get('teachers')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  listTeachers(@CurrentUser() p: CurrentUserPayload, @Query('school_id') q?: string) {
    const sid = this.sid(p, q);
    return this.service.listTeachers(sid);
  }

  @Post('groups/:groupId/auto-assign-proctors')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  autoAssignProctors(
    @CurrentUser() p: CurrentUserPayload,
    @Param('groupId') groupId: string,
    @Query('school_id') q: string | undefined,
    @Body() body: {
      komisyonPerSession?: number;
      gozcuPerSession?: number;
      preferBranchMatch?: boolean;
      excludeBusy?: boolean;
      balanceLoad?: boolean;
      overwrite?: boolean;
    },
  ) {
    const sid = this.sid(p, q);
    return this.service.autoAssignProctors(sid, groupId, {
      komisyonPerSession: body.komisyonPerSession ?? 1,
      gozcuPerSession:    body.gozcuPerSession    ?? 1,
      preferBranchMatch:  body.preferBranchMatch  ?? true,
      excludeBusy:        body.excludeBusy         ?? true,
      balanceLoad:        body.balanceLoad          ?? true,
      overwrite:          body.overwrite            ?? false,
    });
  }

  // ── PDF ───────────────────────────────────────────────────────────────────

  @Get('sessions/:sessionId/pdf/yoklama')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async pdfYoklama(@CurrentUser() p: CurrentUserPayload, @Param('sessionId') sessionId: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q);
    if (p.role === UserRole.teacher) {
      const ok = await this.service.isUserProctorOnSession(sid, sessionId, p.userId);
      if (!ok) throw new ForbiddenException();
    }
    const bytes = await this.service.buildYoklamaPdf(sid, sessionId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="yoklama.pdf"' });
    res.send(Buffer.from(bytes));
  }

  @Get('groups/:groupId/pdf/program')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async pdfProgram(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q);
    const bytes = await this.service.buildProgramPdf(sid, groupId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="sinav-programi.pdf"' });
    res.send(Buffer.from(bytes));
  }

  @Get('groups/:groupId/pdf/ogrenci-program')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async pdfOgrenciProgram(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q);
    const bytes = await this.service.buildOgrenciProgramPdf(sid, groupId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="ogrenci-program.pdf"' });
    res.send(Buffer.from(bytes));
  }

  @Get('groups/:groupId/pdf/gorevlendirme')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async pdfGorevlendirme(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q);
    const bytes = await this.service.buildGorevlendirmePdf(sid, groupId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="gorevlendirme.pdf"' });
    res.send(Buffer.from(bytes));
  }

  @Get('groups/:groupId/pdf/imza-sirkulu')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async pdfImzaSirkulu(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q);
    const bytes = await this.service.buildImzaSirkuluPdf(sid, groupId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="imza-sirkulu.pdf"' });
    res.send(Buffer.from(bytes));
  }

  @Get('groups/:groupId/pdf/gorev-dagilimi')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async pdfGorevDagilimi(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q);
    const bytes = await this.service.buildGorevDagilimPdf(sid, groupId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="gorev-dagilimi.pdf"' });
    res.send(Buffer.from(bytes));
  }

  @Get('groups/:groupId/pdf/ek-ucret-onay')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async pdfEkUcretOnay(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q);
    const bytes = await this.service.buildEkUcretOnayPdf(sid, groupId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="ek-ucret-onay.pdf"' });
    res.send(Buffer.from(bytes));
  }

  @Get('groups/:groupId/pdf/tutanak')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async pdfTutanak(@CurrentUser() p: CurrentUserPayload, @Param('groupId') groupId: string, @Query('school_id') q: string | undefined, @Res() res: Response) {
    const sid = this.sid(p, q);
    const bytes = await this.service.buildTutanakPdf(sid, groupId);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="tutanak.pdf"' });
    res.send(Buffer.from(bytes));
  }

  @Get('students/excel-template')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  excelTemplate(@Res() res: Response) {
    const bytes = this.service.buildStudentExcelTemplate();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="ogrenci-sablon.xlsx"' });
    res.send(Buffer.from(bytes));
  }
}
