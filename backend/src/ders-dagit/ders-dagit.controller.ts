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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { DersDagitService } from './ders-dagit.service';
import { DERS_DAGIT_RULE_CATALOG } from './ders-dagit.rules';

@Controller('ders-dagit')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard, RolesGuard)
@RequireSchoolModule('ders_dagit')
export class DersDagitController {
  constructor(private readonly service: DersDagitService) {}

  @Get('studios')
  @Roles(UserRole.school_admin, UserRole.teacher)
  listStudios(@CurrentUser() u: CurrentUserPayload) {
    return this.service.listStudios(u.schoolId!);
  }

  @Post('studios')
  @Roles(UserRole.school_admin)
  createStudio(@CurrentUser() u: CurrentUserPayload, @Body() body: { academic_year?: string }) {
    return this.service.getOrCreateStudio(u.schoolId!, u.userId, body.academic_year);
  }

  @Get('studios/:studioId/overview')
  @Roles(UserRole.school_admin, UserRole.teacher)
  overview(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.getStudioOverview(studioId, u.schoolId!);
  }

  @Get('studios/:studioId/validation')
  @Roles(UserRole.school_admin)
  validation(@Param('studioId') studioId: string) {
    return this.service.runValidation(studioId);
  }

  @Get('rule-catalog')
  @Roles(UserRole.school_admin, UserRole.teacher)
  ruleCatalog() {
    return DERS_DAGIT_RULE_CATALOG;
  }

  // Class profiles
  @Get('studios/:studioId/class-profiles')
  @Roles(UserRole.school_admin)
  listClassProfiles(@Param('studioId') studioId: string) {
    return this.service.listClassProfiles(studioId);
  }

  @Post('studios/:studioId/class-profiles')
  @Roles(UserRole.school_admin)
  upsertClassProfile(@Param('studioId') studioId: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertClassProfile(studioId, body as never);
  }

  @Delete('studios/:studioId/class-profiles/:id')
  @Roles(UserRole.school_admin)
  deleteClassProfile(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.deleteClassProfile(id, studioId);
  }

  // Teachers
  @Post('studios/:studioId/teachers/sync')
  @Roles(UserRole.school_admin)
  syncTeachers(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.syncTeachersFromSchool(studioId, u.schoolId!);
  }

  @Get('studios/:studioId/teachers')
  @Roles(UserRole.school_admin)
  listTeachers(@Param('studioId') studioId: string) {
    return this.service.listTeacherConfigs(studioId);
  }

  @Post('studios/:studioId/teachers')
  @Roles(UserRole.school_admin)
  upsertTeacher(@Param('studioId') studioId: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertTeacherConfig(studioId, body as never);
  }

  // Subjects
  @Get('studios/:studioId/subjects')
  @Roles(UserRole.school_admin)
  listSubjects(@Param('studioId') studioId: string) {
    return this.service.listSubjects(studioId);
  }

  @Post('studios/:studioId/subjects')
  @Roles(UserRole.school_admin)
  upsertSubject(@Param('studioId') studioId: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertSubject(studioId, body as never);
  }

  @Delete('studios/:studioId/subjects/:id')
  @Roles(UserRole.school_admin)
  deleteSubject(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.deleteSubject(id, studioId);
  }

  // Groups (divisions)
  @Get('studios/:studioId/groups')
  @Roles(UserRole.school_admin)
  listGroups(@Param('studioId') studioId: string) {
    return this.service.listGroups(studioId);
  }

  @Post('studios/:studioId/groups')
  @Roles(UserRole.school_admin)
  upsertGroup(@Param('studioId') studioId: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertGroup(studioId, body as never);
  }

  @Delete('studios/:studioId/groups/:id')
  @Roles(UserRole.school_admin)
  deleteGroup(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.deleteGroup(id, studioId);
  }

  // Buildings / rooms
  @Get('buildings')
  @Roles(UserRole.school_admin)
  listBuildings(@CurrentUser() u: CurrentUserPayload) {
    return this.service.listBuildings(u.schoolId!);
  }

  @Post('buildings')
  @Roles(UserRole.school_admin)
  upsertBuilding(@CurrentUser() u: CurrentUserPayload, @Body() body: Record<string, unknown>) {
    return this.service.upsertBuilding(u.schoolId!, body as never);
  }

  @Get('rooms')
  @Roles(UserRole.school_admin)
  listRooms(@CurrentUser() u: CurrentUserPayload) {
    return this.service.listRooms(u.schoolId!);
  }

  @Post('rooms')
  @Roles(UserRole.school_admin)
  upsertRoom(@CurrentUser() u: CurrentUserPayload, @Body() body: Record<string, unknown>) {
    return this.service.upsertRoom(u.schoolId!, body as never);
  }

  // Assignments
  @Get('studios/:studioId/assignments')
  @Roles(UserRole.school_admin)
  listAssignments(@Param('studioId') studioId: string) {
    return this.service.listAssignments(studioId);
  }

  @Post('studios/:studioId/assignments')
  @Roles(UserRole.school_admin)
  upsertAssignment(@Param('studioId') studioId: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertAssignment(studioId, body as never);
  }

  @Post('studios/:studioId/assignments/import-csv')
  @Roles(UserRole.school_admin)
  importAssignmentsCsv(
    @Param('studioId') studioId: string,
    @Body() body: { csv: string; replace?: boolean },
  ) {
    return this.service.importAssignmentsCsv(studioId, body.csv, !!body.replace);
  }

  @Delete('studios/:studioId/assignments/:id')
  @Roles(UserRole.school_admin)
  deleteAssignment(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.deleteAssignment(id, studioId);
  }

  // Rules
  @Get('studios/:studioId/rules')
  @Roles(UserRole.school_admin)
  getRules(@Param('studioId') studioId: string) {
    return this.service.getRules(studioId);
  }

  @Patch('studios/:studioId/rules')
  @Roles(UserRole.school_admin)
  updateRules(
    @Param('studioId') studioId: string,
    @Body() body: { rules: Record<string, unknown>; building_travel?: unknown[] },
  ) {
    return this.service.updateRules(studioId, body.rules, body.building_travel);
  }

  // Preferences
  @Get('studios/:studioId/preferences')
  @Roles(UserRole.school_admin, UserRole.teacher)
  listPrefs(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Query('mine') mine?: string,
  ) {
    const userId = mine === '1' && u.user.role === UserRole.teacher ? u.userId : undefined;
    return this.service.listPreferences(studioId, userId);
  }

  @Post('studios/:studioId/preferences')
  @Roles(UserRole.school_admin, UserRole.teacher)
  savePref(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string, @Body() body: Record<string, unknown>) {
    const userId = u.user.role === UserRole.teacher ? u.userId : (body.user_id as string) ?? u.userId;
    return this.service.savePreference(studioId, userId, body as never);
  }

  @Patch('studios/:studioId/preference-window')
  @Roles(UserRole.school_admin)
  prefWindow(@Param('studioId') studioId: string, @Body() body: { open: boolean }) {
    return this.service.setPreferenceWindow(studioId, !!body.open);
  }

  // Requests
  @Get('studios/:studioId/requests')
  @Roles(UserRole.school_admin)
  listRequests(@Param('studioId') studioId: string) {
    return this.service.listRequests(studioId);
  }

  @Post('studios/:studioId/requests')
  @Roles(UserRole.school_admin, UserRole.teacher)
  createRequest(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string, @Body() body: { body: string; type?: string }) {
    return this.service.createRequest(studioId, u.userId, body.body, body.type);
  }

  @Patch('studios/:studioId/requests/:requestId')
  @Roles(UserRole.school_admin)
  moderateRequest(
    @Param('studioId') studioId: string,
    @Param('requestId') requestId: string,
    @Body() body: { status: string; admin_reply?: string },
  ) {
    return this.service.moderateRequest(studioId, requestId, body);
  }

  // Programs
  @Get('studios/:studioId/programs')
  @Roles(UserRole.school_admin, UserRole.teacher)
  listPrograms(@Param('studioId') studioId: string) {
    return this.service.listPrograms(studioId);
  }

  @Get('studios/:studioId/programs/compare')
  @Roles(UserRole.school_admin)
  comparePrograms(@Param('studioId') studioId: string, @Query('ids') ids?: string) {
    const list = (ids ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return this.service.comparePrograms(studioId, list);
  }

  @Post('studios/:studioId/generate')
  @Roles(UserRole.school_admin)
  generate(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { duration_sec?: number; versions?: number },
  ) {
    return this.service.generatePrograms(studioId, u.schoolId!, u.userId, body);
  }

  @Get('studios/:studioId/programs/:programId')
  @Roles(UserRole.school_admin, UserRole.teacher)
  getProgram(@Param('studioId') studioId: string, @Param('programId') programId: string) {
    return this.service.getProgram(programId, studioId);
  }

  @Post('studios/:studioId/council-review')
  @Roles(UserRole.school_admin)
  council(@Param('studioId') studioId: string) {
    return this.service.setCouncilReview(studioId);
  }

  @Post('studios/:studioId/programs/:programId/publish')
  @Roles(UserRole.school_admin)
  publish(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Body() body: { valid_from?: string; valid_until?: string | null; name?: string },
  ) {
    return this.service.publishProgramToSchool(studioId, u.schoolId!, u.userId, programId, body ?? {});
  }

  @Get('studios/:studioId/periods')
  @Roles(UserRole.school_admin)
  getPeriods(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.getPeriodConfig(u.schoolId!, studioId);
  }

  @Patch('studios/:studioId/periods')
  @Roles(UserRole.school_admin)
  patchPeriods(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updatePeriodConfig(studioId, u.schoolId!, body);
  }

  @Get('class-sections/suggest')
  @Roles(UserRole.school_admin)
  suggestSections(@CurrentUser() u: CurrentUserPayload) {
    return this.service.suggestClassSections(u.schoolId!);
  }

  @Delete('buildings/:id')
  @Roles(UserRole.school_admin)
  deleteBuilding(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.service.deleteBuilding(id, u.schoolId!);
  }

  @Delete('rooms/:id')
  @Roles(UserRole.school_admin)
  deleteRoom(@CurrentUser() u: CurrentUserPayload, @Param('id') id: string) {
    return this.service.deleteRoom(id, u.schoolId!);
  }

  @Get('studios/:studioId/fairness')
  @Roles(UserRole.school_admin)
  fairness(@Param('studioId') studioId: string) {
    return this.service.getFairnessMetrics(studioId);
  }

  @Get('studios/:studioId/published-class')
  @Roles(UserRole.school_admin, UserRole.teacher)
  publishedClass(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Query('section') section: string,
  ) {
    return this.service.getPublishedClassProgram(studioId, u.schoolId!, section?.trim() || '5A');
  }

  @Get('studios/:studioId/programs/:programId/export.csv')
  @Roles(UserRole.school_admin)
  async exportCsv(
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportProgramCsv(programId, studioId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="ders-dagit-${programId.slice(0, 8)}.csv"`);
    res.send('\uFEFF' + csv);
  }

  @Get('studios/:studioId/programs/:programId/export/eokul')
  @Roles(UserRole.school_admin)
  async exportEokul(
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportProgramEokul(programId, studioId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eokul-ders-dagit-${programId.slice(0, 8)}.csv"`);
    res.send('\uFEFF' + csv);
  }

  @Get('studios/:studioId/programs/:programId/export.pdf')
  @Roles(UserRole.school_admin)
  async exportPdf(
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportProgramPdf(programId, studioId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ders-dagit-${programId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Patch('studios/:studioId/programs/:programId/entries/:entryId')
  @Roles(UserRole.school_admin)
  patchEntry(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Param('entryId') entryId: string,
    @Body() body: { day_of_week?: number; lesson_num?: number; is_locked?: boolean },
  ) {
    return this.service.patchProgramEntry(studioId, programId, entryId, u.userId, body);
  }

  @Get('studios/:studioId/audit-log')
  @Roles(UserRole.school_admin)
  auditLog(@Param('studioId') studioId: string, @Query('limit') limit?: string) {
    return this.service.listAuditLogs(studioId, limit ? Number(limit) : 50);
  }

  @Post('studios/:studioId/programs/:programId/favorite')
  @Roles(UserRole.school_admin)
  favorite(@Param('studioId') studioId: string, @Param('programId') programId: string) {
    return this.service.setFavoriteProgram(studioId, programId);
  }

  @Post('studios/:studioId/import-from-plan')
  @Roles(UserRole.school_admin)
  importFromPlan(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { plan_id: string; replace?: boolean },
  ) {
    return this.service.importAssignmentsFromSchoolPlan(
      studioId,
      u.schoolId!,
      body.plan_id,
      u.userId,
      { replace: !!body.replace },
    );
  }
}
