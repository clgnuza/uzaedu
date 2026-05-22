export const VALIDATION_FIX_HINTS: Record<string, { fix_hint: string; href?: string }> = {
  MIN_CLASSES: { fix_hint: 'En az iki sınıf profili ekleyin.', href: '/ders-dagit/stüdyo/kurulum' },
  MIN_TEACHERS: { fix_hint: 'Öğretmen senkronu yapın.', href: '/ders-dagit/stüdyo/ogretmenler' },
  CLASS_NO_SECTIONS: { fix_hint: 'Sınıf profiline şube ekleyin.', href: '/ders-dagit/stüdyo/kurulum' },
  CLASS_OVER_CAPACITY: {
    fix_hint: 'Günlük max dersi artırın veya atama saatini azaltın.',
    href: '/ders-dagit/stüdyo/kurulum',
  },
  CLASS_UNDER_MIN: { fix_hint: 'Ders kataloğu veya atama saatini artırın.', href: '/ders-dagit/stüdyo/dersler' },
  CLASS_OVER_MAX: { fix_hint: 'Fazla atamayı silin veya profil max haftalığı artırın.', href: '/ders-dagit/stüdyo/atamalar' },
  SECTION_NO_HOURS: { fix_hint: 'Bu şube için ders veya atama tanımlayın.', href: '/ders-dagit/stüdyo/atamalar' },
  TEACHER_OVER_MAX: { fix_hint: 'Öğretmen limiti veya atama saatini düşürün.', href: '/ders-dagit/stüdyo/ogretmenler' },
  TEACHER_UNDER_MIN: { fix_hint: 'Öğretmene daha fazla atama verin.', href: '/ders-dagit/stüdyo/atamalar' },
  NO_ROOMS_LIST: { fix_hint: 'Derslik seçin veya “derslik zorunlu” kuralını kapatın.', href: '/ders-dagit/stüdyo/kurallar' },
  BIWEEKLY_ODD: { fix_hint: 'İki haftada bir derslerin toplam saati çift olmalı.', href: '/ders-dagit/stüdyo/atamalar' },
  ASSIGN_NO_SECTION: { fix_hint: 'Atamaya sınıf/şube ekleyin.', href: '/ders-dagit/stüdyo/atamalar' },
  DUTY_SLOTS_ACTIVE: { fix_hint: 'Nöbet planı ile çakışmayı gözden geçirin.', href: '/nobet' },
};

export function enrichValidationIssues<T extends { code: string; fix_hint?: string }>(issues: T[]): T[] {
  return issues.map((i) => {
    const h = VALIDATION_FIX_HINTS[i.code];
    if (!h) return i;
    return { ...i, fix_hint: i.fix_hint ?? h.fix_hint, ...(h.href ? { href: h.href } : {}) };
  });
}
