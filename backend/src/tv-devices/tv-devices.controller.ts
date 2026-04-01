import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { TvDevicesService } from './tv-devices.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RequireSchoolModuleGuard } from '../common/guards/require-school-module.guard';
import { RequireSchoolModule } from '../common/decorators/require-school-module.decorator';
import { RequireModuleActivationGuard } from '../market/guards/require-module-activation.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';

@Controller('tv-devices')
@UseGuards(JwtAuthGuard, RequireSchoolModuleGuard, RequireModuleActivationGuard)
@RequireSchoolModule('tv')
export class TvDevicesController {
  constructor(private readonly service: TvDevicesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async list(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.list(payload.schoolId, payload.user.role as UserRole);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async create(
    @Body() body: { school_id?: string; display_group?: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const schoolId = payload.schoolId ?? payload.user?.school_id ?? body?.school_id;
    if (!schoolId) {
      const { ForbiddenException } = await import('@nestjs/common');
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Okul bilgisi gerekli (school_admin token\'dan, superadmin body\'den).' });
    }
    const displayGroup = body?.display_group === 'teachers' ? 'teachers' : 'corridor';
    return this.service.create(schoolId, payload.user.role as UserRole, displayGroup);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async update(
    @Param('id') id: string,
    @Body() dto: { name?: string; display_group?: string },
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    return this.service.update(id, dto, scope);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async remove(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { schoolId: payload.schoolId, role: payload.user.role as UserRole };
    await this.service.remove(id, scope);
    return { ok: true };
  }
}
