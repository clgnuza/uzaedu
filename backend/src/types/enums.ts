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
  ilkokul = 'ilkokul',
  ortaokul = 'ortaokul',
  lise = 'lise',
  bilsem = 'bilsem',
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
