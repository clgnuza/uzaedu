'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
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
import { Download, Upload, FileJson, ArrowRightLeft } from 'lucide-react';

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
  rows?: Array<{
    subject_name: string;
    class_sections: string[];
    weekly_hours: number;
    teacher_name?: string | null;
    resolved_teacher_id?: string | null;
    match_warning?: string | null;
  }>;
  warnings?: Array<{ code: string; message: string }>;
  subjects?: number;
  assignments?: number;
};

type PackagePreview = {
  kind: 'studio_package';
  exported_at?: string;
  subjects?: number;
  assignments?: number;
  groups?: number;
  elective_pools?: number;
  counts?: { programs?: number };
};

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

const EOKUL_FORMAT_OPTS = [
  { value: 'auto', label: 'Otomatik (tablo → ızgara)' },
  { value: 'xlsx', label: 'Tablo XLSX' },
  { value: 'grid_xlsx', label: 'Program ızgarası (Bilsa/e-Okul)' },
  { value: 'csv', label: 'CSV' },
];

export function StudioTransferPanel() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [formats, setFormats] = useState<TransferFormat[]>([]);
  const [importFormat, setImportFormat] = useState('eokul_excel');
  const [eokulFormat, setEokulFormat] = useState('auto');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<AssignmentPreview | PackagePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const [autoElective, setAutoElective] = useState(true);
  const [mergeSettings, setMergeSettings] = useState(true);

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

  const selectedHint = importFormats.find((f) => f.id === importFormat)?.hint_tr;

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
          method: 'POST',
          body: {
            format: importFormat,
            file_base64: b64,
            eokul_format: importFormat === 'eokul_excel' ? eokulFormat : undefined,
          },
        },
      );
      setPreview(data);
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
          method: 'POST',
          body: {
            format: importFormat,
            file_base64: b64,
            eokul_format: importFormat === 'eokul_excel' ? eokulFormat : undefined,
            replace,
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
    <div className="space-y-4">
      <DdCard variant="sky" className="overflow-hidden">
        <CardHeader className={DD_CARD_HEADER}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="size-4" aria-hidden />
            Dışa aktar
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(DD_CARD_CONTENT, 'space-y-3 text-xs')}>
          <p className="text-muted-foreground">
            Stüdyo yedeği: dersler, atamalar, gruplar, seçmeli havuzlar, dönem ve okul profili. Üretilmiş program
            çizelgesi dahil değildir — program için{' '}
            <Link href="/ders-dagit/studyo/raporlar" className="text-primary underline">
              Raporlar
            </Link>
            .
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={busy || !studio} onClick={() => void exportJson()}>
              <FileJson className="mr-1 size-3.5" />
              JSON yedek indir
            </Button>
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href="/ders-dagit/studyo/raporlar">Program → e-Okul / Excel</Link>
            </Button>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {formats
              .filter((f) => f.direction === 'export')
              .map((f) => (
                <li key={f.id} className="rounded border bg-muted/30 px-2 py-1">
                  <span className="font-medium">{f.label_tr}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{f.hint_tr}</span>
                </li>
              ))}
          </ul>
        </CardContent>
      </DdCard>

      <DdCard variant="lavender" className="overflow-hidden">
        <CardHeader className={DD_CARD_HEADER}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4" aria-hidden />
            İçe aktar
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(DD_CARD_CONTENT, 'space-y-3')}>
          <DdSelectField
            label="Kaynak program / format"
            value={importFormat}
            onValueChange={setImportFormat}
            options={importFormats.map((f) => ({
              value: f.id,
              label:
                f.vendor === 'asc'
                  ? `aSc — ${f.label_tr}`
                  : f.vendor === 'bilsa' || f.vendor === 'eokul'
                    ? `e-Okul / Bilsa — ${f.label_tr}`
                    : f.label_tr,
            }))}
          />
          {importFormat === 'eokul_excel' && (
            <DdSelectField
              label="Excel türü"
              value={eokulFormat}
              onValueChange={setEokulFormat}
              options={EOKUL_FORMAT_OPTS}
            />
          )}
          {importFormat === 'assignment_csv' || importFormat === 'assignment_xlsx' ? (
            <p className="text-xs text-muted-foreground">
              Atama şablonu için{' '}
              <Link href="/ders-dagit/studyo/atamalar" className="text-primary underline">
                Atamalar
              </Link>{' '}
              sayfasındaki toplu içe aktarma kullanılır.
            </p>
          ) : null}
          {selectedHint && importFormat !== 'assignment_csv' && importFormat !== 'assignment_xlsx' ? (
            <p className="text-xs text-muted-foreground">{selectedHint}</p>
          ) : null}

          {importFormat !== 'assignment_csv' && importFormat !== 'assignment_xlsx' && (
            <>
              <div>
                <label className="text-xs font-medium">Dosya</label>
                <input
                  type="file"
                  accept={
                    importFormat === 'asc_xml'
                      ? '.xml'
                      : importFormat === 'ogretmenpro_json'
                        ? '.json'
                        : '.xlsx,.xls,.csv,.xml'
                  }
                  className="mt-1 block w-full text-xs"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setPreview(null);
                  }}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                  Mevcut veriyi sil (değiştir)
                </label>
                {importFormat === 'eokul_excel' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoElective}
                      onChange={(e) => setAutoElective(e.target.checked)}
                    />
                    Seçmeli havuzları otomatik oluştur
                  </label>
                )}
                {importFormat === 'ogretmenpro_json' && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={mergeSettings}
                      onChange={(e) => setMergeSettings(e.target.checked)}
                    />
                    Dönem / okul profili ayarlarını da yükle
                  </label>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busy || !file} onClick={() => void runPreview()}>
                  Önizle
                </Button>
                <Button type="button" size="sm" disabled={busy || !file || !preview} onClick={() => void runImport()}>
                  İçe aktar
                </Button>
              </div>
            </>
          )}

          {preview?.kind === 'assignments' && (
            <div className="rounded-lg border bg-muted/30 p-2 text-xs">
              <p>
                <strong>{preview.row_count ?? preview.rows?.length ?? 0}</strong> atama · format: {preview.format}
              </p>
              {(preview.warnings ?? []).map((w, i) => (
                <p key={i} className="text-amber-700 dark:text-amber-300">
                  {w.message}
                </p>
              ))}
              <ul className="mt-2 max-h-32 overflow-y-auto">
                {(preview.rows ?? []).slice(0, 12).map((r, i) => (
                  <li key={i}>
                    {r.subject_name} — {r.class_sections.join(', ')} ({r.weekly_hours} saat)
                    {r.match_warning ? ` · ${r.match_warning}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview?.kind === 'studio_package' && (
            <div className="rounded-lg border bg-muted/30 p-2 text-xs">
              <p className="font-medium">Stüdyo paketi önizleme</p>
              <p>
                {preview.subjects} ders · {preview.assignments} atama · {preview.groups} grup ·{' '}
                {preview.elective_pools} seçmeli havuz
              </p>
              {preview.exported_at ? (
                <p className="text-muted-foreground">Dışa aktarma: {preview.exported_at}</p>
              ) : null}
            </div>
          )}
        </CardContent>
      </DdCard>

      <DdCard className="overflow-hidden">
        <CardContent className={cn(DD_CARD_CONTENT, 'flex gap-2 text-xs text-muted-foreground')}>
          <ArrowRightLeft className="size-4 shrink-0" />
          <div>
            <p className="font-medium text-foreground">Program karşılaştırması</p>
            <p className="mt-1">
              <strong>aSc:</strong> Dosya → Dışa aktar → aSc Timetables 2012 XML.{' '}
              <strong>Bilsa:</strong> Haftalık ders dağıtım veya Okulsis’ten Excel çarşaf / merkezi aktarım; burada
              «e-Okul / çarşaf Excel» ve «Program ızgarası» ile deneyin.{' '}
              <strong>e-Okul:</strong> Resmî tablo veya ızgara XLS.
            </p>
          </div>
        </CardContent>
      </DdCard>
    </div>
  );
}
