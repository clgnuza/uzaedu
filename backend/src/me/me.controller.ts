import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Req, Query, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { UsersService } from '../users/users.service';
import { TeacherSchoolMembershipStatus } from '../types/enums';
import { effectiveTeacherSchoolMembership } from '../common/utils/teacher-school-membership';
import { schoolJoinStage } from '../common/utils/school-join-stage';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UpdateMeDto } from '../users/dto/update-me.dto';
import { ChangePasswordDto } from '../users/dto/change-password.dto';
import { DeleteAccountDto } from '../users/dto/delete-account.dto';
import { MeDataExportService } from './me-data-export.service';
import { MeDataImportService } from './me-data-import.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly meDataExportService: MeDataExportService,
    private readonly meDataImportService: MeDataImportService,
  ) {}

  /** Oturum yoksa 401 değil 200 + null (tarayıcı konsol gürültüsü ve önbellek uyumu). */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async get(@CurrentUser() payload: CurrentUserPayload | null) {
    if (!payload?.userId) {
      return null;
    }
    const user = await this.usersService.findById(payload.userId);
    const eff = effectiveTeacherSchoolMembership(user);
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_key: user.avatarKey ?? null,
      avatar_url: user.avatarUrl ?? null,
      role: user.role,
      school_id: user.school_id,
      teacher_school_membership: eff,
      school_verified: eff === TeacherSchoolMembershipStatus.approved && !!user.school_id,
      school_join_stage: schoolJoinStage(user),
      school_join_email_verified_at: user.schoolJoinEmailVerifiedAt?.toISOString() ?? null,
      teacher_public_name_masked: user.teacherPublicNameMasked,
      teacher_branch: user.teacherBranch ?? null,
      school: user.school
        ? {
            id: user.school.id,
            name: user.school.name,
            principalName: user.school.principalName ?? null,
            type: user.school.type,
            segment: user.school.segment ?? null,
            city: user.school.city ?? null,
            district: user.school.district ?? null,
            status: user.school.status,
            teacher_limit: user.school.teacher_limit ?? 100,
            enabled_modules: user.school.enabled_modules ?? null,
          }
        : null,
      status: user.status,
      moderator_modules: user.moderatorModules ?? null,
      evrak_defaults: user.evrakDefaults ?? null,
      created_at: user.created_at,
      updated_at: user.updated_at,
    };
  }

  @Post('resend-school-join-email')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @HttpCode(200)
  async resendSchoolJoinEmail(@CurrentUser('userId') userId: string) {
    return this.usersService.resendSchoolJoinEmail(userId);
  }

  @Patch()
  @UseGuards(JwtAuthGuard)
  async update(@CurrentUser('userId') userId: string, @Body() dto: UpdateMeDto) {
    const user = await this.usersService.updateMe(userId, dto);
    const eff = effectiveTeacherSchoolMembership(user);
    return {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      avatar_key: user.avatarKey ?? null,
      avatar_url: user.avatarUrl ?? null,
      role: user.role,
      school_id: user.school_id,
      teacher_school_membership: eff,
      school_verified: eff === TeacherSchoolMembershipStatus.approved && !!user.school_id,
      school_join_stage: schoolJoinStage(user),
      school_join_email_verified_at: user.schoolJoinEmailVerifiedAt?.toISOString() ?? null,
      teacher_public_name_masked: user.teacherPublicNameMasked,
      status: user.status,
      evrak_defaults: user.evrakDefaults ?? null,
      updated_at: user.updated_at,
    };
  }

  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async changePassword(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.usersService.changePassword(
      payload.userId,
      dto.current_password,
      dto.new_password,
    );
    await this.auditService.log({
      action: 'password_changed',
      userId: payload.userId,
      schoolId: payload.user.school_id,
      ip: (req.ip ?? (Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers['x-forwarded-for'])) ?? null,
    });
    return { ok: true };
  }

  @Get('data-export')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  async dataExport(
    @CurrentUser() payload: CurrentUserPayload,
    @Req() req: Request,
    @Query('modules') modules: string | undefined,
  ) {
    const data = await this.meDataExportService.export(payload.userId, modules);
    await this.auditService.log({
      action: 'data_export',
      userId: payload.userId,
      schoolId: payload.user.school_id,
      ip: (req.ip ?? (Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers['x-forwarded-for'])) ?? null,
    });
    return data;
  }

  @Post('data-import')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async dataImport(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() body: unknown,
    @Query('modules') modules: string | undefined,
    @Req() req: Request,
  ) {
    const result = await this.meDataImportService.importBackup(payload.userId, body, modules);
    await this.auditService.log({
      action: 'data_import',
      userId: payload.userId,
      schoolId: payload.user.school_id,
      ip: (req.ip ?? (Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers['x-forwarded-for'])) ?? null,
      meta: { imported: result.imported },
    });
    return result;
  }

  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  async deleteAccount(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: DeleteAccountDto,
    @Req() req: Request,
  ) {
    await this.usersService.deleteAccount(payload.userId, dto?.current_password);
    await this.auditService.log({
      action: 'account_deleted',
      userId: payload.userId,
      schoolId: payload.user.school_id,
      ip: (req.ip ?? (Array.isArray(req.headers['x-forwarded-for'])
        ? req.headers['x-forwarded-for'][0]
        : req.headers['x-forwarded-for'])) ?? null,
      meta: { email: payload.user.email },
    });
    return { ok: true };
  }
}
