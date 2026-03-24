import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BilsemCalendarAssignment } from './entities/bilsem-calendar-assignment.entity';
import { BilsemCalendarItem } from './entities/bilsem-calendar-item.entity';
import { WorkCalendar } from '../work-calendar/entities/work-calendar.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';

const REMINDER_DAYS_BEFORE = 3;

function getTodayTurkey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BilsemCalendarReminderService {
  constructor(
    @InjectRepository(BilsemCalendarAssignment)
    private readonly assignmentRepo: Repository<BilsemCalendarAssignment>,
    @InjectRepository(BilsemCalendarItem)
    private readonly itemRepo: Repository<BilsemCalendarItem>,
    @InjectRepository(WorkCalendar)
    private readonly workCalendarRepo: Repository<WorkCalendar>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly notificationsService: NotificationsService,
  ) {}

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

    const weekIds = targetWeeks.map((w) => w.id);
    const items = await this.itemRepo.find({
      where: { weekId: In(weekIds), isActive: true },
    });
    const itemIds = items.map((i) => i.id);
    if (itemIds.length === 0) return;

    const gorevler = await this.assignmentRepo.find({
      where: { bilsemCalendarItemId: In(itemIds) },
      relations: ['bilsemCalendarItem'],
    });

    const startOfDay = new Date(today + 'T00:00:00Z');
    const endOfDay = new Date(today + 'T23:59:59Z');
    const existing = await this.notificationRepo
      .createQueryBuilder('n')
      .where('n.event_type = :type', { type: 'bilsem_calendar.reminder' })
      .andWhere('n.created_at >= :start', { start: startOfDay })
      .andWhere('n.created_at <= :end', { end: endOfDay })
      .select('n.user_id')
      .getRawMany();
    const sentSet = new Set(existing.map((r) => r.user_id));

    for (const g of gorevler) {
      if (!g.userId || sentSet.has(g.userId)) continue;
      const itemTitle = g.bilsemCalendarItem?.title ?? 'BİLSEM etkinliği';
      await this.notificationsService.createInboxEntry({
        user_id: g.userId,
        event_type: 'bilsem_calendar.reminder',
        entity_id: g.id,
        target_screen: 'bilsem/takvim',
        title: 'BİLSEM görevi hatırlatması',
        body: `"${itemTitle}" için göreviniz ${REMINDER_DAYS_BEFORE} gün sonra. Takvimi kontrol edin.`,
        metadata: { itemId: g.bilsemCalendarItemId, itemTitle },
      });
      sentSet.add(g.userId);
    }
  }
}
