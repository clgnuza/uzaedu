'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Printer, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import type { Me } from '@/hooks/use-auth';

export type PrintCriterion = {
  id: string;
  name: string;
  maxScore: number;
  scoreType?: 'numeric' | 'sign';
  subjectId?: string | null;
};
export type PrintStudent = { id: string; name: string };
export type PrintStudentList = { id: string; name: string; studentIds: string[] };
export type PrintScore = {
  id: string;
  criterionId: string;
  studentId: string;
  score: number;
  noteDate: string;
  note?: string | null;
  createdAt?: string;
  criterion?: PrintCriterion;
};
export type PrintStudentNote = {
  id: string;
  studentId: string;
  noteType: string;
  noteDate: string;
  description?: string | null;
};
export type PrintSubjectOption = { id: string; label: string };

function escapeHtml(s: string) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoresForCell(scores: PrintScore[], studentId: string, criterionId: string): PrintScore[] {
  return scores
    .filter((x) => x.studentId === studentId && x.criterionId === criterionId)
    .sort((a, b) => {
      const d = (b.noteDate ?? '').localeCompare(a.noteDate ?? '');
      if (d !== 0) return d;
      return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
    });
}

function formatScoreDisplay(c: PrintCriterion, sc: PrintScore | undefined): string {
  if (!sc) return '—';
  if ((c.scoreType ?? 'numeric') === 'sign') {
    if (sc.score === 1) return '+';
    if (sc.score === -1) return '−';
    return '·';
  }
  return String(sc.score);
}

export function PrintReportModal({
  open,
  onClose,
  token,
  initialListId,
  initialSubjectFilterId,
  lists,
  subjects,
  allCriteria,
  me,
}: {
  open: boolean;
  onClose: () => void;
  token: string | null;
  initialListId: string | null;
  initialSubjectFilterId: string | null;
  lists: PrintStudentList[];
  subjects: PrintSubjectOption[];
  allCriteria: PrintCriterion[];
  me: Me;
}) {
  const [printListId, setPrintListId] = useState<string | null>(null);
  const [printSubjectId, setPrintSubjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<PrintStudent[]>([]);
  const [scores, setScores] = useState<PrintScore[]>([]);
  const [notes, setNotes] = useState<PrintStudentNote[]>([]);
  const [pickStudents, setPickStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setPrintListId(initialListId);
    setPrintSubjectId(initialSubjectFilterId);
  }, [open, initialListId, initialSubjectFilterId]);

  useEffect(() => {
    if (!open) return;
    if (!token) return;
    const listId = printListId ?? undefined;
    setLoading(true);
    apiFetch<{
      students: PrintStudent[];
      scores: PrintScore[];
      studentNotes?: PrintStudentNote[];
    }>(`/teacher-agenda/evaluation${listId ? `?listId=${encodeURIComponent(listId)}` : ''}`, { token })
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
  }, [open, token, printListId]);

  const criteriaCols = useMemo(() => {
    if (printSubjectId === null) return allCriteria;
    return allCriteria.filter((c) => !c.subjectId || c.subjectId === printSubjectId);
  }, [allCriteria, printSubjectId]);

  const selectedStudents = useMemo(
    () => students.filter((s) => pickStudents.has(s.id)),
    [students, pickStudents],
  );

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

    const listLabel =
      printListId === null ? 'Tüm öğrenciler (yüklenen liste)' : lists.find((l) => l.id === printListId)?.name ?? 'Liste';
    const subjectLabel =
      printSubjectId === null ? 'Tüm dersler' : subjects.find((s) => s.id === printSubjectId)?.label ?? printSubjectId;

    const teacher = escapeHtml(me.display_name || me.email || '—');
    const school = escapeHtml(me.school?.name ?? '—');
    const printedAt = format(new Date(), "d MMMM yyyy HH:mm", { locale: tr });

    const legend = `
      <div class="legend">
        <span class="lg g"><i></i> Puan girilmiş</span>
        <span class="lg e"><i></i> Boş</span>
        <span class="lg n">Not: Son kayıt gösterilir; birden fazla giriş varsa sayı belirtilir.</span>
      </div>`;

    const headTop = criteriaCols
      .map(
        (c) =>
          `<th class="ch" scope="col"><div class="cn">${escapeHtml(c.name)}</div><div class="ct">${(c.scoreType ?? 'numeric') === 'sign' ? '+/−' : `0–${c.maxScore}`}</div></th>`,
      )
      .join('');

    const bodyRows = selectedStudents
      .map((s) => {
        const cells = criteriaCols
          .map((c) => {
            const chain = scoresForCell(scores, s.id, c.id);
            const latest = chain[0];
            const has = !!latest;
            const cls = has ? 'td g' : 'td e';
            const main = formatScoreDisplay(c, latest);
            const nd = latest?.noteDate
              ? format(new Date(latest.noteDate), 'd.MM.yy', { locale: tr })
              : '—';
            const ca = latest?.createdAt
              ? format(new Date(latest.createdAt), 'd.MM.yy HH:mm', { locale: tr })
              : '—';
            const cnt = chain.length > 1 ? `<div class="cnt">${chain.length} kayıt</div>` : '';
            const nt = latest?.note ? `<div class="nt">${escapeHtml(latest.note)}</div>` : '';
            const st = has ? '<span class="st ok">Verildi</span>' : '<span class="st no">Boş</span>';
            return `<td class="${cls}"><div class="m">${escapeHtml(main)}</div>${st}<div class="dt">Kayıt: ${escapeHtml(nd)}</div><div class="dt">Sistem: ${escapeHtml(ca)}</div>${cnt}${nt}</td>`;
          })
          .join('');
        return `<tr><th class="rowh" scope="row">${escapeHtml(s.name)}</th>${cells}</tr>`;
      })
      .join('');

    const noteRows = selectedStudents
      .map((s) => {
        const sn = notes.filter((n) => n.studentId === s.id && (n.noteType === 'positive' || n.noteType === 'negative'));
        const pos = sn.filter((n) => n.noteType === 'positive').length;
        const neg = sn.filter((n) => n.noteType === 'negative').length;
        const last = [...sn].sort((a, b) => (b.noteDate ?? '').localeCompare(a.noteDate ?? ''))[0];
        const lastStr = last?.noteDate
          ? format(new Date(last.noteDate), 'd.MM.yyyy', { locale: tr })
          : '—';
        const desc = last?.description ? escapeHtml(last.description) : '—';
        return `<tr><td>${escapeHtml(s.name)}</td><td class="np">${pos}</td><td class="nn">${neg}</td><td>${lastStr}</td><td class="desc">${desc}</td></tr>`;
      })
      .join('');

    const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"/><title>Değerlendirme raporu</title>
<style>
  * { box-sizing: border-box; }
  @page { margin: 10mm; size: A4 landscape; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 8.5px; line-height: 1.25; color: #0f172a; margin: 0; padding: 10px; }
  h1 { font-size: 14px; margin: 0 0 6px; color: #312e81; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px; font-size: 8px; margin-bottom: 8px; padding: 8px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; }
  .meta b { color: #3730a3; }
  .legend { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 8px 0; font-size: 7.5px; }
  .lg { display: inline-flex; align-items: center; gap: 4px; }
  .lg i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
  .lg.g i { background: #a7f3d0; border: 1px solid #34d399; }
  .lg.e i { background: #fde68a; border: 1px solid #fbbf24; }
  .wrap { overflow-x: auto; }
  table.main { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table.main th, table.main td { border: 1px solid #94a3b8; padding: 3px 4px; vertical-align: top; word-wrap: break-word; }
  table.main thead th { background: #4f46e5 !important; color: #fff !important; font-weight: 700; }
  th.ch { min-width: 56px; }
  th.ch .cn { font-size: 8px; }
  th.ch .ct { font-size: 7px; opacity: 0.9; font-weight: 500; margin-top: 2px; }
  th.rowh { background: #e0e7ff !important; color: #1e1b4b !important; text-align: left; width: 88px; font-size: 8px; }
  td.td.g { background: #d1fae5 !important; }
  td.td.e { background: #fef9c3 !important; }
  td .m { font-size: 11px; font-weight: 800; text-align: center; color: #065f46; }
  td.e .m { color: #92400e; }
  .st { display: inline-block; margin-top: 2px; font-size: 6.5px; font-weight: 700; padding: 1px 4px; border-radius: 3px; }
  .st.ok { background: #059669; color: #fff; }
  .st.no { background: #d97706; color: #fff; }
  .dt { font-size: 6.5px; color: #475569; margin-top: 1px; }
  .cnt { font-size: 6px; color: #7c3aed; font-weight: 600; margin-top: 2px; }
  .nt { font-size: 6.5px; color: #334155; margin-top: 3px; border-top: 1px dashed #94a3b8; padding-top: 2px; }
  h2 { font-size: 10px; margin: 14px 0 6px; color: #312e81; }
  table.notes { width: 100%; border-collapse: collapse; font-size: 8px; }
  table.notes th, table.notes td { border: 1px solid #cbd5e1; padding: 4px 6px; }
  table.notes thead th { background: #0d9488 !important; color: #fff !important; }
  .np { color: #047857; font-weight: 700; text-align: center; background: #ecfdf5 !important; }
  .nn { color: #b91c1c; font-weight: 700; text-align: center; background: #fef2f2 !important; }
  .desc { font-size: 7px; color: #475569; max-width: 200px; }
</style></head><body>
  <h1>Öğrenci değerlendirme raporu</h1>
  <div class="meta">
    <div><b>Okul</b> ${school}</div>
    <div><b>Öğretmen</b> ${teacher}</div>
    <div><b>Sınıf / liste</b> ${escapeHtml(listLabel)}</div>
    <div><b>Ders filtresi</b> ${escapeHtml(subjectLabel)}</div>
    <div><b>Yazdırma</b> ${escapeHtml(printedAt)}</div>
    <div><b>Öğrenci</b> ${selectedStudents.length} kişi</div>
    <div><b>Kriter</b> ${criteriaCols.length} sütun</div>
    <div><b>Renkli çıktı</b> Tarayıcıda «Arka plan grafikleri» açık olsun</div>
  </div>
  ${legend}
  <div class="wrap">
    <table class="main">
      <thead><tr><th class="rowh" scope="col">Öğrenci</th>${headTop}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
  <h2>+ / − hızlı notlar özeti</h2>
  <table class="notes">
    <thead><tr><th>Öğrenci</th><th>Olumlu</th><th>Olumsuz</th><th>Son not</th><th>Son açıklama</th></tr></thead>
    <tbody>${noteRows}</tbody>
  </table>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Pop-up engellendi; yazdırma penceresi açılamadı.');
      return;
    }
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }, [selectedStudents, criteriaCols, scores, notes, me, printListId, lists, printSubjectId, subjects]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[min(92vh,100dvh)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:max-h-[90vh] sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <div className="flex items-center justify-between border-b border-border p-4">
          <h3 className="text-lg font-semibold">Yazdırma seçenekleri</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-2 hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Sınıf / öğrenci listesi</label>
            <select
              value={printListId ?? ''}
              onChange={(e) => setPrintListId(e.target.value || null)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Tüm öğrenciler (okul listesi, üst sınır)</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Ders (kriter sütunları)</label>
            <select
              value={printSubjectId ?? ''}
              onChange={(e) => setPrintSubjectId(e.target.value || null)}
              className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Tüm dersler + genel kriterler</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} (genel + bu ders)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">Öğrenciler</label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-primary hover:underline" onClick={selectAllStudents}>
                  Tümü
                </button>
                <button type="button" className="text-muted-foreground hover:underline" onClick={clearStudents}>
                  Hiçbiri
                </button>
              </div>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Yükleniyor…</p>
              ) : students.length === 0 ? (
                <p className="text-sm text-muted-foreground">Öğrenci yok</p>
              ) : (
                students.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={pickStudents.has(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="rounded border-input"
                    />
                    <span className="truncate">{s.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Rapor yatay A4, renkli hücreler ve özet not tablosu içerir. Yazdırmada renk için tarayıcı ayarından arka plan grafiklerini açın.
          </p>
          {!loading && criteriaCols.length === 0 && (
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Bu ders filtresiyle gösterilecek kriter yok; «Tüm dersler» seçin veya kriter ekleyin.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
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
