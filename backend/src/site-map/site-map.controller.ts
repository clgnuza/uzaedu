import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { SiteMapService } from './site-map.service';
import { CreateSiteMapItemDto } from './dto/create-site-map-item.dto';
import { UpdateSiteMapItemDto } from './dto/update-site-map-item.dto';
import { PatchSchoolOverridesDto } from './dto/school-overrides.dto';
import { SiteMapItem } from './entities/site-map-item.entity';

@Controller('site-map')
export class SiteMapController {
  constructor(private readonly service: SiteMapService) {}

  /** Teacher, school_admin: Okul scope'lu birleşik site haritası */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin)
  async getForViewer(@CurrentUser() payload: CurrentUserPayload) {
    return this.service.getForViewer(payload.schoolId);
  }

  /** Superadmin, school_admin: Ham şablon listesi (flat). school_admin okul override ayarları için okur. */
  @Get('template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async getTemplate() {
    return this.service.getTemplateFlat();
  }

  /** Superadmin: Öğe ekle */
  @Post('template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async createItem(@Body() dto: CreateSiteMapItemDto): Promise<SiteMapItem> {
    return this.service.createItem(dto);
  }

  /** Superadmin: Öğe güncelle */
  @Patch('template/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateItem(@Param('id') id: string, @Body() dto: UpdateSiteMapItemDto): Promise<SiteMapItem> {
    return this.service.updateItem(id, dto);
  }

  /** Superadmin: Öğe sil (soft) */
  @Delete('template/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async deleteItem(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.deleteItem(id);
    return { success: true };
  }

  /** School_admin: Kendi okulunun override'larını getir */
  @Get('school-overrides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getSchoolOverrides(@CurrentUser() payload: CurrentUserPayload) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    return this.service.getSchoolOverrides(payload.schoolId);
  }

  /** School_admin: Override'ları güncelle */
  @Patch('school-overrides')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async patchSchoolOverrides(@CurrentUser() payload: CurrentUserPayload, @Body() dto: PatchSchoolOverridesDto) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    await this.service.patchSchoolOverrides(payload.schoolId, dto);
    return { success: true };
  }
}
