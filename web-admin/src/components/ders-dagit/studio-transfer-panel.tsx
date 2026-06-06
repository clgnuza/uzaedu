'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { resolveLongRunningApiBase } from '@/lib/resolve-api-base';
import { Button } from '@/components/ui/button';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DD_CARD_CONTENT,
  DD_CARD_HEADER,
} from '@/components/ders-dagit/dd-ui';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Download,
  Upload,
  FileJson,
  ArrowRightLeft,
  FileSpreadsheet,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

type TransferFormat = {
  id: string;
  direction: 'import' | 'export' | 'both';
  label_tr: string;
  hint_tr: string;
  extensions: string[];
  vendor?: string;
};

type AssignmentPreview = {
  kind: 'assignments';
  format: string;
  row_count?: number;
  asc_meta?: {
    buildings?: number;
    rooms?: number;
    classes?: number;
    groups?: number;
    timeoffs?: number;
  };
  rows?: Array<{
    subject_name: string;
    class_sections: string[];
    weekly_hours: number;
    teacher_name?: string | null;
    resolved_teacher_id?: string | null;
    match_warning?: string | null;
  }>;
  warnings?: Array<{ code: string; message: string }>;
  format_auto_corrected?: boolean;
  detected_format?: string | null;
};

type PackagePreview = {
  kind: 'studio_package';
  exported_at?: string;
  subjects?: number;
  assignments?: number;
  groups?: number;
  elective_pools?: number;
  counts?: { programs?: number };
  format_auto_corrected?: boolean;
  detected_format?: string | null;
};

const EOKUL_FORMAT_OPTS = [
  { value: 'auto', label: 'Otomatik (tablo → ızgara)' },
  { value: 'xlsx', label: 'Tablo XLSX' },
  { value: 'grid_xlsx', label: 'Program ızgarası (Bilsa/e-Okul)' },
  { value: 'csv', label: 'CSV' },
];

const IMPORT_FORMAT_ICONS: Record<string, typeof FileJson> = {
  ogretmenpro_json: FileJson,
  asc_xml: FileCode2,
  eokul_excel: FileSpreadsheet,
};

function detectFormatFromFile(file: File): string | null {
  const n = file.name.toLowerCase();
  if (n.endsWith('.json')) return 'ogretmenpro_json';
  if (n.endsWith('.xml')) return 'asc_xml';
  if (n.endsWith('.csv') || n.endsWith('.xlsx') || n.endsWith('.xls')) return 'eokul_excel';
  return null;
}

function acceptForFormat(format: string): string {
  if (format === 'asc_xml') return '.xml';
  if (format === 'ogretmenpro_json') return '.json';
  return '.xlsx,.xls,.csv,.xml';
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

export function StudioTransferPanel() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formats, setFormats] = useState<TransferFormat[]>([]);
  const [importFormat, setImportFormat] = useState('eokul_excel');
  const [eokulFormat, setEokulFormat] = useState('auto');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<AssignmentPreview | PackagePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoElective, setAutoElective] = useState(true);
  const [mergeSettings, setMergeSettings] = useState(true);
  const transferApiBase = resolveLongRunningApiBase();

  const effectiveImportFormat = useMemo(() => {
    if (preview?.format_auto_corrected && preview.detected_format) return preview.detected_format;
    return importFormat;
  }, [preview, importFormat]);

  useEffect(() => {
    if (!token) return;
    void apiFetch<{ formats: TransferFormat[] }>('/ders-dagit/transfer/formats', { token }).then((r) =>
      setFormats(r.formats ?? []),
    );
  }, [token]);

  const importFormats = useMemo(
    () => formats.filter((f) => f.direction === 'import' || f.direction === 'both'),
    [formats],
  );

  const selectedMeta = importFormats.find((f) => f.id === importFormat);
  const showImportPanel =
    importFormat !== 'assignment_csv' && importFormat !== 'assignment_xlsx';

  const pickFile = useCallback((f: File | null) => {
    if (!f) return;
    const detected = detectFormatFromFile(f);
    if (detected) setImportFormat(detected);
    setFile(f);
    setPreview(null);
  }, []);

  const exportJson = useCallback(async () => {
    if (!token || !studio) return;
    setBusy(true);
    try {
      const res = await fetch(`/be-api/ders-dagit/studios/${studio.id}/transfer/export.json`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ogretmenpro-studio-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Stüdyo yedeği indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dışa aktarılamadı');
    } finally {
      setBusy(false);
    }
  }, [token, studio]);

  async function runPreview() {
    if (!token || !studio || !file) return;
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const data = await apiFetch<AssignmentPreview | PackagePreview>(
        `/ders-dagit/studios/${studio.id}/transfer/import/preview`,
        {
          token,
          apiBase: transferApiBase,
          method: 'POST',
          body: {
            format: importFormat,
            file_base64: b64,
            eokul_format: importFormat === 'eokul_excel' ? eokulFormat : undefined,
          },
        },
      );
      setPreview(data);
      if (data.format_auto_corrected) {
        toast.info('Dosya türü otomatik algılandı — yanlış format seçilmişti.');
      }
      if (data.kind === 'assignments' && !data.row_count && !(data as AssignmentPreview).rows?.length) {
        toast.warning('İçe aktarılacak satır bulunamadı');
      } else {
        toast.success('Önizleme hazır');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Önizleme başarısız');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!token || !studio || !file) return;
    setBusy(true);
    try {
      const b64 = await fileToBase64(file);
      const r = await apiFetch<Record<string, unknown>>(
        `/ders-dagit/studios/${studio.id}/transfer/import`,
        {
          token,
          apiBase: transferApiBase,
          method: 'POST',
          body: {
            format: effectiveImportFormat,
            file_base64: b64,
            eokul_format: effectiveImportFormat === 'eokul_excel' ? eokulFormat : undefined,
            auto_elective_groups: autoElective,
            merge_settings: mergeSettings,
          },
        },
      );
      toast.success(
        r.kind === 'studio_package'
          ? `Paket yüklendi (${String(r.assignments_saved ?? 0)} atama)`
          : `${String(r.imported ?? 0)} atama içe aktarıldı`,
      );
      setPreview(null);
      setFile(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İçe aktarma başarısız');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <DdCard variant="sky" className="overflow-hidden">
          <CardHeader className={DD_CARD_HEADER}>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="size-4 text-sky-600" aria-hidden />
              Dışa aktar
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(DD_CARD_CONTENT, 'space-y-4')}>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Dersler, atamalar, gruplar ve seçmeli havuzlar JSON yedek olarak indirilir. Üretilmiş program
              çizelgesi dahil değildir.
            </p>
            <Button type="button" className="w-full sm:w-auto" disabled={busy || !studio} onClick={() => void exportJson()}>
              <FileJson className="mr-2 size-4" />
              JSON yedek indir
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/ders-dagit/studyo/raporlar">Program → e-Okul / Excel</Link>
            </Button>
          </CardContent>
        </DdCard>

        <DdCard variant="lavender" className="overflow-hidden lg:row-span-2">
          <CardHeader className={DD_CARD_HEADER}>
            <CardTitle className="flex items-center gap-2 text-base">
              <Upload className="size-4 text-violet-600" aria-hidden />
              İçe aktar
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(DD_CARD_CONTENT, 'space-y-4')}>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Kaynak program</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {importFormats
                  .filter((f) => f.id !== 'assignment_csv' && f.id !== 'assignment_xlsx')
                  .map((f) => {
                    const Icon = IMPORT_FORMAT_ICONS[f.id] ?? FileSpreadsheet;
                    const active = importFormat === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setImportFormat(f.id);
                          setPreview(null);
                        }}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-all',
                          active
                            ? 'border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                            : 'border-border/60 bg-background/60 hover:border-primary/30 hover:bg-muted/40',
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className={cn('mt-0.5 size-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold leading-snug">
                              {f.vendor === 'asc' ? 'aSc XML' : f.vendor === 'ogretmenpro' ? 'ÖğretmenPro' : f.label_tr}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{f.hint_tr}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {importFormat === 'eokul_excel' && (
              <DdSelectField
                label="Excel türü"
                value={eokulFormat}
                onValueChange={setEokulFormat}
                options={EOKUL_FORMAT_OPTS}
              />
            )}

            {showImportPanel && (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    pickFile(e.dataTransfer.files[0] ?? null);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors',
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : file
                        ? 'border-emerald-400/50 bg-emerald-500/5'
                        : 'border-muted-foreground/25 bg-muted/20 hover:border-primary/40 hover:bg-muted/30',
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={acceptForFormat(importFormat)}
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                  {file ? (
                    <>
                      <CheckCircle2 className="mx-auto size-8 text-emerald-600" />
                      <p className="mt-2 text-sm font-medium">{file.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Değiştirmek için tıklayın veya sürükleyin</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mx-auto size-8 text-muted-foreground/70" />
                      <p className="mt-2 text-sm font-medium">Dosyayı sürükleyin veya seçin</p>
                      <p className="mt-1 text-xs text-muted-foreground">{selectedMeta?.extensions.join(', ')}</p>
                    </>
                  )}
                </div>

                <p className="text-xs text-amber-800 dark:text-amber-200">
                  İçe aktarma mevcut stüdyo verisini (atamalar, dersler, şubeler, program, şube saatleri) siler ve
                  dosyadan yeniden oluşturur.
                </p>

                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
                  {importFormat === 'eokul_excel' && (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={autoElective}
                        onChange={(e) => setAutoElective(e.target.checked)}
                      />
                      Seçmeli havuzları otomatik oluştur
                    </label>
                  )}
                  {importFormat === 'ogretmenpro_json' && (
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={mergeSettings}
                        onChange={(e) => setMergeSettings(e.target.checked)}
                      />
                      Dönem / okul profili ayarlarını da yükle
                    </label>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={busy || !file} onClick={() => void runPreview()}>
                    <Sparkles className="mr-1.5 size-3.5" />
                    Önizle
                  </Button>
                  <Button type="button" disabled={busy || !file || !preview} onClick={() => void runImport()}>
                    İçe aktar
                  </Button>
                </div>
              </>
            )}

            {(importFormat === 'assignment_csv' || importFormat === 'assignment_xlsx') && (
              <p className="text-xs text-muted-foreground">
                Atama şablonu için{' '}
                <Link href="/ders-dagit/studyo/atamalar" className="text-primary underline">
                  Atamalar
                </Link>{' '}
                sayfasını kullanın.
              </p>
            )}

            {preview?.format_auto_corrected && (
              <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Dosya içeriği seçilen formattan farklıydı; doğru okuyucu otomatik uygulandı.</span>
              </div>
            )}

            {preview?.kind === 'assignments' && (
              <div className="overflow-hidden rounded-xl border bg-background/80">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2">
                  <p className="text-sm font-medium">
                    {preview.row_count ?? preview.rows?.length ?? 0} atama
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    {(preview as AssignmentPreview).asc_meta && (
                      <span className="text-[10px] text-muted-foreground">
                        {[
                          (preview as AssignmentPreview).asc_meta?.rooms
                            ? `${(preview as AssignmentPreview).asc_meta?.rooms} derslik`
                            : null,
                          (preview as AssignmentPreview).asc_meta?.timeoffs
                            ? `${(preview as AssignmentPreview).asc_meta?.timeoffs} kapalı slot`
                            : null,
                          (preview as AssignmentPreview).asc_meta?.groups
                            ? `${(preview as AssignmentPreview).asc_meta?.groups} grup`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    )}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      {preview.format}
                    </span>
                  </div>
                </div>
                {(preview.warnings ?? []).map((w, i) => (
                  <p key={i} className="border-b px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    {w.message}
                  </p>
                ))}
                <div className="max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Ders</th>
                        <th className="px-3 py-2 font-medium">Şube</th>
                        <th className="px-3 py-2 font-medium">Saat</th>
                        <th className="hidden px-3 py-2 font-medium sm:table-cell">Öğretmen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(preview.rows ?? []).slice(0, 20).map((r, i) => (
                        <tr key={i} className="border-t border-border/40">
                          <td className="px-3 py-1.5 font-medium">{r.subject_name}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{r.class_sections.join(', ')}</td>
                          <td className="px-3 py-1.5 tabular-nums">{r.weekly_hours}</td>
                          <td className="hidden px-3 py-1.5 text-muted-foreground sm:table-cell">
                            {r.teacher_name ?? '—'}
                            {r.match_warning ? (
                              <span className="block text-[10px] text-amber-600">{r.match_warning}</span>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview?.kind === 'studio_package' && (
              <div className="rounded-xl border bg-background/80 p-4">
                <p className="text-sm font-semibold">Stüdyo paketi</p>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: 'Ders', n: preview.subjects },
                    { label: 'Atama', n: preview.assignments },
                    { label: 'Grup', n: preview.groups },
                    { label: 'Seçmeli', n: preview.elective_pools },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg bg-muted/40 px-3 py-2 text-center">
                      <p className="text-lg font-semibold tabular-nums">{s.n ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
                {preview.exported_at ? (
                  <p className="mt-2 text-xs text-muted-foreground">Dışa aktarma: {preview.exported_at}</p>
                ) : null}
              </div>
            )}
          </CardContent>
        </DdCard>

        <DdCard className="overflow-hidden">
          <CardContent className={cn(DD_CARD_CONTENT, 'space-y-2 text-sm text-muted-foreground')}>
            <div className="flex items-center gap-2 font-medium text-foreground">
              <ArrowRightLeft className="size-4" />
              Format rehberi
            </div>
            <ul className="space-y-1.5 text-xs leading-relaxed">
              <li>
                <strong className="text-foreground">aSc:</strong> Dosya → Dışa aktar → aSc Timetables 2012 XML
              </li>
              <li>
                <strong className="text-foreground">ÖğretmenPro:</strong> JSON yedek — ders + atama + grup
              </li>
              <li>
                <strong className="text-foreground">Bilsa / e-Okul:</strong> çarşaf Excel veya program ızgarası XLS
              </li>
            </ul>
          </CardContent>
        </DdCard>
      </div>
    </div>
  );
}
