/**
 * CORE_ENTITIES / GLOSSARY uyumlu sabitler.
 * Rol: AUTHORITY_MATRIX; kullanıcı/okul durumu: CURSOR_SPEC.
 */

export enum UserRole {
  superadmin = 'superadmin',
  moderator = 'moderator',
  school_admin = 'school_admin',
  teacher = 'teacher',
}

/** Moderator için modül bazlı yetki anahtarları. */
export const MODERATOR_MODULES = [
  'school_reviews',
  'school_profiles',
  'announcements',
  'schools',
  'users',
  'market_policy',
  'modules',
  'document_templates',
  'extra_lesson_params',
  'outcome_sets',
  'system_announcements',
  'support',
] as const;
export type ModeratorModuleKey = (typeof MODERATOR_MODULES)[number];

export enum UserStatus {
  active = 'active',
  passive = 'passive',
  suspended = 'suspended',
  deleted = 'deleted',
}

/** Öğretmenin okul bağlantısı: kayıtta seçim → okul admin onayı */
export enum TeacherSchoolMembershipStatus {
  none = 'none',
  pending = 'pending',
  approved = 'approved',
  rejected = 'rejected',
}

export enum SchoolType {
  anaokul = 'anaokul',
  ilkokul = 'ilkokul',
  ortaokul = 'ortaokul',
  /** Bitişik / tek kurumda 1–8 (MEB temel eğitim okulu) */
  temel_egitim = 'temel_egitim',
  lise = 'lise',
  meslek_lisesi = 'meslek_lisesi',
  fen_lisesi = 'fen_lisesi',
  sosyal_bilimler_lisesi = 'sosyal_bilimler_lisesi',
  anadolu_lisesi = 'anadolu_lisesi',
  cok_programli_anadolu_lisesi = 'cok_programli_anadolu_lisesi',
  acik_ogretim_lisesi = 'acik_ogretim_lisesi',
  guzel_sanatlar_lisesi = 'guzel_sanatlar_lisesi',
  spor_lisesi = 'spor_lisesi',
  imam_hatip_ortaokul = 'imam_hatip_ortaokul',
  imam_hatip_lise = 'imam_hatip_lise',
  ozel_egitim = 'ozel_egitim',
  /** MEB: Özel eğitim uygulama merkezleri (okuldan ayrı) */
  ozel_egitim_uygulama_merkezi = 'ozel_egitim_uygulama_merkezi',
  halk_egitim = 'halk_egitim',
  bilsem = 'bilsem',
  rehberlik_merkezi = 'rehberlik_merkezi',
  ogretmenevi_aksam_sanat = 'ogretmenevi_aksam_sanat',
  mesleki_egitim_merkezi = 'mesleki_egitim_merkezi',
}

export enum SchoolSegment {
  ozel = 'ozel',
  devlet = 'devlet',
}

export enum SchoolStatus {
  deneme = 'deneme',
  aktif = 'aktif',
  askida = 'askida',
}

/** Okul listesi: tek tür yerine kademe grubu filtresi (GET /schools?type_group=) */
export enum SchoolTypeGroup {
  ilkogretim = 'ilkogretim',
  lise_kademesi = 'lise_kademesi',
  kurum_diger = 'kurum_diger',
}
