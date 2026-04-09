import { getApiUrl } from '@/lib/api';
import type { WebPublicConfig } from '@/components/web-settings/web-public-panel';

let inflight: Promise<Partial<WebPublicConfig> | null> | null = null;

/** Header + footer aynı anda tek GET (inflight paylaşımı). Önbellek yok — route değişiminde taze veri. */
export function fetchWebPublicPartial(): Promise<Partial<WebPublicConfig> | null> {
  if (inflight) return inflight;
  inflight = fetch(getApiUrl('/content/web-public'), { cache: 'no-store', credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
