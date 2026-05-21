/** Duyuru TV → TV ayarları sekmesi, izinli IP alanı */
export const TV_ALLOWED_IPS_HASH = 'tv-allowed-ips';

export function buildTvAllowedIpsSettingsHref(opts?: { schoolId?: string | null }): string {
  const q = new URLSearchParams({ tab: 'ayarlar' });
  if (opts?.schoolId?.trim()) q.set('school_id', opts.schoolId.trim());
  return `/tv?${q.toString()}#${TV_ALLOWED_IPS_HASH}`;
}
