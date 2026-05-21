'use client';

import type { SessionReport } from '@/lib/optik-sessions-api';

export function SessionMatrixFull({
  report,
  onStudentPdf,
}: {
  report: SessionReport;
  onStudentPdf?: (studentId: string) => void;
}) {
  const rows = report.combined_matrix?.length ? report.combined_matrix : report.matrix;
  const qCount = report.session.question_count;
  const hasOpen = (report.session.open_questions?.length ?? 0) > 0;

  if (!rows.length) {
    return <p className="text-[11px] text-muted-foreground">Henüz veri yok.</p>;
  }

  return (
    <div className="max-h-[50vh] overflow-auto">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b text-left">
            <th className="sticky left-0 z-20 bg-card py-1 pr-2">Öğrenci</th>
            <th className="px-0.5">D</th>
            <th className="px-0.5">Y</th>
            <th className="px-0.5">B</th>
            <th className="px-0.5 font-bold">Net</th>
            {Array.from({ length: qCount }, (_, i) => (
              <th key={i} className="w-5 px-0.5 text-center font-normal text-muted-foreground">
                {i + 1}
              </th>
            ))}
            {hasOpen ? (
              <>
                <th className="px-1">Açık</th>
                <th className="px-1">%</th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((m, idx) => {
            const key =
              'scan_id' in m && m.scan_id
                ? m.scan_id
                : (m.student_id ?? `row-${idx}`);
            const answers = 'answers' in m ? m.answers : [];
            const openScore = 'open_score' in m ? m.open_score : null;
            const openPct = 'open_pct' in m ? m.open_pct : null;
            return (
              <tr key={key} className="border-b border-border/40">
                <td className="sticky left-0 z-10 max-w-[120px] bg-card py-1 pr-2 font-medium">
                  <span className="block truncate">{m.student_label ?? '—'}</span>
                  {onStudentPdf && m.student_id ? (
                    <button
                      type="button"
                      className="text-[9px] text-violet-600 hover:underline dark:text-violet-400"
                      onClick={() => onStudentPdf(m.student_id!)}
                    >
                      PDF
                    </button>
                  ) : null}
                </td>
                <td className="px-0.5 text-center">{m.correct ?? '—'}</td>
                <td className="px-0.5 text-center">{m.wrong ?? '—'}</td>
                <td className="px-0.5 text-center">{m.blank ?? '—'}</td>
                <td className="px-0.5 text-center font-bold text-violet-700 dark:text-violet-300">
                  {m.net ?? '—'}
                </td>
                {Array.from({ length: qCount }, (_, i) => {
                  const a = answers.find((x) => x.question === i + 1);
                  return (
                    <td key={i} className="px-0.5 text-center text-muted-foreground">
                      {a?.label ?? '·'}
                    </td>
                  );
                })}
                {hasOpen ? (
                  <>
                    <td className="px-1 text-center tabular-nums">
                      {openScore != null ? `${openScore}` : '—'}
                    </td>
                    <td className="px-1 text-center tabular-nums">
                      {openPct != null ? `%${openPct}` : '—'}
                    </td>
                  </>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
