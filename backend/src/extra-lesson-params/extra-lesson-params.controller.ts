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
  Header,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { ExtraLessonParamsService } from './extra-lesson-params.service';
import { ExtraLessonStatsService } from './extra-lesson-stats.service';
import { CreateExtraLessonParamsDto } from './dto/create-extra-lesson-params.dto';
import { UpdateExtraLessonParamsDto } from './dto/update-extra-lesson-params.dto';
import { UpdateLineItemTemplatesDto } from './dto/update-line-item-templates.dto';
import { ListExtraLessonParamsDto } from './dto/list-extra-lesson-params.dto';

@Controller('extra-lesson')
export class ExtraLessonParamsController {
  constructor(
    private readonly service: ExtraLessonParamsService,
    private readonly statsService: ExtraLessonStatsService,
  ) {}

  /** Public: Canlı kullanıcı ve toplam hesaplama istatistikleri. Auth yok. */
  @Get('stats')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=15')
  async getStats() {
    return this.statsService.getStats();
  }

  /** Public: Sayfa açıkken heartbeat – canlı kullanıcı sayacı için. */
  @Post('stats/heartbeat')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async heartbeat(@Body('session_id') sessionId: string) {
    this.statsService.heartbeat(sessionId ?? '');
    return { ok: true };
  }

  /** Public: Hesaplama yapıldığında toplam sayacı artır. */
  @Post('stats/calc')
  @Throttle({ default: { limit: 300, ttl: 60000 } })
  async recordCalc() {
    this.statsService.recordCalculation();
    return { ok: true };
  }

  /** Public + girişli: Aktif parametre seti (hesaplama). Giriş zorunlu değil. 5 dk cache. */
  @Get('params/active')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=300')
  async getActiveParams(@Query('semester_code') semesterCode?: string) {
    return this.service.getActiveParams(semesterCode ?? undefined);
  }

  /** Public + girişli: Bütçe dönemi listesi. 5 dk cache. */
  @Get('params/available-semesters')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Header('Cache-Control', 'public, max-age=300')
  async getAvailableSemesters() {
    return this.service.findAvailableSemesters();
  }

  /** Superadmin/moderator: Tüm parametre setleri */
  @Get('params')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async listParams(@Query() dto: ListExtraLessonParamsDto) {
    return this.service.findAll(dto);
  }

  /** Superadmin/moderator: Tek parametre seti */
  @Get('params/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async getParam(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Superadmin/moderator: Yeni parametre seti */
  @Post('params')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async create(@Body() dto: CreateExtraLessonParamsDto) {
    return this.service.create(dto);
  }

  /** Superadmin/moderator: Gösterge tablosu (kalem şablonları) */
  @Get('line-item-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async getLineItemTemplates() {
    return this.service.getLineItemTemplates();
  }

  /** Superadmin/moderator: Gösterge tablosunu güncelle */
  @Patch('line-item-templates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async updateLineItemTemplates(@Body() dto: UpdateLineItemTemplatesDto) {
    return this.service.updateLineItemTemplates(dto.templates);
  }

  /** Superadmin: Tüm parametre setlerini güncel tabloya göre yenile (line_items, central_exam_roles) */
  @Post('params/refresh-all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async refreshAll() {
    return this.service.refreshAllParams();
  }

  /** Superadmin: Tüm parametre setlerinin vergi alanlarını 2026 resmi değerlerine güncelle */
  @Post('params/apply-resmi-2026')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin)
  async applyResmi2026() {
    return this.service.applyResmi2026ToAll();
  }

  /** Superadmin/moderator: Güncelle */
  @Patch('params/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async update(@Param('id') id: string, @Body() dto: UpdateExtraLessonParamsDto) {
    return this.service.update(id, dto);
  }

  /** Superadmin/moderator: Sil */
  @Delete('params/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('extra_lesson_params')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }
}
