'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, getApiUrl } from '@/lib/api';
import { COOKIE_SESSION_TOKEN } from '@/lib/auth-session';
import { sorumlulukExamApiQuery } from '@/lib/sorumluluk-exam-school-q';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  TUTANAK_EVRAK_KEYS,
  TUTANAK_EVRAK_LABELS,
  TUTANAK_SESSION_FILTER_LABELS,
  TUTANAK_YAZILI_ONLY,
  appendApiQuery,
  buildTutanakPdfQuery,
  countSessionsForFilter,
  filterSessionsForTutanak,
  formatTutanakSessionLabel,
  type TutanakEvrakKey,
  type TutanakSessionFilter,
  type SessionType,
} from '@/lib/sorumluluk-tutanak-options';
import {
  FileDown, Calendar, Users, UserCheck, LayoutList, ClipboardList, PenSquare,
  BarChart3, BadgeDollarSign, FileText, Info, CalendarDays, AlertCircle,
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

type Session = {
  id: string; subjectName: string; sessionDate: string;
  startTime: string; endTime: string; roomName: string | null;
  studentCount?: number; pairedSessionId?: string | null;
  sessionType?: SessionType;
};

type ExamGroup = { id: string; examType: 'sorumluluk' | 'beceri' };

const REPORT_GROUPS = [
  {
    label: 'Program Raporları',
    items: [
      { key: 'program', icon: Calendar, label: 'Sınav Programı', desc: 'Tüm oturumlar, tarih, saat, salon ve görevliler (A4 yatay).', color: 'indigo', adminOnly: false },
      { key: 'ogrenci-program', icon: LayoutList, label: 'Öğrenci Programı', desc: 'Her öğrencinin hangi derste hangi oturuma atandığı.', color: 'sky', adminOnly: false },
    ],
  },
  {
    label: 'Görevlendirme',
    items: [
      { key: 'gorevlendirme', icon: UserCheck, label: 'Görevlendirme Çizelgesi', desc: 'Komisyon ve gözcüler, oturum bazlı (A4 yatay).', color: 'teal', adminOnly: false },
      { key: 'imza-sirkulu', icon: PenSquare, label: 'Öğretmen İmza Sirkülü', desc: 'Öğretmen başına görev listesi ve imza alanı.', color: 'violet', adminOnly: false },
      { key: 'gorev-dagilimi', icon: BarChart3, label: 'Görev Dağılımı', desc: 'Komisyon/gözcü sayıları ve ek ders saatleri.', color: 'emerald', adminOnly: false },
    ],
  },
  {
    label: 'Resmi Belgeler',
    items: [
      { key: 'ek-ucret-onay', icon: BadgeDollarSign, label: 'Ek Ücret Onay Belgesi', desc: 'MEB ek ders ücreti onay formu (muhasebe).', color: 'amber', adminOnly: true },
      { key: 'tutanak', icon: FileText, label: 'Sınav Tutanakları', desc: 'Oturum başına MEB evrak seti: zarf, esaslar, soru/cevap tutanağı, sınav tutanağı, gelmeyenler (tek PDF).', color: 'rose', adminOnly: false },
    ],
  },
];

const COLOR_MAP: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400',
  sky: 'bg-sky-100 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  teal: 'bg-teal-100 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  violet: 'bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
};

const CARD_BORDER: Record<string, string> = {
  indigo: 'border-indigo-200/50 dark:border-indigo-900/40',
  sky: 'border-sky-200/50 dark:border-sky-900/40',
  teal: 'border-teal-200/50 dark:border-teal-900/40',
  amber: 'border-amber-200/50 dark:border-amber-900/40',
  violet: 'border-violet-200/50 dark:border-violet-900/40',
  emerald: 'border-emerald-200/50 dark:border-emerald-900/40',
  rose: 'border-rose-200/50 dark:border-rose-900/40',
};

function trimHm(t: string) {
  return t?.slice(0, 5) ?? '';
}

function dayHeaderParts(ymd: string) {
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return { weekday: '—', dayNum: '—', monthYear: ymd };
  return {
    weekday: d.toLocaleDateString('tr-TR', { weekday: 'long' }),
    dayNum: d.toLocaleDateString('tr-TR', { day: 'numeric' }),
    monthYear: d.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' }),
  };
}

function yoklamaSessions(list: Session[]) {
  const companionIds = new Set(list.map((s) => s.pairedSessionId).filter((id): id is string => !!id));
  return list
    .filter((s) => !companionIds.has(s.id))
    .map((s) => ({ ...s, startTime: trimHm(s.startTime), endTime: trimHm(s.endTime) }));
}

function groupByDate(sessions: Session[]) {
  const map = new Map<string, Session[]>();
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
  <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-indigo-300/60 bg-indigo-50/40 px-3 py-10 text-center dark:border-indigo-800/40 dark:bg-indigo-950/20 sm:gap-3 sm:rounded-2xl sm:py-16">
    <FileText className="size-10 text-indigo-400" strokeWidth={1.25} />
    <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">Önce bir grup seçin</p>
    <p className="text-xs text-muted-foreground">Gruplar sekmesinden bir sınav grubu seçin.</p>
  </div>
);

export default function RaporlarPage() {
  const searchParams = useSearchParams();
  const { me, token } = useAuth();
  const groupId = searchParams.get('group_id') ?? '';
  const schoolQ = sorumlulukExamApiQuery(me?.role, searchParams.get('school_id'));
  const isAdmin = me?.role !== 'teacher';

  const [sessions, setSessions] = useState<Session[]>([]);
  const [examType, setExamType] = useState<'sorumluluk' | 'beceri'>('sorumluluk');
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [tutanakOpen, setTutanakOpen] = useState(false);
  const [tutanakOturum, setTutanakOturum] = useState<TutanakSessionFilter>('all');
  const [tutanakEvrak, setTutanakEvrak] = useState<Set<TutanakEvrakKey>>(
    () => new Set(TUTANAK_EVRAK_KEYS),
  );
  const [tutanakSessionIds, setTutanakSessionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!groupId || !token) return;
    setLoading(true);
    Promise.all([
      apiFetch<Session[]>(`/sorumluluk-exam/groups/${groupId}/sessions${schoolQ}`, { token }),
      apiFetch<ExamGroup[]>(`/sorumluluk-exam/groups${schoolQ}`, { token }),
    ])
      .then(([sess, groups]) => {
        setSessions(sess);
        const g = groups.find((x) => x.id === groupId);
        if (g?.examType) setExamType(g.examType);
      })
      .catch(() => toast.error('Oturumlar yüklenemedi'))
      .finally(() => setLoading(false));
  }, [groupId, token, schoolQ]);

  const yoklamaList = useMemo(() => yoklamaSessions(sessions), [sessions]);
  const grouped = useMemo(() => groupByDate(yoklamaList), [yoklamaList]);
  const totalStudents = useMemo(
    () => yoklamaList.reduce((a, s) => a + (s.studentCount ?? 0), 0),
    [yoklamaList],
  );

  const downloadPdf = async (path: string, filename: string) => {
    if (!token) {
      toast.error('Oturum gerekli');
      return;
    }
    setDownloading(filename);
    try {
      const headers: Record<string, string> = {};
      if (token !== COOKIE_SESSION_TOKEN) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(getApiUrl(path), {
        credentials: 'include',
        ...(Object.keys(headers).length > 0 && { headers }),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Oturum süresi doldu; yeniden giriş yapın.');
        throw new Error(res.status === 404 ? 'PDF bulunamadı' : 'İndirme başarısız');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('PDF indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Hata');
    } finally {
      setDownloading(null);
    }
  };

  const tutanakVisibleSessions = useMemo(
    () => filterSessionsForTutanak(sessions, tutanakOturum, examType),
    [sessions, tutanakOturum, examType],
  );

  const selectAllTutanakSessions = (filter: TutanakSessionFilter) => {
    const visible = filterSessionsForTutanak(sessions, filter, examType);
    setTutanakSessionIds(new Set(visible.map((s) => s.id)));
  };

  const dl = (key: string) => {
    if (!groupId) return toast.error('Grup seçili değil');
    if (key === 'tutanak') {
      setTutanakOturum('all');
      setTutanakEvrak(new Set(TUTANAK_EVRAK_KEYS));
      selectAllTutanakSessions('all');
      setTutanakOpen(true);
      return;
    }
    void downloadPdf(`/sorumluluk-exam/groups/${groupId}/pdf/${key}${schoolQ}`, `${key}.pdf`);
  };

  const tutanakSelectedCount = tutanakVisibleSessions.filter((s) => tutanakSessionIds.has(s.id)).length;
  const yaziliOnlyDisabled = tutanakOturum === 'uygulama';

  useEffect(() => {
    if (tutanakOturum !== 'uygulama') return;
    setTutanakEvrak((prev) => {
      const next = new Set(prev);
      for (const k of TUTANAK_YAZILI_ONLY) next.delete(k);
      return next.size === prev.size ? prev : next;
    });
  }, [tutanakOturum]);

  const toggleTutanakEvrak = (key: TutanakEvrakKey) => {
    setTutanakEvrak((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleTutanakSession = (id: string) => {
    setTutanakSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const dlTutanak = () => {
    if (!groupId) return toast.error('Grup seçili değil');
    if (!tutanakEvrak.size) return toast.error('En az bir evrak seçin');
    if (!tutanakVisibleSessions.length) return toast.error('Seçilen oturum türü için oturum yok');
    if (!tutanakSelectedCount) return toast.error('En az bir sınav seçin');
    const selectedIds = tutanakVisibleSessions
      .filter((s) => tutanakSessionIds.has(s.id))
      .map((s) => s.id);
    const allSelected = selectedIds.length === tutanakVisibleSessions.length;
    const extra = buildTutanakPdfQuery(
      tutanakOturum,
      [...tutanakEvrak],
      allSelected ? undefined : selectedIds,
    );
    setTutanakOpen(false);
    void downloadPdf(
      appendApiQuery(`/sorumluluk-exam/groups/${groupId}/pdf/tutanak${schoolQ}`, extra),
      'tutanak.pdf',
    );
  };

  const dlYoklama = (sessionId: string, subjectName: string, date: string) => {
    const safe = subjectName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ ]/g, '').trim();
    return downloadPdf(
      `/sorumluluk-exam/sessions/${sessionId}/pdf/yoklama${schoolQ}`,
      `yoklama-${safe}-${date}.pdf`,
    );
  };

  const dlAllYoklama = async () => {
    for (const s of yoklamaList) {
      await dlYoklama(s.id, s.subjectName, s.sessionDate);
      await new Promise((r) => setTimeout(r, 400));
    }
  };

  if (!groupId) return NO_GROUP;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2 dark:border-sky-900/40 dark:bg-sky-950/20 sm:gap-2.5 sm:rounded-xl sm:px-4 sm:py-3">
        <Info className="mt-0.5 size-3.5 shrink-0 text-sky-600 dark:text-sky-400 sm:size-4" />
        <p className="min-w-0 text-[10px] leading-snug text-sky-800 dark:text-sky-300 sm:text-xs">
          Grup raporları tek PDF olarak indirilir. Yoklama listeleri oturum bazlıdır; uygulama eş oturumları yazılı oturumunun yoklamasıyla birlikte gelir.
        </p>
      </div>

      {yoklamaList.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2">
          {[
            { label: 'Gün', value: grouped.length, color: 'text-indigo-600 dark:text-indigo-400' },
            { label: 'Oturum', value: yoklamaList.length, color: 'text-teal-600 dark:text-teal-400' },
            { label: 'Kayıtlı öğrenci', value: totalStudents, color: 'text-amber-600 dark:text-amber-400' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/50 bg-white/80 p-2 text-center shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/60 sm:rounded-2xl sm:p-3">
              <p className={cn('text-lg font-bold tabular-nums sm:text-2xl', s.color)}>{s.value}</p>
              <p className="mt-0.5 text-[9px] text-muted-foreground sm:text-[10px]">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {REPORT_GROUPS.map((group) => {
        const visibleItems = group.items.filter((r) => !r.adminOnly || isAdmin);
        if (!visibleItems.length) return null;
        return (
          <section key={group.label}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3">
              {visibleItems.map((r) => {
                const Icon = r.icon;
                const fname = `${r.key}.pdf`;
                const busy = downloading === fname;
                return (
                  <div
                    key={r.key}
                    className={cn(
                      'flex flex-col rounded-xl border bg-white/80 p-3 shadow-sm dark:bg-zinc-900/60 sm:rounded-2xl sm:p-4',
                      CARD_BORDER[r.color],
                    )}
                  >
                    <div className="mb-2 flex items-start gap-2.5">
                      <div className={cn('rounded-xl p-2.5 shrink-0', COLOR_MAP[r.color])}>
                        <Icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-tight">{r.label}</p>
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{r.desc}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-auto w-full gap-1.5"
                      disabled={!!busy}
                      onClick={() => dl(r.key)}
                    >
                      {busy ? <LoadingSpinner className="size-4" /> : <FileDown className="size-4" />}
                      PDF İndir
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <section>
        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="size-3.5" /> Yoklama listeleri
          </p>
          {yoklamaList.length > 1 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-full gap-1.5 text-xs sm:w-auto"
              disabled={!!downloading}
              onClick={() => void dlAllYoklama()}
            >
              <FileDown className="size-3.5" /> Tümünü indir ({yoklamaList.length})
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        )}

        {!loading && yoklamaList.length === 0 && (
          <div className="rounded-2xl border bg-white/60 p-8 text-center text-muted-foreground dark:bg-zinc-900/40">
            <AlertCircle className="mx-auto mb-2 size-6 opacity-40" />
            <p className="text-sm font-medium">Oturum yok</p>
            <p className="text-xs mt-1 opacity-70">Önce Oturumlar sekmesinden sınav oturumu oluşturun.</p>
          </div>
        )}

        {!loading && grouped.map(([ymd, daySessions]) => {
          const { weekday, dayNum, monthYear } = dayHeaderParts(ymd);
          return (
            <div key={ymd} className="mb-3 space-y-1.5">
              <div className="flex items-center gap-2 rounded-lg bg-slate-100/80 px-2.5 py-1.5 dark:bg-zinc-800/60">
                <CalendarDays className="size-3.5 text-indigo-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold leading-tight capitalize">{weekday}</p>
                  <p className="text-[10px] text-muted-foreground">{dayNum} {monthYear}</p>
                </div>
                <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">{daySessions.length} oturum</span>
              </div>
              {daySessions.map((s) => {
                const fname = `yoklama-${s.subjectName}-${s.sessionDate}.pdf`;
                const busy = downloading === fname;
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-2 rounded-xl border border-white/50 bg-white/70 px-3 py-2.5 shadow-sm dark:border-zinc-800/40 dark:bg-zinc-900/50 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-3"
                  >
                    <div className={cn('shrink-0 rounded-lg p-2', COLOR_MAP.amber)}>
                      <ClipboardList className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-tight">{s.subjectName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {s.startTime}–{s.endTime}
                        {s.roomName ? ` · ${s.roomName}` : ''}
                      </p>
                      {s.studentCount !== undefined && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Users className="size-3" /> {s.studentCount} öğrenci
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-full shrink-0 gap-1.5 sm:w-auto"
                      disabled={busy}
                      onClick={() => dlYoklama(s.id, s.subjectName, s.sessionDate)}
                    >
                      {busy ? <LoadingSpinner className="size-4" /> : <FileDown className="size-4" />}
                      Yoklama
                    </Button>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      <Dialog open={tutanakOpen} onOpenChange={setTutanakOpen}>
        <DialogContent title="Sınav tutanakları — indir" className="max-w-lg">
          <p className="text-xs text-muted-foreground mb-4">
            Oturum türü, sınav adı ve evrakları seçin; tek PDF olarak indirilir.
          </p>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Oturum türü
          </p>
          <div className="flex flex-wrap gap-2 mb-3">
            {(['all', 'yazili', 'uygulama'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setTutanakOturum(f);
                  selectAllTutanakSessions(f);
                }}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  tutanakOturum === f
                    ? 'border-rose-400 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200'
                    : 'border-border text-muted-foreground hover:bg-muted/60',
                )}
              >
                {TUTANAK_SESSION_FILTER_LABELS[f]}
                <span className="ml-1 tabular-nums opacity-70">
                  ({countSessionsForFilter(sessions, f, examType)})
                </span>
              </button>
            ))}
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Sınav adı
              <span className="ml-1 font-normal normal-case tabular-nums text-muted-foreground">
                ({tutanakSelectedCount}/{tutanakVisibleSessions.length})
              </span>
            </p>
            {tutanakVisibleSessions.length > 0 && (
              <button
                type="button"
                className="text-[10px] text-rose-600 hover:underline dark:text-rose-400"
                onClick={() => selectAllTutanakSessions(tutanakOturum)}
              >
                Tümünü seç
              </button>
            )}
          </div>
          {tutanakVisibleSessions.length === 0 ? (
            <p className="mb-4 text-xs text-muted-foreground">Bu türde oturum yok.</p>
          ) : (
            <ul className="mb-4 max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {tutanakVisibleSessions.map((s) => (
                <li key={s.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                      tutanakSessionIds.has(s.id)
                        ? 'border-rose-300 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-950/30'
                        : 'border-border/80',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 shrink-0 accent-rose-600"
                      checked={tutanakSessionIds.has(s.id)}
                      onChange={() => toggleTutanakSession(s.id)}
                    />
                    <span className="min-w-0 leading-snug">{formatTutanakSessionLabel(s)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Evrak türleri
            </p>
            <button
              type="button"
              className="text-[10px] text-rose-600 hover:underline dark:text-rose-400"
              onClick={() => setTutanakEvrak(new Set(TUTANAK_EVRAK_KEYS))}
            >
              Tümünü seç
            </button>
          </div>
          <ul className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {TUTANAK_EVRAK_KEYS.map((key) => {
              const yaziliOnly = TUTANAK_YAZILI_ONLY.includes(key);
              const disabled = yaziliOnly && yaziliOnlyDisabled;
              return (
                <li key={key}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-xs',
                      disabled && 'cursor-not-allowed opacity-45',
                      tutanakEvrak.has(key) && !disabled
                        ? 'border-rose-300 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-950/30'
                        : 'border-border/80',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 shrink-0 accent-rose-600"
                      checked={tutanakEvrak.has(key)}
                      disabled={disabled}
                      onChange={() => !disabled && toggleTutanakEvrak(key)}
                    />
                    <span>
                      {TUTANAK_EVRAK_LABELS[key]}
                      {yaziliOnly && (
                        <span className="block text-[10px] text-muted-foreground">Yalnızca yazılı</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>

          <DialogFooter className="mt-4 border-t border-border/80 pt-4">
            <Button type="button" variant="outline" size="sm" onClick={() => setTutanakOpen(false)}>
              İptal
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              disabled={!!downloading || !tutanakEvrak.size || !tutanakSelectedCount}
              onClick={() => dlTutanak()}
            >
              {downloading === 'tutanak.pdf' ? <LoadingSpinner className="size-4" /> : <FileDown className="size-4" />}
              PDF İndir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
