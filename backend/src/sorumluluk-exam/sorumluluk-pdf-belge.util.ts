import { School } from '../schools/entities/school.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../types/enums';
import { SorumlulukGroup } from './entities/sorumluluk-group.entity';

export type SorumlulukPdfBelge = {
  academicYear: string;
  mudurAdi: string;
  mudurYardimcisiAdi: string;
  duzenleyenAdi: string;
};

function parseZumreList(raw: string): Array<{ name: string; gorev: string }> {
  if (!raw?.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      const i = part.indexOf('|');
      if (i >= 0) return { name: part.slice(0, i).trim(), gorev: part.slice(i + 1).trim() };
      return { name: part, gorev: '' };
    });
}

function nameFromZumre(items: Array<{ name: string; gorev: string }>, gorev: string): string {
  for (const x of items) {
    if (x.gorev === gorev && x.name.trim()) return x.name.trim();
  }
  return '';
}

/** "2025-2026" → "2025-2026 EĞİTİM-ÖĞRETİM YILI" */
export function formatEgitimOgretimYili(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (!t) return '';
  if (/eğitim|egitim/i.test(t)) return t.toUpperCase();
  return `${t} EĞİTİM-ÖĞRETİM YILI`;
}

export function resolveSorumlulukPdfBelge(
  school: School | null,
  group: SorumlulukGroup,
  schoolAdmins: User[],
): SorumlulukPdfBelge {
  let mudurFromEvrak = '';
  let ogretimYili = '';
  let duzenleyenAdi = '';
  let zumreRaw = '';

  for (const a of schoolAdmins) {
    const ed = a.evrakDefaults;
    if (!ed) continue;
    const d = (ed as { duzenleyen_adi?: string }).duzenleyen_adi?.trim();
    if (!duzenleyenAdi && d) duzenleyenAdi = d;
    if (!ogretimYili && ed.ogretim_yili?.trim()) ogretimYili = ed.ogretim_yili.trim();
    if (!zumreRaw) zumreRaw = (ed.zumre_ogretmenleri ?? ed.zumreler ?? '').trim();
    if (!mudurFromEvrak && ed.mudur_adi?.trim()) mudurFromEvrak = ed.mudur_adi.trim();
  }

  const zumre = parseZumreList(zumreRaw);
  const mudurAdi =
    mudurFromEvrak ||
    nameFromZumre(zumre, 'Okul Müdürü') ||
    (school?.principalName ?? '').trim();
  const mudurYardimcisiAdi = nameFromZumre(zumre, 'Müdür Yardımcısı');
  if (!duzenleyenAdi) {
    duzenleyenAdi = mudurYardimcisiAdi || (schoolAdmins[0]?.display_name ?? '').trim();
  }

  const academicYear = formatEgitimOgretimYili(ogretimYili || group.academicYear || '');

  return { academicYear, mudurAdi, mudurYardimcisiAdi, duzenleyenAdi };
}

export async function loadSchoolAdminsForBelge(
  userRepo: { find: (opts: object) => Promise<User[]> },
  schoolId: string,
): Promise<User[]> {
  return userRepo.find({
    where: { school_id: schoolId, role: UserRole.school_admin },
    select: ['id', 'display_name', 'evrakDefaults'],
    order: { created_at: 'ASC' },
  });
}
