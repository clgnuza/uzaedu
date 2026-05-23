/** Öğretmene ders programı tebliğ tutanağı — varsayılan metinler ve yer tutucular */

export const NOTIFICATION_PLACEHOLDERS = [
  { key: '{{okul_adi}}', desc: 'Okul adı' },
  { key: '{{ogretim_yili}}', desc: 'Öğretim yılı' },
  { key: '{{program_adi}}', desc: 'Program (okunur ad)' },
  { key: '{{ogretmen_adi}}', desc: 'Öğretmen adı' },
  { key: '{{brans}}', desc: 'Branş' },
  { key: '{{tarih}}', desc: 'Tebliğ tarihi' },
  { key: '{{sayi}}', desc: 'Belge sayısı' },
  { key: '{{konu}}', desc: 'Konu satırı' },
  { key: '{{mudur_adi}}', desc: 'Okul müdürü' },
] as const;

export const DEFAULT_NOTIFICATION_TITLE = 'ÖĞRETMEN DERS PROGRAMI TEBLİĞ TUTANAĞI';

export const DEFAULT_NOTIFICATION_SUBJECT = 'Haftalık Ders Programının Tebliği';

/** Resmi yazı gövdesi — paragraflar boş satırla ayrılır */
export const DEFAULT_NOTIFICATION_BODY = `{{ogretim_yili}} Eğitim-Öğretim Yılında okulumuzda uygulanacak haftalık ders programı, Millî Eğitim Bakanlığı mevzuatı ile okul örgütüne uygun olarak hazırlanmış olup tarafınıza tebliğ edilmiştir.

Aşağıda yer alan ders çizelgesinde belirtilen görevleri programa uygun biçimde yerine getirmeniz; programda değişiklik gerektiren hususları okul idaresine yazılı olarak bildirmeniz önemle rica olunur.`;

export const DEFAULT_NOTIFICATION_ACK =
  'Yukarıda belirtilen haftalık ders programının tarafıma tebliğ edildiğini ve programa uygun olarak görevlerimi yerine getireceğimi beyan ederim.';

export const DEFAULT_TEACHER_SIGNATURE_LABEL = 'Öğretmen';

/** Metin içinde kullanılacak öğretim yılı ifadesi (yıl zaten tam cümledeyse tekrar etmez) */
export function formatOgretimYiliForProse(year: string | null | undefined): string {
  const y = year?.trim();
  if (!y) return 'İlgili';
  if (/eğitim|öğretim/i.test(y)) return y;
  return y;
}

export function mergeNotificationTemplate(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [k, v] of Object.entries(values)) {
    out = out.replaceAll(k, v ?? '');
  }
  return out;
}

/** Üretim 2026-05-23T08:32 v2 gibi teknik program adlarını rapordan çıkar */
export function humanizeProgramLabel(name: string | null | undefined, academicYear?: string | null): string {
  const n = name?.trim() ?? '';
  const technical =
    /üretim|production|draft|taslak/i.test(n) &&
    (/\d{4}-\d{2}-\d{2}/.test(n) || /T\d{2}:\d{2}/.test(n) || /\sv\d+\b/i.test(n) || /[a-f0-9-]{8,}/i.test(n));
  if (!n || technical) {
    return academicYear
      ? `${academicYear} Eğitim-Öğretim Yılı Haftalık Ders Programı`
      : 'Haftalık Ders Programı';
  }
  return n;
}

export function buildNotificationSayi(
  academicYear: string | null | undefined,
  seq: number,
  custom?: string | null,
): string {
  const y = academicYear?.trim().replace(/\s/g, '') || String(new Date().getFullYear());
  const customT = custom?.trim();
  if (customT) {
    return customT
      .replaceAll('{{sira}}', String(seq).padStart(3, '0'))
      .replaceAll('{{ogretim_yili}}', y);
  }
  return `${y}/DDP-${String(seq).padStart(3, '0')}`;
}

export function isPlaceholderTeacherLabel(label: string): boolean {
  const t = label.trim();
  if (!t || t === '—') return true;
  if (/^teacher\d+$/i.test(t)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return true;
  return t.length <= 12 && /^[a-z]+\d+$/i.test(t);
}
