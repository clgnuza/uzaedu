import { SorumlulukGroup } from './entities/sorumluluk-group.entity';
import { SorumlulukSession } from './entities/sorumluluk-session.entity';

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

export const TUTANAK_EVRAK_LABELS: Record<TutanakEvrakKey, string> = {
  zarf_evrak: 'Sınav evrak zarf kapağı',
  zarf_soru_cevap: 'Soru-cevap kağıdı zarf kapağı',
  esaslar: 'Esaslar tespit / başlangıç tutanağı',
  soru: 'Yazılı sınav soru tutanağı',
  cevap: 'Cevap anahtarı tutanağı',
  sinav: 'Sınav tutanağı',
  girmeyenler: 'Sınava girmeyenler tutanağı',
};

/** Yalnızca yazılı oturumlarda üretilir */
export const TUTANAK_YAZILI_ONLY: TutanakEvrakKey[] = ['zarf_soru_cevap', 'soru', 'cevap'];

export type TutanakPdfOptions = {
  sessionFilter: TutanakSessionFilter;
  evrak: Set<TutanakEvrakKey>;
  /** Doluysa yalnızca bu oturum kimlikleri (oturum türü filtresiyle birlikte) */
  sessionIds?: Set<string>;
};

export function sessionTutanakMode(s: SorumlulukSession, group: SorumlulukGroup): 'yazili' | 'uygulama' {
  if (group.examType === 'beceri' || s.sessionType === 'uygulama') return 'uygulama';
  return 'yazili';
}

export function sessionMatchesTutanakFilter(
  s: SorumlulukSession,
  group: SorumlulukGroup,
  filter: TutanakSessionFilter,
): boolean {
  if (filter === 'all') return true;
  return sessionTutanakMode(s, group) === filter;
}

export function parseTutanakPdfOptions(query: {
  oturum?: string;
  evrak?: string;
  session_ids?: string;
}): TutanakPdfOptions {
  const sessionFilter: TutanakSessionFilter =
    query.oturum === 'yazili' || query.oturum === 'uygulama' ? query.oturum : 'all';

  const valid = new Set<string>(TUTANAK_EVRAK_KEYS);
  const picked = (query.evrak ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((k): k is TutanakEvrakKey => valid.has(k));

  const evrak = new Set<TutanakEvrakKey>(
    picked.length > 0 ? picked : [...TUTANAK_EVRAK_KEYS],
  );

  const ids = (query.session_ids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const sessionIds = ids.length > 0 ? new Set(ids) : undefined;

  return { sessionFilter, evrak, sessionIds };
}
