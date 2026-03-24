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

  if (!me || (me.role !== 'teacher' && me.role !== 'superadmin')) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <Heart className="size-5" fill="currentColor" />
            </span>
            Favorilerim
          </ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Favori okullar', icon: Heart },
              { label: 'Değerlendirme', icon: Star },
              { label: 'Konum', icon: MapPin },
            ]}
            summary="Okul Değerlendirmelerinde favorilere eklediğiniz okullar"
          />
        </ToolbarHeading>
      </Toolbar>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden border-slate-200/80 dark:border-slate-800">
              <CardContent className="p-0">
                <div className="h-32 animate-pulse bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900" />
                <div className="space-y-2 p-4">
                  <div className="h-5 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
                  <div className="h-4 w-1/2 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : schools.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 dark:border-slate-700">
          <EmptyState
            icon={<Heart className="size-10" />}
            title="Henüz favori okul yok"
            description="Okul Değerlendirmeleri sayfasından beğendiğiniz okulları kalp ikonu ile favorilere ekleyebilirsiniz."
            action={
              <Link
                href="/okul-degerlendirmeleri"
                className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-600"
              >
                <ExternalLink className="size-4" />
                Okulları Keşfet
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((school) => (
            <Link
              key={school.id}
              href={`/okul-degerlendirmeleri?id=${school.id}`}
              className="group block"
            >
              <Card className="overflow-hidden border-slate-200/80 transition-all duration-300 hover:border-rose-200 hover:shadow-lg hover:shadow-rose-500/5 dark:border-slate-800 dark:hover:border-rose-900/50">
                <div className="relative bg-gradient-to-br from-rose-50/80 via-white to-amber-50/50 dark:from-rose-950/20 dark:via-slate-900 dark:to-amber-950/10">
                  <div className="absolute right-3 top-3">
                    <button
                      type="button"
                      onClick={(e) => handleRemove(school.id, e)}
                      disabled={removingId === school.id}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/50 dark:hover:text-rose-400"
                      aria-label="Favorilerden çıkar"
                      title="Favorilerden çıkar"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex h-24 items-center justify-center px-6">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/80 shadow-sm dark:bg-slate-800/80">
                      <Heart className="size-7 text-rose-500" fill="currentColor" />
                    </span>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 group-hover:text-rose-600 dark:text-white dark:group-hover:text-rose-400 line-clamp-2">
                    {school.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    {school.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" />
                        {school.district ? `${school.district}, ${school.city}` : school.city}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {school.avg_rating != null && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        <StarIcon size={12} filled className="text-amber-500" />
                        {school.avg_rating.toFixed(1)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <MessageSquare className="size-3.5" />
                      {school.review_count} değerlendirme
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <MessageCircleQuestion className="size-3.5" />
                      {school.question_count} soru
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400">
                    <ExternalLink className="size-3.5" />
                    Detayları görüntüle
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
