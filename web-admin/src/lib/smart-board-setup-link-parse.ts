/** Okul kurulum linki veya düz kod → school_code */
export function parseClassroomSetupLink(raw: string): { setupCode: string } | null {
  const t = raw.trim();
  if (!t) return null;

  if (/^[A-Z0-9]{4,12}$/i.test(t.replace(/\s/g, ''))) {
    return { setupCode: t.replace(/\s/g, '').toUpperCase() };
  }

  try {
    const url = t.includes('://')
      ? new URL(t)
      : new URL(t.startsWith('/') ? t : `/${t}`, 'https://panel.local');
    const fromQuery = (url.searchParams.get('school_code') ?? '').trim().toUpperCase();
    if (fromQuery) return { setupCode: fromQuery };
    const m = url.pathname.match(/school_code[=/]([A-Z0-9]{4,12})/i);
    if (m?.[1]) return { setupCode: m[1].toUpperCase() };
  } catch {
    /* ignore */
  }
  return null;
}

export function buildPardusKurulumPageUrl(origin: string, setupCode?: string): string {
  const base = `${origin.replace(/\/$/, '')}/tv/pardus-kurulum`;
  if (!setupCode?.trim()) return base;
  return `${base}?kod=${encodeURIComponent(setupCode.trim().toUpperCase())}`;
}
