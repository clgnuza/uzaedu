import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { User } from '../users/entities/user.entity';
import { PaginationDto } from '../common/dtos/pagination.dto';
import { paginate } from '../common/dtos/pagination.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class NotificationsService {
  /** Liste / okunmamış sayısı: birden fazla event önekini OR ile filtreler */
  private static readonly EVENT_GROUPS: Record<string, string[]> = {
    /** Kertenkele + sorumluluk sınav (sınav modülleri) */
    exam_school_modules: ['butterfly_exam', 'sorumluluk_exam'],
    /** Mesaj Gönderme Merkezi (WhatsApp) + merkez sistem mesajı */
    message_center_modules: ['messaging', 'admin_message'],
    /** Okul değerlendirme: içerik bildirimi sonrası strike / site yasağı */
    school_reviews_penalty: ['school_reviews.penalty'],
  };

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepo: Repository<NotificationPreference>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  async list(userId: string, dto: PaginationDto & { event_type?: string; event_group?: string }) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .orderBy('n.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    const groupKeys = dto.event_group ? NotificationsService.EVENT_GROUPS[dto.event_group] : null;
    if (groupKeys?.length) {
      qb.andWhere(
        new Brackets((qbs) => {
          groupKeys.forEach((p, i) => {
            qbs.orWhere(`n.event_type LIKE :_eg${i}`, { [`_eg${i}`]: `${p}.%` });
          });
        }),
      );
    } else if (dto.event_type) {
      if (dto.event_type.includes('.')) {
        qb.andWhere('n.event_type = :event_type', { event_type: dto.event_type });
      } else {
        qb.andWhere('n.event_type LIKE :pattern', { pattern: dto.event_type + '.%' });
      }
    }
    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, limit);
  }

  async markRead(userId: string, id: string): Promise<Notification> {
    const n = await this.notificationRepo.findOne({ where: { id, user_id: userId } });
    if (!n) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    n.read_at = new Date();
    return this.notificationRepo.save(n);
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ read_at: () => 'CURRENT_TIMESTAMP' })
      .where('user_id = :userId', { userId })
      .andWhere('read_at IS NULL')
      .execute();
    return { count: result.affected ?? 0 };
  }

  /** Tek bildirim sil – sadece kendi bildirimi */
  async deleteOne(userId: string, id: string): Promise<void> {
    const n = await this.notificationRepo.findOne({ where: { id, user_id: userId } });
    if (!n) throw new NotFoundException({ code: 'NOT_FOUND', message: 'İstediğiniz kayıt bulunamadı.' });
    await this.notificationRepo.remove(n);
  }

  /** Tüm bildirimleri sil – kullanıcının kendi bildirimleri */
  async deleteAll(userId: string): Promise<{ count: number }> {
    const result = await this.notificationRepo.delete({ user_id: userId });
    return { count: result.affected ?? 0 };
  }

  async getPreferences(userId: string): Promise<NotificationPreference[]> {
    return this.preferenceRepo.find({ where: { user_id: userId } });
  }

  async updatePreferences(userId: string, channels: { channel: string; push_enabled: boolean }[]): Promise<NotificationPreference[]> {
    for (const { channel, push_enabled } of channels) {
      await this.preferenceRepo.upsert(
        { user_id: userId, channel, push_enabled },
        { conflictPaths: ['user_id', 'channel'] },
      );
    }
    return this.getPreferences(userId);
  }

  /** Event sonrası Inbox kaydı oluşturmak için (diğer modüller çağırır) */
  async createInboxEntry(params: {
    user_id: string;
    event_type: string;
    entity_id?: string | null;
    target_screen?: string | null;
    title: string;
    body?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<Notification> {
    const n = this.notificationRepo.create(params);
    const saved = await this.notificationRepo.save(n);
    this.sendNotificationEmailAsync(params).catch(() => {});
    return saved;
  }

  /** support.* eventleri için e-posta gönderir (fire-and-forget) */
  private async sendNotificationEmailAsync(params: {
    user_id: string;
    event_type: string;
    entity_id?: string | null;
    target_screen?: string | null;
    title: string;
    body?: string | null;
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    if (!params.event_type.startsWith('support.')) return;
    try {
      const user = await this.userRepo.findOne({ where: { id: params.user_id }, select: ['email'] });
      if (!user?.email?.trim()) return;
      await this.mailService.sendNotificationEmail(user.email, {
        title: params.title,
        body: params.body,
        eventType: params.event_type,
        targetScreen: params.target_screen,
        entityId: params.entity_id,
        metadata: params.metadata,
      });
    } catch {
      // ignore
    }
  }

  /** Okunmamış bildirim sayısı (event_type filtresi opsiyonel, 'duty' = duty.*) */
  async getUnreadCount(userId: string, eventType?: string, eventGroup?: string): Promise<number> {
    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.user_id = :userId', { userId })
      .andWhere('n.read_at IS NULL');
    const groupKeys = eventGroup ? NotificationsService.EVENT_GROUPS[eventGroup] : null;
    if (groupKeys?.length) {
      qb.andWhere(
        new Brackets((qbs) => {
          groupKeys.forEach((p, i) => {
            qbs.orWhere(`n.event_type LIKE :_ug${i}`, { [`_ug${i}`]: `${p}.%` });
          });
        }),
      );
    } else if (eventType) {
      const prefix = eventType.endsWith('.*') ? eventType.slice(0, -2) : eventType;
      qb.andWhere('n.event_type LIKE :pattern', { pattern: prefix + '.%' });
    }
    return qb.getCount();
  }
}
