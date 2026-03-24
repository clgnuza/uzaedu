import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';

class UpdatePreferencesDto {
  channels: { channel: string; push_enabled: boolean }[];
}

@Controller('notification-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher)
export class NotificationPreferencesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async get(@CurrentUser('userId') userId: string) {
    return this.notificationsService.getPreferences(userId);
  }

  @Patch()
  async update(@CurrentUser('userId') userId: string, @Body() dto: UpdatePreferencesDto) {
    if (!dto.channels?.length) return this.notificationsService.getPreferences(userId);
    return this.notificationsService.updatePreferences(userId, dto.channels);
  }
}
