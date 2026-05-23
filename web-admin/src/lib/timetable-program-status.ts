export const PROGRAM_STATUS_TR: Record<string, string> = {
  draft: 'Taslak',
  generated: 'Üretildi',
  council_review: 'Kurul incelemesi',
  published: 'Yayında',
};

export function programStatusLabel(status: string): string {
  return PROGRAM_STATUS_TR[status] ?? status;
}
