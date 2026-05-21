import type { OmrScanLayout } from '@/lib/optik-api';

const mem = new Map<string, OmrScanLayout>();

export function getCachedScanLayout(templateId: string): OmrScanLayout | null {
  return mem.get(templateId) ?? null;
}

export function setCachedScanLayout(templateId: string, layout: OmrScanLayout) {
  mem.set(templateId, layout);
  try {
    sessionStorage.setItem(`optik_layout_${templateId}`, JSON.stringify(layout));
  } catch {
    /* quota */
  }
}

export function loadCachedScanLayout(templateId: string): OmrScanLayout | null {
  const m = mem.get(templateId);
  if (m) return m;
  try {
    const raw = sessionStorage.getItem(`optik_layout_${templateId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OmrScanLayout;
    if (parsed?.bubbles?.length) {
      mem.set(templateId, parsed);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}
