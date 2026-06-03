export type DistributionMode = 'blocks' | 'spread' | 'compact';

export type DistributionPolicyDto = {
  mode: DistributionMode;
  enforce_pattern: boolean;
  relax_on_conflict: boolean;
};

export const DEFAULT_DISTRIBUTION_POLICY: DistributionPolicyDto = {
  mode: 'blocks',
  enforce_pattern: false,
  relax_on_conflict: true,
};

const MODE_LABELS: Record<DistributionMode, string> = {
  blocks: 'Blok öncelikli (2+2+1)',
  spread: 'Haftaya yay',
  compact: 'Yoğun (tek güne toplama)',
};

export function normalizeDistributionMode(raw: unknown): DistributionMode {
  if (raw === 'bilsa') return 'blocks';
  if (raw === 'blocks' || raw === 'spread' || raw === 'compact') return raw;
  return DEFAULT_DISTRIBUTION_POLICY.mode;
}

export function distributionModeLabel(mode: DistributionMode): string {
  return MODE_LABELS[mode];
}

export function distributionModeOptions(): Array<{ value: DistributionMode; label: string }> {
  return (['blocks', 'spread', 'compact'] as const).map((value) => ({
    value,
    label: MODE_LABELS[value],
  }));
}

export function distributionPolicySummary(p: DistributionPolicyDto): string {
  const parts = [distributionModeLabel(p.mode)];
  if (p.enforce_pattern) parts.push('desen zorunlu');
  if (p.relax_on_conflict) parts.push('çözülemeyince esnet');
  return parts.join(' · ');
}

export function parseDistributionPolicyDto(raw: unknown): DistributionPolicyDto {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_DISTRIBUTION_POLICY };
  const o = raw as Partial<DistributionPolicyDto>;
  return {
    mode: normalizeDistributionMode(o.mode),
    enforce_pattern: o.enforce_pattern === true,
    relax_on_conflict: o.relax_on_conflict !== false,
  };
}
