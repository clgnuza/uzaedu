import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { ExamDutyPreferencesService } from './exam-duty-preferences.service';
import { UpdateExamDutyPreferencesDto } from './dto/update-exam-duty-preferences.dto';

/** Teacher: sınav görevi kategori ve zaman tercihleri */
@Controller('exam-duty-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher)
export class ExamDutyPreferencesController {
  constructor(private readonly prefService: ExamDutyPreferencesService) {}

  @Get()
  async get(@CurrentUser('userId') userId: string) {
    return this.prefService.getForUserWithDefaults(userId);
  }

  @Patch()
  async update(@CurrentUser('userId') userId: string, @Body() dto: UpdateExamDutyPreferencesDto) {
    return this.prefService.update(userId, dto);
  }
}
