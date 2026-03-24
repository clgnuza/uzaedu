import { Controller, Get, Param, Post, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { ExamDutiesService } from './exam-duties.service';
import { ListExamDutiesDto } from './dto/list-exam-duties.dto';
import { AssignMeDto } from './dto/assign-me.dto';

/** Teacher: sadece yayınlanmış sınav görevleri */
@Controller('exam-duties')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher)
export class ExamDutiesController {
  constructor(private readonly examDutiesService: ExamDutiesService) {}

  @Get()
  async list(@Query() dto: ListExamDutiesDto) {
    return this.examDutiesService.list(dto, false);
  }

  @Get('my-assignments')
  async myAssignments(@CurrentUser('userId') userId: string) {
    return this.examDutiesService.getMyAssignments(userId);
  }

  @Get(':id/assigned')
  async isAssigned(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    const assigned = await this.examDutiesService.isAssigned(id, userId);
    return { assigned };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.examDutiesService.findById(id, false);
  }

  /** Bu sınavda görev çıktığını işaretle; sınav günü sabah hatırlatması alırsınız. Body: preferred_exam_date? (YYYY-MM-DD, çok günlü sınavda sadece o gün) */
  @Post(':id/assign-me')
  async assignMe(@Param('id') id: string, @CurrentUser('userId') userId: string, @Body() dto?: AssignMeDto) {
    return this.examDutiesService.assignMe(id, userId, dto?.preferred_exam_date ?? null);
  }

  /** Görev çıktı işaretini geri al; sınav günü sabah hatırlatması almayacaksınız. */
  @Post(':id/unassign-me')
  async unassignMe(@Param('id') id: string, @CurrentUser('userId') userId: string) {
    return this.examDutiesService.unassignMe(id, userId);
  }
}
