import type { SchoolTypeKey } from '@/lib/school-labels';

/** Ortak — tüm kademelerde görülebilir */
const BRANCH_COMMON = [
  'Psikolojik Danışmanlık ve Rehberlik',
  'Rehberlik',
] as const;

/** Anaokulu / okul öncesi */
const BRANCH_ANAOKUL = [
  'Okul Öncesi Öğretmenliği',
  'Çocuk Gelişimi ve Eğitimi',
  'Oyun ve Fiziksel Etkinlikler',
  'Müzik',
  'Görsel Sanatlar',
  'Drama',
  'İngilizce',
] as const;

/** İlkokul (1–4) + temel eğitim alt kademe */
const BRANCH_ILKOKUL = [
  'Sınıf Öğretmenliği',
  'Türkçe',
  'Matematik',
  'Hayat Bilgisi',
  'Fen Bilimleri',
  'Sosyal Bilgiler',
  'İngilizce',
  'Din Kültürü ve Ahlak Bilgisi',
  'Beden Eğitimi ve Oyun',
  'Görsel Sanatlar',
  'Müzik',
  'Bilişim Teknolojileri ve Yazılım',
  'Serbest Etkinlik',
  'Birleştirilmiş Sınıf (1-2, 3-4)',
  'İnsan Hakları, Vatandaşlık ve Demokrasi',
  'Trafik Güvenliği',
] as const;

/** Ortaokul (5–8) + seçmeli */
const BRANCH_ORTAOKUL = [
  'Türkçe',
  'Matematik',
  'Fen Bilimleri',
  'Sosyal Bilgiler',
  'İngilizce',
  'Din Kültürü ve Ahlak Bilgisi',
  'Müzik',
  'Görsel Sanatlar',
  'Beden Eğitimi ve Spor',
  'Bilişim Teknolojileri ve Yazılım',
  'T.C. İnkılap Tarihi ve Atatürkçülük',
  'Teknoloji ve Tasarım',
  'Almanca',
  'Arapça',
  'Fransızca',
  'Matematik Uygulamaları',
  'Okuma Becerileri',
  'Yazarlık ve Yazma Becerileri',
  'Drama',
  'Zeka Oyunları',
  'Spor ve Fiziki Etkinlikler',
  'Yapay Zeka ve Kodlama',
] as const;

/** İmam hatip ortaokul / lise — din dersleri */
const BRANCH_IHO_IHL = [
  "Kur'an-ı Kerim",
  'Temel Dini Bilgiler',
  'Siyer',
  'Peygamberimizin Hayatı',
] as const;

/** Lise (genel, anadolu, fen, sosyal bilimler, açık öğretim vb.) */
const BRANCH_LISE = [
  'Türk Dili ve Edebiyatı',
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'Mantık',
  'Psikoloji',
  'Sosyoloji',
  'Din Kültürü ve Ahlak Bilgisi',
  'İngilizce',
  'Almanca',
  'Fransızca',
  'İspanyolca',
  'Rusça',
  'Beden Eğitimi ve Spor',
  'Görsel Sanatlar',
  'Müzik',
  'Bilgisayar Bilimi',
] as const;

/** MTAL / MEM / meslek */
const BRANCH_MESLEK = [
  'Meslek Dersleri',
  'Meslek Eğitimi',
  'Staj Koordinatörlüğü',
  'Atölye Öğretmenliği',
  'Elektrik-Elektronik',
  'Makine Teknolojisi',
  'Bilişim Teknolojileri',
  'Otomotiv Teknolojisi',
  'İnşaat Teknolojisi',
  'Mobilya ve İç Mekân Tasarımı',
  'Gıda Teknolojisi',
  'Çocuk Gelişimi ve Eğitimi',
  'Hasta ve Yaşlı Hizmetleri',
  'Güzellik ve Saç Bakım Hizmetleri',
  'Moda Tasarım Teknolojileri',
  'Grafik Tasarım',
] as const;

/** Güzel sanatlar lisesi */
const BRANCH_GSL = [
  'Resim',
  'Bale',
  'Türk Halk Oyunları',
  'Piyano',
  'Klasik Kemençe',
  'Klasik Gitar',
  'Klasik Bağlama',
] as const;

/** Spor lisesi */
const BRANCH_SPOR = [
  'Spor Bilimleri',
] as const;

/** Özel eğitim okulu / uygulama merkezi */
const BRANCH_OZEL_EGITIM = [
  'Özel Eğitim',
  'Kaynaştırma',
  'Zihinsel Yetersizlik',
  'İşitme Yetersizliği',
  'Görme Yetersizliği',
  'Otizm Spektrum Bozukluğu',
  'Bedensel Yetersizlik',
  'Öğrenme Güçlüğü',
  'Dil ve Konuşma Bozuklukları',
] as const;

/** Halk eğitim merkezi */
const BRANCH_HALK_EGITIM = [
  'Halk Eğitimi',
  'Okuma Yazma',
  'El Sanatları',
  'Bilgisayar',
] as const;

/** Bilsem */
const BRANCH_BILSEM = [
  'Bilsem (Genel Yetenek)',
  'Fen ve Teknoloji',
  'Resim (Görsel Sanatlar Alanı)',
  'Müzik (Müzik Alanı)',
] as const;

/** Rehberlik ve araştırma merkezi */
const BRANCH_RAM = [
  'Rehberlik Öğretmenliği',
] as const;

/** Öğretmenevi ve akşam sanat okulu */
const BRANCH_OGRETMENEVI = [
  'El Sanatları',
  'Seramik',
] as const;

type BranchSetKey =
  | 'common'
  | 'anaokul'
  | 'ilkokul'
  | 'ortaokul'
  | 'iho_ihl'
  | 'lise'
  | 'meslek'
  | 'gsl'
  | 'spor'
  | 'ozel_egitim'
  | 'halk_egitim'
  | 'bilsem'
  | 'ram'
  | 'ogretmenevi';

const BRANCH_SETS: Record<BranchSetKey, readonly string[]> = {
  common: BRANCH_COMMON,
  anaokul: BRANCH_ANAOKUL,
  ilkokul: BRANCH_ILKOKUL,
  ortaokul: BRANCH_ORTAOKUL,
  iho_ihl: BRANCH_IHO_IHL,
  lise: BRANCH_LISE,
  meslek: BRANCH_MESLEK,
  gsl: BRANCH_GSL,
  spor: BRANCH_SPOR,
  ozel_egitim: BRANCH_OZEL_EGITIM,
  halk_egitim: BRANCH_HALK_EGITIM,
  bilsem: BRANCH_BILSEM,
  ram: BRANCH_RAM,
  ogretmenevi: BRANCH_OGRETMENEVI,
};

/** Okul türü → branş kümeleri (MEB kademe / kurum tipi) */
const SCHOOL_TYPE_BRANCH_SETS: Record<string, BranchSetKey[]> = {
  anaokul: ['common', 'anaokul'],
  ilkokul: ['common', 'ilkokul'],
  ortaokul: ['common', 'ortaokul'],
  temel_egitim: ['common', 'ilkokul', 'ortaokul'],
  imam_hatip_ortaokul: ['common', 'ortaokul', 'iho_ihl'],
  lise: ['common', 'lise'],
  anadolu_lisesi: ['common', 'lise'],
  cok_programli_anadolu_lisesi: ['common', 'lise'],
  fen_lisesi: ['common', 'lise'],
  sosyal_bilimler_lisesi: ['common', 'lise'],
  acik_ogretim_lisesi: ['common', 'lise'],
  imam_hatip_lise: ['common', 'lise', 'iho_ihl'],
  meslek_lisesi: ['common', 'lise', 'meslek'],
  mesleki_egitim_merkezi: ['common', 'meslek', 'lise'],
  guzel_sanatlar_lisesi: ['common', 'lise', 'gsl'],
  spor_lisesi: ['common', 'lise', 'spor'],
  ozel_egitim: ['common', 'ozel_egitim', 'ilkokul', 'ortaokul'],
  ozel_egitim_uygulama_merkezi: ['common', 'ozel_egitim'],
  halk_egitim: ['common', 'halk_egitim', 'lise'],
  bilsem: ['common', 'bilsem', 'lise', 'ortaokul'],
  rehberlik_merkezi: ['common', 'ram'],
  ogretmenevi_aksam_sanat: ['common', 'ogretmenevi', 'gsl'],
  /** Evrak / eski kod uyumu */
  okul_oncesi: ['common', 'anaokul'],
  mesem: ['common', 'meslek', 'lise'],
  gsl: ['common', 'lise', 'gsl'],
  spor_l: ['common', 'lise', 'spor'],
  meslek: ['common', 'lise', 'meslek'],
  ortaokul_secmeli: ['common', 'ortaokul'],
  lise_secmeli: ['common', 'lise'],
};

const ALL_BRANCH_SET_KEYS = Object.keys(BRANCH_SETS) as BranchSetKey[];

function sortUniqueTr(items: Iterable<string>): readonly string[] {
  return [...new Set([...items].map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'tr'),
  );
}

function branchesFromSetKeys(keys: BranchSetKey[]): readonly string[] {
  const out: string[] = [];
  for (const key of keys) {
    out.push(...BRANCH_SETS[key]);
  }
  return sortUniqueTr(out);
}

/** Tüm okul türlerinin birleşimi — okul türü bilinmiyorsa */
export const TEACHER_BRANCH_OPTIONS: readonly string[] = branchesFromSetKeys(ALL_BRANCH_SET_KEYS);

/** Okul türüne göre branş listesi; bilinmiyorsa tam liste */
export function getTeacherBranchOptionsForSchoolType(
  schoolType?: string | null,
): readonly string[] {
  const t = schoolType?.trim();
  if (!t) return TEACHER_BRANCH_OPTIONS;
  const keys = SCHOOL_TYPE_BRANCH_SETS[t];
  if (!keys) return TEACHER_BRANCH_OPTIONS;
  return branchesFromSetKeys(keys);
}

export function isKnownSchoolTypeForBranches(type: string): type is SchoolTypeKey {
  return type in SCHOOL_TYPE_BRANCH_SETS;
}
