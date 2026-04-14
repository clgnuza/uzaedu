'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, Upload, X, Check, Users, Search, Info, BookOpen, Download, FileSpreadsheet, Zap, AlertCircle, List, LayoutList } from 'lucide-react';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import { cn } from '@/lib/utils';

type SubjectEntry = { subjectName: string; sessionId?: string | null };
type Student = {
  id: string; studentName: string; studentNumber: string | null;
  className: string | null; subjects: SubjectEntry[]; notes?: string | null;
};

function groupByClass(students: Student[]) {
  const map = new Map<string, Student[]>();
  for (const s of students) {
    const k = s.className ?? '?';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'tr'));
}

const NO_GROUP = (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-300/60 bg-indigo-50/40 py-16 text-center dark:border-indigo-800/40 dark:bg-indigo-950/20">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-10 text-indigo-400" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Önce bir grup seçin</p>
    <p className="text-xs text-muted-foreground">Gruplar sekmesinden bir s?nav grubu seçin veya olu?turun.</p>
  </div>
);

export default function OgrencilerPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId  = searchParams.get('group_id') ?? '';
  const schoolQ  = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isAdmin  = me?.role !== 'teacher';

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading]   = useState(!!groupId);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState({ studentName: '', studentNumber: '', className: '', subjects: '' });
  const [groupView, setGroupView] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const [mebDialog, setMebDialog]   = useState(false);
  const [mebFile, setMebFile]       = useState<File | null>(null);
  const [mebOpts, setMebOpts]       = useState({ createSessions: true, autoSchedule: true });
  const [mebResult, setMebResult]   = useState<{ imported: number; sessionsCreated: number; assigned: number; conflicts: number; total: number } | null>(null);
  const [mebLoading, setMebLoading] = useState(false);
  const mebFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!token || !groupId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<Student[]>(`/sorumluluk-exam/groups/${groupId}/students${schoolQ}`, { token });
      setStudents(data);
    } catch { toast.error('Ö?renciler yüklenemedi'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form.studentName.trim()) return toast.error('Ad Soyad gerekli');
    const subjects = form.subjects.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => ({ subjectName: s }));
    const body = { studentName: form.studentName.trim(), studentNumber: form.studentNumber.trim() || undefined, className: form.className.trim() || undefined, subjects };
    try {
      if (editId) {
        await apiFetch(`/sorumluluk-exam/students/${editId}${schoolQ}`, { method: 'PATCH', token, body: JSON.stringify(body) });
        toast.success('Güncellendi');
      } else {
        await apiFetch(`/sorumluluk-exam/groups/${groupId}/students${schoolQ}`, { method: 'POST', token, body: JSON.stringify(body) });
        toast.success('Eklendi');
      }
      setShowForm(false); setEditId(null); setForm({ studentName: '', studentNumber: '', className: '', subjects: '' });
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const del = async (id: string) => {
    if (!confirm('Silmek istiyor musunuz?')) return;
    try { await apiFetch(`/sorumluluk-exam/students/${id}${schoolQ}`, { method: 'DELETE', token }); toast.success('Silindi'); void load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const startEdit = (s: Student) => {
    setEditId(s.id);
    setForm({ studentName: s.studentName, studentNumber: s.studentNumber ?? '', className: s.className ?? '', subjects: s.subjects.map((x) => x.subjectName).join('\n') });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onExcelUpload = async (file: File) => {
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await apiFetch<{ imported: number }>(`/sorumluluk-exam/groups/${groupId}/import-excel${schoolQ}`, { method: 'POST', token, body: fd });
      toast.success(`${res.imported} ö?renci içe aktar?ld?`); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '?çe aktarma hatas?'); }
  };

  const onMebImport = async () => {
    if (!mebFile) return toast.error('Dosya seçin');
    setMebLoading(true);
    setMebResult(null);
    try {
      const fd = new FormData(); fd.append('file', mebFile);
      const sep = schoolQ ? schoolQ + '&' : '?';
      const qs = `${sep}create_sessions=${mebOpts.createSessions ? '1' : '0'}&auto_schedule=${mebOpts.autoSchedule ? '1' : '0'}`;
      const res = await apiFetch<{ imported: number; sessionsCreated: number; assigned: number; conflicts: number; total: number }>(
        `/sorumluluk-exam/groups/${groupId}/import-meb${qs}`,
        { method: 'POST', token, body: fd },
      );
      setMebResult(res);
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : '?çe aktarma hatas?'); }
    finally { setMebLoading(false); }
  };

  if (!groupId) return NO_GROUP;
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const filtered = students.filter((s) =>
    !search || s.studentName.toLowerCase().includes(search.toLowerCase()) ||
    (s.studentNumber ?? '').includes(search) || (s.className ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const assigned      = students.filter((s) => s.subjects.some((x) => x.sessionId)).length;
  const totalSubjects = students.reduce((a, s) => a + s.subjects.length, 0);
  const uniqueSubjects = [...new Set(students.flatMap((s) => s.subjects.map((x) => x.subjectName)))];

  return (
    <div className="space-y-4">
      {/* MEB Import Dialog */}
      {mebDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setMebDialog(false)}>
          <div className="w-full max-w-lg rounded-2xl border bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4 dark:border-zinc-800">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="size-5 text-indigo-600" />
                <div>
                  <p className="font-semibold text-sm">MEB e-okul Sorumluluk Listesi</p>
                  <p className="text-[11px] text-muted-foreground">Önceki y?llar listesini yükle ve otomatik planla</p>
                </div>
              </div>
              <button onClick={() => setMebDialog(false)} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="size-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="rounded-xl border border-indigo-200/60 bg-indigo-50/60 p-3 dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">Desteklenen MEB e-okul sütunlar?</p>
                <p className="font-mono text-[10px] bg-white/70 dark:bg-zinc-900/60 rounded px-2 py-1 text-indigo-800 dark:text-indigo-200">
                  Ad? Soyad? | Ö?renci No | S?n?f | Sorumlu Ders 1 | Ders 2 | Ders 3
                </p>
                <p className="text-[10px] text-indigo-700/70 dark:text-indigo-300/70 mt-1.5">
                  Sütun adlar? otomatik alg?lan?r. MEB e-okul &quot;Sorumluluk Ö?renci Listesi&quot; Excel ç?kt?s?n? direkt yükleyebilirsiniz.
                </p>
              </div>

              <div
                className={cn('rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer',
                  mebFile ? 'border-green-400 bg-green-50/50 dark:border-green-700 dark:bg-green-950/10' : 'border-slate-300 hover:border-indigo-400 dark:border-zinc-700 dark:hover:border-indigo-600')}
                onClick={() => mebFileRef.current?.click()}>
                {mebFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Check className="size-5 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">{mebFile.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); setMebFile(null); }} className="text-muted-foreground hover:text-red-500">
                      <X className="size-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto mb-2 size-8 text-muted-foreground opacity-50" />
                    <p className="text-sm font-medium">Dosya seçmek için t?klay?n</p>
                    <p className="text-xs text-muted-foreground mt-0.5">.xlsx veya .xls</p>
                  </>
                )}
                <input ref={mebFileRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setMebFile(f); e.target.value = ''; }} />
              </div>

              <div className="space-y-2.5">
                <label className="flex items-start gap-3 rounded-xl border p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setMebOpts((o) => ({ ...o, createSessions: !o.createSessions }))}>
                  <div className={cn('mt-0.5 size-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors',
                    mebOpts.createSessions ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-zinc-600')}>
                    {mebOpts.createSessions && <Check className="size-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Oturumlar? otomatik olu?tur</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Listede bulunan her ders için oturum olu?turur. Tarih/saat bilgisini sonradan düzenleyebilirsiniz.
                    </p>
                  </div>
                </label>
                <label className={cn('flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
                  mebOpts.createSessions ? 'hover:bg-slate-50 dark:hover:bg-zinc-800/50' : 'opacity-40 pointer-events-none')}
                  onClick={() => mebOpts.createSessions && setMebOpts((o) => ({ ...o, autoSchedule: !o.autoSchedule }))}>
                  <div className={cn('mt-0.5 size-5 rounded flex items-center justify-center shrink-0 border-2 transition-colors',
                    mebOpts.autoSchedule && mebOpts.createSessions ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-zinc-600')}>
                    {mebOpts.autoSchedule && mebOpts.createSessions && <Check className="size-3 text-white" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Zap className="size-3.5 text-amber-500" /> Otomatik da??t
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Ö?rencileri çak??ma olmadan oturumlara otomatik atar.
                    </p>
                  </div>
                </label>
              </div>

              {mebResult && (
                <div className="rounded-xl border border-green-200 bg-green-50/60 p-3 dark:border-green-800/40 dark:bg-green-950/20 space-y-2">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-300">??lem tamamland?</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {[
                      { label: 'Ö?renci',  value: mebResult.imported,        color: 'text-sky-600' },
                      { label: 'Oturum',   value: mebResult.sessionsCreated,  color: 'text-indigo-600' },
                      { label: 'Atama',    value: mebResult.assigned,         color: 'text-green-600' },
                      { label: 'Çak??ma',  value: mebResult.conflicts,        color: mebResult.conflicts > 0 ? 'text-red-600' : 'text-slate-400' },
                    ].map((item) => (
                      <div key={item.label} className="text-center rounded-lg bg-white/70 dark:bg-zinc-900/60 py-1.5">
                        <p className={cn('text-lg font-bold', item.color)}>{item.value}</p>
                        <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      </div>
                    ))}
                  </div>
                  {mebResult.sessionsCreated > 0 && (
                    <div className="flex items-start gap-1.5">
                      <AlertCircle className="size-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        {mebResult.sessionsCreated} yeni oturum olu?turuldu. Lütfen <strong>Oturumlar</strong> sekmesinden tarih ve saat bilgilerini güncelleyin.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button className="flex-1 gap-1.5" onClick={onMebImport} disabled={!mebFile || mebLoading}>
                  {mebLoading ? <><span className="animate-spin">?</span> Yükleniyor...</> : <><FileSpreadsheet className="size-4" /> Yükle ve Planla</>}
                </Button>
                <Button variant="outline" onClick={() => setMebDialog(false)}>?ptal</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {students.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Ö?renci',   value: students.length,  color: 'text-sky-600 dark:text-sky-400' },
            { label: 'Ders Kayd?', value: totalSubjects,   color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Atanan',     value: assigned,         color: assigned === students.length && students.length > 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-white/50 bg-white/80 p-3 text-center shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
              <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {uniqueSubjects.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-white/50 bg-white/60 px-3 py-2.5 dark:border-zinc-800/40 dark:bg-zinc-900/40">
          <BookOpen className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          {uniqueSubjects.map((sub) => (
            <span key={sub} className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-medium text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{sub}</span>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input placeholder="Ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <button onClick={() => setGroupView((v) => !v)}
          className={cn('flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors',
            groupView
              ? 'border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 dark:border-teal-800/40 dark:bg-teal-950/30 dark:text-teal-300'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-slate-300')}>
          {groupView ? <LayoutList className="size-3.5" /> : <List className="size-3.5" />}
          {groupView ? 'S?n?fa Göre' : 'Liste'}
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} ö?renci</span>
        {isAdmin && (
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" title="Örnek Excel ?ablonu indir"
              onClick={async () => {
                try {
                  const base = resolveDefaultApiBase();
                  const res = await fetch(`${base}/sorumluluk-exam/students/excel-template${schoolQ ?? ''}`, { headers: { Authorization: `Bearer ${token}` } });
                  if (!res.ok) throw new Error('?ndirme ba?ar?s?z');
                  const blob = await res.blob();
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ogrenci-sablon.xlsx'; a.click();
                  toast.success('?ablon indirildi');
                } catch { toast.error('?ablon indirilemedi'); }
              }}>
              <Download className="size-4" /> ?ablon
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Excel
            </Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onExcelUpload(f); e.target.value = ''; }} />
            <Button size="sm" variant="outline" className="gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300"
              onClick={() => { setMebDialog(true); setMebFile(null); setMebResult(null); }}>
              <FileSpreadsheet className="size-4" /> MEB Listesi
            </Button>
            <Button size="sm" className="gap-1.5" onClick={() => { setEditId(null); setForm({ studentName: '', studentNumber: '', className: '', subjects: '' }); setShowForm(true); }}>
              <Plus className="size-4" /> Ekle
            </Button>
          </div>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="rounded-2xl border bg-white/80 p-4 shadow-sm dark:bg-zinc-900/60 space-y-3">
          <p className="font-semibold text-sm">{editId ? 'Ö?renci Düzenle' : 'Yeni Ö?renci'}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input placeholder="Ad? Soyad? *" value={form.studentName} onChange={(e) => setForm((f) => ({ ...f, studentName: e.target.value }))} />
            <Input placeholder="Ö?renci No" value={form.studentNumber} onChange={(e) => setForm((f) => ({ ...f, studentNumber: e.target.value }))} />
            <Input placeholder="S?n?f (örn: 11-A)" value={form.className} onChange={(e) => setForm((f) => ({ ...f, className: e.target.value }))} />
          </div>
          <div>
            <textarea
              placeholder={'Sorumlu dersler (her sat?ra bir ders veya virgülle ay?r?n)\nÖrn: Matematik\nFizik\nKimya'}
              value={form.subjects} onChange={(e) => setForm((f) => ({ ...f, subjects: e.target.value }))}
              rows={4} className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm dark:bg-zinc-900 resize-y" />
            <p className="text-[10px] text-muted-foreground mt-1">Her sat?ra bir ders ad? girin. Programlama a?amas?nda ders ad?yla oturumlar e?le?tirilir.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="size-4 mr-1" /> Kaydet</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}><X className="size-4 mr-1" /> ?ptal</Button>
          </div>
        </div>
      )}

      {students.length === 0 && !showForm && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-sky-200/60 bg-sky-50/60 p-4 dark:border-sky-900/40 dark:bg-sky-950/20">
            <div className="flex gap-2.5">
              <Info className="size-4 text-sky-600 shrink-0 mt-0.5" />
              <div className="text-xs text-sky-800 dark:text-sky-300 space-y-1">
                <p className="font-semibold">Excel ile toplu içe aktarma</p>
                <p>Excel dosyan?zda ?u sütunlar? bulundurun:</p>
                <p className="font-mono bg-sky-100 dark:bg-sky-950/40 rounded px-2 py-1 text-[11px]">Ad? Soyad? | No | S?n?f | Ders1 | Ders2 | Ders3...</p>
                <p className="opacity-80">Sistem ders sütunlar?n? otomatik alg?lar. Say?sal ba?l?k sat?r? varsa atlar.</p>
                <p className="opacity-80 mt-1">Yukar?daki <strong>?ablon</strong> dü?mesiyle haz?r Excel ?ablonunu indirebilirsiniz.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border bg-white/60 p-10 text-center text-muted-foreground dark:bg-zinc-900/40">
            <Users className="mx-auto mb-2 size-8 opacity-30" />
            <p className="text-sm font-medium">Henüz ö?renci yok</p>
            <p className="text-xs mt-1 opacity-70">Excel ile içe aktar?n veya tek tek ekleyin.</p>
          </div>
        </div>
      )}

      {groupView && students.length > 0 ? (
        <div className="space-y-4">
          {groupByClass(filtered).map(([cls, classStudents]) => (
            <div key={cls}>
              <div className="flex items-center gap-2 mb-2">
                <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">{cls}</span>
                <span className="text-xs text-muted-foreground">{classStudents.length} ö?renci</span>
              </div>
              <div className="space-y-1.5">
                {classStudents.map((s) => (
                  <StudentRow key={s.id} s={s} isAdmin={isAdmin} onEdit={startEdit} onDelete={del} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((s) => (
            <StudentRow key={s.id} s={s} isAdmin={isAdmin} onEdit={startEdit} onDelete={del} />
          ))}
        </div>
      )}
    </div>
  );
}

function StudentRow({ s, isAdmin, onEdit, onDelete }: {
  s: Student;
  isAdmin: boolean;
  onEdit: (s: Student) => void;
  onDelete: (id: string) => void;
}) {
  const assignedCount = s.subjects.filter((x) => x.sessionId).length;
  const allAssigned   = assignedCount === s.subjects.length && s.subjects.length > 0;

  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3 shadow-sm transition-colors',
      allAssigned
        ? 'border-green-200/60 bg-green-50/50 dark:border-green-900/30 dark:bg-green-950/10'
        : 'border-white/50 bg-white/70 dark:border-zinc-800/40 dark:bg-zinc-900/50')}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-sm">{s.studentName}</span>
          {s.studentNumber && <span className="text-xs text-muted-foreground">#{s.studentNumber}</span>}
          {s.className && (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">{s.className}</span>
          )}
          {allAssigned && s.subjects.length > 0 && (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-950/40 dark:text-green-300">? Atand?</span>
          )}
        </div>
        {s.subjects.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {s.subjects.map((sub, i) => (
              <span key={i} className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium',
                sub.sessionId
                  ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300')}>
                {sub.subjectName}{sub.sessionId ? ' ?' : ''}
              </span>
            ))}
          </div>
        )}
      </div>
      {isAdmin && (
        <div className="flex gap-1 shrink-0 mt-0.5">
          <button onClick={() => onEdit(s)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30 transition-colors">
            <Pencil className="size-3.5" />
          </button>
          <button onClick={() => onDelete(s.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 transition-colors">
            <Trash2 className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
