'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { useStudioValidation } from '@/hooks/use-studio-validation';
import { listStudioPrograms } from '@/lib/ders-dagit-program-api';
import {
  fetchPublishPreview,
  publishProgramToSchool,
  type PublishPreview,
} from '@/lib/ders-dagit-publish';
import { downloadDersDagitExport } from '@/lib/ders-dagit-api';
import { loadReportPrintMode } from '@/lib/ders-dagit-report-settings';
import { programStatusLabel } from '@/lib/timetable-program-status';
import { StudioValidationGate } from '@/components/ders-dagit/StudioValidationGate';
import { PublishConfirmDialog } from './PublishConfirmDialog';
import { ProgramManageBar } from './ProgramManageBar';
import { Button } from '@/components/ui/button';
import { ProgramClassSharePanel } from './ProgramClassSharePanel';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  FileDown,
  GraduationCap,
  Send,
  Star,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';

type Program = {
  id: string;
  name: string | null;
  status: string;
  score: number | null;
  is_favorite?: boolean;
  published_plan_id?: string | null;
};

const STEPS = [
  { id: 1, title: 'Kontrol', desc: 'Çakışma ve doğrulama' },
  { id: 2, title: 'Onay', desc: 'Müdür / kurul onayı' },
  { id: 3, title: 'Yayın', desc: 'Ders Programım\'a aktar' },
  { id: 4, title: 'Çıktı', desc: 'PDF ve e-Okul' },
] as const;

export function TimetablePublishPanel({ programId }: { programId: string }) {
  const { token } = useAuth();
  const { studio, overview, refresh } = useDersDagitStudio();
  useStudioValidation(studio?.id, { initialIssues: overview?.validation });
  const [programs, setPrograms] = useState<Program[]>([]);
  const [preview, setPreview] = useState<PublishPreview | null>(null);
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState('');
  const [riskAck, setRiskAck] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const pid =
    programId && programs.some((p) => p.id === programId) ? programId : programs[0]?.id;
  const current = programs.find((p) => p.id === pid);
  const publishedProg = programs.find((p) => p.status === 'published');

  const load = useCallback(async () => {
    if (!token || !studio) return;
    setPrograms(await listStudioPrograms(token, studio.id));
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!token || !studio || !pid) {
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    void fetchPublishPreview(token, studio.id, pid)
      .then(setPreview)
      .catch(() => setPreview(null))
      .finally(() => setLoadingPreview(false));
  }, [token, studio, pid]);

  const stepDone = useMemo(() => {
    const p = preview;
    return {
      check: !!p && p.can_publish,
      approval: current?.status === 'published' || current?.status === 'council_review',
      publish: current?.status === 'published',
      export: current?.status === 'published',
    };
  }, [preview, current]);

  async function openPublishConfirm() {
    if (!token || !studio || !pid) return;
    const p = await fetchPublishPreview(token, studio.id, pid);
    setPreview(p);
    if (!p.can_publish) {
      toast.error(p.blockers.join(' · ') || 'Yayın engellendi');
      return;
    }
    setRiskAck(false);
    setConfirmOpen(true);
  }

  async function publish() {
    if (!token || !studio || !pid) return;
    setBusy(true);
    try {
      const res = await publishProgramToSchool(token, studio.id, pid, {
        valid_from: validFrom,
        valid_until: validUntil.trim() || null,
        risk_acknowledged: riskAck || !preview?.requires_risk_ack,
      });
      toast.success(`Yayınlandı — ${res.imported} satır okul programına aktarıldı`);
      setConfirmOpen(false);
      await refresh({ force: true });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yayın başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function quickExport(kind: 'pdf' | 'council_pdf' | 'eokul_xlsx') {
    if (!token || !studio || !pid) return;
    const mode = loadReportPrintMode();
    await downloadDersDagitExport(token, studio.id, pid, kind, undefined, mode);
    toast.success('İndirme başlatıldı');
  }

  return (
    <>
      <section
        id="publish-panel"
        className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-sm"
      >
        <div className="border-b bg-gradient-to-r from-primary/8 via-card to-amber-500/10 px-4 py-4 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
                <Send className="size-4 text-primary" />
                Yayın ve dışa aktarma
              </h2>
              <p className="mt-1 max-w-xl text-xs text-muted-foreground">
                Ders dağıtım programını onaylayıp okul <strong>Ders Programım</strong> modülüne aktarın; ardından
                resmi PDF ve e-Okul çıktılarını alın.
              </p>
            </div>
            {current && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
                  current.status === 'published'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {programStatusLabel(current.status)}
              </span>
            )}
          </div>

          <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {STEPS.map((s) => {
              const done =
                s.id === 1
                  ? stepDone.check
                  : s.id === 2
                    ? stepDone.approval
                    : s.id === 3
                      ? stepDone.publish
                      : stepDone.export;
              return (
                <li
                  key={s.id}
                  className={cn(
                    'rounded-lg border px-2.5 py-2',
                    done ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' : 'bg-background/60',
                  )}
                >
                  <p className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                    {done ? <CheckCircle2 className="size-3 text-emerald-600" /> : <span>{s.id}</span>}
                    {s.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-5">
          <div className="space-y-4 lg:col-span-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Yayın öncesi özet
              </p>
              {loadingPreview ? (
                <p className="text-sm text-muted-foreground">Kontrol ediliyor…</p>
              ) : preview ? (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <Stat label="Ders saati" value={String(preview.entry_count)} />
                  <Stat label="Çakışma" value={String(preview.clash_count)} bad={preview.clash_count > 0} />
                  <Stat
                    label="Yerleşme"
                    value={`%${preview.placement_percent}`}
                    warn={preview.unplaced_hours > 0}
                    bad={preview.unplaced_hours > 0}
                  />
                  <Stat
                    label="Yerleşmemiş"
                    value={`${preview.unplaced_count} · ${preview.unplaced_hours} sa`}
                    warn={preview.unplaced_count > 0}
                    bad={preview.unplaced_count > 0}
                  />
                  <Stat label="Doğrulama hatası" value={String(preview.validation_error_count)} bad={preview.validation_error_count > 0} />
                  <Stat label="Uyarı" value={String(preview.validation_warn_count)} />
                  <Stat label="Skor" value={preview.program.score != null ? String(preview.program.score) : '—'} />
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Program seçin</p>
              )}
              {preview && !preview.can_publish && (
                <p className="mt-2 text-xs text-destructive">{preview.blockers.join(' · ')}</p>
              )}
            </div>

            <StudioValidationGate overview={overview} action="publish">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={!pid || loadingPreview || !preview?.can_publish}
                  onClick={() => void openPublishConfirm()}
                >
                  <Send className="mr-1.5 size-4" />
                  Okula yayınla…
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/ders-dagit/studyo/dogrulama">Doğrulama</Link>
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/ders-dagit/studyo/adalet">Öğretmen yükü</Link>
                </Button>
              </div>
            </StudioValidationGate>

            {publishedProg && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-50/40 px-3 py-2 text-xs dark:bg-emerald-950/20">
                <GraduationCap className="size-4 text-emerald-700" />
                <span>
                  Okul programı yayında: <strong>{publishedProg.name ?? '—'}</strong>
                </span>
                <Button type="button" size="sm" variant="secondary" asChild>
                  <Link href="/ders-programi">Ders Programım</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-3 lg:col-span-2">
            <div className="rounded-xl border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <FileDown className="size-3.5" />
                Hızlı dışa aktarma
              </p>
              <div className="flex flex-col gap-1.5">
                <Button type="button" size="sm" variant="secondary" disabled={!pid} onClick={() => void quickExport('pdf')}>
                  Program PDF
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!pid} onClick={() => void quickExport('council_pdf')}>
                  Kurul tutanağı
                </Button>
                <Button type="button" size="sm" variant="secondary" disabled={!pid} onClick={() => void quickExport('eokul_xlsx')}>
                  e-Okul XLSX
                </Button>
                <Button type="button" size="sm" variant="outline" asChild>
                  <Link href={pid ? `/ders-dagit/studyo/raporlar?program=${pid}` : '/ders-dagit/studyo/raporlar'}>
                    Tüm raporlar
                    <ArrowRight className="ml-1 size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>

            {pid && token && studio && (
              <ProgramClassSharePanel token={token} studioId={studio.id} programId={pid} />
            )}

            <div className="rounded-xl border p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
                <CalendarRange className="size-3.5" />
                Kurul belgeleri
              </p>
              <Button type="button" size="sm" variant="outline" className="w-full" asChild>
                <Link href={`/ders-dagit/studyo/raporlar${pid ? `?program=${pid}` : ''}`}>
                  Kapak / onay önizleme
                </Link>
              </Button>
            </div>

            {pid && (
              <ProgramManageBar
                programId={pid}
                program={current ?? null}
                onChanged={load}
                compact
              />
            )}
            {pid && token && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="w-full"
                onClick={() =>
                  void apiFetch(`/ders-dagit/studios/${studio!.id}/programs/${pid}/favorite`, {
                    token,
                    method: 'POST',
                  }).then(() => load())
                }
              >
                <Star className="mr-1 size-4" />
                Favori işaretle
              </Button>
            )}
          </div>
        </div>
      </section>

      <PublishConfirmDialog
        open={confirmOpen}
        preview={preview}
        validFrom={validFrom}
        validUntil={validUntil}
        riskAck={riskAck}
        onValidFrom={setValidFrom}
        onValidUntil={setValidUntil}
        onRiskAck={setRiskAck}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void publish()}
        busy={busy}
      />
    </>
  );
}

function Stat({
  label,
  value,
  bad,
  warn,
}: {
  label: string;
  value: string;
  bad?: boolean;
  warn?: boolean;
}) {
  return (
    <div>
      <dt className="text-[10px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'font-semibold tabular-nums',
          bad && 'text-destructive',
          warn && !bad && 'text-amber-700 dark:text-amber-400',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
