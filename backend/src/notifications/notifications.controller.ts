import { Controller, Get, Patch, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { PaginationDto } from '../common/dtos/pagination.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher, UserRole.school_admin)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser('userId') userId: string,
    @Query() dto: PaginationDto & { event_type?: string },
  ) {
    return this.notificationsService.list(userId, dto);
  }

  @Get('unread-count')
  async unreadCount(
    @CurrentUser('userId') userId: string,
    @Query('event_type') eventType?: string,
  ) {
    const count = await this.notificationsService.getUnreadCount(userId, eventType);
    return { count };
  }

  @Patch(':id/read')
  async markRead(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    return this.notificationsService.markRead(userId, id);
  }

  @Patch('read-all')
  async markAllRead(@CurrentUser('userId') userId: string) {
    return this.notificationsService.markAllRead(userId);
  }

  @Delete('delete-all')
  async deleteAll(@CurrentUser('userId') userId: string) {
    return this.notificationsService.deleteAll(userId);
  }

  @Delete(':id')
  async deleteOne(@CurrentUser('userId') userId: string, @Param('id') id: string) {
    await this.notificationsService.deleteOne(userId, id);
    return { ok: true };
  }
}
