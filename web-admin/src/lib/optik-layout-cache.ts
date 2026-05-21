import type { OmrScanLayout } from '@/lib/optik-api';
import { isCurrentOmrLayout, OMR_LAYOUT_VERSION } from '@/lib/optik-omr-layout-constants';

const mem = new Map<string, OmrScanLayout>();

export function getCachedScanLayout(templateId: string): OmrScanLayout | null {
  const m = mem.get(templateId);
  return m && isCurrentOmrLayout(m) ? m : null;
}

export function setCachedScanLayout(templateId: string, layout: OmrScanLayout) {
  if (!isCurrentOmrLayout(layout)) return;
  mem.set(templateId, layout);
  try {
    sessionStorage.setItem(`optik_layout_${templateId}`, JSON.stringify(layout));
    sessionStorage.setItem('optik_layout_version', OMR_LAYOUT_VERSION);
  } catch {
    /* quota */
  }
}

export function loadCachedScanLayout(templateId: string): OmrScanLayout | null {
  const m = mem.get(templateId);
  if (m && isCurrentOmrLayout(m)) return m;

  try {
    const ver = sessionStorage.getItem('optik_layout_version');
    if (ver && ver !== OMR_LAYOUT_VERSION) {
      clearAllOptikLayoutCache();
      return null;
    }
    const raw = sessionStorage.getItem(`optik_layout_${templateId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OmrScanLayout;
    if (isCurrentOmrLayout(parsed)) {
      mem.set(templateId, parsed);
      return parsed;
    }
    sessionStorage.removeItem(`optik_layout_${templateId}`);
  } catch {
    /* ignore */
  }
  return null;
}

export function clearCachedScanLayout(templateId: string) {
  mem.delete(templateId);
  try {
    sessionStorage.removeItem(`optik_layout_${templateId}`);
  } catch {
    /* ignore */
  }
}

/** omr-v3 vb. eski önbelleği temizle */
export function clearAllOptikLayoutCache() {
  mem.clear();
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('optik_layout_')) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
    sessionStorage.removeItem('optik_layout_version');
  } catch {
    /* ignore */
  }
}
