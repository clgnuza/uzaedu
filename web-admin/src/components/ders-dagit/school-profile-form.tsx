'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TYPES = [
  { value: 'ilkokul', label: 'İlkokul' },
  { value: 'ortaokul', label: 'Ortaokul' },
  { value: 'anadolu_lise', label: 'Anadolu Lisesi' },
  { value: 'mtal', label: 'MTAL' },
  { value: 'fen_lise', label: 'Fen/Sosyal Bilimler Lisesi' },
  { value: 'aihl', label: 'Anadolu İmam Hatip' },
] as const;

const YKS = [
  { value: '', label: '—' },
  { value: 'sayisal', label: 'Sayısal' },
  { value: 'sozel', label: 'Sözel' },
  { value: 'ea', label: 'Eşit Ağırlık' },
  { value: 'dil', label: 'Dil' },
] as const;

export type SchoolProfileDto = {
  type: string;
  yks_track?: string | null;
  internship_days?: number[];
  internship_sections?: string[];
};

export function SchoolProfileForm({
  initial,
  onSave,
}: {
  initial: SchoolProfileDto | null;
  onSave: (dto: SchoolProfileDto) => Promise<void>;
}) {
  const [type, setType] = useState(initial?.type ?? 'anadolu_lise');
  const [yks, setYks] = useState(initial?.yks_track ?? '');
  const [internDays, setInternDays] = useState((initial?.internship_days ?? []).join(','));
  const [internSecs, setInternSecs] = useState((initial?.internship_sections ?? []).join(','));

  useEffect(() => {
    if (!initial) return;
    setType(initial.type);
    setYks(initial.yks_track ?? '');
    setInternDays((initial.internship_days ?? []).join(','));
    setInternSecs((initial.internship_sections ?? []).join(','));
  }, [initial]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <Label>Okul türü (MEB)</Label>
        <select
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label>12. sınıf YKS kolu</Label>
        <select
          className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          value={yks}
          onChange={(e) => setYks(e.target.value)}
        >
          {YKS.map((t) => (
            <option key={t.value || 'x'} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <Label>Staj günleri (1=Pzt … 7=Paz, virgülle)</Label>
        <Input className="mt-1 font-mono text-xs" value={internDays} onChange={(e) => setInternDays(e.target.value)} placeholder="3,4,5" />
      </div>
      <div className="sm:col-span-2">
        <Label>Staj şubeleri (boş = tüm şubeler o gün boş)</Label>
        <Input className="mt-1 font-mono text-xs" value={internSecs} onChange={(e) => setInternSecs(e.target.value)} placeholder="12-A,12-B" />
      </div>
      <Button
        type="button"
        className="sm:col-span-2"
        onClick={() =>
          void onSave({
            type,
            yks_track: yks || null,
            internship_days: internDays
              .split(',')
              .map((s) => Number(s.trim()))
              .filter((n) => n >= 1 && n <= 7),
            internship_sections: internSecs
              .split(/[,/]/)
              .map((s) => s.trim())
              .filter(Boolean),
          })
        }
      >
        Okul profilini kaydet
      </Button>
    </div>
  );
}
