import { sortClassSections } from './class-section-sort';

/** null / eksik = programdaki tüm şubeler paylaşılabilir */
export type ProgramShareSettings = {
  enabled_sections?: string[] | null;
};

export function parseProgramShareSettings(raw: unknown): ProgramShareSettings {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  if (o.enabled_sections === null) return { enabled_sections: null };
  if (!Array.isArray(o.enabled_sections)) return {};
  return {
    enabled_sections: [...new Set(o.enabled_sections.map((s) => String(s).trim()).filter(Boolean))],
  };
}

export function resolveShareEnabledSections(
  allSections: string[],
  settings: ProgramShareSettings | null | undefined,
): string[] {
  const sorted = sortClassSections(allSections);
  const enabled = settings?.enabled_sections;
  if (enabled == null) return sorted;
  const set = new Set(enabled);
  return sorted.filter((s) => set.has(s));
}

export function isSectionShareEnabled(
  section: string,
  allSections: string[],
  settings: ProgramShareSettings | null | undefined,
): boolean {
  return resolveShareEnabledSections(allSections, settings).includes(section.trim());
}
