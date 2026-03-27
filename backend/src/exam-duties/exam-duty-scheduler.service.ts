import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ExamDuty } from './entities/exam-duty.entity';
import { ExamDutiesService } from './exam-duties.service';
import { ExamDutySyncService } from './exam-duty-sync.service';
import type { ExamDutyNotificationReason } from './entities/exam-duty-notification-log.entity';

const TURKEY_TZ = 'Europe/Istanbul';

/** Türkiye saat diliminde bugünün YYYY-MM-DD */
function getTodayTurkey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
}

/** Tarihe N gün ekle (Turkey) */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
}

/** Date'in Turkey'deki YYYY-MM-DD */
function toDateStrTurkey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
}

/** Turkey saat diliminde şu anki HH:mm (24 saat) */
function getCurrentTimeTurkey(): string {
  const s = new Date().toLocaleTimeString('en-GB', { timeZone: TURKEY_TZ, hour: '2-digit', minute: '2-digit', hour12: false });
  return s;
}

@Injectable()
export class ExamDutySchedulerService {
  private readonly logger = new Logger(ExamDutySchedulerService.name);

  constructor(
    @InjectRepository(ExamDuty)
    private readonly examDutyRepo: Repository<ExamDuty>,
    private readonly examDutiesService: ExamDutiesService,
    private readonly examDutySyncService: ExamDutySyncService,
  ) {}

  /** Günde 4 kez (06, 10, 14, 18 UTC ≈ 09, 13, 17, 21 Turkey) – RSS/scrape sınav görevi sync */
  @Cron('0 6,10,14,18 * * *')
  async runSyncJob() {
    try {
      const result = await this.examDutySyncService.runSync();
      if (result.total_created > 0) {
        console.log(`[ExamDutySync] ${result.total_created} yeni duyuru eklendi.`);
      }
    } catch (e) {
      console.error('[ExamDutySync] Hata:', e);
    }
  }

  /** Her dakika 03:00–10:59 UTC ≈ 06:00–13:59 Turkey – tercih edilen HH:mm ile eşleşen sabah hatırlatması */
  @Cron('*/1 3-10 * * *')
  async runExamDayMorningNotifications() {
    const today = getTodayTurkey();
    const nowTime = getCurrentTimeTurkey();
    const published = await this.examDutyRepo.find({
      where: { status: 'published', deletedAt: IsNull() },
    });
    for (const duty of published) {
      const first = duty.examDate ?? duty.examDateEnd;
      const last = duty.examDateEnd ?? duty.examDate;
      if (!first || !last) continue;
      const firstStr = toDateStrTurkey(first);
      const lastStr = toDateStrTurkey(last);
      if (today < firstStr || today > lastStr) continue;
      try {
        const { sent } = await this.examDutiesService.sendNotificationsForExamDayMorning(duty, today, nowTime);
        if (sent > 0) console.log(`[ExamDuty] exam_day_morning ${duty.id}: ${sent} bildirim (saat ${nowTime}).`);
      } catch (e) {
        console.error('[ExamDutyScheduler] exam_day_morning:', e);
      }
    }
  }

  /** Her gün 06:00 ve 12:00 UTC ≈ 09:00 ve 15:00 Turkey – planlanmış bildirimleri gönder (alreadySent ile tekrar gönderilmez) */
  @Cron('0 6,12 * * *')
  async runScheduledNotifications() {
    const today = getTodayTurkey();
    const tomorrow = addDays(today, 1);
    const yesterday = addDays(today, -1);

    const published = await this.examDutyRepo.find({
      where: { status: 'published', deletedAt: IsNull() },
    });

    for (const duty of published) {
      await this.trySendForReason(duty, 'apply_start', () => {
        if (!duty.applicationStart) return false;
        return toDateStrTurkey(duty.applicationStart) === today;
      });
      await this.trySendForReason(duty, 'deadline', () => {
        if (!duty.applicationEnd) return false;
        return toDateStrTurkey(duty.applicationEnd) === today;
      });
      await this.trySendForReason(duty, 'approval_day', () => {
        if (!duty.applicationApprovalEnd) return false;
        return toDateStrTurkey(duty.applicationApprovalEnd) === today;
      });
      // Sınav öncesi: ilk oturumdan -1 gün. Sınav sonrası: son oturumdan +1 gün.
      const firstExam = duty.examDate ?? duty.examDateEnd;
      const lastExam = duty.examDateEnd ?? duty.examDate;
      await this.trySendForReason(duty, 'exam_minus_1d', () => {
        if (!firstExam) return false;
        return toDateStrTurkey(firstExam) === tomorrow;
      });
      await this.trySendForReason(duty, 'exam_plus_1d', () => {
        if (!lastExam) return false;
        return toDateStrTurkey(lastExam) === yesterday;
      });
    }
  }

  private async trySendForReason(
    duty: ExamDuty,
    reason: ExamDutyNotificationReason,
    shouldSend: () => boolean,
  ): Promise<void> {
    if (!shouldSend()) return;
    try {
      const { sent } = await this.examDutiesService.sendNotificationsForReason(duty, reason);
      if (sent > 0) this.logger.log(`${reason} ${duty.id}: ${sent} bildirim gönderildi`);
    } catch (e) {
      this.logger.error(`${reason} for ${duty.id}:`, e);
    }
  }
}
