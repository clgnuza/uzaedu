'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  activateProgramShare,
  copySectionShareLink,
  fetchProgramShareStatus,
  patchProgramShareSections,
  revokeProgramShare,
  shareFullUrl,
  type ProgramShareStatus,
} from '@/lib/ders-dagit-share';
import { Copy, ExternalLink, Link2, Link2Off, Users } from 'lucide-react';

export function ProgramClassSharePanel({
  token,
  studioId,
  programId,
}: {
  token: string;
  studioId: string;
  programId: string;
}) {
  const [status, setStatus] = useState<ProgramShareStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchProgramShareStatus(token, studioId, programId));
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [token, studioId, programId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function setAllEnabled(on: boolean) {
    if (!status?.sections.length) return;
    setBusy('bulk');
    try {
      const enabled_sections = on ? null : [];
      setStatus(await patchProgramShareSections(token, studioId, programId, enabled_sections));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(null);
    }
  }

  async function toggleSection(class_section: string, enabled: boolean) {
    if (!status) return;
    const next = enabled
      ? [...status.sections.filter((s) => s.enabled).map((s) => s.class_section), class_section]
      : status.sections.filter((s) => s.enabled && s.class_section !== class_section).map((s) => s.class_section);
    const allOn = next.length === status.sections.length;
    setBusy(class_section);
    try {
      setStatus(
        await patchProgramShareSections(token, studioId, programId, allOn ? null : next),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setBusy(null);
    }
  }

  async function enableShare() {
    setBusy('activate');
    try {
      await activateProgramShare(token, studioId, programId);
      await load();
      toast.success('Veli paylaşımı açıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Açılamadı');
    } finally {
      setBusy(null);
    }
  }

  async function disableShare() {
    setBusy('revoke');
    try {
      await revokeProgramShare(token, studioId, programId);
      await load();
      toast.success('Paylaşım linki kapatıldı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kapatılamadı');
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(class_section: string) {
    setBusy(`copy:${class_section}`);
    try {
      const url = await copySectionShareLink(token, studioId, programId, class_section);
      toast.success(`${class_section} linki kopyalandı`);
      return url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Link alınamadı');
    } finally {
      setBusy(null);
    }
  }

  const enabledCount = status?.sections.filter((s) => s.enabled).length ?? 0;
  const total = status?.sections.length ?? 0;

  return (
    <div className="rounded-xl border p-3">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Users className="size-3.5" />
            Sınıflara göre veli paylaşımı
          </p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Her şube için ayrı link; kapalı şubeler veli sayfasında görünmez.
          </p>
        </div>
        {status?.share_active ? (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            Link aktif
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            Kapalı
          </span>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Yükleniyor…</p>
      ) : !status?.sections.length ? (
        <p className="text-xs text-muted-foreground">Programda henüz sınıf satırı yok.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {!status.share_active ? (
              <Button type="button" size="sm" disabled={!!busy} onClick={() => void enableShare()}>
                <Link2 className="mr-1 size-3.5" />
                Paylaşımı etkinleştir
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!busy || enabledCount === total}
                  onClick={() => void setAllEnabled(true)}
                >
                  Tümünü aç
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!busy || enabledCount === 0}
                  onClick={() => void setAllEnabled(false)}
                >
                  Tümünü kapat
                </Button>
                {status.base_path && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={!!busy}
                    onClick={() => {
                      const url = shareFullUrl(status.base_path!);
                      void navigator.clipboard.writeText(url).then(() => toast.success('Genel link kopyalandı'));
                    }}
                  >
                    <Copy className="mr-1 size-3.5" />
                    Genel link
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={!!busy}
                  onClick={() => void disableShare()}
                >
                  <Link2Off className="mr-1 size-3.5" />
                  Kapat
                </Button>
              </>
            )}
          </div>

          <p className="mb-2 text-[10px] text-muted-foreground">
            {enabledCount}/{total} şube paylaşımda
          </p>

          <ul className="max-h-52 space-y-1.5 overflow-y-auto pr-0.5">
            {status.sections.map((row) => (
              <li
                key={row.class_section}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2.5 py-2',
                  row.enabled ? 'border-emerald-500/25 bg-emerald-50/40 dark:bg-emerald-950/15' : 'bg-muted/30 opacity-80',
                )}
              >
                <Switch
                  checked={row.enabled}
                  disabled={!status.share_active || busy === row.class_section || busy === 'bulk'}
                  onCheckedChange={(on) => void toggleSection(row.class_section, on)}
                  aria-label={`${row.class_section} paylaşım`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">{row.class_section}</p>
                  <p className="text-[10px] text-muted-foreground">{row.lesson_count} ders saati</p>
                </div>
                {status.share_active && row.enabled && (
                  <div className="flex shrink-0 gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      disabled={!!busy}
                      title="Linki kopyala"
                      onClick={() => void copyLink(row.class_section)}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    {row.path && (
                      <Button type="button" size="icon" variant="ghost" className="size-8" asChild title="Önizle">
                        <a href={row.path} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
