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
  Lock, UserCog, Upload, FileUp, EyeOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type PlanRules = {
  subjectLabel?: string;
  lessonPeriodLabel?: string;
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
  specialNeedsInFront?: boolean;
  proctorMode?: 'auto' | 'manual';
  proctorsPerRoom?: number;
  fixedClassIds?: string[];
  pinnedStudentIds?: string[];
  reportFooterLines?: string[];
  roomIds?: string[];
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
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [detailPlan, setDetailPlan] = useState<PlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rulesPlan, setRulesPlan] = useState<Plan | null>(null);
  const [generateResult, setGenerateResult] = useState<{
    planId: string; planTitle: string;
    placed: number; unplaced: number; rooms: number;
    violations: { adjacent: number; skipOne: number };
  } | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [uploadPlan, setUploadPlan] = useState<Plan | null>(null);
  const [uploadFiles, setUploadFiles] = useState<Record<string, File>>({});
  const [uploadKey, setUploadKey] = useState<'all' | string>('all');
  const [uploading, setUploading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const list = await apiFetch<Plan[]>(`/butterfly-exam/plans${schoolQ}`, { token });
      setPlans(list);
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
        violations: { adjacent: number; skipOne: number };
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
        violations: data.violations ?? { adjacent: 0, skipOne: 0 },
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
    try {
      const d = await apiFetch<PlanDetail>(`/butterfly-exam/plans/${id}/detail${schoolQ}`, { token: token! });
      setDetailPlan(d);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Sınav İşlemleri</h2>
        {isAdmin && (
          <Button asChild size="sm" className="gap-1.5">
            <Link href={`/kelebek-sinav/sinav-olustur${schoolQ}`}>
              <Plus className="size-4" /> Yeni Sınav
            </Link>
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 py-12 text-center">
          <ClipboardList className="mx-auto size-10 text-slate-400 mb-3" />
          <p className="text-sm text-muted-foreground">Henüz sınav bulunamadı.</p>
          {isAdmin && (
            <Button asChild size="sm" variant="outline" className="mt-4 gap-1.5">
              <Link href={`/kelebek-sinav/sinav-olustur${schoolQ}`}>
                <Plus className="size-4" /> Yeni Sınav Oluştur
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3" ref={menuRef}>
          {plans.map((p) => (
            <div key={p.id} className="relative overflow-visible rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/60">
              <div className="flex items-start gap-3 px-4 py-3">
                <div
                  className={cn('mt-0.5 size-2.5 shrink-0 rounded-full', p.status === 'published' ? 'bg-emerald-500' : 'bg-amber-400')}
                />
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold truncate">{p.title}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', statusColor(p.status))}>
                        {statusLabel(p.status)}
                      </span>
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
                      {p.rules?.prioritizePinned && <RuleBadge color="rose">Sabit önce</RuleBadge>}
                      {p.rules?.fillDirection && p.rules.fillDirection !== 'ltr' && (
                        <RuleBadge color="slate">{p.rules.fillDirection === 'rtl' ? 'Sağdan doldur' : 'Alternatif'}</RuleBadge>
                      )}
                      {(p.rules?.fixedClassIds?.length ?? 0) > 0 && (
                        <RuleBadge color="amber">{p.rules.fixedClassIds!.length} sabit sınıf</RuleBadge>
                      )}
                    </div>
                  </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
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
                      <div className="absolute right-0 top-8 z-50 min-w-[190px] rounded-xl border border-white/60 bg-white/95 py-1 shadow-lg dark:border-zinc-700/60 dark:bg-zinc-900/95">
                        <MenuBtn icon={<Search className="size-3.5" />} label="Öğrenci Ara"
                          onClick={() => { setMenuOpenId(null); }}
                          href={`/kelebek-sinav/sinif-ogrenci${schoolQ}`} />
                        <MenuBtn icon={<Eye className="size-3.5" />} label="Detay" onClick={() => void openDetail(p.id)} />
                        {isAdmin && (
                          <>
                            <MenuBtn icon={<Wand2 className="size-3.5" />} label="Sınavı Düzenle"
                              onClick={() => { setMenuOpenId(null); }}
                              href={`/kelebek-sinav/sinav-olustur${schoolQ ? schoolQ + '&plan_id=' + p.id : '?plan_id=' + p.id}`} />
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
              generateResult.unplaced === 0 && generateResult.violations.adjacent === 0 && generateResult.violations.skipOne === 0
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
              {(generateResult.violations.adjacent > 0 || generateResult.violations.skipOne > 0) ? (
                <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                  <p className="mb-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300">Kural İhlalleri</p>
                  <div className="space-y-1">
                    {generateResult.violations.adjacent > 0 && (
                      <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
                        <span>Yan yana aynı sınıf</span>
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 font-bold tabular-nums dark:bg-amber-800/60">
                          {generateResult.violations.adjacent}
                        </span>
                      </div>
                    )}
                    {generateResult.violations.skipOne > 0 && (
                      <div className="flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
                        <span>Arada bir aynı sınıf</span>
                        <span className="rounded-full bg-amber-200 px-2 py-0.5 font-bold tabular-nums dark:bg-amber-800/60">
                          {generateResult.violations.skipOne}
                        </span>
                      </div>
                    )}
                  </div>
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
      {rulesPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-violet-100 p-2 dark:bg-violet-950/50">
                  <Settings2 className="size-4 text-violet-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{rulesPlan.title}</p>
                  <p className="text-xs text-muted-foreground">Dağıtım Kuralları</p>
                </div>
              </div>
              <button onClick={() => setRulesPlan(null)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              <RuleSection icon={<LayoutGrid className="size-3.5" />} title="Dolum Modu">
                {rulesPlan.rules?.fillMode === 'balanced' ? 'Dengeli Dağıtım' : rulesPlan.rules?.fillMode === 'sequential' ? 'Dolduran Dağıtım' : '—'}
              </RuleSection>
              <RuleSection icon={<ArrowLeftRight className="size-3.5" />} title="Salon Dolum Yönü">
                {rulesPlan.rules?.fillDirection === 'ltr' ? 'Soldan sağa' : rulesPlan.rules?.fillDirection === 'rtl' ? 'Sağdan sola' : rulesPlan.rules?.fillDirection === 'alternating' ? 'Alternatif' : '—'}
              </RuleSection>
              <RuleSection icon={<ShieldCheck className="size-3.5" />} title="Cinsiyet Kuralı">
                {rulesPlan.rules?.genderRule === 'cannot_sit_adjacent' ? 'Farklı cinsiyetler yan yana oturamaz'
                  : rulesPlan.rules?.genderRule === 'can_sit_adjacent' ? 'Farklı cinsiyetler yan yana oturabilir' : '—'}
              </RuleSection>
              <RuleSection icon={<Users className="size-3.5" />} title="Sınıf Karışma Kuralı">
                {rulesPlan.rules?.classMix === 'cannot_mix' ? 'Aynı sınıf öğrencileri karışamaz'
                  : rulesPlan.rules?.classMix === 'can_mix' ? 'Sınıflar karışabilir' : '—'}
                {rulesPlan.rules?.sameClassAdjacent === 'forbid' && ' · Aynı sınıf yan yana yasak'}
                {rulesPlan.rules?.sameClassSkipOne === 'forbid' && ' · Arada bir boşluk zorunlu'}
              </RuleSection>
              <RuleSection icon={<SortAsc className="size-3.5" />} title="Öğrenci Sıralama">
                {rulesPlan.rules?.studentSortOrder === 'student_number' ? 'Öğrenci numarasına göre'
                  : rulesPlan.rules?.studentSortOrder === 'alphabetical' ? 'Alfabetik'
                  : rulesPlan.rules?.studentSortOrder === 'random' ? 'Rastgele' : '—'}
              </RuleSection>
              <RuleSection icon={<Shuffle className="size-3.5" />} title="Kısıtlar">
                {(rulesPlan.rules?.constraints?.length ?? 0) > 0
                  ? rulesPlan.rules.constraints!.join(', ')
                  : 'Kısıt yok'}
              </RuleSection>
              <RuleSection icon={<Lock className="size-3.5" />} title="Sabit Sınıflar / Öğrenciler">
                {(rulesPlan.rules?.fixedClassIds?.length ?? 0) > 0 && `${rulesPlan.rules.fixedClassIds!.length} sabit sınıf`}
                {(rulesPlan.rules?.pinnedStudentIds?.length ?? 0) > 0 && ` · ${rulesPlan.rules.pinnedStudentIds!.length} sabit öğrenci`}
                {!(rulesPlan.rules?.fixedClassIds?.length) && !(rulesPlan.rules?.pinnedStudentIds?.length) && '—'}
                {rulesPlan.rules?.prioritizePinned && ' · Sabit öğrenciler önce yerleştirilir'}
                {rulesPlan.rules?.specialNeedsInFront && ' · Özel ihtiyaçlı öğrenciler ön sıraya'}
              </RuleSection>
              <RuleSection icon={<UserCog className="size-3.5" />} title="Gözetmen Ayarları">
                {rulesPlan.rules?.proctorMode === 'auto'
                  ? `Otomatik atama — salon başına ${rulesPlan.rules.proctorsPerRoom ?? 2} gözetmen`
                  : rulesPlan.rules?.proctorMode === 'manual' ? 'Manuel atama' : '—'}
              </RuleSection>
              {(rulesPlan.rules?.reportFooterLines?.length ?? 0) > 0 && (
                <RuleSection icon={<ClipboardList className="size-3.5" />} title="Rapor Alt Yazısı">
                  {rulesPlan.rules.reportFooterLines!.join(' / ')}
                </RuleSection>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <Button variant="outline" size="sm" onClick={() => setRulesPlan(null)}>Kapat</Button>
            </div>
          </div>
        </div>
      )}

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

function RuleSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5 dark:border-zinc-800/60 dark:bg-zinc-800/30">
      <div className="mt-0.5 shrink-0 text-slate-400 dark:text-zinc-500">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">{title}</p>
        <p className="text-sm text-foreground">{children}</p>
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
