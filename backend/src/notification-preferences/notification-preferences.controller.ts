import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from '../notifications/notifications.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';

class ChannelPrefDto {
  channel: string;
  push_enabled?: boolean;
  critical?: boolean;
}

class PushSettingsDto {
  quiet_hours_enabled?: boolean;
  quiet_start_minutes?: number;
  quiet_end_minutes?: number;
  timezone?: string;
  sound_enabled?: boolean;
  vibration_enabled?: boolean;
}

class UpdatePreferencesDto {
  channels?: ChannelPrefDto[];
  settings?: PushSettingsDto;
}

@Controller('notification-preferences')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
export class NotificationPreferencesController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('channels')
  channels() {
    return { channels: this.notificationsService.listChannelCatalog() };
  }

  @Get()
  async get(@CurrentUser('userId') userId: string) {
    return this.notificationsService.getPreferencesBundle(userId);
  }

  @Patch()
  async update(@CurrentUser('userId') userId: string, @Body() dto: UpdatePreferencesDto) {
    if (dto.settings) {
      await this.notificationsService.updatePushSettings(userId, dto.settings);
    }
    if (dto.channels?.length) {
      await this.notificationsService.updatePreferences(userId, dto.channels);
    }
    return this.notificationsService.getPreferencesBundle(userId);
  }
}
