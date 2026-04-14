import { createHash } from 'crypto';
import * as XLSX from 'xlsx';

export type ParsedMebbisPerson = {
  tc: string;
  displayName: string;
  teacherBranch: string | null;
  teacherTitle: string | null;
  /** Excel satırı (1 tabanlı, başlık = 1) */
  sheetRow: number;
};

function normHeader(c: unknown): string {
  return String(c ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function colIndex(headerRow: unknown[], pred: (s: string) => boolean): number {
  for (let i = 0; i < headerRow.length; i++) {
    const s = normHeader(headerRow[i]);
    if (s && pred(s)) return i;
  }
  return -1;
}

export function cellToTc(v: unknown): string | null {
  if (v === '' || v === null || v === undefined) return null;
  let digits: string;
  if (typeof v === 'number' && Number.isFinite(v)) {
    digits = String(Math.abs(Math.trunc(v)));
  } else {
    digits = String(v).replace(/\D/g, '');
  }
  if (digits.length > 11) digits = digits.slice(-11);
  if (digits.length < 11) digits = digits.padStart(11, '0');
  if (!/^\d{11}$/.test(digits)) return null;
  return digits;
}

function isTeacherGorev(gorevCell: unknown): boolean {
  const s = String(gorevCell ?? '').toLowerCase();
  return s.includes('öğretmen') || s.includes('ogretmen');
}

function trunc(s: string | null, max: number): string | null {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * MEBBİS ÖZ5900 “Personel Listesi” Excel (veri olarak indirilen .xls/.xlsx).
 * Başlık satırından sütunlar tespit edilir; ana satırlar TC + ad-soyad içerir.
 */
export function parseMebbisPersonnelSheet(buffer: Buffer): ParsedMebbisPerson[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: true });
  const name0 = workbook.SheetNames[0];
  if (!name0) return [];
  const sheet = workbook.Sheets[name0];
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true }) as unknown[][];
  if (aoa.length < 2) return [];

  const header = aoa[0] ?? [];
  let tcIdx = colIndex(header, (s) => s.includes('tc') && s.includes('kimlik'));
  let nameIdx = colIndex(header, (s) => (s.includes('adı') || s.includes('adi')) && (s.includes('soyad') || s.includes('soyadı')));
  let atamaIdx = colIndex(header, (s) => s.includes('atama') && s.includes('alan'));
  let gorevIdx = colIndex(header, (s) => s.includes('görevi') || s.includes('gorevi') || s.includes('öğretmenlik') || s.includes('ogretmenlik'));

  if (tcIdx < 0) tcIdx = 0;
  if (nameIdx < 0) nameIdx = 1;
  if (atamaIdx < 0) atamaIdx = 8;
  if (gorevIdx < 0) gorevIdx = 5;

  const out: ParsedMebbisPerson[] = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!Array.isArray(row)) continue;
    const tc = cellToTc(row[tcIdx]);
    const displayName = String(row[nameIdx] ?? '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!tc || !displayName) continue;
    if (!isTeacherGorev(row[gorevIdx])) continue;

    const branchRaw = String(row[atamaIdx] ?? '').replace(/\s+/g, ' ').trim();
    const titleRaw = String(row[gorevIdx] ?? '').replace(/\s+/g, ' ').trim();

    out.push({
      tc,
      displayName,
      teacherBranch: trunc(branchRaw, 100),
      teacherTitle: trunc(titleRaw, 64),
      sheetRow: r + 1,
    });
  }
  return out;
}

/** Okul başına sabit 8 hex — kısa yer tutucu e-posta için */
export function schoolMebbisKey8(schoolId: string): string {
  return createHash('sha256').update(schoolId).digest('hex').slice(0, 8);
}

/** Kısa yer tutucu (örn. m.14348579180.a1b2c3d4@personel.import ≈ 36 karakter) */
export function syntheticMebbisEmail(schoolId: string, tc: string): string {
  return `m.${tc}.${schoolMebbisKey8(schoolId)}@personel.import`.toLowerCase();
}

/** Önceki uzun format; toplu aktarımda mükerrer önlemek için hâlâ eşlenir */
export function legacyLongSyntheticMebbisEmail(schoolId: string, tc: string): string {
  const sid = schoolId.replace(/-/g, '');
  return `mebbis.${tc}.${sid}@personel.import`.toLowerCase();
}

export function mebbisPlaceholderEmailsForLookup(schoolId: string, tc: string): string[] {
  return [syntheticMebbisEmail(schoolId, tc), legacyLongSyntheticMebbisEmail(schoolId, tc)];
}
