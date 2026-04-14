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

@Controller('smart-board')
@UseGuards(JwtAuthGuard)
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
}
