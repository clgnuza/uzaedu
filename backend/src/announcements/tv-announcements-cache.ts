const TV_ANNOUNCEMENTS_CACHE_TTL_MS = 5 * 60 * 1000;
const tvAnnouncementsCache = new Map<string, { expires: number; payload: Record<string, unknown> }>();

export function pruneTvAnnouncementsCache() {
  const n = Date.now();
  for (const [k, v] of tvAnnouncementsCache.entries()) {
    if (v.expires <= n) tvAnnouncementsCache.delete(k);
  }
}

export function tvAnnouncementsCacheSet(key: string, payload: Record<string, unknown>) {
  pruneTvAnnouncementsCache();
  if (tvAnnouncementsCache.size > 800) tvAnnouncementsCache.clear();
  tvAnnouncementsCache.set(key, { expires: Date.now() + TV_ANNOUNCEMENTS_CACHE_TTL_MS, payload });
}

export function getTvAnnouncementsCacheEntry(key: string) {
  pruneTvAnnouncementsCache();
  return tvAnnouncementsCache.get(key);
}

/** Duyuru ekleme/güncelleme/silme sonrası bu okulun TV listesi önbelleğini boşalt. */
export function invalidateTvAnnouncementsCacheForSchool(schoolId: string) {
  const id = schoolId.trim();
  if (!id) return;
  for (const k of [...tvAnnouncementsCache.keys()]) {
    const parts = k.split('|');
    if (parts[1] === id) tvAnnouncementsCache.delete(k);
  }
}
