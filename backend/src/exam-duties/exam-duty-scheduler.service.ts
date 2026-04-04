import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ExamDuty } from './entities/exam-duty.entity';
import { ExamDutiesService } from './exam-duties.service';
import { ExamDutySyncService } from './exam-duty-sync.service';
import type { ExamDutyNotificationReason } from './entities/exam-duty-notification-log.entity';
import { AppConfigService } from '../app-config/app-config.service';
import { getNowHHmmTurkey } from './exam-duty-turkey-time';

const TURKEY_TZ = 'Europe/Istanbul';

/** Türkiye saat diliminde bugünün YYYY-MM-DD */
function getTodayTurkey(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
}

/** Tarihe N gün ekle; sonuç YYYY-MM-DD (Europe/Istanbul takvim günü) */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
}

/** Date'in Turkey'deki YYYY-MM-DD */
function toDateStrTurkey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: TURKEY_TZ });
}

@Injectable()
export class ExamDutySchedulerService {
  private readonly logger = new Logger(ExamDutySchedulerService.name);

  constructor(
    @InjectRepository(ExamDuty)
    private readonly examDutyRepo: Repository<ExamDuty>,
    private readonly examDutiesService: ExamDutiesService,
    private readonly examDutySyncService: ExamDutySyncService,
    private readonly appConfig: AppConfigService,
  ) {}

  /**
   * Her dakika: app_config’teki İstanbul saatleriyle eşleşince RSS/scrape sınav görevi sync.
   * Saatler: Sınav görevi ayarları → Senkronizasyon → otomatik senkron zamanları.
   */
  @Cron('* * * * *')
  async runSyncJob() {
    try {
      const slots = await this.appConfig.getExamDutySyncScheduleTimes();
      const now = getNowHHmmTurkey();
      if (!slots.includes(now)) return;
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
    const nowTime = getNowHHmmTurkey();
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

  /**
   * Her saat başı (UTC): İstanbul’daki şu anki HH:mm, app_config’taki bildirim saatiyle eşleşince
   * son başvuru / onay / sınav±1 gün kutusu bildirimleri (Europe/Istanbul takvim günü).
   * Yayın bildirimi: publish() içinde anında (publish_now).
   */
  @Cron('0 * * * *')
  async runScheduledNotifications() {
    const today = getTodayTurkey();
    const tomorrow = addDays(today, 1);
    const yesterday = addDays(today, -1);
    const times = await this.appConfig.getExamDutyNotificationTimes();
    const nowTime = getNowHHmmTurkey();

    const published = await this.examDutyRepo.find({
      where: { status: 'published', deletedAt: IsNull() },
    });

    for (const duty of published) {
      if (nowTime === times.deadline) {
        await this.trySendForReason(duty, 'deadline', () => {
          if (!duty.applicationEnd) return false;
          return toDateStrTurkey(duty.applicationEnd) === today;
        });
      }
      if (nowTime === times.approval_day) {
        await this.trySendForReason(duty, 'approval_day', () => {
          if (!duty.applicationApprovalEnd) return false;
          return toDateStrTurkey(duty.applicationApprovalEnd) === today;
        });
      }
      const firstExam = duty.examDate ?? duty.examDateEnd;
      const lastExam = duty.examDateEnd ?? duty.examDate;
      if (nowTime === times.exam_minus_1d) {
        await this.trySendForReason(duty, 'exam_minus_1d', () => {
          if (!firstExam) return false;
          return toDateStrTurkey(firstExam) === tomorrow;
        });
      }
      if (nowTime === times.exam_plus_1d) {
        await this.trySendForReason(duty, 'exam_plus_1d', () => {
          if (!lastExam) return false;
          return toDateStrTurkey(lastExam) === yesterday;
        });
      }
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
