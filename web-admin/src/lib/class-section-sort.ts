import { canonicalizeSectionList } from '@/lib/class-section-canonical';

/** Şube adları: önce sınıf düzeyi (9→12), sonra şube harfi, sonra tam metin. */
export function parseGradeFromClassSection(section: string): number {
  const s = section.trim();
  const patterns = [
    /(?:^|[^\d])(1[0-2]|[1-9])\s*[\/.\-]\s*[A-Za-zÇĞİÖŞÜçğıöşü]/i,
    /(?:^|[^\d])(1[0-2]|[1-9])[A-Za-zÇĞİÖŞÜçğıöşü]/,
    /(?:^)(1[0-2]|[1-9])\b/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return parseInt(m[1], 10);
  }
  return 99;
}

function parseBranchFromClassSection(section: string): string {
  const m = section.trim().match(/(?:1[0-2]|[1-9])\s*[\/.\-]\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)/i);
  return m?.[1]?.toLocaleLowerCase('tr-TR') ?? '';
}

export function compareClassSections(a: string, b: string): number {
  const ga = parseGradeFromClassSection(a);
  const gb = parseGradeFromClassSection(b);
  if (ga !== gb) return ga - gb;
  const ba = parseBranchFromClassSection(a);
  const bb = parseBranchFromClassSection(b);
  const byBranch = ba.localeCompare(bb, 'tr', { numeric: true });
  if (byBranch !== 0) return byBranch;
  return a.localeCompare(b, 'tr', { numeric: true, sensitivity: 'base' });
}

export function sortClassSections(sections: string[]): string[] {
  return [...sections].sort(compareClassSections);
}

export function formatClassSectionsList(sections: string[], sep = ', '): string {
  return canonicalizeSectionList(sections).join(sep);
}

const SECTION_ISSUE_CODES = new Set(['SECTION_NO_HOURS']);

export function sortValidationIssues<T extends { code: string; message: string }>(issues: T[]): T[] {
  return [...issues].sort((a, b) => {
    const sa = SECTION_ISSUE_CODES.has(a.code) ? a.message.split(':')[0]?.trim() ?? '' : '';
    const sb = SECTION_ISSUE_CODES.has(b.code) ? b.message.split(':')[0]?.trim() ?? '' : '';
    if (sa && sb) return compareClassSections(sa, sb);
    if (sa) return -1;
    if (sb) return 1;
    return 0;
  });
}
