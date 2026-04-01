'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { cn } from '@/lib/utils';
import {
  Newspaper,
  ExternalLink,
  RefreshCw,
  Settings,
  Tag,
  X,
  Sparkles,
  Layers,
  ListFilter,
  Share2,
  MoreVertical,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { contentReadPath } from '@/lib/content-read-path';
import { normalizeMebIlImageUrl } from '@/lib/meb-image-url';
import {
  CONTENT_TYPE_CHIP,
  CONTENT_TYPE_FILTER_OPTIONS,
  CONTENT_TYPE_LABELS,
  normalizeContentTypeFilterParam,
} from '@/lib/haber-news-overlay';
import { HaberOverlayBands } from '@/components/haber/haber-overlay-bands';

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

/** URL’de “Tüm kanallar”; API’ye gönderilmez (channel_key yok). */
const CHANNEL_QUERY_ALL = '_all';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatRelativeShort(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 0) return formatDate(iso);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 45) return 'Az önce';
  if (min < 60) return `${min} dk`;
  if (hr < 24) return `${hr} sa`;
  if (day < 7) return `${day} g`;
  if (day < 30) return `${Math.floor(day / 7)} hf`;
  return formatDate(iso);
}

function sourceInitials(label: string | undefined | null): string {
  if (!label?.trim()) return '?';
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  const w = parts[0]!;
  return w.slice(0, 2).toUpperCase();
}

function sourceAvatarHue(label: string): number {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = label.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
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
  dense = false,
}: {
  item: ContentItem;
  variant: 'featured' | 'compact';
  selectedSourceKey: string;
  onSourceClick: (e: React.MouseEvent, sourceKey: string, sourceLabel: string) => void;
  /** Superadmin: daha küçük kart, daha çok sütun */
  dense?: boolean;
}) {
  const isFeatured = variant === 'featured' && !dense;
  const label = item.source_label?.trim() || 'Kaynak';
  const hue = sourceAvatarHue(label);
  const initials = sourceInitials(item.source_label);
  const shareOrCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = item.source_url;
    const title = item.title;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ url, title }).catch(() => {
        void navigator.clipboard.writeText(url).then(() => toast.success('Bağlantı kopyalandı'));
      });
    } else {
      void navigator.clipboard.writeText(url).then(() => toast.success('Bağlantı kopyalandı'));
    }
  };

  const copyOnly = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void navigator.clipboard.writeText(item.source_url).then(() => toast.success('Bağlantı kopyalandı'));
  };

  return (
    <Card
      className={cn(
        'group/card overflow-hidden border-border/80 shadow-sm transition-[box-shadow,border-color] duration-300 hover:border-primary/25 hover:shadow-md',
        dense ? 'rounded-lg' : 'rounded-xl',
        isFeatured && 'ring-1 ring-border/40 lg:col-span-2',
      )}
    >
      <div
        className={cn(
          'flex flex-col',
          isFeatured ? 'p-3 sm:p-4' : dense ? 'p-2' : 'p-2.5 sm:p-3',
        )}
      >
        <div
          className={cn(
            'flex items-start justify-between gap-1.5 border-b border-border/50',
            dense ? 'pb-1.5' : 'pb-2.5',
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
            <div
              className={cn(
                'flex shrink-0 items-center justify-center rounded-full font-bold text-white shadow-inner ring-2 ring-white/20',
                dense ? 'size-6 text-[8px] ring-1' : 'size-8 text-[10px] sm:size-9 sm:text-[11px]',
              )}
              style={{ backgroundColor: `hsl(${hue} 58% 46%)` }}
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
                {item.source_key && item.source_label ? (
                  <button
                    type="button"
                    onClick={(e) => onSourceClick(e, item.source_key!, item.source_label!)}
                    className={cn(
                      'max-w-[min(100%,12rem)] truncate text-left font-semibold leading-tight transition-colors',
                      dense ? 'text-[11px]' : 'text-[13px] sm:text-sm',
                      selectedSourceKey === item.source_key
                        ? 'text-primary'
                        : 'text-foreground hover:text-primary',
                    )}
                  >
                    {item.source_label}
                  </button>
                ) : (
                  <span
                    className={cn(
                      'max-w-[min(100%,12rem)] truncate font-semibold text-foreground',
                      dense ? 'text-[11px]' : 'text-[13px] sm:text-sm',
                    )}
                  >
                    {label}
                  </span>
                )}
                <span className="shrink-0 text-[10px] text-muted-foreground sm:text-[11px]">
                  {item.published_at ? `· ${formatRelativeShort(item.published_at)}` : ''}
                </span>
                {dense && (
                  <span
                    className={cn(
                      'inline-flex max-w-[5.5rem] truncate rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide',
                      CONTENT_TYPE_CHIP[item.content_type] ?? 'bg-muted/80 text-muted-foreground',
                    )}
                  >
                    {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                  </span>
                )}
              </div>
              {!dense && (
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-flex rounded-md border border-border/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      CONTENT_TYPE_CHIP[item.content_type] ?? 'bg-muted/80 text-muted-foreground',
                    )}
                  >
                    {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={shareOrCopy}
              className={cn(
                'rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                dense ? 'p-1' : 'p-1.5',
              )}
              title="Paylaş"
              aria-label="Paylaş"
            >
              <Share2 className={dense ? 'size-3.5' : 'size-4'} />
            </button>
            <details className="relative group/more">
              <summary
                className={cn(
                  'flex cursor-pointer list-none items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden',
                  dense ? 'p-1' : 'p-1.5',
                )}
              >
                <MoreVertical className={dense ? 'size-3.5' : 'size-4'} aria-hidden />
                <span className="sr-only">Diğer</span>
              </summary>
              <div
                className="absolute right-0 top-full z-20 mt-1 min-w-48 rounded-xl border border-border/80 bg-popover/95 p-1 shadow-lg ring-1 ring-border/40 backdrop-blur-sm"
                onClick={(e) => e.stopPropagation()}
              >
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
                >
                  <ExternalLink className="size-4 shrink-0 opacity-70" />
                  Yeni sekmede aç
                </a>
                <button
                  type="button"
                  onClick={copyOnly}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground hover:bg-muted"
                >
                  <Link2 className="size-4 shrink-0 opacity-70" />
                  Bağlantıyı kopyala
                </button>
              </div>
            </details>
          </div>
        </div>

        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.title}
          className={cn(
            'block min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            dense ? 'mt-2' : 'mt-3',
          )}
        >
          <div
            className={cn(
              'relative w-full overflow-hidden bg-muted ring-1 ring-border/30 after:pointer-events-none after:absolute after:inset-0 after:shadow-[inset_0_-40px_60px_-20px_rgba(0,0,0,0.35)]',
              dense ? 'rounded-lg after:rounded-lg' : 'rounded-2xl after:rounded-2xl',
              isFeatured ? 'aspect-16/10 sm:aspect-2/1' : dense ? 'aspect-[4/3] sm:aspect-video' : 'aspect-16/10 sm:aspect-video',
            )}
          >
            {item.image_url ? (
              <>
                <img
                  src={normalizeMebIlImageUrl(item.image_url) ?? item.image_url}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-reduce:transition-none group-hover/card:scale-[1.02]"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                    e.currentTarget.nextElementSibling?.classList.remove('invisible');
                  }}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground/50 invisible"
                  aria-hidden
                >
                  <Newspaper className="h-10 w-10 opacity-40" />
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                <Newspaper className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>
            )}
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t to-transparent',
                isFeatured
                  ? 'h-[62%] from-black/88 via-black/38'
                  : 'h-[40%] from-black/55 via-black/20',
              )}
              aria-hidden
            />
            <HaberOverlayBands item={item} density="feed" compact={!isFeatured || dense} />
          </div>
        </a>
      </div>
    </Card>
  );
}

function HaberListSkeleton({ dense }: { dense?: boolean }) {
  if (dense) {
    return (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {Array.from({ length: 12 }).map((_, i) => (
          <Card key={i} className="overflow-hidden rounded-lg border-border/80 shadow-sm">
            <div className="flex flex-col p-2">
              <div className="flex items-center gap-1.5 border-b border-border/50 pb-1.5">
                <Skeleton className="size-6 shrink-0 rounded-full" />
                <Skeleton className="h-3 w-24 flex-1" />
                <Skeleton className="h-6 w-12 shrink-0 rounded" />
              </div>
              <Skeleton className="mt-2 aspect-[4/3] w-full rounded-lg sm:aspect-video" />
            </div>
          </Card>
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-3 lg:grid-cols-2">
      <Card className="col-span-full overflow-hidden rounded-xl border-border/80 shadow-sm lg:col-span-2">
        <div className="flex flex-col p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 shrink-0 rounded-full sm:size-9" />
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28 sm:w-36" />
                <Skeleton className="h-2.5 w-14" />
              </div>
            </div>
            <Skeleton className="h-8 w-16 shrink-0 rounded-lg" />
          </div>
          <Skeleton className="mt-3 aspect-16/10 w-full rounded-2xl sm:aspect-2/1" />
        </div>
      </Card>
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className="overflow-hidden rounded-xl border-border/80 shadow-sm">
          <div className="flex flex-col p-2.5 sm:p-3">
            <div className="flex items-start justify-between gap-2 border-b border-border/50 pb-2.5">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 shrink-0 rounded-full sm:size-9" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3.5 w-24 sm:w-32" />
                  <Skeleton className="h-2.5 w-12" />
                </div>
              </div>
              <Skeleton className="h-8 w-16 shrink-0 rounded-lg" />
            </div>
            <Skeleton className="mt-3 aspect-16/10 w-full rounded-2xl sm:aspect-video" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function HaberlerPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
  const [syncing, setSyncing] = useState(false);
  const isSuperAdmin = me?.role === 'superadmin';
  const pageLimit = isSuperAdmin ? 72 : 36;
  const isAdmin = isSuperAdmin;
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
      const params = new URLSearchParams({ page: String(page), limit: String(pageLimit) });
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
  }, [token, selectedChannel, selectedSourceKey, contentTypeFilter, page, refreshKey, pageLimit]);

  useEffect(() => {
    if (authLoading) return;
    fetchChannels();
  }, [fetchChannels, authLoading]);

  useEffect(() => {
    if (authLoading) return;
    const ctRaw = searchParams.get('content_type');
    if (searchParams.has('content_type')) {
      setContentTypeFilter(normalizeContentTypeFilterParam(ctRaw));
    } else {
      setContentTypeFilter('');
    }
    if (searchParams.has('channel_key')) {
      const ck = searchParams.get('channel_key');
      if (ck === CHANNEL_QUERY_ALL) setSelectedChannel('');
      else if (ck) setSelectedChannel(ck);
    } else {
      setSelectedChannel('haberler');
    }
    const sk = searchParams.get('source_key');
    const sl = searchParams.get('source_label');
    if (searchParams.has('source_key')) {
      if (sk) {
        setSelectedSourceKey(sk);
        let label = sk.replace(/_/g, ' ');
        if (sl?.trim()) {
          try {
            label = decodeURIComponent(sl);
          } catch {
            label = sl;
          }
        }
        setSelectedSourceLabel(label);
      }
    } else {
      setSelectedSourceKey('');
      setSelectedSourceLabel('');
    }
    setPage(1);
  }, [authLoading, searchParams]);

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
    const next = new URLSearchParams(searchParams.toString());
    if (key === '') next.set('channel_key', CHANNEL_QUERY_ALL);
    else next.set('channel_key', key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleContentTypeChange = (value: string) => {
    const v = normalizeContentTypeFilterParam(value || null);
    setContentTypeFilter(v);
    setPage(1);
    const next = new URLSearchParams(searchParams.toString());
    if (v) next.set('content_type', v);
    else next.delete('content_type');
    if (selectedChannel === '') next.set('channel_key', CHANNEL_QUERY_ALL);
    else next.set('channel_key', selectedChannel);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleSourceClick = (e: React.MouseEvent, sourceKey: string, sourceLabel: string) => {
    e.preventDefault();
    e.stopPropagation();
    const turningOff = selectedSourceKey === sourceKey;
    const next = new URLSearchParams(searchParams.toString());
    if (turningOff) {
      next.delete('source_key');
      next.delete('source_label');
    } else {
      next.set('source_key', sourceKey);
      next.set('source_label', sourceLabel);
    }
    if (selectedChannel === '') next.set('channel_key', CHANNEL_QUERY_ALL);
    else next.set('channel_key', selectedChannel);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    if (turningOff) {
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
    const next = new URLSearchParams(searchParams.toString());
    next.delete('source_key');
    next.delete('source_label');
    if (selectedChannel === '') next.set('channel_key', CHANNEL_QUERY_ALL);
    else next.set('channel_key', selectedChannel);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleSync = async () => {
    if (authLoading) {
      toast.info('Oturum yükleniyor…');
      return;
    }
    if (!token) {
      toast.error('Oturum gerekli.');
      return;
    }
    if (!isAdmin) {
      toast.error('Bu işlem için süper yönetici yetkisi gerekir.');
      return;
    }
    setSyncing(true);
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
      await Promise.all([fetchChannels(), fetchItems()]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Senkronizasyon başarısız.';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const featured =
    !isSuperAdmin && page === 1 && items.length > 0 ? items[0] : null;
  const listItems = isSuperAdmin ? items : page === 1 ? items.slice(1) : items;

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
            {isSuperAdmin && (
              <p className="text-xs text-muted-foreground">
                Yoğun liste: sayfa başına {pageLimit} kayıt, çok sütunlu görünüm.
              </p>
            )}
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border/80"
                  disabled={syncing}
                  onClick={() => void handleSync()}
                >
                  <RefreshCw className={cn('mr-1.5 h-4 w-4', syncing && 'animate-spin')} />
                  {syncing ? 'Senkronize ediliyor…' : 'Senkronize Et'}
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
            {CONTENT_TYPE_FILTER_OPTIONS.map((o) => (
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
        <HaberListSkeleton dense={isSuperAdmin} />
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
        <div
          className={cn(
            'grid',
            isSuperAdmin
              ? 'grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              : 'grid-cols-1 gap-4 sm:gap-3 lg:grid-cols-2',
          )}
        >
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
              dense={isSuperAdmin}
            />
          ))}

          {total > pageLimit && (
            <div className="col-span-full mt-6 flex flex-wrap items-center justify-center gap-2 rounded-xl border border-border/60 bg-muted/30 p-3">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Önceki
              </Button>
              <span className="px-3 py-1.5 text-sm font-medium tabular-nums text-muted-foreground">
                {page} / {Math.ceil(total / pageLimit)} · {total} kayıt
              </span>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= Math.ceil(total / pageLimit)}
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
