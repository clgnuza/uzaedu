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
import { Shuffle, AlertTriangle, Check, Users, Plus, Trash2, Search, ListChecks, LayoutGrid, List, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type SessionType = 'yazili' | 'uygulama' | 'mixed';
type Session = { id: string; subjectName: string; sessionDate: string; startTime: string; endTime: string; roomName: string | null; capacity: number; sessionType?: SessionType; studentCount?: number };

const SESSION_TYPE_BADGE: Record<string, string> = {
  uygulama: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
  mixed:    'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
};
const SESSION_TYPE_LABEL: Record<string, string> = { yazili: 'Yaz?l?', uygulama: 'Uygulama', mixed: 'Yaz?l? + Uygulama' };
type Student = { id: string; studentName: string; studentNumber: string | null; className: string | null; subjects: Array<{ subjectName: string; sessionId?: string | null }> };
type Conflict = { studentName: string; studentNumber: string | null; conflictingSubjects: string[] };
type SessionStudent = { id: string; studentId: string; attendanceStatus: string | null; student: Student };
type FilterMode = 'all' | 'assigned' | 'unassigned';

const NO_GROUP = (
  <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-indigo-300/60 bg-indigo-50/40 py-16 text-center dark:border-indigo-800/40 dark:bg-indigo-950/20">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-10 text-indigo-400" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Önce bir grup seçin</p>
    <p className="text-xs text-muted-foreground">Gruplar sekmesinden bir s?nav grubu seçin veya olu?turun.</p>
  </div>
);

export default function ProgramlamaPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId = searchParams.get('group_id') ?? '';
  const schoolQ = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));

  const [sessions, setSessions]         = useState<Session[]>([]);
  const [students, setStudents]         = useState<Student[]>([]);
  const [conflicts, setConflicts]       = useState<Conflict[]>([]);
  const [loading, setLoading]           = useState(!!groupId);
  const [scheduling, setScheduling]     = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionStudents, setSessionStudents] = useState<SessionStudent[]>([]);
  const [search, setSearch]             = useState('');
  const [filterMode, setFilterMode]     = useState<FilterMode>('all');
  const [tab, setTab] = useState<'atama' | 'matris'>('atama');

  const load = async () => {
    if (!token || !groupId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [s, st, c] = await Promise.all([
        apiFetch<Session[]>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { token }),
        apiFetch<Student[]>(`/sorumluluk-exam/groups/${groupId}/students${schoolQ}`, { token }),
        apiFetch<Conflict[]>(`/sorumluluk-exam/groups/${groupId}/conflicts${schoolQ}`, { token }),
      ]);
      setSessions(s); setStudents(st); setConflicts(c);
    } catch { toast.error('Veri yüklenemedi'); }
    finally { setLoading(false); }
  };

  const loadSessionStudents = async (sId: string) => {
    try {
      const data = await apiFetch<SessionStudent[]>(`/sorumluluk-exam/sessions/${sId}/students${schoolQ}`, { token });
      setSessionStudents(data);
    } catch { toast.error('Ö?renciler yüklenemedi'); }
  };

  useEffect(() => { void load(); }, [token, groupId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (selectedSession) void loadSessionStudents(selectedSession); }, [selectedSession]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoSchedule = async () => {
    setScheduling(true);
    try {
      const res = await apiFetch<{ assigned: number; conflicts: number; total: number }>(
        `/sorumluluk-exam/groups/${groupId}/auto-schedule${schoolQ}`, { method: 'POST', token });
      toast.success(`${res.assigned}/${res.total} atand?${res.conflicts > 0 ? `, ${res.conflicts} çak??ma kald?` : ' ? çak??ma yok ?'}`);
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setScheduling(false); }
  };

  const addToSession = async (studentId: string) => {
    if (!selectedSession) return;
    try {
      await apiFetch(`/sorumluluk-exam/sessions/${selectedSession}/students/${studentId}${schoolQ}`, { method: 'POST', token });
      toast.success('Eklendi'); void loadSessionStudents(selectedSession); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const removeFromSession = async (studentId: string) => {
    if (!selectedSession) return;
    try {
      await apiFetch(`/sorumluluk-exam/sessions/${selectedSession}/students/${studentId}${schoolQ}`, { method: 'DELETE', token });
      toast.success('Ç?kar?ld?'); void loadSessionStudents(selectedSession); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  if (!groupId) return NO_GROUP;
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const totalSubjects    = students.reduce((a, s) => a + s.subjects.length, 0);
  const assignedSubjects = students.reduce((a, s) => a + s.subjects.filter((x) => x.sessionId).length, 0);
  const assignPct        = totalSubjects > 0 ? Math.round((assignedSubjects / totalSubjects) * 100) : 0;
  const assignedStudentIds = new Set(sessionStudents.map((r) => r.studentId));
  const selectedSes      = sessions.find((s) => s.id === selectedSession);

  const filteredStudents = students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch = !search || s.studentName.toLowerCase().includes(q) || (s.studentNumber ?? '').includes(q) || (s.className ?? '').toLowerCase().includes(q);
    const isAssigned   = s.subjects.some((x) => x.sessionId);
    const matchFilter  = filterMode === 'all' || (filterMode === 'assigned' && isAssigned) || (filterMode === 'unassigned' && !isAssigned);
    return matchSearch && matchFilter;
  });

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Oturum',   value: sessions.length,  color: 'text-amber-600' },
          { label: 'Ö?renci',  value: students.length,  color: 'text-sky-600' },
          { label: 'Çak??ma',  value: conflicts.length, color: conflicts.length ? 'text-red-600' : 'text-green-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/50 bg-white/80 p-3 text-center shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="rounded-xl border border-white/50 bg-white/80 px-4 py-3 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Atama ?lerlemesi</span>
          <span className="font-semibold">{assignedSubjects}/{totalSubjects} ders ({assignPct}%)</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-zinc-800">
          <div className={cn('h-2.5 rounded-full transition-all', assignPct === 100 ? 'bg-green-500' : assignPct > 50 ? 'bg-indigo-500' : 'bg-amber-400')}
            style={{ width: `${assignPct}%` }} />
        </div>
      </div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
          <p className="font-semibold text-amber-800 text-sm flex items-center gap-1.5 dark:text-amber-300">
            <AlertTriangle className="size-4" /> {conflicts.length} ö?rencide zaman çak??mas?
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5 mb-1.5">
            Ayn? ö?renci ayn? zaman diliminde birden fazla s?nava atanm??. Otomatik programlama veya manuel düzenleme ile çözün.
          </p>
          <ul className="space-y-0.5">
            {conflicts.slice(0, 5).map((c, i) => (
              <li key={i} className="text-xs text-amber-700 dark:text-amber-400">
                ? {c.studentName}{c.studentNumber ? ` (${c.studentNumber})` : ''} ? {c.conflictingSubjects.join(', ')}
              </li>
            ))}
            {conflicts.length > 5 && <li className="text-xs text-amber-600">+{conflicts.length - 5} daha...</li>}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" className="gap-1.5" disabled={scheduling} onClick={autoSchedule}>
          {scheduling ? <LoadingSpinner className="size-4" /> : <Shuffle className="size-4" />}
          Otomatik Programla
        </Button>
        <span className="text-xs text-muted-foreground">
          Ders ad?na göre e?le?tirir, çak??ma varsa uyar?r
        </span>
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 rounded-xl border bg-slate-50 p-1 dark:border-zinc-800 dark:bg-zinc-900/40">
        {([
          { key: 'atama',  label: 'Oturum Bazl? Atama', icon: ListChecks, idle: 'text-sky-700 hover:bg-sky-50 dark:text-sky-300 dark:hover:bg-sky-950/30',     active: 'bg-sky-600 text-white shadow dark:bg-sky-700' },
          { key: 'matris', label: 'Ö?renci Matris',     icon: LayoutGrid, idle: 'text-violet-700 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/30', active: 'bg-violet-600 text-white shadow dark:bg-violet-700' },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn('flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all',
                tab === t.key ? t.active : t.idle)}>
              <Icon className="size-3.5 shrink-0" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Session-based assignment */}
      {tab === 'atama' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-muted-foreground">Oturum Seç</p>
            {sessions.length === 0 && <p className="text-xs text-muted-foreground">Önce Oturumlar sekmesinden oturum olu?turun.</p>}
            {sessions.map((s) => {
              const pct = Math.min(100, Math.round(((s.studentCount ?? 0) / Math.max(s.capacity, 1)) * 100));
              return (
                <button key={s.id} onClick={() => setSelectedSession(s.id === selectedSession ? null : s.id)}
                  className={cn('w-full text-left rounded-xl border px-4 py-3 transition-colors',
                    s.id === selectedSession
                      ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/30'
                      : 'border-white/50 bg-white/70 hover:bg-white/90 dark:border-zinc-800/40 dark:bg-zinc-900/50')}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-semibold text-sm">{s.subjectName}</p>
                    {s.sessionType && s.sessionType !== 'yazili' && (
                      <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-semibold', SESSION_TYPE_BADGE[s.sessionType])}>
                        {SESSION_TYPE_LABEL[s.sessionType]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{s.sessionDate} · {s.startTime}?{s.endTime}{s.roomName ? ` · ${s.roomName}` : ''}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full bg-slate-100 dark:bg-zinc-800">
                      <div className={cn('h-1 rounded-full', pct >= 100 ? 'bg-red-400' : pct > 75 ? 'bg-amber-400' : 'bg-green-400')} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0"><Users className="inline size-2.5 mr-0.5" />{s.studentCount ?? 0}/{s.capacity}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedSession && selectedSes ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold">{selectedSes.subjectName} ? Atamalar</p>

              {sessionStudents.length > 0 && (
                <div className="rounded-xl border bg-white/70 dark:bg-zinc-900/50 overflow-hidden">
                  <div className="px-3 py-2 bg-green-50 dark:bg-green-950/20 border-b text-xs font-semibold text-green-700 dark:text-green-400">
                    {sessionStudents.length} ö?renci atand?
                  </div>
                  <div className="max-h-56 overflow-y-auto divide-y dark:divide-zinc-800/50">
                    {sessionStudents.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800/60">
                        <Check className="size-3.5 text-green-500 shrink-0" />
                        <span className="flex-1 text-xs font-medium">{r.student?.studentName ?? '?'}</span>
                        <span className="text-[10px] text-muted-foreground">{r.student?.className}</span>
                        <button onClick={() => removeFromSession(r.studentId)} className="text-muted-foreground hover:text-red-600 ml-1"><Trash2 className="size-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs text-muted-foreground">Atanmam?? ö?renciler (manuel ekle):</p>
              <div className="rounded-xl border bg-white/70 dark:bg-zinc-900/50 max-h-52 overflow-y-auto divide-y dark:divide-zinc-800/50">
                {students.filter((s) => !assignedStudentIds.has(s.id)).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center p-4">Tüm ö?renciler bu oturuma atanm??</p>
                )}
                {students.filter((s) => !assignedStudentIds.has(s.id)).map((s) => (
                  <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-zinc-800/60">
                    <span className="flex-1 text-xs">{s.studentName}</span>
                    <span className="text-[10px] text-muted-foreground">{s.className}</span>
                    <button onClick={() => addToSession(s.id)} className="text-muted-foreground hover:text-indigo-600 ml-1"><Plus className="size-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border bg-white/60 p-8 text-center text-muted-foreground dark:bg-zinc-900/40">
              <Shuffle className="mx-auto mb-2 size-8 opacity-30" />
              <p className="text-sm">Bir oturum seçerek ö?renci atamalar?n? yönetin.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Student matrix */}
      {tab === 'matris' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input placeholder="Ö?renci ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
            </div>
            <div className="flex gap-1 rounded-lg border bg-slate-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/40">
              {([
                { key: 'all',        label: 'Tümü',         icon: List,         active: 'bg-white text-slate-700 shadow dark:bg-zinc-800 dark:text-slate-200' },
                { key: 'assigned',   label: 'Atananlar',    icon: CheckCircle2, active: 'bg-white text-green-700 shadow dark:bg-zinc-800 dark:text-green-300' },
                { key: 'unassigned', label: 'Atanmayanlar', icon: Clock,        active: 'bg-white text-amber-700 shadow dark:bg-zinc-800 dark:text-amber-300' },
              ] as const).map((m) => {
                const Icon = m.icon;
                return (
                  <button key={m.key} onClick={() => setFilterMode(m.key)}
                    className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all',
                      filterMode === m.key ? m.active : 'text-muted-foreground hover:text-slate-600')}>
                    <Icon className="size-3 shrink-0" />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">{filteredStudents.length} ö?renci</div>

          <div className="overflow-x-auto rounded-xl border bg-white/80 dark:border-zinc-800/40 dark:bg-zinc-900/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b dark:border-zinc-800">
                  <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Ö?renci</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-muted-foreground">S?n?f</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-muted-foreground">Sorumlu Dersler</th>
                  <th className="px-2 py-2.5 text-center font-semibold text-muted-foreground">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-zinc-800/50">
                {filteredStudents.map((s) => {
                  const assigned   = s.subjects.filter((x) => x.sessionId).length;
                  const total      = s.subjects.length;
                  const allDone    = assigned === total && total > 0;
                  const hasConflict = conflicts.some((c) => c.studentName === s.studentName);
                  return (
                    <tr key={s.id} className={cn('hover:bg-slate-50 dark:hover:bg-zinc-800/40', hasConflict && 'bg-amber-50/60 dark:bg-amber-950/10')}>
                      <td className="px-3 py-2 font-medium">
                        {s.studentName}
                        {hasConflict && <span className="ml-1 text-amber-500" title="Zaman çak??mas?">?</span>}
                      </td>
                      <td className="px-2 py-2 text-muted-foreground">{s.className ?? '?'}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-1">
                          {s.subjects.map((sub, i) => (
                            <span key={i} className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                              sub.sessionId ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300')}>
                              {sub.subjectName}{sub.sessionId ? ' ?' : ''}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          allDone   ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300' :
                          assigned > 0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' :
                          'bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400')}>
                          {assigned}/{total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredStudents.length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-6">Sonuç yok</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
