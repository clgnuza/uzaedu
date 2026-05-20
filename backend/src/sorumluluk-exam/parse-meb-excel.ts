import * as XLSX from 'xlsx';
import { normalizeSorumluSubject } from './sorumluluk-subject.util';

export type MebStudentRow = {
  studentName: string;
  studentNumber?: string;
  className?: string;
  subjects?: string[];
};

function normCell(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');
}

function findSorumluDersColumns(row: unknown[]): { no: number; name: number; grade: number; subj: number } | null {
  const cols = { no: -1, name: -1, grade: -1, subj: -1 };
  row.forEach((c, i) => {
    const t = normCell(c).toLocaleLowerCase('tr-TR');
    if (/öğrenci\s*no|ogrenci\s*no/.test(t)) cols.no = i;
    if (/ad[ıi]\s*soyad/.test(t)) cols.name = i;
    if (/^sınıfı$|^sinifi$/.test(t)) cols.grade = i;
    if (/^dersi$|^ders$/.test(t) || /sorumlu.*ders/.test(t)) cols.subj = i;
  });
  if (cols.no >= 0 && cols.name >= 0 && cols.subj >= 0) return cols;
  return null;
}

/** e-Okul: seviye (Sınıfı) ve ders adı (Dersi) ayrı hücrelerde gelir. */
function combineGradeAndSubject(gradeRaw: string, subjectRaw: string): string {
  const grade = gradeRaw.trim();
  const subject = subjectRaw.trim();
  if (!subject) return '';
  if (grade && /^\d{1,2}$/.test(grade)) return `${grade} ${subject}`;
  if (/^\d{1,2}\s+/.test(subject)) return subject;
  return subject;
}

function splitStudentNoAndName(no: string, name: string): { no: string; name: string } {
  if (!no && name) {
    const m = name.match(/^(\d{3,})\s+(.+)$/u);
    if (m) return { no: m[1], name: m[2].trim() };
  }
  return { no, name };
}

function isSectionHeader(text: string): boolean {
  return /\d+\.\s*Sınıf\s*\/\s*.+Şubesi/i.test(text) && !/öğrenci\s*no/i.test(text);
}

/** e-Okul: "Sorumlu Dersi Olan Öğrenciler" — öğrenci başına birden fazla satır (her satır bir ders). */
export function parseEokulSorumluDersSheet(aoa: unknown[][]): MebStudentRow[] | null {
  let section = '';
  let cols: ReturnType<typeof findSorumluDersColumns> = null;
  let lastKey = '';
  const byKey = new Map<string, MebStudentRow>();

  for (const row of aoa) {
    if (!Array.isArray(row)) continue;
    const line = row.map(normCell).filter(Boolean).join(' ');
    if (!line) continue;

    const head = normCell(row[0]) || line;
    if (isSectionHeader(head) || isSectionHeader(line)) {
      section = head.includes('Sınıf') ? head : line;
      cols = null;
      lastKey = '';
      continue;
    }

    if (!cols) {
      const found = findSorumluDersColumns(row);
      if (found) {
        cols = found;
        continue;
      }
    }
    if (!cols) continue;

    let no = normCell(row[cols.no]);
    let name = normCell(row[cols.name]);
    ({ no, name } = splitStudentNoAndName(no, name));
    const gradeLvl = cols.grade >= 0 ? normCell(row[cols.grade]) : '';
    const subjRaw = combineGradeAndSubject(gradeLvl, normCell(row[cols.subj]));
    if (!subjRaw) continue;
    const subj = normalizeSorumluSubject(subjRaw).subjectName;
    if (!subj) continue;

    if (no) lastKey = no;
    if (!lastKey && !name) continue;

    const key = lastKey || name;
    let rec = byKey.get(key);
    if (!rec) {
      rec = {
        studentName: name,
        studentNumber: lastKey || no || undefined,
        className: section || undefined,
        subjects: [],
      };
      byKey.set(key, rec);
    } else {
      if (name) rec.studentName = name;
      if (lastKey || no) rec.studentNumber = lastKey || no;
      if (section) rec.className = section;
    }
    const subjKey = normalizeSorumluSubject(subj).matchKey;
    const has = rec.subjects!.some((s) => normalizeSorumluSubject(s).matchKey === subjKey);
    if (!has) rec.subjects!.push(subj);
  }

  if (!byKey.size) return null;
  return [...byKey.values()].filter((r) => r.studentName?.trim());
}

function parseFlatExcelRows(sheet: XLSX.WorkSheet): MebStudentRow[] {
  const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const out: MebStudentRow[] = [];
  for (const r of raw) {
    const keys = Object.keys(r);
    const nameKey =
      keys.find((k) => /öğrenci.*ad|ad.*soyad|adı.*soyadı|isim|name/i.test(k)) ??
      keys.find((k) => /ad/i.test(k)) ??
      keys[0];
    const noKey = keys.find((k) => /öğrenci.*no|okul.*no|numara|^no$/i.test(k));
    const clsKey = keys.find((k) => /sınıf|şube|sinif|sube|class/i.test(k));
    const subjKeys = keys.filter((k) =>
      /^ders\s*\d|^\d+\.\s*ders|sorumlu.*ders|ders.*\d|lesson|subject/i.test(k),
    );
    const multiKey = keys.find((k) => /sorumlu\s+dersler?$/i.test(k));
    let subjects: string[] = [];
    if (multiKey && String(r[multiKey] ?? '').trim()) {
      subjects = String(r[multiKey])
        .split(/[,;/\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      subjects = subjKeys.map((k) => String(r[k] ?? '').trim()).filter(Boolean);
    }
    let studentName = String(r[nameKey] ?? '').trim();
    let studentNumber = noKey ? String(r[noKey] ?? '').trim() : '';
    ({ no: studentNumber, name: studentName } = splitStudentNoAndName(studentNumber, studentName));
    if (!studentName || /valiliği|müdürlüğü|sorumlu olduğu dersler/i.test(studentName)) continue;
    const normSubjects = uniqueMebSubjects(subjects);
    out.push({
      studentName,
      studentNumber: studentNumber || undefined,
      className: clsKey ? String(r[clsKey] ?? '').trim() || undefined : undefined,
      subjects: normSubjects,
    });
  }
  return out;
}

function uniqueMebSubjects(subjects: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of subjects) {
    const n = normalizeSorumluSubject(raw);
    if (!n.matchKey) continue;
    if (!seen.has(n.matchKey)) seen.set(n.matchKey, n.subjectName);
  }
  return [...seen.values()];
}

export function parseSorumlulukMebExcel(buffer: Buffer): MebStudentRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const eokul = parseEokulSorumluDersSheet(aoa);
  if (eokul?.length) return eokul;

  return parseFlatExcelRows(sheet);
}
