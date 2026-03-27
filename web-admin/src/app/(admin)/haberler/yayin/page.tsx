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
  ExternalLink,
  ArrowLeft,
  MapPin,
  Sparkles,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

function stripHtml(html: string | null): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
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

function IlNewsCard({ item }: { item: ContentItem }) {
  const [imgError, setImgError] = useState(false);
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md hover:border-emerald-300/60 dark:hover:border-emerald-700/60 group">
      <a
        href={item.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-[72px] flex-row sm:h-20"
      >
        <div className="relative h-[72px] w-20 min-w-[80px] shrink-0 overflow-hidden bg-muted sm:h-20">
          {item.image_url && !imgError ? (
            <img
              src={normalizeMebIlImageUrl(item.image_url) ?? item.image_url}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Newspaper className="h-6 w-6 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
          <div>
            <span className="mb-1 inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
              {item.source_label ?? 'İl MEB'}
            </span>
            <h3 className="line-clamp-2 text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
              {item.title}
            </h3>
            {item.published_at && (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatRelativeDate(item.published_at) || formatDate(item.published_at)}
              </span>
            )}
          </div>
          <span className="mt-1.5 inline-flex w-fit items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <ExternalLink className="h-3 w-3" />
            Kaynağa git
          </span>
        </div>
      </a>
    </Card>
  );
}

function NewsCardImage({ src, isHero }: { src: string; isHero: boolean }) {
  const [error, setError] = useState(false);
  const resolved = normalizeMebIlImageUrl(src) ?? src;
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <Newspaper className={cn('text-muted-foreground', isHero ? 'h-16 w-16' : 'h-12 w-12')} />
      </div>
    );
  }
  return (
    <img
      src={resolved}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setError(true)}
      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    />
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

  function NewsCard({ item, variant = 'default' }: { item: ContentItem; variant?: 'hero' | 'default' }) {
    const isHero = variant === 'hero';
    return (
      <Card className="overflow-hidden transition-all hover:shadow-lg group">
        <a
          href={item.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          <div className={cn('relative overflow-hidden', isHero ? 'aspect-21/9 min-h-[180px]' : 'aspect-video')}>
            {item.image_url ? (
              <NewsCardImage src={item.image_url} isHero={isHero} />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted">
                <Newspaper className={cn('text-muted-foreground', isHero ? 'h-16 w-16' : 'h-12 w-12')} />
              </div>
            )}
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
              <h3 className={cn(
                'font-semibold leading-snug text-white',
                isHero ? 'text-lg sm:text-xl line-clamp-3' : 'text-base line-clamp-2',
              )}>
                {item.title}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
                <span className="rounded-md bg-white/25 px-2 py-0.5 text-xs font-medium backdrop-blur-sm">
                  {item.source_label ?? 'MEB'}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatRelativeDate(item.published_at) || formatDate(item.published_at)}
                </span>
              </div>
            </div>
          </div>
          {isHero && item.summary && stripHtml(item.summary) && (
            <div className="border-t border-border p-4 sm:p-5">
              <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                {stripHtml(item.summary)}
              </p>
              <span className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
                <ExternalLink className="h-4 w-4" />
                Kaynağa git
              </span>
            </div>
          )}
        </a>
      </Card>
    );
  }

  const fullscreenOverlay = fullscreenMode && allItems.length > 0 && (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-border bg-card/95 px-4 py-2 shadow-lg backdrop-blur-sm">
      <button
        onClick={goPrev}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted transition-colors hover:bg-muted/80"
        aria-label="Önceki"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span className="min-w-14 text-center text-sm font-medium text-muted-foreground">
        {slideIndex + 1} / {allItems.length}
      </span>
      <button
        onClick={goNext}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted transition-colors hover:bg-muted/80"
        aria-label="Sonraki"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <span className="mx-2 h-5 w-px bg-border" />
      <button
        onClick={exitFullscreen}
        className="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        Esc ile çık
      </button>
    </div>
  );

  return (
    <div ref={containerRef} className="relative">
      {/* Bulutsu arka plan – yumuşak renk geçişi */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 rounded-2xl"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 10%, rgba(59, 130, 246, 0.15) 0%, transparent 55%),
            radial-gradient(ellipse 60% 40% at 85% 85%, rgba(34, 197, 94, 0.1) 0%, transparent 50%),
            radial-gradient(ellipse 70% 60% at 50% 50%, rgba(147, 197, 253, 0.08) 0%, transparent 65%),
            linear-gradient(180deg, hsl(var(--background)) 0%, hsl(220 14% 96%) 35%, hsl(214 32% 91%) 100%)
          `,
        }}
      />
      <div className="space-y-5">
      {/* Başlık */}
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card/80 p-5 shadow-sm ring-1 ring-border/30 backdrop-blur-sm sm:p-6">
        <div
          className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/12 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Canlı önizleme
            </div>
            <h1 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Haber Yayını
            </h1>
            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              MEB içeriklerini slayt veya tam ekranda sunun; birim seçerek akışı daraltın.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Link
              href="/haberler"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3.5 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Haberler</span>
            </Link>
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-border/80"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={cn('mr-1.5 h-4 w-4', refreshing && 'animate-spin')} />
                  <span className="hidden sm:inline">{refreshing ? 'Yenileniyor…' : 'Yenile'}</span>
                </Button>
                {me?.role === 'superadmin' && (
                  <Link
                    href="/haberler/ayarlar"
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3.5 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
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

      {/* Sticky: birim + oynatıcı */}
      <div className="sticky top-0 z-1 w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-border/70 bg-background/90 shadow-md ring-1 ring-border/40 backdrop-blur-md">
        {(sources.length > 0 || loadingSources) && (
          <>
            <div className="border-b border-border/50 px-4 pb-3 pt-4 md:hidden">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" />
                MEB birimi
              </div>
              {loadingSources ? (
                <div className="h-11 w-full animate-pulse rounded-xl bg-muted" aria-hidden />
              ) : (
                <Select
                  value={selectedSourceKey || '__all'}
                  onValueChange={(v) => setSelectedSourceKey(v === '__all' ? '' : v)}
                >
                  <SelectTrigger id="yayin-birim-select" className="h-11 w-full min-w-0 rounded-xl border-border/80 bg-muted/30">
                    <SelectValue placeholder="Birim seçin" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[min(70vh,24rem)] w-(--radix-select-trigger-width)">
                    <SelectItem value="__all">Tümü</SelectItem>
                    {sources.map((s) => (
                      <SelectItem key={s.id} value={s.key}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="hidden border-b border-border/50 px-4 pb-3 pt-4 md:block">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" />
                MEB birimi
              </div>
              <div className="w-full min-w-0 rounded-xl bg-muted/60 p-1 ring-1 ring-border/40">
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => setSelectedSourceKey('')}
                    className={cn(
                      'min-h-9 shrink-0 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all sm:px-3 sm:text-sm',
                      !selectedSourceKey
                        ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                        : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                    )}
                  >
                    Tümü
                  </button>
                  {!loadingSources &&
                    sources.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        title={s.label}
                        onClick={() => setSelectedSourceKey(s.key)}
                        className={cn(
                          'max-w-full min-h-9 shrink-0 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all sm:max-w-[16rem] sm:px-3 sm:text-sm',
                          selectedSourceKey === s.key
                            ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20'
                            : 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
                        )}
                      >
                        <span className="line-clamp-2 sm:line-clamp-1">{s.label}</span>
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div
          className={cn(
            'flex min-h-13 min-w-0 w-full max-w-full flex-wrap items-center gap-2 px-4 py-3',
            !(sources.length > 0 || loadingSources) && 'pt-4',
          )}
        >
          <span className="mr-1 hidden text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
            Oynatıcı
          </span>
          <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-2.5 py-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <select
              value={slideIntervalSec}
              onChange={(e) => setSlideIntervalSec(Number(e.target.value))}
              className="max-w-22 cursor-pointer bg-transparent text-xs font-semibold text-foreground focus:outline-none"
            >
              {SLIDE_INTERVAL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {allItems.length > 0 && (
            <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={goPrev}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Önceki"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-14 px-1 text-center text-xs font-semibold tabular-nums text-foreground">
                {slideIndex + 1} / {allItems.length}
              </span>
              <button
                type="button"
                onClick={goNext}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
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
              'inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-all',
              slideMode
                ? 'bg-primary text-primary-foreground shadow-md ring-1 ring-primary/25'
                : 'border border-border/60 bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {slideMode ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {slideMode ? 'Durdur' : 'Slayt'}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Tam ekran (F)"
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {fullscreenMode ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{fullscreenMode ? 'Küçült' : 'Tam ekran'}</span>
          </button>

          {lastFetchAt && (
            <span className="ml-auto text-[11px] text-muted-foreground sm:text-xs">
              Güncellendi: {formatRelativeTime(lastFetchAt)}
            </span>
          )}
        </div>
      </div>

      {/* İçerik alanı */}
      {loadingMeb ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : mebItems.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={<Newspaper className="size-10 text-muted-foreground" />}
              title="Bu birimde henüz içerik yok"
              description="Senkronizasyon sonrası haberler burada görünecek. Haberler sayfasından Senkronize Et ile veri çekebilirsiniz."
            />
          </CardContent>
        </Card>
      ) : (slideMode || fullscreenMode) && currentSlideItem ? (
        <div className={cn(fullscreenMode && 'flex min-h-[60vh] items-center justify-center')}>
          <div className="w-full max-w-4xl">
            <NewsCard item={currentSlideItem} variant="hero" />
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {mebHero && <NewsCard item={mebHero} variant="hero" />}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {mebRest.slice(0, 8).map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* İl Haberleri – farklı tasarım: emerald ton, yatay kartlar */}
      <Card className="overflow-hidden border-emerald-200/60 bg-linear-to-br from-emerald-50/50 to-transparent dark:border-emerald-900/40 dark:from-emerald-950/20">
        <div className="border-l-4 border-emerald-500">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  {userCity ? `${userCity} İl Haberleri` : 'İl Haberleri'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {userCity ? 'İlinize özel duyurular' : 'Okul profilinizde il tanımlı olmalı'}
                </p>
              </div>
            </div>

            {!userCity ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  İl haberlerini görmek için okul profilinizde il bilgisi tanımlı olmalıdır.
                </p>
              </div>
            ) : loadingIl ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : ilItems.length === 0 ? (
              <EmptyState
                icon={<Newspaper className="size-10 text-muted-foreground" />}
                title={`${userCity} için henüz haber yok`}
                description="İl millî eğitim duyuruları senkronize edildiğinde burada listelenecek."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {ilItems.slice(0, 8).map((item) => (
                  <IlNewsCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </CardContent>
        </div>
      </Card>

      {/* Alt bölüm: Kısayollar, Yenile, Ayarlar */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Klavye kısayolları
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs">←</kbd>
                <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs">→</kbd>
                Önceki/Sonraki
                <span className="text-border">·</span>
                <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs">F</kbd>
                Tam ekran
                <span className="text-border">·</span>
                <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs">Space</kbd>
                Slayt başlat/durdur
                <span className="text-border">·</span>
                <kbd className="rounded border border-border bg-muted/50 px-1.5 py-0.5 font-mono text-xs">Esc</kbd>
                Tam ekrandan çık
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
              <span className="text-xs text-muted-foreground">
                Son güncelleme: {formatRelativeTime(lastFetchAt)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {fullscreenOverlay}
      </div>
    </div>
  );
}
