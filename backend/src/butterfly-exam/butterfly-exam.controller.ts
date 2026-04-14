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
  UploadedFile,
  UseGuards,
  UseInterceptors,
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
import { ButterflyExamService } from './butterfly-exam.service';
import { CreateButterflyBuildingDto } from './dto/create-building.dto';
import { CreateButterflyRoomDto } from './dto/create-room.dto';
import { CreateButterflyExamPlanDto } from './dto/create-plan.dto';
import { UpdateButterflyExamPlanDto } from './dto/update-plan.dto';
import { MoveButterflyAssignmentDto } from './dto/move-assignment.dto';
import { SetButterflyProctorsDto } from './dto/set-proctors.dto';

@Controller('butterfly-exam')
@UseGuards(JwtAuthGuard, RolesGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('butterfly_exam')
export class ButterflyExamController {
  constructor(private readonly service: ButterflyExamService) {}

  private schoolId(payload: CurrentUserPayload, q?: string): string {
    if (payload.role === UserRole.superadmin || payload.role === UserRole.moderator) {
      const id = (q ?? '').trim();
      if (!id) throw new BadRequestException({ code: 'SCHOOL_ID', message: 'superadmin için school_id gerekli.' });
      return id;
    }
    if (!payload.schoolId) throw new BadRequestException({ code: 'NO_SCHOOL', message: 'Okul bağlantısı yok.' });
    return payload.schoolId;
  }

  @Get('overview-stats')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async overviewStats(@CurrentUser() payload: CurrentUserPayload, @Query('school_id') schoolId?: string) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.getSchoolOverviewStats(sid);
  }

  @Get('buildings')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async listBuildings(@CurrentUser() payload: CurrentUserPayload, @Query('school_id') schoolId?: string) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.listBuildings(sid);
  }

  @Post('buildings')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async createBuilding(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Body() dto: CreateButterflyBuildingDto,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.createBuilding(sid, dto);
  }

  @Patch('buildings/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async updateBuilding(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
    @Body() dto: Partial<CreateButterflyBuildingDto>,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.updateBuilding(sid, id, dto);
  }

  @Delete('buildings/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async deleteBuilding(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.deleteBuilding(sid, id);
  }

  @Get('rooms')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async listRooms(@CurrentUser() payload: CurrentUserPayload, @Query('school_id') schoolId?: string) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.listRooms(sid);
  }

  @Post('rooms')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async createRoom(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Body() dto: CreateButterflyRoomDto,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.createRoom(sid, dto);
  }

  @Patch('rooms/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async updateRoom(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
    @Body() dto: Partial<Pick<CreateButterflyRoomDto, 'building_id' | 'name' | 'capacity' | 'seat_layout' | 'sort_order'>> & {
      layoutGroups?: Array<{ rowType: 'pair' | 'single'; rowCount: number }>;
    },
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.updateRoom(sid, id, dto);
  }

  @Delete('rooms/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async deleteRoom(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.deleteRoom(sid, id);
  }

  @Get('plans')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async listPlans(@CurrentUser() payload: CurrentUserPayload, @Query('school_id') schoolId?: string) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    const plans = await this.service.listPlans(sid);
    if (payload.role === UserRole.teacher) {
      return plans.filter((p) => p.status !== 'draft');
    }
    return plans;
  }

  @Get('plans/:id')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async getPlan(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.getPlan(sid, id);
  }

  @Post('plans')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async createPlan(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Body() dto: CreateButterflyExamPlanDto,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.createPlan(sid, payload.userId, dto);
  }

  @Patch('plans/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async updatePlan(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
    @Body() dto: UpdateButterflyExamPlanDto,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.updatePlan(sid, id, dto);
  }

  @Post('plans/:id/generate-seats')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async generateSeats(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.generateSeatAssignments(sid, id);
  }

  @Get('plans/:id/assignments')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async listAssignments(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.listAssignments(sid, id, { forTeacher: payload.role === UserRole.teacher });
  }

  @Patch('assignments/:assignmentId/move')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async moveAssignment(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: MoveButterflyAssignmentDto,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.moveAssignment(sid, assignmentId, dto.room_id, dto.seat_index);
  }

  @Patch('assignments/:assignmentId/lock')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async lockAssignment(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('assignmentId') assignmentId: string,
    @Body() body: { locked: boolean },
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.setAssignmentLock(sid, assignmentId, !!body?.locked);
  }

  @Get('plans/:id/proctors')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async listProctors(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.listProctors(sid, id);
  }

  @Post('plans/:id/proctors')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async setProctors(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
    @Body() dto: SetButterflyProctorsDto,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.setProctors(sid, id, dto.proctors);
  }

  @Get('plans/:id/pdf/salon')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async salonPdf(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
    @Query('room_id') roomId: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    if (!roomId?.trim()) throw new BadRequestException({ message: 'room_id gerekli.' });
    const pdf = await this.service.buildSalonPdf(sid, id, roomId.trim());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="salon-${roomId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('pdf/takvim')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async takvimPdf(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Query('plan_ids') planIdsStr: string,
    @Query('type') type: 'genel' | 'sinif' | 'sube' = 'genel',
    @Query('grade') gradeStr: string | undefined,
    @Query('class_id') classId: string | undefined,
    @Query('city_line') cityLine: string | undefined,
    @Query('academic_year') academicYear: string | undefined,
    @Query('duzenleyen_name') duzenleyenName: string | undefined,
    @Query('duzenleyen_title') duzenleyenTitle: string | undefined,
    @Query('onaylayan_name') onaylayanName: string | undefined,
    @Query('onaylayan_title') onaylayanTitle: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    if (!planIdsStr?.trim()) throw new BadRequestException({ message: 'plan_ids gerekli.' });
    const planIds = planIdsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const pdf = await this.service.buildExamSchedulePdf(sid, planIds, {
      type: type || 'genel',
      grade: gradeStr ? parseInt(gradeStr, 10) : undefined,
      classId,
      cityLine,
      academicYear,
      duzenleyen: duzenleyenName ? { name: duzenleyenName, title: duzenleyenTitle ?? '' } : undefined,
      onaylayan: onaylayanName ? { name: onaylayanName, title: onaylayanTitle ?? '' } : undefined,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sinav-takvimi.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('plans/:id/pdf/sinav-kagitlari')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async examPaperLabels(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
    @Query('room_id') roomId: string | undefined,
    @Res({ passthrough: false }) res: Response,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    const pdf = await this.service.buildExamPaperLabelsPdf(sid, id, roomId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sinav-kagit-etiketleri.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Post('plans/:id/upload-paper')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  async uploadPaper(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('subjectName') subjectName: string | undefined,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException({ message: 'PDF dosyası gerekli.' });
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.registerUploadedPaper(sid, id, subjectName ?? 'Genel', file.originalname, file.size, file.buffer);
  }

  @Post('import/eokul-preview')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 6 * 1024 * 1024 } }))
  async eokulPreview(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException({ message: 'Excel dosyası gerekli.' });
    return this.service.previewEokulXlsx(file.buffer);
  }

  @Delete('plans/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async deletePlan(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.deletePlan(sid, id);
  }

  @Get('plans/:id/detail')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async getPlanDetail(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('id') id: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.getPlanDetail(sid, id);
  }

  @Get('module-teachers')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async listModuleTeachers(@CurrentUser() payload: CurrentUserPayload, @Query('school_id') schoolId?: string) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.listModuleTeachers(sid);
  }

  @Post('module-teachers/:userId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async addModuleTeacher(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('userId') userId: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.addModuleTeacher(sid, userId);
  }

  @Delete('module-teachers/:userId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async removeModuleTeacher(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('userId') userId: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.removeModuleTeacher(sid, userId);
  }

  @Get('classes')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async listClasses(@CurrentUser() payload: CurrentUserPayload, @Query('school_id') schoolId?: string) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.listClassesWithStudentCounts(sid);
  }

  @Get('students')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async listAllStudents(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId?: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.listAllStudents(sid);
  }

  @Get('classes/:classId/students')
  @Roles(UserRole.school_admin, UserRole.teacher, UserRole.superadmin, UserRole.moderator)
  async listStudents(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('classId') classId: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.listStudentsForClass(sid, classId);
  }

  @Post('classes/:classId/students')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async createStudent(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('classId') classId: string,
    @Body() body: { name: string; studentNumber?: string },
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.createStudent(sid, classId, body);
  }

  @Delete('students/:studentId')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async deleteStudent(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Param('studentId') studentId: string,
  ) {
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.deleteStudent(sid, studentId);
  }

  @Post('import/eokul-text')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async eokulTextImport(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') schoolId: string | undefined,
    @Body() body: { text: string },
  ) {
    if (!body?.text?.trim()) throw new BadRequestException({ message: 'text gerekli.' });
    const sid = this.schoolId(payload, schoolId);
    this.service.assertSchoolAccess(payload.role, payload.schoolId, sid);
    return this.service.bulkImportStudentsFromText(sid, body.text);
  }
}
