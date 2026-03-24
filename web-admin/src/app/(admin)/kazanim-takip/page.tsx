'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Target, BookOpen, ChevronRight, Home, Search, Star, Clock, GraduationCap, Layers, X, Zap, Heart } from 'lucide-react';

type SearchMatch = {
  week_order: number;
  hafta_label: string;
  unite: string | null;
  konu: string | null;
  match_in: string;
  snippet: string;
};

type PlanSummary = {
  id: string;
  subject_code: string;
  subject_label: string;
  grade: number;
  academic_year: string;
  section: string | null;
  week_count: number;
  matches?: SearchMatch[];
};

import { getFavoriler, toggleFavori, getSonPlanlar, getSavedFilters, setSavedFilters, getKaldiginYer } from './kazanim-storage';

function getAcademicYears(): string[] {
  const years: string[] = [];
  const now = new Date();
  const startYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  for (let i = -1; i < 5; i++) {
    years.push(`${startYear + i}-${startYear + i + 1}`);
  }
  return years.sort((a, b) => b.localeCompare(a));
}

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);
const ACADEMIC_YEARS = getAcademicYears();

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightText(text: string, term: string): React.ReactNode {
  if (!term || !term.trim()) return text;
  const escaped = escapeRegExp(term.trim());
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="bg-amber-200 dark:bg-amber-800/70 text-amber-900 dark:text-amber-100 rounded px-0.5 font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/** Ders ismi (örn. "Coğrafya - Maarif M. (S.B.L.)") → branş adı ("Coğrafya") */
function getBransAdi(label: string): string {
  const match = label.match(/^([^\-–—]+?)(?:\s+[-–—]\s+)/);
  return match ? match[1].trim() : label.trim();
}


/** Aurora/Material tarzı plan kartı – beyaz kart, hafif gölge, sol accent */
function PlanCard({
  plan,
  isFavori,
  onFavoriToggle,
  searchTerm,
}: {
  plan: PlanSummary;
  isFavori: boolean;
  onFavoriToggle: () => void;
  searchTerm?: string;
}) {
  const q = searchTerm?.trim() ?? '';
  return (
    <div className="group relative">
      <Link
        href={`/kazanim-takip/${encodeURIComponent(plan.id)}`}
        className="block h-full rounded-xl overflow-hidden transition-all duration-200 ease-out
          bg-white dark:bg-gray-800
          border border-gray-200/80 dark:border-gray-700/80
          shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.3)]
          hover:border-primary/40"
      >
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-90 group-hover:opacity-100 transition-opacity" />
        <div className="p-4 sm:p-5 lg:p-6 pl-5 sm:pl-6 lg:pl-7">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div className="flex size-10 sm:size-12 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20 text-primary shrink-0">
              <BookOpen className="size-4 sm:size-5" />
            </div>
            <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500 dark:text-gray-400">
              {plan.week_count} hafta
            </span>
          </div>
          <h3 className="mt-3 sm:mt-5 font-semibold text-gray-900 dark:text-gray-100 text-sm sm:text-base leading-snug line-clamp-2">
            {highlightText(plan.subject_label, q)}
          </h3>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
            {highlightText(`${plan.grade}. Sınıf`, q)}
            {plan.academic_year ? <> · {highlightText(plan.academic_year, q)}</> : ''}
          </p>
          <span className="mt-4 sm:mt-6 inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-primary">
            Kazanımları görüntüle
            <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onFavoriToggle();
        }}
        className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 sm:p-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md hover:bg-gray-50 dark:hover:bg-gray-700/80 transition-all touch-manipulation"
        title={isFavori ? 'Favorilerden kaldır' : 'Favorilere ekle'}
      >
        <Star className={`size-5 ${isFavori ? 'fill-amber-500 text-amber-500' : 'text-gray-400'}`} />
      </button>
    </div>
  );
}

export default function KazanimTakipPage() {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const planListRef = useRef<HTMLDivElement>(null);
  const { me, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade] = useState<number | null>(null);
  const [filterSubject, setFilterSubject] = useState<string | null>(null);
  const [filterSection, setFilterSection] = useState<'all' | 'ders' | 'bep'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewMode, setViewMode] = useState<'sinif' | 'brans'>('sinif');
  const [favoriler, setFavoriler] = useState<string[]>([]);
  const [, setStorageVersion] = useState(0);

  const isTeacher = me?.role === 'teacher';
  const [allItems, setAllItems] = useState<PlanSummary[]>([]);

  const fetchData = useCallback(async () => {
    if (!token || !isTeacher) return;
    setLoading(true);
    try {
      const q = debouncedSearch;
      const url = q.length >= 2 ? `/yillik-plan-icerik/teacher/plans?q=${encodeURIComponent(q)}` : '/yillik-plan-icerik/teacher/plans';
      const res = await apiFetch<{ items: PlanSummary[] }>(url, { token });
      setAllItems(res.items ?? []);
    } catch {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, isTeacher, debouncedSearch]);

  useEffect(() => {
    if (me && !isTeacher) {
      router.replace('/dashboard');
      return;
    }
  }, [me, isTeacher, router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(t);
  }, [searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setFavoriler(getFavoriler());
  }, [allItems]);

  useEffect(() => {
    const saved = getSavedFilters();
    setFilterGrade(saved.filterGrade);
    setFilterSubject(saved.filterSubject);
    setViewMode(saved.viewMode);
  }, []);

  useEffect(() => {
    setSavedFilters({ filterGrade, filterSubject, viewMode });
  }, [filterGrade, filterSubject, viewMode]);

  useEffect(() => {
    if (filterSubject && planListRef.current) {
      planListRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [filterSubject]);

  useEffect(() => {
    const onFocus = () => setStorageVersion((v) => v + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key >= '1' && e.key <= '9' && !e.ctrlKey && !e.metaKey) {
        const g = parseInt(e.key, 10);
        if (filterGrade === g) setFilterGrade(null);
        else setFilterGrade(g);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filterGrade]);

  const clearFilters = useCallback(() => {
    setFilterGrade(null);
    setFilterSubject(null);
    setFilterSection('all');
    setSearchQuery('');
  }, []);

  const sonPlanlar = getSonPlanlar();
  const kaldiginYer = getKaldiginYer();
  const bugununPlanlari = useMemo(() => {
    const fav = new Set(favoriler);
    const recent = sonPlanlar.map((s) => s.id);
    const ids = new Set([...fav, ...recent]);
    let list = allItems.filter((p) => ids.has(p.id));
    if (debouncedSearch.length < 2 && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.subject_label.toLowerCase().includes(q) ||
          p.subject_code.toLowerCase().includes(q) ||
          String(p.grade).includes(q) ||
          (p.academic_year && p.academic_year.includes(q)) ||
          (p.section && p.section.toLowerCase().includes(q))
      );
    }
    return list.slice(0, 5);
  }, [allItems, favoriler, sonPlanlar, searchQuery, debouncedSearch]);

  const handleFavoriToggle = (planId: string) => {
    toggleFavori(planId);
    setFavoriler(getFavoriler());
  };
  const favoriPlanlar = useMemo(() => {
    const favSet = new Set(favoriler);
    return allItems.filter((p) => favSet.has(p.id));
  }, [allItems, favoriler]);

  const filteredItems = useMemo(() => {
    let list = allItems;
    if (filterGrade != null) list = list.filter((p) => p.grade === filterGrade);
    if (filterSubject != null) list = list.filter((p) => p.subject_code === filterSubject);
    if (filterSection === 'ders') list = list.filter((p) => !p.section || p.section === 'ders' || p.section === '');
    if (filterSection === 'bep') list = list.filter((p) => p.section && p.section.toLowerCase().includes('bep'));
    if (debouncedSearch.length < 2 && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.subject_label.toLowerCase().includes(q) ||
          p.subject_code.toLowerCase().includes(q) ||
          String(p.grade).includes(q) ||
          (p.academic_year && p.academic_year.includes(q)) ||
          (p.section && p.section.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      const yA = a.academic_year || '', yB = b.academic_year || '';
      const cmp = yB.localeCompare(yA);
      if (cmp !== 0) return cmp;
      return (a.grade ?? 0) - (b.grade ?? 0);
    });
  }, [allItems, filterGrade, filterSubject, filterSection, searchQuery, debouncedSearch]);

  const branches = useMemo(() => {
    const list = filterGrade != null ? allItems.filter((p) => p.grade === filterGrade) : allItems;
    const bySubject = new Map<string, { label: string; code: string; count: number }>();
    for (const p of list) {
      const cur = bySubject.get(p.subject_code);
      if (cur) cur.count += 1;
      else bySubject.set(p.subject_code, { label: p.subject_label, code: p.subject_code, count: 1 });
    }
    return Array.from(bySubject.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [allItems, filterGrade]);

  const branchesFiltered = useMemo(() => {
    if (debouncedSearch.length >= 2) return branches;
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase().trim();
    return branches.filter((b) => b.label.toLowerCase().includes(q) || b.code.toLowerCase().includes(q));
  }, [branches, searchQuery, debouncedSearch]);

  const sonPlanlarData = useMemo(() => {
    if (debouncedSearch.length >= 2) {
      const ids = new Set(allItems.map((p) => p.id));
      return sonPlanlar.filter((s) => ids.has(s.id));
    }
    if (!searchQuery.trim()) return sonPlanlar;
    const q = searchQuery.toLowerCase().trim();
    return sonPlanlar.filter((s) => s.label.toLowerCase().includes(q));
  }, [sonPlanlar, searchQuery, debouncedSearch, allItems]);

  if (!me && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="kazanim-takip relative min-h-screen bg-[#f5f5f5] dark:bg-[#121212] text-gray-900 dark:text-gray-100 -mx-3 sm:-mx-4 md:-mx-6 lg:-mx-10 px-3 sm:px-4 md:px-6 lg:px-10 py-4 sm:py-6 lg:py-8 min-w-0 overflow-x-hidden">
      <div className="max-w-[1320px] mx-auto space-y-6 sm:space-y-8">
        <nav className="flex justify-center mb-6">
          <ol className="inline-flex flex-wrap items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-xl text-xs shadow-sm border border-gray-200 dark:border-gray-700">
            <li>
              <Link href="/dashboard" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors rounded-lg px-2 py-1">
                <Home className="size-3.5 inline mr-1" /> Anasayfa
              </Link>
            </li>
            <li className="text-gray-400"><ChevronRight className="size-3 inline" /></li>
            <li>
              <Link href="/kazanim-takip" className="text-gray-600 dark:text-gray-400 hover:text-primary transition-colors rounded-lg px-2 py-1">Planlarım</Link>
            </li>
            <li className="text-gray-400"><ChevronRight className="size-3 inline" /></li>
            <li className="font-medium text-primary px-3 py-1 rounded-lg bg-primary/10">
              {filterGrade != null ? `${filterGrade}. Sınıf Planları` : 'Tüm Sınıflar'}
              {filterSubject != null && branches.find((b) => b.code === filterSubject) && (
                <> · {branches.find((b) => b.code === filterSubject)?.label}</>
              )}
            </li>
          </ol>
        </nav>

        <div className="mb-6 sm:mb-8">
          <h1 className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            <span className="flex size-12 sm:size-14 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 text-primary shrink-0">
              <Target className="size-6 sm:size-7" />
            </span>
            <span>
              Kazanım Takip
              <span className="block text-sm font-normal text-gray-600 dark:text-gray-400 mt-1">
                Yıllık planlarınızdaki kazanımları görüntüleyin, aşamalı takip yapın
              </span>
            </span>
          </h1>
        </div>

        {/* Sınıf Planları / Branş Filtresi - responsive toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">Sınıf Planları</h2>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 shadow-sm overflow-hidden w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('sinif')}
              className={`flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3 sm:px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'sinif' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
            >
              <GraduationCap className="size-4 inline mr-1.5 sm:mr-2" />
              <span className="hidden sm:inline">Sınıf Seviyeleri</span>
              <span className="sm:hidden">Sınıflar</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('brans')}
              className={`flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3 sm:px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${viewMode === 'brans' ? 'bg-primary text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'}`}
            >
              <Layers className="size-4 inline mr-1.5 sm:mr-2" />
              Tüm Branşlar
            </button>
          </div>
        </div>

        {/* Sınıf kartları – tam genişlik, canlı gradient, orantılı grid */}
        {viewMode === 'sinif' && (
        <section className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 p-5 sm:p-6 lg:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-5 sm:mb-6">
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              Tüm Sınıflar <span className="font-semibold text-gray-900 dark:text-white">{allItems.length}</span> plan
            </span>
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5 w-full">
            {GRADES.map((g) => {
              const count = allItems.filter((p) => p.grade === g).length;
              const isActive = filterGrade === g;
              const gradients: [string, string][] = [
                ['#8b5cf6', '#d946ef'],
                ['#06b6d4', '#3b82f6'],
                ['#10b981', '#14b8a6'],
                ['#f59e0b', '#f97316'],
                ['#f43f5e', '#ec4899'],
                ['#6366f1', '#a855f7'],
                ['#0ea5e9', '#6366f1'],
                ['#84cc16', '#22c55e'],
                ['#f97316', '#ef4444'],
                ['#14b8a6', '#06b6d4'],
                ['#ec4899', '#f43f5e'],
                ['#3b82f6', '#8b5cf6'],
              ];
              const [c1, c2] = gradients[(g - 1) % 12];
              const bgStyle = {
                background: isActive
                  ? `linear-gradient(145deg, ${c1}40 0%, ${c2}70 50%, ${c1}35 100%)`
                  : `linear-gradient(145deg, ${c1}22 0%, ${c2}35 50%, ${c1}18 100%)`,
              };
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setFilterGrade(isActive ? null : g)}
                  style={bgStyle}
                  className={`group relative flex flex-col items-center justify-center aspect-square min-h-[76px] sm:min-h-[88px] rounded-2xl overflow-hidden transition-all duration-300 ease-out
                    border-2 ${isActive ? 'border-white/60 dark:border-white/30 shadow-xl shadow-primary/15 ring-2 ring-primary/30' : 'border-white/20 dark:border-white/10 hover:border-white/40 hover:shadow-lg hover:scale-[1.03] hover:z-10'}
                    ${isActive ? 'scale-[1.04] z-10' : ''}`}
                >
                  {/* Dekoratif ışık bloğu */}
                  <div
                    className="absolute -top-6 -right-6 w-16 h-16 rounded-full opacity-40 group-hover:opacity-60 transition-opacity"
                    style={{ background: `radial-gradient(circle, ${c2} 0%, transparent 70%)` }}
                  />
                  <span className={`relative z-10 flex items-baseline justify-center gap-0.5 ${isActive ? 'text-gray-900 dark:text-white drop-shadow-sm' : 'text-gray-800 dark:text-gray-100'}`}>
                    <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">{g}</span>
                    <span className={`text-[11px] sm:text-xs font-semibold ${isActive ? 'text-gray-700 dark:text-gray-200' : 'text-gray-600 dark:text-gray-300'}`}>. Sınıf</span>
                  </span>
                  {count > 0 && (
                    <span className={`relative z-10 mt-2 sm:mt-2.5 text-[10px] sm:text-[11px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm ${isActive ? 'bg-white/95 dark:bg-black/60 text-gray-800 dark:text-white' : 'bg-white/70 dark:bg-black/40 text-gray-700 dark:text-gray-200'}`}>
                      {count} plan
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
        )}

        {/* Ders adına göre ara */}
        <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm">
          <div className="relative max-w-md group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-gray-400 transition-colors group-focus-within:text-primary pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                filterGrade != null || viewMode === 'brans'
                  ? 'Ders adı veya plan içeriğinde ara (ünite, konu, kazanım)…'
                  : 'Ders adı, sınıf veya plan içeriği (ünite, konu, doğal vb.) ara… (/ kısayolu)'
              }
              className="w-full pl-11 pr-10 py-3 min-h-[48px] rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-base sm:text-sm placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              aria-label="Arama"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="Aramayı temizle"
                title="Aramayı temizle"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
          {searchQuery.trim() && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {viewMode === 'brans'
                ? `${branchesFiltered.length} branş bulundu`
                : `${filteredItems.length} plan bulundu`}
            </p>
          )}
        </section>

        {/* Bugünün/Bu haftanın kazanımları */}
        {bugununPlanlari.length > 0 && (
          <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm">
            <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-white mb-2">
              <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Zap className="size-4" />
              </span>
              Bu Haftanın Kazanımları
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Favori ve son planlarınızdan bu haftaya hızlıca gidin
            </p>
            <div className="flex flex-wrap gap-2">
              {bugununPlanlari.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/kazanim-takip/${encodeURIComponent(plan.id)}`}
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/30 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors text-sm font-medium text-emerald-800 dark:text-emerald-200"
                >
                  <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <BookOpen className="size-4" />
                  </span>
                  {highlightText(`${plan.subject_label} · ${plan.grade}. Sınıf`, searchQuery)}
                  <ChevronRight className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Kaldığın yerden devam */}
        {kaldiginYer && allItems.some((p) => p.id === kaldiginYer.planId) && (
          <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm">
            <Link
              href={`/kazanim-takip/${encodeURIComponent(kaldiginYer.planId)}?week=${kaldiginYer.week}`}
              className="flex items-center gap-4 px-5 py-4 rounded-xl border border-primary/30 dark:border-primary/40 bg-primary/5 dark:bg-primary/10 hover:bg-primary/10 dark:hover:bg-primary/15 hover:border-primary/50 transition-all group"
            >
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Heart className="size-6" />
              </span>
              <div className="flex-1 min-w-0">
                <span className="block font-semibold text-gray-900 dark:text-white group-hover:text-primary">Kaldığın yerden devam et</span>
                <span className="block text-sm text-gray-600 dark:text-gray-400 mt-0.5">{kaldiginYer.label} · {kaldiginYer.week}. Hafta</span>
              </div>
              <ChevronRight className="size-5 text-primary shrink-0" />
            </Link>
          </section>
        )}

        {/* BEP / Özel eğitim filtresi */}
        <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">Plan türü:</span>
            <div className="flex gap-2">
              {(['all', 'ders', 'bep'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterSection(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                    filterSection === s
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                  }`}
                >
                  {s === 'all' ? 'Tümü' : s === 'ders' ? 'Ders' : 'BEP'}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Tüm Branşlar görünümü – sınıf kartlarıyla uyumlu, canlı tasarım */}
        {viewMode === 'brans' && (
        <section className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 p-5 sm:p-6 lg:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 sm:mb-6">
            <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-white">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20 text-primary">
                <Layers className="size-5" />
              </span>
              Tüm Branşlar
            </h2>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {branchesFiltered.length} branş · <span className="font-semibold text-gray-900 dark:text-white">{allItems.length}</span> plan
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
            {filterGrade != null
              ? `${filterGrade}. Sınıf planları için branş seçin veya tek planlı branşa tıklayarak doğrudan kazanımlara gidin`
              : 'Branş seçin veya tek planlı branşa tıklayarak doğrudan kazanımlara gidin'}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 w-full">
            {branchesFiltered.map((b, i) => {
              const isActive = filterSubject === b.code;
              const grads = ['#8b5cf6', '#d946ef', '#06b6d4', '#3b82f6', '#10b981', '#14b8a6', '#f59e0b', '#f97316', '#f43f5e', '#ec4899', '#6366f1', '#a855f7'];
              const [c1, c2] = [grads[i % grads.length], grads[(i + 1) % grads.length]];
              const bgStyle = {
                background: isActive
                  ? `linear-gradient(145deg, ${c1}40 0%, ${c2}65 50%, ${c1}35 100%)`
                  : `linear-gradient(145deg, ${c1}22 0%, ${c2}35 50%, ${c1}18 100%)`,
              };
              const bransAdi = getBransAdi(b.label);
              const initial = bransAdi?.charAt(0)?.toUpperCase() || '?';
              const singlePlan = filterGrade != null && b.count === 1 ? allItems.find((p) => p.grade === filterGrade && p.subject_code === b.code) : b.count === 1 ? allItems.find((p) => p.subject_code === b.code) : null;
              const cardClass = `group relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl text-left transition-all duration-300 ease-out overflow-hidden min-h-[88px] sm:min-h-[96px]
                border-2 ${isActive ? 'border-white/60 dark:border-white/30 shadow-xl shadow-primary/15 ring-2 ring-primary/30 z-10 scale-[1.02]' : 'border-white/20 dark:border-white/10 hover:border-white/40 hover:shadow-lg hover:scale-[1.03] hover:z-10'}
                ${singlePlan ? 'cursor-pointer' : ''}`;
              const content = (
                <>
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-30 group-hover:opacity-50 transition-opacity" style={{ background: `radial-gradient(circle, ${c2} 0%, transparent 70%)` }} />
                  <div className={`flex size-12 sm:size-14 shrink-0 items-center justify-center rounded-xl font-bold text-lg sm:text-xl ${isActive ? 'bg-white/95 dark:bg-white/25' : 'bg-white/70 dark:bg-white/15'}`}>
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-gray-900 dark:text-white block text-sm sm:text-base">{highlightText(bransAdi, searchQuery)}</span>
                    <span className={`mt-1.5 sm:mt-2 inline-block text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm ${isActive ? 'bg-white/95 dark:bg-black/50 text-gray-800 dark:text-white' : 'bg-white/70 dark:bg-black/40 text-gray-700 dark:text-gray-200'}`}>
                      {b.count} plan
                    </span>
                  </div>
                  {singlePlan && <ChevronRight className="size-5 text-gray-500 dark:text-gray-400 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />}
                </>
              );
              if (singlePlan) {
                return (
                  <Link key={b.code} href={`/kazanim-takip/${encodeURIComponent(singlePlan.id)}`} style={bgStyle} className={cardClass}>
                    {content}
                  </Link>
                );
              }
              return (
                <button key={b.code} type="button" onClick={() => setFilterSubject(isActive ? null : b.code)} style={bgStyle} className={cardClass}>
                  {content}
                </button>
              );
            })}
          </div>
        </section>
        )}

        {/* Sınıf seçildiğinde: X. Sınıf Planları + Branş listesi */}
        {filterGrade != null && viewMode === 'sinif' && (
        <section className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 p-5 sm:p-6 lg:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
            <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-white">
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <BookOpen className="size-5" />
              </span>
              {filterGrade}. Sınıf Planları
            </h2>
            <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
              {branchesFiltered.length} branş bulundu
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-5 w-full">
            {branchesFiltered.map((b, i) => {
              const isActive = filterSubject === b.code;
              const grads = ['#8b5cf6', '#d946ef', '#06b6d4', '#3b82f6', '#10b981', '#14b8a6', '#f59e0b', '#f97316', '#f43f5e', '#ec4899', '#6366f1', '#a855f7'];
              const [c1, c2] = [grads[i % grads.length], grads[(i + 1) % grads.length]];
              const bgStyle = {
                background: isActive
                  ? `linear-gradient(145deg, ${c1}40 0%, ${c2}65 50%, ${c1}35 100%)`
                  : `linear-gradient(145deg, ${c1}22 0%, ${c2}35 50%, ${c1}18 100%)`,
              };
              const bransAdi = getBransAdi(b.label);
              const initial = bransAdi?.charAt(0)?.toUpperCase() || '?';
              const singlePlan = filterGrade != null && b.count === 1 ? allItems.find((p) => p.grade === filterGrade && p.subject_code === b.code) : null;
              const cardClass = `group relative flex items-center gap-4 p-4 sm:p-5 rounded-2xl text-left transition-all duration-300 ease-out overflow-hidden min-h-[88px] sm:min-h-[96px]
                border-2 ${isActive ? 'border-white/60 dark:border-white/30 shadow-xl shadow-primary/15 ring-2 ring-primary/30 z-10 scale-[1.02]' : 'border-white/20 dark:border-white/10 hover:border-white/40 hover:shadow-lg hover:scale-[1.03] hover:z-10'}
                ${singlePlan ? 'cursor-pointer' : ''}`;
              const content = (
                <>
                  <div className="absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-30 group-hover:opacity-50 transition-opacity" style={{ background: `radial-gradient(circle, ${c2} 0%, transparent 70%)` }} />
                  <div className={`flex size-12 sm:size-14 shrink-0 items-center justify-center rounded-xl font-bold text-lg sm:text-xl ${isActive ? 'bg-white/95 dark:bg-white/25' : 'bg-white/70 dark:bg-white/15'}`}>
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-gray-900 dark:text-white block text-sm sm:text-base">{highlightText(bransAdi, searchQuery)}</span>
                    <span className={`mt-1.5 sm:mt-2 inline-block text-[11px] sm:text-xs font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm ${isActive ? 'bg-white/95 dark:bg-black/50 text-gray-800 dark:text-white' : 'bg-white/70 dark:bg-black/40 text-gray-700 dark:text-gray-200'}`}>
                      {b.count} plan
                    </span>
                  </div>
                  {singlePlan && <ChevronRight className="size-5 text-gray-500 dark:text-gray-400 shrink-0 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />}
                </>
              );
              if (singlePlan) {
                return (
                  <Link key={b.code} href={`/kazanim-takip/${encodeURIComponent(singlePlan.id)}`} style={bgStyle} className={cardClass}>
                    {content}
                  </Link>
                );
              }
              return (
                <button key={b.code} type="button" onClick={() => setFilterSubject(isActive ? null : b.code)} style={bgStyle} className={cardClass}>
                  {content}
                </button>
              );
            })}
          </div>
        </section>
        )}

        {/* Favori Planlar */}
        {favoriPlanlar.length > 0 && (
          <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm">
            <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                <Star className="size-4 fill-amber-500" />
              </span>
              Favori Planlarım
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {favoriPlanlar.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isFavori={true}
                  onFavoriToggle={() => handleFavoriToggle(plan.id)}
                  searchTerm={searchQuery}
                />
              ))}
            </div>
          </section>
        )}

        {/* Son Görüntülenen Planlar */}
        {sonPlanlarData.length > 0 && (
          <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm">
            <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-white mb-4">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Clock className="size-4" />
              </span>
              Son Görüntülenen Planlar
            </h2>
            <div className="flex flex-wrap gap-2">
              {sonPlanlarData.map((s) => (
                <Link
                  key={s.id}
                  href={`/kazanim-takip/${encodeURIComponent(s.id)}`}
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50/50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700/50 hover:border-primary/40 transition-all text-sm font-medium"
                >
                  <BookOpen className="size-4 text-primary shrink-0" />
                  <span className="line-clamp-1">{highlightText(s.label, searchQuery)}</span>
                  <ChevronRight className="size-3.5 text-gray-400 shrink-0" />
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Tüm Planlar / Branşa ait plan listesi */}
        <section ref={planListRef} className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-6 shadow-sm">
          <h2 className="flex items-center gap-3 text-lg font-semibold text-gray-900 dark:text-white mb-4">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="size-4" />
            </span>
            {(() => {
              if (debouncedSearch.length >= 2) return `"${debouncedSearch}" arama sonuçları`;
              const sel = filterSubject ? branches.find((b) => b.code === filterSubject) : null;
              if (sel) return `${getBransAdi(sel.label)} Planları${filterGrade != null ? ` (${filterGrade}. Sınıf)` : ''}`;
              if (filterGrade != null) return `${filterGrade}. Sınıf Planları`;
              return 'Tüm Planlar';
            })()}
            {(filterGrade != null || filterSubject != null || filterSection !== 'all' || searchQuery) && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="size-3.5" />
                Filtreyi temizle
              </button>
            )}
          </h2>

          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <LoadingSpinner label="Planlar yükleniyor…" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <div className="py-16">
                <EmptyState
                  icon={<BookOpen className="size-10 text-gray-500" />}
                  title="Plan bulunamadı"
                  description={
                    searchQuery || filterGrade != null || filterSubject != null
                      ? 'Filtreye uygun plan yok. Filtreyi temizleyip tekrar deneyin.'
                      : 'Henüz yıllık plan içeriği yok. Sistem yöneticinize başvurun.'
                  }
                />
              </div>
            </div>
          ) : debouncedSearch.length >= 2 && filteredItems.some((p) => p.matches && p.matches.length > 0) ? (
            <div className="space-y-6">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>{filteredItems.length}</strong> planda eşleşme bulundu – gruplara göre gösteriliyor
              </p>
              {filteredItems.map((plan) => {
                const planHref = `/kazanim-takip/${encodeURIComponent(plan.id)}`;
                return (
                <div
                  key={plan.id}
                  className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
                >
                  <Link
                    href={planHref}
                    className="block px-5 py-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <BookOpen className="size-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">
                            {plan.subject_label} · {plan.grade}. Sınıf · {plan.academic_year}
                            {plan.section ? ` (${plan.section})` : ''}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {plan.matches?.length ?? 0} eşleşme
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="size-5 text-gray-400 shrink-0" />
                    </div>
                  </Link>
                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                    {plan.matches?.map((m, idx) => {
                      const matchHref = `/kazanim-takip/${encodeURIComponent(plan.id)}?week=${m.week_order}`;
                      return (
                      <Link
                        key={idx}
                        href={matchHref}
                        className="block px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-l-2 border-transparent hover:border-primary/50"
                      >
                        <div className="flex items-start gap-3">
                          <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                            {m.hafta_label}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {(m.unite ? `${m.unite} › ` : '') + (m.konu || '-')}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {m.match_in} · {m.snippet}
                            </p>
                          </div>
                          <ChevronRight className="size-3.5 text-gray-400 shrink-0 mt-1" />
                        </div>
                      </Link>
                      );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  isFavori={favoriler.includes(plan.id)}
                  onFavoriToggle={() => handleFavoriToggle(plan.id)}
                  searchTerm={searchQuery}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
