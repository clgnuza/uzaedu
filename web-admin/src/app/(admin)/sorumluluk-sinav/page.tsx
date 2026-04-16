'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, ChevronRight, GraduationCap, BookOpen, Users, CalendarRange, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Group = {
  id: string; title: string; academicYear?: string | null;
  examType: 'sorumluluk' | 'beceri'; status: string; notes?: string | null;
  studentCount?: number; sessionCount?: number;
};

const STATUS_LABELS: Record<string, string> = { draft: 'Taslak', active: 'Aktif', completed: 'Tamamlandı', archived: 'Arşiv' };
const STATUS_COLORS: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300',
  active:    'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  archived:  'bg-zinc-100 text-zinc-500 dark:bg-zinc-800/40 dark:text-zinc-400',
};
const TYPE_LABELS  : Record<string, string> = { sorumluluk: 'Sorumluluk Sınavı', beceri: 'Beceri Sınavı' };
const TYPE_COLORS  : Record<string, string> = {
  sorumluluk: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
  beceri:     'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
};
const STATUS_NEXT: Record<string, string> = { draft: 'active', active: 'completed', completed: 'archived' };
const STATUS_NEXT_LABEL: Record<string, string> = { draft: 'Aktifleştir', active: 'Tamamla', completed: 'Arşivle' };

export default function SorumlulukGroupsPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const schoolQ = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';

  const [groups, setGroups]   = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', academicYear: new Date().getFullYear() - 1 + '-' + new Date().getFullYear(), examType: 'sorumluluk' as 'sorumluluk' | 'beceri', notes: '' });

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<Group[]>(`/sorumluluk-exam/groups${schoolQ}`, { token });
      setGroups(data);
    } catch { toast.error('Gruplar yüklenemedi'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token, schoolQ]);

  const save = async () => {
    if (!form.title.trim()) return toast.error('Başlık gerekli');
    try {
      if (editId) {
        await apiFetch(`/sorumluluk-exam/groups/${editId}${schoolQ}`, { method: 'PATCH', token, body: JSON.stringify(form) });
        toast.success('Güncellendi');
      } else {
        await apiFetch(`/sorumluluk-exam/groups${schoolQ}`, { method: 'POST', token, body: JSON.stringify(form) });
        toast.success('Grup oluşturuldu');
      }
      setShowForm(false); setEditId(null);
      setForm({ title: '', academicYear: new Date().getFullYear() - 1 + '-' + new Date().getFullYear(), examType: 'sorumluluk', notes: '' });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const startEdit = (g: Group) => {
    setEditId(g.id);
    setForm({ title: g.title, academicYear: g.academicYear ?? '', examType: g.examType, notes: g.notes ?? '' });
    setShowForm(true);
  };

  const del = async (id: string) => {
    if (!confirm('Bu grubu ve tüm verilerini silmek istiyor musunuz?')) return;
    try {
      await apiFetch(`/sorumluluk-exam/groups/${id}${schoolQ}`, { method: 'DELETE', token });
      toast.success('Silindi'); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const advanceStatus = async (g: Group) => {
    const next = STATUS_NEXT[g.status];
    if (!next) return;
    try {
      await apiFetch(`/sorumluluk-exam/groups/${g.id}${schoolQ}`, { method: 'PATCH', token, body: JSON.stringify({ status: next }) });
      toast.success(`Durum: ${STATUS_LABELS[next]}`); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const groupLink = (id: string) => `/sorumluluk-sinav/ogrenciler${schoolQ ? schoolQ + '&' : '?'}group_id=${id}`;
  const totalStudents = groups.reduce((a, g) => a + (g.studentCount ?? 0), 0);
  const totalSessions = groups.reduce((a, g) => a + (g.sessionCount ?? 0), 0);
  const activeGroups  = groups.filter((g) => g.status === 'active').length;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Stats */}
      {groups.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-3">
          {[
            { label: 'Toplam Grup', value: groups.length, color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Aktif Grup',  value: activeGroups,  color: 'text-green-600 dark:text-green-400' },
            { label: 'Öğrenci',     value: totalStudents, color: 'text-sky-600 dark:text-sky-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/50 bg-white/80 p-2 text-center shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 sm:rounded-2xl sm:p-3">
              <p className={cn('text-lg font-bold tabular-nums sm:text-2xl', s.color)}>{s.value}</p>
              <p className="mt-0.5 text-[9px] leading-tight text-muted-foreground sm:text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground sm:text-sm">{totalSessions} oturum planlandı</p>
        {isAdmin && (
          <Button size="sm" className="h-8 w-full gap-1.5 text-xs sm:h-9 sm:w-auto sm:text-sm" onClick={() => { setEditId(null); setShowForm(!showForm); }}>
            <Plus className="size-4" /> Yeni Grup
          </Button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="rounded-xl border bg-white/80 p-3 shadow-sm dark:bg-zinc-900/60 space-y-2.5 sm:rounded-2xl sm:p-4 sm:space-y-3">
          <p className="text-xs font-semibold sm:text-sm">{editId ? 'Grubu Düzenle' : 'Yeni Grup'}</p>
          <Input placeholder="Başlık *  (örn: 2024-2025 I. Dönem Sorumluluk Sınavı)" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Eğitim Yılı (örn: 2024-2025)" value={form.academicYear} onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))} />
            <select value={form.examType} onChange={(e) => setForm((f) => ({ ...f, examType: e.target.value as 'sorumluluk' | 'beceri' }))}
              className="h-9 w-full rounded-lg border border-input bg-white px-3 text-sm dark:bg-zinc-900">
              <option value="sorumluluk">Sorumluluk Sınavı</option>
              <option value="beceri">Beceri Sınavı</option>
            </select>
          </div>
          <textarea placeholder="Notlar (opsiyonel)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={2} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm dark:bg-zinc-900 resize-none" />
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="size-4 mr-1" /> {editId ? 'Güncelle' : 'Oluştur'}</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}><X className="size-4 mr-1" /> İptal</Button>
          </div>
        </div>
      )}

      {groups.length === 0 && (
        <div className="rounded-xl border bg-white/60 p-6 text-center text-muted-foreground dark:bg-zinc-900/40 sm:rounded-2xl sm:p-10">
          <GraduationCap className="mx-auto mb-2 size-7 opacity-40 sm:mb-3 sm:size-8" />
          <p className="text-xs font-medium sm:text-sm">Henüz grup yok</p>
          <p className="mt-1 text-[11px] opacity-70 sm:text-xs">Sorumluluk veya beceri sınavı grubu oluşturarak başlayın.</p>
          {isAdmin && <Button size="sm" className="mt-3 h-8 gap-1.5 text-xs sm:mt-4 sm:h-9 sm:text-sm" onClick={() => setShowForm(true)}><Plus className="size-4" /> Yeni Grup</Button>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => {
          const fillPct = g.sessionCount ? Math.min(100, Math.round((g.studentCount ?? 0) / Math.max(g.sessionCount, 1) * 10)) : 0;
          return (
            <div key={g.id} className="flex flex-col gap-2.5 rounded-xl border border-white/60 bg-white/80 p-3 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 sm:gap-3 sm:rounded-2xl sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', TYPE_COLORS[g.examType])}>
                      {TYPE_LABELS[g.examType]}
                    </span>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[g.status])}>
                      {STATUS_LABELS[g.status] ?? g.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-tight sm:text-sm">{g.title}</p>
                  {g.academicYear && <p className="text-xs text-muted-foreground">{g.academicYear}</p>}
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(g)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30"><Pencil className="size-3.5" /></button>
                    <button onClick={() => del(g.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"><Trash2 className="size-3.5" /></button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground sm:gap-4 sm:text-xs">
                <span className="flex items-center gap-1"><Users className="size-3" />{g.studentCount ?? 0} öğrenci</span>
                <span className="flex items-center gap-1"><CalendarRange className="size-3" />{g.sessionCount ?? 0} oturum</span>
                <span className="flex items-center gap-1"><BookOpen className="size-3" />{TYPE_LABELS[g.examType]?.split(' ')[0]}</span>
              </div>

              {/* Doluluk bar */}
              {(g.studentCount ?? 0) > 0 && (
                <div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                    <span>Öğrenci / Oturum</span>
                    <span>{g.studentCount} / {g.sessionCount}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800">
                    <div className="h-1.5 rounded-full bg-indigo-400 transition-all" style={{ width: `${fillPct}%` }} />
                  </div>
                </div>
              )}

              <div className="mt-auto flex flex-wrap gap-1.5 sm:gap-2">
                <Link href={groupLink(g.id)} className="inline-flex min-h-9 flex-1 basis-[40%] items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-700 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs">
                  Aç <ChevronRight className="size-3" />
                </Link>
                {isAdmin && STATUS_NEXT[g.status] && (
                  <button onClick={() => advanceStatus(g)}
                    className={cn('min-h-9 rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs',
                      g.status === 'draft'
                        ? 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950/30'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-slate-400 dark:hover:bg-zinc-800')}>
                    {STATUS_NEXT_LABEL[g.status]}
                  </button>
                )}
                <Link href={`/sorumluluk-sinav/raporlar${schoolQ ? schoolQ + '&' : '?'}group_id=${g.id}`}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs">
                  Raporlar
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
