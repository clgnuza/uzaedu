import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { ContactSubmissionsService } from './contact-submissions.service';
import { ListContactSubmissionsDto } from './dto/list-contact-submissions.dto';
import { ReplyContactSubmissionDto } from './dto/reply-contact-submission.dto';
import { PatchContactSubmissionDto } from './dto/patch-contact-submission.dto';

@Controller('admin/contact-submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.superadmin, UserRole.moderator)
export class ContactSubmissionsAdminController {
  constructor(private readonly svc: ContactSubmissionsService) {}

  @Get()
  async list(@Query() dto: ListContactSubmissionsDto) {
    return this.svc.listForStaff(dto);
  }

  /** Spesifik rota, :id yakalamasından önce eşleşmeli */
  @Post(':id/reply')
  async reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplyContactSubmissionDto,
    @CurrentUser() u: CurrentUserPayload,
  ) {
    return this.svc.replyAsStaff(id, u.userId, dto.message);
  }

  @Patch(':id')
  async patch(@Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchContactSubmissionDto) {
    return this.svc.setStatus(id, dto.status);
  }

  @Get(':id')
  async one(@Param('id', ParseUUIDPipe) id: string) {
    await this.svc.markReadIfNew(id);
    const row = await this.svc.getOneForStaff(id);
    return this.svc.toAdminDetail(row);
  }
}
