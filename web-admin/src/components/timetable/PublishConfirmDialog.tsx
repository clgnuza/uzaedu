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
import { cn } from '@/lib/utils';
import type { PublishPreview } from '@/lib/ders-dagit-publish';
import { AlertTriangle, CheckCircle2, Circle, XCircle } from 'lucide-react';

export function PublishConfirmDialog({
  open,
  preview,
  validFrom,
  validUntil,
  riskAck,
  onValidFrom,
  onValidUntil,
  onRiskAck,
  onClose,
  onConfirm,
  busy,
}: {
  open: boolean;
  preview: PublishPreview | null;
  validFrom: string;
  validUntil: string;
  riskAck: boolean;
  onValidFrom: (v: string) => void;
  onValidUntil: (v: string) => void;
  onRiskAck: (v: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  if (!preview) return null;

  const canConfirm =
    preview.can_publish && (!preview.requires_risk_ack || riskAck) && !busy;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="border-b bg-gradient-to-r from-primary/10 via-background to-amber-500/10 px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-left">Okul programına yayın onayı</DialogTitle>
            <p className="text-left text-xs font-normal text-muted-foreground">
              Onay sonrası program <strong>Ders Programım</strong> modülünde öğretmen ve veli görünümüne
              aktarılır.
            </p>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-sm font-semibold">{preview.program.name ?? 'Program'}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {preview.entry_count} ders saati
              {preview.program.score != null ? ` · Skor ${preview.program.score}` : ''}
            </p>
          </div>

          <ul className="space-y-2">
            <CheckRow ok={preview.entry_count > 0} label="Yerleşmiş ders saati var" detail={String(preview.entry_count)} />
            <CheckRow ok={preview.clash_count === 0} label="Çakışma yok" detail={String(preview.clash_count)} bad />
            <CheckRow
              ok={preview.validation_error_count === 0}
              label="Doğrulama hatası yok"
              detail={String(preview.validation_error_count)}
              bad
            />
            <CheckRow
              ok={preview.unplaced_count === 0}
              label="Tüm atamalar yerleşti"
              detail={
                preview.unplaced_count > 0
                  ? `${preview.unplaced_count} atama · ${preview.unplaced_hours} saat`
                  : 'Tamam'
              }
              warn={preview.unplaced_count > 0}
            />
          </ul>

          {preview.blockers.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              <p className="font-semibold">Yayın engellendi</p>
              <ul className="mt-1 list-inside list-disc">
                {preview.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.soft_warnings.length > 0 && preview.can_publish && (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-50/80 p-3 text-xs dark:bg-amber-950/30">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={riskAck}
                onChange={(e) => onRiskAck(e.target.checked)}
              />
              <span>
                <span className="flex items-center gap-1 font-semibold text-amber-900 dark:text-amber-100">
                  <AlertTriangle className="size-3.5" />
                  Uyarıları okudum, yine de yayınlıyorum
                </span>
                <ul className="mt-1 list-inside list-disc text-muted-foreground">
                  {preview.soft_warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </span>
            </label>
          )}

          {preview.published_program && (
            <p className="text-[11px] text-muted-foreground">
              Mevcut yayın: <strong>{preview.published_program.name ?? '—'}</strong> — bu işlem yerine geçer.
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Geçerlilik başlangıcı</Label>
              <Input type="date" className="mt-1 h-9" value={validFrom} onChange={(e) => onValidFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Bitiş (opsiyonel)</Label>
              <Input type="date" className="mt-1 h-9" value={validUntil} onChange={(e) => onValidUntil(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/20 px-5 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            İptal
          </Button>
          <Button type="button" disabled={!canConfirm} onClick={onConfirm}>
            {busy ? 'Yayınlanıyor…' : 'Onayla ve yayınla'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CheckRow({
  ok,
  label,
  detail,
  bad,
  warn,
}: {
  ok: boolean;
  label: string;
  detail: string;
  bad?: boolean;
  warn?: boolean;
}) {
  const Icon = ok ? CheckCircle2 : bad ? XCircle : warn ? AlertTriangle : Circle;
  return (
    <li className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-2">
        <Icon
          className={cn(
            'size-4 shrink-0',
            ok && 'text-emerald-600',
            bad && 'text-destructive',
            warn && !ok && 'text-amber-600',
            !ok && !bad && !warn && 'text-muted-foreground',
          )}
        />
        {label}
      </span>
      <span className={cn('text-xs font-medium tabular-nums', bad && !ok && 'text-destructive')}>{detail}</span>
    </li>
  );
}
