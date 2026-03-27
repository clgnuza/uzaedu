'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  ArrowLeft,
  RefreshCw,
  Plus,
  Link2,
  Settings,
  Pencil,
  Trash2,
  Bot,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const EXAM_DUTY_CATEGORIES = [
  { value: 'meb', label: 'MEB' },
  { value: 'osym', label: 'ÖSYM' },
  { value: 'aof', label: 'AÖF' },
  { value: 'ataaof', label: 'ATA-AÖF' },
  { value: 'auzef', label: 'AUZEF' },
] as const;

const TABS = [
  { id: 'kaynaklar', label: 'Kaynaklar', icon: Link2 },
  { id: 'sync', label: 'Senkronizasyon', icon: RefreshCw },
  { id: 'ayarlar', label: 'GPT & Ayarlar', icon: Bot },
] as const;

type SyncSource = {
  id: string;
  key: string;
  label: string;
  category_slug?: string;
  categorySlug?: string;
  rss_url?: string | null;
  base_url?: string | null;
  baseUrl?: string | null;
  scrape_config?: Record<string, unknown> | null;
  scrapeConfig?: Record<string, unknown> | null;
  title_keywords?: string | null;
  titleKeywords?: string | null;
  is_active?: boolean;
  isActive?: boolean;
  last_synced_at?: string | null;
  lastSyncedAt?: string | null;
  last_result_created?: number;
  lastResultCreated?: number;
  last_result_skipped?: number;
  lastResultSkipped?: number;
  last_result_error?: string | null;
  lastResultError?: string | null;
};

type SyncResult = {
  ok: boolean;
  message: string;
  results: { source_key: string; source_label: string; created: number; skipped: number; error?: string }[];
  total_created: number;
  total_restored?: number;
  total_gpt_errors?: number;
  /** Ayarlardaki max yeni duyuru limiti (0 = sınırsız) */
  quota_limit?: number;
  /** Kota dolduğu için atlanan link sayısı */
  quota_skipped?: number;
  skipped_items?: Array<{ source_key: string; title: string; url: string; reason: string }>;
};

const EXAM_DUTY_TIME_FIELDS = [
  { key: 'application_start', label: 'Başvuru Açılış' },
  { key: 'application_end', label: 'Son Başvuru' },
  { key: 'application_approval_end', label: 'Başvuru Onay' },
  { key: 'result_date', label: 'Sonuç / Sınav öncesi hatırlatma' },
  { key: 'exam_date', label: 'Sınav Tarihi' },
  { key: 'exam_date_end', label: 'Sınav sonrası hatırlatma' },
] as const;

type ExamDutySyncConfig = {
  gpt_enabled: boolean;
  openai_api_key?: string | null;
  default_times?: Record<string, string>;
  sync_options?: {
    skip_past_exam_date?: boolean;
    recheck_max_count?: number;
    fetch_timeout_ms?: number;
    log_gpt_usage?: boolean;
    add_draft_without_dates?: boolean;
    max_new_per_sync?: number;
  };
};

type SyncHealth = {
  last_sync_at: string | null;
  total_created_last_run: number;
  total_restored_last_run: number;
  total_gpt_errors_last_run: number;
  sources: Array<{
    key: string;
    label: string;
    last_synced_at: string | null;
    last_result_created: number;
    last_result_skipped: number;
    last_result_error: string | null;
    consecutive_error_count: number;
  }>;
};

function SyncHealthBlock({ token }: { token: string | null }) {
  const [health, setHealth] = useState<SyncHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const fetchHealth = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<SyncHealth>('/admin/exam-duties/sync-health', { token });
      setHealth(data ?? null);
    } catch {
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);
  if (!health && !loading) return null;
  return (
    <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4">
      <h4 className="text-sm font-medium mb-2">Sync durumu</h4>
      {loading ? (
        <LoadingSpinner className="size-5" />
      ) : health ? (
        <div className="text-sm space-y-1">
          <p className="text-muted-foreground">
            Son sync: {health.last_sync_at ? new Date(health.last_sync_at).toLocaleString('tr-TR') : 'Henüz yok'}
          </p>
          <p className="text-muted-foreground">
            Son çalıştırma: {health.total_created_last_run} eklendi, {health.total_restored_last_run} geri yüklendi
            {health.total_gpt_errors_last_run > 0 && ` · GPT hata: ${health.total_gpt_errors_last_run}`}
          </p>
          {health.sources.some((s) => s.last_result_error) && (
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              Bazı kaynaklarda hata oluştu: {health.sources.filter((s) => s.last_result_error).map((s) => s.label).join(', ')}
            </p>
          )}
          {health.sources.some((s) => (s.consecutive_error_count ?? 0) >= 1) && !health.sources.some((s) => s.last_result_error) && (
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              Ardışık hata: {health.sources.filter((s) => (s.consecutive_error_count ?? 0) >= 1).map((s) => s.label).join(', ')}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function SinavGoreviAyarlarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const [sources, setSources] = useState<SyncSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const tab = (searchParams.get('tab') as (typeof TABS)[number]['id']) || 'kaynaklar';

  const [sourceModal, setSourceModal] = useState<{ open: boolean; edit?: SyncSource }>({ open: false });
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<ExamDutySyncConfig>({
    gpt_enabled: false,
    openai_api_key: null,
    default_times: {},
    sync_options: { skip_past_exam_date: false, recheck_max_count: 1, fetch_timeout_ms: 30000, log_gpt_usage: false, add_draft_without_dates: true, max_new_per_sync: 1 },
  });
  const [configSaving, setConfigSaving] = useState(false);

  const [srcForm, setSrcForm] = useState({
    key: '',
    label: '',
    category_slug: 'meb',
    base_url: '',
    rss_url: '',
    scrape_config: '',
    title_keywords: '',
    is_active: true,
    detect_category_per_item: false,
    filter_non_application: true,
  });

  const isAdmin = me?.role === 'superadmin';

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/403');
      return;
    }
  }, [isAdmin, router]);

  const fetchSources = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch<SyncSource[]>('/admin/exam-duties/sync-sources', { token });
    setSources(Array.isArray(data) ? data : []);
  }, [token]);

  const fetchConfig = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<ExamDutySyncConfig>('/app-config/exam-duty-sync', { token });
      setConfig({
        gpt_enabled: data?.gpt_enabled ?? false,
        openai_api_key: data?.openai_api_key ?? null,
        default_times: data?.default_times ?? {},
        sync_options: data?.sync_options ?? { skip_past_exam_date: false, recheck_max_count: 1, fetch_timeout_ms: 30000, log_gpt_usage: false, add_draft_without_dates: true, max_new_per_sync: 0 },
      });
    } catch {
      setConfig({
        gpt_enabled: false,
        default_times: {},
        sync_options: { skip_past_exam_date: false, recheck_max_count: 1, fetch_timeout_ms: 30000, log_gpt_usage: false, add_draft_without_dates: true, max_new_per_sync: 1 },
      });
    }
  }, [token]);

  const fetchData = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      await Promise.all([fetchSources(), fetchConfig()]);
    } catch {
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, fetchSources, fetchConfig]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async (dryRun = false) => {
    if (!token || !isAdmin) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiFetch<SyncResult>('/admin/exam-duties/sync', {
        method: 'POST',
        token,
        body: JSON.stringify(dryRun ? { dry_run: true } : {}),
      });
      setSyncResult(res);
      if (res.ok) {
        toast.success(res?.message ?? 'Senkronizasyon tamamlandı.');
      } else {
        toast.warning(res?.message ?? 'Bazı kaynaklarda hata oluştu.');
      }
      fetchSources();
    } catch (e) {
      toast.error('Senkronizasyon hatası.');
    } finally {
      setSyncing(false);
    }
  };

  const openSourceModal = (edit?: SyncSource) => {
    const sc = edit?.scrape_config ?? edit?.scrapeConfig;
    const detectCat = !!sc && typeof sc === 'object' && sc.detect_category_per_item === true;
    const filterNon = sc && typeof sc === 'object' ? sc.filter_non_application !== false : true;
    const baseSc = sc && typeof sc === 'object' ? { ...sc } : {};
    delete baseSc.detect_category_per_item;
    delete baseSc.filter_non_application;
    const scrapeStr = Object.keys(baseSc).length > 0 ? JSON.stringify(baseSc, null, 2) : '';
    if (edit) {
      setSrcForm({
        key: edit.key,
        label: edit.label,
        category_slug: (edit.category_slug ?? edit.categorySlug ?? 'meb') as string,
        base_url: edit.base_url ?? edit.baseUrl ?? '',
        rss_url: edit.rss_url ?? '',
        scrape_config: scrapeStr,
        title_keywords: edit.title_keywords ?? edit.titleKeywords ?? '',
        is_active: edit.is_active ?? edit.isActive ?? true,
        detect_category_per_item: detectCat,
        filter_non_application: filterNon,
      });
    } else {
      setSrcForm({
        key: '',
        label: '',
        category_slug: 'meb',
        base_url: '',
        rss_url: '',
        scrape_config: '',
        title_keywords: 'sınav,görev,gözetmen,başvuru',
        is_active: true,
        detect_category_per_item: false,
        filter_non_application: true,
      });
    }
    setSourceModal({ open: true, edit });
  };

  const saveSource = async () => {
    if (!token) return;
    if (!srcForm.key.trim() || !srcForm.label.trim()) {
      toast.error('Key ve Label zorunludur.');
      return;
    }
    let scrapeConfigObj: Record<string, unknown> | undefined;
    if (srcForm.scrape_config.trim()) {
      try {
        scrapeConfigObj = JSON.parse(srcForm.scrape_config) as Record<string, unknown>;
        scrapeConfigObj.detect_category_per_item = srcForm.detect_category_per_item;
        scrapeConfigObj.filter_non_application = srcForm.filter_non_application;
      } catch {
        toast.error('Scrape Config geçerli JSON olmalı.');
        return;
      }
    }

    const hasRss = !!srcForm.rss_url?.trim();
    const hasScrape = !!(srcForm.base_url?.trim() && scrapeConfigObj);
    if (!hasRss && !hasScrape) {
      toast.error('RSS URL veya Base URL + Scrape Config tanımlı olmalı.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        key: srcForm.key,
        label: srcForm.label,
        categorySlug: srcForm.category_slug,
        base_url: srcForm.base_url || undefined,
        rss_url: srcForm.rss_url || undefined,
        scrape_config: scrapeConfigObj,
        title_keywords: srcForm.title_keywords || undefined,
        is_active: srcForm.is_active,
      };
      if (sourceModal.edit) {
        await apiFetch(`/admin/exam-duties/sync-sources/${sourceModal.edit.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({
            label: payload.label,
            categorySlug: payload.categorySlug,
            baseUrl: payload.base_url || null,
            rssUrl: payload.rss_url || null,
            scrapeConfig: payload.scrape_config,
            titleKeywords: payload.title_keywords || null,
            isActive: payload.is_active,
          }),
        });
        toast.success('Kaynak güncellendi.');
      } else {
        await apiFetch('/admin/exam-duties/sync-sources', {
          method: 'POST',
          token,
          body: JSON.stringify({
            key: payload.key,
            label: payload.label,
            categorySlug: payload.categorySlug,
            baseUrl: payload.base_url || null,
            rssUrl: payload.rss_url || null,
            scrapeConfig: payload.scrape_config,
            titleKeywords: payload.title_keywords || null,
            isActive: payload.is_active,
          }),
        });
        toast.success('Kaynak eklendi.');
      }
      setSourceModal({ open: false });
      fetchSources();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSource = async (id: string) => {
    if (!token || !confirm('Bu kaynağı silmek istediğinize emin misiniz?')) return;
    try {
      await apiFetch(`/admin/exam-duties/sync-sources/${id}`, { method: 'DELETE', token });
      toast.success('Kaynak silindi.');
      fetchSources();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silme hatası.');
    }
  };

  const saveConfig = async () => {
    if (!token) return;
    setConfigSaving(true);
    try {
      const payload: {
        gpt_enabled?: boolean;
        openai_api_key?: string | null;
        default_times?: Record<string, string>;
        sync_options?: ExamDutySyncConfig['sync_options'];
      } = { gpt_enabled: config.gpt_enabled };
      if (config.openai_api_key !== undefined && config.openai_api_key !== '' && config.openai_api_key !== '••••••••') {
        payload.openai_api_key = config.openai_api_key;
      }
      if (config.default_times !== undefined) payload.default_times = config.default_times;
      if (config.sync_options !== undefined) payload.sync_options = config.sync_options;
      await apiFetch('/app-config/exam-duty-sync', {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      });
      toast.success('Ayarlar kaydedildi.');
      fetchConfig();
    } catch (e) {
      toast.error('Kaydetme hatası.');
    } finally {
      setConfigSaving(false);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push('/sinav-gorevleri')}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Geri
        </button>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7" />
          Sınav Görevi Ayarları
        </h1>
      </div>

      <div className="border-b border-border">
        <nav className="mobile-tab-scroll flex min-w-max gap-1 rounded-xl border border-border/70 bg-muted/30 p-1 shadow-sm">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <Link
                key={t.id}
                href={`/sinav-gorevleri/ayarlar?tab=${t.id}`}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all',
                  isActive ? 'border-primary/30 bg-primary/10 text-primary shadow-sm' : 'border-transparent text-muted-foreground hover:bg-background/80 hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {loading && tab !== 'ayarlar' ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {tab === 'kaynaklar' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Kaynaklar</CardTitle>
                  <p className="text-sm text-muted-foreground">RSS veya HTML scrape ile MEB, ÖSYM, AÖF, Güncel Eğitim vb.</p>
                </div>
                <Button onClick={() => openSourceModal()} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Kaynak Ekle
                </Button>
              </CardHeader>
              <CardContent>
                {sources.length === 0 ? (
                  <EmptyState
                    icon={<Link2 className="size-10" />}
                    title="Kaynak yok"
                    description="Migration ile MEB Personel GM eklenir. Ek kaynak için yukarıdaki butonu kullanın."
                  />
                ) : (
                  <div className="table-x-scroll">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 font-medium">Etiket</th>
                          <th className="text-left py-2 font-medium">Kategori</th>
                          <th className="text-left py-2 font-medium">Tip</th>
                          <th className="text-left py-2 font-medium">Son sync</th>
                          <th className="text-right py-2 font-medium">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sources.map((s) => {
                          const hasRss = !!s.rss_url?.trim();
                          const hasScrape = !!(s.base_url ?? s.baseUrl) && (s.scrape_config ?? s.scrapeConfig);
                          const tip = hasRss ? 'RSS' : hasScrape ? 'Scrape' : '-';
                          const lastSync = s.last_synced_at ?? s.lastSyncedAt
                            ? new Date(s.last_synced_at ?? s.lastSyncedAt ?? '').toLocaleString('tr-TR')
                            : '-';
                          return (
                            <tr key={s.id} className="border-b border-border">
                              <td className="py-2">{s.label}</td>
                              <td className="py-2">
                                {EXAM_DUTY_CATEGORIES.find((c) => c.value === (s.category_slug ?? s.categorySlug))?.label ?? (s.category_slug ?? s.categorySlug)}
                              </td>
                              <td className="py-2 text-muted-foreground">{tip}</td>
                              <td className="py-2 text-muted-foreground text-xs">{lastSync}</td>
                              <td className="py-2 text-right space-x-2">
                                <button
                                  onClick={() => openSourceModal(s)}
                                  className="text-primary hover:underline inline-flex items-center gap-1"
                                >
                                  <Pencil className="h-3 w-3" />
                                  Düzenle
                                </button>
                                <button
                                  onClick={() => deleteSource(s.id)}
                                  className="text-destructive hover:underline inline-flex items-center gap-1"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  Sil
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'sync' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Senkronizasyon</CardTitle>
                <p className="text-sm text-muted-foreground">
                  RSS veya base_url + scrape_config tanımlı kaynaklardan otomatik sınav görevi duyuruları çekilir. Cron günde 4 kez (09, 13, 17, 21 Türkiye saatinde) çalışır.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <Button onClick={() => handleSync(false)} disabled={syncing}>
                    <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
                    {syncing ? 'Senkronize ediliyor...' : 'Şimdi Senkronize Et'}
                  </Button>
                  <Button variant="outline" onClick={() => handleSync(true)} disabled={syncing}>
                    Test Sync (veri kaydetmeden)
                  </Button>
                  {sources.filter((s) => s.rss_url || ((s.base_url ?? s.baseUrl) && (s.scrape_config ?? s.scrapeConfig))).length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {sources.filter((s) => s.rss_url || ((s.base_url ?? s.baseUrl) && (s.scrape_config ?? s.scrapeConfig))).length} kaynak sync edilebilir
                    </span>
                  )}
                </div>

                {syncResult && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Son Sync Sonucu</h4>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border">
                            <th className="text-left py-2 px-3 font-medium">Kaynak</th>
                            <th className="text-right py-2 px-3 font-medium">Eklenen</th>
                            <th className="text-right py-2 px-3 font-medium">Atlanan</th>
                            <th className="text-left py-2 px-3 font-medium">Durum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {syncResult.results?.map((r) => (
                            <tr key={r.source_key} className="border-b border-border last:border-0">
                              <td className="py-2 px-3">{r.source_label}</td>
                              <td className="py-2 px-3 text-right">{r.created}</td>
                              <td className="py-2 px-3 text-right">{r.skipped}</td>
                              <td className="py-2 px-3">
                                {r.error ? (
                                  <span className="text-destructive text-xs">{r.error}</span>
                                ) : (
                                  <span className="text-muted-foreground">OK</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Toplam {syncResult.total_created ?? 0} yeni duyuru eklendi.
                      {(syncResult.total_restored ?? 0) > 0 && ` ${syncResult.total_restored} silinen duyuru geri yüklendi.`}
                      {(syncResult.total_gpt_errors ?? 0) > 0 && ` (GPT hata: ${syncResult.total_gpt_errors})`}
                    </p>
                  </div>
                )}
                <SyncHealthBlock token={token} />
              </CardContent>
            </Card>
          )}

          {tab === 'ayarlar' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">GPT ve API Ayarları</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Sync sırasında GPT ile tarih, başvuru linki ve kategori çıkarılır. Önce buradan API anahtarı girin; yoksa .env OPENAI_API_KEY kullanılır.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">OpenAI API Anahtarı</label>
                  <Input
                    type="password"
                    value={config.openai_api_key === '••••••••' ? '' : (config.openai_api_key ?? '')}
                    onChange={(e) => setConfig((c) => ({ ...c, openai_api_key: e.target.value || null }))}
                    placeholder={config.openai_api_key === '••••••••' ? 'Mevcut anahtar tanımlı (değiştirmek için yeni girin)' : 'sk-... (boş bırakırsanız .env kullanılır)'}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Buradan girilen anahtar önceliklidir. Değiştirmemek için boş bırakın (mevcut anahtar korunur).
                  </p>
                </div>
                <div className="space-y-4">
                  <p className="text-sm font-medium">Tarih alanları için varsayılan saat (sadece gün seçildiğinde uygulanır)</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {EXAM_DUTY_TIME_FIELDS.map(({ key, label }) => (
                      <div key={key} className="space-y-1">
                        <label className="text-xs text-muted-foreground">{label}</label>
                        <Input
                          type="time"
                          value={config.default_times?.[key] ?? '00:00'}
                          onChange={(e) =>
                            setConfig((c) => ({
                              ...c,
                              default_times: { ...(c.default_times ?? {}), [key]: e.target.value || '00:00' },
                            }))
                          }
                          className="max-w-[120px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.gpt_enabled}
                      onChange={(e) => setConfig((c) => ({ ...c, gpt_enabled: e.target.checked }))}
                    />
                    <span className="font-medium">Sync sırasında GPT kullan</span>
                  </label>
                </div>
                <div className="space-y-3 border-t border-border pt-4">
                  <p className="text-sm font-medium">Sync seçenekleri</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.sync_options?.skip_past_exam_date ?? false}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            sync_options: { ...(c.sync_options ?? {}), skip_past_exam_date: e.target.checked },
                          }))
                        }
                      />
                      <span className="text-sm">Geçmiş sınav tarihli duyuruları atla</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.sync_options?.log_gpt_usage ?? false}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            sync_options: { ...(c.sync_options ?? {}), log_gpt_usage: e.target.checked },
                          }))
                        }
                      />
                      <span className="text-sm">GPT token kullanımını logla</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.sync_options?.add_draft_without_dates ?? false}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            sync_options: { ...(c.sync_options ?? {}), add_draft_without_dates: e.target.checked },
                          }))
                        }
                      />
                      <span className="text-sm">Tarihsiz başvuru duyurularını taslak ekle</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Recheck sayısı (silinen duyuru, 1–10)</label>
                      <Input
                        type="number"
                        min={1}
                        max={10}
                        value={config.sync_options?.recheck_max_count ?? 1}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            sync_options: { ...(c.sync_options ?? {}), recheck_max_count: Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)) },
                          }))
                        }
                        className="w-20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Fetch timeout (ms, 5000–60000)</label>
                      <Input
                        type="number"
                        min={5000}
                        max={60000}
                        step={1000}
                        value={config.sync_options?.fetch_timeout_ms ?? 30000}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            sync_options: { ...(c.sync_options ?? {}), fetch_timeout_ms: Math.max(5000, Math.min(60000, parseInt(e.target.value, 10) || 30000)) },
                          }))
                        }
                        className="w-28"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Çalıştırma başına max yeni duyuru (0 = sınırsız)</label>
                      <Input
                        type="number"
                        min={0}
                        max={500}
                        value={config.sync_options?.max_new_per_sync ?? 0}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            sync_options: { ...(c.sync_options ?? {}), max_new_per_sync: Math.max(0, Math.min(500, parseInt(e.target.value, 10) || 0)) },
                          }))
                        }
                        className="w-24"
                      />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-1 text-sm">
                  <p className="font-medium">GPT ne yapar?</p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                    <li>Başvuru duyurusu olmayan haberleri atlar (örn. &quot;Ücretler Zamlandı&quot;, &quot;Uyarılar&quot;)</li>
                    <li>Tarih ve başvuru linkini metinden çıkarır</li>
                    <li>Agregatör kaynaklarda her haberi doğru kategoriye (MEB, ÖSYM, AÖF) yerleştirir</li>
                  </ul>
                </div>
                <Button onClick={saveConfig} disabled={configSaving}>
                  {configSaving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
                </Button>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Kaynak Modal */}
      <Dialog open={sourceModal.open} onOpenChange={(o) => !saving && setSourceModal({ ...sourceModal, open: o })}>
        <DialogContent>
          <h3 className="font-semibold">{sourceModal.edit ? 'Kaynak Düzenle' : 'Kaynak Ekle'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Key (benzersiz)</label>
              <Input
                value={srcForm.key}
                onChange={(e) => setSrcForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="exam_duty_guncelegitim"
                className="mt-1"
                disabled={!!sourceModal.edit}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Etiket</label>
              <Input
                value={srcForm.label}
                onChange={(e) => setSrcForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Güncel Eğitim"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kategori</label>
              <select
                value={srcForm.category_slug}
                onChange={(e) => setSrcForm((f) => ({ ...f, category_slug: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2"
              >
                {EXAM_DUTY_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Base URL (scrape için)</label>
              <Input
                value={srcForm.base_url}
                onChange={(e) => setSrcForm((f) => ({ ...f, base_url: e.target.value }))}
                placeholder="https://www.guncelegitim.com"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">RSS URL (opsiyonel)</label>
              <Input
                value={srcForm.rss_url}
                onChange={(e) => setSrcForm((f) => ({ ...f, rss_url: e.target.value }))}
                placeholder="https://.../rss.xml"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Scrape Config (opsiyonel, JSON)</label>
              <textarea
                value={srcForm.scrape_config}
                onChange={(e) => setSrcForm((f) => ({ ...f, scrape_config: e.target.value }))}
                placeholder='{"list_url":"/path/","container_selector":"#headline","item_selector":"a[href*=\"/haber/\"]"}'
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono min-h-[80px]"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-0.5">list_url, container_selector (opsiyonel), item_selector, link_selector, title_selector</p>
            </div>
            <div>
              <label className="text-sm font-medium">Title Keywords (virgülle ayır)</label>
              <Input
                value={srcForm.title_keywords}
                onChange={(e) => setSrcForm((f) => ({ ...f, title_keywords: e.target.value }))}
                placeholder="sınav,görev,gözetmen,başvuru"
                className="mt-1"
              />
            </div>
            {srcForm.scrape_config.trim() && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm font-medium">Agregatör kaynak seçenekleri</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srcForm.detect_category_per_item}
                    onChange={(e) => setSrcForm((f) => ({ ...f, detect_category_per_item: e.target.checked }))}
                  />
                  <span className="text-sm">Her haberi kategorilere ayır (ÖSYM, MEB, AÖF vb. başlıktan)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={srcForm.filter_non_application}
                    onChange={(e) => setSrcForm((f) => ({ ...f, filter_non_application: e.target.checked }))}
                  />
                  <span className="text-sm">Başvuru olmayan haberleri filtrele (ücret, uyarı vb.)</span>
                </label>
                <p className="text-xs text-muted-foreground">Güncel Eğitim gibi tüm sınav haberlerini toplayan siteler için işaretleyin.</p>
              </div>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={srcForm.is_active}
                onChange={(e) => setSrcForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <span className="text-sm">Aktif</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setSourceModal({ open: false })} disabled={saving}>
              İptal
            </Button>
            <Button onClick={saveSource} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
