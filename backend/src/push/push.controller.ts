import { Body, Controller, Delete, Get, Headers, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '../types/enums';
import { WebPushService } from '../notifications/web-push.service';
import { SubscribeBodyDto, UnsubscribeBodyDto } from './dto/push-subscribe.dto';

@Controller('push')
export class PushController {
  constructor(private readonly webPush: WebPushService) {}

  @Get('vapid-public-key')
  vapidPublicKey() {
    const publicKey = this.webPush.getPublicKey();
    return { publicKey, enabled: this.webPush.isEnabled() && !!publicKey };
  }

  @Get('status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async status(@CurrentUser('userId') userId: string, @Query('endpoint') endpoint?: string) {
    const count = await this.webPush.countSubscriptions(userId);
    const endpointTrim = endpoint?.trim();
    const thisDevice = endpointTrim ? await this.webPush.hasSubscription(userId, endpointTrim) : false;
    return {
      subscribed: count > 0,
      thisDevice,
      deviceCount: count,
      pushEnabled: this.webPush.isEnabled(),
    };
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async subscribe(
    @CurrentUser('userId') userId: string,
    @Body() body: SubscribeBodyDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    if (!body?.endpoint || !body?.keys?.p256dh || !body?.keys?.auth) {
      return { ok: false, message: 'Geçersiz abonelik' };
    }
    if (!this.webPush.isEnabled()) {
      return { ok: false, message: 'Sunucuda push yapılandırması yok' };
    }
    await this.webPush.upsertSubscription(userId, body, userAgent ?? null);
    return { ok: true };
  }

  @Delete('subscribe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.teacher, UserRole.school_admin, UserRole.superadmin, UserRole.moderator)
  async unsubscribe(@CurrentUser('userId') userId: string, @Body() body: UnsubscribeBodyDto) {
    if (body?.endpoint) {
      await this.webPush.removeSubscription(userId, body.endpoint);
    } else {
      await this.webPush.removeAllForUser(userId);
    }
    return { ok: true };
  }
}
