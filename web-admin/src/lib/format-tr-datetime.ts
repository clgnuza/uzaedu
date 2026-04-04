/** tr-TR tarih+saat. `dateStyle`/`timeStyle` birlikte bazı motorlarda (ör. Firefox) RangeError verir. */
export function formatTrDateTimeMedium(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
