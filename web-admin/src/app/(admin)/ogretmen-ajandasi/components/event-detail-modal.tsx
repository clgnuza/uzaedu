'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { User, Calendar, Tag, CheckCircle2, Circle, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from './agenda-calendar-grid';
import { AGENDA_SOURCE_KEYS, AGENDA_SOURCE_THEME, AGENDA_TYPE_MODAL_THEME } from './agenda-source-theme';

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
  low: 'bg-slate-500/15 text-slate-600',
  medium: 'bg-amber-500/15 text-amber-600',
  high: 'bg-red-500/15 text-red-600',
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
  isSchoolAdmin,
  onEditSchoolEvent,
  onDeleteSchoolEvent,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskStatusChange?: (taskId: string, status: string) => Promise<void>;
  isSchoolAdmin?: boolean;
  onEditSchoolEvent?: (eventId: string) => void;
  onDeleteSchoolEvent?: (eventId: string) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={event.title} className="max-w-md">
        <div className="space-y-4">
          <div className={cn('rounded-xl p-4 space-y-4', src.card)}>
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
          {event.metadata && Object.keys(event.metadata).length > 0 && !isDuty && !isTimetable && (
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
                    {String(meta.repeat) === 'daily'
                      ? 'Günlük'
                      : String(meta.repeat) === 'weekly'
                        ? 'Haftalık'
                        : String(meta.repeat) === 'monthly'
                          ? 'Aylık'
                          : String(meta.repeat)}
                  </p>
                )}
              </div>
            </div>
          )}
          {isTask && isRecurringVirtual && (
            <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Bu gün yalnızca planlı tekrar görünümüdür. Tamamlamak için takvimde <strong className="text-foreground">son tarihi bugün olan</strong> aynı göreve tıklayın.
            </p>
          )}
          {isTask && (
            <div className="flex items-center gap-3 rounded-xl bg-muted/30 p-4 border border-border/50">
              <span className="text-sm font-medium text-muted-foreground">Durum:</span>
              {canToggle ? (
                <button
                  type="button"
                  onClick={handleToggle}
                  disabled={toggling}
                  className={cn(
                    'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
                    isCompleted
                      ? 'bg-green-500/15 text-green-600 hover:bg-green-500/25'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                  {isCompleted ? 'Yapıldı' : 'Yapılmadı'}
                </button>
              ) : (
                <span className={cn(
                  'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold',
                  isCompleted ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground',
                )}>
                  {isCompleted ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                  {isCompleted ? 'Yapıldı' : 'Yapılmadı'}
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
        <div className="mt-4 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto min-h-[44px] rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted touch-manipulation transition-colors"
          >
            Kapat
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
