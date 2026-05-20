/** API’den gelen sınıf boşsa gösterim için yedek çıkarım */
export function displayTimetableClass(
  classSection: string | null | undefined,
  subject: string | null | undefined,
): string {
  const c = (classSection ?? '').trim();
  if (c) return c;

  const s = (subject ?? '').trim();
  if (!s) return '';

  const amp = /AMP\s*[-/]?\s*(\d{1,2})\s*\.?\s*(?:Sınıf|Sınıfı)?\s*\/\s*([A-ZÇĞİÖŞÜ])/iu.exec(s);
  if (amp) return `${amp[1]}-${amp[2]!.toLocaleUpperCase('tr-TR')}`;

  const slash = /(\d{1,2})\s*\.?\s*(?:Sınıf|Sınıfı)?\s*\/\s*([A-ZÇĞİÖŞÜ])/iu.exec(s);
  if (slash) return `${slash[1]}-${slash[2]!.toLocaleUpperCase('tr-TR')}`;

  const dash = /^(\d{1,2})\s*[-/]\s*([A-ZÇĞİÖŞÜ])/iu.exec(s);
  if (dash) return `${dash[1]}-${dash[2]!.toLocaleUpperCase('tr-TR')}`;

  const compact = /^(\d{1,2})([A-ZÇĞİÖŞÜ])/iu.exec(s.replace(/\s/g, ''));
  if (compact) return `${compact[1]}-${compact[2]!.toLocaleUpperCase('tr-TR')}`;

  return '';
}
