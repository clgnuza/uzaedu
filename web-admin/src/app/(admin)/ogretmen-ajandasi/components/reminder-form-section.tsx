'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bell } from 'lucide-react';

export function ReminderFormSection({
  remindAt,
  onChange,
  disabled,
  onEnabledChange,
  enabled: controlledEnabled,
  showLeadingBell = true,
}: {
  remindAt?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** Verilirse tam kontrollü (görev formu); verilmezse not formu gibi iç durum */
  enabled?: boolean;
  showLeadingBell?: boolean;
}) {
  const [uncontrolledEnabled, setUncontrolledEnabled] = useState(!!remindAt);
  const controlled = controlledEnabled !== undefined;
  const enabled = controlled ? controlledEnabled : uncontrolledEnabled;
  const value = enabled ? (remindAt ?? '') : '';

  return (
    <div className="space-y-1">
      <label className="flex cursor-pointer items-center gap-1.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            const on = e.target.checked;
            if (!controlled) setUncontrolledEnabled(on);
            if (!on) onChange(undefined);
            onEnabledChange?.(on);
          }}
          disabled={disabled}
          className="size-3.5 rounded border-input"
        />
        {showLeadingBell ? (
          <Bell className="size-3 shrink-0 text-muted-foreground" />
        ) : null}
        <span className="text-[11px] font-medium">Hatırlatıcı ekle</span>
      </label>
      {enabled && (
        <div>
          <Label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Tarih ve saat
          </Label>
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value || undefined)}
            disabled={disabled}
            className="mt-0.5 h-8 rounded-md border-border/80 px-2.5 text-xs"
          />
        </div>
      )}
    </div>
  );
}
