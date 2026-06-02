import type { StudioOverview } from '@/hooks/use-ders-dagit-studio';
import { filterGenerateBlockingIssues } from '@/lib/ders-dagit-generate-gate';

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
  const errors = filterGenerateBlockingIssues(overview.validation);
  const blockingKeys = new Set(errors.map((e) => `${e.code}\0${e.message}`));
  const warns = overview.validation.filter((v) => !blockingKeys.has(`${v.code}\0${v.message}`));
  const st = overview.studio.settings as { period?: { work_days?: number[] }; work_days?: number[] } | undefined;
  const periodOk = !!((st?.period?.work_days ?? st?.work_days)?.length);

  const dataSteps: ReadinessStep[] = [
    { id: 'class', label: 'Şube tanımlı', href: '/ders-dagit/studyo/kurulum', done: (c.classCount ?? 0) >= 1, required: true },
    { id: 'period', label: 'Dönem / günler', href: '/ders-dagit/studyo/donem', done: periodOk, required: true },
    { id: 'subject', label: 'Dersler', href: '/ders-dagit/studyo/dersler', done: (c.subjectCount ?? 0) >= 1, required: true },
    { id: 'teacher', label: 'Öğretmenler', href: '/ders-dagit/studyo/ogretmenler', done: (c.teacherCount ?? 0) >= 1, required: true },
    { id: 'assign', label: 'Atamalar', href: '/ders-dagit/studyo/atamalar', done: (c.assignmentCount ?? 0) >= 1, required: true },
  ];
  const rulesSteps: ReadinessStep[] = [
    { id: 'rules', label: 'Kurallar', href: '/ders-dagit/studyo/kurallar', done: true },
    { id: 'validate', label: 'Doğrulama temiz', href: '/ders-dagit/studyo/dogrulama', done: errors.length === 0, required: true },
  ];
  const placement = overview.placement;
  const hasProgram = (c.programCount ?? 0) >= 1;
  const placementOk = !hasProgram || (placement?.is_fully_placed ?? false);
  const programSteps: ReadinessStep[] = [
    { id: 'programs', label: 'En az 1 program', href: '/ders-dagit/studyo/uret', done: hasProgram },
    {
      id: 'placement',
      label: 'Tüm ders saatleri yerleşti',
      href: '/ders-dagit/studyo/program',
      done: placementOk,
      required: true,
    },
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
  let percent = Math.round((phases.data.percent + phases.rules.percent + phases.program.percent) / 3);
  if (placement && placement.required_hours > 0 && !placement.is_fully_placed) {
    percent = Math.min(percent, placement.placement_percent);
  }
  const canGenerate = dataSteps.filter((s) => s.required).every((s) => s.done) && errors.length === 0;
  const canPublish = canGenerate && hasProgram && placementOk;

  let blockReason: string | undefined;
  if (errors.length > 0) blockReason = `${errors.length} doğrulama hatası`;
  else if ((c.assignmentCount ?? 0) < 1) blockReason = 'Atama eksik';
  else if (hasProgram && !placementOk && placement) {
    blockReason = `${placement.unplaced_hours} saat yerleşmedi (%${placement.placement_percent} tamam)`;
  } else if (hasProgram && !placementOk) blockReason = 'Yerleşmemiş ders saati var';

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
