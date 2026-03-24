'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { EmptyState } from '@/components/ui/empty-state';
import { Target, BookOpen, ChevronRight, Filter, ExternalLink } from 'lucide-react';

type PlanSummary = {
  id: string;
  subject_code: string;
  subject_label: string;
  grade: number;
  academic_year: string;
  section: string | null;
  week_count: number;
};

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

export default function OutcomeSetsPage() {
  const router = useRouter();
  const { me, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState<string>('');
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [allItems, setAllItems] = useState<PlanSummary[]>([]);

  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('document_templates'));

  const fetchData = useCallback(async () => {
    if (!token || !canManage) return;
    setLoading(true);
    try {
      const res = await apiFetch<{ items: PlanSummary[] }>('/yillik-plan-icerik/teacher/plans', { token });
      setAllItems(res.items ?? []);
    } catch {
      setAllItems([]);
    } finally {
      setLoading(false);
    }
  }, [token, canManage]);

  useEffect(() => {
    if (me && !canManage) {
      router.replace('/403');
      return;
    }
  }, [me, canManage, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    allItems.forEach((s) => {
      if (s.subject_code && s.subject_label) map.set(s.subject_code, s.subject_label);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allItems]);

  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    allItems.forEach((s) => set.add(s.grade));
    return Array.from(set).sort((a, b) => a - b);
  }, [allItems]);

  const yearOptions = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((s) => {
      if (s.academic_year) set.add(s.academic_year);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allItems]);

  const items = useMemo(() => {
    return allItems.filter((s: PlanSummary) => {
      if (filterSubject && s.subject_code !== filterSubject) return false;
      if (filterGrade && s.grade !== parseInt(filterGrade, 10)) return false;
      if (filterYear && s.academic_year !== filterYear) return false;
      return true;
    });
  }, [allItems, filterSubject, filterGrade, filterYear]);

  if (!me && token) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <LoadingSpinner label="Yükleniyor…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Kazanım Setleri</h1>
          <p className="text-sm text-muted-foreground">
            Yıllık plan içeriklerinden kazanım setlerini görüntüleyin. Veri kaynağı: yillik_plan_icerik.
          </p>
        </div>
        <Link
          href="/yillik-plan-icerik"
          className="inline-flex items-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          <ExternalLink className="mr-2 size-4" />
          Yıllık Plan İçeriklerinde Düzenle
        </Link>
      </div>

      {/* Filtreler */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="size-4" />
            Filtrele
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Ders</label>
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="w-[200px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tümü</option>
                {subjectOptions.map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Sınıf</label>
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="w-[100px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tümü</option>
                {(gradeOptions.length ? gradeOptions : GRADES).map((g) => (
                  <option key={g} value={String(g)}>{g}. Sınıf</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium">Öğretim Yılı</label>
              <select
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
                className="w-[140px] rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Tümü</option>
                {(yearOptions.length ? yearOptions : ACADEMIC_YEARS).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            {(filterSubject || filterGrade || filterYear) && (
              <div className="flex items-end">
                <button
                  type="button"
                  className="text-sm text-muted-foreground hover:text-foreground underline"
                  onClick={() => {
                    setFilterSubject('');
                    setFilterGrade('');
                    setFilterYear('');
                  }}
                >
                  Temizle
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planlar ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={<Target className="size-12 text-muted-foreground" />}
              title="Plan bulunamadı"
              description="Yıllık plan içeriklerinde henüz veri yok. Yıllık Plan İçerikleri sayfasından plan ekleyin."
              action={
                <Link
                  href="/yillik-plan-icerik"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Yıllık Plan İçerikleri
                  <ChevronRight className="size-4" />
                </Link>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((plan) => (
                <Card
                  key={plan.id}
                  className="group flex flex-col transition-colors hover:border-primary/40"
                >
                  <Link href={`/outcome-sets/${encodeURIComponent(plan.id)}`} className="block flex-1">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-base">
                          {plan.subject_label} — {plan.grade}. Sınıf
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {plan.academic_year ?? '—'}
                          {plan.section ? ` · ${plan.section}` : ''}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{plan.week_count} hafta</span>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:underline">
                        Kazanımları Görüntüle
                        <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
