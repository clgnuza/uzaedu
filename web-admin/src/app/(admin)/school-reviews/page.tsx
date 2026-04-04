'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useDebounce } from '@/hooks/use-debounce';
import { apiFetch, getApiUrl } from '@/lib/api';
import { scoreRatio01 } from '@/lib/school-review-score';
import { emptySchoolReviewForm, schoolReviewFormFromReview } from '@/lib/school-review-prefill';
import { CriteriaRatingsDisplay } from '@/components/school-reviews/criteria-ratings-display';
import { SchoolReviewScorePicker } from '@/components/school-reviews/school-review-score-picker';
import { formatTrDateTimeMedium } from '@/lib/format-tr-datetime';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { RatingBadge } from '@/components/rating-badge';
import { SchoolTypeIcon } from '@/components/school-type-icon';
import { toast } from 'sonner';
import {
  MessageSquare,
  Eye,
  ChevronRight,
  Search,
  MapPin,
  MessageCircleQuestion,
  Send,
  Reply,
  School,
  BarChart3,
  Sparkles,
  X,
  Trash2,
  Pencil,
} from 'lucide-react';
type School = {
  id: string;
  name: string;
  type: string;
  segment: string;
  city: string | null;
  district: string | null;
};

type SchoolWithStats = School & {
  avg_rating: number | null;
  review_count: number;
  question_count: number;
};

type Criteria = { id: string; slug: string; label: string; hint: string | null; min_score: number; max_score: number };

type SchoolDetail = SchoolWithStats & {
  criteria: Criteria[] | null;
  criteria_averages: Record<string, number> | null;
  review_view_count?: number;
};

type Review = {
  id: string;
  rating: number;
  criteria_ratings: Record<string, number> | null;
  comment: string | null;
  created_at: string;
  is_anonymous: boolean;
  status?: 'pending' | 'approved' | 'hidden';
  author_display_name: string;
  is_own?: boolean;
};

type Question = {
  id: string;
  question: string;
  created_at: string;
  author_display_name: string;
  is_anonymous?: boolean;
  is_own?: boolean;
  answers: { id: string; answer: string; created_at: string; author_display_name: string; is_anonymous?: boolean; is_own?: boolean }[];
};

type ListResponse = {
  total: number;
  page: number;
  limit: number;
  items: School[] | SchoolWithStats[];
};

export default function SchoolReviewsPage() {
  const router = useRouter();
  const { token, me } = useAuth();
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const debouncedCity = useDebounce(city, 300);
  const debouncedDistrict = useDebounce(district, 300);
  const [selectedSchool, setSelectedSchool] = useState<SchoolDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reviews, setReviews] = useState<{ items: Review[]; total: number }>({ items: [], total: 0 });
  const [questions, setQuestions] = useState<{ items: Question[]; total: number }>({ items: [], total: 0 });
  const [reviewForm, setReviewForm] = useState<{
    rating: number;
    comment: string;
    criteria_ratings: Record<string, number>;
    is_anonymous: boolean;
  }>({ rating: 0, comment: '', criteria_ratings: {}, is_anonymous: false });
  const [questionForm, setQuestionForm] = useState('');
  const [questionIsAnonymous, setQuestionIsAnonymous] = useState(false);
  const [answerForms, setAnswerForms] = useState<Record<string, string>>({});
  const [answerIsAnonymous, setAnswerIsAnonymous] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reviews' | 'questions'>('reviews');
  /** Kendi değerlendirmesi varken form varsayılan kapalı; yalnızca «Düzenle» ile açılır. */
  const [ownReviewEditOpen, setOwnReviewEditOpen] = useState(false);
  const ownReview = reviews.items.find((r) => r.is_own);

  const fetchSchools = useCallback(async (opts?: { silent?: boolean }) => {
    if (!token) return;
    const silent = opts?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(debouncedCity && { city: debouncedCity }),
        ...(debouncedDistrict && { district: debouncedDistrict }),
      });
      const data = await apiFetch<ListResponse>(`/school-reviews/schools?${params}`, {
        token,
      });
      if (data.items.length > 0 && 'avg_rating' in data.items[0]) {
        setSchools(data.items as SchoolWithStats[]);
      } else {
        setSchools(data.items as SchoolWithStats[]);
      }
      setTotal(data.total);
    } catch (e) {
      if (!silent) {
        setError(e instanceof Error ? e.message : 'Okullar yüklenemedi');
        setSchools([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, page, debouncedSearch, debouncedCity, debouncedDistrict]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedCity, debouncedDistrict]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const fetchSchoolDetail = useCallback(
    async (id: string) => {
      if (!token) return;
      setDetailLoading(true);
      setOwnReviewEditOpen(false);
      try {
        const data = await apiFetch<SchoolDetail>(`/school-reviews/schools/${id}`, { token });
        let reviewsData: { items: Review[]; total: number };
        let questionsData: { items: Question[]; total: number };
        try {
          [reviewsData, questionsData] = await Promise.all([
            apiFetch<{ items: Review[]; total: number }>(`/school-reviews/schools/${id}/reviews`, { token }),
            apiFetch<{ items: Question[]; total: number }>(`/school-reviews/schools/${id}/questions`, { token }),
          ]);
        } catch {
          const [rRes, qRes] = await Promise.all([
            fetch(getApiUrl(`/school-reviews-public/schools/${id}/reviews`), { headers: { 'Content-Type': 'application/json' } }),
            fetch(getApiUrl(`/school-reviews-public/schools/${id}/questions`), { headers: { 'Content-Type': 'application/json' } }),
          ]);
          reviewsData = rRes.ok ? await rRes.json() : { items: [], total: 0 };
          questionsData = qRes.ok ? await qRes.json() : { items: [], total: 0 };
        }
        setSelectedSchool(data);
        setReviews(reviewsData);
        setQuestions(questionsData);
        const own = reviewsData.items.find((x) => x.is_own);
        setReviewForm(
          own ? schoolReviewFormFromReview(own, data.criteria || []) : emptySchoolReviewForm(),
        );
        setQuestionForm('');
        setActiveTab('reviews');
      } catch {
        setSelectedSchool(null);
        setReviews({ items: [], total: 0 });
        setQuestions({ items: [], total: 0 });
      } finally {
        setDetailLoading(false);
      }
    },
    [token]
  );

  const cancelOwnReviewEdit = useCallback(() => {
    if (ownReview && selectedSchool) {
      setReviewForm(schoolReviewFormFromReview(ownReview, selectedSchool.criteria || []));
    }
    setOwnReviewEditOpen(false);
  }, [ownReview, selectedSchool]);

  const refreshAfterMutation = useCallback(
    async (schoolId: string) => {
      await fetchSchoolDetail(schoolId);
      await fetchSchools({ silent: true });
      router.refresh();
    },
    [fetchSchoolDetail, fetchSchools, router]
  );

  const handleSubmitReview = async () => {
    if (!token || !selectedSchool) return;
    const criteria = selectedSchool.criteria || [];
    const hasCriteria = criteria.length > 0;
    if (hasCriteria) {
      const missing = criteria.filter((c) => {
        const v = reviewForm.criteria_ratings[c.slug];
        return v == null || v < c.min_score || v > c.max_score;
      });
      if (missing.length > 0) {
        toast.error('Lütfen tüm kriterlere geçerli puan verin.');
        return;
      }
    } else if (!reviewForm.rating || reviewForm.rating < 1 || reviewForm.rating > 10) {
      toast.error('Lütfen genel puanı 1–10 arasında seçin.');
      return;
    }
    setSubmitting(true);
    const body: Record<string, unknown> = {
      comment: reviewForm.comment.trim() || null,
      is_anonymous: reviewForm.is_anonymous,
    };
    if (hasCriteria) {
      body.criteria_ratings = reviewForm.criteria_ratings;
    } else {
      body.rating = reviewForm.rating;
    }
    try {
      if (ownReview) {
        const res = await apiFetch<Review>(`/school-reviews/reviews/${ownReview.id}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify(body),
        });
        toast.success(res.status === 'pending' ? 'Değerlendirme güncellendi, onay bekliyor' : 'Değerlendirme güncellendi');
      } else {
        const res = await apiFetch<Review>(`/school-reviews/schools/${selectedSchool.id}/reviews`, {
          method: 'POST',
          token,
          body: JSON.stringify(body),
        });
        toast.success(res.status === 'pending' ? 'Değerlendirme gönderildi, onay bekliyor' : 'Değerlendirme gönderildi');
      }
      await refreshAfterMutation(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQuestion = async () => {
    if (!token || !selectedSchool || !questionForm.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/school-reviews/schools/${selectedSchool.id}/questions`, {
        method: 'POST',
        token,
        body: JSON.stringify({ question: questionForm.trim(), is_anonymous: questionIsAnonymous }),
      });
      toast.success('Soru gönderildi');
      await refreshAfterMutation(selectedSchool.id);
      setQuestionForm('');
      setQuestionIsAnonymous(false);
      setActiveTab('questions');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAnswer = async (questionId: string) => {
    const text = answerForms[questionId]?.trim();
    if (!token || !text) return;
    setSubmittingAnswer(questionId);
    try {
      await apiFetch(`/school-reviews/questions/${questionId}/answers`, {
        method: 'POST',
        token,
        body: JSON.stringify({ answer: text, is_anonymous: answerIsAnonymous[questionId] ?? false }),
      });
      toast.success('Cevap gönderildi');
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
      setAnswerForms((f) => ({ ...f, [questionId]: '' }));
      setAnswerIsAnonymous((a) => ({ ...a, [questionId]: false }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmittingAnswer(null);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteReview = async (reviewId: string) => {
    if (!token) return;
    if (!confirm('Bu değerlendirmeyi silmek istediğinize emin misiniz?')) return;
    setDeletingId(reviewId);
    try {
      await apiFetch(`/school-reviews/reviews/${reviewId}`, { method: 'DELETE', token });
      toast.success('Değerlendirme silindi');
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!token) return;
    if (!confirm('Bu soruyu silmek istediğinize emin misiniz? Tüm cevaplar da silinecektir.')) return;
    setDeletingId(questionId);
    try {
      await apiFetch(`/school-reviews/questions/${questionId}`, { method: 'DELETE', token });
      toast.success('Soru silindi');
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteAnswer = async (answerId: string) => {
    if (!token) return;
    if (!confirm('Bu cevabı silmek istediğinize emin misiniz?')) return;
    setDeletingId(answerId);
    try {
      await apiFetch(`/school-reviews/answers/${answerId}`, { method: 'DELETE', token });
      toast.success('Cevap silindi');
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  const Avatar = ({ name }: { name: string }) => (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-sm font-semibold text-slate-600 dark:bg-slate-700/60 dark:text-slate-400">
      {name.charAt(0).toUpperCase()}
    </div>
  );

  const hasFilters = debouncedSearch || debouncedCity || debouncedDistrict;
  const clearFilters = () => { setSearch(''); setCity(''); setDistrict(''); setPage(1); };

  return (
    <div className="page-noise space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">Dashboard</Link>
        <ChevronRight className="size-4" />
        <span className="text-foreground font-medium">Okul Değerlendirmeleri</span>
        {selectedSchool && (
          <>
            <ChevronRight className="size-4" />
            <span className="truncate max-w-[200px]">{selectedSchool.name}</span>
          </>
        )}
      </nav>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 hover:scale-105 active:scale-95">
            <School className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Okul Değerlendirmeleri</h1>
            <p className="text-sm text-muted-foreground">Okulları keşfedin, değerlendirme yapın ve soru-cevap paylaşın.</p>
          </div>
        </div>
      </div>

      {error && <Alert variant="error" message={error} />}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        {/* Sol: Okul listesi */}
        <Card className="overflow-hidden border-border/80 shadow-lg shadow-black/5 dark:shadow-none transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 motion-reduce:transition-none lg:sticky lg:top-4 lg:self-start">
          <CardHeader className="border-b border-border/50 bg-muted/20">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-primary" />
              Okullar
            </CardTitle>
            <div className="space-y-3 pt-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Okul adı ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-4 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="İl"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <input
                  type="text"
                  placeholder="İlçe"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-28 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                type="button"
                onClick={() => setPage(1)}
                className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all duration-200 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Search className="size-4" />
                Ara
              </button>
              {hasFilters && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {debouncedSearch && (
                    <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-slate-200/80 px-2.5 py-1 text-xs font-medium dark:bg-slate-700/50">
                      Arama: {debouncedSearch}
                      <button type="button" onClick={() => setSearch('')} className="rounded p-0.5 hover:bg-slate-300/80 dark:hover:bg-slate-600/50" aria-label="Kaldır">
                        <X className="size-3.5" />
                      </button>
                    </span>
                  )}
                  {debouncedCity && (
                    <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-slate-200/80 px-2.5 py-1 text-xs font-medium dark:bg-slate-700/50">
                      İl: {debouncedCity}
                      <button type="button" onClick={() => { setCity(''); setDistrict(''); }} className="rounded p-0.5 hover:bg-slate-300/80 dark:hover:bg-slate-600/50" aria-label="Kaldır">
                        <X className="size-3.5" />
                      </button>
                    </span>
                  )}
                  {debouncedDistrict && (
                    <span className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg bg-slate-200/80 px-2.5 py-1 text-xs font-medium dark:bg-slate-700/50">
                      İlçe: {debouncedDistrict}
                      <button type="button" onClick={() => setDistrict('')} className="rounded p-0.5 hover:bg-slate-300/80 dark:hover:bg-slate-600/50" aria-label="Kaldır">
                        <X className="size-3.5" />
                      </button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-xs font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Tümünü temizle
                  </button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex gap-3 rounded-xl border border-border/50 p-3">
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : schools.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-12 px-4">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/50">
                  <School className="size-8 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-center text-sm text-muted-foreground">Okul bulunamadı.</p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/50"
                >
                  Filtreleri temizle
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border/50">
                {schools.map((s) => (
                  <li
                    key={s.id}
                    className={`group cursor-pointer px-4 py-3.5 min-h-[44px] flex flex-col justify-center transition-all duration-200 hover:bg-muted/40 hover:-translate-y-0.5 active:scale-[0.99] focus-within:ring-2 focus-within:ring-primary/20 focus-within:ring-offset-2 rounded-r-lg ${
                        selectedSchool?.id === s.id
                        ? 'border-l-4 border-l-sky-500/70 bg-sky-50/50 dark:bg-sky-950/20'
                        : 'border-l-4 border-l-transparent'
                    }`}
                    onClick={() => fetchSchoolDetail(s.id)}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && fetchSchoolDetail(s.id)}
                  >
                    <div className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400">{s.name}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {s.city && <span className="flex items-center gap-1"><MapPin className="size-3" />{s.city}</span>}
                      {s.district && <span>• {s.district}</span>}
                      {s.type && <span className="flex items-center gap-1"><SchoolTypeIcon type={s.type} className="size-3" />{s.type}</span>}
                      {(s as SchoolWithStats).avg_rating != null && (
                        <RatingBadge rating={(s as SchoolWithStats).avg_rating!} max={10} size="sm" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {total > 20 && (
              <div className="flex items-center justify-center gap-2 border-t border-border/50 py-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Önceki
                </button>
                <span className="text-sm text-muted-foreground">Sayfa {page} / {Math.ceil(total / 20)}</span>
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= Math.ceil(total / 20)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Sonraki
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sağ: Okul detay + form */}
        <div className="space-y-4">
          {selectedSchool ? (
            <div className="space-y-4">
              {/* Okul başlık + istatistikler */}
              <Card className="overflow-hidden border-slate-200/80 shadow-md dark:border-slate-700/50 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 motion-reduce:transition-none">
                <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-slate-50/80 to-sky-50/50 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-sky-950/30 px-6 py-5">
                  <div className="absolute right-0 top-0 opacity-[0.07] dark:opacity-[0.05]">
                    <School className="size-32 text-slate-600 dark:text-slate-500" />
                  </div>
                  <h2 className="relative text-xl font-bold text-slate-800 dark:text-slate-100">{selectedSchool.name}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                    {selectedSchool.city && (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="size-4" />{selectedSchool.city}
                      </span>
                    )}
                    {selectedSchool.district && (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <ChevronRight className="size-4" />
                        {selectedSchool.district}
                      </span>
                    )}
                    {selectedSchool.avg_rating != null && (
                      <RatingBadge rating={selectedSchool.avg_rating} max={10} size="md" showCircle />
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/60 px-2.5 py-1 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
                      <MessageSquare className="size-4" />
                      {selectedSchool.review_count}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200/60 px-2.5 py-1 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400">
                      <MessageCircleQuestion className="size-4" />
                      {selectedSchool.question_count}
                    </span>
                    {selectedSchool.review_view_count != null && selectedSchool.review_view_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        <Eye className="size-4" />
                        {selectedSchool.review_view_count} görüntülenme
                      </span>
                    )}
                  </div>
                </div>
                {selectedSchool.criteria_averages &&
                  Object.keys(selectedSchool.criteria_averages).length > 0 && (
                    <CardContent className="space-y-3 pt-5">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <BarChart3 className="size-4" /> Kriter ortalamaları
                      </p>
                      <div className="space-y-3">
                        {(selectedSchool.criteria || [])
                          .filter((c) => selectedSchool.criteria_averages?.[c.slug] != null)
                          .map((c) => (
                            <div key={c.id} className="space-y-1.5">
                              <div className="flex justify-between text-sm">
                                <span className="text-foreground">{c.label}</span>
                                <span className="font-semibold text-slate-700 dark:text-slate-300">
                                  {(selectedSchool.criteria_averages?.[c.slug] ?? 0).toFixed(1)}
                                </span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/50">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 dark:from-sky-500/80 dark:to-teal-500/80 transition-all duration-500"
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      scoreRatio01(
                                        selectedSchool.criteria_averages?.[c.slug] ?? 0,
                                        c.min_score,
                                        c.max_score,
                                      ) * 100,
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  )}
              </Card>

              {/* Tabs */}
              <div className="flex gap-1 rounded-xl border border-slate-200/80 bg-slate-100/50 p-1 dark:border-slate-700/50 dark:bg-slate-800/30">
                <button
                  type="button"
                  onClick={() => setActiveTab('reviews')}
                  className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-all sm:flex-row sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                    activeTab === 'reviews'
                      ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
                      : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="size-4 shrink-0" />
                    <span className="leading-tight">Puan ve Yorumlar</span>
                  </span>
                  <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums sm:text-xs">
                    {reviews.total}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('questions')}
                  className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-all sm:flex-row sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm ${
                    activeTab === 'questions'
                      ? 'bg-white text-slate-800 shadow-sm ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
                      : 'text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MessageCircleQuestion className="size-4 shrink-0" />
                    <span className="leading-tight">Soru ve Cevaplar</span>
                  </span>
                  <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums sm:text-xs">
                    {questions.total}
                  </span>
                </button>
              </div>

              {activeTab === 'reviews' ? (
                <>
                  {/* Değerlendirme formu / özeti */}
                  <Card className="overflow-hidden border-border/80 shadow-sm">
                    <CardHeader className="border-b border-border/60 bg-gradient-to-br from-amber-500/10 via-background to-primary/5">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold sm:text-base">
                        <Sparkles className="size-4 shrink-0 text-amber-600" />
                        {ownReview && !ownReviewEditOpen
                          ? 'Değerlendirmeniz'
                          : ownReview && ownReviewEditOpen
                            ? 'Değerlendirmenizi güncelleyin'
                            : 'Değerlendirme Yap'}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {ownReview && !ownReviewEditOpen
                          ? 'Yalnızca genel ortalama puanınız görünür; maddeleri düzenlemek için «Değerlendirmeyi düzenle»ye tıklayın.'
                          : ownReview && ownReviewEditOpen
                            ? 'Puan ve yorumunuzu değiştirebilirsiniz; kaydettiğinizde güncellenir.'
                            : 'Deneyiminizi paylaşın; kriterlere puan verin.'}
                      </p>
                    </CardHeader>
                    {ownReview && !ownReviewEditOpen ? (
                      <CardContent className="space-y-4 px-4 py-4 sm:px-5">
                        <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Genel ortalama</span>
                            <RatingBadge rating={ownReview.rating} max={10} size="sm" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOwnReviewEditOpen(true)}
                          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 sm:w-auto"
                        >
                          <Pencil className="size-4" aria-hidden />
                          Değerlendirmeyi düzenle
                        </button>
                      </CardContent>
                    ) : (
                      <CardContent className="space-y-4 px-4 py-4 sm:px-5">
                        <SchoolReviewScorePicker
                          criteria={selectedSchool.criteria}
                          criteriaRatings={reviewForm.criteria_ratings}
                          onCriteriaRating={(slug, n) =>
                            setReviewForm((f) => ({ ...f, criteria_ratings: { ...f.criteria_ratings, [slug]: n } }))
                          }
                          singleRating={reviewForm.rating}
                          onSingleRating={(n) => setReviewForm((f) => ({ ...f, rating: n }))}
                        />
                        <div>
                          <label className="mb-1 block text-sm font-medium">Yorum (opsiyonel)</label>
                          <textarea
                            value={reviewForm.comment}
                            onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                            rows={3}
                            placeholder="Deneyiminizi paylaşın..."
                            className="w-full min-h-[120px] rounded-xl border border-input bg-background px-4 py-3 text-base transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:text-sm"
                          />
                        </div>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={reviewForm.is_anonymous}
                            onChange={(e) =>
                              setReviewForm((f) => ({ ...f, is_anonymous: e.target.checked }))
                            }
                            className="size-5 shrink-0 rounded border-border text-primary focus:ring-primary"
                          />
                          <span className="text-sm">İsmim gizli kalsın</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleSubmitReview}
                            disabled={submitting}
                            className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:flex-none"
                          >
                            <Send className="size-4" />
                            {submitting
                              ? ownReview
                                ? 'Kaydediliyor…'
                                : 'Gönderiliyor…'
                              : ownReview
                                ? 'Güncelle'
                                : 'Gönder'}
                          </button>
                          {ownReview && ownReviewEditOpen && (
                            <button
                              type="button"
                              onClick={cancelOwnReviewEdit}
                              disabled={submitting}
                              className="min-h-10 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-50"
                            >
                              İptal
                            </button>
                          )}
                        </div>
                      </CardContent>
                    )}
                  </Card>

                  {/* Değerlendirme listesi */}
                  <Card className="border-border/80 shadow-md">
                    <CardHeader>
                      <CardTitle className="text-base">Puan ve Yorumlar</CardTitle>
                      <p className="text-sm text-muted-foreground">Puan ve yorumlar. İsim gizleyenler &quot;Anonim kullanıcı&quot; olarak görünür.</p>
                    </CardHeader>
                    <CardContent>
                      {reviews.items.length === 0 ? (
                        <div className="flex flex-col items-center gap-4 py-12">
                          <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/50">
                            <MessageSquare className="size-8 text-slate-400 dark:text-slate-500" />
                          </div>
                          <p className="text-center text-sm text-muted-foreground">Henüz değerlendirme yok.</p>
                          <p className="text-center text-xs text-muted-foreground">Yukarıdaki formu doldurup ilk yorumu siz yapın.</p>
                        </div>
                      ) : (
                        <ul className="space-y-4 divide-y divide-border/50">
                          {reviews.items.map((r) => (
                            <li key={r.id} className="flex gap-4 pt-4 first:pt-0">
                              <Avatar name={r.is_anonymous ? 'Anonim' : r.author_display_name} />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-medium text-foreground">{r.is_anonymous ? 'Anonim kullanıcı' : r.author_display_name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString('tr-TR', { dateStyle: 'medium' })}</span>
                                    {r.is_own && r.status === 'pending' && (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                        Onay bekliyor
                                      </span>
                                    )}
                                    {r.is_own && token && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteReview(r.id)}
                                        disabled={deletingId === r.id}
                                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                        title="Değerlendirmeyi sil"
                                      >
                                        <Trash2 className="size-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    {r.criteria_ratings &&
                                    selectedSchool.criteria &&
                                    Object.keys(r.criteria_ratings).length > 0 ? (
                                      <>
                                        <span className="text-xs font-medium text-muted-foreground">Genel ortalama</span>
                                        <RatingBadge rating={r.rating} max={10} size="sm" />
                                      </>
                                    ) : (
                                      <RatingBadge rating={r.rating} max={10} size="sm" />
                                    )}
                                  </div>
                                  <CriteriaRatingsDisplay
                                    criteriaRatings={r.criteria_ratings}
                                    criteria={selectedSchool.criteria ?? undefined}
                                  />
                                </div>
                                {r.comment && <p className="mt-3 text-sm text-foreground/90 leading-relaxed">{r.comment}</p>}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <>
                  {/* Soru formu */}
                  <Card className="border-border/80 shadow-md">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageCircleQuestion className="size-4 text-primary" />
                        Bu Okul Hakkında Soru Sor
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Merak ettiğiniz konuları sorun. İsterseniz &quot;İsmim gizli kalsın&quot; ile anonim paylaşabilirsiniz.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <textarea
                        value={questionForm}
                        onChange={(e) => setQuestionForm(e.target.value)}
                        rows={2}
                        placeholder="Örn: Bu okulda nöbet sistemi nasıl işliyor?"
                        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50">
                        <input
                          type="checkbox"
                          checked={questionIsAnonymous}
                          onChange={(e) => setQuestionIsAnonymous(e.target.checked)}
                          className="size-4 rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm">İsmim gizli kalsın</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleSubmitQuestion}
                        disabled={submitting || !questionForm.trim()}
                        className="flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90 hover:shadow-lg disabled:opacity-50"
                      >
                        <Send className="size-4" />
                        {submitting ? 'Gönderiliyor…' : 'Soru Gönder'}
                      </button>
                    </CardContent>
                  </Card>

                  {/* Soru listesi + cevap formu */}
                  <Card className="border-border/80 shadow-md">
                    <CardHeader>
                      <CardTitle className="text-base">Sorulan Sorular ve Cevaplar</CardTitle>
                      <p className="text-sm text-muted-foreground">Okul hakkında sorulan sorular. İsim gizleyenler &quot;Anonim kullanıcı&quot; olarak görünür.</p>
                    </CardHeader>
                    <CardContent>
                      {questions.items.length === 0 ? (
                        <div className="flex flex-col items-center gap-4 py-12">
                          <div className="flex size-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800/50">
                            <MessageCircleQuestion className="size-8 text-slate-400 dark:text-slate-500" />
                          </div>
                          <p className="text-center text-sm text-muted-foreground">Henüz soru yok.</p>
                          <p className="text-center text-xs text-muted-foreground">Yukarıdaki alandan ilk soruyu siz sorun.</p>
                        </div>
                      ) : (
                        <ul className="space-y-5">
                          {questions.items.map((q) => (
                            <li
                              key={q.id}
                              className="overflow-hidden rounded-xl border border-border/80 bg-muted/20 shadow-sm dark:bg-muted/10"
                            >
                              <div className="border-l-4 border-sky-500/80 bg-sky-50/40 px-4 py-3 dark:border-sky-500/60 dark:bg-sky-950/25">
                                <div className="flex gap-3">
                                  <MessageCircleQuestion className="mt-0.5 size-5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-800/90 dark:text-sky-300/90">
                                      Soru
                                    </p>
                                    <p className="mt-1 text-base font-semibold leading-snug text-foreground">{q.question}</p>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-xs text-muted-foreground">
                                        {q.is_anonymous ? 'Anonim kullanıcı' : q.author_display_name} ·{' '}
                                        {formatTrDateTimeMedium(q.created_at)}
                                      </span>
                                      {q.is_own && token && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteQuestion(q.id)}
                                          disabled={deletingId === q.id}
                                          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                          title="Soruyu sil"
                                        >
                                          <Trash2 className="size-4" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {q.answers.length > 0 && (
                                <div className="space-y-2 border-t border-border/60 bg-background/60 px-4 py-3 dark:bg-background/40">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Yanıtlar ({q.answers.length})
                                  </p>
                                  <ul className="space-y-3">
                                    {q.answers.map((a, ai) => (
                                      <li
                                        key={a.id}
                                        className="flex gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 dark:bg-muted/20"
                                      >
                                        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-xs font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                                          {ai + 1}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                                            <span className="font-medium text-foreground/90">
                                              {a.is_anonymous ? 'Anonim kullanıcı' : a.author_display_name}
                                            </span>
                                            <span>·</span>
                                            <time dateTime={a.created_at}>
                                              {formatTrDateTimeMedium(a.created_at)}
                                            </time>
                                            {a.is_own && token && (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteAnswer(a.id)}
                                                disabled={deletingId === a.id}
                                                className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                                                title="Cevabı sil"
                                              >
                                                <Trash2 className="size-3.5" />
                                              </button>
                                            )}
                                          </div>
                                          <p className="mt-1.5 text-sm leading-relaxed text-foreground/95">{a.answer}</p>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div className="border-t border-border/60 px-4 py-3">
                                <p className="mb-2 text-xs font-medium text-muted-foreground">Bu soruya cevap yazın</p>
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={answerForms[q.id] ?? ''}
                                      onChange={(e) =>
                                        setAnswerForms((f) => ({ ...f, [q.id]: e.target.value }))
                                      }
                                      placeholder="Yanıtınızı yazın…"
                                      className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSubmitAnswer(q.id)}
                                      disabled={submittingAnswer === q.id || !(answerForms[q.id]?.trim())}
                                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow transition-all hover:bg-primary/90 disabled:opacity-50"
                                      title="Cevap gönder"
                                    >
                                      <Reply className="size-4" />
                                      {submittingAnswer === q.id ? '…' : 'Gönder'}
                                    </button>
                                  </div>
                                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={answerIsAnonymous[q.id] ?? false}
                                      onChange={(e) =>
                                        setAnswerIsAnonymous((a) => ({ ...a, [q.id]: e.target.checked }))
                                      }
                                      className="size-3.5 rounded border-border text-primary focus:ring-primary"
                                    />
                                    İsmim gizli kalsın
                                  </label>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          ) : (
            <Card className="border-dashed border-2 border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-16">
                {detailLoading ? (
                  <LoadingSpinner className="size-10" />
                ) : (
                  <>
                    <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted/50">
                      <School className="size-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-center font-medium text-foreground">Okul seçin</p>
                    <p className="mt-1 text-center text-sm text-muted-foreground">Detay, değerlendirme ve soru-cevap için soldan bir okul seçin.</p>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
