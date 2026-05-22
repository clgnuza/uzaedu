import { resolveDefaultApiBase } from './resolve-api-base';

export async function downloadDersDagitExport(
  token: string,
  studioId: string,
  programId: string,
  kind: 'csv' | 'eokul' | 'eokul_xlsx' | 'eokul_report' | 'pdf' | 'council_pdf' | 'parent_pdf' | 'xlsx',
  section?: string,
) {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const path =
    kind === 'eokul'
      ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/eokul`
      : kind === 'eokul_xlsx'
        ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/eokul.xlsx`
        : kind === 'eokul_report'
          ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/eokul/report.csv`
          : kind === 'council_pdf'
            ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/council.pdf`
            : kind === 'parent_pdf'
              ? `/ders-dagit/studios/${studioId}/programs/${programId}/export/parent.pdf?section=${encodeURIComponent(section ?? '5A')}`
              : kind === 'pdf'
                ? `/ders-dagit/studios/${studioId}/programs/${programId}/export.pdf`
                : kind === 'xlsx'
                  ? `/ders-dagit/studios/${studioId}/programs/${programId}/export.xlsx`
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
      : kind === 'eokul_xlsx'
        ? `eokul-ders-dagit-${programId.slice(0, 8)}.xlsx`
        : kind === 'eokul_report'
          ? `eokul-rapor-${programId.slice(0, 8)}.csv`
          : kind === 'council_pdf'
            ? `kurul-${programId.slice(0, 8)}.pdf`
            : kind === 'parent_pdf'
              ? `veli-${(section ?? 'sinif').slice(0, 12)}.pdf`
              : kind === 'pdf'
                ? `ders-dagit-${programId.slice(0, 8)}.pdf`
                : kind === 'xlsx'
                  ? `ders-dagit-${programId.slice(0, 8)}.xlsx`
                  : `ders-dagit-${programId.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
