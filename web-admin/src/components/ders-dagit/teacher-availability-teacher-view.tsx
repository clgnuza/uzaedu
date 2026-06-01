'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { TeacherAvailabilityGrid } from '@/components/ders-dagit/teacher-availability-grid';
import { TeacherAvailabilityReviewGrid } from '@/components/ders-dagit/teacher-availability-review-grid';
import { TeacherAvailabilitySubmissionTimeline } from '@/components/ders-dagit/teacher-availability-submission-timeline';
import { TeacherAvailabilityFlowStepper } from '@/components/ders-dagit/teacher-availability-flow-stepper';
import { computeReviewSummary } from '@/lib/teacher-availability-review';
import { DdCard, CardContent, CardHeader, CardTitle, DdGlassPanel } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api';
import type { PolicyBundle, TeacherAvailabilityContext } from '@/lib/ders-dagit-teacher-availability';
import { submissionStatusLabel } from '@/lib/ders-dagit-labels';
import { periodsToBlockedKeys, type UnavailablePeriod } from '@/lib/teacher-availability';
import {
  buildTeacherAvailabilityFlow,
  formatAvailabilityDeadline,
} from '@/lib/teacher-availability-flow';
import { cn } from '@/lib/utils';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Info,
  Loader2,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  token: string;
  studioId: string;
  workDays: number[];
  maxLessons: number;
};

export function TeacherAvailabilityTeacherView({ token, studioId, workDays, maxLessons }: Props) {
  const [policyBundle, setPolicyBundle] = useState<PolicyBundle | null>(null);
  const [ctx, setCtx] = useState<TeacherAvailabilityContext | null>(null);
  const [periods, setPeriods] = useState<UnavailablePeriod[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [policy, me] = await Promise.all([
      apiFetch<PolicyBundle>(`/ders-dagit/studios/${studioId}/teacher-availability/policy`, { token }),
      apiFetch<TeacherAvailabilityContext>(`/ders-dagit/studios/${studioId}/teacher-availability/me`, { token }),
    ]);
    setPolicyBundle(policy);
    setCtx(me);
    const src = me.submission?.periods?.length ? me.submission.periods : me.applied_periods;
    setPeriods(src);
    setNote(me.submission?.teacher_note ?? '');
  }, [token, studioId]);

  useEffect(() => {
    void load().catch(() => toast.error('Tercih bilgileri yüklenemedi'));
  }, [load]);

  const requireApproval = policyBundle?.policy.require_admin_approval ?? true;
  const readOnly = !ctx?.can_edit;
  const status = ctx?.submission?.status;
  const markedCount = useMemo(() => periodsToBlockedKeys(periods).size, [periods]);
  const deadlineLabel = formatAvailabilityDeadline(policyBundle?.policy.deadline ?? null);

  const flowSteps = useMemo(
    () => (ctx ? buildTeacherAvailabilityFlow(ctx, requireApproval) : []),
    [ctx, requireApproval],
  );

  const showReviewGrid =
    requireApproval &&
    !!ctx?.submission?.reviewed_at &&
    (status === 'approved' || status === 'partially_approved' || status === 'rejected');

  const reviewSummary = useMemo(() => {
    if (!showReviewGrid || !ctx?.submission) return null;
    return computeReviewSummary(
      ctx.submission.periods,
      ctx.submission.approved_periods,
      workDays,
      maxLessons,
    );
  }, [showReviewGrid, ctx?.submission, workDays, maxLessons]);

  async function saveDraft() {
    setBusy(true);
    try {
      const res = await apiFetch<TeacherAvailabilityContext>(
        `/ders-dagit/studios/${studioId}/teacher-availability/draft`,
        {
          token,
          method: 'PUT',
          body: { periods, teacher_note: note.trim() || null },
        },
      );
      setCtx(res);
      toast.success(
        res.can_update_submission
          ? 'Güncelleme kaydedildi — idareye bildirildi'
          : requireApproval
            ? 'Taslak kaydedildi'
            : 'Tercihleriniz programa işlendi',
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!confirm('Gönderiyi taslağa almak istiyor musunuz? İdare onayı beklenmez.')) return;
    setBusy(true);
    try {
      const res = await apiFetch<TeacherAvailabilityContext>(
        `/ders-dagit/studios/${studioId}/teacher-availability/withdraw`,
        { token, method: 'POST', body: {} },
      );
      setCtx(res);
      toast.success('Gönderi geri alındı — taslak olarak düzenleyebilirsiniz');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Geri alınamadı');
    } finally {
      setBusy(false);
    }
  }

  async function deleteAll() {
    if (!confirm('Tüm tercih kaydınız silinecek. Emin misiniz?')) return;
    setBusy(true);
    try {
      const res = await apiFetch<TeacherAvailabilityContext>(
        `/ders-dagit/studios/${studioId}/teacher-availability/me`,
        { token, method: 'DELETE' },
      );
      setCtx(res);
      setPeriods([]);
      setNote('');
      toast.success('Tercihler silindi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Silinemedi');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studioId}/teacher-availability/draft`, {
        token,
        method: 'PUT',
        body: { periods, teacher_note: note.trim() || null },
      });
      const res = await apiFetch<TeacherAvailabilityContext>(
        `/ders-dagit/studios/${studioId}/teacher-availability/submit`,
        { token, method: 'POST', body: { teacher_note: note.trim() || undefined } },
      );
      setCtx(res);
      toast.success('Başvurunuz okul idaresine iletildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  if (!policyBundle || !ctx) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="size-7 animate-spin" />
      </div>
    );
  }

  const collectionOpen = ctx.collection_open;

  return (
    <div className="space-y-4 sm:space-y-5">
      <DdGlassPanel className="overflow-hidden p-0">
        <div className="bg-linear-to-br from-indigo-500/15 via-violet-500/10 to-transparent px-4 py-4 sm:px-5 sm:py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="dd-icon-badge !size-10 shrink-0 !rounded-xl">
                <Sparkles className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">Program öncesi müsaitlik</p>
                <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  Okul ders programını oluşturmadan önce uygun olmadığınız gün ve ders saatlerini bildirin.
                  {requireApproval
                    ? ' İdare onayından sonra çizelgenize işlenir.'
                    : ' Kaydettiğinizde doğrudan çizelgenize yansır.'}
                </p>
              </div>
            </div>
            <StatusPill open={collectionOpen} status={status} />
          </div>
        </div>
      </DdGlassPanel>

      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Başvuru akışı</p>
        <TeacherAvailabilityFlowStepper steps={flowSteps} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <InfoTile
          icon={collectionOpen ? CheckCircle2 : Lock}
          title={collectionOpen ? 'Toplama açık' : 'Toplama kapalı'}
          tone={collectionOpen ? 'open' : 'closed'}
        >
          {collectionOpen
            ? 'Şu anda tercih girebilir veya güncelleyebilirsiniz.'
            : 'Okul henüz pencereyi açmadı. Açıldığında bildirim ve burada uyarı görürsünüz.'}
        </InfoTile>
        <InfoTile icon={ShieldCheck} title="Onay süreci" tone="neutral">
          {requireApproval
            ? 'Gönderdikten sonra idare onaylar veya reddeder; karar bildirimlerde görünür.'
            : 'Bu dönemde idare onayı yok; kayıt doğrudan programa işlenir.'}
        </InfoTile>
        <InfoTile
          icon={CalendarClock}
          title={ctx.deadline_passed ? 'Son tarih geçti' : 'Son tarih'}
          tone={ctx.deadline_passed ? 'closed' : deadlineLabel ? 'warn' : 'neutral'}
        >
          {deadlineLabel
            ? ctx.deadline_passed
              ? 'Artık düzenleme yapılamaz.'
              : `${deadlineLabel} tarihine kadar değiştirebilirsiniz.`
            : 'Okul son tarih belirtmedi — pencere açıkken düzenleyebilirsiniz.'}
        </InfoTile>
      </div>

      {ctx.edit_locked_reason && (
        <div className="flex gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p>{ctx.edit_locked_reason}</p>
        </div>
      )}

      {policyBundle.policy.instruction_text && (
        <div className="flex gap-2 rounded-xl border border-sky-500/30 bg-sky-500/8 px-3 py-2.5 text-sm dark:bg-sky-950/25">
          <Info className="mt-0.5 size-4 shrink-0 text-sky-600 dark:text-sky-400" />
          <p className="leading-relaxed text-foreground/90">{policyBundle.policy.instruction_text}</p>
        </div>
      )}

      {status === 'rejected' && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/8 px-4 py-3 dark:bg-destructive/10">
          <p className="text-sm font-semibold text-destructive">Başvurunuz reddedildi</p>
          {ctx.submission?.admin_reply && (
            <p className="mt-1 text-sm text-muted-foreground">{ctx.submission.admin_reply}</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Pencere açıksa ızgarayı düzenleyip yeniden kaydedin ve idareye gönderin.
          </p>
        </div>
      )}

      {status === 'submitted' && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 dark:bg-amber-950/30">
          <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">İdare incelemesi sürüyor</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ctx.submission?.submitted_at
              ? `Gönderim: ${new Date(ctx.submission.submitted_at).toLocaleString('tr-TR')}. `
              : ''}
            {ctx.can_update_submission
              ? 'Son tarihe kadar ızgarayı güncelleyebilir, gönderiyi geri alabilir veya silebilirsiniz.'
              : 'Onay veya ret geldiğinde bildirim alırsınız.'}
          </p>
          <Button type="button" variant="link" size="sm" className="mt-1 h-auto px-0" asChild>
            <Link href="/bildirimler?filter=timetable">
              <Bell className="mr-1 size-3.5" />
              Bildirimler
            </Link>
          </Button>
        </div>
      )}

      {showReviewGrid && reviewSummary && (
        <div
          className={cn(
            'rounded-xl border px-4 py-3',
            status === 'partially_approved'
              ? 'border-amber-500/35 bg-amber-500/10 dark:bg-amber-950/30'
              : status === 'rejected'
                ? 'border-destructive/35 bg-destructive/8'
                : 'border-emerald-500/35 bg-emerald-500/10 dark:bg-emerald-950/30',
          )}
        >
          <p className="text-sm font-semibold">
            {status === 'partially_approved'
              ? 'İdare kararı: kısmen onaylandı'
              : status === 'rejected'
                ? 'İdare kararı: reddedildi'
                : 'İdare kararı: onaylandı'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {reviewSummary.approved > 0 && `${reviewSummary.approved} saat onaylı kısıt`}
            {reviewSummary.denied > 0 &&
              `${reviewSummary.approved > 0 ? ' · ' : ''}${reviewSummary.denied} talep reddedildi (uygun)`}
            {reviewSummary.admin_added > 0 &&
              ` · ${reviewSummary.admin_added} idare ekledi`}
            {ctx.submission?.reviewed_at &&
              ` · ${new Date(ctx.submission.reviewed_at).toLocaleString('tr-TR')}`}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Aşağıdaki ızgarada mor = onaylanan talep, sarı = reddedilen talep, kırmızı = idarenin eklediği kısıt.
          </p>
          {ctx.submission?.admin_reply && (
            <p className="mt-2 rounded-lg bg-background/60 px-2 py-1.5 text-xs">{ctx.submission.admin_reply}</p>
          )}
        </div>
      )}

      <DdCard variant="indigo" className="overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">
              {showReviewGrid ? 'İdare kararı — haftalık özet' : 'Haftalık uygunluk ızgarası'}
            </CardTitle>
            {!showReviewGrid && (
              <span
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-xs font-medium',
                  markedCount > 0
                    ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {markedCount > 0 ? `${markedCount} uygun değil` : 'Tümü uygun'}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {showReviewGrid
              ? 'İdarenin onayladığı ve reddettiği saatler renklerle gösterilir.'
              : 'Kırmızı = uygun değil · Boş = uygun. Gün başlığına tıklayarak tüm günü kapatabilirsiniz.'}
          </p>
        </CardHeader>
        <CardContent className="pt-4">
          {showReviewGrid && ctx.submission ? (
            <TeacherAvailabilityReviewGrid
              workDays={workDays}
              maxLessons={maxLessons}
              teacherRequest={ctx.submission.periods}
              approvedPeriods={ctx.submission.approved_periods}
            />
          ) : (
            <TeacherAvailabilityGrid
              workDays={workDays}
              maxLessons={maxLessons}
              periods={periods}
              onChange={setPeriods}
              readOnly={readOnly}
            />
          )}
        </CardContent>
      </DdCard>

      <DdCard variant="lavender">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Açıklama notu</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            disabled={readOnly}
            placeholder="Örn. Salı öğleden sonra nöbetim var; Cuma tam gün müsait değilim."
          />
          {(ctx.can_edit || ctx.can_submit) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {ctx.can_edit && (
                <ActionTile
                  icon={ctx.can_update_submission ? Pencil : Save}
                  label={ctx.can_update_submission ? 'Güncellemeyi kaydet' : requireApproval ? 'Taslağı kaydet' : 'Kaydet'}
                  hint={
                    ctx.can_update_submission
                      ? 'İdareye iletilmiş başvuruyu günceller'
                      : 'Henüz göndermeden saklar'
                  }
                  busy={busy}
                  onClick={() => void saveDraft()}
                  variant="primary"
                />
              )}
              {ctx.can_submit && requireApproval && (
                <ActionTile
                  icon={Send}
                  label="İdareye gönder"
                  hint="Onay için okula iletir"
                  busy={busy}
                  disabled={markedCount === 0}
                  onClick={() => void submit()}
                  variant="accent"
                />
              )}
              {ctx.can_withdraw && (
                <ActionTile
                  icon={RotateCcw}
                  label="Gönderiyi geri al"
                  hint="Taslağa döner, yeniden düzenlersiniz"
                  busy={busy}
                  onClick={() => void withdraw()}
                  variant="outline"
                />
              )}
              {ctx.can_delete && (
                <ActionTile
                  icon={Trash2}
                  label="Tercihi sil"
                  hint="Tüm işaretlemeleri kaldırır"
                  busy={busy}
                  onClick={() => void deleteAll()}
                  variant="danger"
                />
              )}
            </div>
          )}
        </CardContent>
      </DdCard>

      {ctx.submission && (
        <TeacherAvailabilitySubmissionTimeline
          submission={ctx.submission}
          requireApproval={requireApproval}
          workDays={workDays}
          maxLessons={maxLessons}
        />
      )}
    </div>
  );
}

function StatusPill({
  open,
  status,
}: {
  open: boolean;
  status?: string;
}) {
  if (!open) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
        <Lock className="size-3.5" />
        Kapalı
      </span>
    );
  }
  if (!status) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
        Açık — henüz başvuru yok
      </span>
    );
  }
  const label = submissionStatusLabel(status);
  const tone =
    status === 'approved' || status === 'partially_approved'
      ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
      : status === 'rejected'
        ? 'bg-destructive/15 text-destructive'
        : status === 'submitted'
          ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
          : 'bg-primary/15 text-primary';
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-1 text-xs font-semibold', tone)}>{label}</span>
  );
}

function InfoTile({
  icon: Icon,
  title,
  children,
  tone,
}: {
  icon: typeof Info;
  title: string;
  children: ReactNode;
  tone: 'open' | 'closed' | 'warn' | 'neutral';
}) {
  const box =
    tone === 'open'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : tone === 'closed'
        ? 'border-border/60 bg-muted/30'
        : tone === 'warn'
          ? 'border-amber-500/35 bg-amber-500/8'
          : 'border-border/60 bg-card/80';
  return (
    <div className={cn('rounded-xl border px-3 py-2.5', box)}>
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs font-semibold">{title}</p>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

function ActionTile({
  icon: Icon,
  label,
  hint,
  busy,
  disabled,
  onClick,
  variant,
}: {
  icon: typeof Save;
  label: string;
  hint: string;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  variant: 'primary' | 'accent' | 'outline' | 'danger';
}) {
  const styles = {
    primary: 'border-primary/30 bg-primary/5 hover:bg-primary/10',
    accent: 'dd-accent-btn border-0 text-primary-foreground hover:opacity-95',
    outline: 'border-border bg-card hover:bg-muted/50',
    danger: 'border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10',
  };
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-50',
        styles[variant],
      )}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background/80 shadow-sm">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
