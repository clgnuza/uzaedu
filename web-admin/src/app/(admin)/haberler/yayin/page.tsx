'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
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
} from 'lucide-react';
import { contentReadPath } from '@/lib/content-read-path';
import { normalizeMebIlImageUrl } from '@/lib/meb-image-url';
import { CONTENT_TYPE_LABELS } from '@/lib/haber-news-overlay';
import { HaberOverlayBands } from '@/components/haber/haber-overlay-bands';

type Source = { id: string; key: string; label: string };
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
      <div className="flex h-full w-full items-center justify-center bg-slate-100 dark:bg-slate-900">
        <Newspaper className={cn('text-slate-400', isHero ? 'h-16 w-16' : 'h-12 w-12')} />
      </div>
    );
  }
  return (
    <img
      src={resolved}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className="h-full w-full object-cover motion-safe:transition-transform motion-safe:duration-500 motion-reduce:transition-none group-hover/card:scale-[1.03]"
    />
  );
}

/** Yayın kartı: gridde alt bar yok; yalnızca hero’da alt bilgi şeridi. */
function YayinBroadcastCard({ item, variant }: { item: ContentItem; variant: 'hero' | 'default' }) {
  const isHero = variant === 'hero';
  const typeLabel = CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type;

  const metaHero = (
    <div className="absolute inset-x-0 bottom-0 z-20 flex h-10 items-center justify-between gap-2 border-t border-sky-400/25 bg-slate-950/92 px-2.5 backdrop-blur-md sm:h-11 sm:px-3">
      <span className="inline-flex max-w-[44%] shrink-0 truncate rounded-md border border-sky-400/30 bg-sky-950/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-50">
        {typeLabel}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 text-[11px] text-slate-400 sm:text-xs">
        <span className="truncate font-medium text-slate-100">{item.source_label ?? 'Kaynak'}</span>
        {item.published_at && (
          <span className="flex shrink-0 items-center gap-1 tabular-nums text-slate-500">
            <Clock className="h-3.5 w-3.5 opacity-90" />
            {formatRelativeDate(item.published_at) || formatDate(item.published_at)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <Card
      className={cn(
        'group/card overflow-hidden border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-sky-50/35 shadow-[0_1px_3px_rgba(15,23,42,0.07)] transition-[box-shadow,border-color] duration-300 hover:border-sky-300/70 hover:shadow-[0_10px_40px_-16px_rgba(14,116,144,0.22)] dark:border-slate-700/85 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950/95 dark:hover:border-sky-700/50',
        isHero && 'mx-auto max-w-5xl ring-1 ring-sky-200/60 dark:ring-sky-900/45',
      )}
    >
      <a
        href={item.source_url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={item.title}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/80 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div
          className={cn(
            'relative overflow-hidden bg-slate-950 after:pointer-events-none after:absolute after:inset-0',
            isHero
              ? 'aspect-2/1 min-h-[200px] after:shadow-[inset_0_-40px_64px_-24px_rgba(15,23,42,0.55)] sm:aspect-21/9 sm:min-h-[260px]'
              : 'aspect-video after:shadow-[inset_0_-24px_40px_-14px_rgba(15,23,42,0.38)]',
          )}
        >
          {item.image_url ? (
            <NewsCardImage src={item.image_url} isHero={isHero} />
          ) : (
            <div className="flex h-full min-h-[120px] w-full items-center justify-center bg-slate-900">
              <Newspaper className={cn('text-slate-500', isHero ? 'h-16 w-16' : 'h-12 w-12')} />
            </div>
          )}
          <div
            className={cn(
              'pointer-events-none absolute inset-x-0 bg-linear-to-t to-transparent',
              isHero ? 'bottom-0 h-[58%] from-slate-950/92 via-slate-900/40' : 'bottom-0 h-[50%] from-slate-950/78 via-slate-900/30',
            )}
            aria-hidden
          />
          <HaberOverlayBands
            item={item}
            density={isHero ? 'broadcastHero' : 'broadcast'}
            compact={!isHero}
            bottomOffsetClass={isHero ? 'bottom-11 sm:bottom-12' : undefined}
          />
          {isHero && metaHero}
        </div>
      </a>
    </Card>
  );
}

const SLIDE_INTERVAL_OPTIONS = [
  { value: 5, label: '5 sn' },
  { value: 8, label: '8 sn' },
  { value: 10, label: '10 sn' },
  { value: 15, label: '15 sn' },
];

export default function HaberYayinPage() {
  const { token, me, loading: authLoading } = useAuth();
  const [sources, setSources] = useState<Source[]>([]);
  const [mebItems, setMebItems] = useState<ContentItem[]>([]);
  const [ilItems, setIlItems] = useState<ContentItem[]>([]);
  const [loadingMeb, setLoadingMeb] = useState(true);
  const [loadingIl, setLoadingIl] = useState(true);
  const [loadingSources, setLoadingSources] = useState(true);
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
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
  const allItems = [...mebItems];

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

  const fetchMebItems = useCallback(async () => {
    setLoadingMeb(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '24',
        channel_key: 'meb_duyurulari',
      });
      if (selectedSourceKey) params.set('source_key', selectedSourceKey);
      const data = await apiFetch<{ total: number; items: ContentItem[] }>(
        `${contentReadPath('items', token)}?${params}`,
        { token },
      );
      const raw = data?.items ?? [];
      setMebItems(dedupeContentItemsByUrl(raw));
      setSlideIndex(0);
      setLastFetchAt(new Date());
    } catch {
      setMebItems([]);
    } finally {
      setLoadingMeb(false);
    }
  }, [token, selectedSourceKey]);

  const fetchIlItems = useCallback(async () => {
    setLoadingIl(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '12',
        channel_key: 'il_duyurulari',
      });
      const data = await apiFetch<{ total: number; items: ContentItem[] }>(
        `${contentReadPath('items', token)}?${params}`,
        { token },
      );
      setIlItems(data?.items ?? []);
    } catch {
      setIlItems([]);
    } finally {
      setLoadingIl(false);
    }
  }, [token]);

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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchMebItems(), fetchIlItems()]);
    setRefreshing(false);
  }, [fetchMebItems, fetchIlItems]);

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
      <header className="relative overflow-hidden rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm ring-1 ring-border/30 backdrop-blur-sm sm:rounded-2xl sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 hidden h-36 w-36 rounded-full bg-primary/12 blur-3xl sm:block" aria-hidden />
        <div className="relative flex items-center justify-between gap-2 sm:items-start sm:justify-between sm:gap-5">
          <div className="min-w-0 flex-1 sm:space-y-2">
            <h1 className="text-balance text-lg font-bold tracking-tight text-foreground sm:text-2xl md:text-3xl">Haber yayını</h1>
            <p className="mt-1 hidden max-w-xl text-sm leading-relaxed text-muted-foreground md:block">
              MEB akışı, slayt ve tam ekran. Birim seçerek daraltın.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:flex-wrap sm:gap-2 sm:justify-end">
            <Link
              href="/haberler"
              className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background/80 text-sm font-medium shadow-sm transition-colors hover:bg-muted sm:size-auto sm:gap-2 sm:px-3.5 sm:py-2"
              title="Haberler"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Haberler</span>
            </Link>
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="size-9 shrink-0 rounded-xl border-border/80 p-0 sm:size-auto sm:px-3 sm:py-2"
                  onClick={handleRefresh}
                  disabled={refreshing}
                  title={refreshing ? 'Yenileniyor…' : 'Yenile'}
                >
                  <RefreshCw className={cn('h-4 w-4 sm:mr-1.5', refreshing && 'animate-spin')} />
                  <span className="hidden sm:inline">{refreshing ? '…' : 'Yenile'}</span>
                </Button>
                {me?.role === 'superadmin' && (
                  <Link
                    href="/haberler/ayarlar"
                    className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-background/80 text-sm font-medium shadow-sm transition-colors hover:bg-muted sm:size-auto sm:gap-2 sm:px-3.5 sm:py-2"
                    title="Ayarlar"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Ayarlar</span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-xl border border-border/50 bg-gradient-to-b from-muted/20 to-background/90 shadow-sm backdrop-blur-md sm:rounded-2xl sm:from-muted/15">
        <div className="p-2 sm:p-4">
          {(sources.length > 0 || loadingSources) && (
            <div className="space-y-1.5 sm:space-y-2">
              <div className="hidden items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:flex">
                <Layers className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                MEB birimi
              </div>
              {loadingSources ? (
                <div className="h-10 w-full animate-pulse rounded-2xl bg-muted/80 sm:h-11" aria-hidden />
              ) : (
                <div className="mobile-tab-scroll flex gap-1.5 overscroll-x-contain pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
                  <div className="inline-flex w-max max-w-none flex-nowrap gap-1 rounded-2xl border border-sky-200/50 bg-sky-50/40 p-1 dark:border-sky-500/20 dark:bg-sky-950/25 sm:w-auto sm:max-w-full sm:flex-wrap sm:gap-1.5 sm:p-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSourceKey('')}
                      className={cn(
                        'min-h-8 shrink-0 rounded-xl px-2.5 py-1 text-left text-[11px] font-medium transition-all sm:min-h-9 sm:px-3 sm:text-sm',
                        !selectedSourceKey
                          ? 'border border-sky-300/60 bg-white text-sky-900 shadow-sm dark:border-sky-500/35 dark:bg-sky-900/50 dark:text-sky-50'
                          : 'border border-transparent text-muted-foreground hover:border-sky-200/50 hover:bg-white/70 hover:text-foreground dark:hover:border-sky-500/25 dark:hover:bg-sky-950/40',
                      )}
                    >
                      Tümü
                    </button>
                    {sources.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        title={s.label}
                        onClick={() => setSelectedSourceKey(s.key)}
                        className={cn(
                          'max-w-[min(85vw,16rem)] min-h-8 shrink-0 rounded-xl px-2.5 py-1 text-left text-[11px] font-medium transition-all sm:min-h-9 sm:max-w-[16rem] sm:px-3 sm:text-sm',
                          selectedSourceKey === s.key
                            ? 'border border-sky-300/60 bg-white text-sky-900 shadow-sm dark:border-sky-500/35 dark:bg-sky-900/50 dark:text-sky-50'
                            : 'border border-transparent text-muted-foreground hover:border-sky-200/50 hover:bg-white/70 hover:text-foreground dark:hover:border-sky-500/25 dark:hover:bg-sky-950/40',
                        )}
                      >
                        <span className="line-clamp-1">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              'mt-3 flex min-h-12 min-w-0 w-full max-w-full flex-wrap items-center gap-2 border-t border-border/40 pt-3 dark:border-slate-700/50 sm:gap-2.5',
              !(sources.length > 0 || loadingSources) && 'mt-0 border-t-0 pt-0',
            )}
          >
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
        <Card className="border-slate-200/90 bg-gradient-to-br from-white via-slate-50/40 to-sky-50/35 shadow-sm dark:border-slate-700/85 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
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

      <section className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-emerald-50/50 via-white to-sky-50/30 p-4 shadow-sm ring-1 ring-emerald-200/30 dark:border-slate-700/80 dark:from-emerald-950/30 dark:via-slate-950 dark:to-slate-950 dark:ring-emerald-900/30 sm:rounded-2xl sm:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/60 bg-emerald-500/10 text-emerald-700 dark:border-emerald-800/50 dark:text-emerald-400">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              {userCity ? `${userCity} · İl haberleri` : 'İl haberleri'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {userCity ? 'İl duyuruları' : 'Okul profilinde il gerekir'}
            </p>
          </div>
        </div>

        {!userCity ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            İl listesi için okul profilinizde il tanımlayın.
          </p>
        ) : loadingIl ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : ilItems.length === 0 ? (
          <EmptyState
            icon={<Newspaper className="size-10 text-muted-foreground" />}
            title={`${userCity} için henüz haber yok`}
            description="Senkron sonrası il duyuruları burada görünür."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {ilItems.slice(0, 8).map((item) => (
              <YayinBroadcastCard key={item.id} item={item} variant="default" />
            ))}
          </div>
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
