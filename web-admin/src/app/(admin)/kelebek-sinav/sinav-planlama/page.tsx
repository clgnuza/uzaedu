'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {
  Plus, MoreVertical, Trash2, Edit2, X, ClipboardList,
  BookOpen, CalendarDays, BarChart2, ArrowRight, CalendarRange,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayDateInput() {
  return toDateInputValue(new Date().toISOString());
}

/** Yeni dönem planı açılırken Plan Açıklaması alanına gelen varsayılan maddeler (düzenlenebilir). */
const DEFAULT_PERIOD_PLAN_DESCRIPTION_BULLETS = [
  'Öğrenciler sınav saatinden en az 15 dakika önce sınav salonunda hazır bulunmalıdır.',
  'Sınava yalnızca kurşun kalem, silgi ve müfredatta izin verilen araç-gereçler getirilebilir.',
  'Sınav süresince cep telefonu, akıllı saat ve kablosuz iletişim cihazı bulundurulamaz.',
  'Sınav programı ve olası değişiklikler okul idaresi tarafından duyurulur; veliler bilgilendirilir.',
] as const;

type Plan = {
  id: string;
  title: string;
  description: string | null;
  examStartsAt: string;
  examEndsAt: string | null;
  status: string;
  rules: Record<string, unknown>;
};

export default function SinavTakvimPage() {
  const { token, me, role } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isTeacher = role === 'teacher';
  const isAdmin =
    role === 'school_admin' || role === 'superadmin' || role === 'moderator';

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sessionCountByParent, setSessionCountByParent] = useState<Record<string, number>>({});
  const [orphanSessionCount, setOrphanSessionCount] = useState(0);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planBullets, setPlanBullets] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Edit dialog
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  // Report
  const [reportModal, setReportModal] = useState<{ plan: Plan; type: 'genel' | 'sinif' | 'sube' } | null>(null);
  const [reportGrade, setReportGrade] = useState(9);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBullets, setEditBullets] = useState<string[]>([]);
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndDate, setEditEndDate] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const all = await apiFetch<Plan[]>(`/butterfly-exam/plans${schoolQ}`, { token });
      let periods = all
        .filter((p) => (p.rules as Record<string, unknown>)?.planType === 'period')
        .sort((a, b) => new Date(a.examStartsAt).getTime() - new Date(b.examStartsAt).getTime());
      if (isTeacher) periods = periods.filter((p) => p.status === 'published');
      setPlans(periods);
      const countMap: Record<string, number> = {};
      let orphans = 0;
      for (const p of all) {
        const r = (p.rules ?? {}) as Record<string, unknown>;
        if (r.planType === 'period') continue;
        const parent = typeof r.parentPlanId === 'string' ? r.parentPlanId : null;
        if (parent) countMap[parent] = (countMap[parent] ?? 0) + 1;
        else orphans += 1;
      }
      setSessionCountByParent(countMap);
      setOrphanSessionCount(orphans);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ, isTeacher]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const createPlan = async () => {
    if (!token || !planName.trim()) return;
    setCreating(true);
    try {
      const bullets = planBullets.filter(Boolean);
      const startIso = new Date(`${todayDateInput()}T09:00:00`).toISOString();
      await apiFetch(`/butterfly-exam/plans${schoolQ}`, {
        method: 'POST', token,
        body: JSON.stringify({
          title: planName.trim(),
          exam_starts_at: startIso,
          description: bullets.join('\n'),
          rules: {
            planType: 'period',
            reportFooterLines: bullets,
          },
        }),
      });
      toast.success('Plan oluşturuldu');
      setShowCreate(false);
      setPlanName('');
      setPlanBullets([]);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Oluşturulamadı');
    } finally {
      setCreating(false);
    }
  };

  const savePlan = async () => {
    if (!token || !editPlan || !editName.trim() || !editStartDate) return;
    setSaving(true);
    try {
      const bullets = editBullets.filter(Boolean);
      const startIso = new Date(`${editStartDate}T${editStartTime || '09:00'}:00`).toISOString();
      const endIso =
        editEndDate.trim() !== ''
          ? new Date(`${editEndDate.trim()}T23:59:59`).toISOString()
          : null;
      await apiFetch(`/butterfly-exam/plans/${editPlan.id}${schoolQ}`, {
        method: 'PATCH', token,
        body: JSON.stringify({
          title: editName.trim(),
          description: bullets.join('\n'),
          exam_starts_at: startIso,
          exam_ends_at: endIso,
          rules: { reportFooterLines: bullets },
        }),
      });
      toast.success('Güncellendi');
      setEditPlan(null);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  const downloadReport = async (periodPlan: Plan, type: 'genel' | 'sinif', grade?: number) => {
    if (!token) return;
    setPdfLoading(true);
    try {
      // Get child exam plans for this period
      const all = await apiFetch<Plan[]>(`/butterfly-exam/plans${schoolQ}`, { token });
      const children = all.filter((p) => (p.rules as Record<string, unknown>)?.parentPlanId === periodPlan.id);
      if (children.length === 0) {
        toast.error('Bu dönem planına bağlı sınav oturumu yok. Önce Sınav İşlemleri’nden oturum oluşturup bu plana bağlayın.');
        return;
      }
      const planIds = children.map((p) => p.id);

      const raw = periodPlan.rules as Record<string, string>;
      const qs = new URLSearchParams();
      qs.set('plan_ids', planIds.join(','));
      qs.set('type', type);
      if (type === 'sinif' && grade) qs.set('grade', String(grade));
      if (raw.cityLine) qs.set('city_line', raw.cityLine);
      if (raw.academicYear) qs.set('academic_year', raw.academicYear);
      if (raw.duzenleyenName) { qs.set('duzenleyen_name', raw.duzenleyenName); qs.set('duzenleyen_title', raw.duzenleyenTitle ?? ''); }
      if (raw.onaylayanName) { qs.set('onaylayan_name', raw.onaylayanName); qs.set('onaylayan_title', raw.onaylayanTitle ?? ''); }
      const sid = searchParams.get('school_id');
      if ((me?.role === 'superadmin' || me?.role === 'moderator') && sid) qs.set('school_id', sid);

      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(`/butterfly-exam/pdf/takvim?${qs}`), { credentials: 'include', headers });
      if (!res.ok) throw new Error('PDF alınamadı');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const label = type === 'sinif' ? `${grade}-sinif` : 'genel';
      const a = Object.assign(document.createElement('a'), { href: url, download: `sinav-takvimi-${label}.pdf` });
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Rapor indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi');
    } finally {
      setPdfLoading(false);
      setReportModal(null);
    }
  };

  const deletePlan = async (id: string, title: string) => {
    if (!token || !confirm(`"${title}" planını silmek istiyor musunuz?`)) return;
    try {
      await apiFetch(`/butterfly-exam/plans/${id}${schoolQ}`, { method: 'DELETE', token });
      toast.success('Silindi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    }
    setMenuOpenId(null);
  };

  const openEdit = (p: Plan) => {
    setMenuOpenId(null);
    setEditPlan(p);
    setEditName(p.title);
    setEditStartDate(toDateInputValue(p.examStartsAt));
    setEditStartTime(toTimeInputValue(p.examStartsAt));
    setEditEndDate(p.examEndsAt ? toDateInputValue(p.examEndsAt) : '');
    const r = p.rules as Record<string, unknown>;
    const lines = Array.isArray(r?.reportFooterLines)
      ? (r.reportFooterLines as string[]).filter(Boolean)
      : p.description?.split('\n').filter(Boolean) ?? [];
    setEditBullets(lines.length ? lines : []);
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const openCreateDialog = () => {
    setPlanName('');
    setPlanBullets([...DEFAULT_PERIOD_PLAN_DESCRIPTION_BULLETS]);
    setShowCreate(true);
  };

  return (
    <div className="min-w-0 space-y-4">
      {isAdmin && (
        <div className="rounded-2xl border border-teal-200/50 bg-gradient-to-br from-teal-500/[0.08] via-white/80 to-emerald-500/[0.06] p-3 shadow-sm dark:border-teal-900/35 dark:from-teal-950/30 dark:via-zinc-900/50 dark:to-emerald-950/20 sm:p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-teal-800/90 dark:text-teal-200/90">
            Önerilen akış
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-600 px-2.5 py-1 font-semibold text-white shadow-md shadow-teal-500/25">
                <CalendarDays className="size-3.5 shrink-0" />
                1. Dönem takvimi (buradasınız)
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground max-sm:hidden" />
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-medium text-teal-950 shadow-sm ring-1 ring-teal-500/15 dark:bg-zinc-900/80 dark:text-teal-100 dark:ring-teal-400/20">
                <CalendarRange className="size-3.5 shrink-0" />
                2. Sınav oturumları
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground max-sm:hidden" />
              <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 font-medium text-teal-950 shadow-sm ring-1 ring-teal-500/15 dark:bg-zinc-900/80 dark:text-teal-100 dark:ring-teal-400/20">
                <BookOpen className="size-3.5 shrink-0" />
                3. Yerleştirme ve PDF
              </span>
            </div>
            <Button asChild size="sm" variant="outline" className="h-8 w-full gap-1 text-xs sm:ml-auto sm:w-auto sm:text-sm">
              <Link href={`/kelebek-sinav/sinav-islemleri${schoolQ}`}>Oturumlara geç</Link>
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
            Bu sayfada dönem planı <strong className="text-foreground">adı</strong> ve raporlarda kullanılacak <strong className="text-foreground">açıklama maddeleri</strong> tutulur.
            Kesin sınav gün ve saatleri <strong className="text-foreground">Sınav İşlemleri</strong> oturumlarıyla belirlenir.
          </p>
        </div>
      )}

      {isAdmin && orphanSessionCount > 0 && (
        <Alert variant="warning" className="rounded-xl text-[13px] leading-relaxed">
          <strong className="text-foreground">{orphanSessionCount} bağımsız sınav oturumu</strong> bulundu; hiçbir dönem planına bağlı değil.
          Bu oturumlar bu sayfadaki dönem planı raporlarına dahil edilmez.{' '}
          <Link href={`/kelebek-sinav/sinav-islemleri${schoolQ}`} className="font-semibold text-amber-700 underline-offset-2 hover:underline dark:text-amber-300">
            Sınav İşlemleri
          </Link>
          {' '}üzerinden ilgili oturumları açıp <em>Sınavı Düzenle</em> ile bir dönem planına bağlayabilirsiniz.
        </Alert>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold sm:text-base">Sınav takvimi</h2>
          <p className="text-xs text-muted-foreground">
            {isTeacher
              ? 'Okul yönetiminin yayınladığı sınav takvimi ve duyuru maddeleri.'
              : 'Dönem planı adı ve rapor/duyuru maddeleri; oturum tarihleri Sınav İşlemleri’nde.'}
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" className="w-full gap-1.5 sm:w-auto" onClick={openCreateDialog}>
            <Plus className="size-4" /> Yeni dönem planı
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700">
          <ClipboardList className="mx-auto size-12 text-slate-400 mb-3" />
          <p className="text-sm font-medium">
            {isTeacher ? 'Yayınlanmış sınav takvimi henüz yok.' : 'Henüz dönem planı yok.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto px-2">
            {isTeacher
              ? 'Okul yönetimi takvimi yayınladığında burada görüntülenir.'
              : 'Önce burada dönem planını oluşturun; ardından Sınav İşlemleri üzerinden her gün için oturum ekleyin. Eski kayıtlar yalnızca oturum listesinde görünüyorsa burada yeni bir dönem planı tanımlayın.'}
          </p>
          {isAdmin && (
            <>
              <Button size="sm" className="mt-4" onClick={openCreateDialog}>
                <Plus className="size-4 mr-1.5" /> Dönem planı oluştur
              </Button>
              <div className="mt-4">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/kelebek-sinav/sinav-islemleri${schoolQ}`}>Doğrudan oturum listesine git</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3" ref={menuRef}>
          {plans.map((p) => {
            const bullets = Array.isArray((p.rules as Record<string, unknown>)?.reportFooterLines)
              ? ((p.rules as Record<string, unknown>).reportFooterLines as string[]).filter(Boolean)
              : p.description?.split('\n').filter(Boolean) ?? [];
            return (
              <div key={p.id}
                className="rounded-2xl border border-white/60 bg-white/80 shadow-sm dark:border-indigo-900/40 dark:bg-zinc-900/60">
                <div className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:gap-3 sm:px-4 sm:py-4">
                  <div className="flex min-w-0 flex-1 gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/50">
                    <ClipboardList className="size-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{p.title}</p>
                    {bullets.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                        {bullets.slice(0, 3).map((b, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="mt-0.5 shrink-0 text-indigo-400">-</span>
                            {b}
                          </li>
                        ))}
                        {bullets.length > 3 && <li className="text-muted-foreground/70">+ {bullets.length - 3} madde daha...</li>}
                      </ul>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {new Date(p.examStartsAt).toLocaleString('tr-TR', {
                          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                      {p.examEndsAt && (
                        <span className="text-muted-foreground/80">
                          → {new Date(p.examEndsAt).toLocaleDateString('tr-TR')} bitiş
                        </span>
                      )}
                      {!isTeacher && (
                        <>
                          <span className={cn('rounded-full px-2 py-0.5 font-medium',
                            p.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300')}>
                            {p.status === 'published' ? 'Aktif' : 'Taslak'}
                          </span>
                          <Link
                            href={`/kelebek-sinav/sinav-islemleri${schoolQ}`}
                            className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-300">
                            <CalendarRange className="size-3" />
                            {sessionCountByParent[p.id] ?? 0} oturum
                          </Link>
                        </>
                      )}
                    </div>
                  </div>
                  </div>

                  {/* Menu */}
                  {isAdmin && (
                    <div className="relative flex w-full shrink-0 justify-end sm:ml-auto sm:w-auto">
                      <Button variant="ghost" size="icon" className="size-8"
                        onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}>
                        <MoreVertical className="size-4" />
                      </Button>
                      {menuOpenId === p.id && (
                        <div className="absolute left-0 right-0 top-9 z-50 min-w-0 rounded-xl border border-white/60 bg-white/95 py-1 shadow-lg dark:border-zinc-700/60 dark:bg-zinc-900/95 sm:left-auto sm:right-0 sm:min-w-[200px]">
                          <MenuBtn icon={<Edit2 className="size-3.5" />} label="Plan Düzenle" onClick={() => openEdit(p)} />
                          <MenuBtn icon={<CalendarRange className="size-3.5" />} label="Oturum listesi"
                            href={`/kelebek-sinav/sinav-islemleri${schoolQ}`} onClick={() => setMenuOpenId(null)} />
                          <MenuBtn icon={<Plus className="size-3.5" />} label="Yeni sınav oturumu"
                            href={`/kelebek-sinav/sinav-olustur${schoolQ}`} onClick={() => setMenuOpenId(null)} />
                          <div className="my-1 border-t border-slate-200 dark:border-zinc-700" />
                          <MenuBtn icon={<BarChart2 className="size-3.5" />} label="Okul Bazlı Rapor"
                            onClick={() => { setMenuOpenId(null); void downloadReport(p, 'genel'); }} />
                          <MenuBtn icon={<BarChart2 className="size-3.5" />} label="Sınıf Bazlı Rapor"
                            onClick={() => { setMenuOpenId(null); setReportModal({ plan: p, type: 'sinif' }); setReportGrade(9); }} />
                          <MenuBtn icon={<BarChart2 className="size-3.5" />} label="Ders Bazlı Rapor"
                            href={`/kelebek-sinav/ayarlar${schoolQ}`} onClick={() => setMenuOpenId(null)} />
                          <div className="my-1 border-t border-slate-200 dark:border-zinc-700" />
                          <MenuBtn icon={<Trash2 className="size-3.5 text-rose-500" />} label="Sil"
                            className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            onClick={() => void deletePlan(p.id, p.title)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-200/70 px-3 pb-3 pt-2.5 dark:border-zinc-800/70 sm:px-4">
                    <Button asChild variant="secondary" size="sm" className="h-8 gap-1 text-xs">
                      <Link href={`/kelebek-sinav/sinav-islemleri${schoolQ}`}>Oturum listesine geç</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-8 gap-1 text-xs">
                      <Link href={`/kelebek-sinav/sinav-olustur${schoolQ}`}>
                        <Plus className="size-3.5" /> Yeni oturum
                      </Link>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950/50">
                  <Plus className="size-4 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Yeni Plan Oluştur</p>
                  <p className="text-xs text-muted-foreground">Plan adı ve açıklama maddeleri (rapor / duyuru)</p>
                </div>
              </div>
              <button onClick={() => setShowCreate(false)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold">Plan Adı</p>
                <Input
                  placeholder="Örn. I. Dönem I. Ortak Sınav"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="bg-white dark:bg-zinc-900"
                  onKeyDown={(e) => e.key === 'Enter' && void createPlan()}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Plan adını girdikten sonra devam ekleyebilirsiniz</p>
              </div>
              <Alert variant="info" className="rounded-xl text-[13px] leading-relaxed">
                <strong className="text-foreground">Cetvel tarihi burada seçilmez.</strong>{' '}
                Gerçek sınav gün ve saatleri <strong className="text-foreground">Sınav İşlemleri</strong> üzerinden oturum ekleyerek oluşturulur.
                Aşağıdaki maddeler PDF ve duyuru metinlerinde alt bilgi olarak kullanılır; istediğiniz gibi düzenleyebilirsiniz.
              </Alert>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold">Plan Açıklaması</p>
                  <Button type="button" variant="outline" size="sm" className="h-6 gap-1 text-xs"
                    onClick={() => setPlanBullets((b) => [...b, ''])}>
                    + Yeni Madde Ekle
                  </Button>
                </div>
                <div className="max-h-48 space-y-1.5 overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/30">
                  {planBullets.length === 0 && (
                    <p className="py-3 text-center text-xs text-muted-foreground">Madde eklemek için yukarıdaki butonu kullanın</p>
                  )}
                  {planBullets.map((b, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{i + 1}</span>
                      <Input value={b}
                        onChange={(e) => setPlanBullets((bl) => bl.map((l, j) => j === i ? e.target.value : l))}
                        placeholder={`Madde ${i + 1}`}
                        className="flex-1 h-8 text-xs bg-white dark:bg-zinc-900" />
                      <button type="button"
                        onClick={() => setPlanBullets((bl) => bl.filter((_, j) => j !== i))}
                        className="rounded p-1 text-rose-500 hover:bg-rose-50">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Her madde raporun altında bir satır olarak görüntülenecektir. Boş maddeler otomatik olarak kaldırılır.</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>İptal</Button>
              <Button size="sm" disabled={!planName.trim() || creating}
                onClick={() => void createPlan()} className="gap-1.5">
                {creating ? <LoadingSpinner /> : <><Plus className="size-3.5" /> Oluştur</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950/50">
                  <Edit2 className="size-4 text-indigo-600" />
                </div>
                <p className="font-semibold text-sm">Plan Düzenle</p>
              </div>
              <button onClick={() => setEditPlan(null)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold">Plan Adı</p>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="bg-white dark:bg-zinc-900" />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Başlangıç tarihi</p>
                  <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
                    className="bg-white dark:bg-zinc-900" />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-semibold">Başlangıç saati</p>
                  <Input type="time" value={editStartTime} onChange={(e) => setEditStartTime(e.target.value)}
                    className="bg-white dark:bg-zinc-900" />
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold">Bitiş tarihi (isteğe bağlı)</p>
                <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)}
                  className="bg-white dark:bg-zinc-900" />
                <p className="mt-1 text-[11px] text-muted-foreground">Boş bırakılırsa bitiş kaydı silinir.</p>
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold">Plan Açıklaması</p>
                  <Button type="button" variant="outline" size="sm" className="h-6 gap-1 text-xs"
                    onClick={() => setEditBullets((b) => [...b, ''])}>
                    + Yeni Madde Ekle
                  </Button>
                </div>
                <div className="max-h-48 space-y-1.5 overflow-auto rounded-xl border border-slate-200 bg-slate-50/50 p-2 dark:border-zinc-700 dark:bg-zinc-800/30">
                  {editBullets.length === 0 && <p className="py-3 text-center text-xs text-muted-foreground">Henüz madde yok.</p>}
                  {editBullets.map((b, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">{i + 1}</span>
                      <Input value={b}
                        onChange={(e) => setEditBullets((bl) => bl.map((l, j) => j === i ? e.target.value : l))}
                        className="flex-1 h-8 text-xs bg-white dark:bg-zinc-900" />
                      <button type="button"
                        onClick={() => setEditBullets((bl) => bl.filter((_, j) => j !== i))}
                        className="rounded p-1 text-rose-500 hover:bg-rose-50">
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <Button variant="ghost" size="sm" onClick={() => setEditPlan(null)}>İptal</Button>
              <Button size="sm" disabled={!editName.trim() || !editStartDate || saving}
                onClick={() => void savePlan()} className="gap-1.5">
                {saving ? <LoadingSpinner /> : '💾 Güncelle'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sınıf Bazlı Rapor Modal */}
      {reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xs rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div>
                <p className="font-semibold text-sm">Sınıf Bazlı Rapor</p>
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">{reportModal.plan.title}</p>
              </div>
              <button onClick={() => setReportModal(null)} className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-muted-foreground">Hangi sınıf düzeyi için rapor oluşturulsun?</p>
              <div className="grid grid-cols-2 gap-2">
                {[9, 10, 11, 12].map((g) => (
                  <button key={g} type="button"
                    onClick={() => setReportGrade(g)}
                    className={cn(
                      'rounded-xl border py-2.5 text-sm font-semibold transition',
                      reportGrade === g
                        ? 'border-indigo-500 bg-indigo-600 text-white'
                        : 'border-slate-200 text-muted-foreground hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800'
                    )}>
                    {g}. Sınıflar
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 border-t border-slate-100 px-5 py-3 dark:border-zinc-800">
              <Button variant="outline" size="sm" className="flex-1" onClick={() => setReportModal(null)}>İptal</Button>
              <Button size="sm" className="flex-1 gap-1.5" disabled={pdfLoading}
                onClick={() => void downloadReport(reportModal.plan, 'sinif', reportGrade)}>
                {pdfLoading ? <LoadingSpinner /> : <><BarChart2 className="size-3.5" /> PDF İndir</>}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PDF loading overlay */}
      {pdfLoading && !reportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white px-6 py-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <LoadingSpinner />
            <p className="text-sm font-medium">Rapor hazırlanıyor…</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuBtn({ icon, label, onClick, href, className }: {
  icon: React.ReactNode; label: string; onClick?: () => void; href?: string; className?: string;
}) {
  const cls = cn('flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-zinc-800/70', className);
  if (href) return <Link href={href} className={cls} onClick={onClick}>{icon} {label}</Link>;
  return <button type="button" className={cls} onClick={onClick}>{icon} {label}</button>;
}
