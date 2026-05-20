'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Trash2, Pencil, X, Check, ChevronDown, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type SessionType = 'yazili' | 'uygulama' | 'mixed';
type UygulamaCompanion = {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  roomName: string | null;
};

type Session = {
  id: string;
  subjectName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  roomName: string | null;
  capacity: number;
  status: string;
  sessionType: SessionType;
  studentCount?: number;
  proctors?: Array<{ userId: string; role: string; displayName: string }>;
  uygulamaCompanion?: UygulamaCompanion | null;
  pairedSessionId?: string | null;
};

type EnrichedSession = Session & {
  isUygulamaCompanion: boolean;
  yaziliParentDate?: string;
};

const SESSION_TYPE_META: Record<SessionType, { label: string; color: string; short: string }> = {
  yazili: { label: 'Yazılı', short: 'Y', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200' },
  uygulama: { label: 'Uygulama', short: 'U', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-200' },
  mixed: { label: 'Yazılı + Uygulama', short: 'Y+U', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200' },
};

const STATUS_COLORS: Record<string, string> = {
  planned: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200',
  active: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-200',
  completed: 'bg-slate-200 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200',
  cancelled: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};
const STATUS_LABELS: Record<string, string> = { planned: 'Planlandı', active: 'Sınav günü', completed: 'Tamamlandı', cancelled: 'İptal' };
const STATUS_NEXT: Record<string, string> = { planned: 'active', active: 'completed' };
const STATUS_NEXT_LABEL: Record<string, string> = { planned: 'Sınav başlasın', active: 'Tamamla' };

const EMPTY_FORM = { subjectName: '', sessionDate: '', startTime: '09:00', endTime: '10:00', roomName: '', capacity: 30, sessionType: 'yazili' as SessionType };

function trimHm(t: string) {
  return t?.slice(0, 5) ?? '';
}

function parseDateKey(ymd: string) {
  return new Date(`${ymd}T12:00:00`);
}

function dayHeaderParts(ymd: string) {
  const d = parseDateKey(ymd);
  if (Number.isNaN(d.getTime())) return { weekday: '—', dayNum: '—', monthYear: ymd };
  return {
    weekday: d.toLocaleDateString('tr-TR', { weekday: 'long' }),
    dayNum: d.toLocaleDateString('tr-TR', { day: 'numeric' }),
    monthYear: d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
  };
}

function enrichSessions(list: Session[]): EnrichedSession[] {
  const parentByCompanionId = new Map<string, Session>();
  for (const s of list) {
    if (s.pairedSessionId) parentByCompanionId.set(s.pairedSessionId, s);
  }
  return list.map((s) => {
    const parent = parentByCompanionId.get(s.id);
    return {
      ...s,
      startTime: trimHm(s.startTime),
      endTime: trimHm(s.endTime),
      isUygulamaCompanion: !!parent,
      yaziliParentDate: parent?.sessionDate,
    };
  });
}

function groupByDate(sessions: EnrichedSession[]) {
  const map = new Map<string, EnrichedSession[]>();
  for (const s of sessions) {
    const k = s.sessionDate?.slice(0, 10) || 'Tarihsiz';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(s);
  }
  for (const [, arr] of map) {
    arr.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.subjectName.localeCompare(b.subjectName, 'tr'));
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

const NO_GROUP = (
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/40 px-3 py-10 text-center dark:border-indigo-800/40 dark:bg-indigo-950/20 sm:py-16">
    <CalendarDays className="size-10 text-indigo-400" strokeWidth={1.25} />
    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Önce bir grup seçin</p>
    <p className="text-xs text-muted-foreground">Gruplar sekmesinden bir sınav grubu seçin.</p>
  </div>
);

function SessionRow({
  s,
  isAdmin,
  schoolQ,
  groupId,
  onEdit,
  onDelete,
  onAdvance,
}: {
  s: EnrichedSession;
  isAdmin: boolean;
  schoolQ: string;
  groupId: string;
  onEdit: () => void;
  onDelete: () => void;
  onAdvance: () => void;
}) {
  const full = (s.studentCount ?? 0) >= s.capacity;
  const typeMeta = SESSION_TYPE_META[s.sessionType] ?? SESSION_TYPE_META.yazili;
  const proctorN = s.proctors?.length ?? 0;

  const extraMeta: string[] = [];
  if (s.roomName) extraMeta.push(s.roomName);
  extraMeta.push(`${s.studentCount ?? 0}/${s.capacity}`);
  if (full) extraMeta.push('Dolu');
  if (s.isUygulamaCompanion && s.yaziliParentDate) {
    extraMeta.push(`↳ Yazılı ${dayHeaderParts(s.yaziliParentDate).dayNum}`);
  }
  if (s.sessionType === 'mixed' && s.uygulamaCompanion) {
    extraMeta.push(
      `Uyg. ${dayHeaderParts(s.uygulamaCompanion.sessionDate).dayNum} ${trimHm(s.uygulamaCompanion.startTime)}`,
    );
  }
  if (proctorN > 0) extraMeta.push(`${proctorN} görevli`);

  return (
    <div
      className={cn(
        'grid grid-cols-[4.25rem_minmax(0,1fr)_auto] sm:grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-x-2 px-2 py-1 min-h-8 border-b last:border-b-0 dark:border-zinc-800/80 text-[11px] leading-tight',
        s.isUygulamaCompanion && 'bg-purple-50/50 dark:bg-purple-950/10',
      )}
    >
      <div className="tabular-nums font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
        {s.startTime}–{s.endTime}
      </div>

      <div className="min-w-0 flex flex-wrap items-center gap-x-1 gap-y-0">
        <span className="font-semibold text-xs truncate max-w-40 sm:max-w-none">{s.subjectName}</span>
        <span className={cn('rounded px-1 py-px text-[9px] font-bold shrink-0', typeMeta.color)} title={typeMeta.label}>
          {typeMeta.short}
        </span>
        <span className={cn('rounded px-1 py-px text-[9px] font-semibold shrink-0', STATUS_COLORS[s.status])}>
          {STATUS_LABELS[s.status] ?? s.status}
        </span>
        <span className="text-muted-foreground truncate">{extraMeta.join(' · ')}</span>
      </div>

      <div className="flex items-center gap-0.5 shrink-0">
        {isAdmin && STATUS_NEXT[s.status] && (
          <button
            type="button"
            onClick={onAdvance}
            className="hidden sm:inline px-1 text-[10px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
          >
            {STATUS_NEXT_LABEL[s.status]}
          </button>
        )}
        <Link
          href={`/sorumluluk-sinav/yoklama${schoolQ ? schoolQ + '&' : '?'}session_id=${s.id}&group_id=${groupId}`}
          className="px-1 text-[10px] font-medium text-muted-foreground hover:text-foreground"
        >
          Yoklama
        </Link>
        {isAdmin && (
          <>
            <button type="button" onClick={onEdit} className="p-1 rounded text-muted-foreground hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40" title="Düzenle">
              <Pencil className="size-3" />
            </button>
            <button type="button" onClick={onDelete} className="p-1 rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40" title="Sil">
              <Trash2 className="size-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function OturumlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId = searchParams.get('group_id') ?? '';
  const schoolQ = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role !== 'teacher';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(!!groupId);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const load = async () => {
    if (!token || !groupId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<Session[]>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { token });
      setSessions(data);
    } catch {
      toast.error('Oturumlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  const enriched = useMemo(() => enrichSessions(sessions), [sessions]);
  const grouped = useMemo(() => groupByDate(enriched), [enriched]);

  const stats = useMemo(() => {
    const days = grouped.length;
    const totalStudents = enriched.reduce((a, s) => a + (s.studentCount ?? 0), 0);
    return { days, sessions: enriched.length, students: totalStudents };
  }, [enriched, grouped]);

  const save = async () => {
    if (!form.subjectName.trim() || !form.sessionDate || !form.startTime || !form.endTime) return toast.error('Zorunlu alanları doldurun');
    const body = { ...form, capacity: Number(form.capacity) };
    try {
      type SaveRes = Session & { uygulamaCompanion?: UygulamaCompanion | null };
      let res: SaveRes;
      if (editId) {
        res = await apiFetch<SaveRes>(`/sorumluluk-exam/sessions/${editId}${schoolQ}`, { method: 'PATCH', token, body: JSON.stringify(body) });
        toast.success('Güncellendi');
      } else {
        res = await apiFetch<SaveRes>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { method: 'POST', token, body: JSON.stringify(body) });
        toast.success('Oturum oluşturuldu');
      }
      if (form.sessionType === 'mixed' && res.uygulamaCompanion) {
        const u = res.uygulamaCompanion;
        toast.info(`Uygulama: ${u.sessionDate} ${trimHm(u.startTime)}–${trimHm(u.endTime)} (aynı komisyon)`);
      }
      setShowForm(false);
      setEditId(null);
      setForm(EMPTY_FORM);
      setCollapsed(new Set());
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    }
  };

  const del = async (id: string) => {
    if (!confirm('Oturumu silmek istiyor musunuz?')) return;
    try {
      await apiFetch(`/sorumluluk-exam/sessions/${id}${schoolQ}`, { method: 'DELETE', token });
      toast.success('Silindi');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    }
  };

  const advanceStatus = async (s: Session) => {
    const next = STATUS_NEXT[s.status];
    if (!next) return;
    try {
      await apiFetch(`/sorumluluk-exam/sessions/${s.id}${schoolQ}`, { method: 'PATCH', token, body: JSON.stringify({ status: next }) });
      toast.success(STATUS_LABELS[next] ?? '');
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    }
  };

  const startEdit = (s: EnrichedSession) => {
    setEditId(s.id);
    setForm({
      subjectName: s.subjectName,
      sessionDate: s.sessionDate?.slice(0, 10) ?? '',
      startTime: trimHm(s.startTime),
      endTime: trimHm(s.endTime),
      roomName: s.roomName ?? '',
      capacity: s.capacity,
      sessionType: s.isUygulamaCompanion ? 'uygulama' : (s.sessionType ?? 'yazili'),
    });
    setShowForm(true);
  };

  const toggleDate = (date: string) =>
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(date)) n.delete(date);
      else n.add(date);
      return n;
    });

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(grouped.map(([d]) => d)));

  if (!groupId) return NO_GROUP;
  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>;

  const takvimHref = `/sorumluluk-sinav/takvim${schoolQ ? schoolQ + '&' : '?'}group_id=${groupId}`;

  return (
    <div className="space-y-3 sm:space-y-4">
      {isAdmin && (
        <p className="text-[11px] text-muted-foreground rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CalendarDays className="inline size-3.5 mr-1 text-amber-600" />
          Oturumlar günlük sırayla listelenir. Toplu tarih için{' '}
          <Link href={takvimHref} className="font-semibold text-amber-800 hover:underline dark:text-amber-300">
            Takvim
          </Link>
          .
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Gün', value: stats.days, color: 'text-amber-700 dark:text-amber-300' },
          { label: 'Oturum', value: stats.sessions, color: 'text-indigo-700 dark:text-indigo-300' },
          { label: 'Atanan öğrenci', value: stats.students, color: 'text-sky-700 dark:text-sky-300' },
        ].map((x) => (
          <div key={x.label} className="rounded-lg border bg-white/90 px-2 py-2 text-center dark:bg-zinc-900/70">
            <p className={cn('text-lg font-bold tabular-nums', x.color)}>{x.value}</p>
            <p className="text-[10px] text-muted-foreground">{x.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {grouped.length > 1 && (
          <>
            <button type="button" onClick={expandAll} className="text-[11px] font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
              Tüm günleri aç
            </button>
            <button type="button" onClick={collapseAll} className="text-[11px] text-muted-foreground hover:underline">
              Tümünü kapat
            </button>
          </>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">{stats.sessions} oturum</span>
        {isAdmin && (
          <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => { setEditId(null); setForm(EMPTY_FORM); setShowForm(true); }}>
            <Plus className="size-3.5" /> Oturum ekle
          </Button>
        )}
      </div>

      {grouped.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {grouped.map(([date]) => {
            const { weekday, dayNum, monthYear } = dayHeaderParts(date);
            const dayCount = grouped.find(([d]) => d === date)?.[1].length ?? 0;
            return (
              <button
                key={date}
                type="button"
                onClick={() => {
                  setCollapsed(new Set(grouped.map(([d]) => d).filter((x) => x !== date)));
                  document.getElementById(`day-${date}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="shrink-0 rounded-lg border border-amber-200/80 bg-white px-2.5 py-1.5 text-left hover:bg-amber-50 dark:border-amber-900/50 dark:bg-zinc-900 dark:hover:bg-amber-950/30"
              >
                <p className="text-[10px] font-semibold text-amber-800 dark:text-amber-200 capitalize">{weekday}</p>
                <p className="text-sm font-bold tabular-nums">{dayNum}</p>
                <p className="text-[9px] text-muted-foreground">{monthYear} · {dayCount}</p>
              </button>
            );
          })}
        </div>
      )}

      {showForm && isAdmin && (
        <div className="rounded-xl border bg-white/90 p-3 dark:bg-zinc-900/70 space-y-2.5">
          <p className="text-xs font-semibold">{editId ? 'Oturum düzenle' : 'Yeni oturum'}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input placeholder="Ders adı *" value={form.subjectName} onChange={(e) => setForm((f) => ({ ...f, subjectName: e.target.value }))} />
            <Input type="date" value={form.sessionDate} onChange={(e) => setForm((f) => ({ ...f, sessionDate: e.target.value }))} />
            <div className="flex gap-2">
              <Input type="time" value={form.startTime} className="flex-1" onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
              <Input type="time" value={form.endTime} className="flex-1" onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Input placeholder="Salon" value={form.roomName} className="flex-1" onChange={(e) => setForm((f) => ({ ...f, roomName: e.target.value }))} />
              <Input type="number" min={1} value={form.capacity} className="w-20" onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))} />
            </div>
            <div className="sm:col-span-2">
              <div className="flex gap-1">
                {(['yazili', 'uygulama', 'mixed'] as SessionType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, sessionType: t }))}
                    className={cn(
                      'flex-1 rounded-lg border py-1.5 text-[11px] font-semibold',
                      form.sessionType === t ? SESSION_TYPE_META[t].color + ' border-current' : 'border-slate-200 text-muted-foreground dark:border-zinc-700',
                    )}
                  >
                    {SESSION_TYPE_META[t].label}
                  </button>
                ))}
              </div>
              {form.sessionType === 'mixed' && (
                <p className="text-[10px] text-teal-800 dark:text-teal-300 mt-1">Ertesi gün uygulama + aynı komisyon.</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              <Check className="size-4 mr-1" /> Kaydet
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>
              <X className="size-4 mr-1" /> İptal
            </Button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          <p className="text-sm font-medium">Henüz oturum yok</p>
          <p className="text-xs mt-1">Takvimden slot oluşturup &quot;Oturumlara uygula&quot; kullanın veya tek tek ekleyin.</p>
        </div>
      )}

      <div className="space-y-3">
        {grouped.map(([date, daySessions]) => {
          const isCollapsed = collapsed.has(date);
          const { weekday, dayNum, monthYear } = dayHeaderParts(date);
          const dayStudents = daySessions.reduce((a, s) => a + (s.studentCount ?? 0), 0);
          const timeRange =
            daySessions.length > 0
              ? `${daySessions[0].startTime} – ${daySessions[daySessions.length - 1].endTime}`
              : '';

          return (
            <section key={date} id={`day-${date}`} className="rounded-xl border overflow-hidden bg-white/95 dark:bg-zinc-900/80 shadow-sm">
              <button
                type="button"
                onClick={() => toggleDate(date)}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-linear-to-r from-amber-50 to-white dark:from-amber-950/40 dark:to-zinc-900/60 border-b dark:border-zinc-800 text-left"
              >
                {isCollapsed ? <ChevronRight className="size-3.5 shrink-0 text-amber-700" /> : <ChevronDown className="size-3.5 shrink-0 text-amber-700" />}
                <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                  <span className="text-lg font-bold tabular-nums text-amber-900 dark:text-amber-100">{dayNum}</span>
                  <div className="min-w-0 text-[11px] leading-tight">
                    <p className="font-semibold capitalize text-amber-950 dark:text-amber-50 truncate">{weekday}</p>
                    <p className="text-muted-foreground">{monthYear}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 text-[10px] text-muted-foreground tabular-nums">
                  <span className="font-semibold text-foreground">{daySessions.length} oturum</span>
                  <span className="mx-1">·</span>
                  <span>{dayStudents} öğr.</span>
                  {timeRange && <span className="hidden sm:inline"><span className="mx-1">·</span>{timeRange}</span>}
                </div>
              </button>

              {!isCollapsed && (
                <div>
                  <div className="hidden sm:grid sm:grid-cols-[4.75rem_minmax(0,1fr)_auto] gap-x-2 px-2 py-1 bg-slate-50 dark:bg-zinc-800/50 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground border-b dark:border-zinc-800">
                    <span>Saat</span>
                    <span>Ders / detay</span>
                    <span className="text-right">İşlem</span>
                  </div>
                  {daySessions.map((s) => (
                    <SessionRow
                      key={s.id}
                      s={s}
                      isAdmin={isAdmin}
                      schoolQ={schoolQ}
                      groupId={groupId}
                      onEdit={() => startEdit(s)}
                      onDelete={() => del(s.id)}
                      onAdvance={() => advanceStatus(s)}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
