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
} from '@nestjs/common';
import { SmartBoardService } from './smart-board.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';

@Controller('smart-board')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('smart_board')
export class SmartBoardController {
  constructor(private readonly service: SmartBoardService) {}

  @Get('status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async getStatus(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.getStatus(
      payload.userId,
      payload.schoolId,
      payload.user.role as UserRole,
    );
  }

  @Get('devices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin, UserRole.teacher)
  async listDevices(
    @CurrentUser() payload: CurrentUserPayload,
    @Query('school_id') querySchoolId?: string,
  ) {
    const role = payload.user.role as UserRole;
    let schoolId = payload.schoolId;
    if (role === UserRole.superadmin && querySchoolId) {
      schoolId = querySchoolId;
    }
    if (role === UserRole.teacher) {
      if (!schoolId) {
        const { ForbiddenException } = await import('@nestjs/common');
        throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilginiz yok.' });
      }
      return this.service.listDevicesForTeacher(payload.userId, schoolId);
    }
    return this.service.listDevices(schoolId, role);
  }

  @Get('devices/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getDevice(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.getDeviceById(id, scope);
  }

  @Post('devices/bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async bulkCreateDevices(
    @Body() body: { items?: Array<{ class_section: string; name?: string; room_or_location?: string }> },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const schoolId = payload.schoolId ?? payload.user?.school_id;
    if (!schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilgisi gerekli.' });
    }
    return this.service.bulkCreateDevices(
      schoolId,
      payload.user.role as UserRole,
      payload.userId,
      body?.items ?? [],
    );
  }

  @Post('devices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async createDevice(
    @Body() body: { name?: string; class_section?: string; room_or_location?: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const role = payload.user.role as UserRole;
    // school_id sadece token'dan; body'den kabul edilmez (scope override önlemi)
    const schoolId = payload.schoolId ?? payload.user?.school_id;
    if (!schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilgisi gerekli.' });
    }
    return this.service.createDevice(
      schoolId,
      role,
      payload.userId,
      {
        name: body?.name,
        class_section: body?.class_section,
        room_or_location: body?.room_or_location,
      },
    );
  }

  @Patch('devices/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async updateDevice(
    @Param('id') id: string,
    @Body() dto: { name?: string; room_or_location?: string; class_section?: string; plan_position_x?: number; plan_position_y?: number; plan_floor_index?: number; status?: 'online' | 'offline' },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.updateDevice(id, dto, scope);
  }

  @Post('sessions/disconnect-all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async disconnectAllActiveSessions(@CurrentUser() payload: CurrentUserPayload) {
    const schoolId = payload.schoolId ?? payload.user?.school_id;
    if (!schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilgisi gerekli.' });
    }
    return this.service.disconnectAllActiveSessionsForSchool(schoolId, payload.userId);
  }

  @Post('devices/bulk-action')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async bulkDeviceAction(
    @Body() body: { device_ids?: string[]; action?: 'open' | 'lock' | 'close' },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.bulkDeviceAction(
      body?.device_ids ?? [],
      body?.action ?? 'close',
      scope,
      payload.userId,
    );
  }

  @Delete('devices/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async removeDevice(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    await this.service.removeDevice(id, scope, payload.userId);
    return { ok: true };
  }

  @Get('devices/:id/schedule')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getDeviceSchedule(
    @Param('id') id: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.getDeviceSchedule(id, scope);
  }

  @Post('devices/:id/schedule')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async upsertDeviceScheduleSlot(
    @Param('id') id: string,
    @Body() body: { day_of_week: number; lesson_num: number; user_id: string; subject: string; class_section?: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    await this.service.upsertDeviceScheduleSlot(id, body, scope);
    return { ok: true };
  }

  @Delete('devices/:id/schedule')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async deleteDeviceScheduleSlot(
    @Param('id') id: string,
    @Query('day_of_week') dayOfWeek: string,
    @Query('lesson_num') lessonNum: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    await this.service.deleteDeviceScheduleSlot(
      id,
      parseInt(dayOfWeek, 10),
      parseInt(lessonNum, 10),
      scope,
    );
    return { ok: true };
  }

  @Get('schools/:schoolId/authorized-teachers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async listAuthorizedTeachers(
    @Param('schoolId') schoolId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.listAuthorizedTeachers(schoolId, scope);
  }

  @Post('schools/:schoolId/authorized-teachers')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async addAuthorizedTeacher(
    @Param('schoolId') schoolId: string,
    @Body() body: { user_id: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.addAuthorizedTeacher(
      schoolId,
      body.user_id,
      scope,
      payload.userId,
    );
  }

  @Delete('schools/:schoolId/authorized-teachers/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async removeAuthorizedTeacher(
    @Param('schoolId') schoolId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    await this.service.removeAuthorizedTeacher(schoolId, targetUserId, scope, payload.userId);
    return { ok: true };
  }

  @Patch('schools/:schoolId/teachers/:userId/usb-pin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async setTeacherUsbPin(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() body: { pin?: string | null },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.setTeacherUsbPin(schoolId, userId, scope, payload.userId, body?.pin ?? null);
  }

  @Post('schools/:schoolId/teachers/:userId/otp-codes/regenerate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async regenerateTeacherOtpCodes(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() body: { count?: number },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.regenerateTeacherOtpCodes(
      schoolId,
      userId,
      scope,
      payload.userId,
      body?.count ?? 8,
    );
  }

  @Get('schools/:schoolId/sessions/today')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getSessionsToday(
    @Param('schoolId') schoolId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.getSessionsToday(schoolId, scope);
  }

  @Get('schools/:schoolId/usage-stats')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getUsageStats(
    @Param('schoolId') schoolId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.getUsageStats(schoolId, scope, from ?? '', to ?? '');
  }

  @Get('schools/:schoolId/health-alerts')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getBoardHealthAlerts(
    @Param('schoolId') schoolId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.getBoardHealthAlerts(schoolId, scope);
  }

  @Get('schools/:schoolId/audit-logs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getSmartBoardAuditLogs(
    @Param('schoolId') schoolId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '30',
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.getSmartBoardAuditLogs(
      schoolId,
      scope,
      Math.max(1, parseInt(page, 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit, 10) || 30)),
    );
  }

  @Post('connect')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async connect(
    @Body() body: { device_id: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const schoolId = payload.schoolId;
    if (!schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilginiz yok.' });
    }
    return this.service.connect(body.device_id, payload.userId, schoolId);
  }

  @Post('disconnect')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async disconnect(
    @Body() body: { session_id: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = {
      userId: payload.userId,
      schoolId: payload.schoolId,
      role: payload.user.role as UserRole,
    };
    await this.service.disconnect(body.session_id, scope);
    return { ok: true };
  }

  @Post('heartbeat')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async heartbeat(
    @Body() body: { session_id: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.heartbeat(body.session_id, payload.userId);
  }

  @Get('schools/:schoolId/setup-status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getSetupStatus(
    @Param('schoolId') schoolId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.getSetupStatus(schoolId, scope);
  }

  @Post('schools/:schoolId/setup-code/regenerate')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async regenerateSetupCode(
    @Param('schoolId') schoolId: string,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.regenerateSchoolSetupCode(schoolId, scope, payload.userId);
  }

  @Post('qr/claim')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async claimQrSession(
    @Body() body: { school_id?: string; device_id?: string; session_id?: string; code?: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const schoolId = body?.school_id?.trim();
    const deviceId = body?.device_id?.trim();
    const sessionId = body?.session_id?.trim();
    const code = body?.code?.trim();
    if (!schoolId || !deviceId || !sessionId || !code) {
      const { BadRequestException } = await import('@nestjs/common');
      throw new BadRequestException({ code: 'INVALID_BODY', message: 'school_id, device_id, session_id, code gerekli.' });
    }
    if (!payload.schoolId || payload.schoolId !== schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'SCOPE_VIOLATION', message: 'Bu işlem için yetkiniz yok.' });
    }
    return this.service.claimQrLoginSession(schoolId, deviceId, sessionId, code, payload.userId);
  }
}
