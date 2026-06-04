import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import webpush from 'web-push';
import { PushSubscription } from './entities/push-subscription.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationPushSettings } from './entities/notification-push-settings.entity';
import { isQuietHoursActive } from './notification-quiet-hours';
import type { Notification } from './entities/notification.entity';
import { eventTypeToChannel, NOTIFICATION_CHANNELS } from './notification-channels';
import { notificationDeepLink } from './notification-push-link';
import { notificationEventLabel } from './notification-event-labels';

export type PushSubscribeDto = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

@Injectable()
export class WebPushService {
  private readonly log = new Logger(WebPushService.name);
  private configured = false;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subRepo: Repository<PushSubscription>,
    @InjectRepository(NotificationPreference)
    private readonly prefRepo: Repository<NotificationPreference>,
    @InjectRepository(NotificationPushSettings)
    private readonly pushSettingsRepo: Repository<NotificationPushSettings>,
  ) {
    this.initVapid();
  }

  private initVapid(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:uzaeduapp@gmail.com';
    if (!publicKey || !privateKey) {
      this.log.warn('VAPID anahtarları yok — Web Push devre dışı (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)');
      return;
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.configured = true;
  }

  getPublicKey(): string | null {
    return process.env.VAPID_PUBLIC_KEY?.trim() || null;
  }

  isEnabled(): boolean {
    return this.configured;
  }

  async upsertSubscription(userId: string, dto: PushSubscribeDto, userAgent?: string | null): Promise<void> {
    await this.subRepo.upsert(
      {
        user_id: userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        user_agent: userAgent?.slice(0, 512) ?? null,
      },
      { conflictPaths: ['user_id', 'endpoint'] },
    );
  }

  async removeSubscription(userId: string, endpoint: string): Promise<void> {
    await this.subRepo.delete({ user_id: userId, endpoint });
  }

  async removeAllForUser(userId: string): Promise<void> {
    await this.subRepo.delete({ user_id: userId });
  }

  async countSubscriptions(userId: string): Promise<number> {
    return this.subRepo.count({ where: { user_id: userId } });
  }

  private async getChannelPref(userId: string, channel: string): Promise<NotificationPreference | null> {
    return this.prefRepo.findOne({ where: { user_id: userId, channel } });
  }

  private async isChannelPushEnabled(userId: string, channel: string): Promise<boolean> {
    const pref = await this.getChannelPref(userId, channel);
    if (!pref) return true;
    return pref.push_enabled !== false;
  }

  private async isChannelCritical(userId: string, channel: string): Promise<boolean> {
    const pref = await this.getChannelPref(userId, channel);
    return pref?.critical === true;
  }

  private async getPushSettings(userId: string): Promise<NotificationPushSettings> {
    const row = await this.pushSettingsRepo.findOne({ where: { user_id: userId } });
    if (row) return row;
    return this.pushSettingsRepo.create({
      user_id: userId,
      quiet_hours_enabled: false,
      quiet_start_minutes: 22 * 60,
      quiet_end_minutes: 8 * 60,
      timezone: 'Europe/Istanbul',
      sound_enabled: true,
      vibration_enabled: true,
    });
  }

  /** Inbox kaydı sonrası cihaz bildirimi (kanal tercihi + abonelik). */
  async sendForInboxNotification(n: Notification): Promise<void> {
    if (!this.configured) return;
    const channel = eventTypeToChannel(n.event_type);
    if (!(await this.isChannelPushEnabled(n.user_id, channel))) return;

    const settings = await this.getPushSettings(n.user_id);
    const critical = await this.isChannelCritical(n.user_id, channel);
    if (
      isQuietHoursActive({
        enabled: settings.quiet_hours_enabled,
        startMinutes: settings.quiet_start_minutes,
        endMinutes: settings.quiet_end_minutes,
        timezone: settings.timezone,
      }) &&
      !critical
    ) {
      return;
    }

    const subs = await this.subRepo.find({ where: { user_id: n.user_id } });
    if (subs.length === 0) return;

    const url = notificationDeepLink(n);
    const label = notificationEventLabel(n.event_type);
    const channelLabel =
      NOTIFICATION_CHANNELS.find((c) => c.id === channel)?.label ?? label;
    const soundOn = settings.sound_enabled !== false;
    const vibrateOn = settings.vibration_enabled !== false;
    const payload = JSON.stringify({
      id: n.id,
      title: n.title || label,
      body: n.body || label,
      url,
      tag: `${channel}:${n.id}`,
      channel,
      channelLabel,
      silent: !soundOn,
      vibrate: vibrateOn,
      requireInteraction: critical,
    });

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 },
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await this.subRepo.delete({ id: sub.id });
        } else {
          this.log.debug(`Push failed user=${n.user_id} status=${status}`);
        }
      }
    }
  }
}
