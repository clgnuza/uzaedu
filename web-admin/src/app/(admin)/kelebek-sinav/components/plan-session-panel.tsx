'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {
  Plus, MoreVertical, Trash2, Eye, Users, BookOpen, Building2,
  CalendarDays, ClipboardList, Printer, UserCheck, Search,
  CheckCircle2, XCircle, Wand2, RefreshCw, X, Settings2,
  LayoutGrid, ShieldCheck, Shuffle, ArrowLeftRight, SortAsc,
  Lock, UserCog, Upload, FileUp, EyeOff, ArrowRight, CalendarRange,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { butterflyViolationSummary, butterflyViolationTotal, type ButterflyViolations } from '@/lib/butterfly-violations';
import { fetchSessionsByButterflyPlan } from '@/lib/optik-sessions-api';
import { ScanLine } from 'lucide-react';

type PlanRules = {
  subjectLabel?: string;
  lessonPeriodLabel?: string;
  parentPlanId?: string;
  planType?: string;
  participantClassIds?: string[];
  classSubjectAssignments?: Array<{ classId: string; subjectName: string }>;
  fillMode?: 'balanced' | 'sequential';
  genderRule?: 'can_sit_adjacent' | 'cannot_sit_adjacent';
  classMix?: 'can_mix' | 'cannot_mix';
  sameClassAdjacent?: 'forbid' | 'allow';
  sameClassSkipOne?: 'forbid' | 'allow';
  distributionMode?: string;
  constraints?: string[];
  studentSortOrder?: 'student_number' | 'alphabetical' | 'random';
  fillDirection?: 'ltr' | 'rtl' | 'alternating';
  prioritizePinned?: boolean;
  lockPinnedAssignments?: boolean;
  specialNeedsInFront?: boolean;
  specialNeedsStudentIds?: string[];
  proctorMode?: 'auto' | 'manual';
  proctorsPerRoom?: number;
  fixedClassIds?: string[];
  pinnedStudentIds?: string[];
  reportFooterLines?: string[];
  roomIds?: string[];
  participantMode?: 'classes' | 'all' | string;
};

type Plan = {
  id: string;
  title: string;
  description: string | null;
  examStartsAt: string;
  examEndsAt: string | null;
  status: string;
  rules: PlanRules;
};

type PlanDetail = {
  plan: { id: string; title: string; status: string; examStartsAt: string; examEndsAt: string | null };
  placedCount: number;
  unplacedCount: number;
  classCount: number;
  roomCount: number;
  totalCapacity: number;
};

export function PlanSessionPanel() {
  const { token, me } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [periodTitleById, setPeriodTitleById] = useState<Record<string, string>>({});
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [detailPlan, setDetailPlan] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rulesPlan, setRulesPlan] = useState<Plan | null>(null);
  const [generateResult, setGenerateResult] = useState<{
    planId: string; planTitle: string;
    placed: number; unplaced: number; rooms: number;
    violations: ButterflyViolations;
  } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [uploadPlan, setUploadPlan] = useState<Plan | null>(null);
  const [uploadFiles, setUploadFiles] = useState<Record<string, File>>({});
  const [uploadKey, setUploadKey] = useState<'all' | string>('all');
  const [uploading, setUploading] = useState(false);
  const [optikSessions, setOptikSessions] = useState<Array<{ id: string; title: string }>>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await apiFetch<Plan[]>(`/butterfly-exam/plans${schoolQ}`, { token });
      const titleMap: Record<string, string> = {};
      for (const p of list) {
        if ((p.rules as Record<string, unknown> | undefined)?.planType === 'period') {
          titleMap[p.id] = p.title;
        }
      }
      setPeriodTitleById(titleMap);
      setPlans(
        list.filter((p) => {
          const t = (p.rules as Record<string, unknown> | undefined)?.planType;
          return t !== 'period';
        }),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const generate = async (id: string) => {
    if (!token) return;
    setGenerating(id);
    try {
      const data = await apiFetch<{
        assignments: Array<{ studentId: string; roomId: string }>;
        unplaced?: Array<unknown>;
        violations: ButterflyViolations;
        roomCount?: number;
      }>(`/butterfly-exam/plans/${id}/generate-seats${schoolQ}`, { method: 'POST', token });
      await load();
      const plan = plans.find((p) => p.id === id);
      setGenerateResult({
        planId: id,
        planTitle: plan?.title ?? '',
        placed: data.assignments?.length ?? 0,
        unplaced: data.unplaced?.length ?? 0,
        rooms: data.roomCount ?? 0,
        violations: {
          adjacent: data.violations?.adjacent ?? 0,
          skipOne: data.violations?.skipOne ?? 0,
          gender: data.violations?.gender ?? 0,
          classMix: data.violations?.classMix ?? 0,
          backToBack: data.violations?.backToBack ?? 0,
          cross: data.violations?.cross ?? 0,
          pairRow: data.violations?.pairRow ?? 0,
          fixedRoom: data.violations?.fixedRoom ?? 0,
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Dağıtım başarısız');
    } finally {
      setGenerating(null);
    }
  };

  const publish = async (id: string) => {
    if (!token) return;
    try {
      await apiFetch(`/butterfly-exam/plans/${id}${schoolQ}`, {
        method: 'PATCH', token, body: JSON.stringify({ status: 'published' }),
      });
      toast.success('Yayınlandı');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    }
  };

  const deletePlan = async (id: string, title: string) => {
    if (!token || !confirm(`"${title}" sınavını silmek istediğinizden emin misiniz?`)) return;
    try {
      await apiFetch(`/butterfly-exam/plans/${id}${schoolQ}`, { method: 'DELETE', token });
      toast.success('Sınav silindi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
    setMenuOpenId(null);
  };

  const openDetail = async (id: string) => {
    setMenuOpenId(null);
    setDetailLoading(true);
    setDetailPlan(null);
    setOptikSessions([]);
    try {
      const [d, optik] = await Promise.all([
        apiFetch<PlanDetail>(`/butterfly-exam/plans/${id}/detail${schoolQ}`, { token: token! }),
        fetchSessionsByButterflyPlan(token!, id).catch(() => []),
      ]);
      setDetailPlan(d);
      setOptikSessions(optik.map((s) => ({ id: s.id, title: s.title })));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Detay alınamadı');
    } finally {
      setDetailLoading(false);
    }
  };

  const statusLabel = (s: string) => s === 'published' ? 'Yayında' : s === 'draft' ? 'Taslak' : s;
  const statusColor = (s: string) =>
    s === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300';

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="min-w-0 space-y-4">
      {isAdmin && (
        <div className="rounded-2xl border border-fuchsia-200/50 bg-gradient-to-br from-fuchsia-500/[0.08] via-white/80 to-violet-500/[0.06] p-3 shadow-sm dark:border-fuchsia-900/35 dark:from-fuchsia-950/30 dark:via-zinc-900/50 dark:to-violet-950/20 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fuchsia-800/90 dark:text-fuchsia-200/90">
            Önerilen akış
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-medium text-fuchsia-950 shadow-sm ring-1 ring-fuchsia-500/15 dark:bg-zinc-900/80 dark:text-fuchsia-100 dark:ring-fuchsia-400/20">
                <CalendarDays className="size-3.5 shrink-0" />
                1. Dönem takvimi
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground max-sm:hidden" />
              <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-600 px-2.5 py-1 font-semibold text-white shadow-md shadow-fuchsia-500/25">
                <CalendarRange className="size-3.5 shrink-0" />
                2. Oturumlar (buradasınız)
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground max-sm:hidden" />
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-medium text-fuchsia-950 shadow-sm ring-1 ring-fuchsia-500/15 dark:bg-zinc-900/80 dark:text-fuchsia-100 dark:ring-fuchsia-400/20">
                <Wand2 className="size-3.5 shrink-0" />
                3. Yerleştir ve yayınla
              </span>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button asChild size="sm" variant="outline" className="h-8 gap-1 text-xs sm:text-sm">
                <Link href={`/kelebek-sinav/sinav-planlama${schoolQ}`}>
                  Takvime git
                </Link>
              </Button>
              <Button asChild size="sm" className="h-8 gap-1 text-xs sm:text-sm">
                <Link href={`/kelebek-sinav/sinav-olustur${schoolQ}`}>
                  <Plus className="size-3.5" /> Yeni oturum
                </Link>
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            Önce <strong className="text-foreground">Sınav Takvimi</strong>nde dönem cetvelini oluşturun; ardından her sınav günü için burada oturum açıp yerleştirin.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold sm:text-base">Sınav oturumları</h2>
          <p className="text-[11px] text-muted-foreground sm:text-xs">Ders, salon ve koltuk dağıtımı bu listedeki oturumlara göre yapılır.</p>
        </div>
        {isAdmin && (
          <Button asChild size="sm" className="w-full gap-1.5 sm:w-auto">
            <Link href={`/kelebek-sinav/sinav-olustur${schoolQ}`}>
              <Plus className="size-4" /> Yeni sınav sihirbazı
            </Link>
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-12 text-center">
          <ClipboardList className="mx-auto size-10 text-slate-400 mb-3" />
          <p className="text-sm font-medium text-foreground">Henüz sınav oturumu yok.</p>
          <p className="mx-auto mt-1 max-w-sm px-2 text-xs text-muted-foreground">
            İsterseniz önce <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={`/kelebek-sinav/sinav-planlama${schoolQ}`}>Sınav Takvimi</Link>nde dönem cetvelini oluşturun; ardından burada oturum açın.
          </p>
          {isAdmin && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button asChild size="sm" variant="outline" className="gap-1.5">
                <Link href={`/kelebek-sinav/sinav-planlama${schoolQ}`}>Takvime git</Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/kelebek-sinav/sinav-olustur${schoolQ}`}>
                  <Plus className="size-4" /> Yeni oturum
                </Link>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3" ref={menuRef}>
          {plans.map((p) => (
            <div key={p.id} className="relative overflow-visible rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/60">
              <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-4">
                <div className="flex min-w-0 flex-1 gap-3">
                <div
                  className={cn('mt-0.5 size-2.5 shrink-0 rounded-full', p.status === 'published' ? 'bg-emerald-500' : 'bg-amber-400')}
                />
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold truncate">{p.title}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusColor(p.status))}>
                        {statusLabel(p.status)}
                      </span>
                      {p.rules?.parentPlanId && periodTitleById[p.rules.parentPlanId] && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-2 py-0.5 text-[10px] font-medium text-fuchsia-700 dark:border-fuchsia-800/50 dark:bg-fuchsia-950/30 dark:text-fuchsia-300">
                          <CalendarDays className="size-2.5" />
                          {periodTitleById[p.rules.parentPlanId]}
                        </span>
                      )}
                      {!p.rules?.parentPlanId && (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
                          Bağımsız
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(p.examStartsAt).toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                      {p.rules?.lessonPeriodLabel && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          ⏰ {p.rules.lessonPeriodLabel}
                        </span>
                      )}
                      {(p.rules?.classSubjectAssignments?.length ?? 0) > 0 && (
                        <span className="text-indigo-600 dark:text-indigo-400">
                          {[...new Set(p.rules.classSubjectAssignments!.map((a) => a.subjectName))].join(', ')}
                        </span>
                      )}
                      {p.rules?.subjectLabel && !(p.rules?.classSubjectAssignments?.length) && (
                        <span className="text-indigo-600 dark:text-indigo-400">{p.rules.subjectLabel}</span>
                      )}
                    </div>
                    {/* Rule badges */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(p.rules?.participantClassIds?.length ?? 0) > 0 && (
                        <RuleBadge color="indigo">{p.rules.participantClassIds!.length} sınıf</RuleBadge>
                      )}
                      {p.rules?.fillMode && (
                        <RuleBadge color="blue">{p.rules.fillMode === 'balanced' ? 'Dengeli dağıtım' : 'Dolduran dağıtım'}</RuleBadge>
                      )}
                      {p.rules?.genderRule && (
                        <RuleBadge color={p.rules.genderRule === 'cannot_sit_adjacent' ? 'rose' : 'emerald'}>
                          {p.rules.genderRule === 'cannot_sit_adjacent' ? 'Cinsiyet ayrı' : 'Cinsiyet serbest'}
                        </RuleBadge>
                      )}
                      {p.rules?.classMix && (
                        <RuleBadge color={p.rules.classMix === 'cannot_mix' ? 'amber' : 'slate'}>
                          {p.rules.classMix === 'cannot_mix' ? 'Sınıf karışamaz' : 'Sınıf karışabilir'}
                        </RuleBadge>
                      )}
                      {(p.rules?.constraints?.length ?? 0) > 0 && (
                        <RuleBadge color="violet">{p.rules.constraints!.length} kısıt</RuleBadge>
                      )}
                      {p.rules?.prioritizePinned !== false && <RuleBadge color="rose">Önce sabit</RuleBadge>}
                      {p.rules?.lockPinnedAssignments !== false && (p.rules?.pinnedStudentIds?.length ?? 0) > 0 && (
                        <RuleBadge color="slate">Kilit</RuleBadge>
                      )}
                      {p.rules?.fillDirection && p.rules.fillDirection !== 'ltr' && (
                        <RuleBadge color="slate">{p.rules.fillDirection === 'rtl' ? 'Sağdan doldur' : 'Alternatif'}</RuleBadge>
                      )}
                      {(p.rules?.fixedClassIds?.length ?? 0) > 0 && (
                        <RuleBadge color="amber">{p.rules.fixedClassIds!.length} sabit sınıf</RuleBadge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex w-full shrink-0 flex-wrap items-center gap-1 sm:ml-auto sm:w-auto sm:justify-end">
                  {isAdmin && p.status === 'draft' && (
                    <>
                      <Button type="button" size="sm" variant="secondary" className="h-7 gap-1 px-2 text-xs"
                        disabled={generating === p.id}
                        onClick={() => void generate(p.id)}>
                        {generating === p.id ? <LoadingSpinner /> : <Wand2 className="size-3" />} Yerleştir
                      </Button>
                      <Button type="button" size="sm" className="h-7 gap-1 px-2 text-xs"
                        onClick={() => void publish(p.id)}>
                        <CheckCircle2 className="size-3" /> Yayınla
                      </Button>
                    </>
                  )}
                  {isAdmin && p.status === 'published' && (
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs"
                      disabled={generating === p.id}
                      onClick={() => void generate(p.id)}>
                      {generating === p.id ? <LoadingSpinner /> : <RefreshCw className="size-3" />} Yeniden dağıt
                    </Button>
                  )}

                  {/* Menu */}
                  <div className="relative">
                    <Button type="button" variant="ghost" size="icon" className="size-7"
                      onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}>
                      <MoreVertical className="size-4" />
                    </Button>
                    {menuOpenId === p.id && (
                      <div className="absolute left-0 right-0 top-8 z-50 min-w-0 rounded-xl border border-white/60 bg-white/95 py-1 shadow-lg dark:border-zinc-700/60 dark:bg-zinc-900/95 sm:left-auto sm:right-0 sm:min-w-[190px]">
                        <MenuBtn icon={<Search className="size-3.5" />} label="Öğrenci Ara"
                          onClick={() => { setMenuOpenId(null); }}
                          href={`/kelebek-sinav/sinif-ogrenci${schoolQ}`} />
                        <MenuBtn icon={<Eye className="size-3.5" />} label="Detay" onClick={() => void openDetail(p.id)} />
                        {isAdmin && (
                          <>
                            <MenuBtn icon={<Wand2 className="size-3.5" />} label="Sınavı Düzenle"
                              onClick={() => { setMenuOpenId(null); }}
                              href={`/kelebek-sinav/sinav-olustur${schoolQ ? `${schoolQ}&` : '?'}plan_id=${encodeURIComponent(p.id)}`} />
                            <MenuBtn icon={<BookOpen className="size-3.5" />} label="Raporlar"
                              onClick={() => { setMenuOpenId(null); }}
                              href={`/kelebek-sinav/ayarlar${schoolQ}`} />
                            <MenuBtn icon={<UserCheck className="size-3.5" />} label="Gözetmen Ata"
                              onClick={() => { setMenuOpenId(null); }}
                              href={`/kelebek-sinav/yerlesim${schoolQ}`} />
                            <MenuBtn icon={<FileUp className="size-3.5" />} label="Sınav Kağıdı Yükle"
                              onClick={() => { setMenuOpenId(null); setUploadPlan(p); setUploadFiles({}); setUploadKey('all'); }} />
                            <MenuBtn icon={<Settings2 className="size-3.5" />} label="Dağıtım Kuralları"
                              onClick={() => { setMenuOpenId(null); setRulesPlan(p); }} />
                            <MenuBtn icon={<Printer className="size-3.5" />} label="Sınavları Yazdır"
                              onClick={() => { setMenuOpenId(null); }}
                              href={`/kelebek-sinav/ayarlar${schoolQ}`} />
                            <MenuBtn icon={<EyeOff className="size-3.5" />} label="Öğrenciye Kapat"
                              onClick={async () => {
                                setMenuOpenId(null);
                                if (!token) return;
                                try {
                                  await apiFetch(`/butterfly-exam/plans/${p.id}${schoolQ}`, {
                                    method: 'PATCH', token, body: JSON.stringify({ status: 'draft' }),
                                  });
                                  toast.success('Sınav öğrencilere kapatıldı');
                                  void load();
                                } catch { toast.error('İşlem başarısız'); }
                              }} />
                            <div className="my-1 border-t border-slate-200 dark:border-zinc-700" />
                            <MenuBtn icon={<Trash2 className="size-3.5 text-rose-500" />} label="Sınav Sil"
                              className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                              onClick={() => void deletePlan(p.id, p.title)} />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate Result Card */}
      {generateResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900">
            {/* Header */}
            <div className={cn(
              'flex items-center gap-3 rounded-t-2xl px-5 py-4',
              generateResult.unplaced === 0 && butterflyViolationTotal(generateResult.violations) === 0
                ? 'bg-emerald-500'
                : generateResult.unplaced === 0
                ? 'bg-amber-500'
                : 'bg-rose-500'
            )}>
              <div className="rounded-xl bg-white/20 p-2">
                {generateResult.unplaced === 0
                  ? <CheckCircle2 className="size-5 text-white" />
                  : <XCircle className="size-5 text-white" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-white text-sm">
                  {generateResult.unplaced === 0 ? 'Dağıtım Tamamlandı' : 'Dağıtım Tamamlandı (Uyarı)'}
                </p>
                <p className="text-[11px] text-white/80 truncate">{generateResult.planTitle}</p>
              </div>
              <button onClick={() => setGenerateResult(null)} className="rounded-full p-1 hover:bg-white/20">
                <X className="size-4 text-white" />
              </button>
            </div>

            {/* Stats */}
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50/80 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-2xl font-bold tabular-nums text-emerald-600">{generateResult.placed}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Yerleştirilen</span>
                </div>
                <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50/80 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className={cn('text-2xl font-bold tabular-nums', generateResult.unplaced > 0 ? 'text-rose-600' : 'text-slate-400')}>
                    {generateResult.unplaced}
                  </span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Yerleştirilemeyen</span>
                </div>
                <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-slate-50/80 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-2xl font-bold tabular-nums text-indigo-600">{generateResult.rooms}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">Salon</span>
                </div>
              </div>

              {/* Violations */}
              {butterflyViolationTotal(generateResult.violations) > 0 ? (
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                  <p className="mb-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">Kural İhlalleri</p>
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-200 wrap-anywhere">
                    {butterflyViolationSummary(generateResult.violations)}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                  ✓ Tüm yerleştirme kuralları karşılandı
                </div>
              )}

              {generateResult.unplaced > 0 && (
                <div className="rounded-xl border border-rose-200/60 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/20 dark:text-rose-300">
                  ⚠ {generateResult.unplaced} öğrenci yerleştirilemedi. Salon kapasitesi yetersiz olabilir.
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setGenerateResult(null)}>Kapat</Button>
                <Button size="sm" className="flex-1 gap-1.5"
                  onClick={() => { setGenerateResult(null); void publish(generateResult.planId); }}>
                  <CheckCircle2 className="size-3.5" /> Yayınla
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900 flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950/50">
                  <FileUp className="size-4 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Sınav Kağıdı Yükle</p>
                  <p className="text-xs text-muted-foreground">{uploadPlan.title}</p>
                </div>
              </div>
              <button onClick={() => setUploadPlan(null)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {/* Upload scope */}
              <div className="flex gap-2">
                {[
                  { key: 'all', label: 'Tüm Sınıflar' },
                  ...(uploadPlan.rules?.classSubjectAssignments
                    ? [...new Map(uploadPlan.rules.classSubjectAssignments.map((a) => [a.subjectName, a])).values()]
                        .map((a) => ({ key: a.subjectName, label: a.subjectName }))
                    : []),
                ].map((opt) => (
                  <button key={opt.key} type="button"
                    onClick={() => setUploadKey(opt.key)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      uploadKey === opt.key
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-200 text-muted-foreground hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800',
                    )}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Per-class file slots */}
              {uploadPlan.rules?.classSubjectAssignments && uploadPlan.rules.classSubjectAssignments.length > 0 ? (
                <div className="space-y-2">
                  {(uploadKey === 'all'
                    ? [{ classId: 'all', subjectName: 'Tüm Sınıflar' }]
                    : uploadPlan.rules.classSubjectAssignments.filter((a) => a.subjectName === uploadKey)
                  ).map((a) => {
                    const fileKey = `${uploadPlan.id}-${a.classId}`;
                    const f = uploadFiles[fileKey];
                    return (
                      <div key={a.classId}
                        className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-800/30">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{a.classId === 'all' ? 'Tüm Sınıflar' : a.subjectName}</p>
                          {f ? (
                            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 truncate">✓ {f.name}</p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">Dosya seçilmedi</p>
                          )}
                        </div>
                        <label className="shrink-0 cursor-pointer">
                          <input type="file" accept=".pdf,.PDF" className="sr-only"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) setUploadFiles((prev) => ({ ...prev, [fileKey]: file }));
                            }} />
                          <span className={cn(
                            'flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition',
                            f ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                              : 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300',
                          )}>
                            <Upload className="size-3" /> {f ? 'Değiştir' : 'PDF Seç'}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-indigo-300/60 bg-indigo-50/40 p-8 text-center transition hover:bg-indigo-50 dark:border-indigo-800/40 dark:bg-indigo-950/20">
                  <Upload className="size-7 text-indigo-500" />
                  <p className="text-sm font-medium">Sınav Kağıdı PDF Seç</p>
                  <p className="text-xs text-muted-foreground">Tüm sınıflar için ortak kağıt</p>
                  <input type="file" accept=".pdf,.PDF" className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setUploadFiles({ [`${uploadPlan.id}-all`]: file });
                    }} />
                  {uploadFiles[`${uploadPlan.id}-all`] && (
                    <p className="text-xs text-emerald-600">✓ {uploadFiles[`${uploadPlan.id}-all`]!.name}</p>
                  )}
                </label>
              )}

              <div className="rounded-lg border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-700 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
                Yüklenen PDF sınav kağıdı olarak kaydedilir. Yazdırma sırasında öğrenci bilgileri ve karekod otomatik eklenir.
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <Button variant="outline" size="sm" onClick={() => setUploadPlan(null)}>İptal</Button>
              <Button size="sm" disabled={uploading || Object.keys(uploadFiles).length === 0}
                className="gap-1.5"
                onClick={async () => {
                  if (!token || Object.keys(uploadFiles).length === 0) return;
                  setUploading(true);
                  try {
                    for (const [, file] of Object.entries(uploadFiles)) {
                      const fd = new FormData();
                      fd.append('file', file);
                      await apiFetch(`/butterfly-exam/plans/${uploadPlan.id}/upload-paper${schoolQ}`, {
                        method: 'POST', token, body: fd,
                      }).catch(() => null);
                    }
                    toast.success('Sınav kağıdı yüklendi');
                    setUploadPlan(null);
                  } catch {
                    toast.error('Yükleme başarısız');
                  } finally {
                    setUploading(false);
                  }
                }}>
                {uploading ? <LoadingSpinner /> : <><Upload className="size-3.5" /> Yükle</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Rules Modal */}
      {rulesPlan && (() => {
        const rr = rulesPlan.rules ?? {};
        const pid = rr.parentPlanId;
        const periodName = typeof pid === 'string' && periodTitleById[pid] ? periodTitleById[pid] : null;
        const pm = rr.participantMode;
        const pCount = rr.participantClassIds?.length ?? 0;
        const katilim =
          pm === 'all' || (pm !== 'classes' && pCount === 0)
            ? 'Tüm sınıflar (sınıf seçimi yok)'
            : `Seçili ${pCount} sınıf`;
        const csa = rr.classSubjectAssignments ?? [];
        const dersOzeti = csa.length > 0
          ? `${csa.length} sınıf–ders · ${[...new Set(csa.map((a) => a.subjectName))].join(', ')}`
          : rr.subjectLabel
            ? String(rr.subjectLabel)
            : 'Tek ders etiketi yok';
        const rids = rr.roomIds;
        const salonOzeti = Array.isArray(rids) && rids.length > 0
          ? `Seçili ${rids.length} salon (yerleştirme yalnızca bunlarda)`
          : 'Tüm uygun salonlar kullanılabilir';
        const dist = rr.distributionMode === 'constraint_greedy'
          ? 'Kısıt açgözlü (constraint greedy) — kurallara uygun ilk uygun koltuk'
          : rr.distributionMode
            ? String(rr.distributionMode)
            : 'Varsayılan';
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]">
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/30 bg-white shadow-2xl ring-1 ring-black/5 dark:border-zinc-700/80 dark:bg-zinc-900 dark:ring-white/5">
            <div className="relative bg-gradient-to-br from-violet-600 via-violet-500 to-indigo-600 px-5 py-5 text-white">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.22),transparent_55%)]" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
                    <Settings2 className="size-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/75">Dağıtım kuralları özeti</p>
                    <h3 className="mt-1 truncate text-lg font-bold leading-tight tracking-tight">{rulesPlan.title}</h3>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-3 py-1 text-xs font-semibold ring-1 ring-white/20 backdrop-blur-sm">
                        <CalendarDays className="size-3.5 shrink-0 opacity-90" />
                        {new Date(rulesPlan.examStartsAt).toLocaleString('tr-TR', {
                          day: '2-digit', month: 'short', year: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {rr.lessonPeriodLabel ? (
                        <span className="inline-flex items-center rounded-full bg-fuchsia-500/25 px-3 py-1 text-xs font-semibold ring-1 ring-fuchsia-300/40">
                          {String(rr.lessonPeriodLabel)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRulesPlan(null)}
                  className="shrink-0 rounded-xl bg-white/10 p-2 ring-1 ring-white/20 transition hover:bg-white/20"
                  aria-label="Kapat"
                >
                  <X className="size-4 text-white" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto bg-gradient-to-b from-slate-50/95 to-white p-5 dark:from-zinc-950 dark:to-zinc-900">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">Oturum özeti</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <SummaryTile
                  tone="amber"
                  icon={<CalendarRange className="size-4" />}
                  label="Dönem planı"
                  value={periodName ?? <span className="text-amber-800 dark:text-amber-200">Bağımsız (takvim raporuna bağlı değil)</span>}
                />
                <SummaryTile tone="sky" icon={<Users className="size-4" />} label="Katılım" value={katilim} />
                <SummaryTile tone="violet" icon={<BookOpen className="size-4" />} label="Ders / sınıf" value={dersOzeti} />
                <SummaryTile tone="emerald" icon={<Building2 className="size-4" />} label="Salon kapsamı" value={salonOzeti} />
              </div>

              <p className="mb-3 mt-6 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Yerleştirme ve dağıtım
              </p>
              <div className="grid grid-cols-1 gap-2.5">
              <RuleSection tone="violet" icon={<Layers className="size-3.5" />} title="Dağıtım algoritması">
                {dist}
              </RuleSection>
              <RuleSection tone="sky" icon={<LayoutGrid className="size-3.5" />} title="Dolum modu">
                {rr.fillMode === 'balanced' ? 'Dengeli — sınıflar salonlara mümkün olduğunca eşit yayılır'
                  : rr.fillMode === 'sequential' ? 'Dolduran — sırayla doldurulur, boşluk bırakılmaz'
                  : '—'}
              </RuleSection>
              <RuleSection tone="cyan" icon={<ArrowLeftRight className="size-3.5" />} title="Salon dolum yönü">
                {rr.fillDirection === 'ltr' ? 'Soldan sağa'
                  : rr.fillDirection === 'rtl' ? 'Sağdan sola'
                  : rr.fillDirection === 'alternating' ? 'Alternatif (sıra sıra ters yön)'
                  : '—'}
              </RuleSection>
              <RuleSection tone="rose" icon={<ShieldCheck className="size-3.5" />} title="Cinsiyet">
                {rr.genderRule === 'cannot_sit_adjacent' ? 'Farklı cinsiyet yan yana olamaz'
                  : rr.genderRule === 'can_sit_adjacent' ? 'Farklı cinsiyet yan yana olabilir'
                  : '—'}
              </RuleSection>
              <RuleSection tone="indigo" icon={<Users className="size-3.5" />} title="Sınıf yerleşimi">
                {rr.classMix === 'cannot_mix' ? 'Aynı şube öğrencileri ayrık tutulur (karışmaz)'
                  : rr.classMix === 'can_mix' ? 'Şubeler aynı salonda karışabilir'
                  : '—'}
                {rr.sameClassAdjacent === 'forbid' && ' · Aynı şube yan yana yasak'}
                {rr.sameClassAdjacent === 'allow' && ' · Aynı şube yan yana serbest'}
                {rr.sameClassSkipOne === 'forbid' && ' · Aynı şube arada bir koltuk boşluğu zorunlu'}
                {rr.sameClassSkipOne === 'allow' && ' · Arada bir koltuk kuralı yok'}
              </RuleSection>
              <RuleSection tone="orange" icon={<SortAsc className="size-3.5" />} title="Öğrenci sırası">
                {rr.studentSortOrder === 'student_number' ? 'Okul numarası'
                  : rr.studentSortOrder === 'alphabetical' ? 'Ad soyad (A→Z)'
                  : rr.studentSortOrder === 'random' ? 'Rastgele'
                  : '—'}
              </RuleSection>
              <RuleSection tone="fuchsia" icon={<Shuffle className="size-3.5" />} title="Ek kısıtlar">
                {(rr.constraints?.length ?? 0) > 0 ? rr.constraints!.join(', ') : 'Tanımlı ek kısıt yok'}
              </RuleSection>
              <RuleSection tone="amber" icon={<Lock className="size-3.5" />} title="Sabit sınıf / öğrenci">
                {(rr.fixedClassIds?.length ?? 0) === 0 && (rr.pinnedStudentIds?.length ?? 0) === 0
                  ? 'Sabit sınıf veya öğrenci yok'
                  : (
                    <>
                      {(rr.fixedClassIds?.length ?? 0) > 0 ? `${rr.fixedClassIds!.length} sabit sınıf` : 'Sabit sınıf yok'}
                      {(rr.pinnedStudentIds?.length ?? 0) > 0
                        ? ` · ${rr.pinnedStudentIds!.length} sabit öğrenci koltuğu`
                        : ''}
                      {(rr.pinnedStudentIds?.length ?? 0) > 0 && (
                        <>
                          {rr.prioritizePinned !== false && ' · Sabitler önce yerleştirilir'}
                          {rr.lockPinnedAssignments !== false
                            ? ' · Yeniden dağıtımda sabit koltuklar korunur'
                            : ' · Yeniden dağıtımda sabitler de yeniden hesaplanabilir'}
                        </>
                      )}
                    </>
                  )}
                {rr.specialNeedsInFront && ' · Özel gereksinimli öğrenciler ön sıralara öncelikli'}
              </RuleSection>
              <RuleSection tone="emerald" icon={<UserCog className="size-3.5" />} title="Gözetmen">
                {rr.proctorMode === 'auto'
                  ? `Otomatik — salon başına ${rr.proctorsPerRoom ?? 2} gözetmen. Çakışan saatte başka sınavda görevli öğretmenler mümkünse atlanır.`
                  : rr.proctorMode === 'manual' ? 'Manuel — gözetmenler Yerleşim ekranından atanır'
                  : '—'}
              </RuleSection>
              {(rr.reportFooterLines?.length ?? 0) > 0 && (
                <RuleSection tone="slate" icon={<ClipboardList className="size-3.5" />} title="Plan açıklaması (rapor)">
                  <ul className="mt-1 space-y-1.5 border-l-2 border-slate-300/80 pl-3 dark:border-zinc-600">
                    {rr.reportFooterLines!.filter(Boolean).map((line, i) => (
                      <li key={i} className="text-sm leading-relaxed text-slate-800 dark:text-zinc-200">{line}</li>
                    ))}
                  </ul>
                </RuleSection>
              )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 bg-white/90 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/95">
              <Button variant="outline" size="sm" asChild className="gap-1 border-violet-200 bg-violet-50/50 text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200">
                <Link href={`/kelebek-sinav/sinav-olustur${schoolQ ? `${schoolQ}&` : '?'}plan_id=${encodeURIComponent(rulesPlan.id)}`} onClick={() => setRulesPlan(null)}>
                  Kuralları düzenle
                </Link>
              </Button>
              <Button variant="default" size="sm" className="bg-gradient-to-r from-violet-600 to-indigo-600 shadow-md hover:from-violet-500 hover:to-indigo-500" onClick={() => setRulesPlan(null)}>Kapat</Button>
            </div>
          </div>
        </div>
        );
      })()}

      {/* Detail Modal */}
      {(detailPlan || detailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950/50">
                  <ClipboardList className="size-4 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{detailPlan?.plan.title ?? 'Sınav Detayları'}</p>
                  <p className="text-xs text-muted-foreground">Sınav özet bilgileri</p>
                </div>
              </div>
              <button onClick={() => setDetailPlan(null)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12"><LoadingSpinner /></div>
            ) : detailPlan ? (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<CalendarDays className="size-4" />} color="blue"
                    label="Sınav Tarihi"
                    value={new Date(detailPlan.plan.examStartsAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })} />
                  <StatCard icon={<ClipboardList className="size-4" />} color="amber"
                    label="Durum"
                    value={detailPlan.plan.status === 'published' ? 'Yayında' : 'Taslak'} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Öğrenci Durumu</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<CheckCircle2 className="size-4" />} color="green"
                    label="Yerleştirilen" value={String(detailPlan.placedCount)} />
                  <StatCard icon={<XCircle className="size-4" />} color="red"
                    label="Yerleştirilemeyen" value={String(detailPlan.unplacedCount)} />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sınav Salon Durumu</p>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<Building2 className="size-4" />} color="purple"
                    label="Salon Sayısı" value={String(detailPlan.roomCount)} />
                  <StatCard icon={<Users className="size-4" />} color="indigo"
                    label="Toplam Kapasite" value={String(detailPlan.totalCapacity)} />
                </div>
                <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-2.5">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-fuchsia-800 dark:text-fuchsia-200">
                    <ScanLine className="size-3.5" />
                    Optik okuma oturumu
                  </p>
                  {optikSessions.length > 0 ? (
                    <ul className="space-y-1">
                      {optikSessions.map((s) => (
                        <li key={s.id}>
                          <Link
                            href={`/optik-oturumlar/${s.id}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            {s.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Link href="/optik-oturumlar" className="text-xs text-primary hover:underline">
                      Oturum oluştur → Bağlantı sekmesinden Kelebek planını seçin
                    </Link>
                  )}
                </div>
                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" onClick={() => setDetailPlan(null)}>Kapat</Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuBtn({
  icon, label, onClick, href, className,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const cls = cn('flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800/70', className);
  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {icon} {label}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick}>
      {icon} {label}
    </button>
  );
}

function RuleBadge({ children, color }: { children: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800/40',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800/40',
    rose: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40',
    violet: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/40',
    slate: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-zinc-800/50 dark:text-zinc-400 dark:border-zinc-700/40',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', colors[color] ?? colors.slate)}>
      {children}
    </span>
  );
}

function SummaryTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: 'amber' | 'sky' | 'violet' | 'emerald';
}) {
  const skin: Record<typeof tone, string> = {
    amber: 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50/80 text-amber-950 shadow-amber-100/50 dark:border-amber-800/40 dark:from-amber-950/35 dark:to-orange-950/20 dark:text-amber-100 dark:shadow-none',
    sky: 'border-sky-200/80 bg-gradient-to-br from-sky-50 to-cyan-50/80 text-sky-950 shadow-sky-100/50 dark:border-sky-800/40 dark:from-sky-950/35 dark:to-cyan-950/20 dark:text-sky-100 dark:shadow-none',
    violet: 'border-violet-200/80 bg-gradient-to-br from-violet-50 to-fuchsia-50/70 text-violet-950 shadow-violet-100/50 dark:border-violet-800/40 dark:from-violet-950/35 dark:to-fuchsia-950/20 dark:text-violet-100 dark:shadow-none',
    emerald: 'border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-teal-50/80 text-emerald-950 shadow-emerald-100/50 dark:border-emerald-800/40 dark:from-emerald-950/35 dark:to-teal-950/20 dark:text-emerald-100 dark:shadow-none',
  };
  const iconRing: Record<typeof tone, string> = {
    amber: 'bg-amber-500/15 text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-200',
    sky: 'bg-sky-500/15 text-sky-700 ring-1 ring-sky-500/25 dark:text-sky-200',
    violet: 'bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/25 dark:text-violet-200',
    emerald: 'bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/25 dark:text-emerald-200',
  };
  return (
    <div className={cn('rounded-2xl border p-3.5 shadow-sm', skin[tone])}>
      <div className="flex items-start gap-3">
        <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', iconRing[tone])}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</p>
          <div className="text-sm font-semibold leading-snug wrap-break-word">{value}</div>
        </div>
      </div>
    </div>
  );
}

function RuleSection({
  icon,
  title,
  children,
  tone = 'slate',
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  tone?: 'violet' | 'sky' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'orange' | 'indigo' | 'fuchsia' | 'slate';
}) {
  const bar: Record<NonNullable<typeof tone>, string> = {
    violet: 'border-l-violet-500 bg-violet-50/40 dark:border-l-violet-400 dark:bg-violet-950/25',
    sky: 'border-l-sky-500 bg-sky-50/40 dark:border-l-sky-400 dark:bg-sky-950/25',
    amber: 'border-l-amber-500 bg-amber-50/40 dark:border-l-amber-400 dark:bg-amber-950/25',
    emerald: 'border-l-emerald-500 bg-emerald-50/35 dark:border-l-emerald-400 dark:bg-emerald-950/25',
    rose: 'border-l-rose-500 bg-rose-50/40 dark:border-l-rose-400 dark:bg-rose-950/25',
    cyan: 'border-l-cyan-500 bg-cyan-50/40 dark:border-l-cyan-400 dark:bg-cyan-950/25',
    orange: 'border-l-orange-500 bg-orange-50/40 dark:border-l-orange-400 dark:bg-orange-950/25',
    indigo: 'border-l-indigo-500 bg-indigo-50/40 dark:border-l-indigo-400 dark:bg-indigo-950/25',
    fuchsia: 'border-l-fuchsia-500 bg-fuchsia-50/35 dark:border-l-fuchsia-400 dark:bg-fuchsia-950/25',
    slate: 'border-l-slate-400 bg-slate-50/70 dark:border-l-zinc-500 dark:bg-zinc-800/40',
  };
  const iconWrap: Record<NonNullable<typeof tone>, string> = {
    violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200',
    sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-200',
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-200',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-200',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-200',
    indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-200',
    fuchsia: 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/60 dark:text-fuchsia-200',
    slate: 'bg-slate-200 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300',
  };
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-white/60 py-3 pl-1 pr-3 shadow-sm backdrop-blur-sm dark:border-zinc-700/50',
        bar[tone],
      )}
    >
      <div className={cn('ml-2 flex size-9 shrink-0 items-center justify-center rounded-xl', iconWrap[tone])}>{icon}</div>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">{title}</p>
        <div className="mt-1 text-sm font-medium leading-relaxed text-slate-900 dark:text-zinc-100">{children}</div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'indigo';
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    red: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-300',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300',
  };
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 dark:border-zinc-800/60 dark:bg-zinc-800/40">
      <div className={cn('mb-1.5 inline-flex rounded-md p-1.5', colors[color])}>{icon}</div>
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
