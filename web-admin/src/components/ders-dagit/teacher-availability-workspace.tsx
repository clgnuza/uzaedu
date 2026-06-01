'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TeacherAvailabilityGrid } from '@/components/ders-dagit/teacher-availability-grid';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api';
import type {
  PolicyBundle,
  SubmissionRow,
  TeacherAvailabilityContext,
  TeacherAvailabilityPolicy,
} from '@/lib/ders-dagit-teacher-availability';
import { submissionStatusLabel } from '@/lib/ders-dagit-labels';
import type { UnavailablePeriod } from '@/lib/teacher-availability';
import { cn } from '@/lib/utils';
import { BadgeCheck, Clock, Loader2, Send, ShieldCheck, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  token: string;
  studioId: string;
  role: 'school_admin' | 'teacher';
  workDays: number[];
  maxLessons: number;
  /** Admin: belirli öğretmen */
  userId?: string;
  teacherName?: string;
  /** admin-hub: yalnızca ayar + kuyruk */
  view?: 'admin-hub' | 'full';
};

export function TeacherAvailabilityWorkspace({
  token,
  studioId,
  role,
  workDays,
  maxLessons,
  userId,
  teacherName,
  view = 'full',
}: Props) {
  const adminHub = view === 'admin-hub';
  const [policyBundle, setPolicyBundle] = useState<PolicyBundle | null>(null);
  const [ctx, setCtx] = useState<TeacherAvailabilityContext | null>(null);
  const [periods, setPeriods] = useState<UnavailablePeriod[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<SubmissionRow[]>([]);

  const load = useCallback(async () => {
    const policy = await apiFetch<PolicyBundle>(`/ders-dagit/studios/${studioId}/teacher-availability/policy`, {
      token,
    });
    setPolicyBundle(policy);
    if (!adminHub) {
      const meQ =
        role === 'teacher'
          ? ''
          : userId
            ? `?user_id=${encodeURIComponent(userId)}`
            : '';
      const me = await apiFetch<TeacherAvailabilityContext>(
        `/ders-dagit/studios/${studioId}/teacher-availability/me${meQ}`,
        { token },
      );
      setCtx(me);
      const src = me.submission?.periods?.length ? me.submission.periods : me.applied_periods;
      setPeriods(src);
      setNote(me.submission?.teacher_note ?? '');
    } else {
      setCtx(null);
    }
    if (role === 'school_admin') {
      const subs = await apiFetch<SubmissionRow[]>(
        `/ders-dagit/studios/${studioId}/teacher-availability/submissions?status=submitted`,
        { token },
      ).catch(() => []);
      setPending(subs);
    }
  }, [token, studioId, role, userId, adminHub]);

  useEffect(() => {
    void load();
  }, [load]);

  const readOnly = !ctx?.can_edit;
  const status = ctx?.submission?.status;
  const requireApproval = policyBundle?.policy.require_admin_approval ?? true;

  async function saveDraft() {
    setBusy(true);
    try {
      const body: { periods: UnavailablePeriod[]; teacher_note: string | null; user_id?: string } = {
        periods,
        teacher_note: note.trim() || null,
      };
      if (role === 'school_admin' && userId) body.user_id = userId;
      const res = await apiFetch<TeacherAvailabilityContext>(
        `/ders-dagit/studios/${studioId}/teacher-availability/draft`,
        { token, method: 'PUT', body },
      );
      setCtx(res);
      toast.success(policyBundle?.policy.require_admin_approval ? 'Taslak kaydedildi' : 'Programa işlendi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const draftBody: { periods: UnavailablePeriod[]; teacher_note: string | null; user_id?: string } = {
        periods,
        teacher_note: note.trim() || null,
      };
      if (role === 'school_admin' && userId) draftBody.user_id = userId;
      await apiFetch(`/ders-dagit/studios/${studioId}/teacher-availability/draft`, {
        token,
        method: 'PUT',
        body: draftBody,
      });
      const body: { teacher_note?: string; user_id?: string } = { teacher_note: note.trim() || undefined };
      if (role === 'school_admin' && userId) body.user_id = userId;
      const res = await apiFetch<TeacherAvailabilityContext>(
        `/ders-dagit/studios/${studioId}/teacher-availability/submit`,
        { token, method: 'POST', body },
      );
      setCtx(res);
      toast.success('İdare onayına gönderildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gönderilemedi');
    } finally {
      setBusy(false);
    }
  }

  async function patchPolicy(patch: Partial<{ open: boolean; policy: Partial<TeacherAvailabilityPolicy> }>) {
    setBusy(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studioId}/teacher-availability/policy`, {
        token,
        method: 'PATCH',
        body: patch,
      });
      toast.success('Ayarlar güncellendi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function moderate(id: string, decision: 'approved' | 'rejected', reply?: string) {
    setBusy(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studioId}/teacher-availability/submissions/${id}`, {
        token,
        method: 'PATCH',
        body: { status: decision, admin_reply: reply },
      });
      toast.success(decision === 'approved' ? 'Onaylandı — çizelge güncellendi' : 'Reddedildi');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  }

  const statusBadge = useMemo(() => {
    if (!status) return null;
    const tone =
      status === 'approved'
        ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200'
        : status === 'rejected'
          ? 'bg-destructive/15 text-destructive'
          : status === 'submitted'
            ? 'bg-amber-500/15 text-amber-900 dark:text-amber-100'
            : 'bg-muted text-muted-foreground';
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tone)}>
        {status === 'approved' && <BadgeCheck className="size-3.5" />}
        {status === 'rejected' && <XCircle className="size-3.5" />}
        {status === 'submitted' && <Clock className="size-3.5" />}
        {submissionStatusLabel(status)}
      </span>
    );
  }, [status]);

  if (!policyBundle || (!adminHub && !ctx)) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {role === 'school_admin' && (
        <div className="dd-glass-panel space-y-3 rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Okul ayarları</p>
              <p className="text-xs text-muted-foreground">
                Öğretmenler program öncesi uygunluk bildirir; onay sonrası zaman çizelgesine işlenir.
              </p>
            </div>
            {policyBundle.pending_submissions > 0 && (
              <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-100">
                {policyBundle.pending_submissions} bekleyen
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={policyBundle.preference_window_open ? 'secondary' : 'default'}
              disabled={busy}
              onClick={() =>
                void patchPolicy({
                  open: !policyBundle.preference_window_open,
                  policy: { collection_enabled: !policyBundle.preference_window_open },
                })
              }
            >
              {policyBundle.preference_window_open ? 'Tercih toplamayı kapat' : 'Tercih toplamayı aç'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={policyBundle.policy.require_admin_approval ? 'default' : 'outline'}
              disabled={busy}
              onClick={() =>
                void patchPolicy({
                  policy: { require_admin_approval: !policyBundle.policy.require_admin_approval },
                })
              }
            >
              <ShieldCheck className="mr-1 size-3.5" />
              {policyBundle.policy.require_admin_approval ? 'Onay zorunlu' : 'Doğrudan kayıt'}
            </Button>
          </div>
        </div>
      )}

      {!adminHub && !ctx!.collection_open && role === 'teacher' && (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          Okul henüz tercih toplamayı açmadı. Açıldığında bildirim alırsınız.
        </p>
      )}

      {policyBundle.policy.instruction_text && (
        <p className="text-sm text-muted-foreground">{policyBundle.policy.instruction_text}</p>
      )}

      {!adminHub && (
        <>
      <div className="flex flex-wrap items-center gap-2">
        {teacherName ? <span className="text-sm font-medium">{teacherName}</span> : null}
        {statusBadge}
        {ctx!.applied_periods.length > 0 && status === 'approved' && (
          <span className="text-xs text-muted-foreground">Programda {ctx!.applied_periods.length} kısıt aktif</span>
        )}
      </div>

      <TeacherAvailabilityGrid
        workDays={workDays}
        maxLessons={maxLessons}
        periods={periods}
        onChange={setPeriods}
        readOnly={readOnly}
        caption="Uygun olmadığınız gün veya ders saatlerine tıklayın."
      />

      <div className="space-y-2">
        <Label className="text-xs">Not (isteğe bağlı)</Label>
        <textarea
          className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          disabled={readOnly}
          placeholder="Örn. Salı öğleden sonra nöbetim var"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {ctx!.can_edit && (
          <Button type="button" size="sm" disabled={busy} onClick={() => void saveDraft()}>
            {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
            {requireApproval ? 'Taslağı kaydet' : 'Kaydet ve programa işle'}
          </Button>
        )}
        {ctx!.can_submit && requireApproval && (
          <Button type="button" size="sm" className="dd-accent-btn border-0" disabled={busy} onClick={() => void submit()}>
            <Send className="mr-1 size-3.5" />
            İdareye gönder
          </Button>
        )}
      </div>

      {ctx!.submission?.admin_reply && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">İdare yanıtı: </span>
          {ctx!.submission.admin_reply}
        </p>
      )}
        </>
      )}

      {role === 'school_admin' && pending.length > 0 && (
        <div className="dd-glass-panel space-y-3 rounded-xl p-4">
          <p className="text-sm font-semibold">Onay bekleyen başvurular</p>
          <ul className="space-y-2">
            {pending.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{p.teacher_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.periods.length} kısıt · {p.submitted_at ? new Date(p.submitted_at).toLocaleString('tr-TR') : ''}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="sm" disabled={busy} onClick={() => void moderate(p.id, 'approved')}>
                    Onayla
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void moderate(p.id, 'rejected', 'Lütfen uygun saatleri yeniden işaretleyin.')}
                  >
                    Reddet
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
