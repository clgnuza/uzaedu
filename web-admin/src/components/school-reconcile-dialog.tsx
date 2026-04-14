'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Download, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import {
  SCHOOL_TYPE_ORDER,
  SCHOOL_STATUS_LABELS,
  SCHOOL_SEGMENT_LABELS,
  formatSchoolTypeLabel,
} from '@/lib/school-labels';
import {
  downloadSchoolExcelTemplate,
  parseExcelToSchoolRows,
  mapRowsToReconcileSchools,
  type ParsedSchoolRow,
} from '@/lib/school-excel-import';

const FIELD_LABELS: Record<string, string> = {
  name: 'Okul adı',
  type: 'Tür',
  segment: 'Segment',
  city: 'İl',
  district: 'İlçe',
  address: 'Adres',
  website_url: 'Web',
  phone: 'Telefon',
  fax: 'Faks',
  institutional_email: 'Kurumsal e-posta',
  principal_name: 'Müdür',
};

type PreviewRes = {
  summary: {
    source_rows: number;
    source_rows_with_code: number;
    skipped_no_code: number;
    duplicate_source_codes: string[];
    db_duplicate_codes: { code: string; school_ids: string[] }[];
    to_create: number;
    to_update: number;
    unchanged: number;
    only_in_db: number;
  };
  to_create: { row_index: number; institution_code: string }[];
  to_update: {
    row_index: number;
    school_id: string;
    institution_code: string;
    changes: { field: string; from: string | null; to: string | null }[];
  }[];
  only_in_db: { school_id: string; institution_code: string; name: string; status: string }[];
  skipped_no_code: { row_index: number; name: string }[];
};

export function SchoolReconcilePanel({
  token,
  onDone,
  onCancel,
}: {
  token: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<ParsedSchoolRow[]>([]);
  const [payload, setPayload] = useState<Record<string, unknown>[]>([]);
  const [preview, setPreview] = useState<PreviewRes | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'ozet' | 'yeni' | 'degisen' | 'kaynaksiz' | 'kodsuz'>('ozet');
  const [sourceMode, setSourceMode] = useState<'excel' | 'mebbis'>('excel');
  const [mebbisOwner, setMebbisOwner] = useState<'1' | '2' | '3'>('1');
  const [mebbisIlKodu, setMebbisIlKodu] = useState('');
  const [mebbisIlce, setMebbisIlce] = useState('');
  const [mebbisTurFilter, setMebbisTurFilter] = useState('');
  const [ilOptions, setIlOptions] = useState<{ value: string; label: string }[]>([]);
  const [ilceOptions, setIlceOptions] = useState<{ label: string }[]>([]);
  const [mebbisLoadingIlce, setMebbisLoadingIlce] = useState(false);
  const [mebbisFetching, setMebbisFetching] = useState(false);
  const [optCreate, setOptCreate] = useState(true);
  const [optUpdate, setOptUpdate] = useState(true);
  const [optAskida, setOptAskida] = useState(false);

  const rowName = useCallback(
    (i: number) => String(rows[i]?.name ?? (payload[i]?.name as string | undefined) ?? '—'),
    [rows, payload],
  );

  useEffect(() => {
    if (!token || sourceMode !== 'mebbis') return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ items: { value: string; label: string }[] }>('/schools/mebbis/il-options', {
          token,
        });
        if (!cancelled) setIlOptions(res.items ?? []);
      } catch {
        if (!cancelled) setIlOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sourceMode]);

  useEffect(() => {
    if (!token || sourceMode !== 'mebbis' || !mebbisIlKodu) {
      setIlceOptions([]);
      setMebbisIlce('');
      return;
    }
    let cancelled = false;
    setMebbisLoadingIlce(true);
    void (async () => {
      try {
        const res = await apiFetch<{ items: { label: string }[] }>('/schools/mebbis/ilce-options', {
          method: 'POST',
          token,
          body: JSON.stringify({ il_kodu: mebbisIlKodu }),
        });
        if (!cancelled) {
          setIlceOptions(res.items ?? []);
          setMebbisIlce('');
        }
      } catch {
        if (!cancelled) {
          setIlceOptions([]);
          toast.error('İlçe listesi alınamadı');
        }
      } finally {
        if (!cancelled) setMebbisLoadingIlce(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sourceMode, mebbisIlKodu]);

  const runPreview = useCallback(
    async (body: Record<string, unknown>[]) => {
      if (!token || body.length === 0) return;
      setLoadingPreview(true);
      setError(null);
      try {
        const res = await apiFetch<PreviewRes>('/schools/reconcile/preview', {
          method: 'POST',
          token,
          body: JSON.stringify({ schools: body }),
        });
        setPreview(res);
        setTab('ozet');
        toast.success('Önizleme hazır');
      } catch (e) {
        setPreview(null);
        setError(e instanceof Error ? e.message : 'Önizleme alınamadı');
        toast.error('Önizleme alınamadı');
      } finally {
        setLoadingPreview(false);
      }
    },
    [token],
  );

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setError(null);
      setUploading(true);
      setPreview(null);
      try {
        const parsed = await parseExcelToSchoolRows(file);
        setRows(parsed);
        const p = mapRowsToReconcileSchools(parsed);
        setPayload(p);
        if (parsed.length === 0) {
          toast.warning('Dosyada satır yok');
        } else {
          toast.success(`${parsed.length} satır okundu`);
          await runPreview(p);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Excel okunamadı');
        toast.error('Dosya okunamadı');
      } finally {
        setUploading(false);
      }
    },
    [runPreview],
  );

  const handleMebbisFetch = async () => {
    if (!token || !mebbisIlKodu || !mebbisIlce.trim()) {
      toast.warning('İl ve ilçe seçin');
      return;
    }
    setMebbisFetching(true);
    setError(null);
    setPreview(null);
    try {
      const res = await apiFetch<{ schools: Record<string, unknown>[]; meta: { row_count: number } }>(
        '/schools/mebbis/fetch-rows',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            owner: mebbisOwner,
            il_kodu: mebbisIlKodu,
            ilce_label: mebbisIlce.trim(),
            kurum_turu_contains: mebbisTurFilter.trim() || undefined,
          }),
        },
      );
      const p = res.schools ?? [];
      setRows([]);
      setPayload(p);
      if (p.length === 0) {
        toast.warning('MEBBİS listesi boş');
      } else {
        toast.success(`MEBBİS: ${p.length} kurum`);
        await runPreview(p);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MEBBİS indirilemedi');
      toast.error('MEBBİS indirilemedi');
    } finally {
      setMebbisFetching(false);
    }
  };

  const handleApply = async () => {
    if (!token || payload.length === 0 || !preview) return;
    if (!optCreate && !optUpdate && !optAskida) {
      toast.warning('En az bir işlem seçin');
      return;
    }
    setApplying(true);
    setError(null);
    try {
      const res = await apiFetch<{ created: number; updated: number; marked_askida: number; errors?: string[] }>(
        '/schools/reconcile/apply',
        {
          method: 'POST',
          token,
          body: JSON.stringify({
            schools: payload,
            options: {
              create_new: optCreate,
              apply_updates: optUpdate,
              mark_missing_in_source_askida: optAskida,
            },
          }),
        },
      );
      if (res.errors?.length) {
        toast.warning(`Kısmen tamamlandı: ${res.errors.length} hata`);
        setError(res.errors.join('\n'));
      } else {
        toast.success(
          `Tamam: +${res.created} yeni, ${res.updated} güncellendi, ${res.marked_askida} askıya alındı`,
        );
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uygulanamadı');
      toast.error('Uygulanamadı');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <Alert message={error} />}
      <p className="text-sm text-muted-foreground">
        <strong>Kurum kodu (MEB)</strong> eşleştirme anahtarıdır. Kaynak dosyada kodu olmayan satırlar yok sayılır.
        Aynı kod kaynakta tekrarlanırsa yalnızca ilk satır kullanılır. Sistemde olup kaynakta olmayan kurumlar için isteğe
        bağlı <strong>askıda</strong> işareti kullanılabilir.
      </p>
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {(
          [
            ['excel', 'Excel'],
            ['mebbis', 'MEBBİS (mebbis.meb.gov.tr)'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSourceMode(id);
              setPreview(null);
              setPayload([]);
              setRows([]);
              setError(null);
            }}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              sourceMode === id ? 'bg-primary text-primary-foreground' : 'bg-muted/60 hover:bg-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {sourceMode === 'excel' && (
        <>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={downloadSchoolExcelTemplate}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm font-medium hover:bg-muted"
            >
              <Download className="size-4" />
              Şablon
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20">
              <Upload className="size-4" />
              {uploading || loadingPreview ? 'İşleniyor…' : 'Kaynak Excel'}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="sr-only"
                disabled={uploading || loadingPreview}
                onChange={handleFile}
              />
            </label>
            {payload.length > 0 && (
              <button
                type="button"
                disabled={loadingPreview}
                onClick={() => void runPreview(payload)}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Önizlemeyi yenile
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sütunlar: name, institution_code (kurum_kodu / meb_kodu), type ({SCHOOL_TYPE_ORDER.slice(0, 4).join(', ')}…),
            segment, city, district, …
          </p>
        </>
      )}

      {sourceMode === 'mebbis' && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Sunucu MEBBİS sayfasını otomatik doldurur ve Excel indirir. İlk kurulum: backend’de{' '}
            <code className="rounded bg-muted px-1">npx playwright install chromium</code>
          </p>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-0.5 text-xs">
              <span>Kurum sahibi</span>
              <select
                value={mebbisOwner}
                onChange={(e) => setMebbisOwner(e.target.value as '1' | '2' | '3')}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="1">Resmi</option>
                <option value="2">Özel</option>
                <option value="3">MEB dışı</option>
              </select>
            </label>
            <label className="flex min-w-[10rem] flex-col gap-0.5 text-xs">
              <span>İl</span>
              <select
                value={mebbisIlKodu}
                onChange={(e) => setMebbisIlKodu(e.target.value)}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                <option value="">Seçiniz</option>
                {ilOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[10rem] flex-col gap-0.5 text-xs">
              <span>İlçe</span>
              <select
                value={mebbisIlce}
                onChange={(e) => setMebbisIlce(e.target.value)}
                disabled={!mebbisIlKodu || mebbisLoadingIlce}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
              >
                <option value="">{mebbisLoadingIlce ? 'Yükleniyor…' : 'Seçiniz'}</option>
                {ilceOptions.map((o) => (
                  <option key={o.label} value={o.label}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[12rem] flex-col gap-0.5 text-xs">
              <span>Kurum türü (opsiyonel, içerir)</span>
              <input
                value={mebbisTurFilter}
                onChange={(e) => setMebbisTurFilter(e.target.value)}
                placeholder="örn. İlkokul"
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <button
            type="button"
            disabled={mebbisFetching || loadingPreview || !mebbisIlKodu || !mebbisIlce}
            onClick={() => void handleMebbisFetch()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {mebbisFetching || loadingPreview ? <Loader2 className="size-4 animate-spin" /> : null}
            Listeyi çek ve önizle
          </button>
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
        <p className="text-xs font-semibold text-foreground">Uygulama seçenekleri</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={optCreate} onChange={(e) => setOptCreate(e.target.checked)} />
          Yeni kurumları oluştur (kod sistemde yoksa)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={optUpdate} onChange={(e) => setOptUpdate(e.target.checked)} />
          İsim / tür / il / iletişim vb. farkları kaynağa göre güncelle
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={optAskida} onChange={(e) => setOptAskida(e.target.checked)} />
          Kaynak dosyada kurum kodu bulunmayan mevcut okulları <strong>askıda</strong> yap
        </label>
      </div>

      {loadingPreview && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Önizleme hesaplanıyor…
        </div>
      )}

      {preview && (
        <>
          <div className="flex flex-wrap gap-1 border-b border-border pb-2">
            {(
              [
                ['ozet', `Özet (${preview.summary.source_rows})`],
                ['yeni', `Yeni (${preview.summary.to_create})`],
                ['degisen', `Değişen (${preview.summary.to_update})`],
                ['kaynaksiz', `Kaynakta yok (${preview.summary.only_in_db})`],
                ['kodsuz', `Kodsuz satır (${preview.summary.skipped_no_code})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  tab === id ? 'bg-primary text-primary-foreground' : 'bg-muted/60 hover:bg-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'ozet' && (
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li>Kaynak satır: {preview.summary.source_rows}</li>
              <li>Kurum kodlu satır (benzersiz kod): {preview.summary.source_rows_with_code}</li>
              <li>Yeni oluşturulacak: {preview.summary.to_create}</li>
              <li>Güncellenecek: {preview.summary.to_update}</li>
              <li>Değişmeyen: {preview.summary.unchanged}</li>
              <li>Kaynakta olmayan (sistemde kod var): {preview.summary.only_in_db}</li>
              <li>Kodsuz atlanan satır: {preview.summary.skipped_no_code}</li>
              {preview.summary.duplicate_source_codes.length > 0 && (
                <li className="text-amber-700 dark:text-amber-400">
                  Kaynakta tekrarlanan kodlar: {preview.summary.duplicate_source_codes.join(', ')}
                </li>
              )}
              {preview.summary.db_duplicate_codes.length > 0 && (
                <li className="text-amber-700 dark:text-amber-400">
                  Sistemde aynı koda sahip birden fazla kayıt var (ilk kayıt eşleştirilir).
                </li>
              )}
            </ul>
          )}

          {tab === 'yeni' && (
            <div className="max-h-56 overflow-auto rounded border border-border text-sm">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs">Satır</th>
                    <th className="px-2 py-1.5 text-left text-xs">Kod</th>
                    <th className="px-2 py-1.5 text-left text-xs">Ad (kaynak)</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.to_create.map((x) => (
                    <tr key={`${x.row_index}-${x.institution_code}`} className="border-t border-border">
                      <td className="px-2 py-1">{x.row_index + 1}</td>
                      <td className="px-2 py-1 font-mono text-xs">{x.institution_code}</td>
                      <td className="px-2 py-1">{rowName(x.row_index)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'degisen' && (
            <div className="max-h-64 space-y-3 overflow-y-auto text-sm">
              {preview.to_update.map((u) => (
                <div key={u.school_id} className="rounded border border-border p-2">
                  <p className="font-medium">
                    {rowName(u.row_index)}{' '}
                    <span className="font-mono text-xs text-muted-foreground">({u.institution_code})</span>
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {u.changes.map((c) => (
                      <li key={c.field}>
                        <span className="text-foreground">{FIELD_LABELS[c.field] ?? c.field}:</span>{' '}
                        <span className="line-through">
                          {c.field === 'type'
                            ? formatSchoolTypeLabel(c.from ?? '')
                            : c.field === 'segment'
                              ? SCHOOL_SEGMENT_LABELS[c.from ?? ''] ?? c.from ?? '—'
                              : (c.from ?? '—')}
                        </span>
                        {' → '}
                        <span className="text-foreground">
                          {c.field === 'type'
                            ? formatSchoolTypeLabel(c.to ?? '')
                            : c.field === 'segment'
                              ? SCHOOL_SEGMENT_LABELS[c.to ?? ''] ?? c.to ?? '—'
                              : (c.to ?? '—')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {preview.to_update.length === 0 && <p className="text-muted-foreground">Değişiklik yok.</p>}
            </div>
          )}

          {tab === 'kaynaksiz' && (
            <div className="max-h-56 overflow-auto rounded border border-border text-sm">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/80">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs">Kod</th>
                    <th className="px-2 py-1.5 text-left text-xs">Sistem adı</th>
                    <th className="px-2 py-1.5 text-left text-xs">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.only_in_db.map((o) => (
                    <tr key={o.school_id} className="border-t border-border">
                      <td className="px-2 py-1 font-mono text-xs">{o.institution_code}</td>
                      <td className="px-2 py-1">{o.name}</td>
                      <td className="px-2 py-1">{SCHOOL_STATUS_LABELS[o.status] ?? o.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'kodsuz' && (
            <div className="max-h-48 overflow-auto text-sm text-muted-foreground">
              {preview.skipped_no_code.map((s) => (
                <div key={s.row_index}>
                  Satır {s.row_index + 1}: {s.name || '(adsız)'}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
          Kapat
        </button>
        <button
          type="button"
          disabled={applying || !preview || payload.length === 0}
          onClick={() => void handleApply()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {applying ? 'Uygulanıyor…' : 'Seçeneklere göre uygula'}
        </button>
      </div>
    </div>
  );
}
