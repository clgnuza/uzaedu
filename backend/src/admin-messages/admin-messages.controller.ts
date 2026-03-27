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
  ParseUUIDPipe,
} from '@nestjs/common';
import { AdminMessagesService } from './admin-messages.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RequireModule } from '../common/decorators/require-module.decorator';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { CreateAdminMessageDto } from './dto/create-admin-message.dto';
import { ListAdminMessagesDto } from './dto/list-admin-messages.dto';
import { PaginationDto } from '../common/dtos/pagination.dto';

@Controller('admin-messages')
@UseGuards(JwtAuthGuard)
export class AdminMessagesController {
  constructor(private readonly adminMessagesService: AdminMessagesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('announcements')
  async create(@Body() dto: CreateAdminMessageDto, @CurrentUser() payload: CurrentUserPayload) {
    return this.adminMessagesService.create(dto, { userId: payload.userId });
  }

  @Get('unread-count')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async unreadCount(@CurrentUser() payload: CurrentUserPayload) {
    const count = await this.adminMessagesService.getUnreadCount({
      schoolId: payload.schoolId ?? null,
      userId: payload.userId,
    });
    return { count };
  }

  @Get('sent-batches')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('announcements')
  async listSentBatches(@Query() dto: PaginationDto) {
    return this.adminMessagesService.listSentBatches(dto);
  }

  @Get('sent-batches/:batchId/report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('announcements')
  async getBatchDeliveryReport(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.adminMessagesService.getBatchDeliveryReport(batchId);
  }

  @Delete('sent-batches/:batchId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.superadmin, UserRole.moderator)
  @RequireModule('announcements')
  async deleteSentBatch(@Param('batchId', ParseUUIDPipe) batchId: string) {
    return this.adminMessagesService.deleteBatch(batchId);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async list(@Query() dto: ListAdminMessagesDto, @CurrentUser() payload: CurrentUserPayload) {
    const role = payload.user.role as UserRole;
    const scope = {
      role,
      schoolId: payload.schoolId ?? null,
      userId: payload.userId,
    };
    return this.adminMessagesService.list(dto, scope);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin, UserRole.superadmin)
  async getById(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    const scope = { role: payload.user.role as UserRole, schoolId: payload.schoolId ?? null };
    return this.adminMessagesService.findById(id, scope);
  }

  @Patch(':id/read')
  @UseGuards(RolesGuard)
  @Roles(UserRole.school_admin)
  async markRead(@Param('id') id: string, @CurrentUser() payload: CurrentUserPayload) {
    return this.adminMessagesService.markRead(id, payload.userId, {
      schoolId: payload.schoolId ?? null,
    });
  }
}
