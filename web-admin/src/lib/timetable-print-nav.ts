export type ProgramPrintView = 'class' | 'teacher' | 'room';

/** Raporlar → program editörü yazdırma (haftalık tek satır ızgara). */
export function buildProgramPrintUrl(
  programId: string,
  view: ProgramPrintView,
  filterId?: string,
): string {
  const q = new URLSearchParams({ id: programId, view, print: '1' });
  if (filterId?.trim()) q.set('filter', filterId.trim());
  return `/ders-dagit/studyo/program?${q.toString()}`;
}
