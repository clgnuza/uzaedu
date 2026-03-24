import type { LegalPagesConfig } from '@/components/web-settings/legal-pages-types';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

export async function fetchLegalPagesPublic(): Promise<LegalPagesConfig | null> {
  let revalidate = 120;
  try {
    const ex = await fetchWebExtrasPublic();
    if (ex?.cache_ttl_legal_pages != null && Number.isFinite(ex.cache_ttl_legal_pages)) {
      revalidate = Math.max(10, Math.min(86400, Math.round(ex.cache_ttl_legal_pages)));
    }
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(`${API_BASE.replace(/\/$/, '')}/content/legal-pages`, {
      next: { revalidate },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
