/** Haftalık ders dağıtım politikası (stüdyo ayarı — Kurallar sayfası). */

export type DistributionMode = 'blocks' | 'spread' | 'compact';

export type DistributionPolicy = {
  /** blocks/spread: günlere yay + blok (2+2); compact: tek güne toplama öncelikli */
  mode: DistributionMode;
  /** Açıksa atamadaki gün deseni üretimde zorunlu + skorda ceza */
  enforce_pattern: boolean;
  /** Açıksa çözülemeyince desen/min gün ihlalini raporlamayı yumuşatır */
  relax_on_conflict: boolean;
};

export const DEFAULT_DISTRIBUTION_POLICY: DistributionPolicy = {
  mode: 'blocks',
  enforce_pattern: false,
  relax_on_conflict: true,
};

function normalizeMode(raw: unknown): DistributionMode {
  if (raw === 'bilsa') return 'blocks';
  if (raw === 'blocks' || raw === 'spread' || raw === 'compact') return raw;
  return DEFAULT_DISTRIBUTION_POLICY.mode;
}

export function parseDistributionPolicy(raw: unknown): DistributionPolicy {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DISTRIBUTION_POLICY };
  const o = raw as Partial<DistributionPolicy>;
  return {
    mode: normalizeMode(o.mode),
    enforce_pattern: o.enforce_pattern === true,
    relax_on_conflict: o.relax_on_conflict !== false,
  };
}

export function shouldEnforceDistributionPattern(policy: DistributionPolicy | undefined): boolean {
  return !!policy?.enforce_pattern;
}

export function shouldReportDistributionViolations(policy: DistributionPolicy | undefined): boolean {
  if (!policy) return true;
  if (policy.relax_on_conflict && !policy.enforce_pattern) return false;
  return true;
}
