'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Download, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { SCHOOL_TYPE_ORDER, SCHOOL_STATUS_LABELS, SCHOOL_SEGMENT_LABELS, formatSchoolTypeLabel } from '@/lib/school-labels';
import {
  downloadSchoolExcelTemplate,
  parseExcelToSchoolRows,
  mapRowsToReconcileSchools,
  type ParsedSchoolRow,
} from '@/lib/school-excel-import';
import { getDistrictsForCity } from '@/lib/turkey-addresses';

const FIELD_LABELS: Record<string, string> = {
  name: 'Okul adı',
  type: 'Tür',
  segment: 'Segment',
  city: 'İl',
  district: 'İlçe',
  address: 'Adres',
  map_url: 'Harita',
  school_image_url: 'Okul görseli',
  website_url: 'Web',
  phone: 'Telefon',
  fax: 'Faks',
  institutional_email: 'Kurumsal e-posta',
  principal_name: 'Müdür',
  about_description: 'Okulumuz hakkında',
  teacher_limit: 'Öğretmen limiti',
  status: 'Durum',
};

const LAST_RUN_STORAGE_KEY = 'ogp:school-reconcile-last-run';

type ReconcileLastRun = {
  at: string;
  created: number;
  updated: number;
  marked_askida: number;
  errorCount: number;
};

type MebbisOwner = '' | '1' | '2' | '3';

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
  const [mebbisOwner, setMebbisOwner] = useState<MebbisOwner>('');
  const [mebbisIlKodu, setMebbisIlKodu] = useState('');
  const [mebbisIlce, setMebbisIlce] = useState('');
  const [mebbisTurFilter, setMebbisTurFilter] = useState('');
  const [ilOptions, setIlOptions] = useState<{ value: string; label: string }[]>([]);
  const [ilceOptions, setIlceOptions] = useState<{ label: string }[]>([]);
  const [turOptions, setTurOptions] = useState<{ value: string; label: string }[]>([]);
  const [mebbisLoadingIlce, setMebbisLoadingIlce] = useState(false);
  const [mebbisLoadingTur, setMebbisLoadingTur] = useState(false);
  const [mebbisFetching, setMebbisFetching] = useState(false);
  const [optCreate, setOptCreate] = useState(true);
  const [optUpdate, setOptUpdate] = useState(true);
  const [optAskida, setOptAskida] = useState(false);
  const [phase, setPhase] = useState<'source' | 'result'>('source');
  const [applyResult, setApplyResult] = useState<{
    created: number;
    updated: number;
    marked_askida: number;
    errors?: string[];
  } | null>(null);
  const [lastRun, setLastRun] = useState<ReconcileLastRun | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_RUN_STORAGE_KEY);
      if (raw) setLastRun(JSON.parse(raw) as ReconcileLastRun);
    } catch {
      setLastRun(null);
    }
  }, []);

  const rowName = useCallback(
    (i: number) => String(rows[i]?.name ?? (payload[i]?.name as string | undefined) ?? '—'),
    [rows, payload],
  );
  const selectedIlLabel = ilOptions.find((x) => x.value === mebbisIlKodu)?.label ?? '';
  const districtSuggestions = getDistrictsForCity(selectedIlLabel, ilceOptions.map((x) => x.label));

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
    if (!token || sourceMode !== 'mebbis' || !mebbisOwner || !mebbisIlKodu) {
      setMebbisLoadingIlce(false);
      setIlceOptions([]);
      setTurOptions([]);
      setMebbisLoadingTur(false);
      setMebbisTurFilter('');
      if (!mebbisIlKodu || !mebbisOwner) setMebbisIlce('');
      return;
    }
    let cancelled = false;
    setMebbisLoadingIlce(true);
    void (async () => {
      try {
        const res = await apiFetch<{ items: { label: string }[] }>('/schools/mebbis/ilce-options', {
          method: 'POST',
          token,
          body: JSON.stringify({ owner: mebbisOwner, il_kodu: mebbisIlKodu }),
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
  }, [token, sourceMode, mebbisIlKodu, mebbisOwner]);

  useEffect(() => {
    if (!token || sourceMode !== 'mebbis' || !mebbisOwner || !mebbisIlKodu || !mebbisIlce) {
      setMebbisLoadingTur(false);
      setTurOptions([]);
      setMebbisTurFilter('');
      return;
    }
    let cancelled = false;
    setMebbisLoadingTur(true);
    setMebbisTurFilter('');
    void (async () => {
      try {
        const res = await apiFetch<{ items: { label: string; value: string }[] }>('/schools/mebbis/type-options', {
          method: 'POST',
          token,
          body: JSON.stringify({ owner: mebbisOwner, il_kodu: mebbisIlKodu, ilce_label: mebbisIlce }),
        });
        if (!cancelled) setTurOptions(res.items ?? []);
      } catch {
        if (!cancelled) {
          setTurOptions([]);
          toast.error('Kurum türleri alınamadı');
        }
      } finally {
        if (!cancelled) setMebbisLoadingTur(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, sourceMode, mebbisOwner, mebbisIlKodu, mebbisIlce]);

  const runPreview = useCallback(
    async (body: Record<string, unknown>[]): Promise<PreviewRes | null> => {
      if (!token || body.length === 0) return null;
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
        return res;
      } catch (e) {
        setPreview(null);
        setError(e instanceof Error ? e.message : 'Önizleme alınamadı');
        toast.error('Önizleme alınamadı');
        return null;
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
          const pv = await runPreview(p);
          if (pv) toast.success(`${parsed.length} satır okundu; önizleme hazır`);
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
    if (!token || !mebbisOwner || !mebbisIlKodu || !mebbisIlce.trim()) {
      toast.warning('Kurum sahibi, il ve ilçe seçin');
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
            owner: mebbisOwner as '1' | '2' | '3',
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
        toast.warning('MEB okul dizini listesi boş');
      } else {
        const pv = await runPreview(p);
        if (pv) {
          if (pv.summary.to_create > 0) {
            setTab('yeni');
            toast.success(
              `MEB: ${p.length} kurum; sistemde kaydı olmayan ${pv.summary.to_create} kurum`,
            );
          } else if (pv.summary.skipped_no_code > 0) {
            setTab('kodsuz');
            toast.warning(
              `MEB: ${p.length} satır; kod okunamayan ${pv.summary.skipped_no_code} satır — «Kodsuz satır» sekmesine bakın`,
            );
          } else {
            setTab('ozet');
            toast.success(`MEB: ${p.length} kurum; yeni eklenecek kayıt yok (hepsi sistemde veya kod eşleşti)`);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MEB okul dizini okunamadı');
      toast.error('MEB okul dizini okunamadı');
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
      const errCount = res.errors?.length ?? 0;
      const snapshot: ReconcileLastRun = {
        at: new Date().toISOString(),
        created: res.created,
        updated: res.updated,
        marked_askida: res.marked_askida,
        errorCount: errCount,
      };
      try {
        localStorage.setItem(LAST_RUN_STORAGE_KEY, JSON.stringify(snapshot));
      } catch {
        /* ignore */
      }
      setLastRun(snapshot);
      setApplyResult({
        created: res.created,
        updated: res.updated,
        marked_askida: res.marked_askida,
        errors: res.errors,
      });
      setPhase('result');
      if (res.errors?.length) {
        toast.warning(`Kısmen tamamlandı: ${res.errors.length} hata`);
      } else {
        toast.success(
          `Tamam: +${res.created} yeni, ${res.updated} güncellendi, ${res.marked_askida} askıya alındı`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uygulanamadı');
      toast.error('Uygulanamadı');
    } finally {
      setApplying(false);
    }
  };

  const finishAndClose = () => {
    onDone();
  };

  const resetToNewReconcile = () => {
    setPhase('source');
    setApplyResult(null);
    setPreview(null);
    setPayload([]);
    setRows([]);
    setError(null);
    setTab('ozet');
  };

  if (phase === 'result' && applyResult) {
    const hasErr = (applyResult.errors?.length ?? 0) > 0;
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm font-semibold text-foreground">Eşitleme sonucu</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Kaynakla karşılaştırılan okul kayıtları (profil, iletişim, tanıtım metni, limit ve kaynakta belirtilen durum)
            güncellendi.
          </p>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <li className="rounded-lg border border-border bg-background px-3 py-2">
              <span className="text-xs text-muted-foreground">Yeni kurum</span>
              <span className="block text-lg font-semibold tabular-nums text-foreground">+{applyResult.created}</span>
            </li>
            <li className="rounded-lg border border-border bg-background px-3 py-2">
              <span className="text-xs text-muted-foreground">Güncellenen</span>
              <span className="block text-lg font-semibold tabular-nums text-foreground">{applyResult.updated}</span>
            </li>
            <li className="rounded-lg border border-border bg-background px-3 py-2">
              <span className="text-xs text-muted-foreground">Askıya alınan</span>
              <span className="block text-lg font-semibold tabular-nums text-foreground">{applyResult.marked_askida}</span>
            </li>
          </ul>
          {hasErr && (
            <div className="mt-3">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Kısmi hatalar</p>
              <pre className="mt-1 max-h-40 overflow-auto rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs whitespace-pre-wrap">
                {applyResult.errors!.join('\n')}
              </pre>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={resetToNewReconcile}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Yeni eşitleme
          </button>
          <button
            type="button"
            onClick={finishAndClose}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Kapat ve listeyi yenile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lastRun && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Son işlem: </span>
          {new Date(lastRun.at).toLocaleString('tr-TR')} — +{lastRun.created} yeni, {lastRun.updated} güncelleme,{' '}
          {lastRun.marked_askida} askı
          {lastRun.errorCount > 0 ? `, ${lastRun.errorCount} hata satırı` : ''}
        </div>
      )}
      {error && <Alert message={error} />}
      <p className="text-sm leading-6 text-muted-foreground">
        <strong>MEB kurum kodu</strong> (4–16 rakam) eşleştirme anahtarıdır. Public MEB okul dizininde bu kod çoğunlukla
        kurumun `okulumuz_hakkinda` / alan adı bilgisinden çıkarılır. Kaynakta kodu okunamayan satırlar yok sayılır.
        Aynı kod kaynakta birden fazla kez geçerse yalnızca ilk satır kullanılır. Sistemde olup kaynakta bulunmayan
        kurumlar için isteğe bağlı olarak <strong>askıya alma</strong> işlemi uygulanabilir.
      </p>
      <div className="flex flex-wrap gap-1 border-b border-border pb-2">
        {(
          [
            ['excel', 'Excel'],
            ['mebbis', 'MEB okul dizini (meb.gov.tr)'],
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
              if (id === 'mebbis') {
                setMebbisOwner('');
                setMebbisIlKodu('');
                setMebbisIlce('');
                setMebbisTurFilter('');
                setIlceOptions([]);
              }
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
                onClick={() => {
                  void (async () => {
                    const pv = await runPreview(payload);
                    if (pv) toast.success('Önizleme yenilendi');
                  })();
                }}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                Önizlemeyi yenile
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sütunlar: name, institution_code (kurum_kodu / meb_kodu), type ({SCHOOL_TYPE_ORDER.slice(0, 4).join(', ')}…),
            segment, city, district, about_description, status (aktif / deneme / askıda), teacher_limit (opsiyonel), …
          </p>
        </>
      )}

      {sourceMode === 'mebbis' && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3 text-sm">
          <p className="text-xs leading-5 text-muted-foreground">
            Sunucu public <strong>MEB okul dizini</strong> sayfasını tarar; kurum listesi ve kurum sayfasından adres /
            telefon / web verilerini toplar. <strong>Yeni okul</strong> yalnızca satırda okunan <strong>kurum kodu</strong>
            ile oluşur (Özet → Yeni). İlk kurulum: backend’de{' '}
            <code className="rounded bg-muted px-1">npx playwright install chromium</code>. Liste boş veya hep kodsuzsa
            public sayfa taraması veya kurum kodu çıkarımı başarısız demektir.
          </p>
          <div className="flex max-w-md flex-col gap-3">
            <label className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium text-foreground">1 · Kurum sahibi</span>
              <select
                value={mebbisOwner}
                onChange={(e) => {
                  const v = e.target.value as MebbisOwner;
                  setMebbisOwner(v);
                  setMebbisIlKodu('');
                  setMebbisIlce('');
                  setIlceOptions([]);
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="">Seçiniz</option>
                <option value="1">Resmi Kurumlar</option>
                <option value="2">Özel Kurumlar</option>
                <option value="3">MEB dışı kurumlar</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium text-foreground">2 · İl</span>
              <select
                value={mebbisIlKodu}
                onChange={(e) => {
                  setMebbisIlKodu(e.target.value);
                  setMebbisIlce('');
                }}
                disabled={!mebbisOwner}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">{mebbisOwner ? 'Seçiniz' : 'Önce kurum sahibi seçin'}</option>
                {ilOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium text-foreground">3 · İlçe</span>
              <select
                value={mebbisIlce}
                onChange={(e) => setMebbisIlce(e.target.value)}
                disabled={!mebbisOwner || !mebbisIlKodu || mebbisLoadingIlce}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">
                  {!mebbisOwner
                    ? 'Önce kurum sahibi seçin'
                    : !mebbisIlKodu
                      ? 'Önce il seçin'
                      : mebbisLoadingIlce
                        ? 'Yükleniyor…'
                        : 'Seçiniz'}
                </option>
                {districtSuggestions.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">
                {mebbisLoadingIlce ? 'İlçeler public MEB okul dizininden yükleniyor.' : 'İl seçimine göre ilçe listesinden seçim yapılır.'}
              </span>
            </label>
            <label className="flex flex-col gap-0.5 text-xs">
              <span className="font-medium text-foreground">4 · Kurum türü (opsiyonel, içerir)</span>
              <select
                value={mebbisTurFilter}
                onChange={(e) => setMebbisTurFilter(e.target.value)}
                disabled={!mebbisOwner || !mebbisIlKodu || !mebbisIlce || mebbisLoadingTur}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
              >
                <option value="">Tümü</option>
                {turOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">
                {!mebbisIlce
                  ? 'İlçe seçilince kurum türleri public MEB okul dizininden yüklenir.'
                  : mebbisLoadingTur
                    ? 'Kurum türleri public MEB okul dizininden yükleniyor.'
                    : 'İsterseniz kurum türünü de listeden seçip sonucu daraltabilirsiniz.'}
              </span>
            </label>
          </div>
          <button
            type="button"
            disabled={mebbisFetching || loadingPreview || !mebbisOwner || !mebbisIlKodu || !mebbisIlce}
            onClick={() => void handleMebbisFetch()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {mebbisFetching || loadingPreview ? <Loader2 className="size-4 animate-spin" /> : null}
            Listeyi çek ve önizle
          </button>
        </div>
      )}

      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-xs font-semibold text-foreground">Uygulama ayarları</p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Güncelleme sırasında kaynakta yer alan okul alanları veritabanına işlenir: ad, tür, segment, il, ilçe, adres,
          web sitesi, telefon, faks, kurumsal e-posta, müdür, &quot;okulumuz hakkında&quot; metni, varsa öğretmen limiti ve durum.
        </p>
        <label className="flex items-start gap-2 text-sm leading-5">
          <input className="mt-1" type="checkbox" checked={optCreate} onChange={(e) => setOptCreate(e.target.checked)} />
          <span>Yeni kurumları oluştur (kurum kodu sistemde yoksa)</span>
        </label>
        <label className="flex items-start gap-2 text-sm leading-5">
          <input className="mt-1" type="checkbox" checked={optUpdate} onChange={(e) => setOptUpdate(e.target.checked)} />
          <span>Ad, tür, il, ilçe ve iletişim gibi alan farklarını kaynağa göre güncelle</span>
        </label>
        <label className="flex items-start gap-2 text-sm leading-5">
          <input className="mt-1" type="checkbox" checked={optAskida} onChange={(e) => setOptAskida(e.target.checked)} />
          <span>Kaynak listede bulunmayan mevcut okulları <strong>askıya al</strong></span>
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
          {preview.summary.source_rows > 0 && preview.summary.source_rows_with_code === 0 && (
            <Alert
              variant="warning"
              message={
                'Hiçbir satırda geçerli MEB kurum kodu (4–16 hane) okunamadı; bu yüzden yeni okul oluşturulamaz. ' +
                '«Kodsuz satır» sekmesinde hangi kurumların kod çıkmadığını görün. Public MEB okul dizininden kurum kodu çıkarılamadıysa yeni okul oluşturulamaz. ' +
                'Sunucuda public MEB taraması için `npx playwright install chromium` gerekir.'
              }
            />
          )}
          <div className="flex flex-wrap gap-1 border-b border-border pb-2">
            {(
              [
                ['ozet', `Özet (${preview.summary.source_rows})`],
                ['yeni', `Sistemde yok (${preview.summary.to_create})`],
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
              <li>Sistemde olmayan (yeni oluşturulacak): {preview.summary.to_create}</li>
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
                              : c.field === 'status'
                                ? SCHOOL_STATUS_LABELS[c.from ?? ''] ?? c.from ?? '—'
                                : c.field === 'about_description' && (c.from?.length ?? 0) > 120
                                  ? `${(c.from ?? '').slice(0, 120)}…`
                                  : (c.from ?? '—')}
                        </span>
                        {' → '}
                        <span className="text-foreground">
                          {c.field === 'type'
                            ? formatSchoolTypeLabel(c.to ?? '')
                            : c.field === 'segment'
                              ? SCHOOL_SEGMENT_LABELS[c.to ?? ''] ?? c.to ?? '—'
                              : c.field === 'status'
                                ? SCHOOL_STATUS_LABELS[c.to ?? ''] ?? c.to ?? '—'
                                : c.field === 'about_description' && (c.to?.length ?? 0) > 120
                                  ? `${(c.to ?? '').slice(0, 120)}…`
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
