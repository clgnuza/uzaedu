/** Okul türüne göre hangi kurulum alanlarının gösterileceği */

export type MebSchoolType =
  | 'ilkokul'
  | 'ortaokul'
  | 'anadolu_lise'
  | 'mtal'
  | 'fen_lise'
  | 'aihl';

export type SchoolSetupCapabilities = {
  /** 12. sınıf YKS kolu */
  yksTrack: boolean;
  /** Staj / işletmede beceri yönlendirme kutusu */
  internshipGuidance: boolean;
  /** Sınıf profilinde staj günleri */
  classProfileInternship: boolean;
  /** Sınıf profilinde vardiya (ikili eğitim) */
  classProfileShift: boolean;
  /** Şube zaman tablosunda tam gün staj seçimi */
  sectionScheduleInternship: boolean;
  /** İkili eğitim / dönemde PM vurgusu */
  dualEducation: boolean;
};

const CAPS: Record<MebSchoolType, SchoolSetupCapabilities> = {
  ilkokul: {
    yksTrack: false,
    internshipGuidance: false,
    classProfileInternship: false,
    classProfileShift: false,
    sectionScheduleInternship: false,
    dualEducation: false,
  },
  ortaokul: {
    yksTrack: false,
    internshipGuidance: false,
    classProfileInternship: false,
    classProfileShift: false,
    sectionScheduleInternship: false,
    dualEducation: false,
  },
  anadolu_lise: {
    yksTrack: true,
    internshipGuidance: false,
    classProfileInternship: false,
    classProfileShift: false,
    sectionScheduleInternship: false,
    dualEducation: false,
  },
  fen_lise: {
    yksTrack: true,
    internshipGuidance: false,
    classProfileInternship: false,
    classProfileShift: false,
    sectionScheduleInternship: false,
    dualEducation: false,
  },
  aihl: {
    yksTrack: false,
    internshipGuidance: false,
    classProfileInternship: false,
    classProfileShift: false,
    sectionScheduleInternship: false,
    dualEducation: false,
  },
  mtal: {
    yksTrack: false,
    internshipGuidance: true,
    classProfileInternship: true,
    classProfileShift: true,
    sectionScheduleInternship: true,
    dualEducation: true,
  },
};

export function schoolSetupCapabilities(type: string | undefined | null): SchoolSetupCapabilities {
  const t = type as MebSchoolType;
  return CAPS[t] ?? CAPS.anadolu_lise;
}
