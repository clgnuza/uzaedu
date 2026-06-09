import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UploadService } from './upload.service';

/** Evrak üretiminde R2'ye yazılan geçici dosyalar (signed URL 1 saat). */
const EPHEMERAL_PREFIXES = ['generated/'] as const;

@Injectable()
export class GeneratedFilesCleanupScheduler {
  private readonly logger = new Logger(GeneratedFilesCleanupScheduler.name);
  private running = false;

  constructor(private readonly uploadService: UploadService) {}

  @Cron('0 3 * * *', { timeZone: 'Europe/Istanbul' })
  async purgeEphemeralGenerated(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const ttlHours = Number(process.env.R2_EPHEMERAL_TTL_HOURS ?? 48);
      const maxAgeMs = (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 48) * 60 * 60 * 1000;
      let totalDeleted = 0;
      let totalScanned = 0;
      for (const prefix of EPHEMERAL_PREFIXES) {
        const { deleted, scanned } = await this.uploadService.purgeObjectsOlderThan(prefix, maxAgeMs);
        totalDeleted += deleted;
        totalScanned += scanned;
      }
      if (totalDeleted > 0) {
        this.logger.log(`R2 ephemeral purge: deleted=${totalDeleted} scanned=${totalScanned} ttlHours=${ttlHours}`);
      }
    } catch (e) {
      this.logger.warn(`R2 ephemeral purge failed: ${e instanceof Error ? e.message : e}`);
    } finally {
      this.running = false;
    }
  }
}
