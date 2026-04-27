'use client';

import type { ChangeEvent } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Sparkles, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

type PlacementUpdatedSchoolRow = { id: string; name: string; institution_code: string | null };

type PlacementApplySummary = {
  source: 'feed' | 'csv' | 'gpt';
  at: number;
  ok?: boolean;
  updated: number;
  skipped_no_match: number;
  row_errors: string[];
  updated_schools?: PlacementUpdatedSchoolRow[];
  updated_schools_truncated?: boolean;
  message?: string;
  update_scope?: string;
};

export type GptPreviewGroup = {
  key: string;
  institution_code: string;
  trackLabel: string | null;
  track_id: string | null;
  rows: Record<string, unknown>[];
};

export type GptMeta = {
  schools_considered: number;
  batches: number;
  model: string;
  row_count: number;
  restrict_on_apply?: boolean;
  city?: string;
  update_scope?: string;
  source_scores_in_table?: string;
  replace_placement_scores?: boolean;
  fetched_from_url?: string;
};

/** full: mevcut (URL+CSV+LGS/OBP alt sekme); feed_plus_lgs: yalnız besleme+LGS GPT; obp_gpt_only: yalnız OBP GPT + özet */
export type PlacementFeedSection = 'full' | 'feed_plus_lgs' | 'obp_gpt_only';

const KB_OBP_IL_PAGE_EXAMPLE =
  'https://kazanabilirsin.com/konya-sinavsiz-obp-ile-ogrenci-alan-liseler-2024-taban-puanlari/';

type PlacementFeedPanelProps = {
  /** DOM: panel-sr-placement | panel-sr-obp-local */
  panelId?: string;
  ariaLabelledBy?: string;
  section?: PlacementFeedSection;
  token: string | null;
  placementUpdateScope: 'both' | 'central_only' | 'local_only';
  setPlacementUpdateScope: (v: 'both' | 'central_only' | 'local_only') => void;
  placementSyncing: boolean;
  placementCsvLoading: boolean;
  runPlacementFeedSync: () => Promise<void>;
  handlePlacementCsvChange: (ev: ChangeEvent<HTMLInputElement>) => void;
  placementGptKind: 'lgs' | 'obp';
  /** Yalnız `section === 'full'` iç sekmelerinde */
  setPlacementGptKind?: (v: 'lgs' | 'obp') => void;
  gptLgsImportUrl: string;
  setGptLgsImportUrl: (v: string) => void;
  gptLgsSource: string;
  setGptLgsSource: (v: string) => void;
  gptObpImportUrl: string;
  setGptObpImportUrl: (v: string) => void;
  gptObpSource: string;
  setGptObpSource: (v: string) => void;
  gptLimit: number;
  setGptLimit: (n: number) => void;
  gptBatch: number;
  setGptBatch: (n: number) => void;
  gptCity: string;
  setGptCity: (v: string) => void;
  gptSchoolIds: string;
  setGptSchoolIds: (v: string) => void;
  placementGptReplaceScores: boolean;
  setPlacementGptReplaceScores: (v: boolean) => void;
  gptPreviewLoading: boolean;
  gptApplyLoading: boolean;
  runPlacementGptPreview: () => Promise<void>;
  runPlacementGptApply: () => Promise<void>;
  downloadGptJson: () => void;
  gptMeta: GptMeta | null;
  gptWarnings: string[];
  gptResultJson: string;
  gptPreviewGrouped: GptPreviewGroup[];
  gptInstitutionNames: Record<string, string>;
  fmtCell: (v: unknown) => string;
  placementApplySummary: PlacementApplySummary | null;
  setPlacementApplySummary: (v: PlacementApplySummary | null) => void;
  clearGptPreview: () => void;
  /** OBP sekmesi: yalnız yerel sütun CSV (update_scope=local_only) */
  localOnlyCsvLoading?: boolean;
  onLocalOnlyCsvChange?: (ev: ChangeEvent<HTMLInputElement>) => void;
};

export function PlacementFeedPanel(p: PlacementFeedPanelProps) {
  const section = p.section ?? 'full';
  const showFeedCard = section === 'full' || section === 'feed_plus_lgs';
  const showKindTabs = section === 'full';
  const effectiveKind: 'lgs' | 'obp' =
    section === 'feed_plus_lgs' ? 'lgs' : section === 'obp_gpt_only' ? 'obp' : p.placementGptKind;

  const url = effectiveKind === 'lgs' ? p.gptLgsImportUrl.trim() : p.gptObpImportUrl.trim();
  const pasted = effectiveKind === 'lgs' ? p.gptLgsSource.trim() : p.gptObpSource.trim();
  const canRun = !!(url || pasted);

  return (
    <div
      id={p.panelId ?? 'panel-sr-placement'}
      role="tabpanel"
      aria-labelledby={p.ariaLabelledBy ?? 'tab-sr-placement'}
      className="space-y-6"
    >
      {showFeedCard ? (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ortaöğretime geçiş — otomatik / toplu besleme</CardTitle>
          <p className="text-sm text-muted-foreground">
            MEB’de <strong>merkezî</strong> (LGS puanı) ve <strong>yerel</strong> (OBP, ikamet, devamsızlık) yerleştirme
            ayrı süreçlerdir. JSON/CSV ile <code className="rounded bg-muted px-1">review_placement_scores</code> güncellenir;
            eşleştirme: <strong>kurum_kodu</strong> / institution_code veya <strong>okul UUID</strong>.
          </p>
          {section === 'feed_plus_lgs' ? (
            <p className="mt-2 text-xs font-medium text-primary">
              Sınavsız (OBP / yerel) GPT ve yerel-only CSV — üstteki <strong>«Sınavsız (OBP / yerel)»</strong> sekmesinde.
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">JSON örnek (URL yanıtı — takma adlar kabul edilir)</p>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
              {`{\n  "auto_enable_dual_track": true,\n  "update_scope": "central_only",\n  "rows": [\n    { "kurum_kodu": "709981", "yil": 2025, "merkezi_lgs": 450.5 },\n    { "kurum_kodu": "709981", "yil": 2025, "yerel_taban": 380 }\n  ]\n}`}
            </pre>
            <p className="mt-1 text-[11px] leading-snug">
              <code className="rounded bg-background px-1">update_scope</code>:{' '}
              <strong>both</strong> (varsayılan, iki sütun), <strong>central_only</strong> (yalnız LGS),{' '}
              <strong>local_only</strong> (yalnız yerel). İki ayrı JSON dosyasını sırayla yüklerken doğru kapsamı seçin.
            </p>
            <p className="mt-2">
              Ortam: <code className="rounded bg-background px-1">SCHOOL_PLACEMENT_SCORES_FEED_URL</code>
              {', '}
              <code className="rounded bg-background px-1">SCHOOL_PLACEMENT_SCORES_FEED_TOKEN</code> (Bearer, isteğe bağlı).
              Zamanlama: her gün 04:00 (İstanbul).
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted-foreground">
              Uygulama kapsamı (CSV yükleme ve URL JSON senkronu)
            </label>
            <select
              value={p.placementUpdateScope}
              onChange={(e) => p.setPlacementUpdateScope(e.target.value as 'both' | 'central_only' | 'local_only')}
              className="max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="both">Her iki sütun (merkezî + yerel)</option>
              <option value="central_only">Yalnız merkezî (LGS) — yerel puanlara dokunma</option>
              <option value="local_only">Yalnız yerel — merkezî (LGS) puanlara dokunma</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void p.runPlacementFeedSync()}
              disabled={p.placementSyncing || !p.token}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {p.placementSyncing ? 'Senkron…' : 'URL’den şimdi senkronize et'}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
              <Upload className="size-4" aria-hidden />
              {p.placementCsvLoading ? 'Yükleniyor…' : 'CSV yükle'}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={p.placementCsvLoading || !p.token}
                onChange={(ev) => void p.handlePlacementCsvChange(ev)}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            CSV sütunları (en az biri): kurum: <code className="rounded bg-muted px-1">institution_code</code> /{' '}
            <code className="rounded bg-muted px-1">kurum_kodu</code>; okul: <code className="rounded bg-muted px-1">school_id</code> /{' '}
            <code className="rounded bg-muted px-1">okul_id</code>; yıl: <code className="rounded bg-muted px-1">year</code> /{' '}
            <code className="rounded bg-muted px-1">yil</code>; merkezî: <code className="rounded bg-muted px-1">with_exam</code>,{' '}
            <code className="rounded bg-muted px-1">merkezi_lgs</code>; yerel: <code className="rounded bg-muted px-1">without_exam</code>,{' '}
            <code className="rounded bg-muted px-1">yerel_taban</code>, <code className="rounded bg-muted px-1">yerel_obp</code>.
          </p>
        </CardContent>
      </Card>
      ) : null}

      {section === 'obp_gpt_only' ? (
        <Card className="border-emerald-500/20 bg-emerald-500/[0.04] dark:bg-emerald-950/15">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-emerald-900 dark:text-emerald-100">Sınavsız (OBP / yerel) bu sekmede</CardTitle>
            <p className="text-sm text-muted-foreground">
              Ortak JSON URL, CSV ve merkezî (LGS) GPT — <strong>Yerleştirme puanları</strong> sekmesinde. Burada yalnız
              yerel gösterge tabloları (OBP) için kaynak ve GPT; uygulama sunucuda{' '}
              <code className="rounded bg-muted px-1">local_only</code> ile sabittir.
            </p>
          </CardHeader>
        </Card>
      ) : null}

      {showKindTabs ? (
      <div
        role="tablist"
        aria-label="Yerleştirme puan türü"
        className="flex flex-wrap gap-1 rounded-xl border border-border/80 bg-muted/30 p-1 dark:bg-muted/15"
      >
        <button
          type="button"
          role="tab"
          aria-selected={p.placementGptKind === 'lgs'}
          onClick={() => {
            p.setPlacementGptKind?.('lgs');
            p.clearGptPreview();
          }}
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            p.placementGptKind === 'lgs'
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Sınavlı (LGS / merkezî taban)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={p.placementGptKind === 'obp'}
          onClick={() => {
            p.setPlacementGptKind?.('obp');
            p.clearGptPreview();
          }}
          className={cn(
            'rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
            p.placementGptKind === 'obp'
              ? 'bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Sınavsız (OBP / yerel)
        </button>
      </div>
      ) : null}

      {section === 'obp_gpt_only' && p.onLocalOnlyCsvChange ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Yerel sütun — CSV (yalnız sınavsız)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Yükleme kapsamı sabit <code className="rounded bg-muted px-1">local_only</code> — merkezî LGS sütunlarına
              dokunulmaz. Kurum kodu + yıl + yerel puan sütunları «Yerleştirme puanları» sekmesindeki CSV ile aynıdır.
            </p>
          </CardHeader>
          <CardContent>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-emerald-600/40 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-600/15 dark:text-emerald-50">
              <Upload className="size-4" aria-hidden />
              {p.localOnlyCsvLoading ? 'Yükleniyor…' : 'Yerel CSV yükle'}
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={p.localOnlyCsvLoading || !p.token}
                onChange={(ev) => void p.onLocalOnlyCsvChange?.(ev)}
              />
            </label>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-5 text-violet-500" aria-hidden />
            {effectiveKind === 'lgs' ? 'LGS tablosundan puan çıkarma' : 'OBP tablosundan puan çıkarma'}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {section === 'obp_gpt_only' ? (
              <>
                Bu sekmedeki istekler yalnız <strong>yerel (OBP)</strong> içindir; merkezî LGS alanı güncellenmez.
                Kaynak en fazla <strong>150.000</strong> karakter; kazanabilirsin uyumlu tabloda önce deterministik
                ayrıştırıcı çalışır (GPT yavaş kalır). İl sayfası örnek:{' '}
                <a
                  href={KB_OBP_IL_PAGE_EXAMPLE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  Konya sınavsız OBP
                </a>
                . Aynı il adını «İl filtresi»ne yazın (<code className="rounded bg-muted px-1">schools.city</code>).
              </>
            ) : (
              <>
                Bu alt sekmede sunucuya giden istek sabittir:{' '}
                <strong>
                  {effectiveKind === 'lgs'
                    ? 'yalnız merkezî (LGS) taban puanları — yerel sütun okunmaz ve DB’de yerel alana yazılmaz.'
                    : 'yalnız yerel (OBP) puanları — merkezî sütun okunmaz ve DB’de LGS alanına yazılmaz.'}
                </strong>{' '}
                Kaynak metin en fazla <strong>150.000</strong> karakter. kazanabilirsin.com uyumlu tabloda deterministik
                ayrıştırıcı önce çalışır. İl filtresi <code className="rounded bg-muted px-1">schools.city</code> ile eşleşir.
              </>
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-lg border border-violet-200/50 bg-violet-500/6 p-3 dark:border-violet-900/50 dark:bg-violet-950/25">
            <p className="text-xs font-semibold text-foreground">
              API kapsamı (sabit):{' '}
              <span className="font-mono">
                {effectiveKind === 'lgs' ? 'source_scores_in_table=central_only · update_scope=central_only' : 'source_scores_in_table=local_only · update_scope=local_only'}
              </span>
            </p>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              {showKindTabs
                ? 'LGS ve OBP için ayrı URL ve yapıştırma alanları vardır; sekme değiştirince önizleme sıfırlanır.'
                : section === 'obp_gpt_only'
                  ? 'OBP URL/metin alanları yalnız bu sekmede; LGS alanları «Yerleştirme puanları» sekmesindedir.'
                  : 'LGS kaynağı yalnız bu sekmede; OBP için «Sınavsız (OBP / yerel)» üst sekmesini kullanın.'}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-foreground">Liste bağlamı — hangi okullar eşleştirmede kullanılır</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">En fazla okul (kurum kodlu)</label>
                <input
                  type="number"
                  min={1}
                  max={2000}
                  value={p.gptLimit}
                  onChange={(e) => p.setGptLimit(parseInt(e.target.value, 10) || 400)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Parti boyutu (GPT çağrısı başına okul)</label>
                <input
                  type="number"
                  min={4}
                  max={50}
                  value={p.gptBatch}
                  onChange={(e) => p.setGptBatch(parseInt(e.target.value, 10) || 22)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-1" />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  İl filtresi (isteğe bağlı, okul kaydındaki il adı)
                </label>
                <input
                  type="text"
                  value={p.gptCity}
                  onChange={(e) => p.setGptCity(e.target.value)}
                  placeholder="Örn. Konya — boşsa tüm iller (il yokken limit uygulanır)"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Okul UUID filtre (isteğe bağlı, virgül veya satır ile)
                </label>
                <textarea
                  value={p.gptSchoolIds}
                  onChange={(e) => p.setGptSchoolIds(e.target.value)}
                  rows={2}
                  spellCheck={false}
                  placeholder="Boş + il yoksa kurum kodlu okullar bağlamda kullanılır."
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 p-3">
            <input
              type="checkbox"
              id={section === 'obp_gpt_only' ? 'placement-gpt-replace-obp' : 'placement-gpt-replace'}
              checked={p.placementGptReplaceScores}
              onChange={(e) => p.setPlacementGptReplaceScores(e.target.checked)}
              className="mt-0.5"
            />
            <label
              htmlFor={section === 'obp_gpt_only' ? 'placement-gpt-replace-obp' : 'placement-gpt-replace'}
              className="cursor-pointer text-xs leading-snug text-muted-foreground"
            >
              <span className="font-medium text-foreground">Uygulamada mevcut puanları tamamen değiştir</span> — işaretliyse
              güncellenen her okulda önceki yerleştirme puanı JSON silinir; yalnız bu içe aktarımdaki satırlar kalır.
            </label>
          </div>

          {effectiveKind === 'lgs' ? (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Kazanabilirsin LGS sayfa URL’si (yapıştırma ile aynı anda kullanmayın)
                </label>
                <input
                  type="url"
                  value={p.gptLgsImportUrl}
                  onChange={(e) => p.setGptLgsImportUrl(e.target.value)}
                  spellCheck={false}
                  placeholder="https://kazanabilirsin.com/...-lgs-meb/"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">LGS kaynak metin (tablo)</label>
                <textarea
                  value={p.gptLgsSource}
                  onChange={(e) => p.setGptLgsSource(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  placeholder="URL kullanmıyorsanız: LGS taban tablosunu buraya yapıştırın…"
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Kazanabilirsin OBP sayfa URL’si (yapıştırma ile aynı anda kullanmayın)
                </label>
                <input
                  type="url"
                  value={p.gptObpImportUrl}
                  onChange={(e) => p.setGptObpImportUrl(e.target.value)}
                  spellCheck={false}
                  placeholder={KB_OBP_IL_PAGE_EXAMPLE}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">OBP kaynak metin (tablo)</label>
                <textarea
                  value={p.gptObpSource}
                  onChange={(e) => p.setGptObpSource(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  placeholder="URL kullanmıyorsanız: OBP tablosunu buraya yapıştırın…"
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs leading-relaxed"
                />
              </div>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void p.runPlacementGptPreview()}
              disabled={p.gptPreviewLoading || !p.token || !canRun}
              className="inline-flex items-center gap-2 rounded-lg border border-violet-600/40 bg-violet-600/10 px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-600/15 disabled:opacity-50 dark:text-violet-100"
            >
              {p.gptPreviewLoading ? 'Önizleme…' : 'Önizleme üret'}
            </button>
            <button
              type="button"
              onClick={() => void p.runPlacementGptApply()}
              disabled={p.gptApplyLoading || !p.token || !canRun}
              className="inline-flex items-center gap-2 rounded-lg border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {p.gptApplyLoading ? 'Uygulanıyor…' : 'Veritabanına uygula'}
            </button>
            <button
              type="button"
              onClick={p.downloadGptJson}
              disabled={!p.gptResultJson.trim()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              <Download className="size-4" aria-hidden />
              JSON indir
            </button>
          </div>

          {p.gptMeta && (
            <p className="text-xs text-muted-foreground">
              Model: <span className="font-mono">{p.gptMeta.model}</span> · Bağlam okul: {p.gptMeta.schools_considered} ·
              Parti: {p.gptMeta.batches} · Satır: {p.gptMeta.row_count}
              {p.gptMeta.replace_placement_scores != null ? (
                <>
                  {' '}
                  · Uygulama:{' '}
                  <span className="font-medium text-foreground">
                    {p.gptMeta.replace_placement_scores ? 'tam değiştir' : 'birleştir'}
                  </span>
                </>
              ) : null}
              {p.gptMeta.city ? (
                <>
                  {' '}
                  · İl: <span className="font-medium text-foreground">{p.gptMeta.city}</span>
                </>
              ) : null}
              {p.gptMeta.restrict_on_apply ? (
                <span className="text-violet-700 dark:text-violet-300">
                  {' '}
                  · Uygulama yalnız bağlam okul kimlikleriyle sınırlı
                </span>
              ) : null}
              {p.gptMeta.update_scope ? (
                <>
                  {' '}
                  · Kayıt kapsamı: <span className="font-mono">{p.gptMeta.update_scope}</span>
                </>
              ) : null}
              {p.gptMeta.source_scores_in_table ? (
                <>
                  {' '}
                  · Tablo: <span className="font-mono">{p.gptMeta.source_scores_in_table}</span>
                </>
              ) : null}
              {p.gptMeta.fetched_from_url ? (
                <>
                  {' '}
                  · URL:{' '}
                  <span className="break-all font-mono text-[10px] text-foreground">{p.gptMeta.fetched_from_url}</span>
                </>
              ) : null}
            </p>
          )}
          {p.gptWarnings.length > 0 && (
            <div className="max-h-32 overflow-auto rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-950 dark:text-amber-100">
              {p.gptWarnings.slice(0, 40).map((w, i) => (
                <div key={i}>{w}</div>
              ))}
              {p.gptWarnings.length > 40 && <div className="opacity-80">… +{p.gptWarnings.length - 40}</div>}
            </div>
          )}
          {p.gptResultJson ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Besleme JSON örneği (önizleme)</label>
              <textarea
                readOnly
                value={p.gptResultJson}
                rows={8}
                className="w-full resize-y rounded-md border border-input bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed"
              />
            </div>
          ) : null}
          {p.gptPreviewGrouped.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-foreground">Önizleme tabloları (kurum + alan; her alan ayrı tablo)</p>
              {p.gptPreviewGrouped.map((g) => {
                const all = g.rows;
                const srcTable = p.gptMeta?.source_scores_in_table;
                const hideMerkeziScope = srcTable === 'local_only';
                const hideYerelScope = srcTable === 'central_only';
                const showMerkeziCol =
                  !hideMerkeziScope && all.some((r) => r.with_exam != null && Number.isFinite(Number(r.with_exam)));
                const showYerelCol =
                  !hideYerelScope && all.some((r) => r.without_exam != null && Number.isFinite(Number(r.without_exam)));
                const showC = all.some((r) => r.contingent != null);
                const showT = all.some((r) => r.tbs != null);
                const showMinTaban = all.some((r) => r.min_taban != null && Number.isFinite(Number(r.min_taban)));
                const showProg = all.some((r) => {
                  const v = r.program ?? (r as { program_adi?: unknown }).program_adi;
                  return v != null && String(v).trim() !== '';
                });
                const showLang = all.some((r) => {
                  const v = r.language ?? (r as { dil?: unknown }).dil;
                  return v != null && String(v).trim() !== '';
                });
                return (
                  <div
                    key={g.key}
                    className="overflow-x-auto rounded-lg border border-violet-500/25 bg-violet-500/5 p-1 dark:border-violet-500/20 dark:bg-violet-950/25"
                  >
                    <div className="border-b border-violet-500/20 px-2 py-1.5 text-left dark:border-violet-500/15">
                      <span className="font-mono text-xs font-bold text-foreground">
                        Kurum: {g.institution_code}
                        {p.gptInstitutionNames[g.institution_code]?.trim()
                          ? ` — ${p.gptInstitutionNames[g.institution_code]!.trim()}`
                          : ''}
                      </span>
                      {g.trackLabel != null && g.trackLabel !== '' ? (
                        <span className="mt-0.5 block text-xs font-medium leading-snug text-violet-900 dark:text-violet-100">
                          Okul alanı / program: {g.trackLabel}
                        </span>
                      ) : (
                        <span className="mt-0.5 block text-xs text-muted-foreground">Okul alanı: genel (tek program)</span>
                      )}
                    </div>
                    <table className="w-full min-w-[280px] border-collapse text-left text-[11px] sm:text-xs">
                      <thead>
                        <tr className="border-b border-border/80 bg-muted/40 text-muted-foreground">
                          <th className="px-2 py-1.5 font-medium">Yıl</th>
                          {showProg ? <th className="px-2 py-1.5 font-medium">Program türü</th> : null}
                          {showLang ? <th className="px-2 py-1.5 font-medium">Dil</th> : null}
                          {showMerkeziCol ? (
                            <th className="px-2 py-1.5 font-medium">Merkezî (LGS / sınavlı taban)</th>
                          ) : null}
                          {showYerelCol ? (
                            <th className="px-2 py-1.5 font-medium">Yerel (sınavsız gösterge)</th>
                          ) : null}
                          {showC ? <th className="px-2 py-1.5 font-medium">Knt.</th> : null}
                          {showT ? <th className="px-2 py-1.5 font-medium">TBS</th> : null}
                          {showMinTaban ? <th className="px-2 py-1.5 font-medium">Taban / son</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {all.map((r, ri) => (
                          <tr key={`${g.key}-${r.year}-${ri}`} className="border-b border-border/50 last:border-0">
                            <td className="px-2 py-1.5 font-mono tabular-nums">{p.fmtCell(r.year)}</td>
                            {showProg ? (
                              <td className="px-2 py-1.5">{p.fmtCell(r.program ?? (r as { program_adi?: unknown }).program_adi)}</td>
                            ) : null}
                            {showLang ? (
                              <td className="px-2 py-1.5">{p.fmtCell(r.language ?? (r as { dil?: unknown }).dil)}</td>
                            ) : null}
                            {showMerkeziCol ? (
                              <td className="px-2 py-1.5 tabular-nums">{p.fmtCell(r.with_exam)}</td>
                            ) : null}
                            {showYerelCol ? (
                              <td className="px-2 py-1.5 tabular-nums">{p.fmtCell(r.without_exam)}</td>
                            ) : null}
                            {showC ? <td className="px-2 py-1.5 tabular-nums">{p.fmtCell(r.contingent)}</td> : null}
                            {showT ? <td className="px-2 py-1.5 tabular-nums">{p.fmtCell(r.tbs)}</td> : null}
                            {showMinTaban ? (
                              <td className="px-2 py-1.5 tabular-nums">{p.fmtCell(r.min_taban)}</td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {p.placementApplySummary && (
        <Card className="border-emerald-500/25 bg-emerald-500/[0.04] dark:bg-emerald-950/20">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Son yerleştirme işlemi — güncellenen okullar</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Kaynak:{' '}
                {p.placementApplySummary.source === 'feed'
                  ? 'URL senkron'
                  : p.placementApplySummary.source === 'csv'
                    ? 'CSV'
                    : 'GPT'}{' '}
                · {new Date(p.placementApplySummary.at).toLocaleString('tr-TR')} · Güncellenen:{' '}
                {p.placementApplySummary.updated} · Eşleşmeyen satır: {p.placementApplySummary.skipped_no_match}
                {p.placementApplySummary.update_scope
                  ? ` · Kapsam: ${
                      p.placementApplySummary.update_scope === 'central_only'
                        ? 'yalnız merkezî'
                        : p.placementApplySummary.update_scope === 'local_only'
                          ? 'yalnız yerel'
                          : 'her iki sütun'
                    }`
                  : ''}
                {p.placementApplySummary.updated_schools_truncated
                  ? ' · Liste ilk 500 okulla sınırlı (tam sayı yukarıda)'
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => p.setPlacementApplySummary(null)}
              className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted"
            >
              Özeti kapat
            </button>
          </CardHeader>
          <CardContent className="space-y-2">
            {p.placementApplySummary.updated_schools && p.placementApplySummary.updated_schools.length > 0 ? (
              <ul className="max-h-64 list-none space-y-1 overflow-y-auto rounded-md border border-border bg-background/80 p-2 text-sm">
                {p.placementApplySummary.updated_schools.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0"
                  >
                    <Link href={`/schools/${s.id}`} className="min-w-0 flex-1 font-medium text-primary hover:underline">
                      {s.name || 'İsimsiz okul'}
                    </Link>
                    {s.institution_code ? (
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{s.institution_code}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Bu işlemde veritabanında eşleşen okul kaydı güncellenmedi veya liste dönmedi.
                </p>
                {p.placementApplySummary.row_errors?.length ? (
                  <ul className="list-disc space-y-1 rounded-md border border-amber-500/25 bg-amber-500/5 py-2 pl-5 text-amber-950 dark:text-amber-100">
                    {p.placementApplySummary.row_errors.slice(0, 24).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
