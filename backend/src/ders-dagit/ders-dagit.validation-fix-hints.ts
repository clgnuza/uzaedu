export const VALIDATION_FIX_HINTS: Record<string, { fix_hint: string; href?: string }> = {
  MIN_CLASSES: { fix_hint: 'Kurulumda en az bir profil oluşturup şube seçin (tüm şubeler tek profilde olabilir).', href: '/ders-dagit/studyo/kurulum' },
  MIN_TEACHERS: { fix_hint: 'Öğretmen senkronu yapın.', href: '/ders-dagit/studyo/ogretmenler' },
  CLASS_NO_SECTIONS: { fix_hint: 'Sınıf profiline şube ekleyin.', href: '/ders-dagit/studyo/kurulum' },
  CLASS_OVER_CAPACITY: {
    fix_hint: 'Günlük max dersi artırın veya atama saatini azaltın.',
    href: '/ders-dagit/studyo/kurulum',
  },
  CLASS_UNDER_MIN: { fix_hint: 'Ders kataloğu veya atama saatini artırın.', href: '/ders-dagit/studyo/dersler' },
  CLASS_OVER_MAX: { fix_hint: 'Fazla atamayı silin veya profil max haftalığı artırın.', href: '/ders-dagit/studyo/atamalar' },
  SECTION_NO_HOURS: { fix_hint: 'Dersler sayfasında şubeye saat ekleyin veya atama yapın.', href: '/ders-dagit/studyo/dersler' },
  TEACHER_OVER_MAX: { fix_hint: 'Öğretmen limiti veya atama saatini düşürün.', href: '/ders-dagit/studyo/ogretmenler' },
  TEACHER_UNDER_MIN: { fix_hint: 'Öğretmene daha fazla atama verin.', href: '/ders-dagit/studyo/atamalar' },
  NO_ROOMS_LIST: { fix_hint: 'Derslik seçin veya “derslik zorunlu” kuralını kapatın.', href: '/ders-dagit/studyo/kurallar' },
  BIWEEKLY_ODD: { fix_hint: 'İki haftada bir derslerin toplam saati çift olmalı.', href: '/ders-dagit/studyo/atamalar' },
  ASSIGN_NO_SECTION: { fix_hint: 'Atamaya sınıf/şube ekleyin.', href: '/ders-dagit/studyo/atamalar' },
  DUTY_SLOTS_ACTIVE: { fix_hint: 'Nöbet planı ile çakışmayı gözden geçirin.', href: '/nobet' },
  PERIOD_NO_DAYS: { fix_hint: 'Dönem sayfasında haftalık çalışma günlerini işaretleyin.', href: '/ders-dagit/studyo/donem' },
  MIN_ASSIGNMENTS: { fix_hint: 'Atamalar sayfasından yeni kayıt oluşturun.', href: '/ders-dagit/studyo/atamalar' },
  MIN_SUBJECTS: { fix_hint: 'Ders kataloğuna şube saatleri ekleyin.', href: '/ders-dagit/studyo/dersler' },
  ASSIGN_NO_TEACHER: { fix_hint: 'Atamaya öğretmen seçin.', href: '/ders-dagit/studyo/atamalar' },
  AIHL_NORM_EXCEEDED: { fix_hint: 'AİHL haftalık normunu aşmayın.', href: '/ders-dagit/studyo/atamalar' },
  PLANNING_STRICT_UNSUPPORTED: {
    fix_hint: 'Kuralı gevşetin veya kaldırın.',
    href: '/ders-dagit/studyo/kurallar',
  },
};

export function enrichValidationIssues<T extends { code: string; fix_hint?: string }>(issues: T[]): T[] {
  return issues.map((i) => {
    const h = VALIDATION_FIX_HINTS[i.code];
    if (!h) return i;
    return { ...i, fix_hint: i.fix_hint ?? h.fix_hint, ...(h.href ? { href: h.href } : {}) };
  });
}
