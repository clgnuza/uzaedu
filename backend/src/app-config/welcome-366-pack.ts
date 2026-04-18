import { WELCOME_ATASOZU_EK_TAGGED } from './welcome-atasozu-ek';
import { WELCOME_CURATED } from './welcome-curated';
import { WELCOME_DUSUNCE_EK } from './welcome-dusunce-ek';

const NEED = 366;

function dedupeKeepOrder(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const t = raw.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

const PACK = dedupeKeepOrder([...WELCOME_CURATED, ...WELCOME_DUSUNCE_EK, ...WELCOME_ATASOZU_EK_TAGGED]);

if (PACK.length < NEED) {
  throw new Error(`welcome-366 paket: ${PACK.length} benzersiz satır (gerekli: ${NEED})`);
}

/** Takvim sırası (01-01 … 12-31, artık yılda 02-29): her gün bir mesaj. */
export const WELCOME_BY_DAY_ORDERED = PACK.slice(0, NEED) as readonly string[];
