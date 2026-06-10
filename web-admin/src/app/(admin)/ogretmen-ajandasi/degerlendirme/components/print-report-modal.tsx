'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { FileText, Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Me } from '@/hooks/use-auth';
import {
  buildEvalPrintHtml,
  openEvalPrintWindow,
  type EvalPrintCriterion,
  type EvalPrintScore,
  type EvalPrintStudent,
  type EvalPrintStudentNote,
} from './eval-print-document';

export type PrintCriterion = EvalPrintCriterion;
export type PrintStudent = EvalPrintStudent;
export type PrintStudentList = { id: string; name: string; studentIds: string[] };
export type PrintScore = EvalPrintScore;
export type PrintStudentNote = EvalPrintStudentNote;
export type PrintSubjectOption = { id: string; label: string };
export type PrintClassOption = { id: string; label: string };

export function PrintReportModal({
  open,
  onClose,
  token,
  initialListId,
  initialSubjectFilterId,
  initialClassFilterId,
  lists,
  subjects,
  classes,
  allCriteria,
  me,
}: {
  open: boolean;
  onClose: () => void;
  token: string | null;
  initialListId: string | null;
  initialSubjectFilterId: string | null;
  initialClassFilterId: string | null;
  lists: PrintStudentList[];
  subjects: PrintSubjectOption[];
  classes: PrintClassOption[];
  allCriteria: PrintCriterion[];
  me: Me;
}) {
  const [printListId, setPrintListId] = useState<string | null>(null);
  const [printSubjectId, setPrintSubjectId] = useState<string | null>(null);
  const [printClassId, setPrintClassId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<PrintStudent[]>([]);
  const [scores, setScores] = useState<PrintScore[]>([]);
  const [notes, setNotes] = useState<PrintStudentNote[]>([]);
  const [pickStudents, setPickStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setPrintListId(initialListId);
    setPrintSubjectId(initialSubjectFilterId);
    setPrintClassId(initialClassFilterId);
  }, [open, initialListId, initialSubjectFilterId, initialClassFilterId]);

  useEffect(() => {
    if (!open) return;
    if (!token) return;
    const params = new URLSearchParams();
    if (printListId) params.set('listId', printListId);
    if (printClassId) params.set('classId', printClassId);
    const q = params.toString();
    setLoading(true);
    apiFetch<{
      students: PrintStudent[];
      scores: PrintScore[];
      studentNotes?: PrintStudentNote[];
    }>(`/teacher-agenda/evaluation${q ? `?${q}` : ''}`, { token })
      .then((res) => {
        const st = res.students ?? [];
        setStudents(st);
        setScores(res.scores ?? []);
        setNotes(res.studentNotes ?? []);
        setPickStudents(new Set(st.map((s) => s.id)));
      })
      .catch(() => {
        setStudents([]);
        setScores([]);
        setNotes([]);
        setPickStudents(new Set());
      })
      .finally(() => setLoading(false));
  }, [open, token, printListId, printClassId]);

  const criteriaCols = useMemo(() => {
    if (printSubjectId === null) return allCriteria;
    return allCriteria.filter((c) => !c.subjectId || c.subjectId === printSubjectId);
  }, [allCriteria, printSubjectId]);

  const selectedStudents = useMemo(
    () => students.filter((s) => pickStudents.has(s.id)),
    [students, pickStudents],
  );

  const listLabel =
    printListId === null ? 'Tüm öğrenciler (Gruplar ve Dersler)' : lists.find((l) => l.id === printListId)?.name ?? 'Liste';
  const classLabel =
    printClassId === null ? 'Tüm sınıflar' : classes.find((c) => c.id === printClassId)?.label ?? printClassId;
  const subjectLabel =
    printSubjectId === null ? 'Tüm dersler' : subjects.find((s) => s.id === printSubjectId)?.label ?? printSubjectId;

  const toggleStudent = (id: string) => {
    setPickStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllStudents = () => setPickStudents(new Set(students.map((s) => s.id)));
  const clearStudents = () => setPickStudents(new Set());

  const runPrint = useCallback(() => {
    if (selectedStudents.length === 0 || criteriaCols.length === 0) return;

    const html = buildEvalPrintHtml({
      schoolName: me.school?.name ?? '—',
      teacherName: me.display_name || me.email || '—',
      listLabel,
      classLabel,
      subjectLabel,
      printedAt: format(new Date(), "d MMMM yyyy HH:mm", { locale: tr }),
      students: selectedStudents,
      criteria: criteriaCols,
      scores,
      notes,
    });

    if (!openEvalPrintWindow(html)) {
      toast.error('Pop-up engellendi; yazdırma penceresi açılamadı.');
      return;
    }
    onClose();
  }, [selectedStudents, criteriaCols, scores, notes, me, listLabel, subjectLabel, classLabel, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="eval-print-title"
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <Printer className="size-4" aria-hidden />
              </span>
              <div>
                <h3 id="eval-print-title" className="text-base font-bold leading-tight sm:text-lg">
                  Yazdır / PDF
                </h3>
                <p className="text-[11px] text-muted-foreground">Değerlendirme raporu</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-muted" aria-label="Kapat">
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2.5 text-xs">
            <p className="font-semibold text-foreground">Yatay A4 · matris + not özeti</p>
            <p className="mt-0.5 text-muted-foreground">
              {selectedStudents.length} öğrenci · {criteriaCols.length} kriter · PDF için «PDF olarak kaydet» seçin.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sınıf / öğrenci listesi</label>
              <select
                value={printListId ?? ''}
                onChange={(e) => setPrintListId(e.target.value || null)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Tüm öğrenciler (Gruplar ve Dersler)</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Şube / sınıf</label>
              <select
                value={printClassId ?? ''}
                onChange={(e) => setPrintClassId(e.target.value || null)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Tüm sınıflar</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ders (kriterler)</label>
              <select
                value={printSubjectId ?? ''}
                onChange={(e) => setPrintSubjectId(e.target.value || null)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Tüm dersler + genel</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Öğrenciler</label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="font-medium text-primary hover:underline" onClick={selectAllStudents}>
                  Tümü
                </button>
                <button type="button" className="text-muted-foreground hover:underline" onClick={clearStudents}>
                  Hiçbiri
                </button>
              </div>
            </div>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border/70 bg-muted/15 p-2">
              {loading ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">Yükleniyor…</p>
              ) : students.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">Öğrenci yok</p>
              ) : (
                students.map((s) => {
                  const on = pickStudents.has(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggleStudent(s.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                        on ? 'bg-emerald-500/10 ring-1 ring-emerald-500/20' : 'hover:bg-muted/50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold',
                          on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-border bg-background text-transparent',
                        )}
                      >
                        ✓
                      </span>
                      <span className="truncate font-medium">{s.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {!loading && criteriaCols.length === 0 && (
            <p className="rounded-xl border border-amber-200/60 bg-amber-500/8 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-800/40 dark:text-amber-200">
              Bu ders filtresiyle kriter yok; «Tüm dersler» seçin veya kriter ekleyin.
            </p>
          )}

          <div className="flex items-start gap-2 rounded-xl border border-blue-200/60 bg-blue-500/8 px-3 py-2.5 text-[11px] text-blue-950 dark:border-blue-800/40 dark:text-blue-100">
            <FileText className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
            <span>Renkli hücreler için yazdır ayarında «Arka plan grafikleri» açık olsun.</span>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            İptal
          </Button>
          <Button
            className="rounded-xl"
            disabled={loading || selectedStudents.length === 0 || criteriaCols.length === 0}
            onClick={() => runPrint()}
          >
            <Printer className="mr-1.5 size-4" />
            Önizle ve yazdır
          </Button>
        </div>
      </div>
    </div>
  );
}
