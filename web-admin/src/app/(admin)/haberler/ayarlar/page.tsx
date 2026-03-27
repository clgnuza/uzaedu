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
  Newspaper,
  ArrowLeft,
  RefreshCw,
  Plus,
  Link2,
  Settings,
  Pencil,
  FileText,
  Tag,
  ImageOff,
  Globe,
  LayoutTemplate,
  Clock,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Channel = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  sources?: { id: string; key: string; label: string }[];
};
type Source = {
  id: string;
  key: string;
  label: string;
  baseUrl?: string | null;
  rssUrl?: string | null;
  scrapeConfig?: Record<string, unknown> | null;
  syncIntervalMinutes?: number;
  isActive?: boolean;
  lastSyncedAt?: string | null;
};
type SyncSourceResult = {
  source_key: string;
  source_label: string;
  created: number;
  skipped: number;
  error?: string;
};
type SyncResult = {
  ok: boolean;
  message: string;
  results: SyncSourceResult[];
  total_created: number;
};
type SyncSchedulePayload = {
  schedule: { enabled: boolean; interval_minutes: number };
  status: {
    last_run_at: string | null;
    last_ok: boolean | null;
    last_message: string | null;
    last_total_created: number;
    last_trigger: 'manual' | 'cron' | null;
    last_source_errors: { source_key: string; source_label: string; error: string }[];
  };
};

const SYNC_INTERVAL_OPTIONS: { value: string; label: string }[] = [
  { value: '15', label: '15 dakika' },
  { value: '30', label: '30 dakika' },
  { value: '60', label: '1 saat' },
  { value: '120', label: '2 saat' },
  { value: '180', label: '3 saat' },
  { value: '360', label: '6 saat' },
  { value: '720', label: '12 saat' },
  { value: '1440', label: '24 saat' },
  { value: '2880', label: '48 saat' },
  { value: '10080', label: '7 gün' },
];
type ContentItem = {
  id: string;
  title: string;
  summary: string | null;
  source_url: string;
  source_key: string;
  source_label: string;
  content_type: string;
  published_at: string | null;
  is_active: boolean;
};
const CONTENT_TYPES = [
  { value: 'announcement', label: 'Duyuru' },
  { value: 'news', label: 'Haber' },
  { value: 'competition', label: 'Yarışma' },
  { value: 'exam', label: 'Sınav' },
  { value: 'project', label: 'Proje' },
  { value: 'event', label: 'Etkinlik' },
  { value: 'document', label: 'Belge' },
];

const TABS = [
  { id: 'kanallar', label: 'Kanallar', icon: Newspaper },
  { id: 'kaynaklar', label: 'Kaynaklar', icon: Link2 },
  { id: 'icerikler', label: 'İçerikler', icon: FileText },
  { id: 'sync', label: 'Senkronizasyon', icon: RefreshCw },
] as const;

export default function HaberlerAyarlarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [clearingPlaceholders, setClearingPlaceholders] = useState(false);
  const [itemsPage, setItemsPage] = useState(1);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncSchedulePayload, setSyncSchedulePayload] = useState<SyncSchedulePayload | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoIntervalMin, setAutoIntervalMin] = useState('360');

  const rawTab = searchParams.get('tab');
  const tab = (TABS.some((t) => t.id === rawTab) ? rawTab : 'kanallar') as (typeof TABS)[number]['id'];

  const [channelModal, setChannelModal] = useState<{ open: boolean; edit?: Channel }>({ open: false });
  const [sourceModal, setSourceModal] = useState<{ open: boolean; edit?: Source }>({ open: false });
  const [itemModal, setItemModal] = useState<{ open: boolean }>({ open: false });
  const [saving, setSaving] = useState(false);

  const [chForm, setChForm] = useState({ key: '', label: '', sort_order: 0, is_active: true, source_ids: [] as string[] });
  const [srcForm, setSrcForm] = useState({
    key: '',
    label: '',
    base_url: '',
    rss_url: '',
    scrape_config: '',
    sync_interval_minutes: 120,
    is_active: true,
  });
  const [itemForm, setItemForm] = useState({
    source_id: '',
    title: '',
    summary: '',
    source_url: '',
    content_type: 'announcement',
    is_active: true,
  });

  const isAdmin = me?.role === 'superadmin';

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/403');
      return;
    }
  }, [isAdmin, router]);

  useEffect(() => {
    if (searchParams.get('tab') === 'seo') {
      router.replace('/web-ayarlar?tab=seo');
    }
  }, [searchParams, router]);

  const fetchChannels = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch<Channel[]>('/content/admin/channels', { token });
    setChannels(Array.isArray(data) ? data : []);
  }, [token]);

  const fetchSources = useCallback(async () => {
    if (!token) return;
    const data = await apiFetch<Source[]>('/content/admin/sources', { token });
    setSources(Array.isArray(data) ? data : []);
  }, [token]);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    const params = new URLSearchParams({ page: String(itemsPage), limit: '20' });
    const data = await apiFetch<{ total: number; items: ContentItem[] }>(`/content/admin/items?${params}`, { token });
    setItems(data?.items ?? []);
    setItemsTotal(data?.total ?? 0);
  }, [token, itemsPage]);

  const fetchData = useCallback(async () => {
    if (!token || !isAdmin) return;
    setLoading(true);
    try {
      await Promise.all([fetchChannels(), fetchSources()]);
    } catch {
      setChannels([]);
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, fetchChannels, fetchSources]);

  const fetchSyncSchedule = useCallback(async () => {
    if (!token || !isAdmin) return;
    setScheduleLoading(true);
    try {
      const data = await apiFetch<SyncSchedulePayload>('/content/admin/sync-schedule', { token });
      setSyncSchedulePayload(data);
      setAutoEnabled(data.schedule.enabled);
      setAutoIntervalMin(String(data.schedule.interval_minutes));
    } catch {
      setSyncSchedulePayload(null);
    } finally {
      setScheduleLoading(false);
    }
  }, [token, isAdmin]);

  const saveAutoSchedule = async () => {
    if (!token || !isAdmin) return;
    setScheduleSaving(true);
    try {
      const data = await apiFetch<SyncSchedulePayload>('/content/admin/sync-schedule', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          enabled: autoEnabled,
          interval_minutes: Number(autoIntervalMin),
        }),
      });
      setSyncSchedulePayload(data);
      setAutoEnabled(data.schedule.enabled);
      setAutoIntervalMin(String(data.schedule.interval_minutes));
      toast.success('Zamanlama kaydedildi.');
    } catch {
      toast.error('Kayıt başarısız.');
    } finally {
      setScheduleSaving(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tab === 'icerikler' && token) {
      fetchItems();
    }
  }, [tab, token, itemsPage, fetchItems]);

  useEffect(() => {
    if (tab === 'sync' && token && isAdmin) {
      fetchSyncSchedule();
    }
  }, [tab, token, isAdmin, fetchSyncSchedule]);

  const handleSync = async () => {
    if (!token || !isAdmin) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await apiFetch<SyncResult>('/content/admin/sync', { method: 'POST', token });
      setSyncResult(res);
      if (res.ok) {
        toast.success(res?.message ?? 'Senkronizasyon tamamlandı.');
      } else {
        toast.warning(res?.message ?? 'Bazı kaynaklarda hata oluştu.');
      }
      fetchSources();
      fetchItems();
      fetchSyncSchedule();
    } catch (e) {
      toast.error('Senkronizasyon hatası.');
    } finally {
      setSyncing(false);
    }
  };

  const handleClearPlaceholders = async () => {
    if (!token || !isAdmin) return;
    setClearingPlaceholders(true);
    try {
      const res = await apiFetch<{ cleared: number }>('/content/admin/clear-placeholder-images', {
        method: 'POST',
        token,
      });
      toast.success(`${res?.cleared ?? 0} placeholder görsel temizlendi.`);
      fetchItems();
    } catch {
      toast.error('Placeholder temizleme hatası.');
    } finally {
      setClearingPlaceholders(false);
    }
  };

  const openChannelModal = (edit?: Channel) => {
    if (edit) {
      setChForm({
        key: edit.key,
        label: edit.label,
        sort_order: edit.sortOrder ?? 0,
        is_active: edit.isActive ?? true,
        source_ids: (edit.sources ?? []).map((s) => s.id),
      });
    } else {
      setChForm({ key: '', label: '', sort_order: 0, is_active: true, source_ids: [] });
    }
    setChannelModal({ open: true, edit });
  };

  const saveChannel = async () => {
    if (!token) return;
    if (!chForm.key.trim() || !chForm.label.trim()) {
      toast.error('Key ve Label zorunludur.');
      return;
    }
    setSaving(true);
    try {
      if (channelModal.edit) {
        await apiFetch(`/content/admin/channels/${channelModal.edit.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ key: chForm.key, label: chForm.label, sort_order: chForm.sort_order, is_active: chForm.is_active, source_ids: chForm.source_ids }),
        });
        toast.success('Kanal güncellendi.');
      } else {
        await apiFetch('/content/admin/channels', {
          method: 'POST',
          token,
          body: JSON.stringify({ key: chForm.key, label: chForm.label, sort_order: chForm.sort_order, is_active: chForm.is_active, source_ids: chForm.source_ids }),
        });
        toast.success('Kanal eklendi.');
      }
      setChannelModal({ open: false });
      fetchChannels();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setSaving(false);
    }
  };

  const openSourceModal = (edit?: Source) => {
    if (edit) {
      setSrcForm({
        key: edit.key,
        label: edit.label,
        base_url: edit.baseUrl ?? '',
        rss_url: edit.rssUrl ?? '',
        scrape_config: edit.scrapeConfig ? JSON.stringify(edit.scrapeConfig, null, 2) : '',
        sync_interval_minutes: edit.syncIntervalMinutes ?? 120,
        is_active: edit.isActive ?? true,
      });
    } else {
      setSrcForm({ key: '', label: '', base_url: '', rss_url: '', scrape_config: '', sync_interval_minutes: 120, is_active: true });
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
      } catch {
        toast.error('Scrape Config geçerli JSON olmalı.');
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        key: srcForm.key,
        label: srcForm.label,
        base_url: srcForm.base_url || undefined,
        rss_url: srcForm.rss_url || undefined,
        scrape_config: scrapeConfigObj,
        sync_interval_minutes: srcForm.sync_interval_minutes,
        is_active: srcForm.is_active,
      };
      if (sourceModal.edit) {
        await apiFetch(`/content/admin/sources/${sourceModal.edit.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        });
        toast.success('Kaynak güncellendi.');
      } else {
        await apiFetch('/content/admin/sources', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
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

  const openItemModal = () => {
    setItemForm({
      source_id: sources[0]?.id ?? '',
      title: '',
      summary: '',
      source_url: '',
      content_type: 'announcement',
      is_active: true,
    });
    setItemModal({ open: true });
  };

  const saveItem = async () => {
    if (!token) return;
    if (!itemForm.source_id || !itemForm.title.trim() || !itemForm.source_url.trim()) {
      toast.error('Kaynak, başlık ve link zorunludur.');
      return;
    }
    if (!itemForm.source_url.startsWith('http')) {
      toast.error('Geçerli bir URL girin.');
      return;
    }
    setSaving(true);
    try {
      await apiFetch('/content/admin/items', {
        method: 'POST',
        token,
        body: JSON.stringify({
          source_id: itemForm.source_id,
          title: itemForm.title.trim(),
          summary: itemForm.summary.trim() || undefined,
          source_url: itemForm.source_url.trim(),
          content_type: itemForm.content_type,
          is_active: itemForm.is_active,
        }),
      });
      toast.success('İçerik eklendi.');
      setItemModal({ open: false });
      fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAdmin) return null;

  const syncableCount = sources.filter((s) => s.rssUrl || (s.baseUrl && s.scrapeConfig)).length;

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/haberler')}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Haberler Ayarları</h1>
          <p className="text-sm text-muted-foreground">Kanallar, kaynaklar ve senkronizasyon yönetimi</p>
        </div>
      </div>

      {/* Segmented tab nav */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="px-3 pt-3">
          <div className="flex gap-0.5 overflow-x-auto rounded-xl bg-muted p-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => {
              const Icon = t.icon;
              const isActive = tab === t.id;
              return (
                <Link
                  key={t.id}
                  href={`/haberler/ayarlar?tab=${t.id}`}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {t.label}
                </Link>
              );
            })}
          </div>
        </div>
        {/* Bağlantı kısayolları */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-3 pt-2 text-xs text-muted-foreground">
          <Link href="/web-ayarlar?tab=seo" className="inline-flex items-center gap-1 hover:text-foreground">
            <Globe className="size-3" /> Yayın SEO → Web Ayarları
          </Link>
          <Link href="/web-ayarlar?tab=site" className="inline-flex items-center gap-1 hover:text-foreground">
            <LayoutTemplate className="size-3" /> Kamu site / footer → Site sekmesi
          </Link>
        </div>
      </div>

      {loading && tab !== 'icerikler' ? (
        <div className="flex justify-center py-12"><LoadingSpinner /></div>
      ) : (
        <>
          {/* ── KANALLAR ── */}
          {tab === 'kanallar' && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <CardTitle className="text-base">Kanallar</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">MEB Duyuruları, Yarışmalar, Eğitim Duyuruları vb.</p>
                </div>
                <Button onClick={() => openChannelModal()} size="sm" className="shrink-0">
                  <Plus className="mr-1.5 h-4 w-4" /> Kanal Ekle
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {channels.length === 0 ? (
                  <EmptyState
                    icon={<Newspaper className="size-10" />}
                    title="Kanal yok"
                    description="İlk kurulum için backend dizininde npm run seed-content çalıştırın veya Kanal Ekle ile manuel ekleyin."
                  />
                ) : (
                  <div className="divide-y divide-border">
                    {channels.map((ch) => (
                      <div key={ch.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={cn('h-2 w-2 shrink-0 rounded-full', ch.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-sm">{ch.label}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                              <span className="font-mono">{ch.key}</span>
                              <span>Sıra: {ch.sortOrder}</span>
                              <span>{ch.sources?.length ?? 0} kaynak</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => openChannelModal(ch)}
                          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="h-3 w-3" /> Düzenle
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── KAYNAKLAR ── */}
          {tab === 'kaynaklar' && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <CardTitle className="text-base">Kaynaklar</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">Personel GM, TEGM, OGM, YEĞİTEK vb. RSS / Scrape kaynakları</p>
                </div>
                <Button onClick={() => openSourceModal()} size="sm" className="shrink-0">
                  <Plus className="mr-1.5 h-4 w-4" /> Kaynak Ekle
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {sources.length === 0 ? (
                  <EmptyState icon={<Link2 className="size-10" />} title="Kaynak yok" description="Kaynak eklemek için Kaynak Ekle butonunu kullanın." />
                ) : (
                  <div className="divide-y divide-border">
                    {sources.map((s) => {
                      const hasRss = !!s.rssUrl?.trim();
                      const hasScrape = !!(s.baseUrl && s.scrapeConfig);
                      const tip = hasRss ? 'RSS' : hasScrape ? 'Scrape' : null;
                      const lastSync = s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString('tr-TR') : 'Hiç';
                      return (
                        <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={cn('h-2 w-2 shrink-0 rounded-full', s.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/40')} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="font-medium text-sm">{s.label}</p>
                                {tip && (
                                  <span className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                    tip === 'RSS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                                  )}>
                                    {tip}
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="font-mono">{s.key}</span>
                                {s.baseUrl && <span className="max-w-40 truncate">{s.baseUrl}</span>}
                                <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{lastSync}</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => openSourceModal(s)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3 w-3" /> Düzenle
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── İÇERİKLER ── */}
          {tab === 'icerikler' && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
                <div>
                  <CardTitle className="text-base">İçerikler</CardTitle>
                  <p className="mt-0.5 text-sm text-muted-foreground">Manuel eklenen veya sync ile gelen içerikler.</p>
                </div>
                <Button onClick={openItemModal} size="sm" disabled={sources.length === 0} className="shrink-0">
                  <Plus className="mr-1.5 h-4 w-4" /> İçerik Ekle
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {sources.length === 0 ? (
                  <EmptyState icon={<FileText className="size-10" />} title="Önce kaynak ekleyin" description="İçerik eklemek için önce bir kaynak oluşturmalısınız." />
                ) : loading ? (
                  <div className="flex justify-center py-8"><LoadingSpinner /></div>
                ) : items.length === 0 ? (
                  <EmptyState icon={<FileText className="size-10" />} title="İçerik yok" description="Manuel içerik eklemek için İçerik Ekle butonunu kullanın." />
                ) : (
                  <>
                    <div className="divide-y divide-border">
                      {items.map((it) => (
                        <div key={it.id} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{it.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {it.source_label && (
                                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  <Tag className="h-2.5 w-2.5" />{it.source_label}
                                </span>
                              )}
                              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                                {CONTENT_TYPES.find((c) => c.value === it.content_type)?.label ?? it.content_type}
                              </span>
                            </div>
                          </div>
                          <a href={it.source_url} target="_blank" rel="noopener noreferrer"
                            className="shrink-0 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            Aç ↗
                          </a>
                        </div>
                      ))}
                    </div>
                    {itemsTotal > 20 && (
                      <div className="flex items-center justify-center gap-2 border-t border-border pt-4">
                        <Button variant="outline" size="sm" disabled={itemsPage <= 1} onClick={() => setItemsPage((p) => p - 1)}>Önceki</Button>
                        <span className="text-sm text-muted-foreground">{itemsPage} / {Math.ceil(itemsTotal / 20)}</span>
                        <Button variant="outline" size="sm" disabled={itemsPage >= Math.ceil(itemsTotal / 20)} onClick={() => setItemsPage((p) => p + 1)}>Sonraki</Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── SYNC ── */}
          {tab === 'sync' && (
            <div className="space-y-5">
              {/* Kontrol */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <RefreshCw className="h-4 w-4" /> Senkronizasyon Kontrol
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">RSS veya Scrape yapılandırmalı kaynaklardan içerik çekilir.</p>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSync} disabled={syncing}>
                      <RefreshCw className={cn('mr-1.5 h-4 w-4', syncing && 'animate-spin')} />
                      {syncing ? 'Senkronize ediliyor…' : 'Şimdi Senkronize Et'}
                    </Button>
                    <Button variant="outline" onClick={handleClearPlaceholders} disabled={clearingPlaceholders}
                      title="Logo ve manşet resim gibi genel görselleri kaldırır">
                      <ImageOff className={cn('mr-1.5 h-4 w-4', clearingPlaceholders && 'animate-pulse')} />
                      {clearingPlaceholders ? 'Temizleniyor…' : 'Placeholder Temizle'}
                    </Button>
                    {syncableCount > 0 && (
                      <span className="flex items-center text-sm text-muted-foreground">
                        {syncableCount} kaynak sync edilebilir
                      </span>
                    )}
                  </div>

                  {/* Kaynak durum listesi */}
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Kaynak durumları</p>
                    <div className="divide-y divide-border rounded-xl border border-border">
                      {sources.map((s) => {
                        const hasRss = !!s.rssUrl?.trim();
                        const hasScrape = !!(s.baseUrl && s.scrapeConfig);
                        const syncable = hasRss || hasScrape;
                        const tip = hasRss ? 'RSS' : hasScrape ? 'Scrape' : null;
                        const lastSync = s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString('tr-TR') : 'Hiç';
                        return (
                          <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={cn('h-1.5 w-1.5 shrink-0 rounded-full', syncable ? 'bg-emerald-500' : 'bg-muted-foreground/30')} />
                              <span className="truncate font-medium">{s.label}</span>
                              {tip && (
                                <span className={cn(
                                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                                  tip === 'RSS' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
                                )}>{tip}</span>
                              )}
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground">{lastSync}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Son sync sonucu */}
                  {syncResult && (
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Son Sync — toplam {syncResult.total_created} yeni içerik
                      </p>
                      <div className="divide-y divide-border rounded-xl border border-border">
                        {syncResult.results.map((r) => (
                          <div key={r.source_key} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                            <span className="min-w-0 truncate font-medium">{r.source_label}</span>
                            <div className="flex shrink-0 items-center gap-3 text-xs">
                              <span className="text-emerald-600">+{r.created}</span>
                              <span className="text-muted-foreground">skip {r.skipped}</span>
                              {r.error
                                ? <span className="max-w-32 truncate text-destructive" title={r.error}>{r.error}</span>
                                : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Zamanlama */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" /> Otomatik Zamanlama
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Backend her 5 dk kontrol eder; belirlenen aralık dolunca kaynaklar senkronize edilir.
                  </p>
                </CardHeader>
                <CardContent className="space-y-5 pt-0">
                  {scheduleLoading && !syncSchedulePayload ? (
                    <div className="flex justify-center py-6"><LoadingSpinner /></div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
                        <label className="flex cursor-pointer items-center gap-2.5">
                          <input
                            id="auto-sync-enabled"
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={autoEnabled}
                            onChange={(e) => setAutoEnabled(e.target.checked)}
                          />
                          <span className="text-sm font-medium">Otomatik senkronu etkinleştir</span>
                        </label>
                        <div className="space-y-1.5 sm:min-w-48">
                          <Label className="text-xs text-muted-foreground">Tekrar aralığı</Label>
                          <Select value={autoIntervalMin} onValueChange={setAutoIntervalMin}>
                            <SelectTrigger><SelectValue placeholder="Süre seçin" /></SelectTrigger>
                            <SelectContent>
                              {!SYNC_INTERVAL_OPTIONS.some((o) => o.value === autoIntervalMin) && (
                                <SelectItem value={autoIntervalMin}>{autoIntervalMin} dakika</SelectItem>
                              )}
                              {SYNC_INTERVAL_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button type="button" onClick={saveAutoSchedule} disabled={scheduleSaving || scheduleLoading}>
                          {scheduleSaving ? 'Kaydediliyor…' : 'Zamanlamayı Kaydet'}
                        </Button>
                      </div>

                      {syncSchedulePayload?.status && (
                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Son Çalışma</p>
                          <div className="grid gap-3 text-sm sm:grid-cols-2">
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-muted-foreground">Zaman</span>
                              <span className="font-medium">
                                {syncSchedulePayload.status.last_run_at
                                  ? new Date(syncSchedulePayload.status.last_run_at).toLocaleString('tr-TR')
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-muted-foreground">Tetikleyici</span>
                              <span className="font-medium">
                                {syncSchedulePayload.status.last_trigger === 'cron' ? 'Zamanlayıcı'
                                  : syncSchedulePayload.status.last_trigger === 'manual' ? 'Manuel'
                                  : '—'}
                              </span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-muted-foreground">Durum</span>
                              {syncSchedulePayload.status.last_ok === true && (
                                <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Tamam
                                </span>
                              )}
                              {syncSchedulePayload.status.last_ok === false && (
                                <span className="inline-flex items-center gap-1 font-medium text-destructive">
                                  <AlertTriangle className="h-3.5 w-3.5" /> Hata
                                </span>
                              )}
                              {syncSchedulePayload.status.last_ok == null && <span className="text-muted-foreground">Kayıt yok</span>}
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="mt-0.5 text-muted-foreground">Yeni içerik</span>
                              <span className="font-medium">{syncSchedulePayload.status.last_total_created ?? 0}</span>
                            </div>
                          </div>
                          {syncSchedulePayload.status.last_message && (
                            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground whitespace-pre-wrap">
                              {syncSchedulePayload.status.last_message}
                            </p>
                          )}
                          {syncSchedulePayload.status.last_source_errors.length > 0 && (
                            <div className="mt-3 border-t border-border pt-3">
                              <p className="mb-2 text-xs font-medium text-destructive">Kaynak hataları</p>
                              <div className="divide-y divide-border rounded-lg border border-destructive/20">
                                {syncSchedulePayload.status.last_source_errors.map((row) => (
                                  <div key={row.source_key} className="flex gap-3 px-3 py-2 text-xs">
                                    <span className="shrink-0 font-medium">{row.source_label || row.source_key}</span>
                                    <span className="min-w-0 text-destructive wrap-break-word">{row.error}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Kanal Modal */}
      <Dialog open={channelModal.open} onOpenChange={(o) => !saving && setChannelModal({ ...channelModal, open: o })}>
        <DialogContent>
          <h3 className="font-semibold">{channelModal.edit ? 'Kanal Düzenle' : 'Kanal Ekle'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Key</label>
              <Input
                value={chForm.key}
                onChange={(e) => setChForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="meb_duyurulari"
                className="mt-1"
                disabled={!!channelModal.edit}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Etiket</label>
              <Input value={chForm.label} onChange={(e) => setChForm((f) => ({ ...f, label: e.target.value }))} placeholder="MEB Duyuruları" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Sıra</label>
              <Input
                type="number"
                value={chForm.sort_order}
                onChange={(e) => setChForm((f) => ({ ...f, sort_order: parseInt(e.target.value, 10) || 0 }))}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kaynaklar</label>
              <div className="mt-1 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                {sources.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={chForm.source_ids.includes(s.id)}
                      onChange={(e) =>
                        setChForm((f) => ({
                          ...f,
                          source_ids: e.target.checked ? [...f.source_ids, s.id] : f.source_ids.filter((id) => id !== s.id),
                        }))
                      }
                    />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={chForm.is_active} onChange={(e) => setChForm((f) => ({ ...f, is_active: e.target.checked }))} />
              <span className="text-sm">Aktif</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setChannelModal({ open: false })} disabled={saving}>
              İptal
            </Button>
            <Button onClick={saveChannel} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kaynak Modal */}
      <Dialog open={sourceModal.open} onOpenChange={(o) => !saving && setSourceModal({ ...sourceModal, open: o })}>
        <DialogContent>
          <h3 className="font-semibold">{sourceModal.edit ? 'Kaynak Düzenle' : 'Kaynak Ekle'}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Key</label>
              <Input
                value={srcForm.key}
                onChange={(e) => setSrcForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="personel_gm"
                className="mt-1"
                disabled={!!sourceModal.edit}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Etiket</label>
              <Input value={srcForm.label} onChange={(e) => setSrcForm((f) => ({ ...f, label: e.target.value }))} placeholder="Personel GM" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Base URL</label>
              <Input value={srcForm.base_url} onChange={(e) => setSrcForm((f) => ({ ...f, base_url: e.target.value }))} placeholder="https://personel.meb.gov.tr" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">RSS URL (opsiyonel)</label>
              <Input value={srcForm.rss_url} onChange={(e) => setSrcForm((f) => ({ ...f, rss_url: e.target.value }))} placeholder="https://.../rss.xml" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-0.5">RSS veya Atom feed. Tanımlıysa otomatik sync yapılır.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Scrape Config (opsiyonel, JSON)</label>
              <textarea
                value={srcForm.scrape_config}
                onChange={(e) => setSrcForm((f) => ({ ...f, scrape_config: e.target.value }))}
                placeholder='{"list_urls":[{"path":"/www/haberler/kategori/1","content_type":"news"}]}'
                className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono min-h-[80px]"
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-0.5">Base URL + list_urls ile scraping. Örn: list_urls, item_selector.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Sync aralığı (dk)</label>
              <Input
                type="number"
                value={srcForm.sync_interval_minutes}
                onChange={(e) => setSrcForm((f) => ({ ...f, sync_interval_minutes: parseInt(e.target.value, 10) || 120 }))}
                className="mt-1"
              />
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={srcForm.is_active} onChange={(e) => setSrcForm((f) => ({ ...f, is_active: e.target.checked }))} />
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

      {/* İçerik Modal */}
      <Dialog open={itemModal.open} onOpenChange={(o) => !saving && setItemModal({ open: o })}>
        <DialogContent>
          <h3 className="font-semibold">İçerik Ekle</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Kaynak</label>
              <select
                value={itemForm.source_id}
                onChange={(e) => setItemForm((f) => ({ ...f, source_id: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2"
              >
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Başlık</label>
              <Input value={itemForm.title} onChange={(e) => setItemForm((f) => ({ ...f, title: e.target.value }))} placeholder="Duyuru başlığı" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Özet (opsiyonel)</label>
              <Input value={itemForm.summary} onChange={(e) => setItemForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Kısa özet" className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Kaynak URL</label>
              <Input value={itemForm.source_url} onChange={(e) => setItemForm((f) => ({ ...f, source_url: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Tür</label>
              <select
                value={itemForm.content_type}
                onChange={(e) => setItemForm((f) => ({ ...f, content_type: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-input bg-background px-4 py-2"
              >
                {CONTENT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={itemForm.is_active} onChange={(e) => setItemForm((f) => ({ ...f, is_active: e.target.checked }))} />
              <span className="text-sm">Aktif</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setItemModal({ open: false })} disabled={saving}>
              İptal
            </Button>
            <Button onClick={saveItem} disabled={saving}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
