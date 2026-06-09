import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../types/enums';
import { YillikPlanUploadTemplateService } from './yillik-plan-upload-template.service';

@Controller('yillik-plan-icerik')
export class YillikPlanUploadController {
  constructor(private readonly templateService: YillikPlanUploadTemplateService) {}

  @Get('upload-template.xlsx')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async downloadTemplate(@Res() res: Response): Promise<void> {
    const buf = this.templateService.getStaticTemplate();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="yiillik-plan-sablon-2.xlsx"');
    res.send(buf);
  }
}
