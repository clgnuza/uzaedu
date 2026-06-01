import type { TeacherAvailabilityContext } from '@/lib/ders-dagit-teacher-availability';

export type FlowStepId = 'mark' | 'submit' | 'review' | 'applied';

export type FlowStep = {
  id: FlowStepId;
  label: string;
  description: string;
  state: 'done' | 'current' | 'upcoming' | 'error';
};

export function buildTeacherAvailabilityFlow(
  ctx: TeacherAvailabilityContext,
  requireApproval: boolean,
): FlowStep[] {
  const status = ctx.submission?.status;
  const hasMarks = (ctx.submission?.periods?.length ?? 0) > 0 || ctx.applied_periods.length > 0;

  if (!requireApproval) {
    return [
      {
        id: 'mark',
        label: 'Uygunluk işaretle',
        description: ctx.can_edit ? 'Uygun olmadığınız saatleri seçin' : 'Pencere kapalı',
        state: !ctx.collection_open ? 'upcoming' : hasMarks ? 'done' : ctx.can_edit ? 'current' : 'upcoming',
      },
      {
        id: 'applied',
        label: 'Programa işlendi',
        description: 'Kayıt anında çizelgenize yansır',
        state: ctx.applied_periods.length > 0 ? 'done' : hasMarks && ctx.can_edit ? 'current' : 'upcoming',
      },
    ];
  }

  const steps: FlowStep[] = [
    {
      id: 'mark',
      label: 'Tercihleri işaretle',
      description: 'Taslak olarak kaydedebilirsiniz',
      state: 'upcoming',
    },
    {
      id: 'submit',
      label: 'İdareye gönder',
      description: 'Onay için okula iletin',
      state: 'upcoming',
    },
    {
      id: 'review',
      label: 'İdare incelemesi',
      description: 'Okul yönetimi karar verir',
      state: 'upcoming',
    },
    {
      id: 'applied',
      label: 'Programa işlendi',
      description: 'Onay sonrası çizelge güncellenir',
      state: 'upcoming',
    },
  ];

  if (!ctx.collection_open) {
    return steps.map((s) => ({ ...s, state: 'upcoming' as const }));
  }

  if (status === 'approved' || status === 'partially_approved') {
    return steps.map((s) => ({
      ...s,
      state: 'done' as const,
      description:
        status === 'partially_approved' && s.id === 'applied'
          ? 'Bazı saatler onaylandı, bazıları reddedildi'
          : s.description,
    }));
  }

  if (status === 'rejected') {
    return [
      { ...steps[0]!, state: 'error', description: 'Düzenleyip yeniden gönderebilirsiniz' },
      { ...steps[1]!, state: 'current' },
      { ...steps[2]!, state: 'upcoming' },
      { ...steps[3]!, state: 'upcoming' },
    ];
  }

  if (status === 'submitted') {
    if (ctx.can_edit) {
      return [
        {
          ...steps[0]!,
          state: 'current',
          description: 'Son tarihe kadar düzenleyebilir veya silebilirsiniz',
        },
        { ...steps[1]!, state: 'done' },
        { ...steps[2]!, state: 'current', description: 'İdare henüz karar vermedi' },
        { ...steps[3]!, state: 'upcoming' },
      ];
    }
    return [
      { ...steps[0]!, state: 'done' },
      { ...steps[1]!, state: 'done' },
      { ...steps[2]!, state: 'current', description: 'Yanıt gelince bildirim alırsınız' },
      { ...steps[3]!, state: 'upcoming' },
    ];
  }

  if (status === 'draft' || (ctx.can_edit && hasMarks)) {
    return [
      { ...steps[0]!, state: hasMarks ? 'done' : 'current' },
      { ...steps[1]!, state: ctx.can_submit ? 'current' : 'upcoming' },
      { ...steps[2]!, state: 'upcoming' },
      { ...steps[3]!, state: 'upcoming' },
    ];
  }

  return [
    { ...steps[0]!, state: 'current' },
    { ...steps[1]!, state: 'upcoming' },
    { ...steps[2]!, state: 'upcoming' },
    { ...steps[3]!, state: 'upcoming' },
  ];
}

export function formatAvailabilityDeadline(iso: string | null): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
