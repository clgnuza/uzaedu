'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';
import { Heart, MapPin, Star, MessageSquare, MessageCircleQuestion, ExternalLink, Trash2 } from 'lucide-react';
import { StarIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

type SchoolWithStats = {
  id: string;
  name: string;
  type: string;
  segment: string;
  city: string | null;
  district: string | null;
  avg_rating: number | null;
  review_count: number;
  question_count: number;
};

/** Mobil: yumuşak, birbiriyle uyumlu vurgular (döngüsel) */
const CARD_ACCENT = [
  {
    border: 'border-sky-200/85 dark:border-sky-800/50',
    bar: 'bg-sky-500/90',
    titleHover: 'group-hover:text-sky-700 dark:group-hover:text-sky-300',
    chip: 'bg-sky-100/90 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200',
  },
  {
    border: 'border-violet-200/85 dark:border-violet-800/50',
    bar: 'bg-violet-500/85',
    titleHover: 'group-hover:text-violet-700 dark:group-hover:text-violet-300',
    chip: 'bg-violet-100/90 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200',
  },
  {
    border: 'border-teal-200/85 dark:border-teal-800/50',
    bar: 'bg-teal-500/85',
    titleHover: 'group-hover:text-teal-700 dark:group-hover:text-teal-300',
    chip: 'bg-teal-100/90 text-teal-900 dark:bg-teal-950/50 dark:text-teal-200',
  },
  {
    border: 'border-amber-200/80 dark:border-amber-800/50',
    bar: 'bg-amber-500/80',
    titleHover: 'group-hover:text-amber-800 dark:group-hover:text-amber-300',
    chip: 'bg-amber-100/90 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200',
  },
] as const;

export default function FavorilerPage() {
  const { token, me } = useAuth();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<SchoolWithStats[]>('/school-reviews/favorites', { token });
      setSchools(Array.isArray(data) ? data : []);
    } catch {
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRemove = async (schoolId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!token) return;
    setRemovingId(schoolId);
    try {
      await apiFetch(`/school-reviews/schools/${schoolId}/favorite`, { token, method: 'DELETE' });
      setSchools((prev) => prev.filter((s) => s.id !== schoolId));
      toast.success('Favorilerden çıkarıldı');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'İşlem yapılamadı');
    } finally {
      setRemovingId(null);
    }
  };

  const canView =
    me && (me.role === 'teacher' || me.role === 'moderator' || me.role === 'superadmin');

  if (!me || !canView) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="relative space-y-3 sm:space-y-6">
      <div
        className="pointer-events-none absolute inset-x-0 -top-2 -z-10 h-40 rounded-2xl opacity-90 sm:h-48"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 70% at 50% -20%, rgba(244, 63, 94, 0.07), transparent 55%), radial-gradient(ellipse 60% 50% at 100% 0%, rgba(59, 130, 246, 0.06), transparent 50%)',
        }}
      />

      <Toolbar className="max-sm:py-0">
        <ToolbarHeading>
          <ToolbarPageTitle className="flex items-center gap-2 text-lg font-bold tracking-tight sm:gap-3 sm:text-2xl">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-600 shadow-sm dark:bg-rose-950/50 dark:text-rose-400 sm:h-9 sm:w-9">
              <Heart className="size-4 sm:size-5" fill="currentColor" />
            </span>
            Favorilerim
          </ToolbarPageTitle>
          <div className="max-sm:hidden">
            <ToolbarIconHints
              items={[
                { label: 'Favori okullar', icon: Heart },
                { label: 'Değerlendirme', icon: Star },
                { label: 'Konum', icon: MapPin },
              ]}
              summary="Okul Değerlendirmelerinde favorilere eklediğiniz okullar"
            />
          </div>
        </ToolbarHeading>
      </Toolbar>

      {loading ? (
        <div className="grid grid-cols-1 gap-2 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-slate-200/80 bg-white/80 dark:border-slate-700 dark:bg-slate-900/50"
            >
              <div className="h-1 animate-pulse bg-slate-200 dark:bg-slate-700" />
              <div className="space-y-2 p-2.5 sm:p-4">
                <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
                <div className="flex gap-2 pt-1">
                  <div className="h-5 w-12 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100 dark:bg-slate-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : schools.length === 0 ? (
        <Card className="border border-dashed border-slate-300/80 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-900/40">
          <EmptyState
            icon={<Heart className="size-8 text-rose-400 sm:size-10" />}
            title="Henüz favori okul yok"
            description="Okul Değerlendirmeleri sayfasından beğendiğiniz okulları kalp ikonu ile favorilere ekleyebilirsiniz."
            action={
              <Link
                href="/okul-degerlendirmeleri"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-slate-900 sm:px-4 sm:text-sm dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                <ExternalLink className="size-3.5 sm:size-4" />
                Okulları keşfet
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {schools.map((school, index) => {
            const a = CARD_ACCENT[index % CARD_ACCENT.length]!;
            return (
              <Link
                key={school.id}
                href={`/okul-degerlendirmeleri?id=${school.id}`}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                <Card
                  className={cn(
                    'overflow-hidden border bg-gradient-to-br from-white/95 to-slate-50/40 shadow-sm transition-[box-shadow,transform] duration-200 active:scale-[0.99] dark:from-slate-950/90 dark:to-slate-900/80 sm:active:scale-100',
                    a.border,
                    'hover:shadow-md dark:hover:shadow-slate-950/40',
                  )}
                >
                  <div className={cn('h-1 w-full shrink-0', a.bar)} aria-hidden />
                  <CardContent className="relative p-2.5 sm:p-4">
                    <div className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">
                      <button
                        type="button"
                        onClick={(e) => handleRemove(school.id, e)}
                        disabled={removingId === school.id}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-rose-400"
                        aria-label="Favorilerden çıkar"
                        title="Favorilerden çıkar"
                      >
                        <Trash2 className="size-3.5 sm:size-4" />
                      </button>
                    </div>
                    <h3
                      className={cn(
                        'pr-10 text-sm font-semibold leading-snug text-slate-900 line-clamp-2 dark:text-slate-50 sm:pr-12 sm:text-base',
                        a.titleHover,
                      )}
                    >
                      {school.name}
                    </h3>
                    {school.city && (
                      <p className="mt-1 flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                        <MapPin className="mt-0.5 size-3 shrink-0 text-slate-400" />
                        <span className="line-clamp-1">
                          {school.district ? `${school.district}, ${school.city}` : school.city}
                        </span>
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      {school.avg_rating != null && (
                        <span
                          className={cn(
                            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums sm:gap-1 sm:px-2 sm:text-xs',
                            a.chip,
                          )}
                        >
                          <StarIcon size={10} filled className="text-current opacity-90" />
                          {school.avg_rating.toFixed(1)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 sm:text-xs">
                        <MessageSquare className="size-3 shrink-0" />
                        {school.review_count}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-500 dark:text-slate-400 sm:text-xs">
                        <MessageCircleQuestion className="size-3 shrink-0" />
                        {school.question_count}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 sm:mt-3 sm:text-xs">
                      <ExternalLink className="size-3 shrink-0" />
                      Detay
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
