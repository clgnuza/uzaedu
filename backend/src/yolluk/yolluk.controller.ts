import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { instanceToPlain } from 'class-transformer';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { YollukService } from './yolluk.service';
import { UpsertYollukSettingsDto, PreviewYollukBodyDto, CreateYollukBodyDto, PatchYollukBodyDto } from './dto/yolluk-api.dto';
import { parseCalcInput } from './yolluk-input.validation';
import { YollukTeacherDefaultsDto } from '../users/dto/update-me.dto';

@Controller('yolluk')
@UseGuards(JwtAuthGuard, RolesGuard)
export class YollukController {
  constructor(private readonly yollukService: YollukService) {}

  @Get('context')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async yollukContext(
    @Query('school_id') schoolId: string | undefined,
    @Query('teacher_user_id') teacherUserId: string | undefined,
    @CurrentUser() p: CurrentUserPayload,
  ) {
    return this.yollukService.getYollukContext(p.user, schoolId, teacherUserId);
  }

  @Patch('teachers/:teacherUserId/yolluk-profile')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async patchTeacherYollukProfile(
    @Param('teacherUserId') teacherUserId: string,
    @Body() body: YollukTeacherDefaultsDto,
    @CurrentUser() p: CurrentUserPayload,
  ) {
    const plain = instanceToPlain(body) as Record<string, unknown>;
    for (const k of Object.keys(plain)) {
      if (plain[k] === undefined) delete plain[k];
    }
    return this.yollukService.patchTeacherYollukProfile(p.user, teacherUserId, plain);
  }

  @Get('settings/active')
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.teacher)
  async getActiveSettings() {
    const row = await this.yollukService.getActiveSettings();
    return this.yollukService.serializeSettingsRow(row);
  }

  @Get('settings/years')
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.teacher)
  async listYears() {
    const years = await this.yollukService.listFiscalYearsWithSettings();
    const suggested = years[0] ?? (await this.yollukService.getActiveSettingsYear());
    return { years, suggested_fiscal_year: suggested };
  }

  @Put('settings')
  @Roles(UserRole.superadmin)
  async upsertSettings(@Body() dto: UpsertYollukSettingsDto) {
    const u = await this.yollukService.upsertSettings(dto);
    return this.yollukService.serializeSettingsRow(u);
  }

  @Post('calculations/preview')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async preview(@Body() body: PreviewYollukBodyDto, @CurrentUser() _p: CurrentUserPayload) {
    const input = parseCalcInput(body?.input);
    return this.yollukService.preview(body?.fiscal_year, input);
  }

  @Post('calculations')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async create(@Body() body: CreateYollukBodyDto, @CurrentUser() p: CurrentUserPayload) {
    const input = parseCalcInput(body?.input);
    return this.yollukService.createCalculation(p.user, {
      teacher_user_id: body.teacher_user_id,
      input,
      title: body.title,
      school_id: body.school_id,
      fiscal_year: body.fiscal_year,
    });
  }

  @Patch('calculations/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async patch(@Param('id') id: string, @Body() body: PatchYollukBodyDto, @CurrentUser() p: CurrentUserPayload) {
    const input = parseCalcInput(body?.input);
    return this.yollukService.patchCalculation(p.user, id, { input, title: body.title });
  }

  @Post('calculations/:id/finalize')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async finalize(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.yollukService.finalize(p.user, id);
  }

  @Post('calculations/:id/archive')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async archive(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.yollukService.archive(p.user, id);
  }

  @Post('calculations/:id/unarchive')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async unarchive(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.yollukService.unarchive(p.user, id);
  }

  @Delete('calculations/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async remove(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    await this.yollukService.deleteCalculation(p.user, id);
    return { ok: true };
  }

  @Get('calculations')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async listSchool(
    @Query('school_id') schoolId: string | undefined,
    @Query('archived') archived: string | undefined,
    @CurrentUser() p: CurrentUserPayload,
  ) {
    const ar = archived === 'archived' ? 'archived' : archived === 'all' ? 'all' : 'active';
    return this.yollukService.listForSchool(p.user, schoolId, ar);
  }

  @Get('calculations/mine')
  @Roles(UserRole.teacher)
  async listMine(@CurrentUser() p: CurrentUserPayload) {
    return this.yollukService.listForTeacher(p.user);
  }

  @Get('calculations/:id/pdf')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.teacher)
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() p: CurrentUserPayload,
    @Res({ passthrough: false }) res: Response,
  ) {
    const buf = await this.yollukService.buildOfficialPdf(p.user, id);
    const safe = id.replace(/[^a-f0-9-]/gi, '').slice(0, 13) || 'rapor';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="yolluk-rapor-${safe}.pdf"`);
    res.send(buf);
  }

  @Get('calculations/:id')
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.teacher)
  async getOne(@Param('id') id: string, @CurrentUser() p: CurrentUserPayload) {
    return this.yollukService.getOne(p.user, id);
  }
}
