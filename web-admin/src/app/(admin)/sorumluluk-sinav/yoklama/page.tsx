'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Check, X, Minus, Users, FileDown, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

type Student = { id: string; studentName: string; studentNumber: string | null; className: string | null; subjects: Array<{ subjectName: string; sessionId?: string | null }> };
type SessionStudent = {
  id: string; studentId: string;
  attendanceStatus: 'present' | 'absent' | 'excused' | null;
  student: Student;
};
type Session = { id: string; subjectName: string; sessionDate: string; startTime: string; endTime: string; roomName: string | null };

const STATUS_OPTIONS: Array<{ value: 'present' | 'absent' | 'excused' | null; label: string; icon: React.ElementType; color: string; bg: string }> = [
  { value: 'present', label: 'Kat?ld?',   icon: Check, color: 'text-green-700 dark:text-green-300', bg: 'bg-green-100 border-green-300 dark:bg-green-950/40 dark:border-green-700' },
  { value: 'absent',  label: 'Gelmedi',   icon: X,     color: 'text-red-700 dark:text-red-300',     bg: 'bg-red-100 border-red-300 dark:bg-red-950/40 dark:border-red-700' },
  { value: 'excused', label: 'Mazeretli', icon: Minus,  color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:border-amber-700' },
  { value: null,      label: 'Belirsiz',  icon: Minus,  color: 'text-slate-400',                    bg: 'bg-slate-50 border-slate-200 dark:bg-zinc-900/40 dark:border-zinc-700' },
];

function getStatusOpt(status: string | null) {
  return STATUS_OPTIONS.find((o) => o.value === status) ?? STATUS_OPTIONS[STATUS_OPTIONS.length - 1];
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

export default function YoklamaPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const sessionId = searchParams.get('session_id') ?? '';
  const groupId   = searchParams.get('group_id') ?? '';
  const schoolQ   = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));

  const [session, setSession]   = useState<Session | null>(null);
  const [rows, setRows]         = useState<SessionStudent[]>([]);
  const [loading, setLoading]   = useState(!!groupId);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    if (!token || !sessionId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [ss, sessionList] = await Promise.all([
        apiFetch<SessionStudent[]>(`/sorumluluk-exam/sessions/${sessionId}/students${schoolQ}`, { token }),
        groupId ? apiFetch<Session[]>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { token }) : Promise.resolve([] as Session[]),
      ]);
      setRows(ss);
      const found = (sessionList as Session[]).find((s) => s.id === sessionId);
      if (found) setSession(found);
    } catch { toast.error('Yüklenemedi'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token, sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateStatus = async (studentId: string, status: 'present' | 'absent' | 'excused' | null) => {
    setUpdating(studentId);
    try {
      await apiFetch(`/sorumluluk-exam/sessions/${sessionId}/students/${studentId}/attendance${schoolQ}`, {
        method: 'PATCH', token, body: JSON.stringify({ status }),
      });
      setRows((prev) => prev.map((r) => r.studentId === studentId ? { ...r, attendanceStatus: status } : r));
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setUpdating(null); }
  };

  const markAll = async (status: 'present' | 'absent' | 'excused') => {
    for (const r of rows) {
      await updateStatus(r.studentId, status);
      await new Promise((res) => setTimeout(res, 80));
    }
    toast.success('Tümü i?aretlendi');
  };

  const downloadPdf = async () => {
    try {
      const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
      const res = await fetch(`${BASE}/sorumluluk-exam/sessions/${sessionId}/pdf/yoklama${schoolQ}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `yoklama-${session?.subjectName ?? sessionId}.pdf`; a.click();
      toast.success('PDF indirildi');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  if (!groupId) return NO_GROUP;
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;
  if (!sessionId) return <p className="text-sm text-muted-foreground text-center py-8">session_id parametresi gerekli.</p>;

  const presentCount = rows.filter((r) => r.attendanceStatus === 'present').length;
  const absentCount  = rows.filter((r) => r.attendanceStatus === 'absent').length;
  const excusedCount = rows.filter((r) => r.attendanceStatus === 'excused').length;
  const unknownCount = rows.filter((r) => !r.attendanceStatus).length;

  const backLink = `/sorumluluk-sinav/oturumlar${schoolQ ? schoolQ + '&' : '?'}group_id=${groupId}`;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={backLink} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-slate-700 dark:hover:text-slate-200">
        <ArrowLeft className="size-3.5" /> Oturumlara Dön
      </Link>

      {session && (
        <div className="rounded-2xl border border-indigo-200/60 bg-linear-to-r from-indigo-50 to-violet-50/50 p-4 shadow-sm dark:border-indigo-900/40 dark:from-indigo-950/40 dark:to-violet-950/20">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-bold text-base text-indigo-900 dark:text-indigo-100">{session.subjectName}</p>
              <p className="text-sm text-indigo-700 dark:text-indigo-400">
                {session.sessionDate} · {session.startTime}?{session.endTime}
                {session.roomName ? ` · ${session.roomName}` : ''}
              </p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={downloadPdf}>
              <FileDown className="size-4" /> PDF
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Kat?ld?',   value: presentCount, color: 'text-green-600 dark:text-green-400' },
          { label: 'Gelmedi',   value: absentCount,  color: 'text-red-600 dark:text-red-400' },
          { label: 'Mazeretli', value: excusedCount,  color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Belirsiz',  value: unknownCount,  color: 'text-slate-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/50 bg-white/80 p-3 text-center shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-muted-foreground self-center">Toplu i?aret:</span>
          <button onClick={() => markAll('present')} className="rounded-lg border border-green-300 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300">
            <Check className="inline size-3 mr-1" /> Tümü Kat?ld?
          </button>
          <button onClick={() => markAll('absent')} className="rounded-lg border border-red-300 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            <X className="inline size-3 mr-1" /> Tümü Gelmedi
          </button>
        </div>
      )}

      {rows.length === 0 && (
        <div className="rounded-2xl border bg-white/60 p-10 text-center text-muted-foreground dark:bg-zinc-900/40">
          <Users className="mx-auto mb-2 size-8 opacity-30" />
          <p className="text-sm">Bu oturuma atanm?? ö?renci yok.</p>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r, idx) => {
          const statusOpt  = getStatusOpt(r.attendanceStatus);
          const StatusIcon = statusOpt.icon;
          const busy       = updating === r.studentId;
          return (
            <div key={r.id} className={cn('rounded-xl border bg-white/80 p-3 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60', busy && 'opacity-60')}>
              <div className="flex items-center gap-3">
                <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">{idx + 1}</span>
                <div className={cn('rounded-full border p-1.5 shrink-0', statusOpt.bg)}>
                  {busy ? <LoadingSpinner className="size-3.5" /> : <StatusIcon className={cn('size-3.5', statusOpt.color)} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight">{r.student?.studentName ?? '?'}</p>
                  <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    {r.student?.studentNumber && <span>No: {r.student.studentNumber}</span>}
                    {r.student?.className && <span>{r.student.className}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {STATUS_OPTIONS.slice(0, 3).map((opt) => {
                    const Icon   = opt.icon;
                    const active = r.attendanceStatus === opt.value;
                    return (
                      <button key={opt.value ?? 'null'} onClick={() => updateStatus(r.studentId, opt.value as 'present' | 'absent' | 'excused')} disabled={busy}
                        title={opt.label}
                        className={cn('rounded-lg border p-1.5 transition-all',
                          active ? opt.bg + ' ' + opt.color : 'border-slate-200 text-slate-400 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800')}>
                        <Icon className="size-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
