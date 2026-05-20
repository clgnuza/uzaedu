/** Okul programı satır anahtarı: eşleşen kullanıcı UUID veya eşleşmeyen öğretmen için raw:… */
export function timetableTeacherRowKey(e: { user_id?: string | null; teacher_name_raw?: string | null }): string {
  const u = e.user_id?.trim();
  if (u) return u;
  return `raw:${encodeURIComponent((e.teacher_name_raw ?? '').trim() || 'bilinmeyen')}`;
}

export function displayNameForTimetableRowKey(
  key: string,
  resolveUser: (userId: string) => string | undefined | null,
): string {
  if (key.startsWith('raw:')) {
    try {
      return `${decodeURIComponent(key.slice(4))} · eşleşmedi`;
    } catch {
      return key;
    }
  }
  const name = resolveUser(key)?.trim();
  return name || '—';
}

/** Gün görünümü sütun başlığı: soyad veya ham ad (eşleşmedi sonekine düşme) */
export function shortTeacherColumnLabel(
  key: string,
  resolveUser: (userId: string) => string | undefined | null,
): string {
  if (key.startsWith('raw:')) {
    try {
      const raw = decodeURIComponent(key.slice(4)).trim();
      if (!raw) return '—';
      const parts = raw.split(/\s+/).filter(Boolean);
      return parts[parts.length - 1] ?? raw;
    } catch {
      return '—';
    }
  }
  const name = resolveUser(key)?.trim();
  if (!name) return '—';
  const parts = name.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? name;
}
