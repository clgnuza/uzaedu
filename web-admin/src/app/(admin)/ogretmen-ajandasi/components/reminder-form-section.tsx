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
}: {
  remindAt?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
  onEnabledChange?: (enabled: boolean) => void;
  /** Verilirse tam kontrollü (görev formu); verilmezse not formu gibi iç durum */
  enabled?: boolean;
}) {
  const [uncontrolledEnabled, setUncontrolledEnabled] = useState(!!remindAt);
  const controlled = controlledEnabled !== undefined;
  const enabled = controlled ? controlledEnabled : uncontrolledEnabled;
  const value = enabled ? (remindAt ?? '') : '';

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <label className="flex cursor-pointer items-center gap-2">
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
          className="rounded"
        />
        <Bell className="size-3.5 shrink-0 text-muted-foreground sm:size-4" />
        <span className="text-xs font-medium sm:text-sm">Hatırlatıcı ekle</span>
      </label>
      {enabled && (
        <div>
          <Label className="text-[11px] sm:text-xs">Hatırlatma tarihi ve saati</Label>
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value || undefined)}
            disabled={disabled}
            className="mt-1 min-h-10 text-sm sm:min-h-11"
          />
        </div>
      )}
    </div>
  );
}
