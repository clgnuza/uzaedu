/** Kural bazlı koşul editörü akışı — her rule_id için farklı adımlar ve ayarlar. */

import type { PlanningImportance } from '@/lib/planning-relations';
import { planningRuleListCopy } from '@/lib/planning-rule-list-copy';

export type SubjectPickMode = 'multi' | 'ordered_ab' | 'pair_exactly_2';

export type ParamFlowKind = 'max' | 'max_run' | 'min_gap' | 'lesson_nums' | 'none';

export type PlanningRuleFlowConfig = {
  title: string;
  intro: string;
  emoji: string;
  subjectMode: SubjectPickMode;
  subjectTitle: string;
  subjectHint: string;
  sectionsHint: string;
  paramKind: ParamFlowKind;
  paramTitle?: string;
  paramHint?: string;
  paramMin?: number;
  paramMax?: number;
  paramDefault?: number;
  importanceDefault: PlanningImportance;
  importanceHint: string;
  notePlaceholder: string;
  tips: string[];
  showAssignmentLink?: boolean;
  /** Ders seçimi zorunlu değil (öğretmen / genel kurallar). */
  subjectOptional?: boolean;
};

function flow(
  ruleId: string,
  kind: 'simple' | 'advanced',
  partial: Partial<PlanningRuleFlowConfig> & Pick<PlanningRuleFlowConfig, 'intro' | 'subjectTitle' | 'subjectHint'>,
): PlanningRuleFlowConfig {
  const copy = planningRuleListCopy(ruleId, kind);
  return {
    title: copy?.lead ?? ruleId,
    emoji: copy?.emoji ?? '📖',
    sectionsHint: 'Hangi şubelerde bu kural geçerli olsun?',
    paramKind: 'none',
    importanceDefault: 'normal',
    importanceHint: 'Normal önerilir; üretim çakışırsa esnetilir.',
    notePlaceholder: 'İsteğe bağlı not',
    tips: [],
    subjectMode: 'multi',
    ...partial,
  };
}

const FLOWS: Record<string, PlanningRuleFlowConfig> = {
  'simple:not_same_day': flow('not_same_day', 'simple', {
    intro: 'Haftalık saatler farklı günlere yayılır; özellikle 2 saatlik derslerde etkilidir.',
    subjectTitle: 'Hangi ders?',
    subjectHint: 'Tek ders veya birden fazla ders işaretleyebilirsiniz.',
    sectionsHint: 'Tüm okul veya belirli şubeler.',
    importanceHint: 'Genelde zorunlu tutulur; aynı gün yığılma engellenir.',
    tips: ['2 saatlik kartlarda iki gün zorunlu değilse bu kural devreye girer.'],
  }),
  'simple:not_consecutive_same_day': flow('not_consecutive_same_day', 'simple', {
    intro: 'Aynı gün içinde bitişik ders saatleri kullanılmaz.',
    subjectTitle: 'Hangi ders?',
    subjectHint: 'Seçilen dersin o günkü saatleri yan yana konmaz.',
    tips: ['Günde 2 saat varsa araya boş dilim kalır.'],
  }),
  'simple:distribute_week': flow('distribute_week', 'simple', {
    intro: 'Çok saatli dersler haftaya yayılır; tek güne yığma azalır.',
    subjectTitle: 'Yayılacak dersler',
    subjectHint: 'Haftada 3+ saat olan derslerde en belirgin sonuç verir.',
    importanceDefault: 'normal',
    importanceHint: 'Normal: diğer kurallarla çakışırsa esnetilebilir.',
    tips: ['Günde en fazla 2 slot kuralı ile birlikte çalışır.'],
  }),
  'simple:single_day': flow('single_day', 'simple', {
    intro: 'Haftalık saatler mümkünse tek günde toplanır.',
    subjectTitle: 'Blok ders',
    subjectHint: 'Haftalık 2 saatlik dersler için uygundur.',
    tips: ['Farklı günlere dağıtım bu kural ile çelişir.'],
  }),
  'simple:consecutive': flow('consecutive', 'simple', {
    intro: 'Aynı gündeki saatler bitişik dilimlerde olmalı.',
    subjectTitle: 'Ardışık yerleşecek ders',
    subjectHint: 'Gün içi dağınık saat bırakılmaz.',
    tips: ['2 saat aynı gündeyse 3. ve 5. saat gibi dağılım engellenir.'],
  }),
  'simple:parallel_start': flow('parallel_start', 'simple', {
    intro: 'Grup / bölünmüş şube dersleri aynı saatte başlar.',
    subjectMode: 'multi',
    subjectTitle: 'Grup dersleri',
    subjectHint: 'Paralel modu açık grup atamaları için işaretleyin.',
    sectionsHint: 'Grubun geçerli olduğu şubeleri seçin.',
    tips: ['Atamalarda grup paralel modunu da kontrol edin.'],
  }),
  'simple:first_or_last_period': flow('first_or_last_period', 'simple', {
    intro: 'Dersler günün erken veya son dilimlerine çekilir.',
    subjectTitle: 'Öncelikli dersler',
    subjectHint: 'Beden, müzik veya sınav dersleri için sık kullanılır.',
    importanceDefault: 'normal',
    tips: ['7. saat ve sonrası yerleşimde engellenir.'],
  }),
  'simple:max_consecutive': flow('max_consecutive', 'simple', {
    intro: 'Günde üst üste en fazla belirtilen kadar kesintisiz saat.',
    subjectTitle: 'Sınırlanacak ders',
    subjectHint: 'Öğretmen veya sınıf bazlı uzun blokları kısar.',
    paramKind: 'max_run',
    paramTitle: 'En fazla ardışık saat',
    paramHint: 'Örn. 4 — 5. ve üzeri ardışık blok oluşmaz.',
    paramDefault: 4,
    paramMin: 2,
    paramMax: 8,
  }),
  'simple:max_per_day': flow('max_per_day', 'simple', {
    intro: 'Bir günde aynı dersten en fazla belirtilen saat.',
    subjectTitle: 'Ders',
    subjectHint: 'Günde 1 veya 2 saat tavanı için.',
    paramKind: 'max',
    paramTitle: 'Günde en fazla saat',
    paramHint: '1 = günde tek saat; 2 = günde en fazla iki saat.',
    paramDefault: 2,
    paramMin: 1,
    paramMax: 4,
  }),
  'simple:minimize_gaps': flow('minimize_gaps', 'simple', {
    intro: 'Öğretmenin gün içi boş saatleri (pencere) azaltılır.',
    subjectTitle: 'Hangi dersler? (isteğe bağlı)',
    subjectHint: 'Boş bırakırsanız tüm derslerde öğretmen penceresi hedeflenir.',
    subjectOptional: true,
    sectionsHint: 'Öğretmenin ders verdiği şubeleri daraltabilirsiniz.',
    importanceDefault: 'normal',
    importanceHint: 'Yumuşak kural — tam sıfır pencere garanti değildir.',
    tips: ['Öğretmen müsaitlik ve çakışmalar önceliklidir.'],
  }),

  'advanced:adv_same_hour': flow('adv_same_hour', 'advanced', {
    intro: 'Seçilen ders kartları aynı gün ve saatte üst üste binemez.',
    subjectMode: 'pair_exactly_2',
    subjectTitle: 'Çakışmaması gereken iki ders',
    subjectHint: 'Tam iki ders seçin (ör. matematik ve fizik).',
    tips: ['Farklı öğretmen olsa bile aynı şube-saat yasaklanır.'],
  }),
  'advanced:adv_same_day': flow('adv_same_day', 'advanced', {
    intro: 'İki ders aynı takvim gününe konamaz.',
    subjectMode: 'pair_exactly_2',
    subjectTitle: 'Farklı günlerde olacak iki ders',
    subjectHint: 'Haftada 2 saatlik kartlar için ideal.',
  }),
  'advanced:adv_must_same_day': flow('adv_must_same_day', 'advanced', {
    intro: 'İki ders aynı günde toplanmalı.',
    subjectMode: 'pair_exactly_2',
    subjectTitle: 'Aynı günde olacak iki ders',
    subjectHint: 'Blok veya yakın saat için çift seçin.',
  }),
  'advanced:adv_not_consecutive_same_day': flow('adv_not_consecutive_same_day', 'advanced', {
    intro: 'Kartlar aynı günde yan yana saate konamaz.',
    subjectMode: 'pair_exactly_2',
    subjectTitle: 'İki ders kartı',
    subjectHint: 'Aynı gün ise arada boş dilim kalır.',
  }),
  'advanced:adv_max_gap': flow('adv_max_gap', 'advanced', {
    intro: 'Öğretmenin gün içindeki boş ders sayısı sınırlanır.',
    subjectTitle: 'Kapsam (isteğe bağlı)',
    subjectHint: 'Belirli dersler için öğretmen penceresi.',
    subjectOptional: true,
    paramKind: 'max',
    paramTitle: 'Günde en fazla boş saat',
    paramHint: 'Örn. 1 — günde en fazla bir pencere.',
    paramDefault: 1,
    paramMin: 0,
    paramMax: 4,
    importanceDefault: 'normal',
  }),
  'advanced:adv_max_consecutive': flow('adv_max_consecutive', 'advanced', {
    intro: 'Günde art arda en fazla belirtilen ders saati.',
    subjectTitle: 'Ders / kart',
    subjectHint: 'Ardışık blok sınırı uygulanacak dersleri seçin.',
    paramKind: 'max_run',
    paramTitle: 'Max ardışık saat',
    paramDefault: 4,
    paramMin: 2,
    paramMax: 8,
  }),
  'advanced:adv_min_gap_days': flow('adv_min_gap_days', 'advanced', {
    intro: 'İki ders günü arasında en az belirtilen boş gün.',
    subjectMode: 'pair_exactly_2',
    subjectTitle: 'İki günlük dağılımı olan ders',
    subjectHint: 'Haftada 2 saat — farklı günler arası mesafe.',
    paramKind: 'min_gap',
    paramTitle: 'En az gün arası',
    paramHint: '2 = en az bir gün ara (Pzt–Çar gibi).',
    paramDefault: 2,
    paramMin: 2,
    paramMax: 6,
  }),
  'advanced:adv_max_days_week': flow('adv_max_days_week', 'advanced', {
    intro: 'Ders en fazla belirtilen sayıda farklı günde görünür.',
    subjectTitle: 'Ders',
    subjectHint: 'Atama kartında max gün yoksa bu değer uygulanır.',
    paramKind: 'max',
    paramTitle: 'Haftada en fazla gün',
    paramHint: 'Örn. 3 — haftada en fazla 3 farklı gün.',
    paramDefault: 3,
    paramMin: 1,
    paramMax: 5,
  }),
  'advanced:adv_max_per_day': flow('adv_max_per_day', 'advanced', {
    intro: 'Günde en fazla belirtilen saat sayısı.',
    subjectTitle: 'Ders kartı',
    subjectHint: 'Günlük üst sınır uygulanacak dersleri işaretleyin.',
    paramKind: 'max',
    paramTitle: 'Günde max saat',
    paramDefault: 2,
    paramMin: 1,
    paramMax: 4,
  }),
  'advanced:adv_max_same_period': flow('adv_max_same_period', 'advanced', {
    intro: 'Aynı ders sırası (ör. hep 2. saat) haftada sınırlı tekrar.',
    subjectTitle: 'Ders',
    subjectHint: 'Aynı saat diliminde tekrar sınırlanacak ders.',
    paramKind: 'max',
    paramTitle: 'Aynı saatte max gün',
    paramHint: 'Örn. 2 — 2. saatte haftada en fazla 2 gün.',
    paramDefault: 2,
    paramMin: 1,
    paramMax: 5,
  }),
  'advanced:adv_parallel_start': flow('adv_parallel_start', 'advanced', {
    intro: 'Grup kartları aynı anda başlar.',
    subjectTitle: 'Grup dersleri',
    subjectHint: 'Paralel grup atamalarını işaretleyin.',
    sectionsHint: 'Grubun olduğu şubeler.',
  }),
  'advanced:adv_a_before_b_week': flow('adv_a_before_b_week', 'advanced', {
    intro: 'Hafta içinde A dersinin tüm saatleri, B’den önce gelir.',
    subjectMode: 'ordered_ab',
    subjectTitle: 'Önce / sonra ders çifti',
    subjectHint: 'A = önce, B = sonra (sıra önemli).',
    tips: ['Örn. matematik (A) her zaman fizikten (B) önce.'],
  }),
  'advanced:adv_fixed_hours': flow('adv_fixed_hours', 'advanced', {
    intro: 'Yalnız atamada sabitlenen saatler kullanılır.',
    subjectTitle: 'Sabit slotlu dersler',
    subjectHint: 'Sabit saat tanımlı atamaları seçin.',
    paramKind: 'none',
    importanceDefault: 'strict',
    showAssignmentLink: true,
    tips: ['Atama diyaloğunda gün/saat kilidi gerekir.', 'Üretim sabit slotları oynatmaz.'],
  }),
  'advanced:adv_no_start_hour': flow('adv_no_start_hour', 'advanced', {
    intro: 'İşaretlenen dilimlerde ders başlangıcı yok.',
    subjectTitle: 'Kapsanan dersler',
    subjectHint: 'Öğle, toplantı veya geçiş saatleri için.',
    paramKind: 'lesson_nums',
    paramTitle: 'Başlangıç yasak dilimler',
    paramHint: 'Yasak olduğu dilimleri işaretleyin.',
  }),
  'advanced:adv_no_end_hour': flow('adv_no_end_hour', 'advanced', {
    intro: 'İşaretlenen dilimlerde ders bloğu bitemez.',
    subjectTitle: 'Kapsanan dersler',
    subjectHint: 'Bitiş yasağı olan dilimlere denk gelen dersler.',
    paramKind: 'lesson_nums',
    paramTitle: 'Bitiş yasak dilimler',
    paramHint: 'Kapanış öncesi dilimleri işaretleyin.',
  }),
  'advanced:adv_faster_than_curriculum': flow('adv_faster_than_curriculum', 'advanced', {
    intro: 'Haftalık saatler az sayıda güne sıkıştırılmaz.',
    subjectTitle: 'Yayılım uygulanacak ders',
    subjectHint: 'Çok saatli derslerde müfredat temposu korunur.',
    importanceDefault: 'normal',
    tips: ['Haftaya yayılım tercih edilir.'],
  }),
};

const DEFAULT_FLOW: PlanningRuleFlowConfig = {
  title: 'Planlama kuralı',
  intro: 'Ders, şube ve isteğe bağlı sayısal koşulu tanımlayın.',
  emoji: '📖',
  subjectMode: 'multi',
  subjectTitle: 'Dersler',
  subjectHint: 'Yalnız seçili ders atamalarına uygulanır.',
  sectionsHint: 'Tüm okul veya seçili şubeler.',
  paramKind: 'none',
  importanceDefault: 'normal',
  importanceHint: 'Üretim önceliğini belirleyin.',
  notePlaceholder: 'Not (isteğe bağlı)',
  tips: [],
};

export function getPlanningRuleFlow(ruleId: string, kind: 'simple' | 'advanced'): PlanningRuleFlowConfig {
  return FLOWS[`${kind}:${ruleId}`] ?? DEFAULT_FLOW;
}

export function flowParamKey(kind: ParamFlowKind): 'max' | 'max_run' | 'min_gap' | null {
  if (kind === 'max_run') return 'max_run';
  if (kind === 'min_gap') return 'min_gap';
  if (kind === 'max') return 'max';
  return null;
}

export function defaultParamsForFlow(flow: PlanningRuleFlowConfig): Record<string, unknown> | undefined {
  if (flow.paramKind === 'lesson_nums') return { blocked_lessons: [] };
  const key = flowParamKey(flow.paramKind);
  if (!key) return undefined;
  const v = flow.paramDefault ?? (key === 'max_run' ? 4 : key === 'min_gap' ? 2 : 2);
  return { [key]: v };
}

export function minSubjectsForFlow(flow: PlanningRuleFlowConfig): number {
  if (flow.subjectOptional) return 0;
  if (flow.subjectMode === 'pair_exactly_2' || flow.subjectMode === 'ordered_ab') return 2;
  return 1;
}

export function subjectsStepDone(flow: PlanningRuleFlowConfig, subjectIds: string[]): boolean {
  if (flow.subjectOptional) return true;
  if (flow.subjectMode === 'pair_exactly_2' || flow.subjectMode === 'ordered_ab') {
    return subjectIds.length === 2;
  }
  return subjectIds.length >= 1;
}
