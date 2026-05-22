import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MessagingCampaign } from './entities/messaging-campaign.entity';
import { MessagingService } from './messaging.service';
import { MessagingSchoolNeedsService } from './messaging-school-needs.service';

@Injectable()
export class MessagingSchedulerService {
  private readonly logger = new Logger(MessagingSchedulerService.name);

  constructor(
    @InjectRepository(MessagingCampaign)
    private readonly campaignRepo: Repository<MessagingCampaign>,
    private readonly messaging: MessagingService,
    private readonly schoolNeeds: MessagingSchoolNeedsService,
  ) {}

  /** Dakikada bir — zamanı gelen kampanyaları gönderir */
  @Cron('*/1 * * * *', { timeZone: 'Europe/Istanbul' })
  async processScheduledCampaigns(): Promise<void> {
    const now = new Date();
    const due = await this.campaignRepo
      .createQueryBuilder('c')
      .where('c.scheduled_at IS NOT NULL')
      .andWhere('c.scheduled_at <= :now', { now })
      .andWhere("c.status = 'preview'")
      .andWhere("c.approval_status IN ('none', 'approved')")
      .take(5)
      .getMany();
    for (const c of due) {
      if (c.approvalStatus === 'rejected') continue;
      try {
        const channel =
          (c.metadata?.channel as 'whatsapp' | 'sms' | undefined) ?? 'whatsapp';
        await this.messaging.executeScheduledCampaign(c.schoolId, c.id, channel);
        c.scheduledAt = null;
        await this.campaignRepo.save(c);
        this.logger.log(`Zamanlanmış kampanya başlatıldı: ${c.id}`);
      } catch (e) {
        this.logger.warn(`Zamanlanmış kampanya ${c.id}: ${String(e)}`);
      }
    }
  }

  /** Hafta içi 07:00 — E-Okul yükleme hatırlatması */
  @Cron('0 7 * * 1-5', { timeZone: 'Europe/Istanbul' })
  async eokulReminders(): Promise<void> {
    await this.schoolNeeds.runAllSchoolAutomations('eokul');
  }

  /** Hafta içi 08:00 — dünkü devamsızlık önizlemesini otomatik gönder */
  @Cron('0 8 * * 1-5', { timeZone: 'Europe/Istanbul' })
  async morningDevamsizlik(): Promise<void> {
    await this.schoolNeeds.runAllSchoolAutomations('morning');
  }

  /** Pazartesi 09:00 — haftalık müdür özeti (gelin kutusu) */
  @Cron('0 9 * * 1', { timeZone: 'Europe/Istanbul' })
  async weeklyPrincipalReports(): Promise<void> {
    await this.schoolNeeds.runAllSchoolAutomations('weekly');
  }
}
