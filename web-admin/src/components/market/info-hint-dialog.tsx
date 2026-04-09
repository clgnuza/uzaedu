'use client';

import { useId, useState, type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function InfoHintDialog({
  label,
  title,
  children,
  className,
  buttonClassName,
}: {
  label: string;
  title: string;
  children: ReactNode;
  className?: string;
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const descId = useId();
  return (
    <span className={cn('inline-flex shrink-0', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          'size-8 text-muted-foreground hover:bg-muted hover:text-foreground',
          buttonClassName,
        )}
        onClick={() => setOpen(true)}
        aria-label={label}
        aria-expanded={open}
        aria-controls={descId}
      >
        <Info className="size-4" strokeWidth={2} />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={title} descriptionId={descId} className="max-w-md">
          <div
            id={descId}
            className="space-y-3 text-sm text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-4"
          >
            {children}
          </div>
        </DialogContent>
      </Dialog>
    </span>
  );
}
