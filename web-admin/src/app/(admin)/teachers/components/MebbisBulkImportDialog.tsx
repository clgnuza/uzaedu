'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, SkipForward, AlertCircle, ArrowLeft, Shield } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ImportResult = {
  added: number;
  skipped_existing: number;
  skipped_duplicate_in_file: number;
  skipped_limit: number;
  errors: { row: number; message: string }[];
};

type Step = 'info' | 'upload' | 'result';

export function MebbisBulkImportDialog({
  open,
  onOpenChange,
  token,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  token: string | null;
  onSuccess: () => void;
}) {
  const [step, setStep] = useState<Step>('info');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = useCallback(() => {
    setStep('info');
    setResult(null);
    setUploading(false);
    setDragOver(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setStep('info');
    setResult(null);
    setUploading(false);
    setDragOver(false);
  }, [open]);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const runUpload = async (file: File) => {
    if (!token) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.xls') && !lower.endsWith('.xlsx')) {
      toast.error('Yalnızca .xls veya .xlsx seçin');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch<ImportResult>('/users/import/mebbis-personnel', {
        method: 'POST',
        token,
        body: fd,
      });
      setResult(res);
      setStep('result');
      if (res.added > 0) {
        toast.success(`${res.added} öğretmen eklendi`);
        onSuccess();
      } else {
        toast.info('Yeni kayıt eklenmedi', { description: 'Mevcut liste ile dosya aynı veya limit dolu olabilir.' });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void runUpload(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void runUpload(f);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent title="MEBBİS personel listesi" className="max-w-[min(100%,26rem)] sm:max-w-lg" descriptionId="mebbis-import-desc">
        {step === 'info' && (
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-linear-to-br from-emerald-500/12 via-background to-sky-500/8 p-4 shadow-sm ring-1 ring-emerald-500/10 dark:from-emerald-950/35 dark:to-sky-950/20 sm:p-5">
              <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-emerald-400/10 blur-2xl" aria-hidden />
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-300">
                  <Shield className="size-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">ÖZ5900 — Personel listesi</p>
                  <p id="mebbis-import-desc" className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    MEBBİS’ten listeyi Excel olarak <span className="font-medium text-foreground/90">yalnızca veri</span>{' '}
                    biçiminde indirin. Bu sihirbaz, bu çıktı yapısındaki öğretmen satırlarını okur.
                  </p>
                </div>
              </div>
            </div>

            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                <span>
                  Dosya <strong className="font-medium text-foreground">.xls veya .xlsx</strong> olmalı; yalnızca öğretmen
                  satırları (görevi öğretmenlik olanlar) alınır.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
                <span>
                  Listede e-posta bulunmadığından her kişi için sistemde benzersiz bir{' '}
                  <strong className="font-medium text-foreground">yer tutucu e-posta</strong> oluşturulur; öğretmen gerçek
                  hesabıyla kayıt olduğunda okul ayarlarındaki birleştirme kuralları geçerli olur.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-violet-500" aria-hidden />
                <span>
                  <strong className="font-medium text-foreground">Yenileme:</strong> Aynı TC ile zaten eklenmiş
                  kayıtlar atlanır; yalnızca yeni kimlikler eklenir. Öğretmen kotası doluysa fazlası eklenmez.
                </span>
              </li>
            </ul>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted/60 sm:min-h-10"
                onClick={() => handleClose(false)}
              >
                Kapat
              </button>
              <button
                type="button"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-md hover:bg-emerald-700 sm:min-h-10"
                onClick={() => setStep('upload')}
              >
                <Upload className="size-4" aria-hidden />
                Dosya seç
              </button>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setStep('info')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden />
              Bilgiye dön
            </button>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={cn(
                'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 transition-colors sm:py-12',
                dragOver ? 'border-emerald-500 bg-emerald-500/5' : 'border-border bg-muted/20 hover:border-emerald-500/40 hover:bg-muted/30',
                uploading && 'pointer-events-none opacity-60',
              )}
            >
              <input type="file" accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={onInputChange} disabled={uploading} />
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <FileSpreadsheet className="size-7" aria-hidden />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{uploading ? 'İşleniyor…' : 'Sürükleyip bırakın veya tıklayın'}</p>
                <p className="mt-1 text-xs text-muted-foreground">Personel listesi .xls / .xlsx</p>
              </div>
            </label>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-5">
            <p className="text-sm font-medium text-foreground">Yükleme özeti</p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-3 sm:p-3.5">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="size-4 shrink-0" aria-hidden />
                  <span className="text-xs font-medium uppercase tracking-wide">Eklenen</span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{result.added}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/25 p-3 sm:p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SkipForward className="size-4 shrink-0" aria-hidden />
                  <span className="text-xs font-medium uppercase tracking-wide">Zaten vardı</span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{result.skipped_existing}</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/25 p-3 sm:p-3.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <SkipForward className="size-4 shrink-0" aria-hidden />
                  <span className="text-xs font-medium uppercase tracking-wide">Dosyada mükerrer</span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{result.skipped_duplicate_in_file}</p>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3 sm:p-3.5">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
                  <AlertCircle className="size-4 shrink-0" aria-hidden />
                  <span className="text-xs font-medium uppercase tracking-wide">Limit</span>
                </div>
                <p className="mt-1.5 text-2xl font-bold tabular-nums text-foreground">{result.skipped_limit}</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm">
                <p className="mb-2 font-medium text-destructive">Hatalı satırlar</p>
                <ul className="space-y-1.5 font-mono text-xs text-foreground/90">
                  {result.errors.slice(0, 40).map((err, i) => (
                    <li key={`${err.row}-${i}`}>
                      Satır {err.row}: {err.message}
                    </li>
                  ))}
                  {result.errors.length > 40 && <li className="text-muted-foreground">… ve {result.errors.length - 40} satır</li>}
                </ul>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted/60 sm:min-h-10"
                onClick={() => handleClose(false)}
              >
                Kapat
              </button>
              <button
                type="button"
                className="min-h-11 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 sm:min-h-10"
                onClick={() => {
                  reset();
                  setStep('upload');
                }}
              >
                Başka dosya
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
