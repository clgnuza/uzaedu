'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { DdAccentButton } from '@/components/ders-dagit/dd-ui';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { schoolSetupCapabilities } from '@/lib/school-profile-capabilities';

const TYPES = [
  { value: 'ilkokul', label: 'İlkokul' },
  { value: 'ortaokul', label: 'Ortaokul' },
  { value: 'anadolu_lise', label: 'Anadolu Lisesi' },
  { value: 'mtal', label: 'MTAL / Mesleki' },
  { value: 'fen_lise', label: 'Fen ve Sosyal Bilimler Lisesi' },
  { value: 'aihl', label: 'Anadolu İmam Hatip Lisesi' },
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
  const [busy, setBusy] = useState(false);

  const caps = useMemo(() => schoolSetupCapabilities(type), [type]);

  useEffect(() => {
    if (!initial) return;
    setType(initial.type);
    setYks(initial.yks_track ?? '');
  }, [initial]);

  useEffect(() => {
    if (!caps.yksTrack) setYks('');
  }, [caps.yksTrack]);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DdSelectField
        label="Okul türü (MEB)"
        value={type}
        onValueChange={setType}
        options={[...TYPES]}
        className="sm:col-span-2"
      />

      {caps.yksTrack ? (
        <DdSelectField
          label="12. sınıf YKS kolu"
          value={yks}
          onValueChange={setYks}
          options={[...YKS]}
          className="sm:col-span-2"
        />
      ) : (
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          YKS kolu yalnızca Anadolu ve Fen/Sosyal Bilimler liselerinde kullanılır.
        </p>
      )}

      {caps.internshipGuidance ? (
        <div className="sm:col-span-2 rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2.5 text-sm">
          <p className="font-medium text-amber-950 dark:text-amber-100">Staj / işletmede beceri eğitimi</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Günler program ve şubeye göre değişir. Tanım yerleri:
          </p>
          <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
            <li>
              <Link href="/ders-dagit/studyo/sinif-saatleri" className="text-primary underline">
                Sınıf saatleri
              </Link>{' '}
              — şube bazlı tam gün veya hücre
            </li>
            <li>
              <Link href="/ders-dagit/studyo/kurulum" className="text-primary underline">
                Sınıf profili
              </Link>{' '}
              — profile bağlı şubeler için ortak günler
            </li>
          </ul>
        </div>
      ) : null}

      <DdAccentButton
        type="button"
        className="sm:col-span-2"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void onSave({
            type,
            yks_track: caps.yksTrack ? yks || null : null,
            internship_days: [],
            internship_sections: [],
          }).finally(() => setBusy(false));
        }}
      >
        Okul profilini kaydet
      </DdAccentButton>
    </div>
  );
}
