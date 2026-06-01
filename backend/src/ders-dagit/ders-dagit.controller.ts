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
import { SkipThrottle } from '@nestjs/throttler';
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

/** Stüdyo layout + çoklu alt bileşen GET; Strict Mode çift çağrı — global throttle 429 üretmesin. */
@Controller('ders-dagit')
@SkipThrottle({ default: true, auth: true, public: true })
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

  @Patch('studios/:studioId/class-profiles/:profileId/rules')
  @Roles(UserRole.school_admin)
  updateClassProfileRules(
    @Param('studioId') studioId: string,
    @Param('profileId') profileId: string,
    @Body() body: { rules: Record<string, { active: boolean; weight?: number; params?: Record<string, unknown> }> },
  ) {
    return this.service.updateClassProfileRules(studioId, profileId, body.rules);
  }

  @Get('studios/:studioId/class-sections')
  @Roles(UserRole.school_admin, UserRole.teacher)
  listStudioClassSections(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.listStudioClassSections(studioId, u.schoolId!);
  }

  @Get('studios/:studioId/section-schedules')
  @Roles(UserRole.school_admin)
  getSectionSchedules(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.getSectionSchedules(studioId, u.schoolId!);
  }

  @Patch('studios/:studioId/section-schedules')
  @Roles(UserRole.school_admin)
  updateSectionSchedule(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { section: string; schedule: { lessons_per_day_by_dow?: Record<string, number>; cells?: Record<string, string> } },
  ) {
    return this.service.updateSectionSchedule(studioId, u.schoolId!, body.section, body.schedule as never);
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

  @Get('studios/:studioId/elective-catalog')
  @Roles(UserRole.school_admin)
  listElectiveCatalog(@Param('studioId') studioId: string) {
    return this.service.listElectiveCatalogSubjects(studioId);
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

  @Get('studios/:studioId/groups/suggestions')
  @Roles(UserRole.school_admin)
  suggestGroups(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.suggestGroups(studioId, u.schoolId!);
  }

  @Post('studios/:studioId/groups/apply-suggestions')
  @Roles(UserRole.school_admin)
  applyGroupSuggestions(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body()
    body: {
      keys?: string[];
      apply_all?: boolean;
      mode_overrides?: Record<string, 'parallel_rooms' | 'subgroups' | 'teacher_multi_class'>;
    },
  ) {
    return this.service.applyGroupSuggestions(studioId, u.userId, body);
  }

  @Delete('studios/:studioId/groups/:id')
  @Roles(UserRole.school_admin)
  deleteGroup(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.deleteGroup(id, studioId);
  }

  @Get('studios/:studioId/elective-pools')
  @Roles(UserRole.school_admin)
  listElectivePools(@Param('studioId') studioId: string) {
    return this.service.listElectivePools(studioId);
  }

  @Post('studios/:studioId/elective-pools')
  @Roles(UserRole.school_admin)
  upsertElectivePool(@Param('studioId') studioId: string, @Body() body: Record<string, unknown>) {
    return this.service.upsertElectivePool(studioId, body as never);
  }

  @Delete('studios/:studioId/elective-pools/:id')
  @Roles(UserRole.school_admin)
  deleteElectivePool(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.deleteElectivePool(id, studioId);
  }

  @Post('studios/:studioId/elective-pools/:id/sync-group')
  @Roles(UserRole.school_admin)
  syncElectiveGroup(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.syncElectivePoolGroup(studioId, id);
  }

  @Post('studios/:studioId/elective-pools/:id/apply-assignments/preview')
  @Roles(UserRole.school_admin)
  previewApplyElectivePool(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.previewApplyElectivePoolAssignments(studioId, id);
  }

  @Post('studios/:studioId/elective-pools/:id/apply-assignments')
  @Roles(UserRole.school_admin)
  applyElectivePool(@Param('studioId') studioId: string, @Param('id') id: string) {
    return this.service.applyElectivePoolAssignments(studioId, id);
  }

  @Get('studios/:studioId/elective-pools/suggestions')
  @Roles(UserRole.school_admin)
  suggestElectivePools(@Param('studioId') studioId: string) {
    return this.service.suggestElectivePools(studioId);
  }

  @Post('studios/:studioId/elective-pools/apply-suggestions')
  @Roles(UserRole.school_admin)
  applyElectiveSuggestions(
    @Param('studioId') studioId: string,
    @Body()
    body: { keys?: string[]; apply_all?: boolean; sync_groups?: boolean; apply_assignments?: boolean },
  ) {
    return this.service.applyElectivePoolSuggestions(studioId, body);
  }

  @Get('studios/:studioId/aihl-norm')
  @Roles(UserRole.school_admin)
  aihlNorm(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.getAihlNormReport(studioId, u.schoolId!);
  }

  @Get('studios/:studioId/duty-sync/preview')
  @Roles(UserRole.school_admin)
  dutyPreview(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.getDutySyncPreview(studioId, u.schoolId!);
  }

  @Post('studios/:studioId/duty-sync')
  @Roles(UserRole.school_admin)
  dutySync(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { from?: string; to?: string },
  ) {
    return this.service.syncDutyToStudio(studioId, u.schoolId!, body);
  }

  @Post('studios/:studioId/sync-extra-lesson-params')
  @Roles(UserRole.school_admin)
  syncExtraLesson(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
  ) {
    return this.service.syncExtraLessonParamsToTeachers(studioId, u.schoolId!, u.userId);
  }

  @Get('studios/:studioId/seed/ttkb/preview')
  @Roles(UserRole.school_admin)
  ttkbPreview(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.previewTtkbSeed(studioId, u.schoolId!);
  }

  @Post('studios/:studioId/seed/ttkb')
  @Roles(UserRole.school_admin)
  seedTtkb(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { replace?: boolean; sync_assignments?: boolean },
  ) {
    return this.service.seedFromTtkb(studioId, u.schoolId!, u.userId, body);
  }

  @Get('studios/:studioId/seed/ttkb/elective/preview')
  @Roles(UserRole.school_admin)
  ttkbElectivePreview(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.previewTtkbElectiveSeed(studioId, u.schoolId!);
  }

  @Get('transfer/formats')
  @Roles(UserRole.school_admin)
  transferFormats() {
    return this.service.getTransferFormats();
  }

  @Get('studios/:studioId/transfer/export.json')
  @Roles(UserRole.school_admin)
  exportStudioTransfer(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Res() res: Response,
  ) {
    return this.service.exportStudioTransferPackage(studioId, u.schoolId!).then((pkg) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ogretmenpro-studio-${studioId.slice(0, 8)}.json"`,
      );
      res.send(JSON.stringify(pkg, null, 2));
    });
  }

  @Post('studios/:studioId/transfer/import/preview')
  @Roles(UserRole.school_admin)
  transferImportPreview(
    @CurrentUser() u: CurrentUserPayload,
    @Body()
    body: {
      format: string;
      file_base64?: string;
      eokul_format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto';
    },
  ) {
    return this.service.previewStudioTransferImport(u.schoolId!, body);
  }

  @Post('studios/:studioId/transfer/import')
  @Roles(UserRole.school_admin)
  transferImport(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body()
    body: {
      format: string;
      file_base64?: string;
      eokul_format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto';
      replace?: boolean;
      auto_elective_groups?: boolean;
      merge_settings?: boolean;
    },
  ) {
    return this.service.applyStudioTransferImport(studioId, u.schoolId!, u.userId, body);
  }

  @Post('studios/:studioId/seed/ttkb/elective')
  @Roles(UserRole.school_admin)
  seedTtkbElective(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { replace_elective?: boolean; create_pools?: boolean },
  ) {
    return this.service.seedElectiveFromTtkb(studioId, u.schoolId!, u.userId, body);
  }

  @Post('studios/:studioId/elective-pools/sync-from-catalog')
  @Roles(UserRole.school_admin)
  syncElectivePoolsFromCatalog(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { replace_pools?: boolean },
  ) {
    return this.service.syncElectivePoolsFromCatalog(studioId, u.schoolId!, u.userId, body);
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

  @Post('rooms/auto-from-sections')
  @Roles(UserRole.school_admin)
  autoRoomsFromSections(
    @CurrentUser() u: CurrentUserPayload,
    @Body() body: { studio_id: string },
  ) {
    return this.service.autoCreateRoomsFromClassSections(u.schoolId!, body.studio_id);
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

  @Get('studios/:studioId/assignments/import-template.xlsx')
  @Roles(UserRole.school_admin)
  async assignmentTemplate(@Param('studioId') _studioId: string, @Res() res: Response) {
    const { buildAssignmentImportTemplateXlsx } = await import('./ders-dagit.export');
    const buf = buildAssignmentImportTemplateXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="ders-dagit-atama-sablon.xlsx"');
    res.send(buf);
  }

  @Post('studios/:studioId/assignments/import-xlsx')
  @Roles(UserRole.school_admin)
  importAssignmentsXlsx(
    @Param('studioId') studioId: string,
    @Body() body: { file_base64: string; replace?: boolean },
  ) {
    const buf = Buffer.from(body.file_base64, 'base64');
    return this.service.importAssignmentsXlsx(studioId, buf, !!body.replace);
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

  @Patch('studios/:studioId/planning-relations')
  @Roles(UserRole.school_admin)
  updatePlanningRelations(
    @Param('studioId') studioId: string,
    @Body() body: { relations: unknown[] },
  ) {
    return this.service.updatePlanningRelations(
      studioId,
      body.relations as import('./ders-dagit.planning-relations').PlanningRelationRow[],
    );
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
  listPrograms(
    @Param('studioId') studioId: string,
    @Query('include_archived') includeArchived?: string,
  ) {
    return this.service.listPrograms(studioId, { include_archived: includeArchived === '1' });
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
    @Body() body: { duration_sec?: number; versions?: number; use_csp?: boolean },
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

  @Get('studios/:studioId/programs/:programId/publish-preview')
  @Roles(UserRole.school_admin)
  publishPreview(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
  ) {
    return this.service.getPublishPreview(programId, studioId, u.schoolId!);
  }

  @Post('studios/:studioId/programs/:programId/publish')
  @Roles(UserRole.school_admin)
  publish(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Body()
    body: {
      valid_from?: string;
      valid_until?: string | null;
      name?: string;
      risk_acknowledged?: boolean;
    },
  ) {
    return this.service.publishProgramToSchool(studioId, u.schoolId!, u.userId, programId, body ?? {});
  }

  @Get('studios/:studioId/school-profile')
  @Roles(UserRole.school_admin)
  getSchoolProfile(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.getSchoolProfile(studioId, u.schoolId!);
  }

  @Patch('studios/:studioId/school-profile')
  @Roles(UserRole.school_admin)
  patchSchoolProfile(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.updateSchoolProfile(studioId, u.schoolId!, body as never);
  }

  @Get('studios/:studioId/report-settings')
  @Roles(UserRole.school_admin)
  getReportSettings(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string) {
    return this.service.getReportSettings(studioId, u.schoolId!);
  }

  @Patch('studios/:studioId/report-settings')
  @Roles(UserRole.school_admin)
  patchReportSettings(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { meta?: Record<string, unknown>; texts?: Record<string, unknown> },
  ) {
    return this.service.updateReportSettings(studioId, u.schoolId!, body);
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

  @Get('studios/:studioId/programs/:programId/export/eokul/report')
  @Roles(UserRole.school_admin)
  eokulReport(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
  ) {
    return this.service.getEokulExportReport(programId, studioId, u.schoolId!);
  }

  @Get('studios/:studioId/programs/:programId/export/eokul')
  @Roles(UserRole.school_admin)
  async exportEokul(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportProgramEokul(programId, studioId, u.schoolId!);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eokul-ders-dagit-${programId.slice(0, 8)}.csv"`);
    res.send(csv.startsWith('\uFEFF') ? csv : '\uFEFF' + csv);
  }

  @Get('studios/:studioId/programs/:programId/export/eokul.xlsx')
  @Roles(UserRole.school_admin)
  async exportEokulXlsx(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Res() res: Response,
  ) {
    const buf = await this.service.exportProgramEokulXlsx(programId, studioId, u.schoolId!);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="eokul-ders-dagit-${programId.slice(0, 8)}.xlsx"`);
    res.send(buf);
  }

  @Get('studios/:studioId/programs/:programId/export/eokul/report.csv')
  @Roles(UserRole.school_admin)
  async exportEokulReportCsv(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Res() res: Response,
  ) {
    const pkg = await this.service.exportProgramEokulPackage(programId, studioId, u.schoolId!);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="eokul-rapor-${programId.slice(0, 8)}.csv"`);
    res.send(pkg.report_csv);
  }

  @Get('studios/:studioId/programs/:programId/export.xlsx')
  @Roles(UserRole.school_admin)
  async exportXlsx(
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Res() res: Response,
  ) {
    const buf = await this.service.exportProgramXlsx(programId, studioId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="ders-dagit-${programId.slice(0, 8)}.xlsx"`);
    res.send(buf);
  }

  @Get('studios/:studioId/programs/:programId/export/duty.pdf')
  @Roles(UserRole.school_admin)
  async exportDutyPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportDutyReportPdf(programId, studioId, u.schoolId!, theme);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nobet-${programId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/dual-education.pdf')
  @Roles(UserRole.school_admin)
  async exportDualPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportDualEducationPdf(programId, studioId, u.schoolId!, theme);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ikili-egitim-${programId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/extra-lesson.pdf')
  @Roles(UserRole.school_admin)
  async exportExtraLessonPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportExtraLessonPdf(programId, studioId, u.schoolId!, theme);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ek-ders-${programId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/master-:axis.pdf')
  @Roles(UserRole.school_admin)
  async exportMasterPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Param('axis') axis: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const a = axis === 'teacher' || axis === 'class' || axis === 'room' ? axis : 'teacher';
    const pdf = await this.service.exportMasterSheetPdf(programId, studioId, u.schoolId!, a, theme);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="carsaf-${a}-${programId.slice(0, 8)}.pdf"`,
    );
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export.pdf')
  @Roles(UserRole.school_admin)
  async exportPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportProgramPdf(programId, studioId, u.schoolId!, theme);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="ders-dagit-${programId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/schedule.pdf')
  @Roles(UserRole.school_admin)
  async exportScheduleViewPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('view') view: string,
    @Query('filter') filter: string,
    @Query('label') label: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const v = view === 'class' || view === 'teacher' || view === 'room' ? view : null;
    if (!v || !filter?.trim()) {
      res.status(400).json({ message: 'view ve filter gerekli' });
      return;
    }
    const pdf = await this.service.exportScheduleViewPdf(
      programId,
      studioId,
      u.schoolId!,
      v,
      filter.trim(),
      (label ?? filter).trim(),
      theme,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="haftalik-${v}-${programId.slice(0, 8)}.pdf"`,
    );
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/teacher-notification.pdf')
  @Roles(UserRole.school_admin)
  async exportTeacherNotificationPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('theme') theme: string,
    @Query('teacher') teacher: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportTeacherNotificationPdf(
      programId,
      studioId,
      u.schoolId!,
      theme,
      teacher,
    );
    res.setHeader('Content-Type', 'application/pdf');
    const suffix = teacher?.trim() ? `-${teacher.trim().slice(0, 12).replace(/[^\w.-]+/g, '_')}` : '';
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ogretmen-teblig${suffix}-${programId.slice(0, 8)}.pdf"`,
    );
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/cover.pdf')
  @Roles(UserRole.school_admin)
  async exportCoverPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportCoverPdf(programId, studioId, u.schoolId!, theme);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="kapak-${programId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/approval.pdf')
  @Roles(UserRole.school_admin)
  async exportApprovalPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportApprovalPdf(programId, studioId, u.schoolId!, theme);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="onay-${programId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/council.pdf')
  @Roles(UserRole.school_admin)
  async exportCouncilPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportCouncilPdf(programId, studioId, u.schoolId!, theme);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="kurul-tutanagi-${programId.slice(0, 8)}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/export/parent-all.zip')
  @Roles(UserRole.school_admin)
  async exportParentAllZip(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Res() res: Response,
  ) {
    const zip = await this.service.exportParentAllPdfZip(programId, studioId, u.schoolId!);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="veli-programlar-${programId.slice(0, 8)}.zip"`);
    res.send(zip);
  }

  @Get('studios/:studioId/programs/:programId/export/parent.pdf')
  @Roles(UserRole.school_admin, UserRole.teacher)
  async exportParentPdf(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Query('section') section: string,
    @Query('theme') theme: string,
    @Res() res: Response,
  ) {
    const pdf = await this.service.exportParentClassPdf(
      programId,
      studioId,
      u.schoolId!,
      section?.trim() || '5A',
      theme,
    );
    res.setHeader('Content-Type', 'application/pdf');
    const sec = (section?.trim() || 'sinif').replace(/[^\w.-]+/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="veli-program-${sec}.pdf"`);
    res.send(Buffer.from(pdf));
  }

  @Get('studios/:studioId/programs/:programId/editor-context')
  @Roles(UserRole.school_admin)
  editorContext(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
  ) {
    return this.service.getProgramEditorContext(programId, studioId, u.schoolId!);
  }

  @Post('studios/:studioId/programs/:programId/entries')
  @Roles(UserRole.school_admin)
  createEntry(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Body() body: { assignment_id: string; day_of_week: number; lesson_num: number },
  ) {
    return this.service.createProgramEntry(studioId, programId, u.userId, body);
  }

  @Post('studios/:studioId/programs/:programId/entries/swap')
  @Roles(UserRole.school_admin)
  swapEntries(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Body() body: { entry_id_a: string; entry_id_b: string },
  ) {
    return this.service.swapProgramEntries(studioId, programId, u.userId, body.entry_id_a, body.entry_id_b);
  }

  @Patch('studios/:studioId/programs/:programId/entries/:entryId')
  @Roles(UserRole.school_admin)
  patchEntry(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Param('entryId') entryId: string,
    @Body() body: { day_of_week?: number; lesson_num?: number; is_locked?: boolean; room_id?: string | null },
  ) {
    return this.service.patchProgramEntry(studioId, programId, entryId, u.userId, body);
  }

  @Delete('studios/:studioId/programs/:programId/entries/:entryId')
  @Roles(UserRole.school_admin)
  deleteEntry(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.service.deleteProgramEntry(studioId, programId, entryId, u.userId);
  }

  @Get('studios/:studioId/audit-log')
  @Roles(UserRole.school_admin)
  auditLog(@Param('studioId') studioId: string, @Query('limit') limit?: string) {
    return this.service.listAuditLogs(studioId, limit ? Number(limit) : 50);
  }

  @Delete('studios/:studioId/programs/:programId')
  @Roles(UserRole.school_admin)
  deleteProgram(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
  ) {
    return this.service.deleteProgram(programId, studioId, u.userId);
  }

  @Post('studios/:studioId/programs/:programId/favorite')
  @Roles(UserRole.school_admin)
  favorite(@Param('studioId') studioId: string, @Param('programId') programId: string) {
    return this.service.setFavoriteProgram(studioId, programId);
  }

  @Get('studios/:studioId/assignments/eokul-template.xlsx')
  @Roles(UserRole.school_admin)
  async eokulTemplate(@Res() res: Response) {
    const buf = this.service.eokulImportTemplateXlsx();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="eokul-ders-dagit-atama.xlsx"');
    res.send(buf);
  }

  @Post('studios/:studioId/import/eokul/preview')
  @Roles(UserRole.school_admin)
  eokulPreview(
    @CurrentUser() u: CurrentUserPayload,
    @Body() body: { csv?: string; file_base64?: string; format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto' },
  ) {
    return this.service.previewEokulImport(u.schoolId!, body);
  }

  @Post('studios/:studioId/import/eokul')
  @Roles(UserRole.school_admin)
  eokulImport(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: {
      csv?: string;
      file_base64?: string;
      format?: 'csv' | 'xlsx' | 'grid_xlsx' | 'auto';
      replace?: boolean;
      auto_elective_groups?: boolean;
    },
  ) {
    return this.service.importEokulAssignments(studioId, u.schoolId!, u.userId, body);
  }

  @Post('studios/:studioId/assignments/sync-from-subjects')
  @Roles(UserRole.school_admin)
  syncFromSubjects(@CurrentUser() u: CurrentUserPayload, @Param('studioId') studioId: string, @Body() body: { replace?: boolean }) {
    return this.service.syncSubjectsToAssignments(studioId, u.userId, { replace: !!body.replace });
  }

  @Patch('studios/:studioId/assignments/bulk')
  @Roles(UserRole.school_admin)
  bulkAssignments(@Param('studioId') studioId: string, @Body() body: { rows: Record<string, unknown>[]; delete_missing?: boolean }) {
    return this.service.bulkUpsertAssignments(studioId, body.rows as never, { delete_missing: !!body.delete_missing });
  }

  @Post('studios/:studioId/programs/:programId/clone')
  @Roles(UserRole.school_admin)
  cloneProgram(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
  ) {
    return this.service.cloneProgram(studioId, programId, u.userId);
  }

  @Get('studios/:studioId/programs/:programId/share')
  @Roles(UserRole.school_admin)
  getShareStatus(@Param('studioId') studioId: string, @Param('programId') programId: string) {
    return this.service.getProgramShareStatus(studioId, programId);
  }

  @Patch('studios/:studioId/programs/:programId/share')
  @Roles(UserRole.school_admin)
  patchShareSettings(
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Body() body: { enabled_sections?: string[] | null },
  ) {
    return this.service.updateProgramShareSettings(studioId, programId, body);
  }

  @Post('studios/:studioId/programs/:programId/share')
  @Roles(UserRole.school_admin)
  shareProgram(
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Body() body: { class_section?: string | null },
  ) {
    return this.service.createProgramShareLink(studioId, programId, body);
  }

  @Delete('studios/:studioId/programs/:programId/share')
  @Roles(UserRole.school_admin)
  revokeShare(@Param('studioId') studioId: string, @Param('programId') programId: string) {
    return this.service.revokeProgramShareLink(studioId, programId);
  }

  @Post('studios/:studioId/programs/:programId/archive')
  @Roles(UserRole.school_admin)
  archiveProgram(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
  ) {
    return this.service.archiveProgram(studioId, programId, u.userId);
  }

  @Post('studios/:studioId/programs/:programId/unarchive')
  @Roles(UserRole.school_admin)
  unarchiveProgram(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
  ) {
    return this.service.unarchiveProgram(studioId, programId, u.userId);
  }

  @Patch('studios/:studioId/programs/:programId')
  @Roles(UserRole.school_admin)
  patchProgram(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Param('programId') programId: string,
    @Body() body: { name?: string },
  ) {
    return this.service.patchProgram(studioId, programId, u.userId, body);
  }

  @Get('studios/:studioId/programs/:programId/teacher-grid')
  @Roles(UserRole.school_admin, UserRole.teacher)
  teacherGrid(@Param('studioId') studioId: string, @Param('programId') programId: string) {
    return this.service.getTeacherProgramGrid(studioId, programId);
  }

  @Get('studios/:studioId/generation-jobs/:jobId')
  @Roles(UserRole.school_admin)
  generationJob(@Param('studioId') studioId: string, @Param('jobId') jobId: string) {
    return this.service.getGenerationJob(studioId, jobId);
  }

  @Post('studios/:studioId/import-from-plan/preview')
  @Roles(UserRole.school_admin)
  previewImportFromPlan(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body() body: { plan_id: string },
  ) {
    return this.service.previewImportFromSchoolPlan(studioId, u.schoolId!, body.plan_id);
  }

  @Post('studios/:studioId/import-from-plan')
  @Roles(UserRole.school_admin)
  importFromPlan(
    @CurrentUser() u: CurrentUserPayload,
    @Param('studioId') studioId: string,
    @Body()
    body: {
      plan_id: string;
      replace?: boolean;
      replace_subjects?: boolean;
      replace_assignments?: boolean;
      import_subjects?: boolean;
      import_assignments?: boolean;
    },
  ) {
    return this.service.importFromSchoolPlan(studioId, u.schoolId!, body.plan_id, u.userId, body);
  }
}
