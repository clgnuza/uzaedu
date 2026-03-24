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
} from 'lucide-react';
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (tab === 'icerikler' && token) {
      fetchItems();
    }
  }, [tab, token, itemsPage, fetchItems]);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.push('/haberler')} className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Geri
        </button>
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <Settings className="h-7 w-7" />
          Haberler Ayarları
        </h1>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <Link
                key={t.id}
                href={`/haberler/ayarlar?tab=${t.id}`}
                className={cn(
                  'flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-3 space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <Globe className="size-4 shrink-0" />
            <span>
              Yayın SEO:{' '}
              <Link href="/web-ayarlar?tab=seo" className="font-medium text-primary hover:underline">
                Web Ayarları
              </Link>
            </span>
          </p>
          <p className="flex items-center gap-2 pl-6 sm:pl-0">
            <LayoutTemplate className="size-4 shrink-0 text-muted-foreground/80" />
            <span>
              Kamu site / footer:{' '}
              <Link href="/web-ayarlar?tab=site" className="font-medium text-primary hover:underline">
                Site sekmesi
              </Link>
            </span>
          </p>
        </div>
      </div>

      {loading && tab !== 'icerikler' ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {tab === 'kanallar' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Kanallar</CardTitle>
                  <p className="text-sm text-muted-foreground">MEB Duyuruları, Yarışmalar, Eğitim Duyuruları vb.</p>
                </div>
                <Button onClick={() => openChannelModal()} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Kanal Ekle
                </Button>
              </CardHeader>
              <CardContent>
                {channels.length === 0 ? (
                  <EmptyState
                    icon={<Newspaper className="size-10" />}
                    title="Kanal yok"
                    description="İlk kurulum için: Docker başlatın (docker start ogretmenpro-db), ardından backend dizininde npm run seed-content çalıştırın. Veya yukarıdaki Kanal Ekle ile manuel ekleyebilirsiniz."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 font-medium">Etiket</th>
                          <th className="text-left py-2 font-medium">Key</th>
                          <th className="text-left py-2 font-medium">Sıra</th>
                          <th className="text-left py-2 font-medium">Kaynak</th>
                          <th className="text-right py-2 font-medium">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {channels.map((ch) => (
                          <tr key={ch.id} className="border-b border-border">
                            <td className="py-2">{ch.label}</td>
                            <td className="py-2 text-muted-foreground">{ch.key}</td>
                            <td className="py-2">{ch.sortOrder}</td>
                            <td className="py-2">{ch.sources?.length ?? 0}</td>
                            <td className="py-2 text-right">
                              <button onClick={() => openChannelModal(ch)} className="text-primary hover:underline inline-flex items-center gap-1">
                                <Pencil className="h-3 w-3" />
                                Düzenle
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'kaynaklar' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Kaynaklar</CardTitle>
                  <p className="text-sm text-muted-foreground">Personel GM, TEGM, OGM, YEĞİTEK vb.</p>
                </div>
                <Button onClick={() => openSourceModal()} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Kaynak Ekle
                </Button>
              </CardHeader>
              <CardContent>
                {sources.length === 0 ? (
                  <EmptyState icon={<Link2 className="size-10" />} title="Kaynak yok" description="Kaynak eklemek için yukarıdaki butonu kullanın." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left py-2 font-medium">Etiket</th>
                          <th className="text-left py-2 font-medium">Key</th>
                          <th className="text-left py-2 font-medium">URL</th>
                          <th className="text-left py-2 font-medium">Tip</th>
                          <th className="text-left py-2 font-medium">Son sync</th>
                          <th className="text-right py-2 font-medium">İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sources.map((s) => {
                          const hasRss = !!s.rssUrl?.trim();
                          const hasScrape = !!(s.baseUrl && s.scrapeConfig);
                          const tip = hasRss ? 'RSS' : hasScrape ? 'Scrape' : '-';
                          const lastSync = s.lastSyncedAt ? new Date(s.lastSyncedAt).toLocaleString('tr-TR') : '-';
                          return (
                          <tr key={s.id} className="border-b border-border">
                            <td className="py-2">{s.label}</td>
                            <td className="py-2 text-muted-foreground">{s.key}</td>
                            <td className="py-2 truncate max-w-[160px]" title={s.baseUrl ?? undefined}>{s.baseUrl ?? '-'}</td>
                            <td className="py-2 text-muted-foreground">{tip}</td>
                            <td className="py-2 text-muted-foreground text-xs">{lastSync}</td>
                            <td className="py-2 text-right">
                              <button onClick={() => openSourceModal(s)} className="text-primary hover:underline inline-flex items-center gap-1">
                                <Pencil className="h-3 w-3" />
                                Düzenle
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

          {tab === 'icerikler' && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">İçerikler</CardTitle>
                  <p className="text-sm text-muted-foreground">Manuel eklenen veya sync ile gelen içerikler.</p>
                </div>
                <Button onClick={openItemModal} size="sm" disabled={sources.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  İçerik Ekle
                </Button>
              </CardHeader>
              <CardContent>
                {sources.length === 0 ? (
                  <EmptyState icon={<FileText className="size-10" />} title="Önce kaynak ekleyin" description="İçerik eklemek için önce bir kaynak oluşturmalısınız." />
                ) : loading ? (
                  <div className="flex justify-center py-8">
                    <LoadingSpinner />
                  </div>
                ) : items.length === 0 ? (
                  <EmptyState icon={<FileText className="size-10" />} title="İçerik yok" description="Manuel içerik eklemek için yukarıdaki butonu kullanın veya seed script çalıştırın." />
                ) : (
                  <>
                    <div className="space-y-2">
                      {items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between py-2 border-b border-border">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{it.title}</p>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1">
                              {it.source_label && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border/60">
                                  <Tag className="h-3 w-3" />
                                  {it.source_label}
                                </span>
                              )}
                              <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                                {CONTENT_TYPES.find((c) => c.value === it.content_type)?.label ?? it.content_type}
                              </span>
                            </div>
                          </div>
                          <a href={it.source_url} target="_blank" rel="noopener noreferrer" className="text-primary text-sm hover:underline shrink-0 ml-2">
                            Link
                          </a>
                        </div>
                      ))}
                    </div>
                    {itemsTotal > 20 && (
                      <div className="flex justify-center gap-2 pt-4">
                        <Button variant="outline" size="sm" disabled={itemsPage <= 1} onClick={() => setItemsPage((p) => p - 1)}>
                          Önceki
                        </Button>
                        <span className="px-3 py-1 text-sm text-muted-foreground">
                          {itemsPage} / {Math.ceil(itemsTotal / 20)}
                        </span>
                        <Button variant="outline" size="sm" disabled={itemsPage >= Math.ceil(itemsTotal / 20)} onClick={() => setItemsPage((p) => p + 1)}>
                          Sonraki
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 'sync' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Senkronizasyon Kontrol</CardTitle>
                <p className="text-sm text-muted-foreground">
                  RSS URL veya base_url + scrape_config tanımlı kaynaklardan otomatik içerik çekilir.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                  <Button onClick={handleSync} disabled={syncing}>
                    <RefreshCw className={cn('h-4 w-4 mr-2', syncing && 'animate-spin')} />
                    {syncing ? 'Senkronize ediliyor...' : 'Şimdi Senkronize Et'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearPlaceholders}
                    disabled={clearingPlaceholders}
                    title="Logo ve mansetresim gibi genel görselleri kaldırır; yalnızca haber içeriğine ait görseller kalır"
                  >
                    <ImageOff className={cn('h-4 w-4 mr-2', clearingPlaceholders && 'animate-pulse')} />
                    {clearingPlaceholders ? 'Temizleniyor...' : 'Placeholder Görselleri Temizle'}
                  </Button>
                  {sources.filter((s) => s.rssUrl || (s.baseUrl && s.scrapeConfig)).length > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {sources.filter((s) => s.rssUrl || (s.baseUrl && s.scrapeConfig)).length} kaynak sync edilebilir
                    </span>
                  )}
                </div>

                {/* Kaynak durumu */}
                <div>
                  <h4 className="text-sm font-medium mb-2">Kaynaklar (son sync)</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="text-left py-2 px-3 font-medium">Kaynak</th>
                          <th className="text-left py-2 px-3 font-medium">Tip</th>
                          <th className="text-left py-2 px-3 font-medium">Son sync</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sources.map((s) => {
                          const hasRss = !!s.rssUrl?.trim();
                          const hasScrape = !!(s.baseUrl && s.scrapeConfig);
                          const syncable = hasRss || hasScrape;
                          const tip = hasRss ? 'RSS' : hasScrape ? 'Scrape' : '-';
                          const lastSync = s.lastSyncedAt
                            ? new Date(s.lastSyncedAt).toLocaleString('tr-TR')
                            : 'Hiç';
                          return (
                            <tr key={s.id} className="border-b border-border last:border-0">
                              <td className="py-2 px-3">{s.label}</td>
                              <td className="py-2 px-3">
                                <span className={syncable ? 'text-primary' : 'text-muted-foreground'}>{tip}</span>
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">{lastSync}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Son sync sonucu */}
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
                          {syncResult.results.map((r) => (
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
                      Toplam {syncResult.total_created} yeni içerik eklendi.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
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
