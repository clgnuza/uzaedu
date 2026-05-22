import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';

export type ReadinessPhase = 'data' | 'rules' | 'program';

export type ReadinessStep = {
  id: string;
  label: string;
  href: string;
  done: boolean;
  required?: boolean;
};

export type StudioReadiness = {
  percent: number;
  phases: Record<ReadinessPhase, { label: string; percent: number; steps: ReadinessStep[] }>;
  errorCount: number;
  warnCount: number;
  canGenerate: boolean;
  canPublish: boolean;
  blockReason?: string;
};

export function computeStudioReadiness(overview: StudioOverview | null): StudioReadiness {
  if (!overview) {
    return {
      percent: 0,
      phases: { data: { label: 'Veri', percent: 0, steps: [] }, rules: { label: 'Kurallar', percent: 0, steps: [] }, program: { label: 'Program', percent: 0, steps: [] } },
      errorCount: 0,
      warnCount: 0,
      canGenerate: false,
      canPublish: false,
      blockReason: 'Stüdyo yüklenemedi',
    };
  }
  const c = overview.counts;
  const errors = overview.validation.filter((v) => v.severity === 'error');
  const warns = overview.validation.filter((v) => v.severity !== 'error');
  const st = overview.studio.settings as { period?: { work_days?: number[] }; work_days?: number[] } | undefined;
  const periodOk = !!((st?.period?.work_days ?? st?.work_days)?.length);

  const dataSteps: ReadinessStep[] = [
    { id: 'class', label: 'Sınıf profili', href: '/ders-dagit/stüdyo/kurulum', done: (c.classCount ?? 0) >= 1, required: true },
    { id: 'period', label: 'Dönem / günler', href: '/ders-dagit/stüdyo/donem', done: periodOk, required: true },
    { id: 'subject', label: 'Dersler', href: '/ders-dagit/stüdyo/dersler', done: (c.subjectCount ?? 0) >= 1, required: true },
    { id: 'teacher', label: 'Öğretmenler', href: '/ders-dagit/stüdyo/ogretmenler', done: (c.teacherCount ?? 0) >= 1, required: true },
    { id: 'assign', label: 'Atamalar', href: '/ders-dagit/stüdyo/atamalar', done: (c.assignmentCount ?? 0) >= 1, required: true },
  ];
  const rulesSteps: ReadinessStep[] = [
    { id: 'rules', label: 'Kurallar', href: '/ders-dagit/stüdyo/kurallar', done: true },
    { id: 'validate', label: 'Doğrulama temiz', href: '/ders-dagit/stüdyo/dogrulama', done: errors.length === 0, required: true },
  ];
  const programSteps: ReadinessStep[] = [
    { id: 'programs', label: 'En az 1 program', href: '/ders-dagit/stüdyo/uret', done: (c.programCount ?? 0) >= 1 },
    { id: 'editor', label: 'Program editörü', href: '/ders-dagit/stüdyo/program', done: (c.programCount ?? 0) >= 1 },
  ];

  const phasePct = (steps: ReadinessStep[]) => {
    const req = steps.filter((s) => s.required !== false);
    if (!req.length) return 100;
    return Math.round((req.filter((s) => s.done).length / req.length) * 100);
  };

  const phases = {
    data: { label: 'Veri', percent: phasePct(dataSteps), steps: dataSteps },
    rules: { label: 'Kurallar', percent: phasePct(rulesSteps), steps: rulesSteps },
    program: { label: 'Program', percent: phasePct(programSteps), steps: programSteps },
  };
  const percent = Math.round((phases.data.percent + phases.rules.percent + phases.program.percent) / 3);
  const canGenerate = dataSteps.filter((s) => s.required).every((s) => s.done) && errors.length === 0;
  const canPublish = canGenerate && (c.programCount ?? 0) >= 1;

  let blockReason: string | undefined;
  if (errors.length > 0) blockReason = `${errors.length} doğrulama hatası`;
  else if ((c.assignmentCount ?? 0) < 1) blockReason = 'Atama eksik';

  return {
    percent,
    phases,
    errorCount: errors.length,
    warnCount: warns.length,
    canGenerate,
    canPublish,
    blockReason,
  };
}
