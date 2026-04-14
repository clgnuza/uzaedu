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
import { Plus, Trash2, Pencil, X, Check, Users, Clock, MapPin, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type SessionType = 'yazili' | 'uygulama' | 'mixed';
type Session = {
  id: string; subjectName: string; sessionDate: string;
  startTime: string; endTime: string; roomName: string | null;
  capacity: number; status: string; sessionType: SessionType; studentCount?: number;
  proctors?: Array<{ userId: string; role: string; displayName: string }>;
};

const SESSION_TYPE_META: Record<SessionType, { label: string; color: string }> = {
  yazili:   { label: 'Yaz?l?',           color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
  uygulama: { label: 'Uygulama',         color: 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300' },
  mixed:    { label: 'Yaz?l? + Uygulama', color: 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300' },
};

const STATUS_COLORS: Record<string, string> = {
  planned:   'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  active:    'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
};
const STATUS_LABELS: Record<string, string>    = { planned: 'Planland?', active: 'S?nav Günü', completed: 'Tamamland?', cancelled: '?ptal' };
const STATUS_NEXT: Record<string, string>      = { planned: 'active', active: 'completed' };
const STATUS_NEXT_LABEL: Record<string, string> = { planned: 'S?nav Ba?las?n', active: 'Tamamla' };

const EMPTY_FORM = { subjectName: '', sessionDate: '', startTime: '09:00', endTime: '10:00', roomName: '', capacity: 30, sessionType: 'yazili' as SessionType };

function dateLabel(date: string) {
  try {
    return new Date(date).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return date; }
}

function groupByDate(sessions: Session[]) {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const k = s.sessionDate ?? 'Tarifsiz';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
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

export default function OturumlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId = searchParams.get('group_id') ?? '';
  const schoolQ = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role !== 'teacher';

  const [sessions, setSessions]   = useState<Session[]>([]);
  const [loading, setLoading]     = useState(!!groupId);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!token || !groupId) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await apiFetch<Session[]>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { token });
      setSessions(data);
    } catch { toast.error('Oturumlar yüklenemedi'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    if (!form.subjectName.trim() || !form.sessionDate || !form.startTime || !form.endTime) return toast.error('Zorunlu alanlar? doldurun');
    const body = { ...form, capacity: Number(form.capacity) };
    try {
      if (editId) {
        await apiFetch(`/sorumluluk-exam/sessions/${editId}${schoolQ}`, { method: 'PATCH', token, body: JSON.stringify(body) });
        toast.success('Güncellendi');
      } else {
        await apiFetch(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { method: 'POST', token, body: JSON.stringify(body) });
        toast.success('Oturum olu?turuldu');
      }
      setShowForm(false); setEditId(null); setForm(EMPTY_FORM);
      void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const del = async (id: string) => {
    if (!confirm('Oturumu silmek istiyor musunuz?')) return;
    try { await apiFetch(`/sorumluluk-exam/sessions/${id}${schoolQ}`, { method: 'DELETE', token }); toast.success('Silindi'); void load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const advanceStatus = async (s: Session) => {
    const next = STATUS_NEXT[s.status];
    if (!next) return;
    try {
      await apiFetch(`/sorumluluk-exam/sessions/${s.id}${schoolQ}`, { method: 'PATCH', token, body: JSON.stringify({ status: next }) });
      toast.success(STATUS_LABELS[next] ?? ''); void load();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Hata'); }
  };

  const startEdit = (s: Session) => {
    setEditId(s.id);
    setForm({ subjectName: s.subjectName, sessionDate: s.sessionDate, startTime: s.startTime, endTime: s.endTime, roomName: s.roomName ?? '', capacity: s.capacity, sessionType: s.sessionType ?? 'yazili' });
    setShowForm(true);
  };

  const toggleDate = (date: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(date) ? n.delete(date) : n.add(date); return n; });

  if (!groupId) return NO_GROUP;
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const grouped       = groupByDate(sessions);
  const totalStudents = sessions.reduce((a, s) => a + (s.studentCount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="text-sm text-muted-foreground">
          {sessions.length} oturum &nbsp;·&nbsp; {totalStudents} ö?renci atand?
        </div>
        {isAdmin && (
          <Button size="sm" className="gap-1.5" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
            <Plus className="size-4" /> Oturum Ekle
          </Button>
        )}
      </div>

      {showForm && isAdmin && (
        <div className="rounded-2xl border bg-white/80 p-4 shadow-sm dark:bg-zinc-900/60 space-y-3">
          <p className="font-semibold text-sm">{editId ? 'Oturum Düzenle' : 'Yeni Oturum'}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input placeholder="Ders Ad? *  (örn: Matematik)" value={form.subjectName} onChange={(e) => setForm((f) => ({ ...f, subjectName: e.target.value }))} />
            <div>
              <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">S?nav Türü</label>
              <div className="flex gap-1">
                {(['yazili', 'uygulama', 'mixed'] as SessionType[]).map((t) => (
                  <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, sessionType: t }))}
                    className={cn('flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-all',
                      form.sessionType === t
                        ? SESSION_TYPE_META[t].color + ' border-current'
                        : 'border-slate-200 text-muted-foreground hover:border-slate-300 dark:border-zinc-700')}>
                    {SESSION_TYPE_META[t].label}
                  </button>
                ))}
              </div>
            </div>
            <Input type="date" value={form.sessionDate} onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))} />
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">Ba?lang?ç</label>
                <Input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-muted-foreground font-semibold block mb-0.5">Biti?</label>
                <Input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Salon (örn: B-201)" value={form.roomName} onChange={(e) => setForm((f) => ({ ...f, roomName: e.target.value }))} className="flex-1" />
              <Input type="number" min={1} max={500} placeholder="Kapasite" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} className="w-24" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}><Check className="size-4 mr-1" /> Kaydet</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}><X className="size-4 mr-1" /> ?ptal</Button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showForm && (
        <div className="rounded-2xl border bg-white/60 p-10 text-center text-muted-foreground dark:bg-zinc-900/40">
          <p className="text-sm font-medium">Henüz oturum yok</p>
          <p className="text-xs mt-1 opacity-70">Her s?nav dersine ait bir oturum olu?turun (tarih, saat, salon, kapasite).</p>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(([date, daySessions]) => {
          const isCollapsed = collapsed.has(date);
          return (
            <div key={date}>
              <button
                onClick={() => toggleDate(date)}
                className="flex w-full items-center gap-2 rounded-xl border border-white/50 bg-white/60 px-4 py-2.5 text-left shadow-sm hover:bg-white/80 dark:border-zinc-800/40 dark:bg-zinc-900/40 dark:hover:bg-zinc-900/60 transition-colors">
                {isCollapsed ? <ChevronRight className="size-4 text-muted-foreground shrink-0" /> : <ChevronDown className="size-4 text-muted-foreground shrink-0" />}
                <div className="flex-1">
                  <span className="font-semibold text-sm">{dateLabel(date)}</span>
                </div>
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {daySessions.length} oturum
                </span>
              </button>

              {!isCollapsed && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {daySessions.map((s) => {
                    const pct  = Math.min(100, Math.round(((s.studentCount ?? 0) / Math.max(s.capacity, 1)) * 100));
                    const full = (s.studentCount ?? 0) >= s.capacity;
                    return (
                      <div key={s.id} className="rounded-2xl border border-white/50 bg-white/80 p-4 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap gap-1 mb-1.5">
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_COLORS[s.status])}>
                                {STATUS_LABELS[s.status] ?? s.status}
                              </span>
                              {s.sessionType && s.sessionType !== 'yazili' && (
                                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', SESSION_TYPE_META[s.sessionType]?.color)}>
                                  {SESSION_TYPE_META[s.sessionType]?.label}
                                </span>
                              )}
                              {full && <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400">Dolu</span>}
                            </div>
                            <p className="font-bold text-sm leading-tight">{s.subjectName}</p>
                          </div>
                          {isAdmin && (
                            <div className="flex gap-1 shrink-0">
                              <button onClick={() => startEdit(s)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/30"><Pencil className="size-3.5" /></button>
                              <button onClick={() => del(s.id)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"><Trash2 className="size-3.5" /></button>
                            </div>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="size-3" />{s.startTime}?{s.endTime}</span>
                          {s.roomName && <span className="flex items-center gap-1"><MapPin className="size-3" />{s.roomName}</span>}
                          <span className="flex items-center gap-1"><Users className="size-3" />{s.studentCount ?? 0}/{s.capacity}</span>
                        </div>

                        <div className="mt-2.5">
                          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800">
                            <div className={cn('h-1.5 rounded-full transition-all', full ? 'bg-red-400' : pct > 75 ? 'bg-amber-400' : 'bg-green-400')} style={{ width: `${pct}%` }} />
                          </div>
                        </div>

                        {s.proctors && s.proctors.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {s.proctors.slice(0, 3).map((p) => (
                              <span key={p.userId + p.role} className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-300">
                                {p.role === 'komisyon_uye' ? '??' : '??'} {p.displayName.split(' ')[0]}
                              </span>
                            ))}
                            {s.proctors.length > 3 && <span className="text-[10px] text-muted-foreground">+{s.proctors.length - 3}</span>}
                          </div>
                        )}

                        {isAdmin && STATUS_NEXT[s.status] && (
                          <div className="mt-3 flex gap-2">
                            <button onClick={() => advanceStatus(s)}
                              className="flex-1 rounded-xl border border-indigo-200 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-950/30 transition-colors">
                              {STATUS_NEXT_LABEL[s.status]}
                            </button>
                            <Link href={`/sorumluluk-sinav/yoklama${schoolQ ? schoolQ + '&' : '?'}session_id=${s.id}&group_id=${groupId}`}
                              className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-colors">
                              Yoklama
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
