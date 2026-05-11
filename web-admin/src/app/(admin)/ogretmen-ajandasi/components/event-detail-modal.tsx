'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { User, Calendar, Tag, CheckCircle2, Circle, Pencil, Trash2, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from './agenda-calendar-grid';
import { AGENDA_SOURCE_KEYS, AGENDA_SOURCE_THEME, AGENDA_TYPE_MODAL_THEME } from './agenda-source-theme';
import { AgendaTaskMetaIcons, AgendaTaskPriorityGlyph, AgendaTaskRepeatGlyph } from './agenda-task-icons';

const TYPE_LABELS: Record<string, string> = {
  note: 'Not',
  task: 'Görev',
  school_event: 'Okul Etkinliği',
  platform_event: 'Platform Etkinliği',
  duty: 'Nöbet',
  exam_duty: 'Sınav Görevi',
  student_note: 'Öğrenci Notu',
  parent_meeting: 'Veli Toplantısı',
  belirli_gun_hafta: 'Belirli Gün ve Hafta',
  timetable: 'Ders Programı',
};

const SOURCE_STYLES: Record<string, { card: string; badge: string }> = Object.fromEntries(
  AGENDA_SOURCE_KEYS.map((k) => [k, { card: AGENDA_SOURCE_THEME[k].modalCard, badge: AGENDA_SOURCE_THEME[k].modalBadge }]),
) as Record<string, { card: string; badge: string }>;

const SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  AGENDA_SOURCE_KEYS.map((k) => [k, AGENDA_SOURCE_THEME[k].label]),
) as Record<string, string>;

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-500/12 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200',
  medium: 'bg-amber-500/14 text-amber-800 dark:bg-amber-500/18 dark:text-amber-100',
  high: 'bg-rose-500/14 text-rose-800 dark:bg-rose-500/18 dark:text-rose-100',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekleyen',
  completed: 'Tamamlandı',
  overdue: 'Gecikmiş',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
};

function repeatLabelTr(repeat: unknown): string {
  const s = String(repeat ?? 'none');
  if (s === 'daily') return 'Günlük';
  if (s === 'weekly') return 'Haftalık';
  if (s === 'monthly') return 'Aylık';
  if (s === 'none') return 'Yok';
  return s;
}

const DUTY_SHIFT_LABELS: Record<string, string> = {
  morning: 'Sabah',
  afternoon: 'Öğleden sonra',
};

type TimetableLessonRow = { lesson_num: number; class_section: string; subject: string };

export function EventDetailModal({
  event,
  open,
  onOpenChange,
  onTaskStatusChange,
  onEndTaskRepeat,
  isSchoolAdmin,
  onEditSchoolEvent,
  onDeleteSchoolEvent,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskStatusChange?: (taskId: string, status: string) => Promise<void>;
  /** Takvimdeki bu tekrar gününden sonra seriyi kapat (PATCH repeatEndOccurrenceDate) */
  onEndTaskRepeat?: (taskId: string, occurrenceYmd: string) => Promise<void>;
  isSchoolAdmin?: boolean;
  onEditSchoolEvent?: (eventId: string) => void;
  onDeleteSchoolEvent?: (eventId: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [endingRepeat, setEndingRepeat] = useState(false);
  if (!event) return null;
  const isSchoolEvent = event.type === 'school_event';
  const canEditDelete = isSchoolAdmin && isSchoolEvent;
  const hasTime = event.start.includes('T');
  const dateStr = hasTime
    ? format(new Date(event.start), 'd MMMM yyyy, HH:mm', { locale: tr })
    : format(new Date(event.start), 'd MMMM yyyy', { locale: tr });
  const dateStrMobile = (() => {
    if (!hasTime && event.start.length >= 10) {
      const p = event.start.slice(0, 10).split('-');
      if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    }
    return hasTime
      ? format(new Date(event.start), 'dd/MM/yyyy, HH:mm')
      : format(new Date(event.start), 'dd/MM/yyyy');
  })();
  const srcBase = SOURCE_STYLES[event.source] ?? { card: 'bg-muted/30 border-l-4 border-l-muted-foreground', badge: 'bg-muted text-muted-foreground' };
  const typeTheme = AGENDA_TYPE_MODAL_THEME[event.type];
  const src = typeTheme ?? srcBase;
  const meta = event.metadata ?? {};
  const isDuty = event.type === 'duty';
  const isTimetable = event.type === 'timetable';
  const timetableLessons = (meta.lessons as TimetableLessonRow[] | undefined)?.filter(
    (l) => l && typeof l.lesson_num === 'number',
  );
  const priority = event.metadata?.priority as string | undefined;
  const isTask = event.type === 'task';
  const isCompleted = event.metadata?.status === 'completed';
  const isRecurringVirtual = meta.recurringVirtual === true;
  const canToggle = isTask && onTaskStatusChange && !isRecurringVirtual;
  const taskRepeat = meta.repeat as string | undefined;
  const remindersMeta = meta.reminders as { pushSent?: boolean }[] | undefined;
  const hasPendingReminder =
    Array.isArray(remindersMeta) && remindersMeta.some((r) => r && !r.pushSent);
  const calendarTaskRootId =
    typeof meta.taskId === 'string' && meta.taskId.trim() !== '' ? meta.taskId.trim() : event.id;
  const occurrenceYmd = event.start.slice(0, 10);
  const showEndRepeat =
    Boolean(onEndTaskRepeat) &&
    isTask &&
    (isRecurringVirtual || (taskRepeat != null && String(taskRepeat) !== 'none'));

  const handleToggle = async () => {
    if (!canToggle || toggling) return;
    setToggling(true);
    try {
      await onTaskStatusChange(event.id, isCompleted ? 'pending' : 'completed');
      onOpenChange(false);
    } finally {
      setToggling(false);
    }
  };

  const handleEndRepeat = async () => {
    if (!onEndTaskRepeat || endingRepeat) return;
    if (!confirm('Bu günden sonra tekrar olmasın mı? Son vade bu güne taşınır ve tekrar kapatılır.')) return;
    setEndingRepeat(true);
    try {
      await onEndTaskRepeat(calendarTaskRootId, occurrenceYmd);
      onOpenChange(false);
    } finally {
      setEndingRepeat(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={event.title}
        className="max-w-[min(100%,22rem)] sm:max-w-md"
      >
        <div className="-mx-4 space-y-2.5 px-3 text-sm sm:mx-0 sm:space-y-3.5 sm:px-0 sm:text-base">
          <div
            className={cn(
              'rounded-lg border border-border/60 p-2.5 sm:rounded-xl sm:p-3.5',
              isTask
                ? 'border-l-4 border-l-emerald-600 bg-emerald-500/[0.07] ring-1 ring-emerald-500/10 dark:border-l-emerald-500 dark:bg-emerald-950/25 dark:ring-emerald-500/15'
                : src.card,
            )}
          >
            {isTask ? (
              <div className="flex gap-2 sm:gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-800 ring-1 ring-emerald-600/20 dark:text-emerald-200 sm:size-10">
                  <ListTodo className="size-4.5 sm:size-5" strokeWidth={2.25} />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      <span className="inline-flex shrink-0 items-center rounded bg-emerald-700 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white dark:bg-emerald-600">
                        {TYPE_LABELS.task}
                      </span>
                      <span
                        className={cn(
                          'inline-flex max-w-full min-w-0 items-center truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset sm:text-[11px]',
                          src.badge,
                        )}
                      >
                        {SOURCE_LABELS[event.source] ?? event.source}
                      </span>
                    </div>
                    <AgendaTaskMetaIcons
                      priority={priority ?? 'medium'}
                      repeat={taskRepeat ?? 'none'}
                      hasPendingReminder={hasPendingReminder}
                      className="w-fit bg-background/70 ring-border/40 sm:shrink-0"
                    />
                  </div>
                  <div className="flex min-w-0 items-start gap-1.5 rounded-md bg-background/75 py-1.5 pl-1.5 pr-2 ring-1 ring-border/50 sm:items-center sm:py-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-600/10 text-emerald-800 dark:text-emerald-300 sm:size-8">
                      <Calendar className="size-3.5 sm:size-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1 wrap-break-word text-[13px] font-semibold leading-snug tabular-nums text-foreground sm:text-sm">
                      <span className="sm:hidden">{dateStrMobile}</span>
                      <span className="hidden sm:inline">{dateStr}</span>
                    </span>
                  </div>
                  {event.createdBy ? (
                    <div className="flex min-w-0 items-start gap-1.5 rounded-md bg-background/75 py-1.5 pl-1.5 pr-2 ring-1 ring-border/50 sm:items-center sm:py-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground sm:size-8">
                        <User className="size-3.5 sm:size-4" strokeWidth={2} />
                      </span>
                      <span className="min-w-0 flex-1 wrap-break-word text-[13px] font-medium leading-snug text-foreground sm:text-sm">
                        {event.createdBy}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold', src.badge)}>
                    {TYPE_LABELS[event.type] ?? event.type}
                  </span>
                  <span className={cn('rounded-lg px-2.5 py-1 text-xs font-medium', src.badge)}>
                    {SOURCE_LABELS[event.source] ?? event.source}
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-background/60 py-2.5 px-3">
                  <Calendar className="size-5 shrink-0 opacity-70" />
                  <span className="font-medium tabular-nums sm:hidden">{dateStrMobile}</span>
                  <span className="font-medium hidden sm:inline">{dateStr}</span>
                </div>
                {event.createdBy && (
                  <div className="flex items-center gap-3 rounded-lg bg-background/60 py-2.5 px-3">
                    <User className="size-5 shrink-0 opacity-70" />
                    <span className="font-medium">{event.createdBy}</span>
                  </div>
                )}
              </>
            )}
          </div>
          {isDuty && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Tag className="size-3.5" />
                Nöbet bilgisi
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2 sm:p-4">
                {meta.shift != null && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Vardiya:</span>{' '}
                    {DUTY_SHIFT_LABELS[String(meta.shift)] ?? String(meta.shift)}
                  </p>
                )}
                {meta.area != null && String(meta.area).trim() !== '' && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Alan:</span> {String(meta.area)}
                  </p>
                )}
                {meta.slotName != null && String(meta.slotName).trim() !== '' && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Slot:</span> {String(meta.slotName)}
                  </p>
                )}
                {(meta.slotStartTime != null || meta.slotEndTime != null) && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Saat:</span>{' '}
                    {[meta.slotStartTime, meta.slotEndTime].filter(Boolean).join(' – ') || '—'}
                  </p>
                )}
                {typeof meta.lessonNum === 'number' && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Ders saati:</span> {meta.lessonNum}. ders
                  </p>
                )}
                {meta.note != null && String(meta.note).trim() !== '' && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Not:</span> {String(meta.note)}
                  </p>
                )}
              </div>
            </div>
          )}
          {isTimetable && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Tag className="size-3.5" />
                Dersler
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 p-2 sm:p-4">
                {timetableLessons && timetableLessons.length > 0 ? (
                  <ul className="max-h-[min(50vh,320px)] space-y-1.5 overflow-y-auto text-sm">
                    {timetableLessons.map((l) => (
                      <li
                        key={l.lesson_num}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-lg bg-background/70 px-2.5 py-2 ring-1 ring-border/60"
                      >
                        <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{l.lesson_num}. saat</span>
                        <span className="min-w-0 font-medium text-foreground">{l.subject || 'Ders'}</span>
                        {l.class_section ? (
                          <span className="text-xs text-muted-foreground">({l.class_section})</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {meta.lessonCount != null
                      ? `Bu gün toplam ${String(meta.lessonCount)} ders kayıtlı; saatlik liste yüklenemedi.`
                      : 'Ders listesi bulunamadı.'}
                  </p>
                )}
              </div>
            </div>
          )}
          {isTask && event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
                <Tag className="size-3 shrink-0 text-emerald-700/80 dark:text-emerald-400/90" />
                Detay
              </div>
              <div className="grid gap-1 rounded-lg border border-border/50 bg-muted/20 p-1.5 sm:gap-1.5 sm:rounded-xl sm:p-2">
                {event.metadata.status != null && (
                  <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-background/90 px-1.5 py-1 ring-1 ring-border/35 sm:gap-2 sm:px-2 sm:py-1.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-emerald-600/10 sm:size-8">
                      {String(event.metadata.status) === 'completed' ? (
                        <CheckCircle2 className="size-3.5 text-emerald-700 dark:text-emerald-400 sm:size-4" />
                      ) : (
                        <Circle className="size-3.5 text-muted-foreground sm:size-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 text-xs leading-snug sm:text-sm">
                      <span className="text-muted-foreground">Durum </span>
                      <span className="font-semibold text-foreground">
                        {STATUS_LABELS[String(event.metadata.status)] ?? String(event.metadata.status)}
                      </span>
                    </div>
                  </div>
                )}
                {event.metadata.priority != null && (
                  <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-background/90 px-1.5 py-1 ring-1 ring-border/35 sm:gap-2 sm:px-2 sm:py-1.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-muted sm:size-8">
                      <AgendaTaskPriorityGlyph priority={priority ?? 'medium'} />
                    </span>
                    <div className="min-w-0 flex-1 text-xs leading-snug sm:text-sm">
                      <span className="text-muted-foreground">Öncelik </span>
                      <span
                        className={cn(
                          'inline-flex max-w-full align-middle rounded px-1 py-0.5 text-[11px] font-semibold sm:text-xs',
                          PRIORITY_STYLES[priority ?? ''] ?? 'bg-muted text-foreground',
                        )}
                      >
                        {PRIORITY_LABELS[priority ?? ''] ?? String(event.metadata.priority)}
                      </span>
                    </div>
                  </div>
                )}
                {meta.repeat != null && String(meta.repeat) !== 'none' && (
                  <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-background/90 px-1.5 py-1 ring-1 ring-border/35 sm:gap-2 sm:px-2 sm:py-1.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded bg-muted sm:size-8">
                      <AgendaTaskRepeatGlyph repeat={taskRepeat} />
                    </span>
                    <div className="min-w-0 flex-1 wrap-break-word text-xs font-medium leading-snug text-foreground sm:text-sm">
                      <span className="text-muted-foreground">Tekrar </span>
                      {repeatLabelTr(meta.repeat)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {event.metadata && Object.keys(event.metadata).length > 0 && !isDuty && !isTimetable && !isTask && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Tag className="size-3.5" />
                Detay
              </div>
              <div className="rounded-xl bg-muted/30 p-4 space-y-2 border border-border/50">
                {event.metadata.status != null && (
                  <p className="text-sm"><span className="text-muted-foreground">Durum:</span> {STATUS_LABELS[String(event.metadata.status)] ?? String(event.metadata.status)}</p>
                )}
                {event.metadata.priority != null && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Öncelik:</span>{' '}
                    <span className={cn('rounded px-2 py-0.5 text-xs font-medium', PRIORITY_STYLES[priority ?? ''] ?? 'bg-muted')}>
                      {PRIORITY_LABELS[priority ?? ''] ?? String(event.metadata.priority)}
                    </span>
                  </p>
                )}
                {event.metadata.eventType != null && (
                  <p className="text-sm"><span className="text-muted-foreground">Tür:</span> {String(event.metadata.eventType)}</p>
                )}
                {event.metadata.important !== undefined && (
                  <p className="text-sm"><span className="text-muted-foreground">Önemli:</span> {event.metadata.important ? 'Evet' : 'Hayır'}</p>
                )}
                {event.metadata.gorevTipi != null && (
                  <p className="text-sm"><span className="text-muted-foreground">Görev:</span> {event.metadata.gorevTipi === 'sorumlu' ? 'Sorumlu' : 'Yardımcı'}</p>
                )}
                {event.metadata.lessonCount != null && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Ders sayısı:</span> {String(event.metadata.lessonCount)}
                  </p>
                )}
                {meta.repeat != null && String(meta.repeat) !== 'none' && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Tekrar:</span>{' '}
                    {repeatLabelTr(meta.repeat)}
                  </p>
                )}
              </div>
            </div>
          )}
          {isTask && isRecurringVirtual && (
            <p className="text-pretty rounded-md border border-emerald-500/20 bg-emerald-500/6 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground ring-1 ring-emerald-500/10 sm:text-xs">
              Bu gün yalnızca planlı tekrar görünümüdür. Tamamlamak için takvimde <strong className="text-foreground">son tarihi bugün olan</strong> aynı göreve tıklayın.
            </p>
          )}
          {showEndRepeat && (
            <button
              type="button"
              onClick={() => void handleEndRepeat()}
              disabled={endingRepeat}
              className="w-full touch-manipulation rounded-lg border border-border/70 bg-background px-2.5 py-2 text-left text-[11px] font-semibold leading-snug text-foreground ring-1 ring-border/50 hover:bg-muted/80 disabled:opacity-60 sm:text-xs"
            >
              {endingRepeat
                ? 'Uygulanıyor…'
                : `Bu günden sonra tekrarı kapat (${occurrenceYmd} son tekrar)`}
            </button>
          )}
          {isTask && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5 sm:px-2.5 sm:py-2">
              <span className="shrink-0 text-[11px] font-semibold text-muted-foreground sm:text-xs">İşaretle</span>
              {canToggle ? (
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggling}
                  className={cn(
                    'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-all sm:flex-initial sm:px-3 sm:text-sm',
                    isCompleted
                      ? 'bg-emerald-600/12 text-emerald-800 hover:bg-emerald-600/18 dark:text-emerald-200'
                      : 'bg-background ring-1 ring-border/60 text-foreground hover:bg-muted/80',
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="size-4 shrink-0 sm:size-4.5" /> : <Circle className="size-4 shrink-0 sm:size-4.5" />}
                  <span className="truncate">{isCompleted ? 'Yapıldı' : 'Yapılmadı'}</span>
                </button>
              ) : (
                <span
                  className={cn(
                    'flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold sm:flex-initial sm:px-3 sm:text-sm',
                    isCompleted ? 'bg-emerald-600/12 text-emerald-800 dark:text-emerald-200' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="size-4 shrink-0 sm:size-4.5" /> : <Circle className="size-4 shrink-0 sm:size-4.5" />}
                  <span className="truncate">{isCompleted ? 'Yapıldı' : 'Yapılmadı'}</span>
                </span>
              )}
            </div>
          )}
        </div>
        {canEditDelete && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { onEditSchoolEvent?.(event.id); onOpenChange(false); }}
              className="flex items-center gap-2 min-h-[44px] rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              <Pencil className="size-4" />
              Düzenle
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!onDeleteSchoolEvent || deleting || !confirm('Bu etkinliği silmek istediğinize emin misiniz?')) return;
                setDeleting(true);
                try {
                  await onDeleteSchoolEvent(event.id);
                  onOpenChange(false);
                } finally {
                  setDeleting(false);
                }
              }}
              disabled={deleting}
              className="flex items-center gap-2 min-h-[44px] rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
            >
              <Trash2 className="size-4" />
              {deleting ? 'Siliniyor...' : 'Sil'}
            </button>
          </div>
        )}
        <div className="mt-3 border-t border-border/60 pt-3 sm:mt-4 sm:pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full min-h-10 touch-manipulation rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted sm:min-h-11 sm:w-auto sm:rounded-xl sm:px-4"
          >
            Kapat
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
