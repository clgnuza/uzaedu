'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, resolveDefaultApiBase } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import {
  Bell,
  Calendar,
  Clock,
  DoorOpen,
  FileDown,
  GraduationCap,
  Shield,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Assignment = {
  sessionId: string;
  groupId: string;
  groupTitle: string;
  examType: string;
  proctorRole: 'komisyon_uye' | 'gozcu';
  proctorRoleLabel: string;
  subjectName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  roomName: string | null;
  sessionStatus: string;
};

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return d;
  }
}

function fmtDateShort(d: string) {
  try {
    return new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function fmtTime(t: string) {
  try {
    const [h, m] = t.split(':');
    return `${h}:${m ?? '00'}`;
  } catch {
    return t;
  }
}

/** Yerel gün + saat → epoch ms (sıralama / süresi geçti mi). */
function sessionAtMs(sessionDate: string, time: string): number {
  const day = sessionDate.slice(0, 10);
  const parts = time.split(':');
  const hh = Number(parts[0] ?? 0);
  const mm = Number(parts[1] ?? 0);
  const d = new Date(`${day}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`);
  const t = d.getTime();
  return Number.isFinite(t) ? t : 0;
}

export default function SorumlulukBilgilendirmePage() {
  const { token, me } = useAuth();
  const [rows, setRows] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!token || me?.role !== 'teacher') return;
    setLoading(true);
    apiFetch<Assignment[]>('/sorumluluk-exam/my-assignments', { token })
      .then(setRows)
      .catch(() => toast.error('Görevler yüklenemedi'))
      .finally(() => setLoading(false));
  }, [token, me?.role]);

  const downloadYoklama = useCallback(async (sessionId: string, subjectName: string, date: string) => {
    if (!token) return;
    setDownloading(sessionId);
    try {
      const base = resolveDefaultApiBase().replace(/\/$/, '');
      const res = await fetch(`${base}/sorumluluk-exam/sessions/${sessionId}/pdf/yoklama`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const safe = subjectName.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ ]/g, '').trim();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `yoklama-${safe}-${date}.pdf`;
      a.click();
      toast.success('Yoklama PDF indirildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İndirilemedi');
    } finally {
      setDownloading(null);
    }
  }, [token]);

  const { overdue, upcoming } = useMemo(() => {
    const now = Date.now();
    const past: Assignment[] = [];
    const future: Assignment[] = [];
    for (const r of rows) {
      if (sessionAtMs(r.sessionDate, r.endTime) < now) past.push(r);
      else future.push(r);
    }
    past.sort((a, b) => sessionAtMs(b.sessionDate, b.endTime) - sessionAtMs(a.sessionDate, a.endTime));
    future.sort((a, b) => sessionAtMs(a.sessionDate, a.startTime) - sessionAtMs(b.sessionDate, b.startTime));
    return { overdue: past, upcoming: future };
  }, [rows]);

  if (me?.role !== 'teacher') {
    return (
      <div className="rounded-xl border border-dashed border-muted-foreground/30 p-6 text-center text-xs text-muted-foreground sm:rounded-2xl sm:p-10 sm:text-sm">
        Bu sayfa yalnızca öğretmen hesapları içindir.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-teal-200/60 bg-gradient-to-br from-teal-500/[0.12] via-cyan-500/[0.08] to-emerald-500/[0.1] p-4 shadow-sm dark:border-teal-900/40 dark:from-teal-950/50 dark:via-cyan-950/30 dark:to-emerald-950/25 sm:rounded-3xl sm:p-7">
        <div className="pointer-events-none absolute -right-8 -top-8 size-40 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-500/10" />
        <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="flex min-w-0 items-start gap-2 sm:gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/80 shadow-inner ring-2 ring-teal-500/20 dark:bg-zinc-900/80 dark:ring-teal-400/20 sm:size-12 sm:rounded-2xl">
              <Bell className="size-5 text-teal-600 dark:text-teal-400 sm:size-6" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold tracking-tight text-teal-950 dark:text-teal-50 sm:text-xl">
                Sorumluluk sınavı — görevlerim
              </h2>
              <p className="mt-1 max-w-xl text-[11px] leading-snug text-muted-foreground sm:text-sm">
                Size atanan komisyon ve gözcü görevleri aşağıdadır. Veriler yalnızca sizin hesabınıza özel listelenir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl border border-white/50 bg-white/60 px-2.5 py-1.5 text-[10px] font-medium text-teal-900 shadow-sm dark:border-teal-800/40 dark:bg-zinc-900/60 dark:text-teal-100 sm:rounded-2xl sm:px-3 sm:py-2 sm:text-xs">
            <Sparkles className="size-3.5 shrink-0 text-amber-500" />
            {rows.length} görev
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/20 px-4 py-10 text-center sm:rounded-2xl sm:px-6 sm:py-14">
          <GraduationCap className="mx-auto size-8 text-muted-foreground/50 sm:size-10" strokeWidth={1.25} />
          <p className="mt-2 text-xs font-medium text-foreground sm:mt-3 sm:text-sm">Henüz size atanmış bir sınav görevi yok</p>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">
            Okul yöneticisi görevlendirme yaptığında burada göreceksiniz; bildirim de alırsınız.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          {/* Mobilde üstte: yaklaşanlar; lg’de sağ sütun */}
          <section className="order-1 min-w-0 flex-1 space-y-3 lg:order-2 lg:space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200 sm:text-sm">
              Yaklaşan görevler
              {upcoming.length > 0 ? (
                <span className="ml-2 font-mono text-muted-foreground">({upcoming.length})</span>
              ) : null}
            </h3>
            {upcoming.length === 0 ? (
              <p className="rounded-xl border border-dashed border-teal-200/50 bg-teal-500/5 px-4 py-6 text-center text-xs text-muted-foreground dark:border-teal-800/40 sm:text-sm">
                Yaklaşan sınav görevi yok.
              </p>
            ) : (
              <ul className="space-y-3 sm:space-y-4">
                {upcoming.map((r) => (
                  <li
                    key={`${r.sessionId}-${r.proctorRole}`}
                    className="group relative overflow-hidden rounded-xl border border-border/80 bg-card p-3 shadow-sm transition-[box-shadow,transform] hover:shadow-md sm:rounded-2xl sm:p-5"
                  >
                    <div
                      className={cn(
                        'absolute left-0 top-0 h-full w-1 rounded-l-2xl',
                        r.proctorRole === 'gozcu' ? 'bg-amber-500' : 'bg-teal-600',
                      )}
                    />
                    <div className="pl-2.5 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:pl-3">
                      <div className="min-w-0 space-y-1.5 sm:space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:px-2.5 sm:text-[11px]',
                              r.proctorRole === 'gozcu'
                                ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200'
                                : 'bg-teal-100 text-teal-900 dark:bg-teal-950/50 dark:text-teal-200',
                            )}
                          >
                            {r.proctorRole === 'gozcu' ? (
                              <Shield className="mr-1 size-3" />
                            ) : (
                              <GraduationCap className="mr-1 size-3" />
                            )}
                            {r.proctorRoleLabel}
                          </span>
                          <span className="text-[9px] font-medium uppercase text-muted-foreground sm:text-[11px]">
                            {r.examType === 'beceri' ? 'Beceri' : 'Sorumluluk'}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-lg">{r.groupTitle}</h3>
                        <p className="text-xs font-medium text-teal-800 dark:text-teal-200 sm:text-sm">{r.subjectName}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground sm:gap-x-4 sm:text-sm">
                          <span className="inline-flex min-w-0 items-start gap-1 sm:items-center sm:gap-1.5">
                            <Calendar className="mt-0.5 size-3 shrink-0 sm:mt-0 sm:size-3.5" />
                            <span className="wrap-break-word sm:hidden">{fmtDateShort(r.sessionDate)}</span>
                            <span className="hidden wrap-break-word sm:inline">{fmtDate(r.sessionDate)}</span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1 sm:gap-1.5">
                            <Clock className="size-3 shrink-0 sm:size-3.5" />
                            {fmtTime(r.startTime)} – {fmtTime(r.endTime)}
                          </span>
                          {r.roomName ? (
                            <span className="inline-flex min-w-0 max-w-full items-start gap-1 wrap-break-word sm:items-center sm:gap-1.5">
                              <DoorOpen className="mt-0.5 size-3 shrink-0 sm:mt-0 sm:size-3.5" />
                              {r.roomName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 w-full shrink-0 sm:mt-0 sm:w-auto">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 w-full gap-1.5 rounded-lg text-xs sm:h-8 sm:w-auto sm:gap-2 sm:rounded-xl sm:text-sm"
                          disabled={downloading === r.sessionId}
                          onClick={() => void downloadYoklama(r.sessionId, r.subjectName, r.sessionDate)}
                        >
                          {downloading === r.sessionId ? (
                            <LoadingSpinner className="size-4" />
                          ) : (
                            <FileDown className="size-4" />
                          )}
                          Yoklama PDF
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Mobilde altta; lg’de sol sütun — süresi geçen */}
          <section className="order-2 min-w-0 flex-1 space-y-3 border-t border-border/60 pt-6 lg:order-1 lg:border-t-0 lg:border-r lg:pr-8 lg:pt-0">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground sm:text-sm">
              Süresi geçen
              {overdue.length > 0 ? (
                <span className="ml-2 font-mono text-muted-foreground/80">({overdue.length})</span>
              ) : null}
            </h3>
            {overdue.length === 0 ? (
              <p className="rounded-xl border border-dashed border-muted-foreground/25 bg-muted/15 px-4 py-5 text-center text-[11px] text-muted-foreground sm:text-xs">
                Süresi geçen görev yok.
              </p>
            ) : (
              <ul className="space-y-3 sm:space-y-4">
                {overdue.map((r) => (
                  <li
                    key={`${r.sessionId}-${r.proctorRole}`}
                    className="group relative overflow-hidden rounded-xl border border-border/60 bg-muted/20 p-3 opacity-95 shadow-sm transition-[box-shadow,transform] hover:shadow-md sm:rounded-2xl sm:p-5"
                  >
                    <div
                      className={cn(
                        'absolute left-0 top-0 h-full w-1 rounded-l-2xl opacity-80',
                        r.proctorRole === 'gozcu' ? 'bg-amber-500' : 'bg-teal-600',
                      )}
                    />
                    <div className="pl-2.5 sm:flex sm:items-start sm:justify-between sm:gap-4 sm:pl-3">
                      <div className="min-w-0 space-y-1.5 sm:space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide sm:px-2.5 sm:text-[11px]',
                              r.proctorRole === 'gozcu'
                                ? 'bg-amber-100/90 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                                : 'bg-teal-100/90 text-teal-900 dark:bg-teal-950/40 dark:text-teal-200',
                            )}
                          >
                            {r.proctorRole === 'gozcu' ? (
                              <Shield className="mr-1 size-3" />
                            ) : (
                              <GraduationCap className="mr-1 size-3" />
                            )}
                            {r.proctorRoleLabel}
                          </span>
                          <span className="text-[9px] font-medium uppercase text-muted-foreground sm:text-[11px]">
                            {r.examType === 'beceri' ? 'Beceri' : 'Sorumluluk'}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-lg">{r.groupTitle}</h3>
                        <p className="text-xs font-medium text-teal-800/90 dark:text-teal-200/90 sm:text-sm">{r.subjectName}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground sm:gap-x-4 sm:text-sm">
                          <span className="inline-flex min-w-0 items-start gap-1 sm:items-center sm:gap-1.5">
                            <Calendar className="mt-0.5 size-3 shrink-0 sm:mt-0 sm:size-3.5" />
                            <span className="wrap-break-word sm:hidden">{fmtDateShort(r.sessionDate)}</span>
                            <span className="hidden wrap-break-word sm:inline">{fmtDate(r.sessionDate)}</span>
                          </span>
                          <span className="inline-flex min-w-0 items-center gap-1 sm:gap-1.5">
                            <Clock className="size-3 shrink-0 sm:size-3.5" />
                            {fmtTime(r.startTime)} – {fmtTime(r.endTime)}
                          </span>
                          {r.roomName ? (
                            <span className="inline-flex min-w-0 max-w-full items-start gap-1 wrap-break-word sm:items-center sm:gap-1.5">
                              <DoorOpen className="mt-0.5 size-3 shrink-0 sm:mt-0 sm:size-3.5" />
                              {r.roomName}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-3 w-full shrink-0 sm:mt-0 sm:w-auto">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-9 w-full gap-1.5 rounded-lg text-xs sm:h-8 sm:w-auto sm:gap-2 sm:rounded-xl sm:text-sm"
                          disabled={downloading === r.sessionId}
                          onClick={() => void downloadYoklama(r.sessionId, r.subjectName, r.sessionDate)}
                        >
                          {downloading === r.sessionId ? (
                            <LoadingSpinner className="size-4" />
                          ) : (
                            <FileDown className="size-4" />
                          )}
                          Yoklama PDF
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
