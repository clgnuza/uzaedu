'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import { Newspaper, ExternalLink, RefreshCw, Settings, Tag, X, Sparkles, Layers, ListFilter } from 'lucide-react';
import { toast } from 'sonner';
import { contentReadPath } from '@/lib/content-read-path';
import { normalizeMebIlImageUrl } from '@/lib/meb-image-url';

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

function dedupeContentItemsByUrl(items: ContentItem[]): ContentItem[] {
  const seen = new Set<string>();
  const out: ContentItem[] = [];
  for (const item of items) {
    const url = (item.source_url || '').trim().toLowerCase();
    const key = url || item.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function HaberNewsCard({
  item,
  variant,
  selectedSourceKey,
  onSourceClick,
}: {
  item: ContentItem;
  variant: 'featured' | 'compact';
  selectedSourceKey: string;
  onSourceClick: (e: React.MouseEvent, sourceKey: string, sourceLabel: string) => void;
}) {
  const isFeatured = variant === 'featured';
  return (
    <Card
      className={cn(
        'group overflow-hidden rounded-xl border-border/80 shadow-sm transition-all hover:border-primary/25 hover:shadow-md',
        isFeatured && 'ring-1 ring-border/40 lg:col-span-2',
      )}
    >
      <a
        href={item.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'flex min-h-[72px]',
          isFeatured ? 'flex-col sm:min-h-0 sm:flex-row' : 'flex-row',
        )}
      >
        <div
          className={cn(
            'relative shrink-0 overflow-hidden bg-muted',
            isFeatured
              ? 'aspect-16/10 w-full rounded-t-xl sm:aspect-auto sm:h-30 sm:w-44 sm:min-w-44 sm:rounded-l-xl sm:rounded-t-none'
              : 'h-[72px] w-20 min-w-[80px] sm:h-20',
          )}
        >
          {item.image_url ? (
            <>
              <img
                src={normalizeMebIlImageUrl(item.image_url) ?? item.image_url}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden';
                  e.currentTarget.nextElementSibling?.classList.remove('invisible');
                }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground/50 invisible"
                aria-hidden
              >
                <Newspaper className="h-6 w-6" />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/50">
              <Newspaper className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between p-3 sm:p-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
              </span>
              {item.source_label && item.source_key && (
                <button
                  type="button"
                  onClick={(e) => onSourceClick(e, item.source_key!, item.source_label!)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors',
                    selectedSourceKey === item.source_key
                      ? 'border-primary/40 bg-primary/15 text-primary hover:bg-primary/25'
                      : 'border-border/60 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground',
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
            <h3
              className={cn(
                'font-semibold leading-snug text-foreground transition-colors group-hover:text-primary',
                isFeatured ? 'line-clamp-3 text-base sm:text-lg' : 'line-clamp-2 text-sm',
              )}
            >
              {item.title}
            </h3>
            {item.summary && stripHtml(item.summary) && (
              <p
                className={cn(
                  'mt-1 text-muted-foreground',
                  isFeatured ? 'line-clamp-2 text-sm' : 'line-clamp-1 text-xs',
                )}
              >
                {stripHtml(item.summary)}
              </p>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1">
            <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
              <ExternalLink className="h-3 w-3" />
              Kaynağa git
            </span>
          </div>
        </div>
      </a>
    </Card>
  );
}

function HaberListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <Card className="col-span-full overflow-hidden rounded-xl border-border/80 shadow-sm lg:col-span-2">
        <div className="flex flex-col sm:flex-row">
          <Skeleton className="aspect-16/10 w-full shrink-0 rounded-t-xl sm:h-30 sm:w-44 sm:min-w-44 sm:rounded-l-xl sm:rounded-t-none" />
          <div className="flex flex-1 flex-col gap-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        </div>
      </Card>
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <div className="flex min-h-[72px] flex-row">
            <Skeleton className="h-[72px] w-20 shrink-0 sm:h-20" />
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function HaberlerPage() {
  const { token, me, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('haberler');
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
  const [selectedSourceLabel, setSelectedSourceLabel] = useState<string>('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const limit = 36;
  const isAdmin = me?.role === 'superadmin';
  const lastVisibleAt = useRef<number>(Date.now());

  const fetchChannels = useCallback(async () => {
    try {
      const data = await apiFetch<Channel[]>(contentReadPath('channels', token), { token });
      setChannels(Array.isArray(data) ? data : []);
    } catch {
      setChannels([]);
    }
  }, [token]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (selectedChannel) params.set('channel_key', selectedChannel);
      if (selectedSourceKey) params.set('source_key', selectedSourceKey);
      if (contentTypeFilter) params.set('content_type', contentTypeFilter);
      const data = await apiFetch<{ total: number; items: ContentItem[] }>(
        `${contentReadPath('items', token)}?${params}`,
        { token },
      );
      const raw = data?.items ?? [];
      const unique = dedupeContentItemsByUrl(raw);
      setItems(unique);
      setTotal(data?.total ?? 0);
    } catch (e) {
      setItems([]);
      setTotal(0);
      const msg = e instanceof Error ? e.message : 'İçerik yüklenemedi';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [token, selectedChannel, selectedSourceKey, contentTypeFilter, page, refreshKey]);

  useEffect(() => {
    if (authLoading) return;
    fetchChannels();
  }, [fetchChannels, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    fetchItems();
  }, [fetchItems, authLoading]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        if (now - lastVisibleAt.current > 60_000) {
          setRefreshKey((k) => k + 1);
        }
        lastVisibleAt.current = now;
      } else {
        lastVisibleAt.current = Date.now();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
      const res = await apiFetch<{
        ok: boolean;
        message: string;
        results?: { source_label: string; error?: string }[];
      }>('/content/admin/sync', {
        method: 'POST',
        token,
      });
      const failed = (res?.results ?? []).filter((r) => r.error);
      const detail =
        failed.length > 0
          ? failed
              .slice(0, 6)
              .map((r) => `${r.source_label}: ${r.error}`)
              .join('\n')
          : undefined;
      if (res?.ok) {
        toast.success(res?.message ?? 'Senkronizasyon tamamlandı.');
      } else {
        toast.warning(res?.message ?? 'Senkronizasyon uyarısı', {
          description: detail,
          duration: 12_000,
        });
      }
      fetchChannels();
      fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Senkronizasyon başarısız.');
    }
  };

  const featured = page === 1 && items.length > 0 ? items[0] : null;
  const listItems = page === 1 ? items.slice(1) : items;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 45% at 15% 0%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse 50% 35% at 90% 20%, rgba(245, 158, 11, 0.06) 0%, transparent 45%),
            linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background)) 100%)
          `,
        }}
      />
      <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm ring-1 ring-border/30 backdrop-blur-sm sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/12 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Newspaper className="h-3.5 w-3.5" />
              Haber akışı
            </div>
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Haberler</h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              MEB ve il millî eğitim kaynaklarından duyuru ve haberleri kanal ve türe göre süzün.
            </p>
            {isAdmin && channels.length > 0 && (
              <p className="text-xs font-medium text-muted-foreground">{channels.length} kanal tanımlı</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <a
              href="/haberler/yayin"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-500/35 bg-amber-500/12 px-3.5 py-2 text-sm font-semibold text-amber-700 shadow-sm transition-colors hover:bg-amber-500/20 dark:text-amber-300"
            >
              <Sparkles className="h-4 w-4" />
              Yayın
            </a>
            <button
              type="button"
              onClick={() => { fetchChannels(); setRefreshKey((k) => k + 1); }}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3.5 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
              title="Yenile"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Yenile</span>
            </button>
            {isAdmin && (
              <>
                <Button variant="outline" size="sm" className="rounded-xl border-border/80" onClick={handleSync}>
                  <RefreshCw className="mr-1.5 h-4 w-4" />
                  Senkronize Et
                </Button>
                <a
                  href="/haberler/ayarlar"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3.5 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
                >
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Ayarlar</span>
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-1 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/70 bg-background/90 shadow-md ring-1 ring-border/40 backdrop-blur-md">
        {channels.length > 0 && (
          <div className="border-b border-border/50 px-4 pb-3 pt-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Kanal
            </div>
            <div className="w-full min-w-0 rounded-xl bg-muted/60 p-1 ring-1 ring-border/40">
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => handleChannelChange('')}
                  className={cn(
                    'min-h-9 shrink-0 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all sm:px-3 sm:text-sm',
                    !selectedChannel
                      ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                      : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                  )}
                >
                  Tümü
                </button>
                {channels.map((ch) => (
                  <button
                    type="button"
                    key={ch.id}
                    onClick={() => handleChannelChange(ch.key)}
                    className={cn(
                      'inline-flex min-h-9 max-w-full shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all sm:max-w-[18rem] sm:px-3 sm:text-sm',
                      selectedChannel === ch.key
                        ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                    )}
                  >
                    <span className="line-clamp-2 sm:line-clamp-1">{ch.label}</span>
                    {typeof ch.itemCount === 'number' && ch.itemCount > 0 && (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                          selectedChannel === ch.key
                            ? 'bg-white/20 text-primary-foreground'
                            : 'bg-foreground/10 text-muted-foreground',
                        )}
                      >
                        {ch.itemCount > 999 ? `${Math.floor(ch.itemCount / 1000)}k` : ch.itemCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className={cn('px-4 pb-4', channels.length > 0 ? 'pt-3' : 'pt-4')}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <ListFilter className="h-3.5 w-3.5 text-primary" />
              İçerik türü
            </div>
            {selectedSourceKey && selectedSourceLabel && (
              <button
                type="button"
                onClick={clearSourceFilter}
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary/20"
              >
                <Tag className="h-3 w-3" />
                <span className="max-w-40 truncate">{selectedSourceLabel}</span>
                <X className="h-3 w-3 opacity-70" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_TYPE_OPTIONS.map((o) => (
              <button
                key={o.value || '_all'}
                type="button"
                onClick={() => handleContentTypeChange(o.value)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:text-sm',
                  contentTypeFilter === o.value
                    ? 'bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20'
                    : 'border border-border/60 bg-muted/50 text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <HaberListSkeleton />
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
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {featured && (
            <HaberNewsCard
              variant="featured"
              item={featured}
              selectedSourceKey={selectedSourceKey}
              onSourceClick={handleSourceClick}
            />
          )}
          {listItems.map((item) => (
            <HaberNewsCard
              key={item.id}
              variant="compact"
              item={item}
              selectedSourceKey={selectedSourceKey}
              onSourceClick={handleSourceClick}
            />
          ))}

          {/* Sayfalama */}
          {total > limit && (
            <div className="col-span-full mt-6 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Önceki
              </Button>
              <span className="px-3 py-1.5 text-sm font-medium tabular-nums text-muted-foreground">
                {page} / {Math.ceil(total / limit)} · {total} kayıt
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
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
    </div>
  );
}
