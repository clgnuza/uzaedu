/** Denetim kaydı eylemlerini Türkçe etiketlere çevirir. */

const ACTION_LABELS: Record<string, string> = {
  'program.entry.patched': 'Ders saati değiştirildi',
  'program.entry.created': 'Yeni ders eklendi',
  'program.entry.deleted': 'Ders silindi',
  'program.entries.swapped': 'İki ders takas edildi',
  'program.published': 'Okula yayınlandı',
  'program.cloned': 'Program kopyalandı',
  'program.archived': 'Arşive alındı',
  'program.unarchived': 'Arşivden çıkarıldı',
  'program.updated': 'Program güncellendi',
  'program.deleted': 'Program silindi',
  'programs.generated': 'Otomatik üretim',
};

export function formatAuditAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  const tail = action.includes('.') ? action.split('.').pop()! : action;
  const tailMap: Record<string, string> = {
    patched: 'Güncellendi',
    created: 'Oluşturuldu',
    deleted: 'Silindi',
    swapped: 'Takas',
    published: 'Yayın',
    generated: 'Üretim',
  };
  return tailMap[tail] ?? action.replace(/\./g, ' · ');
}

export function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60_000) return 'Az önce';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} dk önce`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} sa önce`;
  return d.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function auditMatchesProgram(
  row: { action: string; detail?: Record<string, unknown> },
  programId: string,
): boolean {
  if (!programId) return false;
  const d = row.detail ?? {};
  const pid = d.program_id ?? d.from ?? d.to;
  if (typeof pid === 'string' && pid === programId) return true;
  if (row.action.startsWith('program.') && !row.action.startsWith('programs.')) return true;
  return false;
}
