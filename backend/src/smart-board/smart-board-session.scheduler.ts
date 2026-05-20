import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SmartBoardService } from './smart-board.service';

@Injectable()
export class SmartBoardSessionScheduler {
  private readonly logger = new Logger(SmartBoardSessionScheduler.name);

  constructor(private readonly smartBoardService: SmartBoardService) {}

  @Cron('*/1 * * * *')
  async disconnectStaleSessions(): Promise<void> {
    try {
      const { closed } = await this.smartBoardService.disconnectStaleSessionsJob();
      if (closed > 0) {
        this.logger.log(`Stale smart-board sessions closed: ${closed}`);
      }
    } catch (e) {
      this.logger.warn(`Stale session job failed: ${e instanceof Error ? e.message : e}`);
    }
  }
}
