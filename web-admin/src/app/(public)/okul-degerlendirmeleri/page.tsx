'use client';

import { useCallback, useEffect, useState, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { getApiUrl } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  StarIcon,
  MessageIcon,
  EyeIcon,
  ChevronRightIcon,
  SearchIcon,
  LogInIcon,
  ShareIcon,
  SchoolIcon,
  TrendingUpIcon,
  HelpIcon,
  PencilIcon,
  TrashIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  FlagIcon,
  HeartIcon,
} from '@/components/icons';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';

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

type Criteria = {
  id: string;
  slug: string;
  label: string;
  hint: string | null;
  min_score: number;
  max_score: number;
};

type SchoolDetail = SchoolWithStats & {
  criteria: Criteria[] | null;
  criteria_averages: Record<string, number> | null;
  review_view_count?: number;
  rating_distribution?: Record<number, number>;
  is_favorited?: boolean;
};

type Review = {
  id: string;
  rating: number;
  criteria_ratings: Record<string, number> | null;
  comment: string | null;
  created_at: string;
  is_anonymous: boolean;
  author_display_name: string;
  is_own?: boolean;
  like_count?: number;
  dislike_count?: number;
  user_has_liked?: boolean;
  user_has_disliked?: boolean;
};

type Question = {
  id: string;
  question: string;
  created_at: string;
  author_display_name: string;
  is_anonymous?: boolean;
  is_own?: boolean;
  like_count?: number;
  dislike_count?: number;
  user_has_liked?: boolean;
  user_has_disliked?: boolean;
  answers: {
    id: string;
    answer: string;
    created_at: string;
    author_display_name: string;
    is_anonymous?: boolean;
    is_own?: boolean;
    like_count?: number;
    dislike_count?: number;
    user_has_liked?: boolean;
    user_has_disliked?: boolean;
  }[];
};

type ListResponse = {
  total: number;
  page: number;
  limit: number;
  items: School[] | SchoolWithStats[];
};

type HomeStats = { school_count: number; review_count: number; question_count: number };

type RecentReview = {
  id: string;
  school_id: string;
  school_name: string;
  rating: number;
  comment: string | null;
  created_at: string;
  author_display_name: string;
};

type RecentQuestion = {
  id: string;
  school_id: string;
  school_name: string;
  question: string;
  created_at: string;
  author_display_name: string;
};

type RecentAnswer = {
  id: string;
  school_id: string;
  school_name: string;
  created_at: string;
};

type ActivityItem = {
  id: string;
  school_id: string;
  school_name: string;
  type: 'review' | 'question' | 'answer';
  created_at: string;
};

const PUBLIC_BASE = '/school-reviews-public';
const AUTH_BASE = '/school-reviews';
const PAGE_PATH = '/okul-degerlendirmeleri';
const RECENT_SEARCHES_KEY = 'okul-degerlendirmeleri-recent';
const ANONYMOUS_ID_KEY = 'ogretmenpro-anonymous-id';

function getAnonymousId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = localStorage.getItem(ANONYMOUS_ID_KEY);
    if (!id || id.length < 20) {
      id = crypto.randomUUID();
      localStorage.setItem(ANONYMOUS_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

type RecentSearch = { search: string; city: string; district: string };

function loadRecentSearches(): RecentSearch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRecentSearch(item: RecentSearch): void {
  if (typeof window === 'undefined') return;
  if (!item.search.trim() && !item.city && !item.district) return;
  try {
    const list = loadRecentSearches();
    const filtered = list.filter(
      (x) => !(x.search === item.search && x.city === item.city && x.district === item.district)
    );
    const updated = [{ ...item }, ...filtered].slice(0, 5);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  } catch {
    /* noop */
  }
}

async function fetchApi<T>(
  path: string,
  options: { token?: string | null; method?: string; body?: string; usePublic?: boolean } = {}
): Promise<T> {
  const { token, method = 'GET', body, usePublic } = options;
  const base = usePublic ? PUBLIC_BASE : token ? AUTH_BASE : PUBLIC_BASE;
  const url = getApiUrl(base + path);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(url, { method, headers, ...(body && { body }) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (
      msg.toLowerCase().includes('fetch') ||
      msg.toLowerCase().includes('connection') ||
      msg.toLowerCase().includes('network') ||
      msg.toLowerCase().includes('failed')
    ) {
      throw new Error('Bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edin.');
    }
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = (err as { message?: string }).message || res.statusText;
    const ex = new Error(msg) as Error & { code?: string };
    if (typeof (err as { code?: string }).code === 'string') ex.code = (err as { code?: string }).code;
    throw ex;
  }
  return res.json();
}

/** KVK uyumlu göreli zaman (örn. "2 saat önce") */
function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Az önce';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} dk önce`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} saat önce`;
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)} gün önce`;
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function OkulDegerlendirmeleriContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, me } = useAuth();
  const detailSectionRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [schools, setSchools] = useState<SchoolWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moduleDisabled, setModuleDisabled] = useState(false);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');
  const [debouncedDistrict, setDebouncedDistrict] = useState('');
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
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editReviewForm, setEditReviewForm] = useState<{
    rating: number;
    comment: string;
    criteria_ratings: Record<string, number>;
    is_anonymous: boolean;
  } | null>(null);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionForm, setEditQuestionForm] = useState<string | null>(null);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editAnswerForm, setEditAnswerForm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reviews' | 'questions'>('reviews');
  const [reviewSort, setReviewSort] = useState<'newest' | 'most_liked' | 'rating_high' | 'rating_low'>('newest');
  const [questionSort, setQuestionSort] = useState<'newest' | 'most_answers' | 'most_liked'>('newest');
  const [cities, setCities] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [topSchools, setTopSchools] = useState<SchoolWithStats[]>([]);
  const [homeStats, setHomeStats] = useState<HomeStats | null>(null);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [recentQuestions, setRecentQuestions] = useState<RecentQuestion[]>([]);
  const [recentAnswers, setRecentAnswers] = useState<RecentAnswer[]>([]);
  const [selectedListIndex, setSelectedListIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    const q = searchParams;
    if (!q) return;
    const s = q.get('search') ?? '';
    const c = q.get('city') ?? '';
    const d = q.get('district') ?? '';
    if (s || c || d) {
      setSearch(s);
      setCity(c);
      setDistrict(d);
      setDebouncedSearch(s);
      setDebouncedCity(c);
      setDebouncedDistrict(d);
      setPage(1);
    }
  }, [searchParams]);

  useEffect(() => {
    const idx = selectedSchool ? schools.findIndex((s) => s.id === selectedSchool.id) : -1;
    setSelectedListIndex(idx >= 0 ? idx : -1);
  }, [selectedSchool, schools]);

  useEffect(() => {
    if (selectedSchool && detailSectionRef.current && window.innerWidth < 1024) {
      detailSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedSchool?.id]);

  useEffect(() => {
    if (moduleDisabled) return;
    fetchApi<string[]>('/cities', { token, usePublic: true })
      .then((c) => { setCities(c); setModuleDisabled(false); })
      .catch((e) => {
        if ((e as Error & { code?: string }).code === 'MODULE_DISABLED') setModuleDisabled(true);
        setCities([]);
      });
  }, [token]);

  useEffect(() => {
    if (!moduleDisabled) {
      Promise.all([
        fetchApi<SchoolWithStats[]>('/top-schools?limit=8', { token, usePublic: true }),
        fetchApi<HomeStats>('/home-stats', { token, usePublic: true }).catch(() => null),
        fetchApi<RecentReview[]>('/recent-reviews?limit=8', { token, usePublic: true }).catch(() => []),
        fetchApi<RecentQuestion[]>('/recent-questions?limit=8', { token, usePublic: true }).catch(() => []),
        fetchApi<RecentAnswer[]>('/recent-answers?limit=8', { token, usePublic: true }).catch(() => []),
      ]).then(([top, stats, revs, qs, ans]) => {
        setTopSchools(top);
        setHomeStats(stats);
        setRecentReviews(revs);
        setRecentQuestions(qs);
        setRecentAnswers(ans);
      }).catch(() => {});
    }
  }, [token, moduleDisabled]);

  useEffect(() => {
    if (!city) {
      setDistricts([]);
      return;
    }
    fetchApi<string[]>(`/districts?city=${encodeURIComponent(city)}`, { token, usePublic: true })
      .then(setDistricts)
      .catch(() => setDistricts([]));
  }, [city, token]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedCity(city);
      setDebouncedDistrict(district);
    }, 400);
    return () => clearTimeout(t);
  }, [search, city, district]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, debouncedCity, debouncedDistrict]);

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    setModuleDisabled(false);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(debouncedCity && { city: debouncedCity }),
        ...(debouncedDistrict && { district: debouncedDistrict }),
      });
      const data = await fetchApi<ListResponse>(`/schools?${params}`, { token, usePublic: true });
      setSchools((data.items || []) as SchoolWithStats[]);
      setTotal(data.total);
    } catch (e) {
      const ex = e as Error & { code?: string };
      setModuleDisabled(ex.code === 'MODULE_DISABLED');
      setError(ex.message || 'Okullar yüklenemedi');
      setSchools([]);
    } finally {
      setLoading(false);
    }
  }, [token, page, debouncedSearch, debouncedCity, debouncedDistrict]);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const fetchSchoolDetail = useCallback(
    async (id: string) => {
      setEditingReviewId(null);
      setEditReviewForm(null);
      setEditingQuestionId(null);
      setEditQuestionForm(null);
      setEditingAnswerId(null);
      setEditAnswerForm(null);
      setDetailLoading(true);
      try {
        const anonId = !token ? getAnonymousId() : '';
        const revParams = new URLSearchParams({ sort: reviewSort });
        if (anonId) revParams.set('anonymous_id', anonId);
        const qParams = new URLSearchParams({ sort: questionSort });
        if (anonId) qParams.set('anonymous_id', anonId);
        const [data, reviewsData, questionsData] = await Promise.all([
          fetchApi<SchoolDetail>(`/schools/${id}`, token ? { token } : { usePublic: true }),
          fetchApi<{ items: Review[]; total: number }>(
            `/schools/${id}/reviews?${revParams}`,
            token ? { token } : { usePublic: true }
          ),
          fetchApi<{ items: Question[]; total: number }>(
            `/schools/${id}/questions?${qParams}`,
            token ? { token } : { usePublic: true }
          ),
        ]);
        setSelectedSchool(data);
        setReviews(reviewsData);
        setQuestions(questionsData);
        const initialCriteria: Record<string, number> = {};
        setReviewForm({ rating: 0, comment: '', criteria_ratings: initialCriteria, is_anonymous: false });
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
    [token, reviewSort, questionSort]
  );

  const schoolIdFromUrl = searchParams?.get('id') || searchParams?.get('school');
  useEffect(() => {
    if (schoolIdFromUrl && selectedSchool?.id !== schoolIdFromUrl) {
      fetchSchoolDetail(schoolIdFromUrl);
    }
  }, [schoolIdFromUrl, selectedSchool?.id, fetchSchoolDetail]);

  const selectedSchoolRef = useRef(selectedSchool);
  selectedSchoolRef.current = selectedSchool;
  const fetchSchoolDetailRef = useRef(fetchSchoolDetail);
  fetchSchoolDetailRef.current = fetchSchoolDetail;
  useEffect(() => {
    const id = selectedSchoolRef.current?.id;
    if (id) fetchSchoolDetailRef.current(id);
  }, [reviewSort, questionSort]);

  const handleSubmitReview = async () => {
    if (!token || !selectedSchool) {
      toast.error('Değerlendirme yapmak için giriş yapmalısınız.');
      return;
    }
    const criteria = selectedSchool.criteria || [];
    const hasCriteria = criteria.length > 0;
    if (hasCriteria) {
      const missing = criteria.filter((c) => !reviewForm.criteria_ratings[c.slug] || reviewForm.criteria_ratings[c.slug] < 1);
      if (missing.length > 0) {
        toast.error('Lütfen tüm kriterlere puan verin.');
        return;
      }
    } else if (!reviewForm.rating || reviewForm.rating < 1) {
      toast.error('Lütfen genel puana yıldız verin.');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        comment: reviewForm.comment.trim() || null,
        is_anonymous: reviewForm.is_anonymous,
      };
      if (hasCriteria) body.criteria_ratings = reviewForm.criteria_ratings;
      else body.rating = reviewForm.rating;
      await fetchApi(`/schools/${selectedSchool.id}/reviews`, {
        token,
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success('Değerlendirme gönderildi');
      fetchSchoolDetail(selectedSchool.id);
      const initialCriteria: Record<string, number> = {};
      setReviewForm({ rating: 0, comment: '', criteria_ratings: initialCriteria, is_anonymous: false });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQuestion = async () => {
    if (!token || !selectedSchool || !questionForm.trim()) {
      if (!token) toast.error('Soru sormak için giriş yapmalısınız.');
      return;
    }
    setSubmitting(true);
    try {
      await fetchApi(`/schools/${selectedSchool.id}/questions`, {
        token,
        method: 'POST',
        body: JSON.stringify({ question: questionForm.trim(), is_anonymous: questionIsAnonymous }),
      });
      toast.success('Soru gönderildi');
      fetchSchoolDetail(selectedSchool.id);
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
    if (!token || !text) {
      if (!token) toast.error('Cevap vermek için giriş yapmalısınız.');
      return;
    }
    setSubmittingAnswer(questionId);
    try {
      await fetchApi(`/questions/${questionId}/answers`, {
        token,
        method: 'POST',
        body: JSON.stringify({ answer: text, is_anonymous: answerIsAnonymous[questionId] ?? false }),
      });
      toast.success('Cevap gönderildi');
      if (selectedSchool) fetchSchoolDetail(selectedSchool.id);
      setAnswerForms((f) => ({ ...f, [questionId]: '' }));
      setAnswerIsAnonymous((a) => ({ ...a, [questionId]: false }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setSubmittingAnswer(null);
    }
  };

  const handleUpdateReview = async (reviewId: string) => {
    const form = editReviewForm;
    if (!token || !form) return;
    const criteria = selectedSchool?.criteria || [];
    const hasCriteria = criteria.length > 0;
    if (hasCriteria) {
      const missing = criteria.filter((c) => !form.criteria_ratings[c.slug] || form.criteria_ratings[c.slug] < 1);
      if (missing.length > 0) {
        toast.error('Lütfen tüm kriterlere puan verin.');
        return;
      }
    } else if (!form.rating || form.rating < 1) {
      toast.error('Lütfen genel puana yıldız verin.');
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        comment: form.comment.trim() || null,
        is_anonymous: form.is_anonymous,
      };
      if (hasCriteria) {
        const rounded: Record<string, number> = {};
        for (const [k, v] of Object.entries(form.criteria_ratings)) {
          if (v != null) rounded[k] = Math.round(Number(v));
        }
        body.criteria_ratings = rounded;
      } else {
        body.rating = Math.round(Number(form.rating));
      }
      await fetchApi(`/reviews/${reviewId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      toast.success('Değerlendirme güncellendi');
      setEditingReviewId(null);
      setEditReviewForm(null);
      if (selectedSchool) fetchSchoolDetail(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingReview = (r: Review) => {
    const criteria = selectedSchool?.criteria || [];
    const initialCriteria: Record<string, number> = {};
    if (r.criteria_ratings) {
      Object.assign(initialCriteria, r.criteria_ratings);
    }
    (criteria || []).forEach((c) => {
      if (initialCriteria[c.slug] == null) initialCriteria[c.slug] = r.criteria_ratings?.[c.slug] ?? 0;
    });
    setEditReviewForm({
      rating: r.rating,
      comment: r.comment || '',
      criteria_ratings: initialCriteria,
      is_anonymous: r.is_anonymous,
    });
    setEditingReviewId(r.id);
  };

  const cancelEditingReview = () => {
    setEditingReviewId(null);
    setEditReviewForm(null);
  };

  const startEditingQuestion = (q: Question) => {
    setEditingQuestionId(q.id);
    setEditQuestionForm(q.question);
  };

  const cancelEditingQuestion = () => {
    setEditingQuestionId(null);
    setEditQuestionForm(null);
  };

  const handleUpdateQuestion = async (questionId: string) => {
    const text = editQuestionForm?.trim();
    if (!token || text == null) return;
    if (!text) {
      toast.error('Soru metni boş olamaz.');
      return;
    }
    setSubmitting(true);
    try {
      await fetchApi(`/questions/${questionId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ question: text }),
      });
      toast.success('Soru güncellendi');
      setEditingQuestionId(null);
      setEditQuestionForm(null);
      if (selectedSchool) fetchSchoolDetail(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingAnswer = (a: { id: string; answer: string }) => {
    setEditingAnswerId(a.id);
    setEditAnswerForm(a.answer);
  };

  const cancelEditingAnswer = () => {
    setEditingAnswerId(null);
    setEditAnswerForm(null);
  };

  const handleUpdateAnswer = async (answerId: string) => {
    const text = editAnswerForm?.trim();
    if (!token || text == null) return;
    if (!text) {
      toast.error('Cevap metni boş olamaz.');
      return;
    }
    setSubmitting(true);
    try {
      await fetchApi(`/answers/${answerId}`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ answer: text }),
      });
      toast.success('Cevap güncellendi');
      setEditingAnswerId(null);
      setEditAnswerForm(null);
      if (selectedSchool) fetchSchoolDetail(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [likingId, setLikingId] = useState<string | null>(null);
  const [dislikingId, setDislikingId] = useState<string | null>(null);
  const [likingQuestionId, setLikingQuestionId] = useState<string | null>(null);
  const [dislikingQuestionId, setDislikingQuestionId] = useState<string | null>(null);
  const [likingAnswerId, setLikingAnswerId] = useState<string | null>(null);
  const [dislikingAnswerId, setDislikingAnswerId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<{ type: 'review' | 'question' | 'answer'; id: string; questionId?: string } | null>(null);
  const [reportReason, setReportReason] = useState<string>('diger');
  const [reportComment, setReportComment] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);

  type LikeDislikeRes = { like_count: number; dislike_count: number; user_has_liked: boolean; user_has_disliked: boolean };

  const handleToggleLike = async (reviewId: string) => {
    const anonId = !token ? getAnonymousId() : '';
    if (!token && !anonId) {
      toast.error('Beğeni işlemi yapılamadı.');
      return;
    }
    setLikingId(reviewId);
    try {
      const res = token
        ? await fetchApi<LikeDislikeRes>(`/reviews/${reviewId}/like`, { token, method: 'POST' })
        : await fetchApi<LikeDislikeRes>(`/reviews/${reviewId}/like`, { usePublic: true, method: 'POST', body: JSON.stringify({ anonymous_id: anonId }) });
      setReviews((prev) => ({
        ...prev,
        items: prev.items.map((r) => (r.id === reviewId ? { ...r, like_count: res.like_count, dislike_count: res.dislike_count, user_has_liked: res.user_has_liked, user_has_disliked: res.user_has_disliked } : r)),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setLikingId(null);
    }
  };

  const handleToggleDislike = async (reviewId: string) => {
    const anonId = !token ? getAnonymousId() : '';
    if (!token && !anonId) return;
    setDislikingId(reviewId);
    try {
      const res = token
        ? await fetchApi<LikeDislikeRes>(`/reviews/${reviewId}/dislike`, { token, method: 'POST' })
        : await fetchApi<LikeDislikeRes>(`/reviews/${reviewId}/dislike`, { usePublic: true, method: 'POST', body: JSON.stringify({ anonymous_id: anonId }) });
      setReviews((prev) => ({
        ...prev,
        items: prev.items.map((r) => (r.id === reviewId ? { ...r, like_count: res.like_count, dislike_count: res.dislike_count, user_has_liked: res.user_has_liked, user_has_disliked: res.user_has_disliked } : r)),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setDislikingId(null);
    }
  };

  const handleToggleQuestionLike = async (questionId: string) => {
    const anonId = !token ? getAnonymousId() : '';
    if (!token && !anonId) return;
    setLikingQuestionId(questionId);
    try {
      const res = token
        ? await fetchApi<LikeDislikeRes>(`/questions/${questionId}/like`, { token, method: 'POST' })
        : await fetchApi<LikeDislikeRes>(`/questions/${questionId}/like`, { usePublic: true, method: 'POST', body: JSON.stringify({ anonymous_id: anonId }) });
      setQuestions((prev) => ({
        ...prev,
        items: prev.items.map((q) => (q.id === questionId ? { ...q, like_count: res.like_count, dislike_count: res.dislike_count, user_has_liked: res.user_has_liked, user_has_disliked: res.user_has_disliked } : q)),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setLikingQuestionId(null);
    }
  };

  const handleToggleQuestionDislike = async (questionId: string) => {
    const anonId = !token ? getAnonymousId() : '';
    if (!token && !anonId) return;
    setDislikingQuestionId(questionId);
    try {
      const res = token
        ? await fetchApi<LikeDislikeRes>(`/questions/${questionId}/dislike`, { token, method: 'POST' })
        : await fetchApi<LikeDislikeRes>(`/questions/${questionId}/dislike`, { usePublic: true, method: 'POST', body: JSON.stringify({ anonymous_id: anonId }) });
      setQuestions((prev) => ({
        ...prev,
        items: prev.items.map((q) => (q.id === questionId ? { ...q, like_count: res.like_count, dislike_count: res.dislike_count, user_has_liked: res.user_has_liked, user_has_disliked: res.user_has_disliked } : q)),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setDislikingQuestionId(null);
    }
  };

  const handleToggleAnswerLike = async (answerId: string, questionId: string) => {
    const anonId = !token ? getAnonymousId() : '';
    if (!token && !anonId) return;
    setLikingAnswerId(answerId);
    try {
      const res = token
        ? await fetchApi<LikeDislikeRes>(`/answers/${answerId}/like`, { token, method: 'POST' })
        : await fetchApi<LikeDislikeRes>(`/answers/${answerId}/like`, { usePublic: true, method: 'POST', body: JSON.stringify({ anonymous_id: anonId }) });
      setQuestions((prev) => ({
        ...prev,
        items: prev.items.map((q) =>
          q.id === questionId ? { ...q, answers: q.answers.map((a) => (a.id === answerId ? { ...a, like_count: res.like_count, dislike_count: res.dislike_count, user_has_liked: res.user_has_liked, user_has_disliked: res.user_has_disliked } : a)) } : q
        ),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setLikingAnswerId(null);
    }
  };

  const handleToggleAnswerDislike = async (answerId: string, questionId: string) => {
    const anonId = !token ? getAnonymousId() : '';
    if (!token && !anonId) return;
    setDislikingAnswerId(answerId);
    try {
      const res = token
        ? await fetchApi<LikeDislikeRes>(`/answers/${answerId}/dislike`, { token, method: 'POST' })
        : await fetchApi<LikeDislikeRes>(`/answers/${answerId}/dislike`, { usePublic: true, method: 'POST', body: JSON.stringify({ anonymous_id: anonId }) });
      setQuestions((prev) => ({
        ...prev,
        items: prev.items.map((q) =>
          q.id === questionId ? { ...q, answers: q.answers.map((a) => (a.id === answerId ? { ...a, like_count: res.like_count, dislike_count: res.dislike_count, user_has_liked: res.user_has_liked, user_has_disliked: res.user_has_disliked } : a)) } : q
        ),
      }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setDislikingAnswerId(null);
    }
  };

  const handleReport = async () => {
    if (!reportTarget) return;
    const anonId = !token ? getAnonymousId() : '';
    if (!token && !anonId) {
      toast.error('Bildirmek için giriş yapın veya sayfayı yenileyin.');
      return;
    }
    setReportSubmitting(true);
    try {
      const path = reportTarget.type === 'review' ? `/reviews/${reportTarget.id}/report` : reportTarget.type === 'question' ? `/questions/${reportTarget.id}/report` : `/answers/${reportTarget.id}/report`;
      const body = { reason: reportReason, comment: reportComment.trim() || undefined, ...(anonId ? { anonymous_id: anonId } : {}) };
      if (token) {
        await fetchApi(path, { token, method: 'POST', body: JSON.stringify(body) });
      } else {
        await fetchApi(path, { usePublic: true, method: 'POST', body: JSON.stringify(body) });
      }
      toast.success('Bildiriminiz alındı. İnceleme yapılacaktır.');
      setReportTarget(null);
      setReportReason('diger');
      setReportComment('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bildirim gönderilemedi');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!token) return;
    if (!confirm('Bu değerlendirmeyi silmek istediğinize emin misiniz?')) return;
    setDeletingId(reviewId);
    try {
      await fetchApi(`/reviews/${reviewId}`, { token, method: 'DELETE' });
      toast.success('Değerlendirme silindi');
      if (selectedSchool) fetchSchoolDetail(selectedSchool.id);
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
      await fetchApi(`/questions/${questionId}`, { token, method: 'DELETE' });
      toast.success('Soru silindi');
      if (selectedSchool) fetchSchoolDetail(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  const [favoriting, setFavoriting] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const handleToggleFavorite = async () => {
    if (!token || !selectedSchool) {
      toast.error('Favorilere eklemek için giriş yapmalısınız.');
      return;
    }
    setFavoriting(true);
    try {
      if (selectedSchool.is_favorited) {
        await fetchApi<{ removed: boolean }>(`/schools/${selectedSchool.id}/favorite`, { token, method: 'DELETE' });
        setSelectedSchool((s) => (s ? { ...s, is_favorited: false } : null));
        toast.success('Favorilerden çıkarıldı');
      } else {
        await fetchApi<{ added: boolean }>(`/schools/${selectedSchool.id}/favorite`, { token, method: 'POST' });
        setSelectedSchool((s) => (s ? { ...s, is_favorited: true } : null));
        toast.success('Favorilere eklendi');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem yapılamadı');
    } finally {
      setFavoriting(false);
    }
  };

  const handleDeleteAnswer = async (answerId: string) => {
    if (!token) return;
    if (!confirm('Bu cevabı silmek istediğinize emin misiniz?')) return;
    setDeletingId(answerId);
    try {
      await fetchApi(`/answers/${answerId}`, { token, method: 'DELETE' });
      toast.success('Cevap silindi');
      if (selectedSchool) fetchSchoolDetail(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  const isLoggedIn = !!me && !!token;
  const citiesList = cities.length > 0 ? cities : TURKEY_CITIES;
  const districtsList = districts.length > 0 ? districts : getDistrictsForCity(city, []);

  const applySearch = useCallback(() => {
    setDebouncedSearch(search);
    setDebouncedCity(city);
    setDebouncedDistrict(district);
    setPage(1);
    if (search.trim() || city || district) {
      saveRecentSearch({ search, city, district });
      setRecentSearches(loadRecentSearches());
    }
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (city) params.set('city', city);
    if (district) params.set('district', district);
    const qs = params.toString();
    router.replace(qs ? `${PAGE_PATH}?${qs}` : PAGE_PATH, { scroll: false });
  }, [search, city, district]);

  const applyRecentSearch = useCallback((item: RecentSearch) => {
    setSearch(item.search);
    setCity(item.city);
    setDistrict(item.district);
    setDebouncedSearch(item.search);
    setDebouncedCity(item.city);
    setDebouncedDistrict(item.district);
    setPage(1);
  }, []);

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (schools.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedListIndex((i) => (i < schools.length - 1 ? i + 1 : i));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedListIndex((i) => (i > 0 ? i - 1 : i));
      } else if (e.key === 'Enter' && selectedListIndex >= 0 && schools[selectedListIndex]) {
        e.preventDefault();
        fetchSchoolDetail(schools[selectedListIndex].id);
      }
    },
    [schools, selectedListIndex, fetchSchoolDetail]
  );

  useEffect(() => {
    if (selectedListIndex >= 0 && selectedListIndex < schools.length && listRef.current) {
      const el = listRef.current.children[selectedListIndex] as HTMLElement;
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedListIndex, schools.length]);

  useEffect(() => {
    if (!shareMenuOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) setShareMenuOpen(false);
    };
    document.addEventListener('click', onOutside, true);
    return () => document.removeEventListener('click', onOutside, true);
  }, [shareMenuOpen]);

  const getShareUrl = useCallback(() => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    const params = new URLSearchParams();
    if (selectedSchool) params.set('id', selectedSchool.id);
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (debouncedCity) params.set('city', debouncedCity);
    if (debouncedDistrict) params.set('district', debouncedDistrict);
    return `${base}${PAGE_PATH}?${params.toString()}`;
  }, [selectedSchool, debouncedSearch, debouncedCity, debouncedDistrict]);

  const handleShare = useCallback(
    (channel: 'copy' | 'whatsapp' | 'twitter') => {
      const url = getShareUrl();
      const text = selectedSchool ? `${selectedSchool.name} – Okul Değerlendirmeleri` : 'Okul Değerlendirmeleri';
      if (channel === 'copy') {
        navigator.clipboard?.writeText(url).then(() => toast.success('Link kopyalandı'));
        setShareMenuOpen(false);
        return;
      }
      if (channel === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank', 'noopener,noreferrer');
        setShareMenuOpen(false);
        return;
      }
      if (channel === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
        setShareMenuOpen(false);
      }
    },
    [getShareUrl, selectedSchool]
  );

  return (
    <div className="min-h-screen">
      {/* Hero – modern anasayfa üst alan */}
      <div className="relative overflow-visible bg-gradient-to-br from-sky-600 via-teal-600 to-emerald-700 dark:from-sky-800 dark:via-teal-800 dark:to-emerald-900">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl drop-shadow-sm">
              Okul Değerlendirmeleri
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-sky-100/90">
              Türkiye&apos;deki okulları keşfedin. Kullanıcı deneyimlerini okuyun, kendi değerlendirmenizi paylaşın.
            </p>
          </div>

          {/* İstatistikler */}
          {homeStats && (
            <div className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-4">
              <div className="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur">
                <SchoolIcon className="mx-auto size-6 text-sky-200" />
                <p className="mt-1 text-2xl font-bold text-white">{homeStats.school_count.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-sky-100/80">Okul</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur">
                <StarIcon className="mx-auto size-6 text-amber-300" filled />
                <p className="mt-1 text-2xl font-bold text-white">{homeStats.review_count.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-sky-100/80">Değerlendirme</p>
              </div>
              <div className="rounded-xl bg-white/10 px-4 py-3 text-center backdrop-blur">
                <MessageIcon className="mx-auto size-6 text-emerald-200" />
                <p className="mt-1 text-2xl font-bold text-white">{homeStats.question_count.toLocaleString('tr-TR')}</p>
                <p className="text-xs text-sky-100/80">Soru</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Son aktivite baloncukları – KVK: "Bir kullanıcı", kişi/yorum metni yok */}
      {(() => {
        const activities: ActivityItem[] = [
          ...recentReviews.map((r) => ({ id: `r-${r.id}`, school_id: r.school_id, school_name: r.school_name, type: 'review' as const, created_at: r.created_at })),
          ...recentQuestions.map((q) => ({ id: `q-${q.id}`, school_id: q.school_id, school_name: q.school_name, type: 'question' as const, created_at: q.created_at })),
          ...recentAnswers.map((a) => ({ id: `a-${a.id}`, school_id: a.school_id, school_name: a.school_name, type: 'answer' as const, created_at: a.created_at })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);

        const labels = { review: 'için değerlendirme yaptı', question: 'hakkında soru sordu', answer: 'hakkında cevap verdi' };
        const colors = { review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200', question: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200', answer: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' };

        if (activities.length === 0) return null;
        return (
          <div className="border-y border-slate-100 bg-slate-50/50 py-4 dark:border-slate-800 dark:bg-slate-900/30">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Son aktiviteler</p>
              <div className="flex flex-wrap justify-center gap-2">
                {activities.map((act) => (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => fetchSchoolDetail(act.school_id)}
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-md ${colors[act.type]}`}
                    title={`${act.school_name} detayına git`}
                  >
                    <span>Bir kullanıcı <strong>{act.school_name}</strong> {labels[act.type]}</span>
                    <span className="text-[10px] opacity-75">· {formatRelativeTime(act.created_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Arama – hero dışında, renk hiyerarşisi */}
      <Card className="mb-4 border-slate-200/80 shadow-sm dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="mb-3 text-xs font-medium text-slate-500 dark:text-slate-400" role="status">
              Okul adı yazın veya il / ilçe seçerek filtreleyin
            </p>
            {recentSearches.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {recentSearches.filter((r) => r.search.trim() || r.city || r.district).map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyRecentSearch(r)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-sky-700 dark:hover:bg-sky-950/50"
                    aria-label={`Son arama: ${[r.search, r.city, r.district].filter(Boolean).join(', ')}`}
                  >
                    {[r.search, r.city, r.district].filter(Boolean).join(' · ')}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <input
                    type="search"
                    placeholder="Okul adı ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applySearch();
                      }
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    aria-label="Okul adı arama"
                    autoComplete="off"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={city}
                    onChange={(e) => { setCity(e.target.value); setDistrict(''); }}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    aria-label="İl seçin"
                  >
                    <option value="">Tüm iller</option>
                    {citiesList.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    aria-label="İlçe seçin"
                  >
                    <option value="">Tüm ilçeler</option>
                    {districtsList.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={applySearch}
                  className="flex-1 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-500 transition-colors sm:flex-none"
                  aria-label="Ara"
                >
                  Ara
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCity('');
                    setDistrict('');
                    setDebouncedSearch('');
                    setDebouncedCity('');
                    setDebouncedDistrict('');
                    setPage(1);
                    router.replace(PAGE_PATH, { scroll: false });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  aria-label="Sıfırla"
                >
                  Sıfırla
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      {/* Arama sonucu bilgisi – ton farkı */}
      {!moduleDisabled && !loading && (
        <div
          className="mb-4 rounded-lg border border-slate-200/60 bg-slate-50 px-4 py-2.5 dark:border-slate-700/50 dark:bg-slate-800/30"
          aria-live="polite"
        >
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Arama sonucu: <span className="text-sky-600 dark:text-sky-400">{total.toLocaleString('tr-TR')}</span> okul bulundu.
            {schools.length > 0 && (
              <span className="ml-2 text-slate-500 dark:text-slate-400">
                Aşağıdaki listeden seçerek detayları görüntüleyebilirsiniz.
              </span>
            )}
          </p>
        </div>
      )}
      {moduleDisabled ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-6 text-center">
          <p className="font-medium text-amber-800 dark:text-amber-200">Bu özellik şu an kullanılamıyor</p>
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
            Okul değerlendirme modülü geçici olarak kapalıdır. Lütfen daha sonra tekrar deneyin.
          </p>
        </div>
      ) : error ? (
        <Alert variant="error" message={error} />
      ) : null}

      {!moduleDisabled && (
      <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
        {/* Sol: Modern keşif paneli */}
        <aside className="flex flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] overflow-y-auto">
          <div className="space-y-5 rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/50 dark:border-slate-700/60 dark:bg-slate-900/60 dark:shadow-slate-950/50 backdrop-blur-sm">
            {/* Hızlı istatistikler */}
            {homeStats && (
              <div className="grid grid-cols-3 gap-2 px-4 pt-5">
                <div className="rounded-xl bg-gradient-to-br from-sky-500/10 to-teal-500/10 px-3 py-2.5 text-center dark:from-sky-500/15 dark:to-teal-500/15">
                  <SchoolIcon className="mx-auto size-5 text-sky-600 dark:text-sky-400" />
                  <p className="mt-1 text-lg font-bold text-slate-800 dark:text-white tabular-nums">{homeStats.school_count.toLocaleString('tr-TR')}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Okul</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 px-3 py-2.5 text-center dark:from-amber-500/15 dark:to-orange-500/15">
                  <StarIcon className="mx-auto size-5 text-amber-600 dark:text-amber-400" filled />
                  <p className="mt-1 text-lg font-bold text-slate-800 dark:text-white tabular-nums">{homeStats.review_count.toLocaleString('tr-TR')}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Yorum</p>
                </div>
                <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 px-3 py-2.5 text-center dark:from-emerald-500/15 dark:to-teal-500/15">
                  <MessageIcon className="mx-auto size-5 text-emerald-600 dark:text-emerald-400" />
                  <p className="mt-1 text-lg font-bold text-slate-800 dark:text-white tabular-nums">{homeStats.question_count.toLocaleString('tr-TR')}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Soru</p>
                </div>
              </div>
            )}

            {/* Arama sonucu – Okul listesi */}
            <section className="px-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                  <SchoolIcon className="size-4 text-sky-500" />
                  Okul listesi
                </h3>
                {!loading && (
                  <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:bg-sky-400/20 dark:text-sky-300">
                    {total.toLocaleString('tr-TR')} sonuç
                  </span>
                )}
              </div>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Arama veya filtre ile bulun, listeden seçin.</p>
            </section>
            <div className="border-t border-slate-100 dark:border-slate-800">
              {loading ? (
                <div className="space-y-1 p-4" role="status" aria-label="Okul listesi yükleniyor">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="flex gap-3 rounded-lg p-3">
                      <Skeleton className="h-5 flex-1 max-w-[70%]" />
                      <Skeleton className="h-3 w-16 shrink-0" />
                    </div>
                  ))}
                </div>
              ) : schools.length === 0 ? (
                <p className="py-10 px-4 text-center text-sm text-slate-500 dark:text-slate-400">Okul bulunamadı. Filtreleri değiştirmeyi deneyin.</p>
              ) : (
                <ul
                  ref={listRef}
                  role="listbox"
                  aria-label="Okul listesi"
                  tabIndex={0}
                  onKeyDown={handleListKeyDown}
                  className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  {schools.map((s, idx) => {
                    const sw = s as SchoolWithStats;
                    const isSelected = selectedSchool?.id === s.id;
                    const isFocused = selectedListIndex === idx;
                    return (
                      <li
                        key={s.id}
                        role="option"
                        aria-selected={isSelected}
                        aria-label={`${s.name}${s.city ? `, ${s.city}` : ''}${sw.avg_rating != null ? `, ${sw.avg_rating.toFixed(1)} puan` : ''}`}
                        className={`cursor-pointer px-4 py-3.5 transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                          isSelected
                            ? 'bg-gradient-to-r from-sky-50 to-teal-50/50 border-l-4 border-l-sky-500 dark:from-sky-950/40 dark:to-teal-950/20 dark:border-l-sky-400'
                            : isFocused
                            ? 'bg-slate-50 dark:bg-slate-800/70'
                            : ''
                        }`}
                        onClick={() => fetchSchoolDetail(s.id)}
                      >
                        <div className="font-semibold text-slate-900 dark:text-white">{s.name}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {s.city && <span>{s.city}</span>}
                          {s.district && <span>· {s.district}</span>}
                          {sw.avg_rating != null && (
                            <span className="inline-flex items-center gap-0.5 font-medium text-amber-600 dark:text-amber-400" title={`Ortalama: ${sw.avg_rating.toFixed(1)}`}>
                              <StarIcon className="size-3.5" filled aria-hidden />
                              {sw.avg_rating.toFixed(1)}
                            </span>
                          )}
                          {sw.question_count != null && sw.question_count > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <MessageIcon className="size-3.5" aria-hidden />
                              {sw.question_count} soru
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {total > 20 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/50 py-2.5 dark:border-slate-800 dark:bg-slate-900/30">
                  <button type="button" onClick={() => setPage(1)} disabled={page <= 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium disabled:opacity-50 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">İlk</button>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium disabled:opacity-50 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">Önceki</button>
                  <span className="px-2 text-xs font-medium text-slate-600 dark:text-slate-400">{page} / {Math.ceil(total / 20)}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(Math.ceil(total / 20), p + 1))} disabled={page >= Math.ceil(total / 20)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium disabled:opacity-50 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">Sonraki</button>
                  <button type="button" onClick={() => setPage(Math.ceil(total / 20))} disabled={page >= Math.ceil(total / 20)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium disabled:opacity-50 hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800">Son</button>
                </div>
              )}
            </div>

            {/* En çok görüntülenen okullar */}
            {topSchools.length > 0 && (
              <section className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                  <TrendingUpIcon className="size-4 text-amber-500" />
                  En çok görüntülenen
                </h3>
                <ul className="space-y-2">
                  {topSchools.slice(0, 5).map((s) => {
                    const sw = s as SchoolWithStats & { review_view_count?: number };
                    const views = sw.review_view_count ?? 0;
                    const isSelected = selectedSchool?.id === s.id;
                    return (
                      <li
                        key={s.id}
                        onClick={() => fetchSchoolDetail(s.id)}
                        className={`group cursor-pointer rounded-xl border p-2.5 transition-all duration-200 hover:border-sky-300 hover:shadow-md hover:shadow-sky-100/50 dark:hover:border-sky-700 dark:hover:shadow-sky-950/30 ${
                          isSelected ? 'border-sky-400 bg-sky-50/80 dark:border-sky-600 dark:bg-sky-950/40' : 'border-slate-200 bg-slate-50/30 dark:border-slate-700 dark:bg-slate-800/30'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="truncate font-medium text-slate-800 dark:text-white group-hover:text-sky-700 dark:group-hover:text-sky-300">{s.name}</span>
                          <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300" title={`${views} kez görüntülendi`}>
                            <EyeIcon className="size-3" aria-hidden />
                            {views >= 1000 ? `${(views / 1000).toFixed(1)}k` : views}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {sw.avg_rating != null && (
                            <span className="inline-flex items-center gap-0.5 font-medium text-amber-600 dark:text-amber-400">
                              <StarIcon className="size-3" filled aria-hidden />
                              {sw.avg_rating.toFixed(1)}
                            </span>
                          )}
                          {sw.review_count != null && <span>{sw.review_count} değerlendirme</span>}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Popüler yorumlar */}
            {recentReviews.length > 0 && (
              <section className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                  <StarIcon className="size-4 text-amber-500" filled />
                  Popüler yorumlar
                </h3>
                <ul className="space-y-2">
                  {recentReviews.slice(0, 4).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => fetchSchoolDetail(r.school_id)}
                        className="w-full rounded-xl border border-slate-200/80 bg-amber-50/30 p-3 text-left transition-all duration-200 hover:border-amber-300 hover:bg-amber-50/60 dark:border-slate-700 dark:bg-amber-950/20 dark:hover:border-amber-700 dark:hover:bg-amber-950/40"
                      >
                        <p className="line-clamp-2 text-xs text-slate-700 dark:text-slate-200">{r.comment || 'Puan verildi'}</p>
                        <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600 dark:text-amber-400">
                            <StarIcon className="size-3" filled aria-hidden />
                            {r.rating.toFixed(1)}
                          </span>
                          <span className="truncate font-medium text-slate-600 dark:text-slate-400">{r.school_name}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Son sorulan sorular */}
            {recentQuestions.length > 0 && (
              <section className="border-t border-slate-100 px-4 py-4 dark:border-slate-800">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                  <HelpIcon className="size-4 text-teal-500" />
                  Son sorulan sorular
                </h3>
                <ul className="space-y-2">
                  {recentQuestions.slice(0, 4).map((q) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => fetchSchoolDetail(q.school_id)}
                        className="w-full rounded-xl border border-slate-200/80 bg-teal-50/30 p-3 text-left transition-all duration-200 hover:border-teal-300 hover:bg-teal-50/60 dark:border-slate-700 dark:bg-teal-950/20 dark:hover:border-teal-700 dark:hover:bg-teal-950/40"
                      >
                        <p className="line-clamp-2 text-xs text-slate-700 dark:text-slate-200">{q.question}</p>
                        <p className="mt-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400">{q.school_name}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Nasıl kullanılır */}
            <section className="rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/30">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <HelpIcon className="size-3.5" aria-hidden />
                Nasıl kullanılır?
              </h3>
              <ul className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                <li>• Soldan okul seçin veya arama ile filtreleyin</li>
                <li>• Klavye: ↑↓ ile gezinin, Enter ile detay açın</li>
                <li>• Giriş yaparak puan, yorum ve soru ekleyin</li>
              </ul>
            </section>
          </div>
        </aside>

        {/* Sağ: Okul detay */}
        <div ref={detailSectionRef} className="space-y-6">
          {selectedSchool ? (
            <div className="space-y-6">
              <Card className="overflow-hidden border-slate-200/80 shadow-md dark:border-slate-700/50">
                <div className="bg-gradient-to-br from-slate-50 via-slate-50/80 to-sky-50/50 dark:from-slate-900/50 dark:via-slate-900/30 dark:to-sky-950/30 px-6 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedSchool.name}</h2>
                    <div className="flex shrink-0 items-center gap-1">
                      {isLoggedIn && (
                        <button
                          type="button"
                          onClick={handleToggleFavorite}
                          disabled={favoriting}
                          className={`rounded-lg p-2 transition-colors disabled:opacity-50 ${
                            selectedSchool.is_favorited
                              ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400'
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300'
                          }`}
                          aria-label={selectedSchool.is_favorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                          title={selectedSchool.is_favorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                        >
                          <HeartIcon className="size-5" filled={!!selectedSchool.is_favorited} />
                        </button>
                      )}
                      <div className="relative" ref={shareMenuRef}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareMenuOpen((v) => !v);
                          }}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                          aria-label="Paylaş"
                          aria-expanded={shareMenuOpen}
                          aria-haspopup="true"
                          title="Paylaş"
                        >
                          <ShareIcon className="size-5" />
                        </button>
                        {shareMenuOpen && (
                          <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                            <button
                              type="button"
                              onClick={() => handleShare('copy')}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <ShareIcon className="size-4" />
                              Linki kopyala
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShare('whatsapp')}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <span className="text-[#25D366] font-semibold">WhatsApp</span>
                              ile paylaş
                            </button>
                            <button
                              type="button"
                              onClick={() => handleShare('twitter')}
                              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              <span className="font-medium text-slate-800 dark:text-slate-200">X</span>
                              (Twitter) ile paylaş
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    {selectedSchool.city && (
                      <span className="text-slate-600 dark:text-slate-400">{selectedSchool.city}</span>
                    )}
                    {selectedSchool.district && (
                      <span className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
                        <ChevronRightIcon className="size-4" />
                        {selectedSchool.district}
                      </span>
                    )}
                    {selectedSchool.avg_rating != null && (
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 font-semibold text-amber-700/90 dark:text-amber-400/90"
                        title={`Ortalama puan: ${selectedSchool.avg_rating.toFixed(1)} / 5`}
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <StarIcon
                            key={n}
                            size={16}
                            filled={n <= Math.round(selectedSchool.avg_rating!)}
                            className={n <= Math.round(selectedSchool.avg_rating!) ? 'text-amber-500' : 'text-amber-300/50 dark:text-amber-500/30'}
                            aria-hidden
                          />
                        ))}
                        <span className="ml-0.5">{selectedSchool.avg_rating.toFixed(1)}</span>
                      </span>
                    )}
                    <span className="text-slate-500">{selectedSchool.review_count} değerlendirme</span>
                    <span className="text-slate-500">{selectedSchool.question_count} soru</span>
                    {selectedSchool.review_view_count != null && selectedSchool.review_view_count > 0 && (
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <EyeIcon className="size-4" />
                        {selectedSchool.review_view_count} görüntülenme
                      </span>
                    )}
                  </div>
                </div>
                {selectedSchool.criteria_averages && Object.keys(selectedSchool.criteria_averages).length > 0 && (
                  <CardContent className="space-y-3 pt-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Kriter ortalamaları</p>
                    <div className="space-y-2">
                      {(selectedSchool.criteria || [])
                        .filter((c) => selectedSchool.criteria_averages?.[c.slug] != null)
                        .map((c) => (
                          <div key={c.id} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-400">{c.label}</span>
                              <span className="font-medium">{(selectedSchool.criteria_averages?.[c.slug] ?? 0).toFixed(1)}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/50">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-sky-400 to-teal-400 dark:from-sky-500/80 dark:to-teal-500/80 transition-all duration-500"
                                style={{ width: `${((selectedSchool.criteria_averages?.[c.slug] ?? 0) / 5) * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                )}
                {selectedSchool.rating_distribution && selectedSchool.review_count > 0 && (
                  <CardContent className="space-y-3 pt-5 border-t border-slate-100 dark:border-slate-800/80">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Puan dağılımı</p>
                    <div className="space-y-2" role="img" aria-label="1-5 yıldız puan dağılımı">
                      {([5, 4, 3, 2, 1] as const).map((stars) => {
                        const count = selectedSchool.rating_distribution?.[stars] ?? 0;
                        const maxCount = Math.max(
                          ...([1, 2, 3, 4, 5] as const).map((s) => selectedSchool.rating_distribution?.[s] ?? 0),
                          1
                        );
                        const pct = (count / maxCount) * 100;
                        return (
                          <div key={stars} className="flex items-center gap-3">
                            <span className="flex w-16 shrink-0 items-center gap-0.5 text-xs text-slate-600 dark:text-slate-400">
                              {stars}
                              <StarIcon size={12} filled className="text-amber-500" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="h-5 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/50">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 dark:from-amber-500/90 dark:to-amber-600 transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-600 dark:text-slate-400">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                )}
              </Card>

              <div
                role="tablist"
                aria-label="İçerik sekmeleri"
                className="flex gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'reviews'}
                  aria-controls="reviews-panel"
                  id="tab-reviews"
                  onClick={() => setActiveTab('reviews')}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === 'reviews'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Puan ve Yorumlar ({reviews.total})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'questions'}
                  aria-controls="questions-panel"
                  id="tab-questions"
                  onClick={() => setActiveTab('questions')}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
                    activeTab === 'questions'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  Soru ve Cevaplar ({questions.total})
                </button>
              </div>

              {activeTab === 'reviews' ? (
                <div id="reviews-panel" role="tabpanel" aria-labelledby="tab-reviews">
                  <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-base">Bu Okula Değerlendirme Gönder</CardTitle>
                      {!isLoggedIn ? (
                        <div className="mt-2 flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 p-4">
                          <LogInIcon className="size-5 text-amber-600 dark:text-amber-400" />
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            Değerlendirme yapmak için{' '}
                            <Link href={`/login?redirect=${PAGE_PATH}`} className="font-medium underline underline-offset-2">
                              giriş yapın
                            </Link>
                            .
                          </p>
                        </div>
                      ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Puan verin ve yorumunuzu yazın. İsterseniz &quot;İsmim gizli kalsın&quot; ile anonim paylaşabilirsiniz.
                        </p>
                      )}
                    </CardHeader>
                    {isLoggedIn && (
                      <CardContent className="space-y-5">
                        {(selectedSchool.criteria || []).length > 0 ? (
                          <div className="space-y-4">
                            {selectedSchool.criteria!.map((c) => (
                              <div key={c.id} className="space-y-2">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                  {c.label}
                                  {c.hint && <span className="ml-1 font-normal text-slate-500">({c.hint})</span>}
                                </label>
                                <div className="flex gap-1">
                                  {[1, 2, 3, 4, 5].map((n) => (
                                    <button
                                      key={n}
                                      type="button"
                                      onClick={() =>
                                        setReviewForm((f) => ({
                                          ...f,
                                          criteria_ratings: { ...f.criteria_ratings, [c.slug]: n },
                                        }))
                                      }
                                      aria-label={`${c.label}: ${n} yıldız`}
                                      aria-pressed={(reviewForm.criteria_ratings[c.slug] ?? 0) >= n}
                                      className={`rounded-lg p-2 transition-all duration-200 ease-out hover:scale-125 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 motion-reduce:transform-none ${
                                        (reviewForm.criteria_ratings[c.slug] ?? 0) >= n
                                          ? 'text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]'
                                          : 'text-slate-300 hover:text-amber-400 dark:text-slate-600 dark:hover:text-amber-400/80'
                                      }`}
                                    >
                                      <StarIcon
                                        size={24}
                                        filled={(reviewForm.criteria_ratings[c.slug] ?? 0) >= n}
                                        className={`size-6 transition-opacity duration-200 text-amber-500 ${
                                          (reviewForm.criteria_ratings[c.slug] ?? 0) >= n ? 'opacity-100' : 'opacity-30'
                                        }`}
                                      />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Genel puan (1-5)</label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                                  aria-label={`Genel puan: ${n} yıldız`}
                                  aria-pressed={reviewForm.rating >= n}
                                  className={`rounded-lg p-2 transition-all duration-200 ease-out hover:scale-125 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 motion-reduce:transform-none ${
                                    reviewForm.rating >= n ? 'text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600 dark:hover:text-amber-400/80'
                                  }`}
                                >
                                  <StarIcon className="size-6 transition-opacity duration-200 text-amber-500" filled={reviewForm.rating >= n} />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <label className="mb-1 block text-sm font-medium">Yorum (opsiyonel)</label>
                          <textarea
                            value={reviewForm.comment}
                            onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                            rows={3}
                            placeholder="Deneyiminizi paylaşın..."
                            className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900"
                          />
                        </div>
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            checked={reviewForm.is_anonymous}
                            onChange={(e) => setReviewForm((f) => ({ ...f, is_anonymous: e.target.checked }))}
                            className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm">İsmim gizli kalsın</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleSubmitReview}
                          disabled={submitting}
                          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {submitting ? 'Gönderiliyor…' : 'Gönder'}
                        </button>
                      </CardContent>
                    )}
                  </Card>

                  <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
                    <CardHeader>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-base">Puan ve Yorumlar</CardTitle>
                          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Bu okula yapılan puan ve yorumlar. İsim gizleyenler &quot;Anonim kullanıcı&quot; olarak görünür.</p>
                        </div>
                        <div className="shrink-0">
                          <label htmlFor="review-sort" className="sr-only">
                            Yorumları sırala
                          </label>
                          <select
                            id="review-sort"
                            value={reviewSort}
                            onChange={(e) => setReviewSort(e.target.value as typeof reviewSort)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            aria-label="Yorumları sırala"
                          >
                            <option value="newest">En yeniler</option>
                            <option value="most_liked">En çok beğenilen</option>
                            <option value="rating_high">Puana göre (yüksekten düşüğe)</option>
                            <option value="rating_low">Puana göre (düşükten yükseğe)</option>
                          </select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {reviews.items.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-500">Bu okula henüz puan veya yorum yazılmamış. İlk değerlendirmeyi siz yapın!</p>
                      ) : (
                        <ul className="space-y-5 divide-y divide-slate-100 dark:divide-slate-800">
                          {reviews.items.map((r) => (
                            <li key={r.id} className="pt-5 first:pt-0">
                              {editingReviewId === r.id && editReviewForm ? (
                                <div className="space-y-4 rounded-lg border border-sky-200/60 bg-sky-50/30 p-4 dark:border-sky-800/50 dark:bg-sky-950/20">
                                  <p className="text-xs font-medium text-sky-700 dark:text-sky-300">Değerlendirmenizi güncelleyin</p>
                                  {(selectedSchool?.criteria || []).length > 0 ? (
                                    <div className="space-y-3">
                                      {(selectedSchool?.criteria || []).map((c) => (
                                        <div key={c.id} className="space-y-1">
                                          <label className="text-xs font-medium">{c.label}</label>
                                          <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((n) => (
                                              <button
                                                key={n}
                                                type="button"
                                                onClick={() =>
                                                  setEditReviewForm((f) =>
                                                    f ? { ...f, criteria_ratings: { ...f.criteria_ratings, [c.slug]: n } } : null
                                                  )
                                                }
                                                className={`rounded p-1.5 transition-all duration-200 hover:scale-110 active:scale-95 ${
                                                  (editReviewForm.criteria_ratings[c.slug] ?? 0) >= n ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
                                                }`}
                                              >
                                                <StarIcon className={`size-5 transition-opacity duration-200 text-amber-500 ${(editReviewForm.criteria_ratings[c.slug] ?? 0) >= n ? 'opacity-100' : 'opacity-30'}`} filled={(editReviewForm.criteria_ratings[c.slug] ?? 0) >= n} />
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <label className="text-xs font-medium">Genel puan</label>
                                      <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((n) => (
                                          <button
                                            key={n}
                                            type="button"
                                            onClick={() => setEditReviewForm((f) => (f ? { ...f, rating: n } : null))}
                                            className={`rounded p-1.5 transition-all duration-200 hover:scale-110 active:scale-95 ${
                                              editReviewForm.rating >= n ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400 dark:text-slate-600'
                                            }`}
                                          >
                                            <StarIcon className={`size-5 transition-opacity duration-200 text-amber-500 ${editReviewForm.rating >= n ? 'opacity-100' : 'opacity-30'}`} filled={editReviewForm.rating >= n} />
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  <div>
                                    <label className="mb-1 block text-xs font-medium">Yorum (isteğe bağlı)</label>
                                    <textarea
                                      value={editReviewForm.comment}
                                      onChange={(e) => setEditReviewForm((f) => (f ? { ...f, comment: e.target.value } : null))}
                                      rows={4}
                                      placeholder="Değerlendirmenize yorum ekleyebilirsiniz."
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                    />
                                  </div>
                                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                                    <input
                                      type="checkbox"
                                      checked={editReviewForm.is_anonymous}
                                      onChange={(e) => setEditReviewForm((f) => (f ? { ...f, is_anonymous: e.target.checked } : null))}
                                    />
                                    İsmim gizli kalsın
                                  </label>
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateReview(r.id)}
                                      disabled={submitting}
                                      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                    >
                                      {submitting ? 'Kaydediliyor…' : 'Güncelle'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditingReview}
                                      className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
                                    >
                                      İptal
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center justify-between text-xs text-slate-500">
                                    <span>{r.is_anonymous ? 'Anonim kullanıcı' : r.author_display_name}</span>
                                    <div className="flex items-center gap-2">
                                      {r.is_own && isLoggedIn && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => startEditingReview(r)}
                                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium text-sky-600 hover:bg-sky-100 dark:text-sky-400 dark:hover:bg-sky-900/50"
                                            aria-label="Değerlendirmeyi düzenle"
                                          >
                                            <PencilIcon className="size-3.5" />
                                            Düzenle
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteReview(r.id)}
                                            disabled={deletingId === r.id}
                                            className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50"
                                            aria-label="Değerlendirmeyi sil"
                                          >
                                            <TrashIcon className="size-3.5" />
                                            Sil
                                          </button>
                                        </>
                                      )}
                                      <span>{new Date(r.created_at).toLocaleDateString('tr-TR')}</span>
                                    </div>
                                  </div>
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="flex items-center gap-0.5 text-amber-500">
                                      <StarIcon className="size-4 text-amber-500" filled />
                                      {r.rating.toFixed(1)}
                                    </span>
                                    {r.criteria_ratings && selectedSchool.criteria && Object.keys(r.criteria_ratings).length > 0 && (
                                      <span className="text-xs text-slate-500">
                                        {Object.entries(r.criteria_ratings)
                                          .map(([slug, v]) => {
                                            const c = selectedSchool.criteria!.find((x) => x.slug === slug);
                                            return c ? `${c.label}: ${v}` : null;
                                          })
                                          .filter(Boolean)
                                          .join(' · ')}
                                      </span>
                                    )}
                                  </div>
                                  {r.comment && <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{r.comment}</p>}
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {!r.is_own && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleLike(r.id)}
                                          disabled={likingId === r.id}
                                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                            r.user_has_liked
                                              ? 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-800/50'
                                              : 'bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-sky-900/30 dark:hover:text-sky-400'
                                          }`}
                                          aria-label={r.user_has_liked ? 'Beğenmekten vazgeç' : 'Beğen'}
                                          title={r.user_has_liked ? 'Beğenmekten vazgeç' : 'Beğen'}
                                        >
                                          <ThumbsUpIcon size={14} filled={r.user_has_liked} />
                                          <span>Beğen</span>
                                          {(r.like_count ?? 0) > 0 && <span className="text-[10px] opacity-80">({r.like_count})</span>}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleDislike(r.id)}
                                          disabled={dislikingId === r.id}
                                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                            r.user_has_disliked
                                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-800/50'
                                              : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-400'
                                          }`}
                                          aria-label={r.user_has_disliked ? 'Beğenmekten vazgeç' : 'Beğenme'}
                                          title={r.user_has_disliked ? 'Beğenmekten vazgeç' : 'Beğenme'}
                                        >
                                          <ThumbsDownIcon size={14} filled={r.user_has_disliked} />
                                          <span>Beğenme</span>
                                          {(r.dislike_count ?? 0) > 0 && <span className="text-[10px] opacity-80">({r.dislike_count})</span>}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setReportTarget({ type: 'review', id: r.id }); setReportReason('diger'); setReportComment(''); }}
                                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                          aria-label="Uygunsuz içerik bildir"
                                          title="Uygunsuz içerik bildir"
                                        >
                                          <FlagIcon size={12} />
                                          Bildir
                                        </button>
                                      </>
                                    )}
                                    {r.is_own && ((r.like_count ?? 0) > 0 || (r.dislike_count ?? 0) > 0) && (
                                      <span className="inline-flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                        {(r.like_count ?? 0) > 0 && (
                                          <span className="inline-flex items-center gap-1">
                                            <ThumbsUpIcon size={12} filled />
                                            {r.like_count} beğeni
                                          </span>
                                        )}
                                        {(r.dislike_count ?? 0) > 0 && (
                                          <span className="inline-flex items-center gap-1">
                                            <ThumbsDownIcon size={12} filled />
                                            {r.dislike_count} beğenme
                                          </span>
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div id="questions-panel" role="tabpanel" aria-labelledby="tab-questions">
                  <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
                    <CardHeader>
                      <CardTitle className="text-base">Bu Okul Hakkında Soru Sor</CardTitle>
                      {!isLoggedIn ? (
                        <div className="mt-2 flex items-center gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 p-4">
                          <LogInIcon className="size-5 text-amber-600 dark:text-amber-400" />
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            Soru sormak için{' '}
                            <Link href={`/login?redirect=${PAGE_PATH}`} className="font-medium underline underline-offset-2">
                              giriş yapın
                            </Link>
                            .
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-slate-600 dark:text-slate-400">Merak ettiğiniz konuları sorun, diğer kullanıcılar cevap verebilir.</p>
                          <div className="mt-3 space-y-3">
                            <textarea
                              value={questionForm}
                              onChange={(e) => setQuestionForm(e.target.value)}
                              rows={2}
                              placeholder="Bu okul hakkında bir soru sorun..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                            />
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={questionIsAnonymous}
                                onChange={(e) => setQuestionIsAnonymous(e.target.checked)}
                                className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                              />
                              İsmim gizli kalsın
                            </label>
                            <button
                              type="button"
                              onClick={handleSubmitQuestion}
                              disabled={submitting || !questionForm.trim()}
                              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                              {submitting ? 'Gönderiliyor…' : 'Soru Gönder'}
                            </button>
                          </div>
                        </>
                      )}
                    </CardHeader>
                  </Card>

                  <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
                    <CardHeader>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <CardTitle className="text-base">Sorulan Sorular ve Cevaplar</CardTitle>
                          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">Okul hakkında sorulan sorular ve kullanıcıların verdiği cevaplar. Giriş yaparak siz de cevap verebilirsiniz.</p>
                        </div>
                        <div className="shrink-0">
                          <label htmlFor="question-sort" className="sr-only">
                            Soruları sırala
                          </label>
                          <select
                            id="question-sort"
                            value={questionSort}
                            onChange={(e) => setQuestionSort(e.target.value as typeof questionSort)}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            aria-label="Soruları sırala"
                          >
                            <option value="newest">En yeniler</option>
                            <option value="most_answers">En çok cevaplanan</option>
                            <option value="most_liked">En çok beğenilen</option>
                          </select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {questions.items.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-500">Bu okul hakkında henüz soru sorulmamış. Merak ettiğiniz konuyu ilk siz sorun!</p>
                      ) : (
                        <ul className="space-y-5">
                          {questions.items.map((q) => (
                            <li key={q.id} className="rounded-xl border border-slate-200/80 bg-slate-50/30 dark:border-slate-700/50 dark:bg-slate-800/30 overflow-hidden">
                              <div className="px-4 py-3">
                                {editingQuestionId === q.id && editQuestionForm !== null ? (
                                  <div className="space-y-3 rounded-lg border border-sky-200/60 bg-sky-50/30 p-3 dark:border-sky-800/50 dark:bg-sky-950/20">
                                    <textarea
                                      value={editQuestionForm}
                                      onChange={(e) => setEditQuestionForm(e.target.value)}
                                      rows={3}
                                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                      placeholder="Soru metnini girin"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateQuestion(q.id)}
                                        disabled={submitting}
                                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                      >
                                        {submitting ? 'Kaydediliyor…' : 'Güncelle'}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={cancelEditingQuestion}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium dark:border-slate-700"
                                      >
                                        İptal
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <p className="font-semibold text-slate-800 dark:text-slate-100">{q.question}</p>
                                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                      <span>{q.is_anonymous ? 'Anonim kullanıcı' : q.author_display_name}</span>
                                      <span>·</span>
                                      <span>{new Date(q.created_at).toLocaleDateString('tr-TR', { dateStyle: 'medium' })}</span>
                                      {q.is_own && isLoggedIn && (
                                        <>
                                          <span>·</span>
                                          <button
                                            type="button"
                                            onClick={() => startEditingQuestion(q)}
                                            className="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline dark:text-sky-400"
                                            aria-label="Soruyu düzenle"
                                          >
                                            <PencilIcon className="size-3.5" />
                                            Düzenle
                                          </button>
                                          <span>·</span>
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteQuestion(q.id)}
                                            disabled={deletingId === q.id}
                                            className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline dark:text-red-400 disabled:opacity-50"
                                            aria-label="Soruyu sil"
                                          >
                                            <TrashIcon className="size-3.5" />
                                            Sil
                                          </button>
                                        </>
                                      )}
                                    </div>
                                    {!q.is_own && (
                                      <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleQuestionLike(q.id)}
                                          disabled={likingQuestionId === q.id}
                                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                            q.user_has_liked
                                              ? 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-800/50'
                                              : 'bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-sky-900/30 dark:hover:text-sky-400'
                                          }`}
                                          aria-label="Beğen"
                                          title="Beğen"
                                        >
                                          <ThumbsUpIcon size={14} filled={q.user_has_liked} />
                                          <span>Beğen</span>
                                          {(q.like_count ?? 0) > 0 && <span className="text-[10px] opacity-80">({q.like_count})</span>}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleQuestionDislike(q.id)}
                                          disabled={dislikingQuestionId === q.id}
                                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                                            q.user_has_disliked
                                              ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-800/50'
                                              : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-400'
                                          }`}
                                          aria-label="Beğenme"
                                          title="Beğenme"
                                        >
                                          <ThumbsDownIcon size={14} filled={q.user_has_disliked} />
                                          <span>Beğenme</span>
                                          {(q.dislike_count ?? 0) > 0 && <span className="text-[10px] opacity-80">({q.dislike_count})</span>}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setReportTarget({ type: 'question', id: q.id }); setReportReason('diger'); setReportComment(''); }}
                                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                          aria-label="Uygunsuz içerik bildir"
                                          title="Uygunsuz içerik bildir"
                                        >
                                          <FlagIcon size={12} />
                                          Bildir
                                        </button>
                                      </div>
                                    )}
                                    {q.is_own && ((q.like_count ?? 0) > 0 || (q.dislike_count ?? 0) > 0) && (
                                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                        {(q.like_count ?? 0) > 0 && (
                                          <span className="inline-flex items-center gap-1">
                                            <ThumbsUpIcon size={12} filled />
                                            {q.like_count} beğeni
                                          </span>
                                        )}
                                        {(q.dislike_count ?? 0) > 0 && (
                                          <span className="inline-flex items-center gap-1">
                                            <ThumbsDownIcon size={12} filled />
                                            {q.dislike_count} beğenme
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              {q.answers.length > 0 && (
                                <div className="space-y-2 border-t border-slate-200/80 bg-emerald-50/50 dark:border-slate-700/50 dark:bg-emerald-950/20 px-4 py-3">
                                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Cevaplar ({q.answers.length})</p>
                                  {q.answers.map((a) => (
                                    <div key={a.id} className="rounded-lg border border-emerald-200/60 bg-white px-3 py-2.5 dark:border-emerald-800/40 dark:bg-slate-800/50">
                                      {editingAnswerId === a.id && editAnswerForm !== null ? (
                                        <div className="space-y-2">
                                          <textarea
                                            value={editAnswerForm}
                                            onChange={(e) => setEditAnswerForm(e.target.value)}
                                            rows={3}
                                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                                            placeholder="Cevap metnini girin"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              onClick={() => handleUpdateAnswer(a.id)}
                                              disabled={submitting}
                                              className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                            >
                                              {submitting ? 'Kaydediliyor…' : 'Güncelle'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditingAnswer}
                                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium dark:border-slate-700"
                                            >
                                              İptal
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{a.answer}</p>
                                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                                            <span>— {a.is_anonymous ? 'Anonim kullanıcı' : a.author_display_name} · {new Date(a.created_at).toLocaleDateString('tr-TR')}</span>
                                            {a.is_own && isLoggedIn && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => startEditingAnswer(a)}
                                                  className="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline dark:text-sky-400"
                                                  aria-label="Cevabı düzenle"
                                                >
                                                  <PencilIcon className="size-3.5" />
                                                  Düzenle
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleDeleteAnswer(a.id)}
                                                  disabled={deletingId === a.id}
                                                  className="inline-flex items-center gap-1 font-medium text-red-600 hover:underline dark:text-red-400 disabled:opacity-50"
                                                  aria-label="Cevabı sil"
                                                >
                                                  <TrashIcon className="size-3.5" />
                                                  Sil
                                                </button>
                                              </>
                                            )}
                                          </div>
                                          <div className="mt-2 flex flex-wrap items-center gap-2">
                                            {!a.is_own && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleAnswerLike(a.id, q.id)}
                                                  disabled={likingAnswerId === a.id}
                                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                                    a.user_has_liked
                                                      ? 'bg-sky-100 text-sky-700 hover:bg-sky-200 dark:bg-sky-900/50 dark:text-sky-300 dark:hover:bg-sky-800/50'
                                                      : 'bg-slate-100 text-slate-600 hover:bg-sky-100 hover:text-sky-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-sky-900/30 dark:hover:text-sky-400'
                                                  }`}
                                                  aria-label="Beğen"
                                                  title="Beğen"
                                                >
                                                  <ThumbsUpIcon size={12} filled={a.user_has_liked} />
                                                  <span>Beğen</span>
                                                  {(a.like_count ?? 0) > 0 && <span className="text-[10px] opacity-80">({a.like_count})</span>}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleAnswerDislike(a.id, q.id)}
                                                  disabled={dislikingAnswerId === a.id}
                                                  className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                                    a.user_has_disliked
                                                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-800/50'
                                                      : 'bg-slate-100 text-slate-600 hover:bg-rose-100 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/30 dark:hover:text-rose-400'
                                                  }`}
                                                  aria-label="Beğenme"
                                                  title="Beğenme"
                                                >
                                                  <ThumbsDownIcon size={12} filled={a.user_has_disliked} />
                                                  <span>Beğenme</span>
                                                  {(a.dislike_count ?? 0) > 0 && <span className="text-[10px] opacity-80">({a.dislike_count})</span>}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => { setReportTarget({ type: 'answer', id: a.id, questionId: q.id }); setReportReason('diger'); setReportComment(''); }}
                                                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                                  aria-label="Uygunsuz içerik bildir"
                                                  title="Uygunsuz içerik bildir"
                                                >
                                                  <FlagIcon size={12} />
                                                  Bildir
                                                </button>
                                              </>
                                            )}
                                            {a.is_own && ((a.like_count ?? 0) > 0 || (a.dislike_count ?? 0) > 0) && (
                                              <span className="inline-flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                                {(a.like_count ?? 0) > 0 && (
                                                  <span className="inline-flex items-center gap-1">
                                                    <ThumbsUpIcon size={12} filled />
                                                    {a.like_count} beğeni
                                                  </span>
                                                )}
                                                {(a.dislike_count ?? 0) > 0 && (
                                                  <span className="inline-flex items-center gap-1">
                                                    <ThumbsDownIcon size={12} filled />
                                                    {a.dislike_count} beğenme
                                                  </span>
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="border-t border-slate-200/80 px-4 py-3 dark:border-slate-700/50">
                                {isLoggedIn ? (
                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={answerForms[q.id] ?? ''}
                                        onChange={(e) =>
                                          setAnswerForms((f) => ({ ...f, [q.id]: e.target.value }))
                                        }
                                        placeholder="Bu soruya cevap yazın..."
                                        className="flex-1 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSubmitAnswer(q.id)}
                                        disabled={submittingAnswer === q.id || !(answerForms[q.id]?.trim())}
                                        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                      >
                                        {submittingAnswer === q.id ? '…' : 'Cevap Ver'}
                                      </button>
                                    </div>
                                    <label className="flex cursor-pointer items-center gap-2 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={answerIsAnonymous[q.id] ?? false}
                                        onChange={(e) =>
                                          setAnswerIsAnonymous((a) => ({ ...a, [q.id]: e.target.checked }))
                                        }
                                        className="size-3.5 rounded border-slate-300 text-primary focus:ring-primary"
                                      />
                                      İsmim gizli kalsın
                                    </label>
                                  </div>
                                ) : (
                                  <p className="text-sm text-slate-500 dark:text-slate-400">
                                    <Link href={`/login?redirect=${PAGE_PATH}`} className="font-medium text-primary underline">
                                      Giriş yapın
                                    </Link>
                                    {' '}ve sorulara cevap yazın.
                                  </p>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {detailLoading ? (
                <Card className="border-slate-200/80 shadow-sm dark:border-slate-800">
                  <CardContent className="p-6">
                    <div className="space-y-4" role="status" aria-label="Okul detayı yükleniyor">
                      <Skeleton className="h-7 w-3/4" />
                      <div className="flex gap-3">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-24" />
                      </div>
                      <div className="space-y-2 pt-4">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-4/5" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                      <div className="space-y-3 pt-6">
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-16 w-full rounded-lg" />
                        <Skeleton className="h-12 w-3/4 rounded-lg" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Orta alan: Seçili filtreye göre kullanışlı içerik */}
                  {debouncedCity || debouncedDistrict ? (
                    /* Bölge seçili – il/ilçe özeti ve en iyi puanlılar */
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-teal-50/50 px-6 py-5 dark:border-sky-800/50 dark:from-sky-950/40 dark:to-teal-950/30">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-white">
                          <SchoolIcon className="size-5 text-sky-500" />
                          {[debouncedCity, debouncedDistrict].filter(Boolean).join(', ')}
                        </h2>
                        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                          Bu bölgede <span className="font-semibold text-sky-600 dark:text-sky-400">{total.toLocaleString('tr-TR')}</span> okul bulundu.
                          {schools.length > 0 && (
                            <span className="ml-1">
                              Soldaki listeden seçin veya aşağıdaki en iyi puanlı okullara göz atın.
                            </span>
                          )}
                        </p>
                      </div>

                      {schools.length > 0 ? (
                        <div>
                          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-white">
                            <StarIcon className="size-4 text-amber-500" filled />
                            Bu bölgede en iyi puanlı okullar
                          </h3>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {([...schools] as SchoolWithStats[])
                              .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
                              .slice(0, 6)
                              .map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => fetchSchoolDetail(s.id)}
                                  className="group rounded-xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:border-sky-300 hover:shadow-md hover:shadow-sky-100/50 dark:border-slate-700 dark:bg-slate-800/30 dark:hover:border-sky-600 dark:hover:shadow-sky-950/30"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-semibold text-slate-800 dark:text-white group-hover:text-sky-700 dark:group-hover:text-sky-300">{s.name}</span>
                                    {s.avg_rating != null && (
                                      <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                                        <StarIcon className="size-3" filled aria-hidden />
                                        {s.avg_rating.toFixed(1)}
                                      </span>
                                    )}
                                  </div>
                                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    {s.city && <span>{s.city}</span>}
                                    {s.district && <span>· {s.district}</span>}
                                    {s.review_count != null && s.review_count > 0 && (
                                      <span>{s.review_count} değerlendirme</span>
                                    )}
                                  </div>
                                </button>
                              ))}
                          </div>
                        </div>
                      ) : (
                        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-8 text-center text-sm text-slate-500 dark:border-slate-600 dark:bg-slate-800/20 dark:text-slate-400">
                          Bu bölgede arama kriterlerinize uygun okul bulunamadı. Filtreleri gevşetmeyi deneyin.
                        </p>
                      )}
                    </div>
                  ) : (
                    /* Filtre yok – hızlı il seçimi ve keşif */
                    <div className="space-y-6">
                      <div className="rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-sky-50/30 px-6 py-8 dark:border-slate-700 dark:from-slate-900/50 dark:to-sky-950/20">
                        <h2 className="text-center text-xl font-bold text-slate-800 dark:text-white">
                          İl veya ilçe seçerek keşfe başlayın
                        </h2>
                        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
                          Aşağıdaki illere tıklayın veya yukarıdaki aramada okul adı yazın.
                        </p>
                        <div className="mt-6 flex flex-wrap justify-center gap-2">
                          {['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Bursa', 'Adana', 'Konya', 'Gaziantep', 'Kocaeli', 'Mersin'].map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setSearch('');
                                setCity(c);
                                setDistrict('');
                                setDebouncedSearch('');
                                setDebouncedCity(c);
                                setDebouncedDistrict('');
                                setPage(1);
                                saveRecentSearch({ search: '', city: c, district: '' });
                                setRecentSearches(loadRecentSearches());
                                router.replace(`${PAGE_PATH}?city=${encodeURIComponent(c)}`, { scroll: false });
                              }}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:bg-sky-950/50"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                        <p className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
                          Veya yukarıdaki il / ilçe seçicisinden istediğiniz bölgeyi seçin.
                        </p>
                      </div>

                      {total > 0 && !debouncedCity && !debouncedDistrict && (
                        <div className="rounded-xl border border-slate-200/80 bg-slate-50/30 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/20">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Şu an <span className="font-semibold text-sky-600 dark:text-sky-400">{total}</span> okul listeleniyor.
                            Soldaki listeden seçin veya il seçerek daraltın.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
      )}
      </div>

      <Dialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)}>
        <DialogContent title="Uygunsuz İçerik Bildir">
          <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
            Bu içeriğin neden uygunsuz olduğunu seçin. Bildiriminiz incelenecektir.
          </p>
          <div className="space-y-4">
            <div>
              <label htmlFor="report-reason" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Sebep
              </label>
              <select
                id="report-reason"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="spam">Spam veya tekrarlayan içerik</option>
                <option value="uygunsuz">Uygunsuz, hakaret veya nefret söylemi</option>
                <option value="yanlis_bilgi">Yanıltıcı veya yanlış bilgi</option>
                <option value="diger">Diğer</option>
              </select>
            </div>
            <div>
              <label htmlFor="report-comment" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Açıklama (isteğe bağlı)
              </label>
              <textarea
                id="report-comment"
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Ek bilgi ekleyebilirsiniz..."
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium dark:border-slate-700"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleReport}
                disabled={reportSubmitting}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {reportSubmitting ? 'Gönderiliyor…' : 'Gönder'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function OkulDegerlendirmeleriPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
          <LoadingSpinner className="size-10 text-primary" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Yükleniyor...</p>
        </div>
      }
    >
      <OkulDegerlendirmeleriContent />
    </Suspense>
  );
}
