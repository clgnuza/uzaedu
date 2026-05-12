import { getApiUrl } from '@/lib/api';

export async function downloadYollukPdf(id: string): Promise<void> {
  const url = getApiUrl(`/yolluk/calculations/${id}/pdf`);
  const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(j.message || res.statusText || 'PDF alınamadı');
  }
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `yolluk-rapor-${id.slice(0, 8)}.pdf`;
  a.click();
  URL.revokeObjectURL(a.href);
}
