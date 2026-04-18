import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { DutySlot } from './entities/duty-slot.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';

/** Türkiye saat diliminde bugünün YYYY-MM-DD */
function getTodayTurkey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
}

/** TSİ şu anki HH:mm (örn. 07:05) */
function getNowTurkeyHHmm(): string {
  const s = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Istanbul' });
  return s.slice(11, 16);
}

@Injectable()
export class DutyReminderService {
  constructor(
    @InjectRepository(DutySlot)
    private readonly slotRepo: Repository<DutySlot>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Her dakika TSİ — seçilen saatte hatırlatması açık ve o gün nöbeti olan öğretmen / okul yöneticisi.
   * (Eski tek sabit 07:00 davranışı: duty_reminder_enabled=true ve duty_reminder_time_tr=07:00)
   */
  @Cron('*/1 * * * *', { timeZone: 'Europe/Istanbul' })
  async sendDutyReminderTick() {
    const today = getTodayTurkey();
    const hm = getNowTurkeyHHmm();

    const slots = await this.slotRepo
      .createQueryBuilder('s')
      .innerJoin('s.duty_plan', 'p')
      .where('p.status = :status', { status: 'published' })
      .andWhere('p.deleted_at IS NULL')
      .andWhere('p.archived_at IS NULL')
      .andWhere('s.deleted_at IS NULL')
      .andWhere('s.date = :date', { date: today })
      .andWhere('s.user_id IS NOT NULL')
      .select('s.user_id')
      .getMany();

    const slotUserIds = [...new Set(slots.map((s) => s.user_id).filter(Boolean))] as string[];
    if (slotUserIds.length === 0) return;

    const prefs = await this.userRepo.find({
      where: { id: In(slotUserIds) },
      select: ['id', 'role', 'dutyReminderEnabled', 'dutyReminderTimeTr'],
    });
    const prefById = new Map(prefs.map((u) => [u.id, u]));

    const eligible: string[] = [];
    for (const uid of slotUserIds) {
      const u = prefById.get(uid);
      if (!u) continue;
      if (u.role !== UserRole.teacher && u.role !== UserRole.school_admin) continue;
      if (u.dutyReminderEnabled === false) continue;
      const t = (u.dutyReminderTimeTr ?? '07:00').trim();
      if (t !== hm) continue;
      eligible.push(uid);
    }
    if (eligible.length === 0) return;

    const startOfDay = new Date(today + 'T00:00:00Z');
    const endOfDay = new Date(today + 'T23:59:59Z');
    const existing = await this.notificationRepo.find({
      where: { event_type: 'duty.reminder', created_at: Between(startOfDay, endOfDay) },
      select: ['user_id'],
    });
    const sentSet = new Set(existing.map((n) => n.user_id));
    for (const uid of eligible) {
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
