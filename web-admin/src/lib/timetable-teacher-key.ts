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
