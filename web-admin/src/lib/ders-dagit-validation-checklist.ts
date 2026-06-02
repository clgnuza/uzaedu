import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import type { ValidationIssue } from '@/lib/ders-dagit-timetable-api';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export type ValidationCheckResult = {
  id: string;
  label: string;
  description: string;
  href: string;
  status: CheckStatus;
  required: boolean;
  issues: ValidationIssue[];
};

export type ValidationCheckGroup = {
  id: string;
  label: string;
  checks: ValidationCheckResult[];
};

type CheckDef = {
  id: string;
  label: string;
  description: string;
  href: string;
  codes: string[];
  required?: boolean;
  probe?: (ctx: { overview: StudioOverview | null; issues: ValidationIssue[] }) => CheckStatus | null;
};

const CHECK_DEFS: CheckDef[] = [
  {
    id: 'classes',
    label: 'Sınıf profili ve şube',
    description: 'En az bir profil; şubeler tanımlı; kapasite sınırları',
    href: '/ders-dagit/studyo/kurulum',
    codes: ['MIN_CLASSES', 'CLASS_NO_SECTIONS', 'CLASS_OVER_CAPACITY', 'CLASS_UNDER_MIN', 'CLASS_OVER_MAX', 'SECTION_NO_HOURS'],
    probe: ({ overview }) => ((overview?.counts.classCount ?? 0) >= 1 ? null : 'fail'),
  },
  {
    id: 'period',
    label: 'Dönem / çalışma günleri',
    description: 'Haftalık ders günleri seçili',
    href: '/ders-dagit/studyo/donem',
    codes: ['PERIOD_NO_DAYS'],
    probe: ({ overview }) => {
      const st = overview?.studio.settings as { period?: { work_days?: number[] }; work_days?: number[] } | undefined;
      const days = st?.period?.work_days ?? st?.work_days;
      return days?.length ? null : 'fail';
    },
  },
  {
    id: 'teachers',
    label: 'Öğretmen sayısı',
    description: 'Dağıtım için en az iki öğretmen',
    href: '/ders-dagit/studyo/ogretmenler',
    codes: ['MIN_TEACHERS'],
    probe: ({ overview }) => ((overview?.counts.teacherCount ?? 0) >= 2 ? null : 'fail'),
  },
  {
    id: 'subjects',
    label: 'Ders kataloğu',
    description: 'Şubelere ders saati veya atama ile saat',
    href: '/ders-dagit/studyo/dersler',
    codes: ['MIN_SUBJECTS'],
    probe: ({ overview }) =>
      (overview?.counts.subjectCount ?? 0) >= 1 || (overview?.counts.assignmentCount ?? 0) >= 1 ? null : 'fail',
  },
  {
    id: 'assignments',
    label: 'Ders atamaları',
    description: 'En az bir atama kaydı',
    href: '/ders-dagit/studyo/atamalar',
    codes: ['MIN_ASSIGNMENTS', 'ASSIGN_NO_SECTION', 'ASSIGN_NO_TEACHER', 'BIWEEKLY_ODD'],
    probe: ({ overview }) => ((overview?.counts.assignmentCount ?? 0) >= 1 ? null : 'fail'),
  },
  {
    id: 'assignment_rooms',
    label: 'Derslik (önerilen)',
    description: 'Atamalarda derslik seçimi — zorunlu değil, üretim öncesi kontrol',
    href: '/ders-dagit/studyo/derslikler',
    codes: ['NO_ROOMS_LIST'],
    required: false,
  },
  {
    id: 'teacher_load',
    label: 'Öğretmen haftalık yükü',
    description: 'Zorunlu / ek ders limitleri',
    href: '/ders-dagit/studyo/ogretmenler',
    codes: ['TEACHER_OVER_MAX', 'TEACHER_UNDER_MIN'],
  },
  {
    id: 'aihl',
    label: 'AİHL haftalık norm',
    description: 'Kur\'an-ı Kerim, Temel Dini Bilgiler vb. için MEB haftalık üst sınırları',
    href: '/ders-dagit/studyo/secmeli',
    codes: ['AIHL_NORM_EXCEEDED'],
    required: false,
    probe: ({ overview }) => {
      const type = schoolTypeFromOverview(overview);
      if (type !== 'aihl') return 'skip';
      return null;
    },
  },
  {
    id: 'planning_rules',
    label: 'Planlama kuralları (üretim)',
    description: 'Zorunlu ve desteklenmeyen kural yok',
    href: '/ders-dagit/studyo/planlama-iliskileri',
    codes: ['PLANNING_STRICT_UNSUPPORTED'],
  },
  {
    id: 'duty',
    label: 'Nöbet çakışması',
    description: 'Yayınlı nöbet slotları üretimi etkiler',
    href: '/nobet',
    codes: ['DUTY_SLOTS_ACTIVE'],
    required: false,
  },
  {
    id: 'feasibility_teacher',
    label: 'Öğretmen slot yeterliliği',
    description: 'Kapalı saat, nöbet ve müsaitlik sonrası boş slot — ders yükü sığar mı',
    href: '/ders-dagit/studyo/ogretmenler',
    codes: ['TEACHER_SLOTS_INSUFFICIENT', 'TEACHER_SCHEDULE_TIGHT', 'TEACHER_HIGH_UNAVAILABLE'],
    required: false,
  },
  {
    id: 'feasibility_section',
    label: 'Şube slot yeterliliği',
    description: 'Kapalı/staj hücreleri ve haftalık ders ihtiyacı',
    href: '/ders-dagit/studyo/sinif-saatleri',
    codes: ['SECTION_SLOTS_INSUFFICIENT', 'SECTION_SCHEDULE_TIGHT'],
    required: false,
  },
  {
    id: 'feasibility_assignment',
    label: 'Atama kapalı saatleri',
    description: 'Atamada işaretlenen kapalı slotlar yerleşmeyi daraltır',
    href: '/ders-dagit/studyo/atamalar',
    codes: ['ASSIGN_SLOTS_BLOCKED'],
    required: false,
  },
];

function schoolTypeFromOverview(overview: StudioOverview | null): string | null {
  const sp = (overview?.studio?.settings as { school_profile?: { type?: string } } | undefined)?.school_profile;
  return sp?.type ?? null;
}

function statusFromIssues(matched: ValidationIssue[]): CheckStatus {
  if (matched.some((i) => i.severity === 'error')) return 'fail';
  if (matched.length) return 'warn';
  return 'pass';
}

const ALL_CHECK_CODES = new Set(CHECK_DEFS.flatMap((d) => d.codes));

export function buildValidationChecklist(
  issues: ValidationIssue[],
  overview: StudioOverview | null,
): {
  groups: ValidationCheckGroup[];
  allRequiredPass: boolean;
  errorCount: number;
  warnCount: number;
  uncategorized: ValidationIssue[];
} {
  const errors = issues.filter((i) => i.severity === 'error');
  const warns = issues.filter((i) => i.severity !== 'error');
  const checks: ValidationCheckResult[] = CHECK_DEFS.map((def) => {
    const matched = issues.filter((i) => def.codes.includes(i.code));
    let status = statusFromIssues(matched);
    let description = def.description;
    if (def.probe) {
      const probe = def.probe({ overview, issues });
      if (probe === 'skip') {
        status = 'skip';
        if (def.id === 'aihl') {
          description = 'Yalnızca okul türü «Anadolu İmam Hatip» seçiliyken kontrol edilir.';
        }
      } else if (probe === 'fail' && status === 'pass') {
        status = 'fail';
      } else if (probe === 'fail' && !matched.length) {
        matched.push({
          code: def.codes[0] ?? def.id,
          severity: 'error',
          message: def.description,
        });
      }
    }
    const required =
      def.id === 'aihl' && schoolTypeFromOverview(overview) === 'aihl'
        ? true
        : def.required !== false;
    return {
      id: def.id,
      label: def.label,
      description,
      href: def.href,
      status,
      required,
      issues: matched,
    };
  });

  const uncategorized = issues.filter((i) => !ALL_CHECK_CODES.has(i.code));

  if (uncategorized.length > 0) {
    checks.push({
      id: 'other',
      label: 'Diğer doğrulama kayıtları',
      description: 'Kategorize edilmemiş uyarı ve hatalar',
      href: '/ders-dagit/studyo/dogrulama',
      status: statusFromIssues(uncategorized),
      required: false,
      issues: uncategorized,
    });
  }

  const groups: ValidationCheckGroup[] = [
    { id: 'setup', label: 'Kurulum', checks: checks.filter((c) => ['classes', 'period', 'teachers', 'subjects'].includes(c.id)) },
    {
      id: 'assign',
      label: 'Atamalar ve yük',
      checks: checks.filter((c) =>
        ['assignments', 'assignment_rooms', 'teacher_load', 'aihl'].includes(c.id),
      ),
    },
    {
      id: 'feasibility',
      label: 'Yerleştirilebilirlik (önceden)',
      checks: checks.filter((c) =>
        ['feasibility_teacher', 'feasibility_section', 'feasibility_assignment'].includes(c.id),
      ),
    },
    { id: 'rules', label: 'Kurallar ve entegrasyon', checks: checks.filter((c) => ['planning_rules', 'duty', 'other'].includes(c.id)) },
  ];

  const allRequiredPass = checks
    .filter((c) => c.required)
    .every((c) => c.status === 'pass' || c.status === 'warn' || c.status === 'skip');

  return { groups, allRequiredPass, errorCount: errors.length, warnCount: warns.length, uncategorized };
}
