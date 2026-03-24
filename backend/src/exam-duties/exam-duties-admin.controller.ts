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
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { ExamDutiesService } from './exam-duties.service';
import { ExamDutySyncService } from './exam-duty-sync.service';
import { CreateExamDutyDto } from './dto/create-exam-duty.dto';
import { UpdateExamDutyDto } from './dto/update-exam-duty.dto';
import { ListExamDutiesDto } from './dto/list-exam-duties.dto';
import { CreateSyncSourceDto } from './dto/create-sync-source.dto';
import { UpdateSyncSourceDto } from './dto/update-sync-source.dto';
import { BulkUpdateDatesDto } from './dto/bulk-update-dates.dto';

/** Superadmin: sınav görevi CRUD ve yayınlama */
@Controller('admin/exam-duties')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin)
export class ExamDutiesAdminController {
  constructor(
    private readonly examDutiesService: ExamDutiesService,
    private readonly examDutySyncService: ExamDutySyncService,
  ) {}

  @Get()
  async list(@Query() dto: ListExamDutiesDto) {
    return this.examDutiesService.list(dto, true);
  }

  @Post()
  async create(@Body() dto: CreateExamDutyDto, @CurrentUser('userId') userId: string) {
    return this.examDutiesService.create(dto, userId);
  }

  @Post('bulk-publish')
  async bulkPublish(@Body() body: { ids?: string[] }) {
    return this.examDutiesService.bulkPublish(body.ids ?? []);
  }

  @Post('bulk-delete')
  async bulkDelete(@Body() body: { ids?: string[] }) {
    return this.examDutiesService.bulkDelete(body.ids ?? []);
  }

  @Post('bulk-update-dates')
  async bulkUpdateDates(@Body() dto: BulkUpdateDatesDto) {
    return this.examDutiesService.bulkUpdateDates(dto.ids, dto.field, dto.value);
  }

  @Get('sync-sources')
  async getSyncSources() {
    return this.examDutySyncService.getSources();
  }

  @Post('sync-sources')
  async createSyncSource(@Body() dto: CreateSyncSourceDto) {
    return this.examDutySyncService.createSource({
      key: dto.key,
      label: dto.label,
      categorySlug: dto.categorySlug,
      rssUrl: dto.rssUrl ?? null,
      baseUrl: dto.baseUrl ?? null,
      scrapeConfig: dto.scrapeConfig ?? null,
      titleKeywords: dto.titleKeywords ?? null,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  @Patch('sync-sources/:sourceId')
  async updateSyncSource(@Param('sourceId') sourceId: string, @Body() dto: UpdateSyncSourceDto) {
    return this.examDutySyncService.updateSource(sourceId, {
      label: dto.label,
      categorySlug: dto.categorySlug,
      rssUrl: dto.rssUrl,
      baseUrl: dto.baseUrl,
      scrapeConfig: dto.scrapeConfig,
      titleKeywords: dto.titleKeywords,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
  }

  @Delete('sync-sources/:sourceId')
  async deleteSyncSource(@Param('sourceId') sourceId: string) {
    await this.examDutySyncService.deleteSource(sourceId);
    return { ok: true };
  }

  @Post('sync')
  async runSync(@Body() body?: { dry_run?: boolean }) {
    return this.examDutySyncService.runSync({ dry_run: body?.dry_run });
  }

  @Post('clear-sync-data')
  async clearSyncData(@Body() body: { source_key?: string }) {
    return this.examDutySyncService.clearSyncData(body.source_key);
  }

  @Get('sync-health')
  async getSyncHealth() {
    return this.examDutySyncService.getSyncHealth();
  }

  @Get('sync-last-skipped')
  async getSyncLastSkipped() {
    return this.examDutySyncService.getLastSkippedItems();
  }

  @Get(':id/target-count')
  async getTargetCount(@Param('id') id: string) {
    return this.examDutiesService.getTargetCount(id);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.examDutiesService.findById(id, true);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateExamDutyDto) {
    return this.examDutiesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.examDutiesService.remove(id);
    return { ok: true };
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    return this.examDutiesService.publish(id);
  }
}
