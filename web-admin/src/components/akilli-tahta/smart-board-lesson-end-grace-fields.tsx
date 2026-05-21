'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-background shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

function clampGrace(n: number, max: number): number {
  if (!Number.isFinite(n)) return 10;
  return Math.max(0, Math.min(max, Math.round(n)));
}

export function SmartBoardLessonEndGraceFields({
  enabled,
  onEnabledChange,
  lunchGraceMinutes,
  onLunchGraceChange,
  endOfDayGraceMinutes,
  onEndOfDayGraceChange,
  disabled,
  showToggle = true,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  lunchGraceMinutes: number;
  onLunchGraceChange: (v: number) => void;
  endOfDayGraceMinutes: number;
  onEndOfDayGraceChange: (v: number) => void;
  disabled?: boolean;
  showToggle?: boolean;
}) {
  return (
    <div className="space-y-3">
      {showToggle ? (
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs font-medium sm:text-sm">Ders saati otomasyonu</Label>
          <Toggle checked={enabled} onChange={onEnabledChange} disabled={disabled} />
        </div>
      ) : null}
      <p className="text-[10px] leading-snug text-muted-foreground sm:text-xs">
        Öğle arası başladıktan sonra belirlediğiniz dakikada duyuru TV; son ders bitiminden sonra tahta tam
        kapatılır. Kısa teneffüslerde işlem yapılmaz.
      </p>
      <div
        className={cn(
          'grid gap-3 sm:grid-cols-2',
          !enabled && 'pointer-events-none opacity-50',
        )}
      >
        <div className="space-y-1.5">
          <Label htmlFor="sb-lunch-grace" className="text-[11px] text-muted-foreground">
            Öğle arası → duyuru (dakika)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="sb-lunch-grace"
              type="number"
              min={0}
              max={120}
              step={1}
              value={lunchGraceMinutes}
              disabled={disabled || !enabled}
              onChange={(e) => onLunchGraceChange(clampGrace(Number(e.target.value), 120))}
              className="h-9 w-24 text-sm tabular-nums"
            />
            <span className="text-xs text-muted-foreground">dk sonra</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sb-eod-grace" className="text-[11px] text-muted-foreground">
            Son ders → tahta kapat (dakika)
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="sb-eod-grace"
              type="number"
              min={0}
              max={180}
              step={1}
              value={endOfDayGraceMinutes}
              disabled={disabled || !enabled}
              onChange={(e) => onEndOfDayGraceChange(clampGrace(Number(e.target.value), 180))}
              className="h-9 w-24 text-sm tabular-nums"
            />
            <span className="text-xs text-muted-foreground">dk sonra</span>
          </div>
        </div>
      </div>
    </div>
  );
}
