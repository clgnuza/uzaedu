import type { MebSchoolType } from './ders-dagit.school-profile';
import type { DersDagitGroupMode } from './ders-dagit.groups';

export type GroupSchoolPreset = {
  id: string;
  label: string;
  description: string;
  parallel_mode: DersDagitGroupMode;
  name_placeholder: string;
  abbr_placeholder: string;
};

export function defaultGroupModeForSchool(type: MebSchoolType | string): DersDagitGroupMode {
  if (type === 'mtal') return 'parallel_rooms';
  return 'subgroups';
}

export function groupPresetsForSchool(type: MebSchoolType | string): GroupSchoolPreset[] {
  const commonSub: GroupSchoolPreset = {
    id: 'sub_track',
    label: 'Sınıf kolları (5A-A / 5A-B)',
    description: 'Aynı sınıfın bölünmüş şubeleri; aynı ders saatinde alt gruplar.',
    parallel_mode: 'subgroups',
    name_placeholder: '5A alt gruplar',
    abbr_placeholder: '5a',
  };
  const commonPar: GroupSchoolPreset = {
    id: 'par_rooms',
    label: 'Paralel derslik',
    description: 'Aynı saatte farklı odalarda işlenen ders (beden, seçmeli, atölye).',
    parallel_mode: 'parallel_rooms',
    name_placeholder: '9. sınıf paralel',
    abbr_placeholder: '9par',
  };
  const teacherMulti: GroupSchoolPreset = {
    id: 'teacher_multi',
    label: 'Öğretmen çoklu sınıf',
    description: 'Öğretmen aynı saatte birden fazla şubede (birleşik grup).',
    parallel_mode: 'teacher_multi_class',
    name_placeholder: 'Birleşik şube',
    abbr_placeholder: 'bir',
  };

  switch (type) {
    case 'mtal':
      return [
        {
          id: 'mtal_atolye',
          label: 'Atölye / uygulama paralel',
          description: 'Meslek dersi veya atölyede aynı anda farklı şubeler farklı odalarda.',
          parallel_mode: 'parallel_rooms',
          name_placeholder: '11 Elektrik atölye',
          abbr_placeholder: '11el',
        },
        {
          id: 'mtal_dal',
          label: 'Dal / alan kolları',
          description: '11 ELEKTRİK, 11 MAKİNE gibi alan adlı şubeler.',
          parallel_mode: 'subgroups',
          name_placeholder: '11. sınıf dallar',
          abbr_placeholder: '11',
        },
        teacherMulti,
      ];
    case 'ortaokul':
    case 'ilkokul':
      return [commonSub];
    case 'aihl':
      return [commonSub, commonPar];
    case 'fen_lise':
    case 'anadolu_lise':
    default:
      return [commonSub, commonPar, teacherMulti];
  }
}

export function schoolTypeGroupHint(type: MebSchoolType | string): string {
  switch (type) {
    case 'mtal':
      return 'MTAL: atölye ve dal şubeleri için genelde «Paralel derslik» veya «Dal kolları». Staj/ikili eğitim şubeleri Kurulum → Sınıf profillerinde tanımlanır.';
    case 'ortaokul':
      return 'Ortaokul: seçmeli ve bölünmüş şubeler (5A-A / 5A-B) için «Alt gruplar» yeterlidir.';
    case 'ilkokul':
      return 'İlkokulda paralel grup nadiren gerekir; birleştirilmiş sınıflar için alt grup kullanın.';
    case 'aihl':
      return 'İmam hatip: seçmeli kollar ve bölünmüş şubeler için alt grup; birleşik beden/din için paralel derslik.';
    case 'fen_lise':
      return 'Fen lisesi: laboratuvar ve bölünmüş şubeler için alt grup veya paralel derslik.';
    default:
      return 'Şube adlarında 5A-A / 5A-B veya çoklu şubeli atamalardan otomatik öneri alın.';
  }
}
