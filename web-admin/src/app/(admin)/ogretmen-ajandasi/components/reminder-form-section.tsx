'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Bell } from 'lucide-react';

export function ReminderFormSection({
  remindAt,
  onChange,
  disabled,
}: {
  remindAt?: string;
  onChange: (value: string | undefined) => void;
  disabled?: boolean;
}) {
  const [enabled, setEnabled] = useState(!!remindAt);
  const value = enabled ? (remindAt ?? '') : '';

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            if (!e.target.checked) onChange(undefined);
          }}
          disabled={disabled}
          className="rounded"
        />
        <Bell className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Hatırlatıcı ekle</span>
      </label>
      {enabled && (
        <div>
          <Label className="text-xs">Hatırlatma tarihi ve saati</Label>
          <Input
            type="datetime-local"
            value={value}
            onChange={(e) => onChange(e.target.value || undefined)}
            disabled={disabled}
            className="mt-1 min-h-[44px]"
          />
        </div>
      )}
    </div>
  );
}
