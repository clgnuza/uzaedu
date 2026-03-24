import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { AnnouncementsService } from './announcements.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';
import { ListAnnouncementsDto } from './dto/list-announcements.dto';

@Controller('announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async list(@Query() dto: ListAnnouncementsDto, @CurrentUser() payload: CurrentUserPayload) {
    const role = payload.user.role as UserRole;
    if (role === UserRole.superadmin && !dto.school_id) {
      throw new BadRequestException({ code: 'MISSING_PARAM', message: 'Superadmin için school_id zorunludur.' });
    }
    const scope = {
      role,
      schoolId: role === UserRole.superadmin ? dto.school_id ?? null : payload.schoolId,
      userId: payload.userId,
    };
    return this.announcementsService.list(dto, scope);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async create(@Body() dto: CreateAnnouncementDto, @CurrentUser() payload: CurrentUserPayload) {
    const role = payload.user.role as UserRole;
    const schoolId = role === UserRole.superadmin ? (dto.school_id ?? null) : payload.schoolId;
    if (role === UserRole.superadmin && !schoolId) {
      throw new BadRequestException({ code: 'MISSING_PARAM', message: 'Okul seçimi zorunludur.' });
    }
    const scope = { role, schoolId: schoolId ?? null, userId: payload.userId };
    return this.announcementsService.create(dto, scope);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async getById(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId };
    return this.announcementsService.findById(id, scope);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    const scope = { schoolId: payload.schoolId };
    return this.announcementsService.update(id, dto, scope);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async remove(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { schoolId: payload.schoolId };
    await this.announcementsService.remove(id, scope);
    return { ok: true };
  }

  @Patch(':id/read')
  @UseGuards(RolesGuard)
  @Roles(UserRole.teacher)
  async markRead(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.announcementsService.markRead(id, userId);
  }
}
