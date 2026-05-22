'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type DualEducationConfig = {
  enabled: boolean;
  pm_first_lesson?: number;
};

type Props = {
  initial: DualEducationConfig;
  pmFirstDefault: number;
  pmScheduleCount: number;
  onSave: (d: DualEducationConfig) => Promise<void>;
};

export function DualEducationForm({ initial, pmFirstDefault, pmScheduleCount, onSave }: Props) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [pmFirst, setPmFirst] = useState(String(initial.pm_first_lesson ?? pmFirstDefault));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEnabled(initial.enabled);
    setPmFirst(String(initial.pm_first_lesson ?? pmFirstDefault));
  }, [initial, pmFirstDefault]);

  return (
    <div className="space-y-3 border-t pt-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        İkili eğitim (sabah / öğle vardiyası)
      </label>
      {enabled && (
        <>
          <div>
            <Label>Öğle vardiyası ilk ders sırası</Label>
            <Input type="number" min={2} max={14} value={pmFirst} onChange={(e) => setPmFirst(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Önerilen: {pmFirstDefault} · Öğle çizelgesi: {pmScheduleCount || '—'} ders
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Sınıf profillerinde ve öğretmenlerde sabah/öğle etiketi verin; solver yalnız uygun slotlara yerleştirir.
          </p>
        </>
      )}
      <Button
        type="button"
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void onSave({
            enabled,
            pm_first_lesson: enabled && pmFirst.trim() ? Number(pmFirst) : undefined,
          }).finally(() => setBusy(false));
        }}
      >
        İkili eğitim kaydet
      </Button>
    </div>
  );
}
