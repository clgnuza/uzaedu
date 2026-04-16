/** `ButterflyExamPlan.rules` JSON şeması */
export interface ButterflyExamRules {
  /** Katılımcı: tüm okul | seçili sınıflar | seçili öğrenci id */
  participantMode?: 'all' | 'classes' | 'students';
  participantClassIds?: string[];
  participantStudentIds?: string[];
  /** Bu oturumda kullanılacak salonlar; boş veya yoksa tüm salonlar */
  roomIds?: string[];
  /** PDF / liste altı açıklama satırları (sınav planı notları) */
  reportFooterLines?: string[];
  /** Rapor başlığında gösterilecek ders / sınav etiketi */
  subjectLabel?: string;
  /** Örn. "5. Ders", "Normal saat" */
  lessonPeriodLabel?: string;
  /** Tüm binalar birlikte mi, yoksa bina içi yerleştirme */
  buildingPlacementStrategy?: 'inter_building' | 'intra_building';
  /** Manuel sabit koltuklar (yeniden dağıtımda korunur) */
  pinnedSeats?: Array<{ studentId: string; roomId: string; seatIndex: number }>;
  /** Sabit öğrenciler – yerleştirmede öncelikli ve koltuk değiştirilemez olarak işaretlenen öğrenci id listesi */
  pinnedStudentIds?: string[];
  /** Sabit sınıflar – kendi dersliklerinde sınava alınacak sınıf id listesi */
  fixedClassIds?: string[];
  /** Öğrenci sıralama kriteri */
  studentSortOrder?: 'student_number' | 'alphabetical' | 'random';
  /** Salon dolum yönü */
  fillDirection?: 'ltr' | 'rtl' | 'alternating';
  /** Sabit öğrenciler önce yerleştirilir */
  prioritizePinned?: boolean;
  /**
   * Sabit öğrenciler yerleştirme sonrası kilitli kaydedilir (yeniden dağıtımda yer değiştirmez; taşıma için API ile kilit kaldırılır).
   * `pinnedSeats` ile verilen koltuklar zaten kilit kabul edilir.
   */
  lockPinnedAssignments?: boolean;
  /** İhtiyaç sahibi öğrenciler ön sıraya */
  specialNeedsInFront?: boolean;
  /** Gözetmen modu */
  proctorMode?: 'auto' | 'manual';
  /** Salon başına gözetmen sayısı (auto modda) */
  proctorsPerRoom?: number;
  /** Aynı sınıftan iki öğrenci yan yana (aynı salon, ardışık sıra) */
  sameClassAdjacent?: 'forbid' | 'allow';
  /** Aynı sınıf arada bir sıra */
  sameClassSkipOne?: 'forbid' | 'allow';
  /** round_robin: klasik; constraint_greedy: kurala göre; swap_optimize: iyileştirme */
  distributionMode?: 'round_robin' | 'constraint_greedy' | 'swap_optimize';
  /** Salon doldurma yöntemi: balanced=dengeli / sequential=sırayla doldur */
  fillMode?: 'balanced' | 'sequential';
  /** Cinsiyet kuralı: kız-erkek yan yana oturabilir mi */
  genderRule?: 'can_sit_adjacent' | 'cannot_sit_adjacent';
  /** Ek kısıtlar */
  constraints?: Array<'no_back_to_back' | 'no_cross' | 'single_in_pair_row'>;
  /** Sınıf karışımı: aynı sınıf öğrencileri aynı salonda olabilir mi */
  classMix?: 'can_mix' | 'cannot_mix';
  /** Ders seçimi: her sınıf için ders atamaları ({classId, subjectName}) */
  classSubjectAssignments?: Array<{ classId: string; subjectName: string }>;
  /** Plan tipi: 'period' = dönem planı (alt sınav container), 'exam' = bireysel sınav */
  planType?: 'period' | 'exam';
  /** Üst dönem planı kimliği (sadece planType==='exam' olanlarda kullanılır) */
  parentPlanId?: string;
  /** Sınav kağıdı yapılandırması */
  examPaperConfig?: {
    /** Kağıt başına toplam sayfa sayısı */
    pageCount: number;
    /** Kullanılacak (basılacak) sayfa sayısı */
    usedPageCount: number;
    /** Sürüklenerek yerleştirilen alanlar */
    fields: Array<{
      fieldType: 'studentName' | 'studentNumber' | 'className' | 'attendance';
      label: string;
      pageIndex: number;
      /** 0-100 yüzde konum (A4'te sol kenardan) */
      xPct: number;
      /** 0-100 yüzde konum (A4'te üstten) */
      yPct: number;
    }>;
  };
}

export const DEFAULT_BUTTERFLY_RULES: ButterflyExamRules = {
  participantMode: 'all',
  sameClassAdjacent: 'forbid',
  sameClassSkipOne: 'forbid',
  distributionMode: 'constraint_greedy',
  fillMode: 'balanced',
  genderRule: 'can_sit_adjacent',
  classMix: 'can_mix',
};

export function mergeButterflyRules(raw: Record<string, unknown> | null | undefined): ButterflyExamRules {
  const r = raw ?? {};
  const mode = r.distributionMode;
  const dm =
    mode === 'round_robin' || mode === 'constraint_greedy' || mode === 'swap_optimize' ? mode : 'constraint_greedy';
  const bps = r.buildingPlacementStrategy;
  const strategy =
    bps === 'intra_building' || bps === 'inter_building' ? bps : ('inter_building' as const);

  const constraints = Array.isArray(r.constraints)
    ? (r.constraints as string[]).filter((c) =>
        ['no_back_to_back', 'no_cross', 'single_in_pair_row'].includes(c),
      ) as ButterflyExamRules['constraints']
    : undefined;

  const classSubjectAssignments = Array.isArray(r.classSubjectAssignments)
    ? (r.classSubjectAssignments as Array<{ classId?: string; subjectName?: string }>).filter(
        (a) => typeof a.classId === 'string' && typeof a.subjectName === 'string',
      ) as ButterflyExamRules['classSubjectAssignments']
    : undefined;

  return {
    ...DEFAULT_BUTTERFLY_RULES,
    participantMode:
      r.participantMode === 'classes' || r.participantMode === 'students' ? r.participantMode : 'all',
    participantClassIds: Array.isArray(r.participantClassIds)
      ? (r.participantClassIds as unknown[]).map((x) => String(x))
      : undefined,
    participantStudentIds: Array.isArray(r.participantStudentIds)
      ? (r.participantStudentIds as unknown[]).map((x) => String(x))
      : undefined,
    roomIds:
      Array.isArray(r.roomIds) && (r.roomIds as unknown[]).length > 0
        ? [...new Set((r.roomIds as unknown[]).map((x) => String(x)).filter(Boolean))]
        : undefined,
    reportFooterLines: Array.isArray(r.reportFooterLines)
      ? (r.reportFooterLines as unknown[])
          .map((x) => String(x ?? '').trim())
          .filter(Boolean)
          .slice(0, 40)
      : undefined,
    subjectLabel: typeof r.subjectLabel === 'string' && r.subjectLabel.trim() ? r.subjectLabel.trim() : undefined,
    lessonPeriodLabel:
      typeof r.lessonPeriodLabel === 'string' && r.lessonPeriodLabel.trim() ? r.lessonPeriodLabel.trim() : undefined,
    buildingPlacementStrategy: strategy,
    pinnedSeats: Array.isArray(r.pinnedSeats)
      ? (r.pinnedSeats as Array<{ studentId?: string; roomId?: string; seatIndex?: number }>).filter(
          (p) => p && typeof p.studentId === 'string' && typeof p.roomId === 'string' && typeof p.seatIndex === 'number',
        ) as ButterflyExamRules['pinnedSeats']
      : undefined,
    studentSortOrder: ['student_number','alphabetical','random'].includes(r.studentSortOrder as string)
      ? r.studentSortOrder as ButterflyExamRules['studentSortOrder'] : 'student_number',
    fillDirection: ['ltr','rtl','alternating'].includes(r.fillDirection as string)
      ? r.fillDirection as ButterflyExamRules['fillDirection'] : 'ltr',
    prioritizePinned: r.prioritizePinned === true,
    lockPinnedAssignments: r.lockPinnedAssignments === true,
    specialNeedsInFront: r.specialNeedsInFront === true,
    proctorMode: r.proctorMode === 'manual' ? 'manual' : 'auto',
    proctorsPerRoom: typeof r.proctorsPerRoom === 'number' ? r.proctorsPerRoom : 2,
    fixedClassIds: Array.isArray(r.fixedClassIds)
      ? (r.fixedClassIds as unknown[]).map((x) => String(x)).filter(Boolean)
      : undefined,
    pinnedStudentIds: Array.isArray(r.pinnedStudentIds)
      ? (r.pinnedStudentIds as unknown[]).map((x) => String(x)).filter(Boolean)
      : undefined,
    sameClassAdjacent: r.sameClassAdjacent === 'allow' ? 'allow' : 'forbid',
    sameClassSkipOne: r.sameClassSkipOne === 'allow' ? 'allow' : 'forbid',
    distributionMode: dm,
    fillMode: r.fillMode === 'sequential' ? 'sequential' : 'balanced',
    genderRule: r.genderRule === 'cannot_sit_adjacent' ? 'cannot_sit_adjacent' : 'can_sit_adjacent',
    classMix: r.classMix === 'cannot_mix' ? 'cannot_mix' : 'can_mix',
    constraints: constraints?.length ? constraints : undefined,
    classSubjectAssignments: classSubjectAssignments?.length ? classSubjectAssignments : undefined,
    planType: r.planType === 'period' ? 'period' : r.planType === 'exam' ? 'exam' : undefined,
    parentPlanId: typeof r.parentPlanId === 'string' ? r.parentPlanId : undefined,
    examPaperConfig: (() => {
      const cfg = r.examPaperConfig as Record<string, unknown> | undefined;
      if (!cfg || typeof cfg !== 'object') return undefined;
      const fields = Array.isArray(cfg.fields)
        ? (cfg.fields as Array<Record<string, unknown>>).filter(
            (f) =>
              ['studentName', 'studentNumber', 'className', 'attendance'].includes(f.fieldType as string) &&
              typeof f.xPct === 'number' &&
              typeof f.yPct === 'number',
          )
        : [];
      return {
        pageCount: typeof cfg.pageCount === 'number' ? cfg.pageCount : 1,
        usedPageCount: typeof cfg.usedPageCount === 'number' ? cfg.usedPageCount : 1,
        fields: fields as NonNullable<ButterflyExamRules['examPaperConfig']>['fields'],
      };
    })(),
  };
}
