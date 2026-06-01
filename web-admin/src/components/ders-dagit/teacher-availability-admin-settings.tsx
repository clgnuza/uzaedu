'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api';
import type { PolicyBundle, TeacherAvailabilityPolicy } from '@/lib/ders-dagit-teacher-availability';
import { workflowStatusLabel } from '@/lib/ders-dagit-labels';
import { Loader2, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

type Props = {
  token: string;
  studioId: string;
  onUpdated?: () => void;
};

export function TeacherAvailabilityAdminSettings({ token, studioId, onUpdated }: Props) {
  const [bundle, setBundle] = useState<PolicyBundle | null>(null);
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [deadline, setDeadline] = useState('');

  const load = useCallback(async () => {
    const policy = await apiFetch<PolicyBundle>(`/ders-dagit/studios/${studioId}/teacher-availability/policy`, {
      token,
    });
    setBundle(policy);
    setInstruction(policy.policy.instruction_text ?? '');
    setDeadline(policy.policy.deadline ? policy.policy.deadline.slice(0, 16) : '');
  }, [token, studioId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function patchPolicy(patch: Partial<{ open: boolean; policy: Partial<TeacherAvailabilityPolicy> }>) {
    setBusy(true);
    try {
      await apiFetch(`/ders-dagit/studios/${studioId}/teacher-availability/policy`, {
        token,
        method: 'PATCH',
        body: patch,
      });
      toast.success('Kaydedildi');
      await load();
      onUpdated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Güncellenemedi');
    } finally {
      setBusy(false);
    }
  }

  async function saveMeta() {
    await patchPolicy({
      policy: {
        instruction_text: instruction.trim() || null,
        deadline: deadline.trim() ? new Date(deadline).toISOString() : null,
      },
    });
  }

  if (!bundle) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const p = bundle.policy;

  return (
    <div className="dd-glass-panel space-y-4 rounded-xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Müsaitlik toplama ayarları</p>
          <p className="text-xs text-muted-foreground">
            Pencere, onay kuralları ve öğretmene gösterilecek yönergeler.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-medium text-violet-900 dark:text-violet-100">
            {workflowStatusLabel(bundle.workflow_status)}
          </span>
          {bundle.pending_submissions > 0 && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:text-amber-100">
              {bundle.pending_submissions} bekleyen başvuru
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={bundle.preference_window_open ? 'secondary' : 'default'}
          disabled={busy}
          onClick={() =>
            void patchPolicy({
              open: !bundle.preference_window_open,
              policy: { collection_enabled: !bundle.preference_window_open },
            })
          }
        >
          {bundle.preference_window_open ? 'Tercih penceresini kapat' : 'Tercih penceresini aç'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={p.require_admin_approval ? 'default' : 'outline'}
          disabled={busy}
          onClick={() => void patchPolicy({ policy: { require_admin_approval: !p.require_admin_approval } })}
        >
          <ShieldCheck className="mr-1 size-3.5" />
          {p.require_admin_approval ? 'İdare onayı: açık' : 'İdare onayı: kapalı'}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2.5">
          <span className="text-xs">
            <span className="font-medium">Kısmi onay</span>
            <span className="mt-0.5 block text-muted-foreground">Talebin bir bölümünü onaylayabilirsiniz</span>
          </span>
          <Switch
            checked={p.allow_partial_approval}
            disabled={busy}
            onCheckedChange={(v) => void patchPolicy({ policy: { allow_partial_approval: v } })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-lg border bg-card/60 px-3 py-2.5">
          <span className="text-xs">
            <span className="font-medium">Açılış bildirimi</span>
            <span className="mt-0.5 block text-muted-foreground">Pencere açılınca öğretmenlere haber</span>
          </span>
          <Switch
            checked={p.notify_teachers_on_open}
            disabled={busy}
            onCheckedChange={(v) => void patchPolicy({ policy: { notify_teachers_on_open: v } })}
          />
        </label>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Öğretmen yönergesi</Label>
        <textarea
          className="flex min-h-[72px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Örn. Sadece kesin müsait olmadığınız saatleri işaretleyin."
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Son gönderim tarihi (isteğe bağlı)</Label>
        <input
          type="datetime-local"
          className="flex h-9 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </div>
      <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void saveMeta()}>
        Yönerge ve tarihi kaydet
      </Button>
    </div>
  );
}
