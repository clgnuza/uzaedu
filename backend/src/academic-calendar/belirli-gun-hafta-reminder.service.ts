import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BelirliGunHaftaGorev } from './entities/belirli-gun-hafta-gorev.entity';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';

const REMINDER_DAYS_BEFORE = 3;

/** Türkiye saat diliminde bugünün YYYY-MM-DD */
function getTodayTurkey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

/** Tarihe N gün ekle */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BelirliGunHaftaReminderService {
  constructor(
    @InjectRepository(BelirliGunHaftaGorev)
    private readonly gorevRepo: Repository<BelirliGunHaftaGorev>,
    @InjectRepository(WorkCalendar)
    private readonly workCalendarRepo: Repository<WorkCalendar>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Her gün 08:00'da – 3 gün sonraki haftada görevi olan öğretmenlere hatırlatma */
  @Cron('0 8 * * *')
  async sendReminders() {
    const today = getTodayTurkey();
    const targetDate = addDays(today, REMINDER_DAYS_BEFORE);

    const targetWeeks = await this.workCalendarRepo
      .createQueryBuilder('w')
      .where('w.week_start <= :target', { target: targetDate })
      .andWhere('w.week_end >= :target', { target: targetDate })
      .getMany();
    if (targetWeeks.length === 0) return;

    const weekId = targetWeeks[0].id;

    const list = await this.gorevRepo
      .createQueryBuilder('g')
      .innerJoin('g.academicCalendarItem', 'i')
      .addSelect(['i.title'])
      .where('i.week_id = :weekId', { weekId })
      .getMany();

    if (list.length === 0) return;

    const startOfDay = new Date(today + 'T00:00:00Z');
    const endOfDay = new Date(today + 'T23:59:59Z');
    const existing = await this.notificationRepo
      .createQueryBuilder('n')
      .where('n.event_type = :type', { type: 'belirli_gun_hafta.reminder' })
      .andWhere('n.created_at >= :start', { start: startOfDay })
      .andWhere('n.created_at <= :end', { end: endOfDay })
      .select('n.user_id')
      .getRawMany();

    const sentSet = new Set(existing.map((r) => r.user_id));

    for (const g of list) {
      if (!g.userId || sentSet.has(g.userId)) continue;
      const item = await this.gorevRepo.findOne({
        where: { id: g.id },
        relations: ['academicCalendarItem'],
      });
      const itemTitle = item?.academicCalendarItem?.title ?? 'Belirli Gün etkinliği';
      await this.notificationsService.createInboxEntry({
        user_id: g.userId,
        event_type: 'belirli_gun_hafta.reminder',
        entity_id: g.id,
        target_screen: 'akademik-takvim',
        title: 'Belirli Gün görevi hatırlatması',
        body: `"${itemTitle}" için göreviniz ${REMINDER_DAYS_BEFORE} gün sonra. Takvimi kontrol edin.`,
        metadata: { itemId: g.academicCalendarItemId, itemTitle },
      });
      sentSet.add(g.userId);
    }
  }
}
