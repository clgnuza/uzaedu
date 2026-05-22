'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { StudioValidationGate } from '@/components/ders-dagit/StudioValidationGate';
import { computeStudioReadiness } from '@/lib/ders-dagit-readiness';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import Link from 'next/link';
import { TimetableReadonly } from '@/components/timetable/TimetableReadonly';

export default function UretPage() {
  const { token } = useAuth();
  const { studio, overview, refresh } = useDersDagitStudio();
  const readiness = computeStudioReadiness(overview);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{
    programs: Array<{ id: string; name: string; score: number | null }>;
    score?: number;
    violations?: string[];
    violation_links?: Array<{ text: string; href?: string }>;
    failed?: number;
  } | null>(null);
  const [previewEntries, setPreviewEntries] = useState<
    Array<{ day_of_week: number; lesson_num: number; class_section: string; subject: string }>
  >([]);
  const [compare, setCompare] = useState<
    Array<{ id: string; name: string | null; score: number | null; entry_count: number }>
  >([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [useCsp, setUseCsp] = useState(true);

  async function generate() {
    if (!token || !studio) return;
    setBusy(true);
    try {
      const res = await apiFetch<{
        programs: Array<{ id: string; name: string | null; score: number | null }>;
        entries_count: number;
        score?: number;
        violations?: string[];
        violation_links?: Array<{ text: string; href?: string }>;
        failed?: number;
      }>(`/ders-dagit/studios/${studio.id}/generate`, {
        token,
        method: 'POST',
        body: { duration_sec: 90, versions: 3, use_csp: useCsp },
      });
      setLast({
        programs: res.programs.map((p) => ({ id: p.id, name: p.name ?? 'Program', score: p.score })),
        score: res.score,
        violations: res.violations,
        violation_links: res.violation_links,
        failed: res.failed,
      });
      const ids = res.programs.map((p) => p.id).join(',');
      if (ids && studio) {
        const cmp = await apiFetch<{ programs: typeof compare }>(
          `/ders-dagit/studios/${studio.id}/programs/compare?ids=${ids}`,
          { token },
        );
        setCompare(cmp.programs);
      }
      const best = [...res.programs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
      if (best && studio) {
        setPreviewId(best.id);
        const detail = await apiFetch<{
          entries: Array<{ day_of_week: number; lesson_num: number; class_section: string; subject: string }>;
        }>(`/ders-dagit/studios/${studio.id}/programs/${best.id}`, { token });
        setPreviewEntries(detail.entries);
      }
      toast.success(`${res.entries_count} slot üretildi`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Üretim başarısız');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Otomatik üretim</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          CSP geri izleme + yerel arama + swap onarım. Hazırlık: <strong>{readiness.percent}%</strong>
        </p>
        {last?.score != null && (
          <p className="text-xs text-muted-foreground">
            Neden bu skor? Daha yüksek skor = daha az kural ihlali ve dengeli öğretmen yükü.
          </p>
        )}
        <StudioValidationGate overview={overview} action="generate">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={useCsp} onChange={(e) => setUseCsp(e.target.checked)} />
            CSP motoru (önerilen)
          </label>
          <Button type="button" disabled={busy || !studio} onClick={() => void generate()}>
            {busy ? 'Üretiliyor…' : 'Program üret (3 versiyon)'}
          </Button>
        </StudioValidationGate>
        {last && (
          <div className="space-y-2 text-sm">
            {last.score != null && <p>Motor skoru: <strong>{last.score}</strong></p>}
            {last.failed != null && last.failed > 0 && (
              <p className="text-amber-700 dark:text-amber-300">{last.failed} atama yerleştirilemedi.</p>
            )}
            {(last.violation_links?.length ? last.violation_links : last.violations?.map((t) => ({ text: t }))) &&
              (last.violation_links?.length || last.violations?.length) ? (
              <ul className="max-h-32 overflow-y-auto rounded border border-border p-2 text-xs text-muted-foreground">
                {(last.violation_links ?? last.violations!.map((t) => ({ text: t })))
                  .slice(0, 15)
                  .map((v, i) => (
                    <li key={i}>
                      {v.href ? (
                        <Link href={v.href} className="text-primary underline">
                          {v.text}
                        </Link>
                      ) : (
                        v.text
                      )}
                    </li>
                  ))}
              </ul>
            ) : null}
            {compare.length > 0 && (
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left">Versiyon</th>
                    <th>Skor</th>
                    <th>Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <button
                          type="button"
                          className="underline"
                          onClick={async () => {
                            if (!token || !studio) return;
                            setPreviewId(p.id);
                            const d = await apiFetch<{ entries: typeof previewEntries }>(
                              `/ders-dagit/studios/${studio.id}/programs/${p.id}`,
                              { token },
                            );
                            setPreviewEntries(d.entries);
                          }}
                        >
                          {p.name ?? p.id.slice(0, 8)}
                        </button>
                      </td>
                      <td className="text-center">{p.score ?? '—'}</td>
                      <td className="text-center">{p.entry_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
        {previewEntries.length > 0 && (
          <>
            {previewId && <p className="text-xs text-muted-foreground">Önizleme: {previewId.slice(0, 8)}…</p>}
            <TimetableReadonly entries={previewEntries} />
            {previewId && (
              <Button type="button" size="sm" asChild>
                <Link href={`/ders-dagit/stüdyo/program?id=${previewId}`}>Editörde aç</Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
