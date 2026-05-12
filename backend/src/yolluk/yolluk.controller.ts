import { Body, Controller, Get, Param, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { YollukService } from './yolluk.service';
import { UpsertYollukSettingsDto, PreviewYollukBodyDto, CreateYollukBodyDto, PatchYollukBodyDto } from './dto/yolluk-api.dto';
import { parseCalcInput } from './yolluk-input.validation';

@Controller('yolluk')
@UseGuards(JwtAuthGuard, RolesGuard)
export class YollukController {
  constructor(private readonly yollukService: YollukService) {}

  @Get('settings/active')
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.teacher)
  async getActiveSettings() {
    const row = await this.yollukService.getActiveSettings();
    return this.yollukService.serializeSettingsRow(row);
  }

  @Get('settings/years')
  @Roles(UserRole.superadmin, UserRole.school_admin, UserRole.teacher)
  async listYears() {
    const y = await this.yollukService.getActiveSettingsYear();
    return { suggested_fiscal_year: y };
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

  @Get('calculations')
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async listSchool(@Query('school_id') schoolId: string | undefined, @CurrentUser() p: CurrentUserPayload) {
    return this.yollukService.listForSchool(p.user, schoolId);
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
