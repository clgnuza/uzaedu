'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DdCard,
  CardContent,
  CardHeader,
  CardTitle,
  DD_CARD_CONTENT,
  DD_CARD_HEADER,
} from '@/components/ders-dagit/dd-ui';
import { DdSelect } from '@/components/ders-dagit/dd-select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { programStatusLabel } from '@/lib/ders-dagit-labels';
import { cn } from '@/lib/utils';
import { Building2, Check, Eye, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

type SchoolPlan = { id: string; name: string | null; status: string };

type PlanPreview = {
  plan: { id: string; name: string | null; status: string };
  entry_count: number;
  skipped: number;
  names_fixed: number;
  subject_count: number;
  assignment_count: number;
  subjects: Array<{ name: string; class_hours: Record<string, number> }>;
  assignments: Array<{
    subject_name: string;
    subject_raw?: string;
    class_section: string;
    weekly_hours: number;
    teacher_count: number;
  }>;
};

type Props = {
  onImported?: () => void;
  className?: string;
};

export function SchoolPlanImportPanel({ onImported, className }: Props) {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const [plans, setPlans] = useState<SchoolPlan[]>([]);
  const [planId, setPlanId] = useState('');
  const [preview, setPreview] = useState<PlanPreview | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [replaceSubjects, setReplaceSubjects] = useState(false);
  const [replaceAssignments, setReplaceAssignments] = useState(false);
  const [importSubjects, setImportSubjects] = useState(true);
  const [importAssignments, setImportAssignments] = useState(true);

  const loadPlans = useCallback(async () => {
    if (!token) return;
    const list = await apiFetch<SchoolPlan[]>('/teacher-timetable/plans', { token }).catch(
      () => [] as SchoolPlan[],
    );
    setPlans(list);
    setPlanId((prev) => (prev && list.some((p) => p.id === prev) ? prev : list[0]?.id ?? ''));
  }, [token]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  async function runPreview() {
    if (!token || !studio || !planId) {
      toast.message('Önce bir okul planı seçin');
      return;
    }
    setPreviewBusy(true);
    setPreview(null);
    try {
      const res = await apiFetch<PlanPreview>(
        `/ders-dagit/studios/${studio.id}/import-from-plan/preview`,
        { token, method: 'POST', body: { plan_id: planId } },
      );
      setPreview(res);
      if (!res.assignment_count) {
        toast.message('Bu planda aktarılacak ders satırı bulunamadı');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Önizleme alınamadı');
    } finally {
      setPreviewBusy(false);
    }
  }

  async function runImport() {
    if (!token || !studio || !planId || !preview) return;
    setImportBusy(true);
    try {
      const res = await apiFetch<{
        subjects_created: number;
        subjects_updated: number;
        assignments_created: number;
        assignments_updated: number;
      }>(`/ders-dagit/studios/${studio.id}/import-from-plan`, {
        token,
        method: 'POST',
        body: {
          plan_id: planId,
          replace_subjects: replaceSubjects,
          replace_assignments: replaceAssignments,
          import_subjects: importSubjects,
          import_assignments: importAssignments,
        },
      });
      toast.success(
        `Dersler: +${res.subjects_created} / ~${res.subjects_updated} · Atamalar: +${res.assignments_created} / ~${res.assignments_updated}`,
      );
      setConfirmOpen(false);
      setPreview(null);
      onImported?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aktarım başarısız');
    } finally {
      setImportBusy(false);
    }
  }

  const selectedPlan = plans.find((p) => p.id === planId);

  return (
    <>
      <DdCard variant="mint" className={cn('overflow-hidden', className)}>
        <CardHeader className={DD_CARD_HEADER}>
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="size-4" aria-hidden />
            Mevcut okul programından aktar
          </CardTitle>
        </CardHeader>
        <CardContent className={cn(DD_CARD_CONTENT, 'space-y-3')}>
          <p className="text-xs text-muted-foreground">
            Ders Programı modülündeki yayınlanmış veya taslak plan okunur. Önce önizleyin; onayladıktan sonra ders
            kataloğu ve atamalar stüdyoya yazılır. Baştaki gereksiz virgül gibi karakterler temizlenir.
          </p>
          {plans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Henüz okul planı yok.{' '}
              <a href="/ders-programi" className="font-medium text-primary underline-offset-2 hover:underline">
                Ders Programı
              </a>{' '}
              üzerinden plan yükleyin.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[200px] flex-1 space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Plan</span>
                  <DdSelect
                    className="w-full"
                    value={planId}
                    onValueChange={(v) => {
                      setPlanId(v);
                      setPreview(null);
                    }}
                    options={plans.map((p) => ({
                      value: p.id,
                      label: `${p.name ?? p.id.slice(0, 8)} (${programStatusLabel(p.status)})`,
                    }))}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  disabled={previewBusy || !planId}
                  onClick={() => void runPreview()}
                >
                  {previewBusy ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Eye className="size-3.5" aria-hidden />
                  )}
                  Önizle
                </Button>
              </div>

              {preview && (
                <div className="space-y-3 rounded-xl border border-primary/15 bg-gradient-to-b from-muted/40 to-transparent p-3">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    <span>
                      <strong>{preview.subject_count}</strong> ders
                    </span>
                    <span>
                      <strong>{preview.assignment_count}</strong> atama (şube×ders)
                    </span>
                    <span>
                      <strong>{preview.entry_count}</strong> program hücresi
                    </span>
                    {preview.names_fixed > 0 && (
                      <span className="text-amber-700 dark:text-amber-300">
                        <strong>{preview.names_fixed}</strong> ders adı düzeltildi (virgül vb.)
                      </span>
                    )}
                    {preview.skipped > 0 && (
                      <span className="text-muted-foreground">{preview.skipped} satır atlandı</span>
                    )}
                  </div>
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                    {preview.assignments.slice(0, 12).map((a, i) => (
                      <li key={i} className="flex flex-wrap gap-1 border-b border-border/40 py-1 last:border-0">
                        <span className="font-medium">{a.subject_name}</span>
                        {a.subject_raw ? (
                          <span className="text-muted-foreground line-through">{a.subject_raw}</span>
                        ) : null}
                        <span className="text-muted-foreground">
                          · {a.class_section} · {a.weekly_hours} saat
                          {a.teacher_count > 0 ? ` · ${a.teacher_count} öğr.` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    size="sm"
                    className="gap-1"
                    disabled={!preview.assignment_count}
                    onClick={() => setConfirmOpen(true)}
                  >
                    <Check className="size-3.5" aria-hidden />
                    Onayla ve aktar
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </DdCard>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Okul planını stüdyoya aktar</DialogTitle>
            <DialogDescription>
              {selectedPlan?.name ?? 'Plan'} — {preview?.subject_count ?? 0} ders, {preview?.assignment_count ?? 0}{' '}
              atama yazılacak.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={importSubjects}
                onChange={(e) => setImportSubjects(e.target.checked)}
              />
              Ders kataloğuna yaz (şube saatleri)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={importAssignments}
                onChange={(e) => setImportAssignments(e.target.checked)}
              />
              Ders atamalarını yaz
            </label>
            <label className="flex items-center gap-2 text-destructive">
              <input
                type="checkbox"
                checked={replaceSubjects}
                onChange={(e) => setReplaceSubjects(e.target.checked)}
              />
              Mevcut ders kataloğunu sil (değiştir)
            </label>
            <label className="flex items-center gap-2 text-destructive">
              <input
                type="checkbox"
                checked={replaceAssignments}
                onChange={(e) => setReplaceAssignments(e.target.checked)}
              />
              Mevcut atamaları sil (değiştir)
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={importBusy || (!importSubjects && !importAssignments)}
              onClick={() => void runImport()}
            >
              {importBusy ? 'Aktarılıyor…' : 'Aktar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
