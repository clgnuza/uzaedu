'use client';

import { useCallback, useEffect, useState, useRef, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Sheet, SheetBody, SheetClose, SheetContent, SheetHeader } from '@/components/ui/sheet';
import {
  Newspaper,
  ArrowLeft,
  MapPin,
  Layers,
  Clock,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Maximize2,
  Minimize2,
  Keyboard,
  RefreshCw,
  Settings,
  ListFilter,
  Tag,
  X,
  Sparkles,
  Megaphone,
  Globe,
  Trophy,
  Building2,
  GraduationCap,
  FileText,
  CalendarDays,
  BookOpen,
  Folder,
  Zap,
  Rss,
} from 'lucide-react';
import { toast } from 'sonner';
import { contentReadPath } from '@/lib/content-read-path';
import { normalizeMebIlImageUrl } from '@/lib/meb-image-url';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_FILTER_OPTIONS,
  normalizeContentTypeFilterParam,
} from '@/lib/haber-news-overlay';
import { HaberOverlayBands } from '@/components/haber/haber-overlay-bands';
import { HaberSourceFootnote } from '@/components/haber/haber-source-footnote';
import { useHaberContentLiveRefresh } from '@/hooks/use-haber-content-live-refresh';
import { broadcastHaberContentRefresh } from '@/lib/haber-content-refresh-bus';

type Source = { id: string; key: string; label: string };
type Channel = { id: string; key: string; label: string; sortOrder: number; itemCount?: number };

/** URL’de “Tüm kanallar”; API’ye gönderilmez (channel_key yok). */
const CHANNEL_QUERY_ALL = '_all';
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

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatRelativeDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return 'Bugün';
  if (diffDays === 1) return 'Dün';
  if (diffDays < 7) return `${diffDays} gün önce`;
  return formatDate(iso);
}

/** Aynı haber farklı kaynaklardan veya tekrar sync ile çift satırda gelebilir; URL’ye göre ilk kaydı tut (API sırası: en güncel önce). */
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

function NewsCardImage({ src, isHero }: { src: string; isHero: boolean }) {
  const [error, setError] = useState(false);
  const resolved = normalizeMebIlImageUrl(src) ?? src;
  if (error) {
    return (
      <div className="absolute inset-0 z-0 flex items-center justify-center bg-linear-to-br from-violet-950/80 to-slate-950">
        <Newspaper
          className={cn('text-fuchsia-200/80', isHero ? 'size-9 sm:size-16' : 'size-8 sm:size-12')}
        />
      </div>
    );
  }
  return (
    <img
      src={resolved}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className="absolute inset-0 z-0 h-full w-full object-cover object-center motion-safe:transition-transform motion-safe:duration-500 motion-reduce:transition-none group-hover/card:scale-[1.03]"
    />
  );
}

/** İçerik türüne göre neon çerçeve + rozet (API anahtarı). */
const YAYIN_FRAME: Record<string, string> = {
  announcement: 'bg-linear-to-br from-amber-400 via-orange-500 to-rose-500 shadow-amber-500/25',
  news: 'bg-linear-to-br from-sky-400 via-violet-500 to-fuchsia-500 shadow-fuchsia-500/20',
  competition: 'bg-linear-to-br from-lime-300 via-amber-400 to-orange-500 shadow-amber-400/20',
  exam: 'bg-linear-to-br from-rose-400 via-red-500 to-orange-600 shadow-rose-500/25',
  project: 'bg-linear-to-br from-emerald-400 via-teal-500 to-cyan-500 shadow-cyan-500/20',
  event: 'bg-linear-to-br from-purple-400 via-fuchsia-500 to-pink-500 shadow-fuchsia-500/25',
  document: 'bg-linear-to-br from-slate-400 via-zinc-500 to-neutral-700 shadow-slate-400/15',
};
const YAYIN_TYPE_CHIP: Record<string, string> = {
  announcement: 'bg-linear-to-r from-amber-500 to-orange-600 text-white ring-white/25',
  news: 'bg-linear-to-r from-sky-500 to-violet-600 text-white ring-white/25',
  competition: 'bg-linear-to-r from-lime-500 to-amber-600 text-neutral-950 ring-white/30',
  exam: 'bg-linear-to-r from-rose-500 to-red-600 text-white ring-white/25',
  project: 'bg-linear-to-r from-emerald-500 to-teal-600 text-white ring-white/25',
  event: 'bg-linear-to-r from-purple-500 to-pink-600 text-white ring-white/25',
  document: 'bg-linear-to-r from-slate-500 to-zinc-700 text-white ring-white/20',
};

/** Yayın kartı: gridde alt bar yok; yalnızca hero’da alt bilgi şeridi. */
function YayinBroadcastCard({ item, variant }: { item: ContentItem; variant: 'hero' | 'default' }) {
  const isHero = variant === 'hero';
  const typeKey = (item.content_type || 'news').toLowerCase();
  const typeLabel = CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type;
  const frame = YAYIN_FRAME[typeKey] ?? 'bg-linear-to-br from-cyan-400 via-blue-500 to-indigo-600 shadow-blue-500/20';
  const chip = YAYIN_TYPE_CHIP[typeKey] ?? 'bg-linear-to-r from-cyan-500 to-indigo-600 text-white ring-white/25';

  const metaHero = (
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-8 items-center justify-between gap-1.5 border-t border-white/15 bg-linear-to-r from-slate-950/95 via-violet-950/90 to-slate-950/95 px-2 backdrop-blur-md sm:h-11 sm:gap-2 sm:px-3">
      <span
        className={cn(
          'inline-flex max-w-[46%] shrink-0 truncate rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide ring-1 sm:max-w-[44%] sm:px-2 sm:py-0.5 sm:text-[10px]',
          chip,
        )}
      >
        {typeLabel}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1 text-[9px] text-slate-300 sm:gap-2 sm:text-xs">
        <span className="truncate font-medium text-white/95">{item.source_label ?? 'Kaynak'}</span>
        {item.published_at && (
          <span className="flex shrink-0 items-center gap-0.5 tabular-nums text-slate-400 sm:gap-1">
            <Clock className="size-3 opacity-90 sm:size-3.5" />
            {formatRelativeDate(item.published_at) || formatDate(item.published_at)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        'group/card w-full min-w-0 overflow-hidden rounded-xl p-[1.5px] shadow-lg ring-1 ring-white/25 transition-[transform,box-shadow] duration-300 hover:shadow-xl hover:ring-white/35 sm:rounded-2xl sm:p-[2px] sm:shadow-2xl dark:ring-white/10',
        frame,
        isHero && 'mx-auto max-w-5xl sm:mx-auto',
      )}
    >
      <Card className="w-full overflow-hidden rounded-[10px] border-0 bg-slate-950 shadow-none sm:rounded-[14px] dark:bg-slate-950">
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={item.title}
          className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/90 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <div
            className={cn(
              'relative isolate w-full overflow-hidden bg-slate-950 after:pointer-events-none after:absolute after:inset-0',
              isHero
                ? 'aspect-5/3 max-h-[38vh] min-h-[100px] after:shadow-[inset_0_-28px_48px_-18px_rgba(15,23,42,0.55)] sm:aspect-21/9 sm:max-h-none sm:min-h-[260px] sm:after:shadow-[inset_0_-40px_64px_-24px_rgba(15,23,42,0.55)]'
                : 'aspect-4/3 max-sm:max-h-[46vw] after:shadow-[inset_0_-20px_36px_-12px_rgba(15,23,42,0.4)] sm:aspect-video',
            )}
          >
            {item.image_url ? (
              <NewsCardImage src={item.image_url} isHero={isHero} />
            ) : (
              <div className="absolute inset-0 z-0 flex min-h-[88px] items-center justify-center bg-linear-to-br from-violet-950 to-slate-950 sm:min-h-[120px]">
                <Newspaper className={cn('text-fuchsia-300/70', isHero ? 'size-9 sm:size-16' : 'size-8 sm:size-12')} />
              </div>
            )}
            <div
              className={cn(
                'pointer-events-none absolute inset-x-0 z-1 bg-linear-to-t to-transparent',
                isHero
                  ? 'bottom-0 h-[55%] from-slate-950/95 via-fuchsia-950/25 sm:h-[58%] sm:via-slate-900/40'
                  : 'bottom-0 h-[48%] from-slate-950/85 via-slate-900/28 sm:h-[50%]',
              )}
              aria-hidden
            />
            <HaberOverlayBands
              item={item}
              density={isHero ? 'broadcastHero' : 'broadcast'}
              compact={!isHero}
              bottomOffsetClass={isHero ? 'bottom-8 sm:bottom-12' : undefined}
            />
            {isHero && metaHero}
          </div>
        </a>
      </Card>
    </div>
  );
}

/** İl duyuruları: yatay kart — görsel + metin, il rozeti. */
function YayinIlProvinceNewsCard({ item, provinceLabel }: { item: ContentItem; provinceLabel: string }) {
  const typeKey = (item.content_type || 'announcement').toLowerCase();
  const typeLabel = CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type;
  const chip =
    YAYIN_TYPE_CHIP[typeKey] ?? 'bg-linear-to-r from-teal-600 to-cyan-700 text-white ring-white/20';

  return (
    <a
      href={item.source_url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/card group/il relative flex min-h-[7.25rem] w-full min-w-0 overflow-hidden rounded-2xl border border-teal-300/25 bg-linear-to-br from-white via-teal-50/25 to-cyan-50/35 shadow-md ring-1 ring-slate-900/[0.04] transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:ring-teal-400/25 dark:border-teal-800/50 dark:from-slate-950 dark:via-teal-950/30 dark:to-slate-950 dark:ring-white/10 dark:hover:ring-teal-500/30"
    >
      <div className="pointer-events-none absolute -right-6 -top-8 size-28 rounded-full bg-teal-400/20 blur-2xl dark:bg-teal-500/15" aria-hidden />
      <div className="pointer-events-none absolute bottom-0 left-1/4 size-24 rounded-full bg-cyan-400/15 blur-xl dark:bg-cyan-500/10" aria-hidden />

      <div className="relative w-[min(40%,10rem)] shrink-0 sm:w-[min(34%,11rem)]">
        <div className="relative aspect-4/3 h-full min-h-[7.25rem] w-full overflow-hidden bg-slate-900">
          {item.image_url ? (
            <NewsCardImage src={item.image_url} isHero={false} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-linear-to-br from-teal-900 via-slate-900 to-slate-950">
              <Building2 className="size-10 text-teal-200/45" />
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-teal-950/85 to-transparent" aria-hidden />
        </div>
        <div className="absolute left-2 top-2 flex max-w-[calc(100%-0.75rem)] items-center gap-1 rounded-full bg-teal-950/88 px-2 py-0.5 text-[10px] font-semibold text-teal-50 shadow-sm backdrop-blur-sm ring-1 ring-white/15">
          <MapPin className="size-3.5 shrink-0 text-teal-200" aria-hidden />
          <span className="truncate">{provinceLabel}</span>
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col justify-between gap-1.5 p-3.5 sm:gap-2 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1',
              chip,
            )}
          >
            {typeLabel}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-700/90 dark:text-teal-300/90">
            İl duyurusu
          </span>
        </div>
        <h3 className="line-clamp-2 text-[0.95rem] font-semibold leading-snug tracking-tight text-slate-900 transition-colors group-hover/il:text-teal-800 dark:text-slate-50 dark:group-hover/il:text-teal-200 sm:text-base">
          {item.title}
        </h3>
        {item.summary ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">{item.summary}</p>
        ) : null}
        <div className="mt-auto flex flex-wrap items-end justify-between gap-2 border-t border-teal-200/35 pt-2 dark:border-teal-900/45">
          <span className="min-w-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
            {item.source_label ?? 'Kaynak'}
          </span>
          {item.published_at ? (
            <span className="flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
              <Clock className="size-3 opacity-80" aria-hidden />
              {formatRelativeDate(item.published_at)}
            </span>
          ) : null}
        </div>
      </div>
    </a>
  );
}

const SLIDE_INTERVAL_OPTIONS = [
  { value: 5, label: '5 sn' },
  { value: 8, label: '8 sn' },
  { value: 10, label: '10 sn' },
  { value: 15, label: '15 sn' },
];

export default function HaberYayinPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { token, me, loading: authLoading } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [mebItems, setMebItems] = useState<ContentItem[]>([]);
  const [ilItems, setIlItems] = useState<ContentItem[]>([]);
  const [loadingMeb, setLoadingMeb] = useState(true);
  const [loadingIl, setLoadingIl] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
  const [selectedSourceLabel, setSelectedSourceLabel] = useState<string>('');
  const [contentTypeFilter, setContentTypeFilter] = useState<string>('');
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slideMode, setSlideMode] = useState(false);
  const [slideIntervalSec, setSlideIntervalSec] = useState(8);
  const [fullscreenMode, setFullscreenMode] = useState(false);
  const slideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [lastFetchAt, setLastFetchAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const userCity = me?.school?.city ?? null;
  const isAdmin = me?.role === 'superadmin' || me?.role === 'school_admin';
  const isSuperAdmin = me?.role === 'superadmin';
  const allItems = [...mebItems];

  const fetchChannels = useCallback(async () => {
    try {
      const data = await apiFetch<Channel[]>(contentReadPath('channels', token), { token });
      setChannels(Array.isArray(data) ? data : []);
    } catch {
      setChannels([]);
    }
  }, [token]);

  const fetchSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const data = await apiFetch<Source[]>(contentReadPath('meb-sources', token), { token });
      setSources(Array.isArray(data) ? data : []);
    } catch {
      setSources([]);
    } finally {
      setLoadingSources(false);
    }
  }, [token]);

  const fetchMebItems = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoadingMeb(true);
    try {
      const params = new URLSearchParams({ page: '1', limit: '24' });
      if (selectedChannel) params.set('channel_key', selectedChannel);
      if (selectedSourceKey) params.set('source_key', selectedSourceKey);
      if (contentTypeFilter) params.set('content_type', contentTypeFilter);
      const data = await apiFetch<{ total: number; items: ContentItem[] }>(
        `${contentReadPath('items', token)}?${params}`,
        { token },
      );
      const raw = data?.items ?? [];
      const next = dedupeContentItemsByUrl(raw);
      setMebItems(next);
      if (!silent) setSlideIndex(0);
      else setSlideIndex((prev) => (next.length === 0 ? 0 : Math.min(prev, next.length - 1)));
      setLastFetchAt(new Date());
    } catch {
      if (!silent) setMebItems([]);
    } finally {
      if (!silent) setLoadingMeb(false);
    }
  }, [token, selectedChannel, selectedSourceKey, contentTypeFilter]);

  const fetchIlItems = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true;
    if (!silent) setLoadingIl(true);
    try {
      void userCity;
      const params = new URLSearchParams({
        page: '1',
        limit: '14',
        channel_key: 'il_duyurulari',
      });
      const data = await apiFetch<{ total: number; items: ContentItem[] }>(
        `${contentReadPath('items', token)}?${params}`,
        { token },
      );
      setIlItems(dedupeContentItemsByUrl(data?.items ?? []));
    } catch {
      if (!silent) setIlItems([]);
    } finally {
      if (!silent) setLoadingIl(false);
    }
  }, [token, userCity]);

  useHaberContentLiveRefresh({
    authLoading,
    token,
    onSilentRefresh: async () => {
      await Promise.all([fetchMebItems({ silent: true }), fetchIlItems({ silent: true })]);
    },
  });

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
      setSelectedChannel('');
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
  }, [authLoading, searchParams]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void (async () => {
      await fetchSources();
      if (cancelled) return;
      await fetchMebItems();
      if (cancelled) return;
      await fetchIlItems();
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, fetchSources, fetchMebItems, fetchIlItems]);

  const handleChannelChange = (key: string) => {
    setSelectedChannel(key);
    const next = new URLSearchParams(searchParams.toString());
    if (key === '') next.set('channel_key', CHANNEL_QUERY_ALL);
    else next.set('channel_key', key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleContentTypeChange = (value: string) => {
    const v = normalizeContentTypeFilterParam(value || null);
    setContentTypeFilter(v);
    const next = new URLSearchParams(searchParams.toString());
    if (v) next.set('content_type', v);
    else next.delete('content_type');
    if (selectedChannel === '') next.set('channel_key', CHANNEL_QUERY_ALL);
    else next.set('channel_key', selectedChannel);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleSourceFilterClick = (sourceKey: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (selectedSourceKey === sourceKey) {
      next.delete('source_key');
      next.delete('source_label');
      setSelectedSourceKey('');
      setSelectedSourceLabel('');
    } else {
      const src = sources.find((s) => s.key === sourceKey);
      const label = src?.label ?? sourceKey.replace(/_/g, ' ');
      next.set('source_key', sourceKey);
      next.set('source_label', encodeURIComponent(label));
      setSelectedSourceKey(sourceKey);
      setSelectedSourceLabel(label);
    }
    if (selectedChannel === '') next.set('channel_key', CHANNEL_QUERY_ALL);
    else next.set('channel_key', selectedChannel);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const clearSourceFilter = () => {
    setSelectedSourceKey('');
    setSelectedSourceLabel('');
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
    if (!isSuperAdmin) {
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
      await Promise.all([fetchChannels(), fetchSources(), fetchMebItems(), fetchIlItems()]);
      broadcastHaberContentRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Senkronizasyon başarısız.';
      toast.error(msg);
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchChannels(), fetchSources(), fetchMebItems(), fetchIlItems()]);
    setRefreshing(false);
  }, [fetchChannels, fetchSources, fetchMebItems, fetchIlItems]);

  const CHANNEL_ICON: Record<string, ReactNode> = {
    meb: <Megaphone className="size-3.5 shrink-0" />,
    haber: <Newspaper className="size-3.5 shrink-0" />,
    yarisma: <Trophy className="size-3.5 shrink-0" />,
    il: <Building2 className="size-3.5 shrink-0" />,
    egitim: <GraduationCap className="size-3.5 shrink-0" />,
  };
  const CONTENT_TYPE_ICON: Record<string, ReactNode> = {
    '': <Globe className="size-3 shrink-0" />,
    announcement: <Megaphone className="size-3 shrink-0" />,
    news: <Newspaper className="size-3 shrink-0" />,
    competition: <Trophy className="size-3 shrink-0" />,
    exam: <FileText className="size-3 shrink-0" />,
    project: <Folder className="size-3 shrink-0" />,
    event: <CalendarDays className="size-3 shrink-0" />,
    document: <BookOpen className="size-3 shrink-0" />,
  };

  const getChannelIcon = (key: string) => {
    const shortKey = key.split('_')[0] ?? key;
    return CHANNEL_ICON[shortKey] ?? <Rss className="size-3.5 shrink-0" />;
  };

  const afterFilterNavigate = () => setFilterSheetOpen(false);
  const renderFilterPanels = (closeOnSelect: boolean) => {
    const done = closeOnSelect ? afterFilterNavigate : undefined;
    return (
      <>
        {channels.length > 0 && (
          <div className="pb-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <Layers className="size-3 text-blue-300/70" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Kanal</span>
              {isSuperAdmin && <span className="text-[10px] text-white/25">· {channels.length}</span>}
            </div>
            <div className="flex snap-x flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  handleChannelChange('');
                  done?.();
                }}
                className={cn(
                  'flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150',
                  !selectedChannel
                    ? 'bg-white text-slate-900 shadow-md ring-1 ring-white/40'
                    : 'bg-white/10 text-white/70 ring-1 ring-white/10 hover:bg-white/18 hover:text-white',
                )}
              >
                <Globe className="size-3.5 shrink-0" />
                Tümü
              </button>
              {channels.map((ch) => {
                const isActive = selectedChannel === ch.key;
                const shortKey = ch.key.split('_')[0] ?? ch.key;
                const colorMap: Record<string, string> = {
                  meb: isActive
                    ? 'bg-blue-500 text-white shadow ring-1 ring-blue-300/40'
                    : 'bg-blue-500/15 text-blue-200 ring-1 ring-blue-400/20 hover:bg-blue-500/25',
                  haber: isActive
                    ? 'bg-emerald-500 text-white shadow ring-1 ring-emerald-300/40'
                    : 'bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/20 hover:bg-emerald-500/25',
                  yarisma: isActive
                    ? 'bg-amber-500 text-white shadow ring-1 ring-amber-300/40'
                    : 'bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/20 hover:bg-amber-500/25',
                  il: isActive
                    ? 'bg-violet-500 text-white shadow ring-1 ring-violet-300/40'
                    : 'bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/20 hover:bg-violet-500/25',
                  egitim: isActive
                    ? 'bg-rose-500 text-white shadow ring-1 ring-rose-300/40'
                    : 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/20 hover:bg-rose-500/25',
                };
                const cls =
                  colorMap[shortKey] ??
                  (isActive ? 'bg-sky-500 text-white' : 'bg-white/10 text-white/70 hover:bg-white/18 hover:text-white ring-1 ring-white/10');
                return (
                  <button
                    type="button"
                    key={ch.id}
                    onClick={() => {
                      handleChannelChange(ch.key);
                      done?.();
                    }}
                    className={cn(
                      'flex shrink-0 snap-start items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150',
                      cls,
                    )}
                  >
                    {getChannelIcon(ch.key)}
                    <span className="line-clamp-1 max-w-40">{ch.label}</span>
                    {typeof ch.itemCount === 'number' && ch.itemCount > 0 && (
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tabular-nums leading-none',
                          isActive ? 'bg-white/25' : 'bg-white/10',
                        )}
                      >
                        {ch.itemCount > 999 ? `${(ch.itemCount / 1000).toFixed(0)}k` : ch.itemCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={channels.length > 0 ? 'pt-2.5' : ''}>
          <div className="mb-1.5 flex items-center gap-1.5">
            <ListFilter className="size-3 text-violet-300/70" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">İçerik türü</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {CONTENT_TYPE_FILTER_OPTIONS.map((o) => (
              <button
                key={o.value || '_all'}
                type="button"
                onClick={() => {
                  handleContentTypeChange(o.value);
                  done?.();
                }}
                className={cn(
                  'flex shrink-0 snap-start items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-all duration-150',
                  contentTypeFilter === o.value
                    ? 'bg-violet-500 text-white shadow ring-1 ring-violet-300/40'
                    : 'bg-violet-500/12 text-violet-200 ring-1 ring-violet-400/18 hover:bg-violet-500/22 hover:text-white',
                )}
              >
                {CONTENT_TYPE_ICON[o.value] ?? <Globe className="size-3 shrink-0" />}
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {(sources.length > 0 || loadingSources) && (
          <div className={cn(channels.length > 0 || CONTENT_TYPE_FILTER_OPTIONS.length > 0 ? 'pt-2.5' : '')}>
            <div className="mb-1.5 flex items-center gap-1.5">
              <Layers className="size-3 text-sky-300/70" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">MEB birimi</span>
            </div>
            {loadingSources ? (
              <div className="h-9 w-full animate-pulse rounded-xl bg-white/10" aria-hidden />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    clearSourceFilter();
                    done?.();
                  }}
                  className={cn(
                    'rounded-xl px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                    !selectedSourceKey
                      ? 'bg-white text-slate-900 shadow ring-1 ring-white/40'
                      : 'bg-white/10 text-white/70 ring-1 ring-white/10 hover:bg-white/18',
                  )}
                >
                  Tümü
                </button>
                {sources.map((s) => {
                  const active = selectedSourceKey === s.key;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      title={s.label}
                      onClick={() => {
                        handleSourceFilterClick(s.key);
                        done?.();
                      }}
                      className={cn(
                        'max-w-[min(100%,14rem)] truncate rounded-xl px-2.5 py-1.5 text-left text-[11px] font-semibold transition-all',
                        active
                          ? 'bg-sky-500 text-white shadow ring-1 ring-sky-300/40'
                          : 'bg-white/10 text-white/80 ring-1 ring-white/10 hover:bg-white/18',
                      )}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedSourceKey && selectedSourceLabel && (
          <div className="flex items-center justify-between gap-2 pt-2.5">
            <span className="text-[10px] text-white/40">Kaynak:</span>
            <button
              type="button"
              onClick={() => {
                clearSourceFilter();
                done?.();
              }}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white ring-1 ring-white/15 hover:bg-white/18"
            >
              <Tag className="size-3 shrink-0" />
              <span className="truncate max-w-[140px]">{selectedSourceLabel}</span>
              <X className="size-3 shrink-0 opacity-60" />
            </button>
          </div>
        )}
      </>
    );
  };

  function formatRelativeTime(date: Date | null): string {
    if (!date) return '—';
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    if (diffSec < 60) return 'Az önce';
    if (diffMin < 60) return `${diffMin} dk önce`;
    const diffH = Math.floor(diffMin / 60);
    return `${diffH} sa önce`;
  }

  useEffect(() => {
    if (!slideMode || allItems.length === 0) {
      if (slideTimerRef.current) {
        clearInterval(slideTimerRef.current);
        slideTimerRef.current = null;
      }
      return;
    }
    const ms = slideIntervalSec * 1000;
    slideTimerRef.current = setInterval(() => {
      setSlideIndex((i) => (i + 1) % allItems.length);
    }, ms);
    return () => {
      if (slideTimerRef.current) clearInterval(slideTimerRef.current);
    };
  }, [slideMode, slideIntervalSec, allItems.length]);

  const goNext = useCallback(
    () => setSlideIndex((i) => (i + 1) % Math.max(1, allItems.length)),
    [allItems.length],
  );
  const goPrev = useCallback(
    () => setSlideIndex((i) => (i - 1 + allItems.length) % Math.max(1, allItems.length)),
    [allItems.length],
  );

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
    } catch { /* ignore */ }
    setFullscreenMode(false);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement && containerRef.current) {
      try {
        await containerRef.current.requestFullscreen();
        setFullscreenMode(true);
      } catch {
        setFullscreenMode(true);
      }
    } else {
      await exitFullscreen();
    }
  }, [exitFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => setFullscreenMode(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goNext();
          break;
        case ' ':
          e.preventDefault();
          setSlideMode((m) => !m);
          break;
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
        case 'Escape':
          e.preventDefault();
          exitFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext, toggleFullscreen, exitFullscreen]);

  const [mebHero, ...mebRest] = mebItems;
  const currentSlideItem = allItems[slideIndex] ?? allItems[0];

  const fullscreenOverlay = fullscreenMode && allItems.length > 0 && (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-slate-200/90 bg-white/95 px-4 py-2 shadow-lg ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-950/95 dark:ring-slate-700/50">
      <button
        onClick={goPrev}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
        aria-label="Önceki"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-14 text-center text-sm font-medium text-slate-600 dark:text-slate-300">
        {slideIndex + 1} / {allItems.length}
      </span>
      <button
        onClick={goNext}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800"
        aria-label="Sonraki"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <span className="mx-2 h-5 w-px bg-slate-200 dark:bg-slate-600" />
      <button
        onClick={exitFullscreen}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-sky-50 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        Esc ile çık
      </button>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className="relative pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-20"
    >
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
      <div className="space-y-3 sm:space-y-5">
        <div className="relative overflow-hidden rounded-2xl shadow-lg" style={{ background: 'linear-gradient(160deg,#0d1e3f 0%,#0f2a52 55%,#0b2244 100%)' }}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl" aria-hidden>
            <div
              style={{
                backgroundImage:
                  'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
                backgroundSize: '32px 32px',
              }}
              className="absolute inset-0"
            />
            <div
              className="absolute -left-10 -top-10 size-52 rounded-full"
              style={{ background: 'radial-gradient(circle,rgba(59,130,246,0.18) 0%,transparent 65%)' }}
            />
            <div
              className="absolute -bottom-10 right-0 size-44 rounded-full"
              style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.12) 0%,transparent 65%)' }}
            />
          </div>

          <div className="relative flex flex-col gap-0 lg:flex-row lg:items-stretch">
            <div className="flex flex-col justify-between gap-3 px-3 py-3 sm:px-5 sm:py-4 lg:min-w-[220px] lg:max-w-[280px] lg:border-r lg:border-white/10">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                    <Sparkles className="size-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-base font-bold text-white sm:text-lg">Haber yayını</h1>
                    <p className="text-[10px] leading-snug text-white/45">Slayt ve tam ekran; filtreler Haberler ile aynı (TSİ listesi).</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFilterSheetOpen(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white ring-1 ring-white/15 transition hover:bg-white/18 lg:hidden"
                >
                  <ListFilter className="size-3.5" />
                  Filtre
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <Link
                  href="/haberler"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/18"
                  title="Haberler"
                >
                  <ArrowLeft className="size-3.5 shrink-0" />
                  Haberler
                </Link>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400/20 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-400/30">
                  <Sparkles className="size-3.5 shrink-0" />
                  Yayın
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => void handleRefresh()}
                    disabled={refreshing}
                    className="inline-flex size-7 items-center justify-center rounded-lg bg-white/8 text-white/60 ring-1 ring-white/12 transition hover:bg-white/15 disabled:opacity-40"
                    title={refreshing ? 'Yenileniyor…' : 'Yenile'}
                  >
                    <RefreshCw className={cn('size-3', refreshing && 'animate-spin')} />
                  </button>
                )}
                {isSuperAdmin && (
                  <>
                    <button
                      type="button"
                      disabled={syncing}
                      onClick={() => void handleSync()}
                      className="inline-flex size-7 items-center justify-center rounded-lg bg-white/8 text-white/60 ring-1 ring-white/12 transition hover:bg-white/15 disabled:opacity-40"
                      title={syncing ? 'Senkronize ediliyor…' : 'Senkronize Et'}
                    >
                      <Zap className={cn('size-3', syncing && 'animate-pulse')} />
                    </button>
                    <Link
                      href="/haberler/ayarlar"
                      className="inline-flex size-7 items-center justify-center rounded-lg bg-white/8 text-white/60 ring-1 ring-white/12 transition hover:bg-white/15"
                      title="Ayarlar"
                    >
                      <Settings className="size-3" />
                    </Link>
                  </>
                )}
              </div>
              {selectedSourceKey && selectedSourceLabel && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-white/8 px-2.5 py-1.5 ring-1 ring-white/12 lg:hidden">
                  <span className="text-[10px] text-white/45">Kaynak</span>
                  <button
                    type="button"
                    onClick={() => clearSourceFilter()}
                    className="inline-flex min-w-0 flex-1 items-center justify-end gap-1 text-[11px] font-semibold text-white"
                  >
                    <Tag className="size-3 shrink-0" />
                    <span className="truncate">{selectedSourceLabel}</span>
                    <X className="size-3 shrink-0 opacity-60" />
                  </button>
                </div>
              )}
            </div>

            <div className="hidden min-w-0 flex-1 flex-col gap-0 divide-y divide-white/8 px-3 py-2.5 sm:px-4 sm:py-3 lg:flex">
              {renderFilterPanels(false)}
            </div>
          </div>
        </div>

        <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
          <SheetContent
            side="right"
            className="w-[min(100vw,22rem)] max-w-none border-l border-white/10 bg-[linear-gradient(180deg,#0d1e3f_0%,#0b2244_100%)] p-0 text-white shadow-2xl"
          >
            <SheetHeader className="shrink-0 justify-between gap-2 border-white/10 bg-white/5 px-4 py-3">
              <span className="text-sm font-bold">Filtreler</span>
              <SheetClose className="text-white hover:bg-white/10" />
            </SheetHeader>
            <SheetBody className="divide-y divide-white/8 px-3 py-3">{renderFilterPanels(true)}</SheetBody>
          </SheetContent>
        </Sheet>

        <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border/50 bg-linear-to-b from-muted/20 to-background/90 shadow-sm backdrop-blur-md sm:rounded-2xl sm:from-muted/15">
          <div className="p-2 sm:p-4">
            <div className="flex min-h-12 min-w-0 w-full max-w-full flex-wrap items-center gap-2 sm:gap-2.5">
              <span className="hidden w-full text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:mb-0 sm:inline sm:w-auto dark:text-slate-400">
                Oynatıcı
              </span>
              <div className="mobile-tab-scroll flex w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:overflow-visible sm:pb-0">
                <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-violet-200/45 bg-violet-50/35 px-2.5 py-1.5 dark:border-violet-500/25 dark:bg-violet-950/25">
                  <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500 dark:text-slate-400" />
                  <select
                    value={slideIntervalSec}
                    onChange={(e) => setSlideIntervalSec(Number(e.target.value))}
                    className="max-w-22 cursor-pointer bg-transparent text-xs font-semibold text-slate-800 focus:outline-none dark:text-slate-100"
                  >
                    {SLIDE_INTERVAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                {allItems.length > 0 && (
                  <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-violet-200/45 bg-violet-50/35 p-0.5 dark:border-violet-500/25 dark:bg-violet-950/25">
                    <button
                      type="button"
                      onClick={goPrev}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-white/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-violet-950/50 dark:hover:text-slate-50"
                      aria-label="Önceki"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="min-w-14 px-1 text-center text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {slideIndex + 1} / {allItems.length}
                    </span>
                    <button
                      type="button"
                      onClick={goNext}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-white/90 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-violet-950/50 dark:hover:text-slate-50"
                      aria-label="Sonraki"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setSlideMode(!slideMode)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                    slideMode
                      ? 'border-violet-300/60 bg-white text-violet-900 shadow-sm dark:border-violet-500/40 dark:bg-violet-900/45 dark:text-violet-50'
                      : 'border-transparent bg-violet-50/50 text-muted-foreground hover:border-violet-200/50 hover:bg-white/80 hover:text-foreground dark:bg-violet-950/20 dark:hover:border-violet-500/30',
                  )}
                >
                  {slideMode ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  <span>{slideMode ? 'Durdur' : 'Slayt'}</span>
                </button>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title="Tam ekran (F)"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-transparent bg-violet-50/40 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-violet-200/50 hover:bg-white/80 hover:text-foreground dark:bg-violet-950/20 dark:hover:border-violet-500/30"
                >
                  {fullscreenMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{fullscreenMode ? 'Küçült' : 'Tam ekran'}</span>
                </button>

                {lastFetchAt && (
                  <span className="ml-auto shrink-0 text-[10px] text-slate-500 sm:text-xs dark:text-slate-400">
                    Güncellendi: {formatRelativeTime(lastFetchAt)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

      {/* İçerik alanı */}
      {loadingMeb ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : mebItems.length === 0 ? (
        <Card className="border-slate-200/90 bg-linear-to-br from-white via-slate-50/40 to-sky-50/35 shadow-sm dark:border-slate-700/85 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
          <CardContent className="py-12">
            <EmptyState
              icon={<Newspaper className="size-10 text-slate-400" />}
              title="Bu birimde henüz içerik yok"
              description="Senkronizasyon sonrası haberler burada görünecek. Haberler sayfasından Senkronize Et ile veri çekebilirsiniz."
            />
          </CardContent>
        </Card>
      ) : (slideMode || fullscreenMode) && currentSlideItem ? (
        <div className={cn(fullscreenMode && 'flex min-h-[60vh] items-center justify-center')}>
          <div className="w-full max-w-4xl">
            <YayinBroadcastCard item={currentSlideItem} variant="hero" />
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {mebHero && <YayinBroadcastCard item={mebHero} variant="hero" />}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {mebRest.slice(0, 8).map((item) => (
              <YayinBroadcastCard key={item.id} item={item} variant="default" />
            ))}
          </div>
        </div>
      )}

      <HaberSourceFootnote className="mt-1" />

      <section className="relative overflow-hidden rounded-2xl border border-teal-200/40 bg-linear-to-br from-teal-50/80 via-white to-cyan-50/50 p-4 shadow-md ring-1 ring-teal-300/20 dark:border-teal-900/50 dark:from-teal-950/40 dark:via-slate-950 dark:to-slate-950 dark:ring-teal-800/25 sm:p-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              'radial-gradient(ellipse 55% 40% at 100% 0%, rgba(20,184,166,0.14) 0%, transparent 55%), radial-gradient(ellipse 40% 35% at 0% 100%, rgba(6,182,212,0.12) 0%, transparent 50%)',
          }}
        />
        <div className="relative mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-teal-300/50 bg-linear-to-br from-teal-500 to-cyan-600 text-white shadow-lg shadow-teal-600/25 ring-2 ring-white/30 dark:border-teal-700/60 dark:from-teal-600 dark:to-cyan-700 dark:ring-teal-950/50">
              <MapPin className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-teal-700/90 dark:text-teal-300/90">
                Okulunuzun ili
              </p>
              <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-50 sm:text-xl">
                {userCity ? `${userCity} il duyuruları` : 'İl duyuruları'}
              </h2>
              <p className="mt-0.5 max-w-prose text-sm text-muted-foreground">
                {userCity
                  ? 'Yalnızca bu ile ait MEB il müdürlüğü duyuruları listelenir.'
                  : 'Duyuruları görmek için okul kaydınızda il alanı dolu olmalı.'}
              </p>
            </div>
          </div>
        </div>

        {!userCity ? (
          <p className="relative rounded-xl border border-amber-400/35 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-950 dark:border-amber-600/40 dark:bg-amber-950/20 dark:text-amber-100">
            İl listesi için okul profilinizde il tanımlayın.
          </p>
        ) : loadingIl ? (
          <div className="relative flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : ilItems.length === 0 ? (
          <EmptyState
            icon={<Megaphone className="size-10 text-teal-600/70 dark:text-teal-400/70" />}
            title={`${userCity} için henüz duyuru yok`}
            description="Senkron sonrası il müdürlüğü duyuruları burada görünür."
          />
        ) : (
          <ul className="relative grid list-none gap-4 p-0 sm:grid-cols-2">
            {ilItems.slice(0, 8).map((item) => (
              <li key={item.id} className="min-w-0">
                <YayinIlProvinceNewsCard item={item} provinceLabel={userCity} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <details className="group rounded-xl border border-dashed border-slate-300/60 bg-slate-50/50 px-3 py-2 text-sm text-muted-foreground dark:border-slate-600/50 dark:bg-slate-900/40">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <Keyboard className="h-4 w-4 shrink-0 opacity-70" />
          Klavye kısayolları
          <span className="ml-auto text-xs opacity-70 group-open:hidden">Aç</span>
        </summary>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/40 pt-3 text-xs">
          <span>
            <kbd className="rounded border bg-background px-1 py-0.5 font-mono">←</kbd>{' '}
            <kbd className="rounded border bg-background px-1 py-0.5 font-mono">→</kbd> slayt
          </span>
          <span>
            <kbd className="rounded border bg-background px-1 py-0.5 font-mono">F</kbd> tam ekran
          </span>
          <span>
            <kbd className="rounded border bg-background px-1 py-0.5 font-mono">Space</kbd> slayt aç/kapa
          </span>
          <span>
            <kbd className="rounded border bg-background px-1 py-0.5 font-mono">Esc</kbd> çık
          </span>
          {lastFetchAt && (
            <span className="w-full pt-1 text-[11px] text-muted-foreground sm:ml-auto sm:w-auto">
              Güncelleme: {formatRelativeTime(lastFetchAt)}
            </span>
          )}
        </div>
      </details>

      {fullscreenOverlay}
      </div>
    </div>
  );
}
