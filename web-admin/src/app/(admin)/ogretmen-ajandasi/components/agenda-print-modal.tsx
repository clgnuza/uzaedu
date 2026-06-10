'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from './agenda-calendar-grid';
import {
  buildAgendaPrintHtml,
  openAgendaPrintWindow,
  type AgendaPrintSections,
} from './agenda-print-document';

const SECTION_OPTS: { key: keyof AgendaPrintSections; label: string; desc: string }[] = [
  { key: 'summary', label: 'Özet', desc: 'Sayısal kartlar' },
  { key: 'calendar', label: 'Takvim', desc: 'Seçili dönem etkinlikleri' },
  { key: 'notes', label: 'Notlar', desc: 'Kişisel not listesi' },
  { key: 'tasks', label: 'Görevler', desc: 'Görev tablosu' },
  { key: 'studentNotes', label: 'Öğrenci notları', desc: 'Olumlu / olumsuz / gözlem' },
  { key: 'parentMeetings', label: 'Veli görüşmeleri', desc: 'Görüşme kayıtları' },
];

const DEFAULT_SECTIONS: AgendaPrintSections = {
  summary: true,
  calendar: true,
  notes: true,
  tasks: true,
  studentNotes: true,
  parentMeetings: false,
};

export function AgendaPrintModal({
  open,
  onClose,
  schoolName,
  teacherName,
  periodLabel,
  rangeStart,
  rangeEnd,
  summary,
  notes,
  tasks,
  events,
  studentNotes,
  parentMeetings,
}: {
  open: boolean;
  onClose: () => void;
  schoolName: string;
  teacherName: string;
  periodLabel: string;
  rangeStart: string;
  rangeEnd: string;
  summary: { pendingTasks: number; overdueTasks: number; todayEventCount: number } | null;
  notes: { title: string; body?: string | null; pinned?: boolean }[];
  tasks: { title: string; dueDate?: string | null; status: string; priority?: string }[];
  events: CalendarEvent[];
  studentNotes: { noteType: string; noteDate: string; student?: { name: string }; description?: string | null }[];
  parentMeetings: { meetingDate: string; student?: { name: string }; subject?: string | null; meetingType?: string | null }[];
}) {
  const [sections, setSections] = useState<AgendaPrintSections>(DEFAULT_SECTIONS);

  useEffect(() => {
    if (open) setSections(DEFAULT_SECTIONS);
  }, [open]);

  const toggle = (key: keyof AgendaPrintSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const anySelected = Object.values(sections).some(Boolean);

  const runPrint = useCallback(() => {
    if (!anySelected) {
      toast.error('En az bir bölüm seçin');
      return;
    }
    const html = buildAgendaPrintHtml({
      schoolName,
      teacherName,
      periodLabel,
      rangeStart,
      rangeEnd,
      sections,
      summary,
      notes,
      tasks,
      events,
      studentNotes,
      parentMeetings,
    });
    if (!openAgendaPrintWindow(html)) {
      toast.error('Pop-up engellendi; yazdırma penceresi açılamadı');
      return;
    }
    onClose();
  }, [
    anySelected,
    schoolName,
    teacherName,
    periodLabel,
    rangeStart,
    rangeEnd,
    sections,
    summary,
    notes,
    tasks,
    events,
    studentNotes,
    parentMeetings,
    onClose,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,100dvh)] w-full max-w-md flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agenda-print-title"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-700 dark:text-blue-300">
                <Printer className="size-4" aria-hidden />
              </span>
              <div>
                <h3 id="agenda-print-title" className="text-base font-bold leading-tight sm:text-lg">
                  Yazdır / PDF
                </h3>
                <p className="text-[11px] text-muted-foreground">Ajanda raporu</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-muted" aria-label="Kapat">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5 text-xs">
            <p className="font-semibold text-foreground">{periodLabel}</p>
            <p className="mt-0.5 text-muted-foreground">
              Takvim bölümü bu döneme göre filtrelenir. PDF için yazdır hedefinde «PDF olarak kaydet» seçin.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dahil edilecekler</p>
            <ul className="grid gap-1.5">
              {SECTION_OPTS.map((opt) => {
                const on = sections[opt.key];
                return (
                  <li key={opt.key}>
                    <button
                      type="button"
                      onClick={() => toggle(opt.key)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        on
                          ? 'border-blue-500/35 bg-blue-500/8 ring-1 ring-blue-500/15'
                          : 'border-border/60 bg-background hover:bg-muted/40',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold',
                          on ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-muted/50 text-transparent',
                        )}
                      >
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{opt.label}</span>
                        <span className="block text-[11px] text-muted-foreground">{opt.desc}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-500/8 px-3 py-2.5 text-[11px] text-amber-950 dark:border-amber-800/40 dark:text-amber-100">
            <FileText className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
            <span>Renkli rozetler için tarayıcı yazdır ayarında «Arka plan grafikleri» açık olsun.</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            İptal
          </Button>
          <Button className="rounded-xl" disabled={!anySelected} onClick={runPrint}>
            <Printer className="mr-1.5 size-4" />
            Önizle ve yazdır
          </Button>
        </div>
      </div>
    </div>
  );
}
