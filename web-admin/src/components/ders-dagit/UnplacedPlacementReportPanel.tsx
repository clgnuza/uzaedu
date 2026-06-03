import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { UnplacedPlacementReport } from '@/lib/ders-dagit-unplaced-report';

export function UnplacedPlacementReportPanel({ report }: { report: UnplacedPlacementReport }) {
  return (
    <div className="rounded-xl border border-amber-500/35 bg-amber-500/8 p-3 text-sm">
      <div className="mb-2 flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <div>
          <p className="font-medium text-amber-950 dark:text-amber-100">
            Eksik yerleşim — {report.total_missing_hours} saat, {report.card_count} kart
          </p>
          <p className="mt-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
            Kartlar bölünmedi; aşağıdaki atamalar programa sığmadı.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-amber-500/20 bg-background/60">
        <table className="w-full min-w-[32rem] text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="px-2 py-1.5 font-medium">Ders</th>
              <th className="px-2 py-1.5 font-medium">Sınıf</th>
              <th className="px-2 py-1.5 font-medium">Öğretmen</th>
              <th className="px-2 py-1.5 font-medium text-right">Eksik</th>
              <th className="px-2 py-1.5 font-medium">Desen</th>
              <th className="px-2 py-1.5 font-medium text-right" title="Şu an yerleştirilebilir tek saat">
                Müsait 1
              </th>
              <th className="px-2 py-1.5 font-medium text-right" title="Sınıf tablosunda yan yana boş çift">
                Sınıf 2
              </th>
              <th className="px-2 py-1.5 font-medium text-right" title="Tek ders kaydırınca açılabilir çift">
                Kaydır 2
              </th>
              <th className="px-2 py-1.5 font-medium text-right" title="Öğretmen + sınıf ile şimdi yerleşebilir çift">
                Müsait 2
              </th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((r) => (
              <tr key={`${r.assignment_id}:${r.class_section}`} className="border-b border-border/40 last:border-0">
                <td className="max-w-[10rem] truncate px-2 py-1.5" title={r.subject}>
                  {r.subject}
                </td>
                <td className="max-w-[8rem] truncate px-2 py-1.5" title={r.class_section}>
                  {r.class_section}
                </td>
                <td className="px-2 py-1.5">{r.teacher_name}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.missing_hours}</td>
                <td className="px-2 py-1.5 tabular-nums">
                  {r.pattern ?? '—'}
                  {r.pattern_remain && r.pattern_remain !== r.pattern ? (
                    <span className="text-muted-foreground"> (kalan {r.pattern_remain})</span>
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.free_single_slots}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.class_block2_slots ?? 0}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{r.shiftable_block2_slots ?? 0}</td>
                <td
                  className={
                    r.free_block2_slots === 0 &&
                    r.missing_hours >= 2 &&
                    ((r.class_block2_slots ?? 0) > 0 || (r.shiftable_block2_slots ?? 0) > 0)
                      ? 'px-2 py-1.5 text-right font-medium tabular-nums text-sky-800 dark:text-sky-300'
                      : r.free_block2_slots === 0 && r.missing_hours >= 2
                        ? 'px-2 py-1.5 text-right font-medium tabular-nums text-amber-800 dark:text-amber-300'
                        : 'px-2 py-1.5 text-right tabular-nums'
                  }
                  title={
                    (r.class_block2_slots ?? 0) > 0 && r.free_block2_slots === 0
                      ? 'Sınıfta çift boş var; öğretmen o saatte müsait değil'
                      : undefined
                  }
                >
                  {r.free_block2_slots}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.recommendations.length > 0 && (
        <div className="mt-3 space-y-1 text-xs text-amber-950/90 dark:text-amber-100/90">
          <p className="font-medium">Ne yapmalı</p>
          <ol className="list-decimal space-y-0.5 pl-4">
            {report.recommendations.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-2 text-xs">
        <Link href="/ders-dagit/studyo/atamalar" className="underline underline-offset-2 hover:text-foreground">
          Atamalara git
        </Link>
        {' · '}
        <Link href="/ders-dagit/studyo/kurulum" className="underline underline-offset-2 hover:text-foreground">
          Dağıtım kurulumu
        </Link>
      </p>
    </div>
  );
}
