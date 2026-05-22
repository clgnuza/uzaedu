'use client';

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { AlertTriangle } from 'lucide-react';

export type PublishSummary = {
  programName: string | null;
  entryCount: number;
  clashCount: number;
  unplacedCount: number;
  validationErrors: number;
  diffSummary?: string | null;
};

export function PublishConfirmDialog({
  open,
  summary,
  validFrom,
  validUntil,
  onValidFrom,
  onValidUntil,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  summary: PublishSummary | null;
  validFrom: string;
  validUntil: string;
  onValidFrom: (v: string) => void;
  onValidUntil: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!summary) return null;
  const risky = summary.clashCount > 0 || summary.unplacedCount > 0 || summary.validationErrors > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Yayın onayı</DialogTitle>
        </DialogHeader>
        <ul className="space-y-1 text-sm">
          <li>
            Program: <strong>{summary.programName ?? '—'}</strong>
          </li>
          <li>Slot: <strong>{summary.entryCount}</strong></li>
          <li className={summary.clashCount ? 'text-destructive' : ''}>
            Çakışma: <strong>{summary.clashCount}</strong>
          </li>
          <li className={summary.unplacedCount ? 'text-amber-700' : ''}>
            Yerleşmemiş atama: <strong>{summary.unplacedCount}</strong>
          </li>
          {summary.diffSummary && <li className="text-muted-foreground">{summary.diffSummary}</li>}
        </ul>
        {risky && (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/80 p-2 text-xs dark:bg-amber-950/30">
            <AlertTriangle className="size-4 shrink-0" />
            Sorunlar var; yine de yayınlamak okul programını etkiler.
          </p>
        )}
        <div className="flex gap-2">
          <div className="flex-1">
            <Label className="text-xs">Başlangıç</Label>
            <Input type="date" className="h-9" value={validFrom} onChange={(e) => onValidFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <Label className="text-xs">Bitiş (ops.)</Label>
            <Input type="date" className="h-9" value={validUntil} onChange={(e) => onValidUntil(e.target.value)} />
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Yayın sonrası öğretmen/veli görünümleri güncellenir. Geri almak için yeni program üretin veya editörden düzenleyin.
        </p>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button type="button" disabled={busy} onClick={onConfirm}>
            {busy ? 'Yayınlanıyor…' : 'Yayınla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
