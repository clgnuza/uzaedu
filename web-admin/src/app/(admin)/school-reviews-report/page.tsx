'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { RatingBadge } from '@/components/rating-badge';
import { StarIcon, MessageIcon, HelpIcon, BarChartIcon, SchoolIcon, ChevronRightIcon } from '@/components/icons';

type Criteria = { id: string; slug: string; label: string; hint: string | null; min_score: number; max_score: number };

type SchoolReviewsReport = {
  school_id: string;
  avg_rating: number | null;
  review_count: number;
  question_count: number;
  criteria: Criteria[] | null;
  criteria_averages: Record<string, number> | null;
  recent_reviews: Array<{
    id: string;
    rating: number;
    criteria_ratings: Record<string, number> | null;
    comment: string | null;
    created_at: string;
  }>;
  recent_questions: Array<{
    id: string;
    question: string;
    created_at: string;
    answer_count: number;
    answers?: Array<{
      id: string;
      answer: string;
      created_at: string;
      author_display_name: string;
      is_anonymous?: boolean;
    }>;
  }>;
};

export default function SchoolReviewsReportPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [report, setReport] = useState<SchoolReviewsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const schoolId = me?.school_id ?? me?.school?.id;

  const fetchReport = useCallback(async () => {
    if (!token || !schoolId || me?.role !== 'school_admin') return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SchoolReviewsReport>(
        `/school-reviews/report/${schoolId}`,
        { token }
      );
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Rapor yüklenemedi');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [token, schoolId, me?.role]);

  useEffect(() => {
    if (me?.role !== 'school_admin') {
      router.replace('/403');
      return;
    }
    if (schoolId) fetchReport();
    else setLoading(false);
  }, [me?.role, schoolId, router, fetchReport]);

  if (me?.role !== 'school_admin') return null;

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner className="size-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Okul Değerlendirme Raporu</h1>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!report) return null;

  return (
    <div className="page-noise space-y-6">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRightIcon className="size-4" />
        <span className="text-foreground font-medium">Okul Değerlendirme Raporu</span>
      </nav>
      <div className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
          <SchoolIcon className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Okul Değerlendirme Raporu</h1>
          <p className="text-sm text-muted-foreground">
            Okulunuza yapılan değerlendirmeler ve kriter puanları özeti.
          </p>
        </div>
      </div>

      {/* Özet kartları – göz yormayan tonlar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-slate-200/80 bg-slate-50/50 dark:border-slate-700/50 dark:bg-slate-900/30 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 motion-reduce:transition-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Ortalama Puan</CardTitle>
            <StarIcon size={16} filled className="text-amber-600/80 dark:text-amber-500/80" />
          </CardHeader>
          <CardContent>
            {report.avg_rating != null ? (
              <RatingBadge rating={report.avg_rating} max={10} size="md" />
            ) : (
              <div className="text-2xl font-bold text-slate-400">—</div>
            )}
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{report.review_count} değerlendirme</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-slate-50/50 dark:border-slate-700/50 dark:bg-slate-900/30 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 motion-reduce:transition-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Değerlendirme</CardTitle>
            <MessageIcon className="size-4 text-sky-600/80 dark:text-sky-500/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{report.review_count}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Yorum ve puan</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200/80 bg-slate-50/50 dark:border-slate-700/50 dark:bg-slate-900/30 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 motion-reduce:transition-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-700 dark:text-slate-300">Soru Sayısı</CardTitle>
            <HelpIcon className="size-4 text-teal-600/80 dark:text-teal-500/80" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{report.question_count}</div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Okul hakkında sorular</p>
          </CardContent>
        </Card>
      </div>

      {/* Kriter bazlı puanlar – her kriter için ortalama */}
      {report.criteria_averages && report.criteria && Object.keys(report.criteria_averages).length > 0 && (
        <Card className="border-slate-200/80 shadow-sm dark:border-slate-700/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
              <BarChartIcon className="size-5 text-slate-600 dark:text-slate-400" />
              Kriter Bazlı Ortalama Puanlar
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Her kriter için öğretmen değerlendirmelerinin ortalaması
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {(report.criteria || [])
              .filter((c) => report.criteria_averages?.[c.slug] != null)
              .map((c) => {
                const avg = report.criteria_averages?.[c.slug] ?? 0;
                const pct = (avg / Math.max(1, c.max_score)) * 100;
                return (
                  <div key={c.id} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {c.label}
                        {c.hint && (
                          <span className="ml-1 font-normal text-slate-500 dark:text-slate-500">({c.hint})</span>
                        )}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {avg.toFixed(1)} / {c.max_score}
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/50">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 dark:from-sky-500/80 dark:to-teal-500/80 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Son değerlendirmeler */}
      <Card className="border-slate-200/80 shadow-sm dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Son Değerlendirmeler</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">En son yapılan yorumlar (yazar bilgisi gizli)</p>
        </CardHeader>
        <CardContent>
          {report.recent_reviews.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Henüz değerlendirme yok.</p>
          ) : (
            <ul className="space-y-4">
              {report.recent_reviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-sm dark:border-slate-700/50 dark:bg-slate-900/20"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <RatingBadge rating={r.rating} max={10} size="sm" />
                    <span className="text-xs text-slate-500 dark:text-slate-500">
                      {new Date(r.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </div>
                  {r.criteria_ratings && report.criteria && Object.keys(r.criteria_ratings).length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {Object.entries(r.criteria_ratings).map(([slug, v]) => {
                        const crit = report.criteria!.find((x) => x.slug === slug);
                        return crit ? (
                          <span
                            key={slug}
                            className="rounded-full bg-slate-200/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700/50 dark:text-slate-400"
                          >
                            {crit.label}: {v}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  {r.comment && (
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{r.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Son sorulan sorular */}
      <Card className="border-slate-200/80 shadow-sm dark:border-slate-700/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-100">Son Sorulan Sorular</CardTitle>
          <p className="text-sm text-slate-500 dark:text-slate-400">Okulunuz hakkında sorulan sorular</p>
        </CardHeader>
        <CardContent>
          {report.recent_questions.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">Henüz soru yok.</p>
          ) : (
            <ul className="space-y-4">
              {report.recent_questions.map((q) => (
                <li
                  key={q.id}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 text-sm dark:border-slate-700/50 dark:bg-slate-900/20"
                >
                  <p className="font-medium text-slate-800 dark:text-slate-100">{q.question}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
                    <span>{new Date(q.created_at).toLocaleDateString('tr-TR')}</span>
                    <span>•</span>
                    <span>{q.answer_count} cevap</span>
                  </div>
                  {q.answers && q.answers.length > 0 && (
                    <div className="mt-3 space-y-2 border-l-2 border-slate-200/80 pl-3 dark:border-slate-700/50">
                      {q.answers.map((a) => (
                        <div key={a.id} className="rounded-lg bg-white/60 p-2.5 dark:bg-slate-800/40">
                          <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{a.answer}</p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            — {a.is_anonymous ? 'Anonim kullanıcı' : a.author_display_name} · {new Date(a.created_at).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
