'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DdMiniWeekGrid } from '@/components/ders-dagit/dd-mini-week-grid';
import { TeacherAvailabilityAdminEditor } from '@/components/ders-dagit/teacher-availability-admin-editor';
import { TeacherAvailabilityReviewGrid } from '@/components/ders-dagit/teacher-availability-review-grid';
import { DdCard, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import type { PolicyBundle, SubmissionDetail, SubmissionRow } from '@/lib/ders-dagit-teacher-availability';
import { submissionStatusLabel } from '@/lib/ders-dagit-labels';
import { computeReviewSummary } from '@/lib/teacher-availability-review';
import { isSlotBlocked, periodsToBlockedKeys, type UnavailablePeriod } from '@/lib/teacher-availability';
import { cn } from '@/lib/utils';
import { CheckCheck, Clock, Eye, Loader2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  token: string;
  studioId: string;
  workDays: number[];
  maxLessons: number;
  refreshKey?: number;
};

type ListTab = 'pending' | 'approved' | 'rejected' | 'all';

const TAB_LABELS: Record<ListTab, string> = {
  pending: 'Bekleyen',
  approved: 'Onaylanan',
  rejected: 'Reddedilen',
  all: 'Tümü',
};

function filterByTab(rows: SubmissionRow[], tab: ListTab): SubmissionRow[] {
  if (tab === 'pending') return rows.filter((r) => r.status === 'submitted');
  if (tab === 'approved')
    return rows.filter((r) => r.status === 'approved' || r.status === 'partially_approved');
  if (tab === 'rejected') return rows.filter((r) => r.status === 'rejected');
  return rows.filter((r) => r.status !== 'draft');
}

function sortRows(rows: SubmissionRow[], tab: ListTab): SubmissionRow[] {
  return [...rows].sort((a, b) => {
    const ta =
      tab === 'pending'
        ? new Date(a.submitted_at ?? a.updated_at).getTime()
        : new Date(a.reviewed_at ?? a.updated_at).getTime();
    const tb =
      tab === 'pending'
        ? new Date(b.submitted_at ?? b.updated_at).getTime()
        : new Date(b.reviewed_at ?? b.updated_at).getTime();
    return tb - ta;
  });
}

function blockedSlotCount(periods: UnavailablePeriod[], workDays: number[], maxLessons: number): number {
  const keys = periodsToBlockedKeys(periods);
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];
  let n = 0;
  for (const d of days) {
    for (let l = 1; l <= maxLessons; l++) {
      if (isSlotBlocked(keys, d, l)) n++;
    }
  }
  return n;
}

function StatusBadge({ status }: { status: string }) {
  const label = submissionStatusLabel(status);
  const tone =
    status === 'submitted'
      ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
      : status === 'approved' || status === 'partially_approved'
        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
        : status === 'rejected'
          ? 'bg-destructive/15 text-destructive'
          : 'bg-muted text-muted-foreground';
  return <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', tone)}>{label}</span>;
}

export function TeacherAvailabilityAdminQueue({ token, studioId, workDays, maxLessons, refreshKey }: Props) {
  const [policy, setPolicy] = useState<PolicyBundle | null>(null);
  const [allRows, setAllRows] = useState<SubmissionRow[]>([]);
  const [tab, setTab] = useState<ListTab>('pending');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [working, setWorking] = useState<UnavailablePeriod[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const [pol, subs] = await Promise.all([
        apiFetch<PolicyBundle>(`/ders-dagit/studios/${studioId}/teacher-availability/policy`, { token }),
        apiFetch<SubmissionRow[]>(`/ders-dagit/studios/${studioId}/teacher-availability/submissions`, {
          token,
        }).catch(() => []),
      ]);
      setPolicy(pol);
      setAllRows(subs);
    } finally {
      setLoading(false);
    }
  }, [token, studioId]);

  useEffect(() => {
    void loadList();
  }, [loadList, refreshKey]);

  const tabRows = useMemo(() => sortRows(filterByTab(allRows, tab), tab), [allRows, tab]);

  const tabCounts = useMemo(
    () => ({
      pending: filterByTab(allRows, 'pending').length,
      approved: filterByTab(allRows, 'approved').length,
      rejected: filterByTab(allRows, 'rejected').length,
      all: filterByTab(allRows, 'all').length,
    }),
    [allRows],
  );

  useEffect(() => {
    setActiveId((cur) => {
      if (tabRows.length === 0) return null;
      if (cur && tabRows.some((s) => s.id === cur)) return cur;
      return tabRows[0]!.id;
    });
  }, [tabRows, tab]);

  const loadDetail = useCallback(
    async (id: string) => {
      const d = await apiFetch<SubmissionDetail>(
        `/ders-dagit/studios/${studioId}/teacher-availability/submissions/${id}`,
        { token },
      );
      setDetail(d);
      setWorking(d.status === 'submitted' ? d.periods : (d.approved_periods ?? d.periods));
      setReply('');
    },
    [token, studioId],
  );

  useEffect(() => {
    if (activeId) void loadDetail(activeId).catch(() => toast.error('Başvuru yüklenemedi'));
    else setDetail(null);
  }, [activeId, loadDetail]);

  const teacherKeys = useMemo(
    () => (detail ? periodsToBlockedKeys(detail.periods) : new Set<string>()),
    [detail],
  );
  const workingKeys = useMemo(() => periodsToBlockedKeys(working), [working]);
  const differsFromTeacher = useMemo(() => {
    if (teacherKeys.size !== workingKeys.size) return true;
    for (const k of workingKeys) if (!teacherKeys.has(k)) return true;
    for (const k of teacherKeys) if (!workingKeys.has(k)) return true;
    return false;
  }, [teacherKeys, workingKeys]);

  const reviewSummary = useMemo(() => {
    if (!detail || detail.status === 'submitted' || detail.status === 'draft') return null;
    return computeReviewSummary(detail.periods, detail.approved_periods, workDays, maxLessons);
  }, [detail, workDays, maxLessons]);

  const isPending = detail?.status === 'submitted';

  async function moderate(status: 'approved' | 'partially_approved' | 'rejected') {
    if (!activeId || !detail) return;
    setBusy(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studioId}/teacher-availability/submissions/${activeId}`, {
        token,
        method: 'PATCH',
        body: {
          status,
          approved_periods: status === 'rejected' ? undefined : working,
          admin_reply: reply.trim() || undefined,
        },
      });
      toast.success(status === 'rejected' ? 'Başvuru reddedildi' : 'Onay işlendi');
      await loadList();
      setTab(status === 'rejected' ? 'rejected' : 'approved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  }

  const allowPartial = policy?.policy.allow_partial_approval !== false;
  const activeRow = tabRows.find((r) => r.id === activeId);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
      <DdCard variant="sky" className="flex h-fit max-h-[min(80vh,720px)] flex-col overflow-hidden">
        <CardHeader className="shrink-0 space-y-2 border-b border-border/40 pb-2">
          <CardTitle className="text-sm">Başvuru listesi</CardTitle>
          <div className="flex flex-wrap gap-1">
            {(['pending', 'approved', 'rejected', 'all'] as ListTab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                  tab === t
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/80 text-muted-foreground hover:bg-muted',
                )}
              >
                {TAB_LABELS[t]}
                <span className="ml-1 tabular-nums opacity-80">({tabCounts[t]})</span>
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : tabRows.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted-foreground">
              {tab === 'pending' ? 'Onay bekleyen başvuru yok.' : 'Bu sekmede kayıt yok.'}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {tabRows.map((p) => {
                const slots = blockedSlotCount(p.periods, workDays, maxLessons);
                const when =
                  tab === 'pending'
                    ? p.submitted_at
                    : p.reviewed_at ?? p.submitted_at ?? p.updated_at;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setActiveId(p.id)}
                      className={cn(
                        'w-full rounded-xl border p-2.5 text-left transition-colors',
                        activeId === p.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'border-border/60 hover:bg-muted/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 truncate text-sm font-semibold">{p.teacher_name}</p>
                        <StatusBadge status={p.status} />
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <DdMiniWeekGrid
                          mode="teacher"
                          workDays={workDays}
                          maxLessons={maxLessons}
                          periods={p.periods}
                          className="shrink-0"
                        />
                        <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
                          <p className="inline-flex items-center gap-1">
                            <Eye className="size-3 shrink-0" />
                            {slots > 0 ? `${slots} saat uygun değil` : 'Tümü uygun'}
                          </p>
                          {when && (
                            <p className="mt-0.5 tabular-nums">
                              {new Date(when).toLocaleString('tr-TR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          )}
                          {p.teacher_note && (
                            <p className="mt-1 line-clamp-2 text-foreground/70">«{p.teacher_note}»</p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </DdCard>

      <DdCard variant="indigo" className="min-h-[320px]">
        <CardHeader className="border-b border-border/40">
          <CardTitle className="text-base">
            {isPending ? 'Başvuru inceleme' : 'Başvuru önizleme'}
          </CardTitle>
          {!detail && (
            <p className="text-xs text-muted-foreground">Soldan bir başvuru seçin.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          {detail && (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{detail.teacher_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.submitted_at &&
                      `Gönderim: ${new Date(detail.submitted_at).toLocaleString('tr-TR')}`}
                    {detail.reviewed_at &&
                      ` · Karar: ${new Date(detail.reviewed_at).toLocaleString('tr-TR')}`}
                  </p>
                </div>
                <StatusBadge status={detail.status} />
              </div>

              {reviewSummary && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {reviewSummary.approved > 0 && (
                    <span className="rounded-full bg-violet-500/15 px-2 py-0.5 font-medium text-violet-900 dark:text-violet-100">
                      {reviewSummary.approved} onaylı
                    </span>
                  )}
                  {reviewSummary.denied > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-950">
                      {reviewSummary.denied} talep reddedildi
                    </span>
                  )}
                  {reviewSummary.admin_added > 0 && (
                    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 font-medium text-rose-900">
                      {reviewSummary.admin_added} idare ekledi
                    </span>
                  )}
                </div>
              )}

              {detail.teacher_note && (
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <span className="text-xs font-semibold text-muted-foreground">Öğretmen notu</span>
                  <p className="mt-1">{detail.teacher_note}</p>
                </div>
              )}

              {detail.admin_reply && !isPending && (
                <div className="rounded-lg border border-border/60 bg-card px-3 py-2 text-sm">
                  <span className="text-xs font-semibold text-muted-foreground">İdare notu</span>
                  <p className="mt-1">{detail.admin_reply}</p>
                </div>
              )}

              <div className="rounded-lg border border-dashed bg-card/50 p-3">
                <p className="mb-1 text-xs font-semibold">
                  {isPending ? 'Programa işlenecek çizelge (düzenlenebilir)' : 'İdare kararı özeti'}
                </p>
                <p className="mb-3 text-[11px] text-muted-foreground">
                  {isPending
                    ? 'Öğretmen talebini değiştirebilir veya aynen onaylayabilirsiniz.'
                    : 'Mor: onaylanan talep · Sarı: reddedilen talep · Kırmızı: idarenin eklediği kısıt.'}
                </p>
                {isPending ? (
                  <TeacherAvailabilityAdminEditor
                    workDays={workDays}
                    maxLessons={maxLessons}
                    periods={working}
                    onChange={setWorking}
                    teacherRequest={detail.periods}
                    currentApplied={detail.current_applied_periods}
                  />
                ) : (
                  <TeacherAvailabilityReviewGrid
                    workDays={workDays}
                    maxLessons={maxLessons}
                    teacherRequest={detail.periods}
                    approvedPeriods={detail.approved_periods}
                  />
                )}
              </div>

              {isPending && (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setWorking(detail.periods)}
                    >
                      Öğretmen talebine dön
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => setWorking([])}
                    >
                      Tüm saatleri uygun yap
                    </Button>
                  </div>

                  <textarea
                    className="flex min-h-[64px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Öğretmene not (ret veya kısmi onayda önerilir)"
                  />

                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button
                      type="button"
                      className="dd-accent-btn border-0"
                      disabled={busy}
                      onClick={() => {
                        const subset =
                          [...workingKeys].every((k) => teacherKeys.has(k)) &&
                          workingKeys.size <= teacherKeys.size;
                        const full =
                          workingKeys.size === teacherKeys.size &&
                          [...teacherKeys].every((k) => workingKeys.has(k));
                        void moderate(
                          differsFromTeacher
                            ? 'approved'
                            : allowPartial && !full && subset && workingKeys.size > 0
                              ? 'partially_approved'
                              : 'approved',
                        );
                      }}
                    >
                      {busy ? (
                        <Loader2 className="mr-2 size-4 animate-spin" />
                      ) : (
                        <CheckCheck className="mr-2 size-4" />
                      )}
                      {differsFromTeacher
                        ? 'Düzenlenmiş hali kaydet'
                        : allowPartial && workingKeys.size < teacherKeys.size && workingKeys.size > 0
                          ? 'Kısmi onayla'
                          : 'Onayla ve programa işle'}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() => void moderate('rejected')}
                    >
                      <XCircle className="mr-2 size-4" />
                      Başvuruyu reddet
                    </Button>
                  </div>
                </>
              )}

              {!isPending && activeRow && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  Bu başvuru sonuçlandı; yalnızca önizleme görünür.
                </p>
              )}
            </>
          )}
        </CardContent>
      </DdCard>
    </div>
  );
}
