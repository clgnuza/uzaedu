import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ContentSyncService } from './content-sync.service';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class ContentSchedulerService {
  private readonly logger = new Logger(ContentSchedulerService.name);
  private running = false;

  constructor(
    private readonly syncService: ContentSyncService,
    private readonly appConfig: AppConfigService,
  ) {}

  /** Her 5 dakikada kontrol: otomatik senkron açıksa ve aralık dolduysa çalıştır */
  @Cron('*/5 * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    const schedule = await this.appConfig.getContentSyncSchedule();
    if (!schedule.enabled) return;
    const status = await this.appConfig.getContentSyncStatus();
    const last = status.last_run_at ? new Date(status.last_run_at).getTime() : 0;
    const intervalMs = schedule.interval_minutes * 60 * 1000;
    const now = Date.now();
    if (last > 0 && now - last < intervalMs) return;

    this.running = true;
    try {
      const result = await this.syncService.runSync();
      await this.appConfig.recordContentSyncResult(result, 'cron');
      if (result.total_created > 0) {
        this.logger.log(`[ContentSync] cron: ${result.total_created} yeni içerik.`);
      }
    } catch (e) {
      this.logger.error('[ContentSync] cron hata', e);
      await this.appConfig.recordContentSyncFailure(e, 'cron');
    } finally {
      this.running = false;
    }
  }
}
