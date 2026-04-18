'use client';

import { useCallback, useEffect, useMemo, useState, useRef, Suspense, startTransition } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth, type Me } from '@/hooks/use-auth';
import { getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  MapPinIcon,
  TrendingUpIcon,
  HelpIcon,
  PencilIcon,
  TrashIcon,
  ThumbsUpIcon,
  ThumbsDownIcon,
  FlagIcon,
  HeartIcon,
  InfoIcon,
} from '@/components/icons';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import { inclusiveScoreRange, scoreRatio01 } from '@/lib/school-review-score';
import { emptySchoolReviewForm, schoolReviewFormFromReview } from '@/lib/school-review-prefill';
import { RatingBadge } from '@/components/rating-badge';
import { SchoolPlacementScoresCard, hasPlacementInfographic } from '@/components/school-reviews/school-placement-scores-card';
import { CriteriaRatingsDisplay } from '@/components/school-reviews/criteria-ratings-display';
import { SchoolReviewScorePicker } from '@/components/school-reviews/school-review-score-picker';
import { formatTrDateTimeMedium } from '@/lib/format-tr-datetime';
import { cn } from '@/lib/utils';
import { AppShellLoadingCard } from '@/components/ui/app-shell-loading-card';

const FALLBACK_REPORT_REASON_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'spam', label: 'Spam veya tekrar', hint: 'Çoklanan veya istenmeyen içerik' },
  { value: 'uygunsuz', label: 'Uygunsuz dil', hint: 'Hakaret, nefret söylemi veya taciz' },
  { value: 'yanlis_bilgi', label: 'Yanıltıcı bilgi', hint: 'Kasıtlı veya zararlı yanlışlık' },
  { value: 'diger', label: 'Diğer', hint: 'Kısaca açıklayın' },
];

type School = {
  id: string;
  name: string;
  type: string;
  segment: string;
  city: string | null;
  district: string | null;
  /** Okul tanıtım görseli (API snake veya camelCase) */
  school_image_url?: string | null;
  schoolImageUrl?: string | null;
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
  review_placement_dual_track?: boolean;
  review_placement_scores?: { year: number; with_exam: number | null; without_exam: number | null }[] | null;
  review_placement_charts?: unknown;
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
  like_count?: number;
  dislike_count?: number;
  user_has_liked?: boolean;
  user_has_disliked?: boolean;
};

type Question = {
  id: string;
  question: string;
  status?: 'pending' | 'approved' | 'hidden';
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
    status?: 'pending' | 'approved' | 'hidden';
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
  author_display_name: string;
};

type ActivityItem = {
  id: string;
  school_id: string;
  school_name: string;
  type: 'review' | 'question' | 'answer';
  created_at: string;
  author_display_name: string;
};

const PUBLIC_BASE = '/school-reviews-public';
const AUTH_BASE = '/school-reviews';
const PAGE_PATH = '/okul-degerlendirmeleri';
const RECENT_SEARCHES_KEY = 'okul-degerlendirmeleri-recent';
const ANONYMOUS_ID_KEY = 'ogretmenpro-anonymous-id';

/** Okul listesi API: okul yöneticisi kendi okulu; öğretmende modül kapalıysa herkese açık liste. */
function shouldUseAuthSchoolReviewsList(token: string | null, me: Me | null): boolean {
  if (!token || !me) return false;
  if (me.role === 'superadmin' || me.role === 'moderator') return true;
  if (me.role === 'school_admin') return true;
  if (me.role === 'teacher') {
    const mods = me.school?.enabled_modules;
    if (!mods || mods.length === 0) return true;
    return mods.includes('school_reviews');
  }
  return false;
}

/** GET okul/yorum/soru: liste ile aynı — modül kapalı öğretmen public uçları kullanır (403 önlenir). */
function schoolReviewsReadOpts(token: string | null, me: Me | null): { token: string } | { usePublic: true } {
  if (shouldUseAuthSchoolReviewsList(token, me) && token) return { token };
  return { usePublic: true };
}

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
  options: { token?: string | null; method?: string; body?: string; usePublic?: boolean; signal?: AbortSignal } = {}
): Promise<T> {
  const { token, method = 'GET', body, usePublic, signal } = options;
  const base = usePublic ? PUBLIC_BASE : token ? AUTH_BASE : PUBLIC_BASE;
  const url = getApiUrl(base + path);
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token && token !== COOKIE_SESSION_TOKEN) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      cache: 'no-store',
      credentials: 'include',
      ...(body && { body }),
      ...(signal && { signal }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
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

function schoolGoogleMapsSearchUrl(school: { name: string; city: string | null; district: string | null }): string {
  const parts = [school.name, school.district, school.city, 'Türkiye'].map((p) => (typeof p === 'string' ? p.trim() : '')).filter(Boolean);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`;
}

const ACTIVITY_LABELS = {
  review: 'için değerlendirme yaptı',
  question: 'hakkında soru sordu',
  answer: 'hakkında cevap verdi',
} as const;

const ACTIVITY_SHORT: Record<ActivityItem['type'], string> = {
  review: 'Değerlendirme',
  question: 'Soru',
  answer: 'Cevap',
};

/** Mobil: pastel kart; md+: klasik yoğun chip */
const ACTIVITY_COLORS = {
  review:
    'max-md:border max-md:border-amber-200/60 max-md:bg-linear-to-br max-md:from-amber-50 max-md:to-orange-50/90 max-md:shadow-md max-md:text-amber-950 dark:max-md:from-amber-950/35 dark:max-md:to-orange-950/25 dark:max-md:border-amber-800/45 dark:max-md:text-amber-100 md:border-0 md:bg-amber-100 md:text-amber-800 md:shadow-none dark:md:bg-amber-900/40 dark:md:text-amber-200',
  question:
    'max-md:border max-md:border-teal-200/60 max-md:bg-linear-to-br max-md:from-cyan-50 max-md:to-teal-50/90 max-md:shadow-md max-md:text-teal-950 dark:max-md:from-teal-950/35 dark:max-md:to-cyan-950/25 dark:max-md:border-teal-800/45 dark:max-md:text-teal-100 md:border-0 md:bg-teal-100 md:text-teal-800 md:shadow-none dark:md:bg-teal-900/40 dark:md:text-teal-200',
  answer:
    'max-md:border max-md:border-emerald-200/60 max-md:bg-linear-to-br max-md:from-emerald-50 max-md:to-sky-50/80 max-md:shadow-md max-md:text-emerald-950 dark:max-md:from-emerald-950/35 dark:max-md:to-sky-950/25 dark:max-md:border-emerald-800/45 dark:max-md:text-emerald-100 md:border-0 md:bg-emerald-100 md:text-emerald-800 md:shadow-none dark:md:bg-emerald-900/40 dark:md:text-emerald-200',
} as const;

function RecentActivitiesSection({
  activities,
  onOpenSchool,
}: {
  activities: ActivityItem[];
  onOpenSchool: (schoolId: string) => void;
}) {
  /** Mobilde scrollLeft güvenilir olmadığı için CSS marquee; dokununca kısa duraklat */
  const [marqueePaused, setMarqueePaused] = useState(false);
  const marqueePauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (marqueePauseTimerRef.current) clearTimeout(marqueePauseTimerRef.current);
    };
  }, []);

  const handleMarqueeTouchStart = () => {
    setMarqueePaused(true);
    if (marqueePauseTimerRef.current) {
      clearTimeout(marqueePauseTimerRef.current);
      marqueePauseTimerRef.current = null;
    }
  };

  const handleMarqueeTouchEnd = () => {
    if (marqueePauseTimerRef.current) clearTimeout(marqueePauseTimerRef.current);
    marqueePauseTimerRef.current = setTimeout(() => {
      setMarqueePaused(false);
      marqueePauseTimerRef.current = null;
    }, 1000);
  };

  if (activities.length === 0) return null;

  const renderActivityButton = (act: ActivityItem, keyPrefix: string) => (
    <button
      key={`${keyPrefix}${act.id}`}
      type="button"
      onClick={() => onOpenSchool(act.school_id)}
      className={cn(
        'group shrink-0 text-left shadow-sm transition-all duration-200',
        'flex w-[min(15.5rem,calc(100vw-1.25rem))] flex-col gap-0.5 rounded-lg px-2 py-1.5',
        'cursor-pointer hover:scale-[1.02] hover:shadow-md active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-900',
        'md:w-[min(22rem,100%)] md:max-w-md md:gap-1 md:rounded-2xl md:px-3.5 md:py-2',
        'max-md:backdrop-blur-[2px]',
        ACTIVITY_COLORS[act.type],
      )}
      title={`${act.school_name} — detay ve yorumlar`}
    >
      <span className="max-md:text-[10px] break-words text-xs font-semibold leading-snug tracking-tight text-foreground/95 underline decoration-transparent underline-offset-2 transition-colors group-hover:decoration-current md:text-sm">
        {act.author_display_name}
      </span>
      <span className="max-md:text-[10px] break-words text-[11px] leading-snug md:text-sm">
        <span className="font-bold underline decoration-transparent underline-offset-2 transition-colors group-hover:decoration-current">
          {act.school_name}
        </span>{' '}
        <span className="font-medium opacity-90">{ACTIVITY_LABELS[act.type]}</span>
      </span>
      <span className="text-[9px] font-medium opacity-75 max-md:leading-tight md:text-[11px]">
        {ACTIVITY_SHORT[act.type]} · {formatRelativeTime(act.created_at)}
      </span>
    </button>
  );

  return (
    <div className="border-y border-slate-100 py-1.5 dark:border-slate-800 max-md:border-violet-100/80 max-md:bg-linear-to-b max-md:from-sky-50/70 max-md:via-violet-50/40 max-md:to-teal-50/50 dark:max-md:border-violet-900/40 dark:max-md:from-sky-950/50 dark:max-md:via-violet-950/35 dark:max-md:to-teal-950/40 md:bg-slate-50/50 md:py-2 dark:md:bg-slate-900/30">
      <div className="mx-auto max-w-7xl px-2 sm:px-3 md:px-6">
        <p className="mb-1 text-center text-[9px] font-semibold uppercase tracking-wider text-violet-600/90 dark:text-violet-300/90 md:mb-1.5 md:text-[11px] md:text-slate-500 dark:md:text-slate-400">
          Son aktiviteler
        </p>

        {/* Mobil: içerik iki kez + translate -50% (WebKit scrollLeft sorunu yok) */}
        <div
          className="md:hidden overflow-hidden"
          role="region"
          aria-label="Son aktiviteler listesi"
          onTouchStart={handleMarqueeTouchStart}
          onTouchEnd={handleMarqueeTouchEnd}
        >
          {activities.length >= 2 ? (
            <div
              className={cn(
                'flex w-max gap-1.5',
                'animate-recent-activities-marquee',
                marqueePaused && 'pause-recent-activities-marquee',
              )}
            >
              {activities.map((act) => renderActivityButton(act, 'm1-'))}
              {activities.map((act) => renderActivityButton(act, 'm2-'))}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-1.5">{activities.map((act) => renderActivityButton(act, 's-'))}</div>
          )}
        </div>

        {/* Masaüstü: sarma, marquee yok */}
        <div
          className="hidden md:flex md:flex-wrap md:justify-center md:gap-2 md:overflow-visible"
          role="region"
          aria-label="Son aktiviteler listesi"
        >
          {activities.map((act) => renderActivityButton(act, 'd-'))}
        </div>
      </div>
    </div>
  );
}

function OkulDegerlendirmeleriContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { token, me } = useAuth();
  const detailSectionRef = useRef<HTMLDivElement>(null);
  const ownReviewCardRef = useRef<HTMLDivElement>(null);
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
  const [schoolHeaderImageFailed, setSchoolHeaderImageFailed] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailListsLoading, setDetailListsLoading] = useState(false);
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
  const [infoOpen, setInfoOpen] = useState<Record<string, boolean>>({});
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const toggleInfo = useCallback((key: string) => {
    setInfoOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const recentActivitiesList = useMemo((): ActivityItem[] => {
    return [
      ...recentReviews.map((r) => ({
        id: `r-${r.id}`,
        school_id: r.school_id,
        school_name: r.school_name,
        type: 'review' as const,
        created_at: r.created_at,
        author_display_name: r.author_display_name || 'Öğretmen',
      })),
      ...recentQuestions.map((q) => ({
        id: `q-${q.id}`,
        school_id: q.school_id,
        school_name: q.school_name,
        type: 'question' as const,
        created_at: q.created_at,
        author_display_name: q.author_display_name || 'Öğretmen',
      })),
      ...recentAnswers.map((a) => ({
        id: `a-${a.id}`,
        school_id: a.school_id,
        school_name: a.school_name,
        type: 'answer' as const,
        created_at: a.created_at,
        author_display_name: a.author_display_name || 'Öğretmen',
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [recentReviews, recentQuestions, recentAnswers]);

  const prevReviewSortRef = useRef(reviewSort);
  const prevQuestionSortRef = useRef(questionSort);
  const selectedSchoolRef = useRef(selectedSchool);
  selectedSchoolRef.current = selectedSchool;

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    const q = searchParams;
    if (!q) return;
    const s = q.get('search') ?? '';
    const c = q.get('city') ?? '';
    const d = q.get('district') ?? '';
    if (c || d) setMobileFiltersOpen(true);
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
    setSchoolHeaderImageFailed(false);
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
        const sid = me?.role === 'school_admin' ? me.school_id : null;
        if (sid) {
          setTopSchools(top.filter((s) => s.id === sid));
          setHomeStats(null);
          setRecentReviews(revs.filter((r) => r.school_id === sid));
          setRecentQuestions(qs.filter((q) => q.school_id === sid));
          setRecentAnswers(ans.filter((a) => a.school_id === sid));
        } else {
          setTopSchools(top);
          setHomeStats(stats);
          setRecentReviews(revs);
          setRecentQuestions(qs);
          setRecentAnswers(ans);
        }
      }).catch(() => {});
    }
  }, [token, moduleDisabled, me?.role, me?.school_id]);

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

  const schoolsFetchAbortRef = useRef<AbortController | null>(null);

  const fetchSchools = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    schoolsFetchAbortRef.current?.abort();
    const ac = new AbortController();
    schoolsFetchAbortRef.current = ac;
    if (!silent) {
      setLoading(true);
      setError(null);
      setModuleDisabled(false);
    }
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        ...(debouncedSearch && { search: debouncedSearch }),
        ...(debouncedCity && { city: debouncedCity }),
        ...(debouncedDistrict && { district: debouncedDistrict }),
      });
      const data = await fetchApi<ListResponse>(`/schools?${params}`, {
        token,
        usePublic: !shouldUseAuthSchoolReviewsList(token, me),
        signal: ac.signal,
      });
      startTransition(() => {
        setSchools((data.items || []) as SchoolWithStats[]);
        setTotal(data.total);
      });
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return;
      const ex = e as Error & { code?: string };
      if (!silent) {
        setModuleDisabled(ex.code === 'MODULE_DISABLED');
        setError(ex.message || 'Okullar yüklenemedi');
        setSchools([]);
        setTotal(0);
      }
    } finally {
      if (!ac.signal.aborted && !silent) setLoading(false);
    }
  }, [token, me, page, debouncedSearch, debouncedCity, debouncedDistrict]);

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
      setDetailListsLoading(true);
      setReviews({ items: [], total: 0 });
      setQuestions({ items: [], total: 0 });
      try {
        const data = await fetchApi<SchoolDetail>(`/schools/${id}`, schoolReviewsReadOpts(token, me));
        setSelectedSchool(data);
        setDetailLoading(false);
        const anonId = !token ? getAnonymousId() : '';
        const revParams = new URLSearchParams({ sort: reviewSort });
        if (anonId) revParams.set('anonymous_id', anonId);
        const qParams = new URLSearchParams({ sort: questionSort });
        if (anonId) qParams.set('anonymous_id', anonId);
        let reviewsData: { items: Review[]; total: number } = { items: [], total: 0 };
        try {
          const readOpts = schoolReviewsReadOpts(token, me);
          const [revData, questionsData] = await Promise.all([
            fetchApi<{ items: Review[]; total: number }>(
              `/schools/${id}/reviews?${revParams}`,
              readOpts
            ),
            fetchApi<{ items: Question[]; total: number }>(
              `/schools/${id}/questions?${qParams}`,
              readOpts
            ),
          ]);
          reviewsData = revData;
          setReviews(revData);
          setQuestions(questionsData);
          prevReviewSortRef.current = reviewSort;
          prevQuestionSortRef.current = questionSort;
        } catch {
          setReviews({ items: [], total: 0 });
          setQuestions({ items: [], total: 0 });
        } finally {
          setDetailListsLoading(false);
        }
        setReviewForm(emptySchoolReviewForm());
        setQuestionForm('');
        setActiveTab('reviews');
      } catch {
        setSelectedSchool(null);
        setReviews({ items: [], total: 0 });
        setQuestions({ items: [], total: 0 });
        setDetailLoading(false);
        setDetailListsLoading(false);
      }
    },
    [token, me, reviewSort, questionSort]
  );

  const refreshAfterMutation = useCallback(
    async (schoolId: string) => {
      await fetchSchoolDetail(schoolId);
      await fetchSchools({ silent: true });
      router.refresh();
    },
    [fetchSchoolDetail, fetchSchools, router]
  );

  const fetchReviewsOnly = useCallback(
    async (id: string) => {
      const anonId = !token ? getAnonymousId() : '';
      const revParams = new URLSearchParams({ sort: reviewSort });
      if (anonId) revParams.set('anonymous_id', anonId);
      const reviewsData = await fetchApi<{ items: Review[]; total: number }>(
        `/schools/${id}/reviews?${revParams}`,
        schoolReviewsReadOpts(token, me)
      );
      startTransition(() => setReviews(reviewsData));
    },
    [token, me, reviewSort]
  );

  const fetchQuestionsOnly = useCallback(
    async (id: string) => {
      const anonId = !token ? getAnonymousId() : '';
      const qParams = new URLSearchParams({ sort: questionSort });
      if (anonId) qParams.set('anonymous_id', anonId);
      const questionsData = await fetchApi<{ items: Question[]; total: number }>(
        `/schools/${id}/questions?${qParams}`,
        schoolReviewsReadOpts(token, me)
      );
      startTransition(() => setQuestions(questionsData));
    },
    [token, me, questionSort]
  );

  useEffect(() => {
    const id = selectedSchoolRef.current?.id;
    if (!id) return;
    if (prevReviewSortRef.current === reviewSort) return;
    prevReviewSortRef.current = reviewSort;
    fetchReviewsOnly(id).catch(() => {});
  }, [reviewSort, fetchReviewsOnly]);

  useEffect(() => {
    const id = selectedSchoolRef.current?.id;
    if (!id) return;
    if (prevQuestionSortRef.current === questionSort) return;
    prevQuestionSortRef.current = questionSort;
    fetchQuestionsOnly(id).catch(() => {});
  }, [questionSort, fetchQuestionsOnly]);

  const schoolIdFromUrl = searchParams?.get('id') || searchParams?.get('school');
  useEffect(() => {
    if (schoolIdFromUrl && selectedSchool?.id !== schoolIdFromUrl) {
      fetchSchoolDetail(schoolIdFromUrl);
    }
  }, [schoolIdFromUrl, selectedSchool?.id, fetchSchoolDetail]);

  const handleSubmitReview = async () => {
    if (!token || !selectedSchool) {
      toast.error('Değerlendirme yapmak için giriş yapmalısınız.');
      return;
    }
    const criteria = selectedSchool.criteria || [];
    const hasCriteria = criteria.length > 0;
    if (hasCriteria) {
      const missing = criteria.filter((c) => {
        const v = reviewForm.criteria_ratings[c.slug];
        return v == null || v < c.min_score || v > c.max_score;
      });
      if (missing.length > 0) {
        toast.error('Lütfen tüm kriterlere geçerli puan verin (her kriter için aralık içinde).');
        return;
      }
    } else if (!reviewForm.rating || reviewForm.rating < 1 || reviewForm.rating > 10) {
      toast.error('Lütfen genel puanı 1–10 arasında seçin.');
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
      const own = reviews.items.find((r) => r.is_own);
      if (own) {
        const res = await fetchApi<Review>(`/reviews/${own.id}`, {
          token,
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success(res.status === 'pending' ? 'Değerlendirme güncellendi, onay bekliyor' : 'Değerlendirme güncellendi');
      } else {
        const res = await fetchApi<Review>(`/schools/${selectedSchool.id}/reviews`, {
          token,
          method: 'POST',
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
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
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
      const missing = criteria.filter((c) => {
        const v = form.criteria_ratings[c.slug];
        return v == null || v < c.min_score || v > c.max_score;
      });
      if (missing.length > 0) {
        toast.error('Lütfen tüm kriterlere geçerli puan verin.');
        return;
      }
    } else if (!form.rating || form.rating < 1 || form.rating > 10) {
      toast.error('Lütfen genel puanı 1–10 arasında seçin.');
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
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setSubmitting(false);
    }
  };

  const startEditingReview = (r: Review) => {
    const criteria = selectedSchool?.criteria || [];
    setEditReviewForm(schoolReviewFormFromReview(r, criteria));
    setEditingReviewId(r.id);
    if (r.is_own) {
      requestAnimationFrame(() => {
        ownReviewCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
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
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
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
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
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
  const [reportReasonOptions, setReportReasonOptions] = useState(FALLBACK_REPORT_REASON_OPTIONS);
  const [reportProfanityFilterActive, setReportProfanityFilterActive] = useState(false);

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
      await fetchApi(`/questions/${questionId}`, { token, method: 'DELETE' });
      toast.success('Soru silindi');
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  const [favoriting, setFavoriting] = useState(false);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchApi<{
      reasons: { value: string; label: string; hint: string }[];
      profanity_block_active?: boolean;
    }>('/report-rules', {
      usePublic: true,
    })
      .then((d) => {
        if (cancelled) return;
        if (Array.isArray(d.reasons) && d.reasons.length > 0) setReportReasonOptions(d.reasons);
        if (typeof d.profanity_block_active === 'boolean') setReportProfanityFilterActive(d.profanity_block_active);
      })
      .catch(() => {
        /* varsayılan metinler */
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      if (selectedSchool) await refreshAfterMutation(selectedSchool.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setDeletingId(null);
    }
  };

  const isLoggedIn = !!me && !!token;
  const ownReview = isLoggedIn ? reviews.items.find((r) => r.is_own) : undefined;
  /** Yorumlar API gelmeden ownReview bilinmez; aksi halde yanlışlıkla «yeni değerlendirme» formu açılıyordu. */
  const reviewListReady = !detailListsLoading;
  const isEditingOwnReview = !!(ownReview && editingReviewId === ownReview.id && editReviewForm);
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
    <div className="min-h-screen w-full min-w-0 overflow-x-clip">
      {/* Hero – modern anasayfa üst alan */}
      <div className="relative overflow-x-clip bg-gradient-to-br from-sky-600 via-teal-600 to-emerald-700 dark:from-sky-800 dark:via-teal-800 dark:to-emerald-900">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative mx-auto w-full min-w-0 max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:py-8">
          <div className="text-center">
            <div className="flex items-start justify-center gap-1.5 sm:gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-2xl lg:text-3xl drop-shadow-sm">
                Okul Değerlendirmeleri
              </h1>
              {token && (me?.role === 'teacher' || me?.role === 'moderator') && (
                <Link
                  href="/favoriler"
                  className="mt-0.5 shrink-0 rounded-full p-1.5 text-white/90 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                  title="Favorilerim"
                  aria-label="Favorilerim"
                >
                  <HeartIcon className="text-white" filled size={22} />
                </Link>
              )}
              <button
                type="button"
                onClick={() => toggleInfo('hero')}
                className="mt-0.5 shrink-0 rounded-full p-1.5 text-white/90 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/80"
                aria-expanded={!!infoOpen.hero}
                aria-label="Sayfa hakkında bilgi"
              >
                <InfoIcon className="size-5 sm:size-6" size={22} />
              </button>
            </div>
            {infoOpen.hero && (
              <p className="mx-auto mt-2 max-w-2xl text-sm text-sky-100/90 sm:mt-2 sm:text-base">
                Türkiye&apos;deki okulları keşfedin. Kullanıcı deneyimlerini okuyun, kendi değerlendirmenizi paylaşın.
              </p>
            )}
          </div>

          {/* İstatistikler */}
          {homeStats && (
            <div className="mx-auto mt-3 grid max-w-3xl grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2.5">
              <div className="rounded-md bg-white/10 px-1.5 py-1.5 text-center backdrop-blur sm:rounded-lg sm:px-3 sm:py-2">
                <SchoolIcon className="mx-auto size-4 text-sky-200 sm:size-5" />
                <p className="mt-0.5 text-sm font-bold tabular-nums text-white sm:mt-0.5 sm:text-xl">{homeStats.school_count.toLocaleString('tr-TR')}</p>
                <p className="text-[9px] text-sky-100/80 sm:text-[11px]">Okul</p>
              </div>
              <div className="rounded-md bg-white/10 px-1.5 py-1.5 text-center backdrop-blur sm:rounded-lg sm:px-3 sm:py-2">
                <StarIcon className="mx-auto size-4 text-amber-300 sm:size-5" filled />
                <p className="mt-0.5 text-sm font-bold tabular-nums text-white sm:mt-0.5 sm:text-xl">{homeStats.review_count.toLocaleString('tr-TR')}</p>
                <p className="text-[9px] text-sky-100/80 sm:text-[11px]">Değerlendirme</p>
              </div>
              <div className="rounded-md bg-white/10 px-1.5 py-1.5 text-center backdrop-blur sm:rounded-lg sm:px-3 sm:py-2">
                <MessageIcon className="mx-auto size-4 text-emerald-200 sm:size-5" />
                <p className="mt-0.5 text-sm font-bold tabular-nums text-white sm:mt-0.5 sm:text-xl">{homeStats.question_count.toLocaleString('tr-TR')}</p>
                <p className="text-[9px] text-sky-100/80 sm:text-[11px]">Soru</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Son aktiviteler: gösterim adı + okul; kart tıklanınca okul detayı; mobilde marquee */}
      <RecentActivitiesSection
        activities={recentActivitiesList}
        onOpenSchool={(id) => {
          void fetchSchoolDetail(id);
        }}
      />

      <div className="mx-auto w-full min-w-0 max-w-7xl px-2 py-2 sm:px-4 sm:py-3 lg:px-6 lg:py-4">
      {/* Arama – hero dışında, renk hiyerarşisi */}
      <Card className="mb-2 border-slate-200/80 bg-white/80 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/50 sm:mb-3 max-md:border-violet-200/50 max-md:bg-linear-to-b max-md:from-white max-md:via-sky-50/45 max-md:to-violet-50/35 max-md:shadow-md max-md:shadow-violet-200/25 dark:max-md:border-violet-900/40 dark:max-md:from-slate-950 dark:max-md:via-sky-950/35 dark:max-md:to-violet-950/30 dark:max-md:shadow-violet-950/25">
          <CardContent className="p-2 sm:p-3 sm:py-2.5">
            <div className="mb-1.5 flex items-center gap-2 sm:mb-2">
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 sm:text-xs">Arama ve filtre</span>
              <button
                type="button"
                onClick={() => toggleInfo('search')}
                className="rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-expanded={!!infoOpen.search}
                aria-label="Arama hakkında bilgi"
              >
                <InfoIcon className="size-4" size={16} />
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((v) => !v)}
                className="ml-auto inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700 md:hidden dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                aria-expanded={mobileFiltersOpen}
                aria-controls="school-reviews-filter-fields"
              >
                {mobileFiltersOpen ? 'Gizle' : 'Filtre'}
                <ChevronRightIcon
                  size={14}
                  className={cn('transition-transform', mobileFiltersOpen ? 'rotate-90' : '')}
                  aria-hidden
                />
              </button>
            </div>
            {infoOpen.search && (
              <p className="mb-1.5 text-[10px] text-slate-500 dark:text-slate-400 sm:mb-2 sm:text-xs" role="status">
                Okul adı yazın veya il / ilçe seçerek filtreleyin
              </p>
            )}
            {recentSearches.length > 0 && (
              <div
                className={cn(
                  'mb-2 flex flex-wrap gap-1.5 sm:mb-2 sm:gap-2',
                  !mobileFiltersOpen && 'max-md:hidden',
                )}
              >
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
            <div className="flex flex-col gap-1.5 sm:gap-2 md:flex-row md:items-end md:gap-3">
              <div className="relative min-w-0 md:min-w-0 md:flex-1">
                <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400 md:left-3" aria-hidden />
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
                  className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-[13px] focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white md:py-2 md:pl-10 md:pr-3 md:text-sm"
                  aria-label="Okul adı arama"
                  autoComplete="off"
                />
              </div>
              <div
                id="school-reviews-filter-fields"
                role="group"
                aria-label="İl, ilçe ve arama düğmeleri"
                className={cn(
                  'flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-end md:gap-2',
                  !mobileFiltersOpen && 'max-md:hidden',
                )}
              >
                <div className="flex min-w-0 flex-1 gap-1.5 md:min-h-0">
                  <select
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setDistrict('');
                    }}
                    className="min-h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white md:min-h-9 md:px-2.5 md:py-1.5 md:text-sm"
                    aria-label="İl seçin"
                  >
                    <option value="">Tüm iller</option>
                    {citiesList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="min-h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white md:min-h-9 md:px-2.5 md:py-1.5 md:text-sm"
                    aria-label="İlçe seçin"
                  >
                    <option value="">Tüm ilçeler</option>
                    {districtsList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-1.5 md:w-auto md:shrink-0">
                  <button
                    type="button"
                    onClick={applySearch}
                    className="min-h-9 flex-1 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-sky-500 md:min-h-9 md:flex-none md:px-4 md:py-1.5 md:text-sm"
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
                    className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 md:min-h-9 md:px-3 md:py-1.5 md:text-sm"
                    aria-label="Sıfırla"
                  >
                    Sıfırla
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      {/* Arama sonucu bilgisi – ton farkı */}
      {!moduleDisabled && !loading && (
        <div
          className="mb-2 rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-1.5 dark:border-slate-700/50 dark:bg-slate-800/30 sm:mb-3 sm:px-3 sm:py-2"
          aria-live="polite"
        >
          <p className="text-[11px] font-medium leading-snug text-slate-700 dark:text-slate-300 sm:text-xs">
            Arama sonucu: <span className="text-sky-600 dark:text-sky-400">{total.toLocaleString('tr-TR')}</span> okul bulundu.
            {schools.length > 0 && (
              <span className="mt-0.5 block text-slate-500 dark:text-slate-400 sm:ml-2 sm:mt-0 sm:inline">
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
      <div className="grid min-w-0 max-w-full gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-6">
        {/* Sol: Modern keşif paneli */}
        <aside className="flex min-w-0 flex-col overflow-x-clip lg:sticky lg:top-6 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <div className="space-y-2 rounded-xl border border-slate-200/80 bg-white shadow-md shadow-slate-200/40 dark:border-slate-700/60 dark:bg-slate-900/60 dark:shadow-slate-950/50 backdrop-blur-sm sm:space-y-5 lg:rounded-2xl lg:shadow-lg">
            {/* Hızlı istatistikler (masaüstü; mobilde hero ile çakışmasın) */}
            {homeStats && (
              <div className="hidden grid-cols-3 gap-2 px-4 pt-5 lg:grid">
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
            <section className="px-2 pt-2 sm:px-4 sm:pt-5 lg:pt-0">
              <div className="mb-2 flex items-center justify-between gap-2 max-lg:border-b max-lg:border-slate-100 max-lg:pb-2 dark:max-lg:border-slate-800 lg:mb-2 lg:border-b-0 lg:pb-0">
                <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
                  <h3 className="flex items-center gap-1.5 text-[13px] font-bold tracking-tight text-slate-800 dark:text-white sm:gap-2 sm:text-sm">
                    <SchoolIcon className="size-4 shrink-0 text-sky-500 sm:size-4" />
                    Okul listesi
                  </h3>
                  <button
                    type="button"
                    onClick={() => toggleInfo('schoolList')}
                    className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                    aria-expanded={!!infoOpen.schoolList}
                    aria-label="Okul listesi hakkında bilgi"
                  >
                    <InfoIcon className="size-3.5" size={14} />
                  </button>
                </div>
                {!loading && (
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-sky-700 dark:bg-sky-400/20 dark:text-sky-300 sm:px-2.5 sm:text-xs">
                    {total.toLocaleString('tr-TR')} sonuç
                  </span>
                )}
              </div>
              <p
                className="mb-2 text-[10px] leading-snug text-slate-500 dark:text-slate-400 sm:mb-2.5 sm:text-[11px]"
                role="note"
              >
                Okul adı ve yerleşim bilgileri, internette herkese açık kaynaklardan ve kullanıcı katkılarından
                derlenmiştir; ticari veri tabanı veya telif korumalı okul envanteri niteliğinde değildir. Liste
                yalnızca bilgilendirme amaçlıdır.
              </p>
              {infoOpen.schoolList && (
                <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400 sm:mb-3 sm:text-xs">Arama veya filtre ile bulun, listeden seçin.</p>
              )}
            </section>
            <div className="border-t border-slate-100 dark:border-slate-800">
              {loading ? (
                <div className="space-y-2 p-2 sm:p-4 lg:p-3" role="status" aria-label="Okul listesi yükleniyor">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="flex gap-3 rounded-md border-b border-slate-100 pb-3 last:border-b-0 dark:border-slate-800">
                      <Skeleton className="h-5 min-h-[1.25rem] flex-1 max-w-[70%]" />
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
                  className={cn(
                    'max-h-none overflow-visible overscroll-y-contain outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    'max-lg:flex max-lg:flex-col max-lg:gap-2.5 max-lg:bg-linear-to-b max-lg:from-violet-50/50 max-lg:via-sky-50/30 max-lg:to-teal-50/20 max-lg:p-2.5 max-lg:ring-1 max-lg:ring-violet-200/30 dark:max-lg:from-violet-950/30 dark:max-lg:via-sky-950/20 dark:max-lg:to-teal-950/15 dark:max-lg:ring-violet-800/30',
                    'lg:max-h-[min(320px,calc(100vh-10rem))] lg:overflow-y-auto lg:bg-transparent lg:p-0',
                  )}
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
                        className={cn(
                          'cursor-pointer transition-colors duration-150',
                          'max-lg:rounded-2xl max-lg:border max-lg:border-sky-200/50 max-lg:bg-linear-to-br max-lg:from-white max-lg:via-sky-50/40 max-lg:to-violet-50/50 max-lg:px-3.5 max-lg:py-3.5 max-lg:shadow-md max-lg:shadow-sky-200/25 max-lg:active:scale-[0.99] max-lg:active:from-sky-50 dark:max-lg:border-sky-800/40 dark:max-lg:from-slate-900 dark:max-lg:via-sky-950/40 dark:max-lg:to-violet-950/35 dark:max-lg:shadow-sky-950/20',
                          'lg:border-b lg:border-slate-100 lg:px-4 lg:py-3 lg:shadow-none dark:lg:border-slate-800 lg:last:border-b-0',
                          isSelected
                            ? cn(
                                'max-lg:border-cyan-300/70 max-lg:bg-linear-to-br max-lg:from-sky-100 max-lg:to-cyan-50 max-lg:ring-2 max-lg:ring-sky-300/40 dark:max-lg:border-cyan-600/50 dark:max-lg:from-sky-900/50 dark:max-lg:to-cyan-950/40 dark:max-lg:ring-sky-500/30',
                                'lg:border-l-4 lg:border-l-sky-500 lg:bg-linear-to-r lg:from-sky-50 lg:to-teal-50/50 dark:lg:border-l-sky-400 dark:lg:from-sky-950/40 dark:lg:to-teal-950/20',
                              )
                            : cn(
                                'max-lg:hover:border-sky-300/80 max-lg:hover:shadow-lg max-lg:hover:shadow-sky-200/20 dark:max-lg:hover:border-sky-600/50',
                                'lg:border-l-4 lg:border-l-transparent lg:hover:bg-slate-50 dark:lg:hover:bg-slate-800/50',
                              ),
                          !isSelected &&
                            isFocused &&
                            cn('max-lg:bg-sky-50/80 dark:max-lg:bg-sky-950/40', 'lg:bg-slate-50 dark:lg:bg-slate-800/70'),
                        )}
                        onClick={() => fetchSchoolDetail(s.id)}
                      >
                        <div className="flex items-start gap-2.5 lg:block">
                          <div className="min-w-0 flex-1">
                            <div className="wrap-break-word text-[15px] font-semibold leading-snug text-slate-900 dark:text-white lg:text-base">
                              {s.name}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 lg:mt-2 lg:text-xs">
                              {s.city && <span className="tabular-nums">{s.city}</span>}
                              {s.district && <span className="tabular-nums">· {s.district}</span>}
                              {sw.avg_rating != null && (
                                <span
                                  className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                                  title={`Ortalama: ${sw.avg_rating.toFixed(1)}`}
                                >
                                  <StarIcon className="size-3" filled aria-hidden />
                                  {sw.avg_rating.toFixed(1)}
                                </span>
                              )}
                              {sw.question_count != null && sw.question_count > 0 && (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                                  <MessageIcon className="size-3" aria-hidden />
                                  {sw.question_count} soru
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRightIcon
                            size={18}
                            className="mt-0.5 shrink-0 text-sky-300 dark:text-sky-600 lg:hidden"
                            aria-hidden
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {total > 20 && (
                <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/50 px-1 py-2 dark:border-slate-800 dark:bg-slate-900/30 max-lg:gap-2 max-lg:border-violet-100/80 max-lg:bg-linear-to-r max-lg:from-violet-50/60 max-lg:via-white max-lg:to-sky-50/50 max-lg:py-3 dark:max-lg:border-violet-900/40 dark:max-lg:from-violet-950/30 dark:max-lg:via-slate-900/40 dark:max-lg:to-sky-950/25 sm:px-0 sm:py-2.5">
                  <button
                    type="button"
                    onClick={() => setPage(1)}
                    disabled={page <= 1}
                    className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-medium disabled:opacity-50 hover:bg-white active:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 lg:min-h-0 lg:px-2 lg:py-1"
                  >
                    İlk
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-medium disabled:opacity-50 hover:bg-white active:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 lg:min-h-0 lg:px-2 lg:py-1"
                  >
                    Önceki
                  </button>
                  <span className="min-h-9 px-2 text-xs font-medium tabular-nums leading-9 text-slate-600 dark:text-slate-400 lg:min-h-0 lg:leading-none">
                    {page} / {Math.ceil(total / 20)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(Math.ceil(total / 20), p + 1))}
                    disabled={page >= Math.ceil(total / 20)}
                    className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-medium disabled:opacity-50 hover:bg-white active:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 lg:min-h-0 lg:px-2 lg:py-1"
                  >
                    Sonraki
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage(Math.ceil(total / 20))}
                    disabled={page >= Math.ceil(total / 20)}
                    className="min-h-9 rounded-lg border border-slate-200 px-2.5 text-xs font-medium disabled:opacity-50 hover:bg-white active:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 lg:min-h-0 lg:px-2 lg:py-1"
                  >
                    Son
                  </button>
                </div>
              )}
            </div>

            {/* En çok görüntülenen okullar */}
            {topSchools.length > 0 && (
              <section className="border-t border-slate-100 px-3 py-3 dark:border-slate-800 lg:px-4 lg:py-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white lg:mb-3 lg:text-sm">
                  <TrendingUpIcon className="size-3.5 text-amber-500 lg:size-4" />
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
                        className={`group cursor-pointer rounded-lg border p-2 transition-all duration-200 hover:border-sky-300 hover:shadow-md hover:shadow-sky-100/50 dark:hover:border-sky-700 dark:hover:shadow-sky-950/30 lg:rounded-xl lg:p-2.5 ${
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
              <section className="border-t border-slate-100 px-3 py-3 dark:border-slate-800 lg:px-4 lg:py-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white lg:mb-3 lg:text-sm">
                  <StarIcon className="size-3.5 text-amber-500 lg:size-4" filled />
                  Popüler yorumlar
                </h3>
                <ul className="space-y-2">
                  {recentReviews.slice(0, 4).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => fetchSchoolDetail(r.school_id)}
                        className="w-full rounded-lg border border-slate-200/80 bg-amber-50/30 p-2 text-left text-[11px] transition-all duration-200 hover:border-amber-300 hover:bg-amber-50/60 dark:border-slate-700 dark:bg-amber-950/20 dark:hover:border-amber-700 dark:hover:bg-amber-950/40 lg:rounded-xl lg:p-3 lg:text-xs"
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
              <section className="border-t border-slate-100 px-3 py-3 dark:border-slate-800 lg:px-4 lg:py-4">
                <h3 className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-white lg:mb-3 lg:text-sm">
                  <HelpIcon className="size-3.5 text-teal-500 lg:size-4" />
                  Son sorulan sorular
                </h3>
                <ul className="space-y-2">
                  {recentQuestions.slice(0, 4).map((q) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => fetchSchoolDetail(q.school_id)}
                        className="w-full rounded-lg border border-slate-200/80 bg-teal-50/30 p-2 text-left text-[11px] transition-all duration-200 hover:border-teal-300 hover:bg-teal-50/60 dark:border-slate-700 dark:bg-teal-950/20 dark:hover:border-teal-700 dark:hover:bg-teal-950/40 lg:rounded-xl lg:p-3 lg:text-xs"
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
            <section className="rounded-b-2xl border-t border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900/30 lg:px-4 lg:py-3">
              <h3 className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 lg:mb-2 lg:text-xs">
                <HelpIcon className="size-3.5" aria-hidden />
                Nasıl kullanılır?
              </h3>
              <ul className="space-y-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400 lg:space-y-1 lg:text-[11px]">
                <li>• Yukarıdan arayın; il/ilçe için &quot;Filtre&quot;yü açın</li>
                <li>• Listeden okul seçin veya ↑↓ ve Enter (masaüstü)</li>
                <li>• Giriş yaparak puan, yorum ve soru ekleyin</li>
              </ul>
            </section>
          </div>
        </aside>

        {/* Sağ: Okul detay */}
        <div ref={detailSectionRef} className="min-w-0 max-w-full space-y-4 overflow-x-clip lg:space-y-6">
          {selectedSchool ? (
            <div className="min-w-0 space-y-4 lg:space-y-6">
              <Card className="min-w-0 overflow-hidden rounded-2xl border-slate-200/70 shadow-sm ring-1 ring-slate-900/[0.04] dark:border-slate-700/60 dark:ring-white/[0.06]">
                <div className="min-w-0 bg-linear-to-br from-slate-50 via-white to-sky-50/40 px-3 py-3 dark:from-slate-900/60 dark:via-slate-900/40 dark:to-sky-950/25 sm:px-4 sm:py-3.5">
                  {(() => {
                    const headerImg =
                      selectedSchool.schoolImageUrl?.trim() ||
                      selectedSchool.school_image_url?.trim() ||
                      '';
                    const showImg = headerImg.length > 0 && !schoolHeaderImageFailed;
                    return (
                      <>
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-start justify-between gap-2">
                            <h2 className="min-w-0 flex-1 wrap-break-word text-[15px] font-bold leading-snug tracking-tight text-slate-900 dark:text-white sm:text-lg">
                              {selectedSchool.name}
                            </h2>
                            <div className="flex shrink-0 items-center gap-0.5">
                              {isLoggedIn && (
                                <button
                                  type="button"
                                  onClick={handleToggleFavorite}
                                  disabled={favoriting}
                                  className={cn(
                                    'rounded-lg p-1.5 transition-colors disabled:opacity-50',
                                    selectedSchool.is_favorited
                                      ? 'text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-400'
                                      : 'text-slate-500 hover:bg-white/80 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300',
                                  )}
                                  aria-label={selectedSchool.is_favorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                                  title={selectedSchool.is_favorited ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                                >
                                  <HeartIcon className="size-[1.15rem]" filled={!!selectedSchool.is_favorited} />
                                </button>
                              )}
                              <div className="relative" ref={shareMenuRef}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShareMenuOpen((v) => !v);
                                  }}
                                  className="rounded-lg p-1.5 text-slate-500 hover:bg-white/80 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                                  aria-label="Paylaş"
                                  aria-expanded={shareMenuOpen}
                                  aria-haspopup="true"
                                  title="Paylaş"
                                >
                                  <ShareIcon className="size-[1.15rem]" />
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
                                      <span className="font-semibold text-[#25D366]">WhatsApp</span>
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
                          {(selectedSchool.city || selectedSchool.district) && (
                            <a
                              href={schoolGoogleMapsSearchUrl(selectedSchool)}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Konumu Google Haritalar’da aç"
                              className={cn(
                                'mt-1.5 inline-flex max-w-full items-stretch gap-0 overflow-hidden rounded-xl border-2 border-sky-500/35 bg-white shadow-sm transition-colors',
                                'hover:border-sky-500 hover:bg-sky-50/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500',
                                'dark:border-sky-400/40 dark:bg-slate-900/60 dark:hover:border-sky-400 dark:hover:bg-sky-950/40',
                              )}
                              title="Konumu Google Haritalar’da aç"
                            >
                              <span className="flex w-10 shrink-0 items-center justify-center bg-sky-600 dark:bg-sky-500">
                                <MapPinIcon size={22} className="text-white" aria-hidden />
                              </span>
                              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 px-2.5 py-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-100 sm:text-xs">
                                {selectedSchool.city && <span>{selectedSchool.city}</span>}
                                {selectedSchool.city && selectedSchool.district && (
                                  <ChevronRightIcon className="size-3 shrink-0 text-slate-400 dark:text-slate-500" aria-hidden />
                                )}
                                {selectedSchool.district && <span>{selectedSchool.district}</span>}
                              </span>
                            </a>
                          )}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {selectedSchool.avg_rating != null && (
                              <span
                                className="inline-flex items-center gap-1 rounded-md bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200"
                                title={`Ortalama: ${selectedSchool.avg_rating.toFixed(1)} / 10`}
                              >
                                <StarIcon size={12} filled className="text-amber-500" aria-hidden />
                                {selectedSchool.avg_rating.toFixed(1)}
                                <span className="font-medium opacity-80">/10</span>
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-500/15 dark:text-sky-200">
                              <StarIcon size={12} filled className="text-sky-500 opacity-90" aria-hidden />
                              {selectedSchool.review_count} değerlendirme
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-teal-500/10 px-2 py-0.5 text-[11px] font-medium text-teal-800 dark:bg-teal-500/15 dark:text-teal-200">
                              <MessageIcon className="size-3" aria-hidden />
                              {selectedSchool.question_count} soru
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:bg-violet-500/15 dark:text-violet-200">
                              <EyeIcon className="size-3" aria-hidden />
                              {selectedSchool.review_view_count ?? 0} görüntülenme
                            </span>
                          </div>
                        </div>
                        {showImg ? (
                          <div className="mt-4 border-t border-slate-200/65 pt-4 dark:border-slate-700/55">
                            <figure
                              className={cn(
                                'relative mx-auto w-full overflow-hidden rounded-2xl border border-slate-200/90',
                                'bg-linear-to-b from-white to-slate-50/95 p-[3px] shadow-[0_6px_28px_-6px_rgba(15,23,42,0.14)] ring-1 ring-slate-900/5',
                                'dark:border-slate-600/90 dark:from-slate-900 dark:to-slate-950 dark:shadow-[0_8px_36px_-10px_rgba(0,0,0,0.55)] dark:ring-white/10',
                              )}
                            >
                              <div className="overflow-hidden rounded-[13px] bg-slate-100 dark:bg-slate-950/80">
                                <img
                                  src={headerImg}
                                  alt=""
                                  className="aspect-video w-full object-cover object-center sm:aspect-[2/1]"
                                  onError={() => setSchoolHeaderImageFailed(true)}
                                />
                              </div>
                            </figure>
                          </div>
                        ) : null}
                        {selectedSchool.review_placement_dual_track &&
                          hasPlacementInfographic(
                            selectedSchool.review_placement_charts,
                            selectedSchool.review_placement_scores,
                          ) && (
                            <div className="mt-3 min-w-0 sm:mt-4">
                              <SchoolPlacementScoresCard
                                schoolName={selectedSchool.name || 'Okul'}
                                charts={selectedSchool.review_placement_charts}
                                rows={selectedSchool.review_placement_scores}
                              />
                            </div>
                          )}
                      </>
                    );
                  })()}
                </div>
                {selectedSchool.criteria_averages && Object.keys(selectedSchool.criteria_averages).length > 0 && (
                  <CardContent className="min-w-0 space-y-3 pt-5">
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Kriter ortalamaları</p>
                    <div className="min-w-0 space-y-2">
                      {(selectedSchool.criteria || [])
                        .filter((c) => selectedSchool.criteria_averages?.[c.slug] != null)
                        .map((c) => (
                          <div key={c.id} className="min-w-0 space-y-1">
                            <div className="flex min-w-0 justify-between gap-2 text-xs">
                              <span className="min-w-0 flex-1 break-words text-slate-600 dark:text-slate-400">{c.label}</span>
                              <span className="shrink-0 font-medium tabular-nums">{(selectedSchool.criteria_averages?.[c.slug] ?? 0).toFixed(1)}</span>
                            </div>
                            <div className="h-2 min-w-0 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700/50">
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

              <div
                role="tablist"
                aria-label="İçerik sekmeleri"
                className="flex min-w-0 gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-slate-800/50"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'reviews'}
                  aria-controls="reviews-panel"
                  id="tab-reviews"
                  onClick={() => setActiveTab('reviews')}
                  className={`flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-all sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-sm ${
                    activeTab === 'reviews'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span className="leading-tight">Puan ve Yorumlar</span>
                  <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300 sm:text-xs">
                    {reviews.total || selectedSchool?.review_count || 0}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === 'questions'}
                  aria-controls="questions-panel"
                  id="tab-questions"
                  onClick={() => setActiveTab('questions')}
                  className={`flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-2 text-center text-xs font-semibold transition-all sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-sm ${
                    activeTab === 'questions'
                      ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <span className="leading-tight">Soru ve Cevaplar</span>
                  <span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-slate-600 dark:bg-slate-700 dark:text-slate-300 sm:text-xs">
                    {questions.total || selectedSchool?.question_count || 0}
                  </span>
                </button>
              </div>

              {activeTab === 'reviews' ? (
                <div id="reviews-panel" role="tabpanel" aria-labelledby="tab-reviews">
                  <Card
                    ref={ownReviewCardRef}
                    className="min-w-0 overflow-hidden border-slate-200/80 shadow-sm dark:border-slate-700/80"
                  >
                    <CardHeader className="border-b border-slate-100 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40 sm:px-5">
                      <div className="flex gap-2.5">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-200/80 bg-amber-50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-400">
                          <StarIcon className="size-4" filled aria-hidden />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <CardTitle className="min-w-0 flex-1 text-sm font-semibold tracking-tight text-slate-900 dark:text-white sm:text-base">
                              {!isLoggedIn
                                ? 'Bu Okula Değerlendirme Gönder'
                                : !reviewListReady
                                  ? 'Değerlendirme'
                                  : !ownReview
                                    ? 'Bu Okula Değerlendirme Gönder'
                                    : isEditingOwnReview
                                      ? 'Değerlendirmenizi düzenleyin'
                                      : 'Değerlendirmeniz'}
                            </CardTitle>
                            {isLoggedIn && reviewListReady && (
                              <button
                                type="button"
                                onClick={() => toggleInfo('reviewHelp')}
                                className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                aria-expanded={!!infoOpen.reviewHelp}
                                aria-label="Değerlendirme hakkında bilgi"
                              >
                                <InfoIcon className="size-4" size={16} />
                              </button>
                            )}
                          </div>
                          {!isLoggedIn ? (
                            <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50/90 p-3 dark:bg-amber-950/40">
                              <LogInIcon className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                              <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                                Değerlendirme yapmak için{' '}
                                <Link href={`/login?redirect=${PAGE_PATH}`} className="font-semibold underline underline-offset-2">
                                  giriş yapın
                                </Link>
                                .
                              </p>
                            </div>
                          ) : !reviewListReady ? (
                            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                              Mevcut değerlendirmeniz kontrol ediliyor…
                            </p>
                          ) : (
                            infoOpen.reviewHelp && (
                              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                                {ownReview
                                  ? isEditingOwnReview
                                    ? 'Puanları ve yorumu güncelleyin; kaydettiğinizde liste yenilenir.'
                                    : 'Yalnızca genel ortalama görünür; tüm maddeler «Değerlendirmeyi düzenle» veya listedeki «Düzenle» ile açılır.'
                                  : 'Her kritere dokunarak puanlayın; yorum isteğe bağlıdır. İsterseniz anonim paylaşabilirsiniz.'}
                              </p>
                            )
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    {isLoggedIn && !reviewListReady && (
                      <CardContent className="px-4 py-5 sm:px-5" aria-busy="true" aria-label="Değerlendirme yükleniyor">
                        <div className="space-y-3">
                          <Skeleton className="h-10 w-full rounded-xl" />
                          <Skeleton className="h-28 w-full rounded-xl" />
                          <Skeleton className="h-9 w-40 rounded-lg" />
                        </div>
                      </CardContent>
                    )}
                    {isLoggedIn && reviewListReady && !ownReview && (
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
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Yorum (opsiyonel)
                          </label>
                          <textarea
                            value={reviewForm.comment}
                            onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                            rows={3}
                            placeholder="Deneyiminizi paylaşın..."
                            className="w-full min-h-[120px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 sm:text-sm"
                          />
                        </div>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                          <input
                            type="checkbox"
                            checked={reviewForm.is_anonymous}
                            onChange={(e) => setReviewForm((f) => ({ ...f, is_anonymous: e.target.checked }))}
                            className="size-5 shrink-0 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">İsmim gizli kalsın</span>
                        </label>
                        <button
                          type="button"
                          onClick={handleSubmitReview}
                          disabled={submitting}
                          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 sm:w-auto sm:min-w-[180px]"
                        >
                          {submitting ? 'Gönderiliyor…' : 'Değerlendirmeyi gönder'}
                        </button>
                      </CardContent>
                    )}
                    {isLoggedIn && reviewListReady && ownReview && isEditingOwnReview && editReviewForm && (
                      <CardContent className="space-y-4 px-4 py-4 sm:px-5">
                        <SchoolReviewScorePicker
                          criteria={selectedSchool.criteria}
                          criteriaRatings={editReviewForm.criteria_ratings}
                          onCriteriaRating={(slug, n) =>
                            setEditReviewForm((f) =>
                              f ? { ...f, criteria_ratings: { ...f.criteria_ratings, [slug]: n } } : null
                            )
                          }
                          singleRating={editReviewForm.rating}
                          onSingleRating={(n) => setEditReviewForm((f) => (f ? { ...f, rating: n } : null))}
                        />
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                            Yorum (isteğe bağlı)
                          </label>
                          <textarea
                            value={editReviewForm.comment}
                            onChange={(e) => setEditReviewForm((f) => (f ? { ...f, comment: e.target.value } : null))}
                            rows={4}
                            placeholder="Değerlendirmenize yorum ekleyebilirsiniz."
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        </div>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
                          <input
                            type="checkbox"
                            checked={editReviewForm.is_anonymous}
                            onChange={(e) => setEditReviewForm((f) => (f ? { ...f, is_anonymous: e.target.checked } : null))}
                            className="size-5 shrink-0 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <span className="text-sm text-slate-700 dark:text-slate-300">İsmim gizli kalsın</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => ownReview && handleUpdateReview(ownReview.id)}
                            disabled={submitting}
                            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                          >
                            {submitting ? 'Kaydediliyor…' : 'Kaydet'}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditingReview}
                            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium dark:border-slate-700"
                          >
                            İptal
                          </button>
                        </div>
                      </CardContent>
                    )}
                    {isLoggedIn && reviewListReady && ownReview && !isEditingOwnReview && (
                      <CardContent className="space-y-4 px-4 py-4 sm:px-5">
                        <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-900/50">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Genel ortalama</span>
                            <RatingBadge rating={ownReview.rating} max={10} size="sm" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditingReview(ownReview)}
                          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/10 dark:border-primary/40 dark:hover:bg-primary/15 sm:w-auto"
                        >
                          <PencilIcon className="size-4" aria-hidden />
                          Değerlendirmeyi düzenle
                        </button>
                      </CardContent>
                    )}
                  </Card>

                  <Card className="min-w-0 overflow-x-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
                    <CardHeader className="min-w-0 space-y-0 px-2 md:px-6">
                      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <CardTitle className="min-w-0 flex-1 text-base">Puan ve Yorumlar</CardTitle>
                            <button
                              type="button"
                              onClick={() => toggleInfo('reviewsList')}
                              className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                              aria-expanded={!!infoOpen.reviewsList}
                              aria-label="Bu bölüm hakkında bilgi"
                            >
                              <InfoIcon className="size-4" size={16} />
                            </button>
                          </div>
                          {infoOpen.reviewsList && (
                            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                              Bu okula yapılan puan ve yorumlar. İsim gizleyenler &quot;Anonim kullanıcı&quot; olarak görünür.
                            </p>
                          )}
                        </div>
                        <div className="min-w-0 w-full md:w-auto md:max-w-[min(100%,280px)] md:shrink-0">
                          <label htmlFor="review-sort" className="sr-only">
                            Yorumları sırala
                          </label>
                          <select
                            id="review-sort"
                            value={reviewSort}
                            onChange={(e) => setReviewSort(e.target.value as typeof reviewSort)}
                            className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
                    <CardContent className="min-w-0 overflow-x-hidden px-2 pb-2 md:px-6 md:pb-0">
                      {detailListsLoading && reviews.items.length === 0 ? (
                        <div className="space-y-3 py-4" aria-busy="true" aria-label="Yorumlar yükleniyor">
                          <Skeleton className="h-24 w-full rounded-lg" />
                          <Skeleton className="h-24 w-full rounded-lg" />
                          <Skeleton className="h-20 w-full rounded-lg" />
                        </div>
                      ) : reviews.items.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-500">Bu okula henüz puan veya yorum yazılmamış. İlk değerlendirmeyi siz yapın!</p>
                      ) : (
                        <ul className="flex min-w-0 flex-col gap-4 md:gap-0 md:divide-y md:divide-slate-100 dark:md:divide-slate-800">
                          {reviews.items.map((r) => (
                            <li
                              key={r.id}
                              className={cn(
                                'min-w-0 md:py-5 md:first:pt-0 md:last:pb-0',
                                'max-md:relative max-md:overflow-hidden max-md:rounded-2xl max-md:border max-md:border-violet-200/55',
                                'max-md:bg-linear-to-b max-md:from-violet-50/60 max-md:via-white max-md:to-sky-50/50 max-md:p-4 max-md:shadow-md max-md:shadow-violet-200/20 max-md:ring-1 max-md:ring-violet-200/40',
                                'dark:max-md:border-violet-800/45 dark:max-md:from-violet-950/35 dark:max-md:via-slate-950 dark:max-md:to-sky-950/30 dark:max-md:shadow-violet-950/20 dark:max-md:ring-violet-500/15',
                              )}
                            >
                              <>
                                  <div className="flex min-w-0 flex-col gap-2 max-md:border-b max-md:border-violet-200/50 max-md:pb-3 md:flex-row md:items-start md:justify-between md:gap-3 md:border-b-0 md:pb-0 dark:max-md:border-violet-800/40">
                                    <span className="min-w-0 text-sm font-semibold leading-snug text-slate-800 wrap-break-word dark:text-slate-100">
                                      {r.is_anonymous ? 'Anonim kullanıcı' : r.author_display_name}
                                    </span>
                                    <div className="flex min-w-0 w-full flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400 md:w-auto md:max-w-[min(100%,100vw-2rem)] md:justify-end">
                                      {r.is_own && isLoggedIn && (
                                        <>
                                          {isEditingOwnReview && ownReview?.id === r.id ? (
                                            <span className="inline-flex flex-wrap items-center gap-2">
                                              <span className="rounded bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
                                                Üstte düzenleniyor
                                              </span>
                                              <button
                                                type="button"
                                                onClick={cancelEditingReview}
                                                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-600 underline hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:min-h-0 md:rounded md:px-2 md:py-0.5"
                                              >
                                                İptal
                                              </button>
                                            </span>
                                          ) : (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => startEditingReview(r)}
                                                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-sky-600 hover:bg-sky-100 active:bg-sky-100 dark:text-sky-400 dark:hover:bg-sky-900/50 md:min-h-0 md:rounded md:px-2 md:py-0.5"
                                                aria-label="Değerlendirmeyi düzenle"
                                              >
                                                <PencilIcon className="size-3.5" />
                                                Düzenle
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteReview(r.id)}
                                                disabled={deletingId === r.id}
                                                className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 active:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 disabled:opacity-50 md:min-h-0 md:rounded md:px-2 md:py-0.5"
                                                aria-label="Değerlendirmeyi sil"
                                              >
                                                <TrashIcon className="size-3.5" />
                                                Sil
                                              </button>
                                            </>
                                          )}
                                        </>
                                      )}
                                      <time
                                        dateTime={r.created_at}
                                        className="tabular-nums text-slate-500 dark:text-slate-400 max-md:ml-auto md:ml-0"
                                      >
                                        {new Date(r.created_at).toLocaleDateString('tr-TR')}
                                      </time>
                                      {r.is_own && r.status === 'pending' && (
                                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                                          Onay bekliyor
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-3 min-w-0 max-w-full md:mt-2">
                                    {r.criteria_ratings && Object.keys(r.criteria_ratings).length > 0 ? (
                                      <CriteriaRatingsDisplay
                                        variant="public"
                                        className="max-md:rounded-xl max-md:border max-md:border-sky-200/50 max-md:bg-linear-to-br max-md:from-sky-50/80 max-md:to-violet-50/50 max-md:p-2.5 dark:max-md:border-sky-800/40 dark:max-md:from-sky-950/40 dark:max-md:to-violet-950/30"
                                        headerRating={{ value: r.rating, max: 10 }}
                                        criteriaRatings={r.criteria_ratings}
                                        criteria={selectedSchool.criteria ?? undefined}
                                      />
                                    ) : (
                                      <div className="flex flex-wrap items-center gap-2 max-md:rounded-xl max-md:border max-md:border-amber-200/50 max-md:bg-linear-to-br max-md:from-amber-50/70 max-md:to-orange-50/40 max-md:p-3 dark:max-md:border-amber-800/40 dark:max-md:from-amber-950/35 dark:max-md:to-orange-950/25">
                                        <RatingBadge rating={r.rating} max={10} size="sm" />
                                      </div>
                                    )}
                                  </div>
                                  {r.comment && (
                                    <p className="mt-3 min-w-0 wrap-break-word rounded-xl border border-slate-200/70 bg-slate-50/90 px-3.5 py-3 text-[15px] leading-relaxed text-slate-700 dark:border-slate-700/70 dark:bg-slate-800/40 dark:text-slate-200 max-md:border-teal-200/55 max-md:bg-linear-to-br max-md:from-teal-50/80 max-md:to-emerald-50/50 max-md:text-slate-800 dark:max-md:border-teal-800/40 dark:max-md:from-teal-950/35 dark:max-md:to-emerald-950/25 dark:max-md:text-slate-100">
                                      {r.comment}
                                    </p>
                                  )}
                                  <div
                                    className={cn(
                                      'mt-3 flex w-full min-w-0 flex-wrap items-stretch gap-2 md:mt-2 md:items-center',
                                      !r.is_own && 'max-md:grid max-md:grid-cols-3',
                                    )}
                                  >
                                    {!r.is_own && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleLike(r.id)}
                                          disabled={likingId === r.id}
                                          className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-medium transition-colors disabled:opacity-50 max-md:w-full md:min-h-0 md:rounded-lg md:px-2.5 md:py-1 ${
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
                                          className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-medium transition-colors disabled:opacity-50 max-md:w-full md:min-h-0 md:rounded-lg md:px-2.5 md:py-1 ${
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
                                          onClick={() => { setReportTarget({ type: 'review', id: r.id }); setReportReason(reportReasonOptions[0]?.value ?? 'diger'); setReportComment(''); }}
                                          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1 rounded-xl px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300 max-md:w-full md:min-h-0 md:rounded-lg md:px-2 md:py-1"
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
                      <div className="flex items-start gap-2">
                        <CardTitle className="min-w-0 flex-1 text-base">Bu Okul Hakkında Soru Sor</CardTitle>
                        {isLoggedIn && (
                          <button
                            type="button"
                            onClick={() => toggleInfo('askQuestion')}
                            className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                            aria-expanded={!!infoOpen.askQuestion}
                            aria-label="Soru sorma hakkında bilgi"
                          >
                            <InfoIcon className="size-4" size={16} />
                          </button>
                        )}
                      </div>
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
                          {infoOpen.askQuestion && (
                            <p className="text-sm text-slate-600 dark:text-slate-400">Merak ettiğiniz konuları sorun, diğer kullanıcılar cevap verebilir.</p>
                          )}
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

                  <Card className="min-w-0 overflow-x-hidden border-slate-200/80 shadow-sm dark:border-slate-800">
                    <CardHeader className="min-w-0 px-3 sm:px-6">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <CardTitle className="min-w-0 flex-1 text-base">Sorulan Sorular ve Cevaplar</CardTitle>
                            <button
                              type="button"
                              onClick={() => toggleInfo('qaList')}
                              className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                              aria-expanded={!!infoOpen.qaList}
                              aria-label="Bu bölüm hakkında bilgi"
                            >
                              <InfoIcon className="size-4" size={16} />
                            </button>
                          </div>
                          {infoOpen.qaList && (
                            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                              Okul hakkında sorulan sorular ve kullanıcıların verdiği cevaplar. Giriş yaparak siz de cevap verebilirsiniz.
                            </p>
                          )}
                        </div>
                        <div className="min-w-0 w-full sm:w-auto sm:max-w-[min(100%,260px)] sm:shrink-0">
                          <label htmlFor="question-sort" className="sr-only">
                            Soruları sırala
                          </label>
                          <select
                            id="question-sort"
                            value={questionSort}
                            onChange={(e) => setQuestionSort(e.target.value as typeof questionSort)}
                            className="w-full min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                            aria-label="Soruları sırala"
                          >
                            <option value="newest">En yeniler</option>
                            <option value="most_answers">En çok cevaplanan</option>
                            <option value="most_liked">En çok beğenilen</option>
                          </select>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="min-w-0 overflow-x-hidden px-3 sm:px-6">
                      {detailListsLoading && questions.items.length === 0 ? (
                        <div className="space-y-3 py-4" aria-busy="true" aria-label="Sorular yükleniyor">
                          <Skeleton className="h-28 w-full rounded-xl" />
                          <Skeleton className="h-28 w-full rounded-xl" />
                        </div>
                      ) : questions.items.length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-500">Bu okul hakkında henüz soru sorulmamış. Merak ettiğiniz konuyu ilk siz sorun!</p>
                      ) : (
                        <ul className="min-w-0 space-y-5">
                          {questions.items.map((q) => (
                            <li
                              key={q.id}
                              className="min-w-0 max-w-full overflow-hidden rounded-xl border border-sky-200/45 bg-gradient-to-b from-sky-50/70 via-sky-50/25 to-white shadow-sm dark:border-sky-800/35 dark:from-sky-950/40 dark:via-sky-950/15 dark:to-slate-900/50"
                            >
                              <div className="min-w-0 px-3 py-3.5 sm:px-4">
                                {editingQuestionId === q.id && editQuestionForm !== null ? (
                                  <div className="space-y-3 rounded-lg border border-sky-200/70 bg-sky-50/60 p-3 dark:border-sky-700/50 dark:bg-sky-950/35">
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
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700/90 dark:text-sky-300/90">
                                        Soru
                                      </p>
                                      {q.status === 'pending' && (
                                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                                          Onay bekliyor
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-1.5 min-w-0 wrap-break-word text-base font-semibold leading-snug text-slate-800 dark:text-slate-100">
                                      {q.question}
                                    </p>
                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                      <span className="min-w-0 wrap-break-word">{q.is_anonymous ? 'Anonim kullanıcı' : q.author_display_name}</span>
                                      <span>·</span>
                                      <time dateTime={q.created_at}>
                                        {formatTrDateTimeMedium(q.created_at)}
                                      </time>
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
                                      <div className="mt-2 flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleQuestionLike(q.id)}
                                          disabled={likingQuestionId === q.id}
                                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
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
                                          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
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
                                          onClick={() => { setReportTarget({ type: 'question', id: q.id }); setReportReason(reportReasonOptions[0]?.value ?? 'diger'); setReportComment(''); }}
                                          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
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
                                <div className="min-w-0 space-y-2.5 border-t border-emerald-200/35 bg-gradient-to-b from-emerald-50/55 to-teal-50/35 px-3 py-3.5 sm:px-4 dark:border-emerald-800/25 dark:from-emerald-950/30 dark:to-teal-950/15">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800/85 dark:text-emerald-300/90">
                                    Yanıtlar ({q.answers.length})
                                  </p>
                                  {q.answers.map((a, ai) => (
                                    <div
                                      key={a.id}
                                      className="flex min-w-0 max-w-full gap-2.5 rounded-lg border border-emerald-200/40 bg-white/85 px-2.5 py-2.5 shadow-[0_1px_0_0_rgba(16,185,129,0.06)] sm:gap-3 sm:px-3 dark:border-emerald-800/35 dark:bg-emerald-950/25"
                                    >
                                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-100">
                                        {ai + 1}
                                      </div>
                                      <div className="min-w-0 flex-1">
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
                                          <div className="flex flex-wrap items-start gap-2">
                                            <p className="min-w-0 flex-1 wrap-break-word text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                                              {a.answer}
                                            </p>
                                            {a.status === 'pending' && (
                                              <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                                                Onay bekliyor
                                              </span>
                                            )}
                                          </div>
                                          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-emerald-800/80 dark:text-emerald-400/95">
                                            <span className="min-w-0 font-medium wrap-break-word">
                                              {a.is_anonymous ? 'Anonim kullanıcı' : a.author_display_name}
                                            </span>
                                            <span>·</span>
                                            <time dateTime={a.created_at}>
                                              {formatTrDateTimeMedium(a.created_at)}
                                            </time>
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
                                          <div className="mt-2 flex w-full min-w-0 flex-wrap items-center gap-x-2 gap-y-2 border-t border-emerald-200/35 pt-2 dark:border-emerald-800/30">
                                            {!a.is_own && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() => handleToggleAnswerLike(a.id, q.id)}
                                                  disabled={likingAnswerId === a.id}
                                                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
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
                                                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
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
                                                  onClick={() => { setReportTarget({ type: 'answer', id: a.id, questionId: q.id }); setReportReason(reportReasonOptions[0]?.value ?? 'diger'); setReportComment(''); }}
                                                  className="inline-flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
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
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="min-w-0 border-t border-violet-200/30 bg-violet-50/35 px-3 py-3 dark:border-violet-800/25 dark:bg-violet-950/15 sm:px-4">
                                {isLoggedIn ? (
                                  <div className="space-y-2">
                                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-stretch">
                                      <input
                                        type="text"
                                        value={answerForms[q.id] ?? ''}
                                        onChange={(e) =>
                                          setAnswerForms((f) => ({ ...f, [q.id]: e.target.value }))
                                        }
                                        placeholder="Bu soruya cevap yazın..."
                                        className="min-w-0 w-full flex-1 rounded-lg border border-violet-200/50 bg-white/90 px-3 py-2.5 text-sm shadow-sm dark:border-violet-800/40 dark:bg-slate-900/80 sm:px-4 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleSubmitAnswer(q.id)}
                                        disabled={submittingAnswer === q.id || !(answerForms[q.id]?.trim())}
                                        className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:min-w-[7.5rem]"
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
            <div className="min-w-0 space-y-4 lg:space-y-6">
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
                    <div className="space-y-4 sm:space-y-6">
                      <div className="rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50/80 to-teal-50/50 px-4 py-4 dark:border-sky-800/50 dark:from-sky-950/40 dark:to-teal-950/30 sm:rounded-2xl sm:px-6 sm:py-5">
                        <div className="flex items-start gap-2">
                          <h2 className="flex min-w-0 flex-1 items-center gap-2 text-base font-bold text-slate-800 dark:text-white sm:text-lg">
                            <SchoolIcon className="size-5 shrink-0 text-sky-500" />
                            {[debouncedCity, debouncedDistrict].filter(Boolean).join(', ')}
                          </h2>
                          <button
                            type="button"
                            onClick={() => toggleInfo('regionExplore')}
                            className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-sky-100/80 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-sky-950/50"
                            aria-expanded={!!infoOpen.regionExplore}
                            aria-label="Bölge özeti hakkında bilgi"
                          >
                            <InfoIcon className="size-4" size={16} />
                          </button>
                        </div>
                        {infoOpen.regionExplore && (
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Bu bölgede <span className="font-semibold text-sky-600 dark:text-sky-400">{total.toLocaleString('tr-TR')}</span> okul bulundu.
                            {schools.length > 0 && (
                              <span className="ml-1">
                                Soldaki listeden seçin veya aşağıdaki en iyi puanlı okullara göz atın.
                              </span>
                            )}
                          </p>
                        )}
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
                    <div className="space-y-4 sm:space-y-6">
                      <div className="rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-50 to-sky-50/30 px-4 py-5 dark:border-slate-700 dark:from-slate-900/50 dark:to-sky-950/20 sm:rounded-2xl sm:px-6 sm:py-8">
                        <div className="flex items-start justify-center gap-2">
                          <h2 className="text-center text-lg font-bold text-slate-800 dark:text-white sm:text-xl">
                            İl veya ilçe seçerek keşfe başlayın
                          </h2>
                          <button
                            type="button"
                            onClick={() => toggleInfo('cityExplore')}
                            className="shrink-0 rounded-full p-1 text-slate-500 hover:bg-slate-200/80 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                            aria-expanded={!!infoOpen.cityExplore}
                            aria-label="Keşif hakkında bilgi"
                          >
                            <InfoIcon className="size-4" size={16} />
                          </button>
                        </div>
                        {infoOpen.cityExplore && (
                          <p className="mt-2 text-center text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                            Aşağıdaki illere tıklayın veya yukarıdaki aramada okul adı yazın.
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap justify-center gap-1.5 sm:mt-6 sm:gap-2">
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
                              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition-all duration-200 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-sky-600 dark:hover:bg-sky-950/50 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                        <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-slate-400 sm:mt-4 sm:text-xs">
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
        <DialogContent
          title="İçeriği bildir"
          descriptionId="report-dialog-description"
          className="max-w-[min(100vw-1.5rem,26rem)] overflow-hidden border-slate-200/80 bg-background shadow-2xl ring-1 ring-slate-900/[0.04] dark:border-slate-700/70 dark:bg-slate-950 dark:ring-white/[0.06]"
        >
          <div className="space-y-5">
            <div className="flex gap-3 rounded-2xl border border-rose-200/50 bg-gradient-to-br from-rose-50/90 to-orange-50/40 p-3.5 dark:border-rose-900/40 dark:from-rose-950/50 dark:to-orange-950/25">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-700 shadow-inner dark:bg-rose-500/20 dark:text-rose-200">
                <FlagIcon className="size-5" aria-hidden />
              </div>
              <p id="report-dialog-description" className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                Ekibimiz bildirimi inceleyecektir. Yanlış veya kötü niyetli bildirimler hesabınızı riske atabilir.
              </p>
            </div>

            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Sebep seçin
              </p>
              <div className="grid gap-2" role="radiogroup" aria-label="Bildir sebebi">
                {reportReasonOptions.map((opt) => {
                  const selected = reportReason === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setReportReason(opt.value)}
                      className={cn(
                        'flex w-full flex-col items-start rounded-xl border px-3.5 py-3 text-left transition-all duration-200',
                        selected
                          ? 'border-primary/60 bg-primary/[0.07] shadow-[0_0_0_1px] shadow-primary/25 ring-2 ring-primary/20 dark:bg-primary/15'
                          : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600 dark:hover:bg-slate-800/80',
                      )}
                    >
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{opt.label}</span>
                      <span className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{opt.hint}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-end justify-between gap-2">
                <label htmlFor="report-comment" className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Açıklama <span className="font-normal normal-case text-slate-400">(isteğe bağlı)</span>
                </label>
                <span className="text-[11px] tabular-nums text-slate-400 dark:text-slate-500">
                  {reportComment.length}/500
                </span>
              </div>
              <textarea
                id="report-comment"
                value={reportComment}
                onChange={(e) => setReportComment(e.target.value.slice(0, 500))}
                rows={3}
                maxLength={500}
                placeholder="İsterseniz kısa not ekleyin…"
                className="w-full resize-none rounded-xl border border-slate-200/90 bg-white px-3.5 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
              {reportProfanityFilterActive && (
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Yönetici listesi açıksa, not alanı da aynı kurallara tabidir.
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200/80 pt-4 dark:border-slate-800 sm:flex-row sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => setReportTarget(null)}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleReport}
                disabled={reportSubmitting}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 px-5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:from-rose-500 hover:to-rose-600 disabled:opacity-50 dark:shadow-rose-900/40"
              >
                {reportSubmitting ? 'Gönderiliyor…' : 'Bildirimi gönder'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** useSearchParams Suspense: auth yüklendikten sonra kısa süre; kart RouteGuard ile aynı bileşen */
function OkulDegerlendirmeleriSuspenseFallback() {
  return (
    <AppShellLoadingCard
      title="Okul değerlendirmeleri"
      subtitle="Yükleniyor…"
      hint="Sayfa bileşenleri hazırlanıyor. Liste ve filtreler birkaç saniye içinde yüklenecek."
      leading={
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-teal-600 text-white shadow-md ring-2 ring-white/40 dark:ring-white/10">
          <SchoolIcon className="size-5" aria-hidden />
        </div>
      }
    />
  );
}

export default function OkulDegerlendirmeleriPage() {
  return (
    <Suspense fallback={<OkulDegerlendirmeleriSuspenseFallback />}>
      <OkulDegerlendirmeleriContent />
    </Suspense>
  );
}
