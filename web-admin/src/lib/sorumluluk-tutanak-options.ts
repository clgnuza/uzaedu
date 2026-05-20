export const TUTANAK_EVRAK_KEYS = [
  'zarf_evrak',
  'zarf_soru_cevap',
  'esaslar',
  'soru',
  'cevap',
  'sinav',
  'girmeyenler',
] as const;

export type TutanakEvrakKey = (typeof TUTANAK_EVRAK_KEYS)[number];
export type TutanakSessionFilter = 'all' | 'yazili' | 'uygulama';
export type SessionType = 'yazili' | 'uygulama' | 'mixed';

export const TUTANAK_EVRAK_LABELS: Record<TutanakEvrakKey, string> = {
  zarf_evrak: 'Sınav evrak zarf kapağı',
  zarf_soru_cevap: 'Soru-cevap kağıdı zarf kapağı',
  esaslar: 'Esaslar tespit / başlangıç tutanağı',
  soru: 'Yazılı sınav soru tutanağı',
  cevap: 'Cevap anahtarı tutanağı',
  sinav: 'Sınav tutanağı',
  girmeyenler: 'Sınava girmeyenler tutanağı',
};

export const TUTANAK_YAZILI_ONLY: TutanakEvrakKey[] = ['zarf_soru_cevap', 'soru', 'cevap'];

export const TUTANAK_SESSION_FILTER_LABELS: Record<TutanakSessionFilter, string> = {
  all: 'Tüm oturumlar',
  yazili: 'Yazılı oturumlar',
  uygulama: 'Uygulamalı oturumlar',
};

export function sessionTutanakMode(
  sessionType: SessionType | undefined,
  examType: 'sorumluluk' | 'beceri',
): 'yazili' | 'uygulama' {
  if (examType === 'beceri' || sessionType === 'uygulama') return 'uygulama';
  return 'yazili';
}

export function filterSessionsForTutanak<T extends { sessionType?: SessionType }>(
  sessions: T[],
  filter: TutanakSessionFilter,
  examType: 'sorumluluk' | 'beceri',
): T[] {
  if (filter === 'all') return sessions;
  return sessions.filter((s) => sessionTutanakMode(s.sessionType, examType) === filter);
}

export function countSessionsForFilter(
  sessions: Array<{ sessionType?: SessionType }>,
  filter: TutanakSessionFilter,
  examType: 'sorumluluk' | 'beceri',
): number {
  return filterSessionsForTutanak(sessions, filter, examType).length;
}

export function formatTutanakSessionLabel(s: {
  subjectName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  sessionType?: SessionType;
}): string {
  const date = s.sessionDate?.slice(0, 10) ?? '';
  const st = s.startTime?.slice(0, 5) ?? '';
  const et = s.endTime?.slice(0, 5) ?? '';
  const tag =
    s.sessionType === 'uygulama' ? ' · Uyg.' : s.sessionType === 'mixed' ? ' · Y+U' : '';
  return `${s.subjectName}${tag} — ${date} ${st}–${et}`;
}

/** schoolQ ile birleştirmek için başında ? olmadan */
export function buildTutanakPdfQuery(
  filter: TutanakSessionFilter,
  evrak: TutanakEvrakKey[],
  sessionIds?: string[],
): string {
  const qs = new URLSearchParams();
  if (filter !== 'all') qs.set('oturum', filter);
  if (evrak.length > 0 && evrak.length < TUTANAK_EVRAK_KEYS.length) {
    qs.set('evrak', evrak.join(','));
  }
  if (sessionIds?.length) qs.set('session_ids', sessionIds.join(','));
  return qs.toString();
}

export function appendApiQuery(schoolQ: string, extraQs: string): string {
  if (!extraQs) return schoolQ;
  const sep = schoolQ.includes('?') ? '&' : '?';
  return `${schoolQ}${sep}${extraQs}`;
}
