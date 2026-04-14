'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {
  Plus, MoreVertical, Trash2, Eye, Edit2, X, ClipboardList,
  BookOpen, CalendarDays, BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

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
  const { token, me } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';

  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
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
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const all = await apiFetch<Plan[]>(`/butterfly-exam/plans${schoolQ}`, { token });
      // Show only period plans (planType === 'period') or all when no planType set yet
      const periods = all.filter((p) => {
        const r = p.rules as Record<string, unknown>;
        return r?.planType === 'period' || !r?.planType;
      });
      setPlans(periods);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ]);

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
      await apiFetch(`/butterfly-exam/plans${schoolQ}`, {
        method: 'POST', token,
        body: JSON.stringify({
          title: planName.trim(),
          exam_starts_at: new Date().toISOString(),
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
    if (!token || !editPlan || !editName.trim()) return;
    setSaving(true);
    try {
      const bullets = editBullets.filter(Boolean);
      await apiFetch(`/butterfly-exam/plans/${editPlan.id}${schoolQ}`, {
        method: 'PATCH', token,
        body: JSON.stringify({
          title: editName.trim(),
          description: bullets.join('\n'),
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
      const planIds = children.length > 0 ? children.map((p) => p.id) : [periodPlan.id];

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
    const r = p.rules as Record<string, unknown>;
    const lines = Array.isArray(r?.reportFooterLines)
      ? (r.reportFooterLines as string[]).filter(Boolean)
      : p.description?.split('\n').filter(Boolean) ?? [];
    setEditBullets(lines.length ? lines : []);
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">Sınav Takvimi</h2>
          <p className="text-xs text-muted-foreground">Sınav takviminizi oluşturun, yönetin ve gerçek sınavlara dönüştürün.</p>
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus className="size-4" /> Yeni Plan
          </Button>
        )}
      </div>

      {plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-14 text-center dark:border-slate-700">
          <ClipboardList className="mx-auto size-12 text-slate-400 mb-3" />
          <p className="text-sm font-medium">Henüz plan bulunmamaktadır.</p>
          <p className="text-xs text-muted-foreground mt-1">Yeni plan oluşturmak için yukarıdaki butonu kullanın.</p>
          {isAdmin && (
            <Button size="sm" className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="size-4 mr-1.5" /> Yeni Plan Oluştur
            </Button>
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
                <div className="flex items-start gap-3 px-4 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950/50">
                    <ClipboardList className="size-4 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
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
                      <span className="flex items-center gap-1"><CalendarDays className="size-3" />{new Date(p.examStartsAt).toLocaleDateString('tr-TR')}</span>
                      <span className={cn('rounded-full px-2 py-0.5 font-medium',
                        p.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300')}>
                        {p.status === 'published' ? 'Aktif' : 'Taslak'}
                      </span>
                    </div>
                  </div>

                  {/* Menu */}
                  {isAdmin && (
                    <div className="relative shrink-0">
                      <Button variant="ghost" size="icon" className="size-8"
                        onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}>
                        <MoreVertical className="size-4" />
                      </Button>
                      {menuOpenId === p.id && (
                        <div className="absolute right-0 top-9 z-50 min-w-[200px] rounded-xl border border-white/60 bg-white/95 py-1 shadow-lg dark:border-zinc-700/60 dark:bg-zinc-900/95">
                          <MenuBtn icon={<Edit2 className="size-3.5" />} label="Plan Düzenle" onClick={() => openEdit(p)} />
                          <MenuBtn icon={<BookOpen className="size-3.5" />} label="Sınav Takvimini Görüntüle"
                            href={`/kelebek-sinav/sinav-islemleri${schoolQ}`} onClick={() => setMenuOpenId(null)} />
                          <MenuBtn icon={<Plus className="size-3.5" />} label="Sınav Ekle"
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
                  {!isAdmin && (
                    <Button asChild variant="ghost" size="icon" className="size-8">
                      <Link href={`/kelebek-sinav/sinav-islemleri${schoolQ}`}><Eye className="size-4" /></Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/60 bg-white shadow-2xl dark:border-zinc-700/60 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-100 p-2 dark:bg-indigo-950/50">
                  <Plus className="size-4 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Yeni Plan Oluştur</p>
                  <p className="text-xs text-muted-foreground">Sınav planınız için bir ad ve açıklama girin</p>
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
              <Button size="sm" disabled={!editName.trim() || saving}
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
