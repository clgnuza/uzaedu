/** Backend `duty_log.action` değerleri için okul yöneticisine yönelik Türkçe kısa adlar */

export const DUTY_LOG_ACTION_LABELS: Record<string, string> = {
  reassign: 'Nöbet yerine atama',
  absent_marked: 'Devamsızlık işaretlendi',
  coverage_assigned: 'Boş ders saatine görev verildi',
  duty_exempt_set: 'Nöbetten muaf tutuldu',
  duty_exempt_cleared: 'Nöbet muafiyeti kaldırıldı',
  publish: 'Plan yayınlandı',
  slot_edit: 'Nöbet kaydı güncellendi',
  slot_add: 'Nöbet kaydı eklendi',
  slot_delete: 'Nöbet kaydı silindi',
};

/** Uzun açıklama (sayfa altı / terimler) */
export const DUTY_LOG_ACTION_HINTS: Record<string, string> = {
  reassign:
    'O günkü nöbet satırında nöbetçi öğretmen değiştirildi (yerine başka öğretmen atandı).',
  absent_marked:
    'Nöbetçi öğretmen gelmedi / izinli vb. olarak işaretlendi; gerekirse ders görevleri açılır.',
  coverage_assigned:
    'Gelmeyen öğretmenin ders saatine hangi öğretmenin gireceği atandı (boş ders görevi).',
  duty_exempt_set: 'Öğretmen nöbet listesinde muaf olarak işaretlendi.',
  duty_exempt_cleared: 'Öğretmenin nöbet muafiyeti kaldırıldı.',
  publish: 'Nöbet planı öğretmenlere açıldı.',
  slot_edit: 'Tarih, alan, nöbetçi veya saat bilgisi değiştirildi.',
  slot_add: 'Plana yeni bir nöbet satırı eklendi.',
  slot_delete: 'Plandan bir nöbet satırı silindi.',
};

export type DutyLogUserRef = { display_name: string | null; email: string } | null | undefined;

export function formatDutyLogUserName(u: DutyLogUserRef): string | null {
  const n = u?.display_name?.trim();
  if (n) return n;
  if (u?.email) return u.email;
  return null;
}

export function getDutyLogActionLabel(action: string): string {
  return DUTY_LOG_ACTION_LABELS[action] ?? 'Diğer işlem';
}

export function getDutyLogDetailLine(log: {
  action: string;
  oldUser?: DutyLogUserRef;
  newUser?: DutyLogUserRef;
}): string | null {
  if (log.action === 'reassign' && (log.oldUser || log.newUser)) {
    return `${formatDutyLogUserName(log.oldUser) ?? '—'} → ${formatDutyLogUserName(log.newUser) ?? '—'}`;
  }
  if (log.action === 'absent_marked' && formatDutyLogUserName(log.oldUser)) {
    return formatDutyLogUserName(log.oldUser);
  }
  if (log.action === 'coverage_assigned' && (log.oldUser || log.newUser)) {
    const a = formatDutyLogUserName(log.oldUser);
    const b = formatDutyLogUserName(log.newUser);
    if (a && b) return `${a} → ${b}`;
    return a || b || null;
  }
  return null;
}
