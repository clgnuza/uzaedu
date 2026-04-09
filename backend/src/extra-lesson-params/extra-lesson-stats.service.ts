import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

/** Canlı kullanıcı TTL (ms) – bu sürede heartbeat gelmezse "çevrimdışı" sayılır */
const PRESENCE_TTL_MS = 90_000;

/** Periyodik temizlik aralığı */
const CLEANUP_INTERVAL_MS = 30_000;

export type ExtraLessonStats = {
  live_users: number;
  /** Benzersiz kullanıcı (oturum) sayısı — aynı kişinin tekrarlayan işlemleri sayılmaz */
  total_calculations: number;
};

@Injectable()
export class ExtraLessonStatsService implements OnModuleInit, OnModuleDestroy {
  /** kullanıcı anahtarı (user.id veya session_id) -> son heartbeat timestamp */
  private presence = new Map<string, number>();
  /** En az bir kez hesaplama yapmış benzersiz anahtarlar */
  private calculationUsers = new Set<string>();
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
      total_calculations: this.calculationUsers.size,
    };
  }

  heartbeat(userKey: string): void {
    if (!userKey || userKey.length > 128) return;
    this.presence.set(userKey, Date.now());
  }

  recordCalculation(userKey: string): void {
    if (!userKey || userKey.length > 128) return;
    this.calculationUsers.add(userKey);
  }
}
