import * as XLSX from 'xlsx';
import { SCHOOL_TYPE_ORDER } from '@/lib/school-labels';

export type ParsedSchoolRow = Record<string, string | number>;

const TYPE_VALUES: string[] = [...SCHOOL_TYPE_ORDER];
const SEGMENT_VALUES = ['devlet', 'ozel'];
const STATUS_VALUES = ['deneme', 'aktif', 'askida'];

export function downloadSchoolExcelTemplate() {
  const headers = [
    'name',
    'type',
    'segment',
    'city',
    'district',
    'institution_code',
    'address',
    'website_url',
    'phone',
    'fax',
    'institutional_email',
    'principal_name',
    'about_description',
    'status',
    'teacher_limit',
  ];
  const example = [
    'Örnek İlkokulu',
    'ilkokul',
    'devlet',
    'Ankara',
    'Çankaya',
    '123456',
    'Mahalle, Cadde No:1',
    'https://okul.meb.gov.tr',
    '0312 555 00 00',
    '0312 555 00 01',
    'bilgi@okul.meb.k12.tr',
    'Ad Soyad',
    'Okulumuz hakkında kısa bilgi...',
    'aktif',
    '100',
  ];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Okullar');
  XLSX.writeFile(wb, 'okul_sablonu.xlsx');
}

export function parseExcelToSchoolRows(file: File): Promise<ParsedSchoolRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) return reject(new Error('Dosya okunamadı'));
        const wb = XLSX.read(data, { type: 'binary' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, { header: 1, defval: '' });
        if (!json.length) return resolve([]);
        const headers = json[0].map((h) => String(h).trim().toLowerCase().replace(/\s/g, '_'));
        const rows: ParsedSchoolRow[] = [];
        for (let i = 1; i < json.length; i++) {
          const row = json[i] ?? [];
          const obj: ParsedSchoolRow = {};
          headers.forEach((h, j) => {
            const v = row[j];
            obj[h] = v != null && v !== '' ? (typeof v === 'number' ? v : String(v).trim()) : '';
          });
          if (obj.name) rows.push(obj);
        }
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.readAsBinaryString(file);
  });
}

export function getSchoolRowVal(r: ParsedSchoolRow, ...keys: string[]): string | number {
  for (const k of keys) {
    const v = r[k];
    if (v != null && v !== '') return v;
  }
  return '';
}

export function mapRowsToBulkApiSchools(rows: ParsedSchoolRow[]) {
  return rows.map((r) => {
    const type = String(getSchoolRowVal(r, 'type', 'tür')).toLowerCase() || 'lise';
    const segment = String(getSchoolRowVal(r, 'segment')).toLowerCase() || 'devlet';
    const status = String(getSchoolRowVal(r, 'status', 'durum')).toLowerCase() || 'deneme';
    return {
      name: String(getSchoolRowVal(r, 'name', 'okul_adi', 'okul adı')).trim(),
      type: TYPE_VALUES.includes(type) ? type : 'lise',
      segment: SEGMENT_VALUES.includes(segment) ? segment : 'devlet',
      city: String(getSchoolRowVal(r, 'city', 'il')).trim() || null,
      district: String(getSchoolRowVal(r, 'district', 'ilce', 'ilçe')).trim() || null,
      institution_code: String(getSchoolRowVal(r, 'institution_code', 'kurum_kodu', 'meb_kodu')).trim() || null,
      address: String(getSchoolRowVal(r, 'address', 'adres', 'acik_adres')).trim() || null,
      website_url: String(getSchoolRowVal(r, 'website_url', 'web_sitesi', 'website')).trim() || null,
      phone: String(getSchoolRowVal(r, 'phone', 'telefon')).trim() || null,
      fax: String(getSchoolRowVal(r, 'fax', 'faks')).trim() || null,
      institutional_email: String(getSchoolRowVal(r, 'institutional_email', 'kurumsal_eposta', 'kurumsal_email')).trim() || null,
      principal_name: String(getSchoolRowVal(r, 'principal_name', 'mudur', 'müdür', 'okul_muduru')).trim() || null,
      about_description: String(getSchoolRowVal(r, 'about_description', 'detay', 'okulumuz_hakkinda')).trim() || null,
      status: STATUS_VALUES.includes(status) ? status : 'deneme',
      teacher_limit: (() => {
        const v = getSchoolRowVal(r, 'teacher_limit', 'ogretmen_limiti', 'limit');
        return typeof v === 'number' ? v : parseInt(String(v), 10) || 100;
      })(),
    };
  });
}

/** POST /schools/reconcile/* için gövde (backend gevşek doğrular ve normalize eder). */
export function mapRowsToReconcileSchools(rows: ParsedSchoolRow[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const tlRaw = getSchoolRowVal(r, 'teacher_limit', 'ogretmen_limiti', 'limit');
    const tl = typeof tlRaw === 'number' ? tlRaw : parseInt(String(tlRaw), 10);
    const ic = String(getSchoolRowVal(r, 'institution_code', 'kurum_kodu', 'meb_kodu')).trim();
    return {
      name: String(getSchoolRowVal(r, 'name', 'okul_adi', 'okul adı')).trim(),
      type: String(getSchoolRowVal(r, 'type', 'tür')).toLowerCase() || undefined,
      segment: String(getSchoolRowVal(r, 'segment')).toLowerCase() || undefined,
      city: String(getSchoolRowVal(r, 'city', 'il')).trim() || undefined,
      district: String(getSchoolRowVal(r, 'district', 'ilce', 'ilçe')).trim() || undefined,
      institution_code: ic || undefined,
      address: String(getSchoolRowVal(r, 'address', 'adres', 'acik_adres')).trim() || undefined,
      website_url: String(getSchoolRowVal(r, 'website_url', 'web_sitesi', 'website')).trim() || undefined,
      phone: String(getSchoolRowVal(r, 'phone', 'telefon')).trim() || undefined,
      fax: String(getSchoolRowVal(r, 'fax', 'faks')).trim() || undefined,
      institutional_email: String(getSchoolRowVal(r, 'institutional_email', 'kurumsal_eposta', 'kurumsal_email')).trim() || undefined,
      principal_name: String(getSchoolRowVal(r, 'principal_name', 'mudur', 'müdür', 'okul_muduru')).trim() || undefined,
      about_description: String(getSchoolRowVal(r, 'about_description', 'detay', 'okulumuz_hakkinda')).trim() || undefined,
      status: String(getSchoolRowVal(r, 'status', 'durum')).toLowerCase() || undefined,
      teacher_limit: Number.isFinite(tl) && tl > 0 ? tl : undefined,
    };
  });
}
