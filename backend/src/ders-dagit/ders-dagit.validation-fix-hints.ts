import { resolveValidationIssueHref } from './ders-dagit.validation-routes';

export const VALIDATION_FIX_HINTS: Record<string, { fix_hint: string }> = {
  MIN_CLASSES: { fix_hint: 'Kurulumda en az bir profil oluşturup şube seçin (tüm şubeler tek profilde olabilir).' },
  MIN_TEACHERS: { fix_hint: 'Öğretmenler sayfasında okuldan çekin veya öğretmen ekleyin.' },
  CLASS_NO_SECTIONS: { fix_hint: 'Kurulumda sınıf profiline şube ekleyin.' },
  CLASS_OVER_CAPACITY: {
    fix_hint: 'Kurulumda profilin günlük ders üst sınırını artırın veya atama saatlerini azaltın.',
  },
  CLASS_UNDER_MIN: { fix_hint: 'Dersler sayfasında şube saatleri ekleyin veya atama yapın.' },
  CLASS_OVER_MAX: { fix_hint: 'Kurulumda profil haftalık üst sınırını artırın veya fazla atamayı silin.' },
  SECTION_NO_HOURS: { fix_hint: 'Dersler sayfasında şubeye saat ekleyin veya atama yapın.' },
  TEACHER_OVER_MAX: { fix_hint: 'Öğretmenler sayfasında limitleri veya atama saatlerini düzenleyin.' },
  TEACHER_UNDER_MIN: { fix_hint: 'Atamalar sayfasında öğretmene daha fazla ders verin.' },
  NO_ROOMS_LIST: {
    fix_hint: 'İsteğe bağlı: atamada derslik seçin veya Derslikler sayfasından sınıf dersliği tanımlayın.',
  },
  BIWEEKLY_ODD: { fix_hint: 'Atamada iki haftada bir derslerin toplam saati çift olmalı.' },
  ASSIGN_NO_SECTION: { fix_hint: 'Atamaya sınıf/şube ekleyin.' },
  DUTY_SLOTS_ACTIVE: { fix_hint: 'Nöbet planını kontrol edin veya DersDağıt’ta nöbet senkronunu çalıştırın.' },
  PERIOD_NO_DAYS: { fix_hint: 'Dönem sayfasında haftalık çalışma günlerini işaretleyin.' },
  MIN_ASSIGNMENTS: { fix_hint: 'Atamalar sayfasından yeni kayıt oluşturun.' },
  MIN_SUBJECTS: { fix_hint: 'Dersler sayfasında şube saatleri ekleyin.' },
  ASSIGN_NO_TEACHER: { fix_hint: 'Atamaya öğretmen seçin.' },
  AIHL_NORM_EXCEEDED: { fix_hint: 'Seçmeli / AİHL kataloğuna ve atamalara göre haftalık normu düzenleyin.' },
  PLANNING_STRICT_UNSUPPORTED: {
    fix_hint: 'Planlama ilişkilerinde kuralı gevşetin veya kaldırın.',
  },
  TEACHER_SLOTS_INSUFFICIENT: {
    fix_hint: 'Öğretmen müsaitliği, nöbet veya atama yükünü düzenleyin; çalışma günü/saat artırın.',
  },
  TEACHER_SCHEDULE_TIGHT: {
    fix_hint: 'Kapalı saatleri azaltın veya atamayı başka öğretmene kaydırın.',
  },
  TEACHER_HIGH_UNAVAILABLE: {
    fix_hint: 'Müsaitlik onaylarını ve nöbet planını gözden geçirin.',
  },
  SECTION_SLOTS_INSUFFICIENT: {
    fix_hint: 'Sınıf saatleri sayfasında kapalı/staj hücrelerini açın veya ders saatini azaltın.',
  },
  SECTION_SCHEDULE_TIGHT: {
    fix_hint: 'Şube çizelgesinde kapalı günleri azaltın.',
  },
  ASSIGN_SLOTS_BLOCKED: {
    fix_hint: 'Atamadaki kapalı saat kurallarını gevşetin.',
  },
};

export function enrichValidationIssues<
  T extends {
    code: string;
    message: string;
    fix_hint?: string;
    href?: string;
    entity_type?: string;
    entity_id?: string;
  },
>(issues: T[]): (T & { href?: string })[] {
  return issues.map((i) => {
    const h = VALIDATION_FIX_HINTS[i.code];
    const href = resolveValidationIssueHref(i);
    return {
      ...i,
      fix_hint: i.fix_hint ?? h?.fix_hint,
      ...(href ? { href } : {}),
    };
  });
}
