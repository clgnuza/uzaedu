import { planningRuleListCopy, type PlanningRuleListTone } from '@/lib/planning-rule-list-copy';

/** Planlama ilişkisi ekleme kartı — ders / öğretmen / ilişki / kısıt. */
export type PlanningRuleScope = 'ders' | 'ogretmen' | 'iliski' | 'kisit';

export const PLANNING_SCOPE_ORDER: PlanningRuleScope[] = ['ders', 'ogretmen', 'iliski', 'kisit'];

export const PLANNING_SCOPE_META: Record<
  PlanningRuleScope,
  {
    label: string;
    emoji: string;
    addTitle: string;
    addHint: string;
    pickerHint: string;
    editorLead: string;
  }
> = {
  ders: {
    label: 'Ders',
    emoji: '📚',
    addTitle: 'Ders kuralı',
    addHint: 'Haftalık yayılım, günlük tavan, ardışık saat — seçili ders kartlarına.',
    pickerHint: 'Önce ders(ler), sonra şube kapsamı.',
    editorLead: 'Hangi ders atamalarına uygulanacak?',
  },
  ogretmen: {
    label: 'Öğretmen',
    emoji: '👩‍🏫',
    addTitle: 'Öğretmen kuralı',
    addHint: 'Gün içi pencere, boş saat — öğretmen programına; ders seçimi isteğe bağlı.',
    pickerHint: 'Şube daraltabilirsiniz; ders listesi boş bırakılabilir.',
    editorLead: 'Öğretmenin hangi atamaları kapsansın? (boş = tümü)',
  },
  iliski: {
    label: 'İlişki',
    emoji: '🔗',
    addTitle: 'Ders ilişkisi',
    addHint: 'İki ders kartı: aynı gün, farklı gün, sıra (A→B), grup eşzamanı.',
    pickerHint: 'Tam iki ders veya sıralı çift seçin.',
    editorLead: 'İlişkili ders kartları',
  },
  kisit: {
    label: 'Kısıt',
    emoji: '⏰',
    addTitle: 'Saat kısıtı',
    addHint: 'Dilim yasağı, sabit slot, ardışık üst sınır — sayı veya saat listesi.',
    pickerHint: 'Önce sayısal ayar veya yasak dilimler, sonra kapsam.',
    editorLead: 'Kısıtın geçerli olduğu dersler',
  },
};

export function scopeFromTone(tone: PlanningRuleListTone): PlanningRuleScope {
  switch (tone) {
    case 'teacher':
      return 'ogretmen';
    case 'slot':
      return 'kisit';
    case 'cards':
      return 'iliski';
    case 'group':
      return 'ders';
    default:
      return 'ders';
  }
}

export function scopeForRule(ruleId: string, kind: 'simple' | 'advanced'): PlanningRuleScope {
  const copy = planningRuleListCopy(ruleId, kind);
  return copy ? scopeFromTone(copy.tone) : 'ders';
}

export function importanceHintForScope(scope: PlanningRuleScope): string {
  const base =
    'Normal öncelik üretimi kilitlemez; çakışırsa motor esnetir. Zorunlu yalnızca mutlaka uyulması gereken durumlarda.';
  if (scope === 'ogretmen') {
    return `${base} Öğretmen kuralları çoğunlukla Normal ile yeterlidir.`;
  }
  if (scope === 'kisit') {
    return `${base} Sabit saatler dışında Zorunlu nadiren gerekir.`;
  }
  return base;
}
