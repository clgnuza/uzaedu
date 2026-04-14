'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, HelpCircle, LayoutDashboard, MessageSquareText, School } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { RatingBadge } from '@/components/rating-badge';
import { ChevronRightIcon } from '@/components/icons';

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

type ReportTab = 'ozet' | 'kriterler' | 'yorumlar' | 'sorular';

const CRITERIA_BAR_COLORS = ['#f59e0b', '#8b5cf6', '#06b6d4', '#10b981', '#ec4899', '#6366f1', '#ef4444', '#84cc16'];

const TABS: {
  id: ReportTab;
  label: string;
  short: string;
  Icon: typeof LayoutDashboard;
  active: string;
  inactive: string;
}[] = [
  {
    id: 'ozet',
    label: 'Genel özet',
    short: 'Özet',
    Icon: LayoutDashboard,
    active: 'bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-400/40',
    inactive: 'bg-amber-500/12 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100',
  },
  {
    id: 'kriterler',
    label: 'Kriter grafikleri',
    short: 'Kriterler',
    Icon: BarChart3,
    active: 'bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30 ring-2 ring-violet-400/40',
    inactive: 'bg-violet-500/12 text-violet-900 dark:bg-violet-500/15 dark:text-violet-100',
  },
  {
    id: 'yorumlar',
    label: 'Son yorumlar',
    short: 'Yorumlar',
    Icon: MessageSquareText,
    active: 'bg-linear-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-sky-500/30 ring-2 ring-sky-400/40',
    inactive: 'bg-sky-500/12 text-sky-900 dark:bg-sky-500/15 dark:text-sky-100',
  },
  {
    id: 'sorular',
    label: 'Sorular & cevaplar',
    short: 'Sorular',
    Icon: HelpCircle,
    active: 'bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/40',
    inactive: 'bg-emerald-500/12 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-100',
  },
];

export default function SchoolReviewsReportPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [report, setReport] = useState<SchoolReviewsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReportTab>('ozet');

  const schoolId = me?.school_id ?? me?.school?.id;
  const schoolName = me?.school?.name ?? 'Okulunuz';

  const fetchReport = useCallback(async () => {
    if (!token || !schoolId || me?.role !== 'school_admin') return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<SchoolReviewsReport>(`/school-reviews/report/${schoolId}`, { token });
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

  const criteriaChartData = useMemo(() => {
    if (!report?.criteria?.length || !report.criteria_averages) return [];
    return report.criteria
      .filter((c) => report.criteria_averages![c.slug] != null)
      .map((c, i) => ({
        label: c.label,
        short: c.label.length > 16 ? `${c.label.slice(0, 14)}…` : c.label,
        ortalama: Number((report.criteria_averages![c.slug] ?? 0).toFixed(2)),
        max: c.max_score,
        fill: CRITERIA_BAR_COLORS[i % CRITERIA_BAR_COLORS.length],
      }));
  }, [report]);

  const chartXMax = useMemo(() => {
    if (criteriaChartData.length === 0) return 10;
    return Math.max(10, ...criteriaChartData.map((d) => d.max));
  }, [criteriaChartData]);

  const criteriaChartHeight = useMemo(() => {
    if (criteriaChartData.length === 0) return 260;
    return Math.min(480, Math.max(220, 48 + criteriaChartData.length * 40));
  }, [criteriaChartData.length]);

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
        <h1 className="text-xl font-semibold text-foreground">Okul değerlendirmesi</h1>
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!report) return null;

  const hasCriteriaChart = criteriaChartData.length > 0;
  const publicSchoolHref = schoolId ? `/okul-degerlendirmeleri?id=${encodeURIComponent(schoolId)}` : null;

  return (
    <div className="page-noise space-y-4 pb-10 sm:space-y-6">
      <nav className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm" aria-label="Breadcrumb">
        <Link href="/dashboard" className="transition-colors hover:text-foreground">
          Dashboard
        </Link>
        <ChevronRightIcon className="size-3.5 shrink-0 sm:size-4" />
        <span className="font-medium text-foreground">Okul değerlendirmesi</span>
      </nav>

      {/* Üst: okul adı + genel mesaj */}
      <div className="overflow-hidden rounded-2xl border border-violet-200/70 bg-linear-to-br from-violet-500/12 via-background to-sky-500/10 p-4 shadow-sm dark:border-violet-500/20 dark:from-violet-600/15 dark:to-sky-600/10 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-indigo-600 text-white shadow-md">
              <School className="size-6" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-300">Genel görünüm</p>
              <h1 className="text-lg font-bold leading-tight text-foreground sm:text-xl">{schoolName}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Öğretmenlerin okulunuza verdiği puanlar, kriter ortalamaları ve son etkileşimler — tek ekranda.
              </p>
            </div>
          </div>
          {publicSchoolHref ? (
            <Link
              href={publicSchoolHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-violet-300/60 bg-white/80 px-3 py-2 text-xs font-semibold text-violet-800 shadow-sm transition-colors hover:bg-violet-50 dark:border-violet-500/30 dark:bg-slate-900/60 dark:text-violet-200 dark:hover:bg-violet-950/50 sm:self-center"
            >
              Halka açık sayfa
            </Link>
          ) : null}
        </div>
      </div>

      {/* Renkli sekmeler — mobilde yatay kaydırma */}
      <div
        role="tablist"
        aria-label="Rapor bölümleri"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 pt-0.5 scrollbar-thin [scrollbar-color:rgba(100,100,120,0.35)_transparent] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {TABS.map(({ id, label, short, Icon, active, inactive }) => {
          const selected = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`sr-tab-${id}`}
              aria-controls={`sr-panel-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                'flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-2xl px-3.5 py-2.5 text-left text-sm font-semibold transition-all duration-200 sm:min-h-0 sm:px-4',
                selected ? active : inactive,
                !selected && 'hover:opacity-90 active:scale-[0.98]',
              )}
            >
              <Icon className="size-4 shrink-0 opacity-95" aria-hidden />
              <span className="max-sm:hidden">{label}</span>
              <span className="sm:hidden">{short}</span>
            </button>
          );
        })}
      </div>

      {/* Özet */}
      {tab === 'ozet' && (
        <div
          role="tabpanel"
          id="sr-panel-ozet"
          aria-labelledby="sr-tab-ozet"
          className="space-y-4 animate-in fade-in duration-200"
        >
          <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
            <Card className="overflow-hidden border-0 bg-linear-to-br from-amber-400/90 to-orange-500 text-white shadow-lg shadow-amber-500/25 dark:from-amber-600/90 dark:to-orange-700">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-sm font-semibold text-white/95">Genel ortalama</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-2 pb-5 pt-0">
                {report.avg_rating != null ? (
                  <>
                    <div
                      className="flex size-21 items-center justify-center rounded-full border-[3px] border-white/50 bg-white/15 shadow-inner"
                      aria-label={`Ortalama ${report.avg_rating.toFixed(1)} üzerinden 10`}
                    >
                      <span className="text-3xl font-black tabular-nums text-white">{report.avg_rating.toFixed(1)}</span>
                    </div>
                    <p className="text-center text-xs text-white/90">10 üzerinden özet puan</p>
                  </>
                ) : (
                  <p className="py-4 text-center text-sm text-white/85">Henüz ortalama için yeterli değerlendirme yok.</p>
                )}
                <p className="text-[11px] font-medium text-white/80">{report.review_count} değerlendirme</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 bg-linear-to-br from-sky-400 to-cyan-600 text-white shadow-lg shadow-sky-500/25 dark:from-sky-600 dark:to-cyan-800">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-sm font-semibold text-white/95">Yorum & puan</CardTitle>
              </CardHeader>
              <CardContent className="pb-5 pt-2">
                <p className="text-4xl font-black tabular-nums tracking-tight">{report.review_count}</p>
                <p className="mt-2 text-xs text-white/90">Toplam değerlendirme kaydı</p>
              </CardContent>
            </Card>

            <Card className="overflow-hidden border-0 bg-linear-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 dark:from-emerald-700 dark:to-teal-800">
              <CardHeader className="pb-1 pt-4">
                <CardTitle className="text-sm font-semibold text-white/95">Soru sayısı</CardTitle>
              </CardHeader>
              <CardContent className="pb-5 pt-2">
                <p className="text-4xl font-black tabular-nums tracking-tight">{report.question_count}</p>
                <p className="mt-2 text-xs text-white/90">Okulunuz hakkında sorulan sorular</p>
              </CardContent>
            </Card>
          </div>

          {report.review_count === 0 && (
            <Card className="border-dashed border-2 border-muted-foreground/25 bg-muted/20">
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Henüz değerlendirme yok. Öğretmenler okul değerlendirme modülünden puan ve yorum bıraktıkça burada özetlenecek.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Kriterler + grafik */}
      {tab === 'kriterler' && (
        <div
          role="tabpanel"
          id="sr-panel-kriterler"
          aria-labelledby="sr-tab-kriterler"
          className="space-y-4 animate-in fade-in duration-200"
        >
          {!hasCriteriaChart ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Kriter ortalaması gösterecek veri yok (değerlendirmelerde kriter puanı yok veya henüz kayıt yok).
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-violet-200/80 dark:border-violet-500/25">
                <CardHeader className="pb-0">
                  <CardTitle className="text-base font-bold text-violet-950 dark:text-violet-100">Kriterlere göre ortalamalar</CardTitle>
                  <p className="text-sm text-muted-foreground">Her çubuk, ilgili kriterdeki ortalama puanı gösterir (maksimuma göre).</p>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="w-full min-w-0" style={{ height: criteriaChartHeight }}>
                    <ResponsiveContainer width="100%" height={criteriaChartHeight} minWidth={0}>
                      <BarChart
                        layout="vertical"
                        data={criteriaChartData}
                        margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                        barCategoryGap={12}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/15" horizontal={false} />
                        <XAxis type="number" domain={[0, chartXMax]} tick={{ fontSize: 11 }} tickLine={false} />
                        <YAxis
                          type="category"
                          dataKey="short"
                          width={88}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'hsl(var(--muted) / 0.35)' }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.[0]) return null;
                            const row = payload[0].payload as (typeof criteriaChartData)[0];
                            return (
                              <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                                <p className="font-semibold text-foreground">{row.label}</p>
                                <p className="text-muted-foreground">
                                  Ortalama: <strong className="text-foreground">{row.ortalama}</strong> / {row.max}
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Bar dataKey="ortalama" radius={[0, 8, 8, 0]} maxBarSize={28}>
                          {criteriaChartData.map((e, i) => (
                            <Cell key={e.label + i} fill={e.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                {criteriaChartData.map((row) => {
                  const pct = (row.ortalama / Math.max(1, row.max)) * 100;
                  return (
                    <div
                      key={row.label}
                      className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm"
                      style={{ borderLeftWidth: 4, borderLeftColor: row.fill }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold leading-snug text-foreground">{row.label}</span>
                        <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">
                          {row.ortalama.toFixed(1)} / {row.max}
                        </span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: row.fill }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Yorumlar */}
      {tab === 'yorumlar' && (
        <div
          role="tabpanel"
          id="sr-panel-yorumlar"
          aria-labelledby="sr-tab-yorumlar"
          className="space-y-3 animate-in fade-in duration-200"
        >
          {report.recent_reviews.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Henüz değerlendirme yok.</CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {report.recent_reviews.map((r) => (
                <li
                  key={r.id}
                  className="rounded-2xl border border-sky-200/80 bg-linear-to-br from-sky-50/90 to-cyan-50/40 p-4 dark:border-sky-500/20 dark:from-sky-950/40 dark:to-cyan-950/20"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <RatingBadge rating={r.rating} max={10} size="sm" />
                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                  {r.criteria_ratings && report.criteria && Object.keys(r.criteria_ratings).length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {Object.entries(r.criteria_ratings).map(([slug, v]) => {
                        const crit = report.criteria!.find((x) => x.slug === slug);
                        return crit ? (
                          <span
                            key={slug}
                            className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-sky-900 shadow-sm dark:bg-sky-900/50 dark:text-sky-100"
                          >
                            {crit.label}: {v}
                          </span>
                        ) : null;
                      })}
                    </div>
                  )}
                  {r.comment ? <p className="text-sm leading-relaxed text-foreground/90">{r.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Sorular */}
      {tab === 'sorular' && (
        <div
          role="tabpanel"
          id="sr-panel-sorular"
          aria-labelledby="sr-tab-sorular"
          className="space-y-3 animate-in fade-in duration-200"
        >
          {report.recent_questions.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Henüz soru yok.</CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {report.recent_questions.map((q) => (
                <li
                  key={q.id}
                  className="rounded-2xl border border-emerald-200/80 bg-linear-to-br from-emerald-50/90 to-teal-50/40 p-4 dark:border-emerald-500/20 dark:from-emerald-950/35 dark:to-teal-950/20"
                >
                  <p className="font-semibold text-foreground">{q.question}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{new Date(q.created_at).toLocaleDateString('tr-TR')}</span>
                    <span aria-hidden>•</span>
                    <span>{q.answer_count} cevap</span>
                  </div>
                  {q.answers && q.answers.length > 0 && (
                    <div className="mt-3 space-y-2 border-l-4 border-emerald-400/60 pl-3 dark:border-emerald-500/50">
                      {q.answers.map((a) => (
                        <div key={a.id} className="rounded-xl bg-white/70 p-3 dark:bg-slate-900/50">
                          <p className="text-sm leading-relaxed text-foreground/90">{a.answer}</p>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            — {a.is_anonymous ? 'Anonim kullanıcı' : a.author_display_name} ·{' '}
                            {new Date(a.created_at).toLocaleDateString('tr-TR')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
