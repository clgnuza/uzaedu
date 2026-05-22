import { resolveDefaultApiBase } from './resolve-api-base';

export async function downloadDersDagitExport(
  token: string,
  studioId: string,
  programId: string,
  kind: 'csv' | 'eokul' | 'pdf',
) {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const path =
    kind === 'eokul'
      ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/eokul`
      : kind === 'pdf'
        ? `/ders-dagit/studios/${studioId}/programs/${programId}/export.pdf`
        : `/ders-dagit/studios/${studioId}/programs/${programId}/export.csv`;
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `İndirme başarısız (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download =
    kind === 'eokul'
      ? `eokul-ders-dagit-${programId.slice(0, 8)}.csv`
      : kind === 'pdf'
        ? `ders-dagit-${programId.slice(0, 8)}.pdf`
        : `ders-dagit-${programId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
