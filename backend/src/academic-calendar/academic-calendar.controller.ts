import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { AcademicCalendarService } from './academic-calendar.service';
import { AcademicCalendarItem } from './entities/academic-calendar-item.entity';
import { BelirliGunHaftaGorev } from './entities/belirli-gun-hafta-gorev.entity';
import { CreateAcademicCalendarItemDto } from './dto/create-item.dto';
import { UpdateAcademicCalendarItemDto } from './dto/update-item.dto';
import { ReorderAcademicCalendarItemsDto } from './dto/reorder-items.dto';
import { PatchAcademicCalendarOverridesDto } from './dto/school-overrides.dto';
import { CreateBelirliGunHaftaGorevDto } from './dto/create-assignment.dto';

@Controller('academic-calendar')
export class AcademicCalendarController {
  constructor(private readonly service: AcademicCalendarService) {}

  private getAcademicYear(academicYear: string | undefined): string {
    const y = (academicYear ?? '').trim();
    if (y) return y;
    const year = new Date().getFullYear();
    const month = new Date().getMonth();
    return month < 8 ? `${year - 1}-${year}` : `${year}-${year + 1}`;
  }

  /** Teacher, school_admin, superadmin: Hafta bazlı takvim. Superadmin için schoolId null (şablon görünümü). */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin)
  async getForViewer(
    @Query('academic_year') academicYear: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    return this.service.getForViewer(this.getAcademicYear(academicYear), payload.schoolId ?? null);
  }

  /** Superadmin, school_admin: Ham şablon. Haftalar eğitim öğretim takviminden (work_calendar). */
  @Get('template')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.school_admin)
  async getTemplate(@Query('academic_year') academicYear: string | undefined) {
    return this.service.getTemplate(this.getAcademicYear(academicYear));
  }

  /** Superadmin: Öğe ekle (week_id = work_calendar.id) */
  @Post('items')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async createItem(@Body() dto: CreateAcademicCalendarItemDto): Promise<AcademicCalendarItem> {
    return this.service.createItem(dto);
  }

  /** Superadmin: Öğe güncelle */
  @Patch('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async updateItem(@Param('id') id: string, @Body() dto: UpdateAcademicCalendarItemDto): Promise<AcademicCalendarItem> {
    return this.service.updateItem(id, dto);
  }

  /** Superadmin: Öğe sil (soft) */
  @Delete('items/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async deleteItem(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.service.deleteItem(id);
    return { success: true };
  }

  /** Superadmin: Öğe sıralamasını güncelle (sürükle-bırak sonrası) */
  @Patch('items/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async reorderItems(@Body() dto: ReorderAcademicCalendarItemsDto): Promise<{ success: boolean }> {
    await this.service.reorderItems(dto.item_ids);
    return { success: true };
  }

  /** School_admin: Okul override'larını getir */
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
  async patchSchoolOverrides(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: PatchAcademicCalendarOverridesDto,
  ) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    await this.service.patchSchoolOverrides(payload.schoolId, dto);
    return { success: true };
  }

  /** Teacher: Kendi Belirli Gün görevlendirmeleri (dashboard için) */
  @Get('my-assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher)
  async getMyAssignments(
    @Query('academic_year') academicYear: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!payload.schoolId) return [];
    return this.service.getMyAssignments(
      payload.userId,
      payload.schoolId,
      this.getAcademicYear(academicYear),
    );
  }

  /** School_admin: Belirli Gün görevlendirmeleri listesi */
  @Get('assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async getAssignments(
    @Query('academic_year') academicYear: string | undefined,
    @CurrentUser() payload: CurrentUserPayload,
  ) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    return this.service.getAssignments(payload.schoolId, this.getAcademicYear(academicYear));
  }

  /** School_admin: Belirli Gün'e öğretmen ata */
  @Post('assignments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async createAssignment(
    @CurrentUser() payload: CurrentUserPayload,
    @Body() dto: CreateBelirliGunHaftaGorevDto,
  ): Promise<BelirliGunHaftaGorev> {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    return this.service.createAssignment(payload.schoolId, dto, payload.userId);
  }

  /** School_admin: Görevlendirmeyi kaldır */
  @Delete('assignments/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.school_admin)
  async deleteAssignment(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    if (!payload.schoolId) throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Bu işlem için okul atanmış olmalıdır.' });
    await this.service.deleteAssignment(payload.schoolId, id);
    return { success: true };
  }
}
