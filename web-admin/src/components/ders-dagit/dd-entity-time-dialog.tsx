'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DdAccentButton, DdDialogContent } from '@/components/ders-dagit/dd-ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  onApplyAll?: () => void;
  applyAllLabel?: string;
};

export function DdEntityTimeDialog({
  open,
  onOpenChange,
  title,
  children,
  dirty,
  saving,
  onSave,
  onApplyAll,
  applyAllLabel = 'Tümüne uygula',
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DdDialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">Zaman tablosu — {title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[min(70vh,480px)] overflow-y-auto py-1">{children}</div>
        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          {onApplyAll ? (
            <Button type="button" variant="outline" size="sm" onClick={onApplyAll}>
              {applyAllLabel}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Kapat
            </Button>
            {onSave && (
              <DdAccentButton type="button" size="sm" disabled={!dirty || saving} onClick={onSave}>
                {saving ? 'Kaydediliyor…' : 'Tamam'}
              </DdAccentButton>
            )}
          </div>
        </DialogFooter>
      </DdDialogContent>
    </Dialog>
  );
}
