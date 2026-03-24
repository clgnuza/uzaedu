'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { Newspaper, ExternalLink, RefreshCw, Settings, Filter, Tag, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

type Channel = { id: string; key: string; label: string; sortOrder: number; itemCount?: number };
type ContentItem = {
  id: string;
  title: string;
  summary: string | null;
  source_url: string;
  image_url?: string | null;
  source_key?: string;
  source_label?: string;
  content_type: string;
  published_at: string | null;
};

const CONTENT_TYPE_OPTIONS = [
  { value: '', label: 'Tüm Türler' },
  { value: 'announcement', label: 'Duyuru' },
  { value: 'news', label: 'Haber' },
  { value: 'competition', label: 'Yarışma' },
  { value: 'exam', label: 'Sınav' },
  { value: 'project', label: 'Proje' },
  { value: 'event', label: 'Etkinlik' },
  { value: 'document', label: 'Belge' },
];

const CONTENT_TYPE_LABELS: Record<string, string> = {
  announcement: 'Duyuru',
  news: 'Haber',
  competition: 'Yarışma',
  exam: 'Sınav',
  project: 'Proje',
  event: 'Etkinlik',
  document: 'Belge',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** HTML etiketlerini temizle (summary gösterim için) */
function stripHtml(html: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

export default function HaberlerPage() {
  const { token, me } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
  const [selectedSourceLabel, setSelectedSourceLabel] = useState<string>('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 36;
  const isAdmin = me?.role === 'superadmin';

  const fetchChannels = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetch<Channel[]>('/content/channels', { token });
      setChannels(Array.isArray(data) ? data : []);
      if (!selectedChannel && (Array.isArray(data) ? data : []).length > 0) {
        setSelectedChannel('');
      }
    } catch {
      setChannels([]);
    }
  }, [token]);

  const fetchItems = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (selectedChannel) params.set('channel_key', selectedChannel);
      if (selectedSourceKey) params.set('source_key', selectedSourceKey);
      if (contentTypeFilter) params.set('content_type', contentTypeFilter);
      const data = await apiFetch<{ total: number; items: ContentItem[] }>(
        `/content/items?${params}`,
        { token },
      );
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch (e) {
      setItems([]);
      setTotal(0);
      const msg = e instanceof Error ? e.message : 'İçerik yüklenemedi';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [token, selectedChannel, selectedSourceKey, contentTypeFilter, page]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleChannelChange = (key: string) => {
    setSelectedChannel(key);
    setPage(1);
  };

  const handleContentTypeChange = (value: string) => {
    setContentTypeFilter(value);
    setPage(1);
  };

  const handleSourceClick = (e: React.MouseEvent, sourceKey: string, sourceLabel: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectedSourceKey === sourceKey) {
      setSelectedSourceKey('');
      setSelectedSourceLabel('');
    } else {
      setSelectedSourceKey(sourceKey);
      setSelectedSourceLabel(sourceLabel);
    }
    setPage(1);
  };

  const clearSourceFilter = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSourceKey('');
    setSelectedSourceLabel('');
    setPage(1);
  };

  const handleSync = async () => {
    if (!token || !isAdmin) return;
    try {
      const res = await apiFetch<{ ok: boolean; message: string }>('/content/admin/sync', {
        method: 'POST',
        token,
      });
      toast.success(res?.message ?? 'Senkronizasyon tamamlandı.');
      fetchChannels();
      fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Senkronizasyon başarısız.');
    }
  };


  return (
    <div className="space-y-6">
      {/* Sayfa başlığı ve admin toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <Newspaper className="h-7 w-7 text-primary" />
            Haberler
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            MEB ve il millî eğitim kaynaklarından haber ve duyurular
          </p>
          {isAdmin && channels.length > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {channels.length} kanal
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/haberler/yayin"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-sm font-medium transition-colors hover:bg-amber-500/20"
          >
            <Sparkles className="h-4 w-4" />
            Yayın
          </a>
          {isAdmin && (
            <>
              <button
                onClick={handleSync}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Senkronize Et
              </button>
              <a
                href="/haberler/ayarlar"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
              >
                <Settings className="h-4 w-4" />
                Ayarlar
              </a>
            </>
          )}
        </div>
      </div>

      {/* Kanallar ve filtreler – kart içinde gruplu */}
      <Card>
        <CardContent className="p-0">
          {/* Kanallar – tab tarzı */}
          {channels.length > 0 && (
            <div className="px-4 pt-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Kanallar
              </p>
              <div className="flex flex-wrap border-b border-border -mb-px">
                <button
                  onClick={() => handleChannelChange('')}
                  className={cn(
                    'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                    !selectedChannel
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  Tümü
                </button>
                {channels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleChannelChange(ch.key)}
                    className={cn(
                      'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px inline-flex items-center gap-2',
                      selectedChannel === ch.key
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {ch.label}
                    {typeof ch.itemCount === 'number' && (
                      <span className="text-xs opacity-75">({ch.itemCount.toLocaleString('tr-TR')})</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filtreler */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-muted/30 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
              Filtreler
            </p>
            {selectedSourceKey && selectedSourceLabel && (
              <button
                onClick={clearSourceFilter}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25"
              >
                <Tag className="h-3.5 w-3.5" />
                {selectedSourceLabel}
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <select
                value={contentTypeFilter}
                onChange={(e) => handleContentTypeChange(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {CONTENT_TYPE_OPTIONS.map((o) => (
                  <option key={o.value || '_all'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Newspaper className="size-10" />}
              title="Henüz içerik yok"
              description={
                isAdmin
                  ? channels.length === 0
                    ? 'İlk kurulum için: Docker başlatın (docker start ogretmenpro-db), ardından backend dizininde npm run seed-content çalıştırın. Sonra Ayarlar sayfasından kanal/kaynak yönetebilirsiniz.'
                    : 'Ayarlardan manuel içerik ekleyebilir veya Senkronize Et ile RSS/scrape kaynaklarından veri çekebilirsiniz.'
                  : 'Bu kanalda henüz haber veya duyuru bulunmuyor.'
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {items.map((item) => (
            <Card
              key={item.id}
              className="overflow-hidden rounded-lg border transition-all hover:shadow-md hover:border-primary/20 group"
            >
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-row min-h-[72px]"
              >
                <div className="w-20 min-w-[80px] h-[72px] sm:h-20 bg-muted overflow-hidden shrink-0 relative">
                  {item.image_url ? (
                    <>
                      <img
                        src={item.image_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden';
                          e.currentTarget.nextElementSibling?.classList.remove('invisible');
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground/50 invisible" aria-hidden>
                        <Newspaper className="h-6 w-6" />
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                      <Newspaper className="h-6 w-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 p-3 min-w-0 flex flex-col justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary">
                        {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                      </span>
                      {item.source_label && item.source_key && (
                        <button
                          type="button"
                          onClick={(e) => handleSourceClick(e, item.source_key!, item.source_label!)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border transition-colors',
                            selectedSourceKey === item.source_key
                              ? 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25'
                              : 'bg-muted text-muted-foreground border-border/60 hover:bg-muted/80 hover:text-foreground',
                          )}
                        >
                          <Tag className="h-3 w-3 shrink-0" />
                          {item.source_label}
                        </button>
                      )}
                      {item.published_at && (
                        <span className="text-xs text-muted-foreground">· {formatDate(item.published_at)}</span>
                      )}
                    </div>
                    <h3 className="font-medium text-foreground text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    {item.summary && stripHtml(item.summary) && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                        {stripHtml(item.summary)}
                      </p>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <ExternalLink className="h-3 w-3" />
                      Kaynağa git
                    </span>
                  </div>
                </div>
              </a>
            </Card>
          ))}

          {/* Sayfalama */}
          {total > limit && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Önceki
              </Button>
              <span className="px-4 py-2 text-sm text-muted-foreground">
                {page} / {Math.ceil(total / limit)} · {total} kayıt
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / limit)}
              >
                Sonraki
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
