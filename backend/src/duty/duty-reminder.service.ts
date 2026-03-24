import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DutySlot } from './entities/duty-slot.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';

/** Türkiye saat diliminde bugünün YYYY-MM-DD */
function getTodayTurkey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

@Injectable()
export class DutyReminderService {
  constructor(
    @InjectRepository(DutySlot)
    private readonly slotRepo: Repository<DutySlot>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Her gün 07:00'da (sunucu saati) – nöbeti olan öğretmenlere hatırlatma */
  @Cron('0 7 * * *')
  async sendDailyReminders() {
    const today = getTodayTurkey();
    const slots = await this.slotRepo
      .createQueryBuilder('s')
      .innerJoin('s.duty_plan', 'p')
      .where('p.status = :status', { status: 'published' })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.date = :date', { date: today })
      .andWhere('s.user_id IS NOT NULL')
      .select('s.user_id')
      .getMany();

    const userIds = [...new Set(slots.map((s) => s.user_id).filter(Boolean))];
    if (userIds.length === 0) return;

    const startOfDay = new Date(today + 'T00:00:00Z');
    const endOfDay = new Date(today + 'T23:59:59Z');
    const existing = await this.notificationRepo
      .createQueryBuilder('n')
      .where('n.event_type = :type', { type: 'duty.reminder' })
      .andWhere('n.created_at >= :start', { start: startOfDay })
      .andWhere('n.created_at <= :end', { end: endOfDay })
      .select('n.user_id')
      .getRawMany();

    const sentSet = new Set(existing.map((r) => r.user_id));
    for (const uid of userIds) {
      if (sentSet.has(uid)) continue;
      await this.notificationsService.createInboxEntry({
        user_id: uid,
        event_type: 'duty.reminder',
        entity_id: null,
        target_screen: 'nobet',
        title: 'Bugün nöbetiniz var',
        body: 'Bugün nöbet göreviniz var. Günlük listeyi görüntüleyin.',
        metadata: { date: today },
      });
      sentSet.add(uid);
    }
  }
}
