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
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { WorkCalendarService } from './work-calendar.service';
import { WorkCalendarGptService } from './work-calendar-gpt.service';
import { CreateWorkCalendarDto } from './dto/create-work-calendar.dto';
import { UpdateWorkCalendarDto } from './dto/update-work-calendar.dto';

@Controller('work-calendar')
export class WorkCalendarController {
  constructor(
    private readonly service: WorkCalendarService,
    private readonly gptService: WorkCalendarGptService,
  ) {}

  /** Superadmin, moderator: Listele (öğretim yılına göre filtre) */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async list(@Query('academic_year') academicYear?: string) {
    const items = await this.service.findAll(academicYear);
    return { items };
  }

  /** Superadmin, moderator: Öğretim yılına göre toplu silme (statik path - :id'den önce) */
  @Post('bulk-delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async bulkDelete(@Body() body: { academic_year: string }) {
    const count = await this.service.bulkDelete(body.academic_year ?? '');
    return { deleted: count, success: true };
  }

  /** Superadmin, moderator: GPT ile çalışma takvimi taslağı oluştur */
  @Post('generate-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async generateDraft(@Body() body: { academic_year: string }) {
    return this.gptService.generateDraft(body.academic_year?.trim() ?? '');
  }

  /** Superadmin, moderator: MEB takviminden tam senkron (bilinen yıllar için seminer dahil tek tık) */
  @Post('sync-from-meb')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async syncFromMeb(@Body() body: { academic_year: string }) {
    const year = body.academic_year?.trim() ?? '';
    const result = await this.gptService.syncFromMeb(year);
    const { created, updated } = result;
    return {
      ...result,
      message:
        created > 0 || updated > 0
          ? `${created} hafta eklendi, ${updated} hafta güncellendi. Mevcut içerik korundu.`
          : 'Takvim güncel. Değişiklik yapılmadı.',
    };
  }

  /** Superadmin, moderator: GPT taslağını kaydet (mevcut yıl takvimi silinir, yerine taslak yazılır) */
  @Post('save-draft')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async saveDraft(
    @Body()
    body: {
      academic_year: string;
      items: Array<{
        week_order: number;
        week_start: string;
        week_end: string;
        ay: string;
        hafta_label?: string | null;
        is_tatil?: boolean;
        tatil_label?: string | null;
        sinav_etiketleri?: string | null;
      }>;
    },
  ) {
    const created = await this.service.bulkCreate(body.academic_year, body.items ?? []);
    return { created: created.length, items: created };
  }

  /** Superadmin, moderator: Tek kayıt */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  /** Superadmin, moderator: Yeni kayıt */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async create(@Body() dto: CreateWorkCalendarDto) {
    return this.service.create(dto);
  }

  /** Superadmin, moderator: Güncelle */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkCalendarDto) {
    return this.service.update(id, dto);
  }

  /** Superadmin, moderator: Sil */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('document_templates')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { success: true };
  }

}
