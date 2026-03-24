/** Hoşgeldin / günlük motive mesajı — tek JSON (welcome_module_config). */
export type WelcomeModuleConfig = {
  enabled: boolean;
  /** Takvim anahtarı MM-DD (örn. 03-24), Türkiye saati. */
  by_day: Record<string, string>;
  /** O gün için özel mesaj yoksa */
  fallback_message: string | null;
  /** GET /content/welcome-today Cache-Control max-age (sn) */
  cache_ttl_welcome: number;
};

export const DEFAULT_WELCOME_MODULE: WelcomeModuleConfig = {
  enabled: false,
  by_day: {},
  fallback_message: null,
  cache_ttl_welcome: 120,
};

const MM_DD = /^\d{2}-\d{2}$/;

/** Geçerli takvim günü mü (şubat 29 dahil). */
export function isValidMmDdKey(key: string): boolean {
  if (!MM_DD.test(key)) return false;
  const [sm, sd] = key.split('-').map((x) => parseInt(x, 10));
  if (sm < 1 || sm > 12) return false;
  const dt = new Date(2024, sm - 1, sd);
  return dt.getMonth() === sm - 1 && dt.getDate() === sd;
}

/** HTML kaldırır; satır sonları ve emoji/Unicode korunur (tek satıra zorlamaz). */
export function sanitizeWelcomePlainText(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  let s = String(raw).replace(/<[^>]*>/g, '');
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  s = s.replace(/\n{4,}/g, '\n\n\n');
  return s.trim().slice(0, 2000);
}
