'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useStudioValidation } from '@/hooks/use-studio-validation';
import { apiFetch } from '@/lib/api';
import { downloadDersDagitExport } from '@/lib/ders-dagit-api';
import { downloadParentAllZip, fetchEditorContext } from '@/lib/ders-dagit-timetable-api';
import { StudioValidationGate } from '@/components/ders-dagit/StudioValidationGate';
import { PublishConfirmDialog, type PublishSummary } from './PublishConfirmDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Star } from 'lucide-react';

type Program = {
  id: string;
  name: string | null;
  status: string;
  score: number | null;
  is_favorite?: boolean;
};

export function TimetablePublishPanel({ programId }: { programId: string }) {
  const { token } = useAuth();
  const { studio, overview, refresh } = useDersDagitStudio();
  const { errors: validationErrors } = useStudioValidation(studio?.id);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [shareSection, setShareSection] = useState('5A');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<PublishSummary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setPrograms(await apiFetch<Program[]>(`/ders-dagit/studios/${studio.id}/programs`, { token }));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPublishConfirm(id: string) {
    if (!token || !studio) return;
    const ctx = await fetchEditorContext(token, studio.id, id);
    const published = programs.find((p) => p.status === 'published' && p.id !== id);
    let diffSummary: string | null = null;
    if (published) {
      const prev = await fetchEditorContext(token, studio.id, published.id);
      const key = (e: { class_section: string; subject: string; day_of_week: number; lesson_num: number }) =>
        `${e.class_section}|${e.subject}|${e.day_of_week}|${e.lesson_num}`;
      const prevKeys = new Set(prev.entries.map(key));
      const diff = ctx.entries.filter((e) => !prevKeys.has(key(e))).length;
      if (diff > 0) diffSummary = `Yayındaki programa göre ~${diff} slot farklı (${published.name ?? 'yayın'})`;
      else diffSummary = 'Yayındaki programla aynı dağılım görünüyor';
    }
    setSummary({
      programName: ctx.program.name,
      entryCount: ctx.entries.length,
      clashCount: ctx.clashes.length,
      unplacedCount: ctx.unplaced.length,
      validationErrors: validationErrors.length,
      diffSummary,
    });
    setConfirmOpen(true);
  }

  async function publish(id: string) {
    if (!token || !studio) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ plan_id: string; imported: number }>(
        `/ders-dagit/studios/${studio.id}/programs/${id}/publish`,
        {
          token,
          method: 'POST',
          body: JSON.stringify({
            valid_from: validFrom,
            valid_until: validUntil.trim() || null,
          }),
        },
      );
      toast.success(`Yayınlandı — ${res.imported} satır okul programına aktarıldı`);
      setConfirmOpen(false);
      await refresh();
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayın başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function share(id: string) {
    if (!token || !studio) return;
    const res = await apiFetch<{ path: string }>(`/ders-dagit/studios/${studio.id}/programs/${id}/share`, {
      token,
      method: 'POST',
      body: JSON.stringify({ class_section: shareSection.trim() || null }),
    });
    const url = `${window.location.origin}${res.path}`;
    setShareUrl(url);
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success('Link kopyalandı');
  }

  const pid = programId || programs[0]?.id;

  return (
    <>
      <Card id="publish-panel">
        <CardHeader>
          <CardTitle className="text-base">Yayın ve dışa aktarma</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <StudioValidationGate overview={overview} action="publish">
            <Button type="button" disabled={!pid} onClick={() => pid && void openPublishConfirm(pid)}>
              Okula yayınla…
            </Button>
          </StudioValidationGate>
          <div className="flex flex-wrap items-end gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href="/ders-dagit/stüdyo/adalet">Öğretmen yükü</Link>
            </Button>
            {pid && token && studio && (
              <>
                <Button type="button" size="sm" variant="secondary" onClick={() => void downloadDersDagitExport(token, studio.id, pid, 'eokul_xlsx')}>
                  e-Okul XLSX
                </Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => void downloadDersDagitExport(token, studio.id, pid, 'council_pdf')}>
                  Kurul PDF
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await downloadParentAllZip(token, studio.id, pid);
                      toast.success('Veli PDF zip indirildi');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Zip başarısız');
                    }
                  }}
                >
                  Veli ZIP
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <div>
              <Label className="text-xs">Paylaşım sınıfı</Label>
              <Input className="h-8 w-20" value={shareSection} onChange={(e) => setShareSection(e.target.value)} />
            </div>
            <Button type="button" size="sm" variant="outline" disabled={!pid} onClick={() => pid && void share(pid)}>
              Paylaşım linki
            </Button>
            {pid && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() =>
                  void apiFetch(`/ders-dagit/studios/${studio!.id}/programs/${pid}/favorite`, {
                    token: token!,
                    method: 'POST',
                  })
                }
              >
                <Star className="size-4" />
              </Button>
            )}
          </div>
          {shareUrl && <p className="break-all text-xs text-muted-foreground">{shareUrl}</p>}
        </CardContent>
      </Card>
      <PublishConfirmDialog
        open={confirmOpen}
        summary={summary}
        validFrom={validFrom}
        validUntil={validUntil}
        onValidFrom={setValidFrom}
        onValidUntil={setValidUntil}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => pid && void publish(pid)}
        busy={busy}
      />
    </>
  );
}
