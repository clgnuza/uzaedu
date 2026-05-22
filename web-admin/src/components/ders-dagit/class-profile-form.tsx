'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  suggestedSections: string[];
  onSave: (dto: {
    name: string;
    class_sections: string[];
    max_lessons_per_day: number;
    education_shift?: 'morning' | 'afternoon' | null;
    start_time?: string;
    end_time?: string;
  }) => Promise<void>;
};

export function ClassProfileForm({ suggestedSections, onSave }: Props) {
  const [name, setName] = useState('Sabah 5–8');
  const [sections, setSections] = useState('');
  const [maxDay, setMaxDay] = useState(6);
  const [shift, setShift] = useState<'morning' | 'afternoon' | ''>('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        void onSave({
          name,
          class_sections: sections
            .split(/[,/]/)
            .map((s) => s.trim())
            .filter(Boolean),
          max_lessons_per_day: maxDay,
          education_shift: shift || null,
          start_time: '08:00',
          end_time: '14:00',
        }).finally(() => setBusy(false));
      }}
    >
      <div>
        <Label>Profil adı</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Max ders/gün</Label>
        <Input type="number" min={1} max={12} value={maxDay} onChange={(e) => setMaxDay(Number(e.target.value))} />
      </div>
      <div>
        <Label>Vardiya (ikili eğitim)</Label>
        <select
          className="h-9 w-full rounded-md border px-2 text-sm"
          value={shift}
          onChange={(e) => setShift(e.target.value as 'morning' | 'afternoon' | '')}
        >
          <option value="">Belirtilmedi</option>
          <option value="morning">Sabah</option>
          <option value="afternoon">Öğle</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <Label>Şubeler (virgül veya /)</Label>
        <Input
          value={sections}
          onChange={(e) => setSections(e.target.value)}
          placeholder={suggestedSections.slice(0, 5).join(', ') || '5A, 5B, 6A'}
        />
        {suggestedSections.length > 0 && (
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => setSections(suggestedSections.join(', '))}
          >
            Tüm şubeleri doldur ({suggestedSections.length})
          </Button>
        )}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={busy}>
          Profil kaydet
        </Button>
      </div>
    </form>
  );
}
