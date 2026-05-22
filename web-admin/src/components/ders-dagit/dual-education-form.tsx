'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2">
        <div>
          <p className="text-sm font-medium">İkili eğitim</p>
          <p className="text-xs text-muted-foreground">Sabah ve öğle vardiyası ayrı programlanır.</p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="İkili eğitim" />
      </div>

      {enabled && (
        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <div>
            <Label>Öğle vardiyası — ilk ders sırası</Label>
            <Input
              className="mt-1 max-w-[8rem]"
              type="number"
              min={2}
              max={14}
              value={pmFirst}
              onChange={(e) => setPmFirst(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Önerilen: {pmFirstDefault}
              {pmScheduleCount > 0 ? ` · Okul öğle çizelgesi: ${pmScheduleCount} ders` : ' · Öğle çizelgesi tanımlı değil'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Kurulumda sınıf profillerine ve öğretmenlere <strong>Sabah</strong> / <strong>Öğle</strong> vardiyası verin;
            program oluşturucu yalnız uygun slotlara yerleştirir.
          </p>
        </div>
      )}

      <Button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void onSave({
            enabled,
            pm_first_lesson: enabled && pmFirst.trim() ? Number(pmFirst) : undefined,
          }).finally(() => setBusy(false));
        }}
      >
        {busy ? 'Kaydediliyor…' : 'İkili eğitim kaydet'}
      </Button>
    </div>
  );
}
