'use client';

import type { AvailabilitySubmission } from '@/lib/ders-dagit-teacher-availability';
import { submissionStatusLabel } from '@/lib/ders-dagit-labels';
import { computeReviewSummary } from '@/lib/teacher-availability-review';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Clock,
  FileEdit,
  Send,
  ShieldAlert,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

type Props = {
  submission: AvailabilitySubmission;
  requireApproval: boolean;
  workDays: number[];
  maxLessons: number;
};

type TimelineEvent = {
  id: string;
  at: string | null;
  title: string;
  detail?: string;
  icon: LucideIcon;
  tone: 'neutral' | 'info' | 'success' | 'warn' | 'error';
};

function fmt(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function buildEvents(
  submission: AvailabilitySubmission,
  requireApproval: boolean,
  workDays: number[],
  maxLessons: number,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const created = submission.submitted_at ?? submission.updated_at;

  events.push({
    id: 'draft',
    at: created,
    title: 'Tercihler kaydedildi',
    detail: submission.teacher_note?.trim() ? `Not: «${submission.teacher_note.trim().slice(0, 80)}»` : undefined,
    icon: FileEdit,
    tone: 'neutral',
  });

  if (requireApproval && submission.submitted_at) {
    events.push({
      id: 'submitted',
      at: submission.submitted_at,
      title: 'İdareye gönderildi',
      detail: 'Okul yönetimi incelemeye aldı',
      icon: Send,
      tone: 'info',
    });
  }

  if (submission.reviewed_at) {
    const summary = computeReviewSummary(
      submission.periods,
      submission.approved_periods,
      workDays,
      maxLessons,
    );
    if (submission.status === 'approved') {
      events.push({
        id: 'review',
        at: submission.reviewed_at,
        title: 'Tam onaylandı',
        detail: `${summary.program_restrictions} saat programa kısıt olarak işlendi`,
        icon: ShieldCheck,
        tone: 'success',
      });
    } else if (submission.status === 'partially_approved') {
      const parts: string[] = [];
      if (summary.approved > 0) parts.push(`${summary.approved} saat onaylandı`);
      if (summary.denied > 0) parts.push(`${summary.denied} talep reddedildi`);
      if (summary.admin_added > 0) parts.push(`${summary.admin_added} idare ekledi`);
      events.push({
        id: 'review',
        at: submission.reviewed_at,
        title: 'Kısmen onaylandı',
        detail: parts.join(' · ') || 'İdare kararı verildi',
        icon: ShieldAlert,
        tone: 'warn',
      });
    } else if (submission.status === 'rejected') {
      events.push({
        id: 'review',
        at: submission.reviewed_at,
        title: 'Reddedildi',
        detail:
          submission.admin_reply?.trim() ||
          'Talepleriniz programa işlenmedi. Pencere açıksa yeniden gönderebilirsiniz.',
        icon: ShieldAlert,
        tone: 'error',
      });
    }
  } else if (submission.status === 'submitted') {
    events.push({
      id: 'pending',
      at: null,
      title: 'İdare kararı bekleniyor',
      detail: 'Onay veya ret geldiğinde ızgarada saat bazında görebilirsiniz',
      icon: Clock,
      tone: 'info',
    });
  }

  if (!submission.reviewed_at && submission.status === 'draft') {
    events.push({
      id: 'updated',
      at: submission.updated_at,
      title: 'Son düzenleme',
      icon: CheckCircle2,
      tone: 'neutral',
    });
  }

  return events;
}

const TONE_STYLES: Record<TimelineEvent['tone'], { line: string; icon: string; card: string }> = {
  neutral: {
    line: 'bg-border',
    icon: 'bg-muted text-muted-foreground',
    card: 'border-border/60 bg-card/80',
  },
  info: {
    line: 'bg-sky-400/50',
    icon: 'bg-sky-500/15 text-sky-800 dark:text-sky-200',
    card: 'border-sky-500/25 bg-sky-500/5',
  },
  success: {
    line: 'bg-emerald-400/60',
    icon: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200',
    card: 'border-emerald-500/30 bg-emerald-500/8',
  },
  warn: {
    line: 'bg-amber-400/60',
    icon: 'bg-amber-500/15 text-amber-900 dark:text-amber-100',
    card: 'border-amber-500/35 bg-amber-500/8',
  },
  error: {
    line: 'bg-destructive/40',
    icon: 'bg-destructive/15 text-destructive',
    card: 'border-destructive/30 bg-destructive/8',
  },
};

export function TeacherAvailabilitySubmissionTimeline({
  submission,
  requireApproval,
  workDays,
  maxLessons,
}: Props) {
  const events = buildEvents(submission, requireApproval, workDays, maxLessons);
  const statusLabel = submissionStatusLabel(submission.status);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-linear-to-b from-card to-muted/20 shadow-sm">
      <div className="border-b border-border/50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Başvuru geçmişi</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          İdare kararı sonrası ızgarada mor / sarı / kırmızı renklerle saatleri ayırt edin.
        </p>
      </div>
      <div className="px-4 py-4">
        <ol className="relative space-y-0">
          {events.map((ev, i) => {
            const styles = TONE_STYLES[ev.tone];
            const Icon = ev.icon;
            const isLast = i === events.length - 1;
            return (
              <li key={ev.id} className="relative flex gap-3 pb-6 last:pb-0">
                {!isLast && (
                  <span
                    className={cn('absolute left-[15px] top-9 bottom-0 w-0.5', styles.line)}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card',
                    styles.icon,
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <div className={cn('min-w-0 flex-1 rounded-xl border px-3 py-2.5', styles.card)}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{ev.title}</p>
                    {ev.at && (
                      <time className="text-[11px] tabular-nums text-muted-foreground">{fmt(ev.at)}</time>
                    )}
                  </div>
                  {ev.detail && (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ev.detail}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-dashed border-border/80 bg-muted/30 px-3 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">Güncel durum</span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              submission.status === 'approved' || submission.status === 'partially_approved'
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
                : submission.status === 'rejected'
                  ? 'bg-destructive/15 text-destructive'
                  : submission.status === 'submitted'
                    ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
                    : 'bg-primary/15 text-primary',
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
