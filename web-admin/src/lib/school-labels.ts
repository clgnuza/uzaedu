/** Okul tipi / segment / durum — liste ve formlarda ortak etiketler */

/** Veritabanı `schools.type` değerleri (Türkiye / MEB yaygın kurum tipleri) */
export const SCHOOL_TYPE_ORDER = [
  'anaokul',
  'ilkokul',
  'ortaokul',
  'lise',
  'meslek_lisesi',
  'imam_hatip_ortaokul',
  'imam_hatip_lise',
  'ozel_egitim',
  'halk_egitim',
  'bilsem',
] as const;

export type SchoolTypeKey = (typeof SCHOOL_TYPE_ORDER)[number];

export const SCHOOL_TYPE_LABELS: Record<string, string> = {
  anaokul: 'Anaokulu',
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
  meslek_lisesi: 'Meslek Lisesi / MTAL',
  imam_hatip_ortaokul: 'İmam Hatip Ortaokulu',
  imam_hatip_lise: 'İmam Hatip Lisesi',
  ozel_egitim: 'Özel Eğitim Uygulama Okulu',
  halk_egitim: 'Halk Eğitim Merkezi',
  bilsem: 'BİLSEM',
  /** Evrak / eski kod uyumu (okul kaydında kullanılmayabilir) */
  gsl: 'Güzel Sanatlar Lisesi',
  spor_l: 'Spor Lisesi',
  meslek: 'Meslek Lisesi',
  mesem: 'Mesleki Eğitim Merkezi',
};

export const SCHOOL_SEGMENT_LABELS: Record<string, string> = {
  ozel: 'Özel',
  devlet: 'Devlet',
};

export const SCHOOL_STATUS_LABELS: Record<string, string> = {
  deneme: 'Deneme',
  aktif: 'Aktif',
  askida: 'Askıda',
};

/** GET /schools?type_group= — backend ile aynı anahtarlar */
export const SCHOOL_TYPE_GROUP_ORDER = ['ilkogretim', 'lise_kademesi', 'kurum_diger'] as const;

export const SCHOOL_TYPE_GROUP_LABELS: Record<string, string> = {
  ilkogretim: 'İlköğretim (ilkokul + ortaokul)',
  lise_kademesi: 'Lise kademesi (lise, meslek, İHL, BİLSEM)',
  kurum_diger: 'Diğer (anaokul, İH orta, özel eğitim, halk eğitim)',
};

export function formatSchoolTypeLabel(code: string | null | undefined): string {
  if (code == null || code === '') return '—';
  return SCHOOL_TYPE_LABELS[code] ?? code;
}

/** Kurumsal e-posta için yaygın MEB alt alan adı ipucu */
export const INSTITUTIONAL_EMAIL_HINT =
  'Devlet okullarında sık biçim: kurum@okuladi.il.meb.k12.tr veya @meb.k12.tr uzantılı adresler.';

/** MEB / e-Okul kurum kodu */
export const MEB_INSTITUTION_CODE_HINT = '4–16 hane, yalnızca rakam (e-Okul / MEB).';

export function buildSchoolsListQuery(params: {
  page: number;
  limit: number;
  city?: string;
  district?: string;
  status?: string;
  type?: string;
  type_group?: string;
  segment?: string;
  search?: string;
}): string {
  const u = new URLSearchParams();
  u.set('page', String(params.page));
  u.set('limit', String(params.limit));
  if (params.city?.trim()) u.set('city', params.city.trim());
  if (params.district?.trim()) u.set('district', params.district.trim());
  if (params.status) u.set('status', params.status);
  if (params.type_group) u.set('type_group', params.type_group);
  else if (params.type) u.set('type', params.type);
  if (params.segment) u.set('segment', params.segment);
  if (params.search?.trim()) u.set('search', params.search.trim());
  return u.toString();
}
