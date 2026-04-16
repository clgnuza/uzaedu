'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Save, UserCheck, X, Search, AlertCircle, BookOpen, Info, Wand2, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Session = {
  id: string; subjectName: string; sessionDate: string;
  startTime: string; endTime: string; roomName: string | null;
  proctors?: Array<{ userId: string; role: string; displayName: string }>;
};
type Teacher = { id: string; display_name: string | null; email: string };
type ProctorEntry = { userId: string; role: 'komisyon_uye' | 'gozcu' };
type TimetableByDate = Record<string, Record<number, { class_section: string; subject: string }>>;

function dateLabel(date: string) {
  try { return new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }); }
  catch { return date; }
}

function dateLabelShort(date: string) {
  try { return new Date(date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }); }
  catch { return date; }
}

const NO_GROUP = (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/40 px-3 py-10 text-center dark:border-indigo-800/40 dark:bg-indigo-950/20 sm:gap-3 sm:rounded-2xl sm:py-16">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-10 text-indigo-400" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Önce bir grup seçin</p>
    <p className="text-xs text-muted-foreground">Gruplar sekmesinden bir s?nav grubu seçin veya olu?turun.</p>
  </div>
);

export default function GorevlendirmePage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId  = searchParams.get('group_id') ?? '';
  const schoolQ  = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isSchoolAdmin = me?.role === 'school_admin';

  const [sessions, setSessions]   = useState<Session[]>([]);
  const [teachers, setTeachers]   = useState<Teacher[]>([]);
  const [loading, setLoading]     = useState(!!groupId);
  const [selected, setSelected]   = useState<string | null>(null);
  const [proctors, setProctors]   = useState<ProctorEntry[]>([]);
  const [saving, setSaving]       = useState(false);
  const [teacherSearch, setTeacherSearch] = useState('');
  const [timetable, setTimetable] = useState<TimetableByDate>({});
  const [timetableLoading, setTimetableLoading] = useState(false);

  const [autoPanel, setAutoPanel]   = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoOpts, setAutoOpts] = useState({
    komisyonPerSession: 1,
    gozcuPerSession: 1,
    preferBranchMatch: true,
    excludeBusy: true,
    balanceLoad: true,
    overwrite: false,
  });

  const load = async () => {
    if (!token || !groupId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        apiFetch<Session[]>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { token }),
        apiFetch<Teacher[]>(`/sorumluluk-exam/teachers${schoolQ}`, { token }),
      ]);
      setSessions(s); setTeachers(t);
    } catch { toast.error('Veri yüklenemedi'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectSession = async (s: Session) => {
    setSelected(s.id);
    setProctors(s.proctors?.map((p) => ({ userId: p.userId, role: p.role as 'komisyon_uye' | 'gozcu' })) ?? []);
    setTeacherSearch('');
    if (isSchoolAdmin && s.sessionDate) {
      setTimetableLoading(true);
      try {
        const data = await apiFetch<TimetableByDate>(`/teacher-timetable/by-date?date=${s.sessionDate}`, { token });
        setTimetable(data);
      } catch {
        setTimetable({});
      } finally {
        setTimetableLoading(false);
      }
    }
  };

  const addProctor = (userId: string, role: 'komisyon_uye' | 'gozcu') => {
    if (proctors.some((p) => p.userId === userId && p.role === role)) return;
    setProctors((prev) => [...prev, { userId, role }]);
  };

  const removeProctor = (userId: string, role: string) => {
    setProctors((prev) => prev.filter((p) => !(p.userId === userId && p.role === role)));
  };

  const runAutoAssign = async () => {
    setAutoRunning(true);
    try {
      const res = await apiFetch<{ assigned: number; total: number }>(
        `/sorumluluk-exam/groups/${groupId}/auto-assign-proctors${schoolQ}`,
        { method: 'POST', token, body: JSON.stringify(autoOpts) },
      );
      toast.success(`${res.assigned}/${res.total} oturuma görevlendirme yap?ld?`);
      void load();
      setAutoPanel(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setAutoRunning(false); }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await apiFetch(`/sorumluluk-exam/sessions/${selected}/proctors${schoolQ}`, {
        method: 'POST', token, body: JSON.stringify({ proctors }),
      });
      toast.success('Görevlendirme kaydedildi');
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
    finally { setSaving(false); }
  };

  const getTeacherLessons = (teacherId: string) => {
    const lessons = timetable[teacherId];
    if (!lessons) return [];
    return Object.entries(lessons).map(([num, info]) => ({ num: parseInt(num), ...info }));
  };

  const filteredTeachers = useMemo(() =>
    teachers.filter((t) => {
      const q = teacherSearch.toLowerCase();
      return !q || (t.display_name ?? t.email).toLowerCase().includes(q);
    }),
    [teachers, teacherSearch]
  );

  if (!groupId) return NO_GROUP;
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const selectedSes       = sessions.find((s) => s.id === selected);
  const komisyonCount     = proctors.filter((p) => p.role === 'komisyon_uye').length;
  const gozcuCount        = proctors.filter((p) => p.role === 'gozcu').length;
  const noProctorSessions = sessions.filter((s) => !s.proctors?.length).length;

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 dark:border-sky-900/40 dark:bg-sky-950/20 sm:gap-2.5 sm:rounded-xl sm:px-4 sm:py-3">
        <Info className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400 sm:size-4" />
        <div className="min-w-0 text-[10px] leading-snug text-sky-800 dark:text-sky-300 sm:text-xs">
          <span className="font-semibold">Nas?l çal???r?</span> Sol taraftan oturumu seçin, sa? taraftan ö?retmeni komisyon üyesi veya gözcü olarak atay?n.
          {isSchoolAdmin && <span> Ders program?n?zdaki çak??malar otomatik kontrol edilir.</span>}
        </div>
      </div>

      {sessions.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {[
            { label: 'Toplam Oturum', value: sessions.length,              color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Görevli Atand?', value: sessions.length - noProctorSessions, color: 'text-teal-600 dark:text-teal-400' },
            { label: 'Atama Bekliyor', value: noProctorSessions,           color: noProctorSessions ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/50 bg-white/80 p-2 text-center shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 sm:rounded-2xl sm:p-3">
              <p className={cn('text-lg font-bold tabular-nums sm:text-2xl', s.color)}>{s.value}</p>
              <p className="mt-0.5 text-[8px] leading-tight text-muted-foreground sm:text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {sessions.length === 0 && (
        <div className="rounded-2xl border bg-white/60 p-8 text-center text-muted-foreground dark:bg-zinc-900/40">
          <AlertCircle className="mx-auto mb-2 size-6 opacity-40" />
          <p className="text-sm font-medium">Oturum bulunamad?</p>
          <p className="text-xs mt-1 opacity-70">Önce Oturumlar sekmesinden s?nav oturumlar? olu?turun.</p>
        </div>
      )}

      {/* Otomatik da??t?m */}
      {sessions.length > 0 && (
        <div className="rounded-2xl border border-violet-200/60 bg-violet-50/50 dark:border-violet-900/30 dark:bg-violet-950/15">
          <button onClick={() => setAutoPanel((v) => !v)}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-left">
            <Wand2 className="size-4 text-violet-600 dark:text-violet-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">Otomatik Görevlendirme Da??t?m?</p>
              <p className="text-[11px] text-violet-700 dark:text-violet-400">Bran? e?le?tirme, ders çak??mas? ve yük dengesi gözetilerek tüm oturumlara toplu atama</p>
            </div>
            <Settings2 className="size-4 text-violet-500 shrink-0" />
            {autoPanel ? <ChevronUp className="size-4 text-violet-500 shrink-0" /> : <ChevronDown className="size-4 text-violet-500 shrink-0" />}
          </button>

          {autoPanel && (
            <div className="border-t border-violet-200/60 px-4 pb-4 pt-3 space-y-4 dark:border-violet-900/30">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Komisyon / Oturum</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setAutoOpts((o) => ({ ...o, komisyonPerSession: Math.max(1, o.komisyonPerSession - 1) }))}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-xs font-bold hover:bg-violet-100 dark:border-violet-800 dark:hover:bg-violet-900/40">?</button>
                    <span className="w-8 text-center text-sm font-bold">{autoOpts.komisyonPerSession}</span>
                    <button onClick={() => setAutoOpts((o) => ({ ...o, komisyonPerSession: Math.min(10, o.komisyonPerSession + 1) }))}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-xs font-bold hover:bg-violet-100 dark:border-violet-800 dark:hover:bg-violet-900/40">+</button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Gözcü / Oturum</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setAutoOpts((o) => ({ ...o, gozcuPerSession: Math.max(0, o.gozcuPerSession - 1) }))}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-xs font-bold hover:bg-violet-100 dark:border-violet-800 dark:hover:bg-violet-900/40">?</button>
                    <span className="w-8 text-center text-sm font-bold">{autoOpts.gozcuPerSession}</span>
                    <button onClick={() => setAutoOpts((o) => ({ ...o, gozcuPerSession: Math.min(10, o.gozcuPerSession + 1) }))}
                      className="rounded-lg border border-violet-200 px-2 py-1 text-xs font-bold hover:bg-violet-100 dark:border-violet-800 dark:hover:bg-violet-900/40">+</button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {([
                  { key: 'preferBranchMatch', label: 'Bran? önceli?i',        desc: 'Dersin bran??ndaki ö?retmenler önce atan?r' },
                  { key: 'excludeBusy',       label: 'Dersi olanlar? atla',   desc: 'O gün ders program?nda dersi olan ö?retmenler hariç tutulur' },
                  { key: 'balanceLoad',       label: 'Yük dengesi',           desc: 'Az görevlendirilen ö?retmenlere öncelik verilir' },
                  { key: 'overwrite',         label: 'Mevcut atamalar? yaz',  desc: 'Zaten görevlisi olan oturumlar? da yeniden da??t' },
                ] as const).map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <div className="mt-0.5 relative">
                      <input type="checkbox" className="sr-only"
                        checked={autoOpts[key]}
                        onChange={(e) => setAutoOpts((o) => ({ ...o, [key]: e.target.checked }))} />
                      <div className={cn('size-4 rounded border-2 transition-colors flex items-center justify-center',
                        autoOpts[key]
                          ? 'bg-violet-600 border-violet-600 dark:bg-violet-500 dark:border-violet-500'
                          : 'border-slate-300 dark:border-zinc-600 group-hover:border-violet-400')}>
                        {autoOpts[key] && <svg className="size-2.5 text-white" fill="none" viewBox="0 0 10 8"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <Button size="sm" onClick={runAutoAssign} disabled={autoRunning}
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700 dark:bg-violet-700 dark:hover:bg-violet-600">
                {autoRunning ? <LoadingSpinner className="size-4" /> : <Wand2 className="size-4" />}
                {autoRunning ? 'Da??t?l?yor...' : `Tüm ${sessions.length} Oturuma Otomatik Da??t`}
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Sol: Oturumlar */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">1 ? Oturum Seç</p>
          {sessions.map((s) => {
            const komisyon = s.proctors?.filter((p) => p.role === 'komisyon_uye').length ?? 0;
            const gozcu    = s.proctors?.filter((p) => p.role === 'gozcu').length ?? 0;
            return (
              <button key={s.id} onClick={() => selectSession(s)}
                className={cn('w-full text-left rounded-xl border px-4 py-3 transition-all',
                  s.id === selected
                    ? 'border-teal-400 bg-teal-50 dark:border-teal-700 dark:bg-teal-950/30 shadow-sm'
                    : 'border-white/50 bg-white/70 hover:bg-white/90 hover:border-teal-200 dark:border-zinc-800/40 dark:bg-zinc-900/50')}>
                <p className="font-semibold text-sm">{s.subjectName}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dateLabel(s.sessionDate)} · {s.startTime}–{s.endTime}
                  {s.roomName ? ` · ${s.roomName}` : ''}
                </p>
                <div className="mt-1.5 flex gap-1.5 flex-wrap">
                  {komisyon > 0 && (
                    <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                      ?? {komisyon} Komisyon
                    </span>
                  )}
                  {gozcu > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      ?? {gozcu} Gözcü
                    </span>
                  )}
                  {komisyon === 0 && gozcu === 0 && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-zinc-800/50 dark:text-slate-400">
                      Görevli yok
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Sa?: Görevlendirme */}
        <div className="space-y-3">
          {!selected ? (
            <div className="rounded-2xl border bg-white/60 p-8 text-center text-muted-foreground dark:bg-zinc-900/40">
              <UserCheck className="mx-auto mb-2 size-8 opacity-30" />
              <p className="text-sm font-medium">Oturum seçin</p>
              <p className="text-xs mt-1 opacity-70">Sol taraftan bir s?nav oturumu seçerek komisyon üyesi ve gözcü atayabilirsiniz.</p>
            </div>
          ) : selectedSes ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">2 ? Görevli Ata</p>

              <div className="rounded-lg border border-teal-300/60 bg-teal-50/60 px-3 py-2 dark:border-teal-800/30 dark:bg-teal-950/20 sm:rounded-xl sm:px-4 sm:py-3">
                <p className="text-xs font-bold text-teal-900 dark:text-teal-100 sm:text-sm">{selectedSes.subjectName}</p>
                <p className="mt-0.5 break-words text-[10px] text-teal-700 dark:text-teal-400 sm:text-xs">
                  <span className="sm:hidden">{dateLabelShort(selectedSes.sessionDate)}</span>
                  <span className="hidden sm:inline">{dateLabel(selectedSes.sessionDate)}</span>
                  {' · '}
                  {selectedSes.startTime}–{selectedSes.endTime}
                </p>
                {isSchoolAdmin && timetableLoading && (
                  <div className="text-[10px] text-teal-600 mt-1 flex items-center gap-1">
                    <LoadingSpinner className="size-3" /> Ders program? kontrol ediliyor...
                  </div>
                )}
                {isSchoolAdmin && !timetableLoading && Object.keys(timetable).length > 0 && (
                  <p className="text-[10px] text-teal-600 dark:text-teal-400 mt-1">
                    ? Ders program? çak??malar? a?a??da gösterilmektedir
                  </p>
                )}
              </div>

              <div className="flex gap-1.5 sm:gap-2">
                <div className="flex-1 rounded-lg border border-indigo-200/60 bg-indigo-50/60 px-2 py-2 text-center dark:border-indigo-900/30 dark:bg-indigo-950/20 sm:rounded-xl sm:px-3 sm:py-2.5">
                  <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300 sm:text-xl">{komisyonCount}</p>
                  <p className="text-[9px] font-medium text-indigo-600 dark:text-indigo-400 sm:text-[10px]">Komisyon Üyesi</p>
                </div>
                <div className="flex-1 rounded-lg border border-amber-200/60 bg-amber-50/60 px-2 py-2 text-center dark:border-amber-900/30 dark:bg-amber-950/20 sm:rounded-xl sm:px-3 sm:py-2.5">
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300 sm:text-xl">{gozcuCount}</p>
                  <p className="text-[9px] font-medium text-amber-600 dark:text-amber-400 sm:text-[10px]">Gözcü</p>
                </div>
              </div>

              {proctors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">Atanan Görevliler</p>
                  {proctors.map((p, i) => {
                    const t       = teachers.find((t) => t.id === p.userId);
                    const lessons = getTeacherLessons(p.userId);
                    return (
                      <div key={i} className="flex items-center gap-2 rounded-lg border bg-white/70 px-3 py-2 dark:bg-zinc-900/50">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0',
                          p.role === 'komisyon_uye'
                            ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300')}>
                          {p.role === 'komisyon_uye' ? 'Komisyon' : 'Gözcü'}
                        </span>
                        <span className="flex-1 text-sm">{t?.display_name ?? t?.email ?? p.userId}</span>
                        {lessons.length > 0 && (
                          <span title={`Bu gün: ${lessons.map(l => `${l.num}. saat ${l.class_section}`).join(', ')}`}
                            className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                            ? {lessons.length} ders
                          </span>
                        )}
                        <button onClick={() => removeProctor(p.userId, p.role)} className="text-muted-foreground hover:text-red-600 shrink-0 ml-1">
                          <X className="size-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">Ö?retmen Listesi</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input placeholder="Ö?retmen ara..." value={teacherSearch} onChange={(e) => setTeacherSearch(e.target.value)} className="pl-9 h-8 text-sm" />
                </div>

                <div className="rounded-xl border bg-white/60 dark:bg-zinc-900/40 max-h-60 overflow-y-auto divide-y dark:divide-zinc-800/50">
                  {filteredTeachers.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center p-4">Ö?retmen bulunamad?</p>
                  )}
                  {filteredTeachers.map((t) => {
                    const isKomisyon = proctors.some((p) => p.userId === t.id && p.role === 'komisyon_uye');
                    const isGozcu    = proctors.some((p) => p.userId === t.id && p.role === 'gozcu');
                    const lessons    = getTeacherLessons(t.id);
                    const hasBusy    = lessons.length > 0;
                    return (
                      <div key={t.id} className={cn('flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-800/60',
                        hasBusy && 'bg-amber-50/40 dark:bg-amber-950/10')}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight">{t.display_name ?? t.email}</p>
                          {hasBusy && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <BookOpen className="size-2.5 text-amber-500 shrink-0" />
                              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                Bu gün {lessons.length} dersi var:&nbsp;
                                {lessons.slice(0, 3).map((l) => `${l.num}. saat ${l.class_section}`).join(', ')}
                                {lessons.length > 3 ? ` +${lessons.length - 3}` : ''}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => addProctor(t.id, 'komisyon_uye')} disabled={isKomisyon}
                            className={cn('rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors',
                              isKomisyon
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 cursor-default dark:bg-indigo-950/40 dark:text-indigo-300'
                                : 'text-indigo-700 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-950/40')}>
                            {isKomisyon ? '? Komisyon' : 'Komisyon'}
                          </button>
                          <button onClick={() => addProctor(t.id, 'gozcu')} disabled={isGozcu}
                            className={cn('rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors',
                              isGozcu
                                ? 'bg-amber-100 text-amber-700 border-amber-200 cursor-default dark:bg-amber-950/40 dark:text-amber-300'
                                : 'text-amber-700 border-amber-200 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:hover:bg-amber-950/40')}>
                            {isGozcu ? '? Gözcü' : 'Gözcü'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <Button size="sm" className="w-full gap-1.5 bg-teal-600 hover:bg-teal-700 dark:bg-teal-700 dark:hover:bg-teal-600" onClick={save} disabled={saving}>
                {saving ? <LoadingSpinner className="size-4" /> : <Save className="size-4" />}
                Görevlendirmeyi Kaydet
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
