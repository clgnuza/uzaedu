'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ProgramGridPreview } from '@/components/ders-dagit/program-grid-preview';

export default function UretPage() {
  const { token } = useAuth();
  const { studio, refresh } = useDersDagitStudio();
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{
    programs: Array<{ id: string; name: string; score: number | null }>;
    score?: number;
    violations?: string[];
    failed?: number;
  } | null>(null);
  const [previewEntries, setPreviewEntries] = useState<
    Array<{ day_of_week: number; lesson_num: number; class_section: string; subject: string }>
  >([]);
  const [compare, setCompare] = useState<
    Array<{ id: string; name: string | null; score: number | null; entry_count: number }>
  >([]);
  const [previewId, setPreviewId] = useState<string | null>(null);

  async function generate() {
    if (!token || !studio) return;
    setBusy(true);
    try {
      const res = await apiFetch<{
        programs: Array<{ id: string; name: string | null; score: number | null }>;
        entries_count: number;
        score?: number;
        violations?: string[];
        failed?: number;
      }>(`/ders-dagit/studios/${studio.id}/generate`, {
        token,
        method: 'POST',
        body: { duration_sec: 60, versions: 3 },
      });
      setLast({
        programs: res.programs.map((p) => ({ id: p.id, name: p.name ?? 'Program', score: p.score })),
        score: res.score,
        violations: res.violations,
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
          Yerel arama + swap onarım + kural skoru. Önce ön doğrulama hatası olmamalı.
        </p>
        <Button type="button" disabled={busy || !studio} onClick={() => void generate()}>
          {busy ? 'Üretiliyor…' : 'Program üret (3 versiyon)'}
        </Button>
        {last && (
          <div className="space-y-2 text-sm">
            {last.score != null && <p>Motor skoru: <strong>{last.score}</strong></p>}
            {last.failed != null && last.failed > 0 && (
              <p className="text-amber-700 dark:text-amber-300">{last.failed} atama yerleştirilemedi.</p>
            )}
            {last.violations && last.violations.length > 0 && (
              <ul className="max-h-32 overflow-y-auto rounded border border-border p-2 text-xs text-muted-foreground">
                {last.violations.slice(0, 15).map((v, i) => (
                  <li key={i}>{v}</li>
                ))}
              </ul>
            )}
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
            <ProgramGridPreview entries={previewEntries} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
