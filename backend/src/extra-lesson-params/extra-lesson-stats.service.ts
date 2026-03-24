import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/** Canlı kullanıcı TTL (ms) – bu sürede heartbeat gelmezse "çevrimdışı" sayılır */
const PRESENCE_TTL_MS = 90_000;

/** Periyodik temizlik aralığı */
const CLEANUP_INTERVAL_MS = 30_000;

export type ExtraLessonStats = {
  live_users: number;
  total_calculations: number;
};

@Injectable()
export class ExtraLessonStatsService implements OnModuleInit, OnModuleDestroy {
  /** session_id -> son heartbeat timestamp */
  private presence = new Map<string, number>();
  private totalCalculations = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  onModuleInit() {
    this.cleanupTimer = setInterval(() => this.cleanup(), CLEANUP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  private cleanup() {
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    for (const [sid, ts] of this.presence.entries()) {
      if (ts < cutoff) this.presence.delete(sid);
    }
  }

  getStats(): ExtraLessonStats {
    this.cleanup();
    return {
      live_users: this.presence.size,
      total_calculations: this.totalCalculations,
    };
  }

  heartbeat(sessionId: string): void {
    if (!sessionId || sessionId.length > 128) return;
    this.presence.set(sessionId, Date.now());
  }

  recordCalculation(): void {
    this.totalCalculations += 1;
  }
}
