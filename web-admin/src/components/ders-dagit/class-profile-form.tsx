'use client';

import { useEffect, useState } from 'react';
import { DdAccentButton } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { DdSectionMultiField } from '@/components/ders-dagit/dd-section-picker';
import { DdWeekdayPicker } from '@/components/ders-dagit/dd-weekday-picker';
import Link from 'next/link';
import { sortClassSections } from '@/lib/class-section-sort';
import { schoolSetupCapabilities } from '@/lib/school-profile-capabilities';
import { toast } from 'sonner';

const SHIFT_OPTS = [
  { value: '', label: 'Belirtilmedi' },
  { value: 'morning', label: 'Sabah' },
  { value: 'afternoon', label: 'Öğle' },
];

export type ClassProfileDto = {
  id?: string;
  name: string;
  class_sections: string[];
  max_lessons_per_day: number;
  education_shift?: 'morning' | 'afternoon' | null;
  start_time?: string;
  end_time?: string;
  internship_days?: number[];
};

type Props = {
  schoolType?: string | null;
  suggestedSections: string[];
  /** Şube → başka profil adı (çakışma uyarısı) */
  sectionTakenBy?: Map<string, string>;
  editing?: ClassProfileDto | null;
  onSave: (dto: ClassProfileDto) => Promise<void>;
  onCancelEdit?: () => void;
};

const EMPTY = {
  name: 'Sabah 5–8',
  sections: [] as string[],
  maxDay: 6,
  shift: '',
};

export function ClassProfileForm({ schoolType, suggestedSections, sectionTakenBy, editing, onSave, onCancelEdit }: Props) {
  const caps = schoolSetupCapabilities(schoolType);
  const [name, setName] = useState(EMPTY.name);
  const [sections, setSections] = useState<string[]>(EMPTY.sections);
  const [maxDay, setMaxDay] = useState(EMPTY.maxDay);
  const [shift, setShift] = useState(EMPTY.shift);
  const [internDays, setInternDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setSections(sortClassSections(editing.class_sections));
      setMaxDay(editing.max_lessons_per_day);
      setShift(editing.education_shift ?? '');
      setInternDays(editing.internship_days ?? []);
    } else {
      setName(EMPTY.name);
      setSections([]);
      setMaxDay(EMPTY.maxDay);
      setShift(EMPTY.shift);
      setInternDays([]);
    }
  }, [editing]);

  return (
    <form
      id="dd-class-profile-form"
      className="dd-glass-subtle grid gap-3 rounded-lg border p-3 sm:grid-cols-2 sm:p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) {
          toast.error('Profil adı girin');
          return;
        }
        if (!sections.length) {
          toast.error('En az bir şube seçin');
          return;
        }
        const conflicts = sections
          .map((s) => (sectionTakenBy?.has(s) ? `${s} (${sectionTakenBy.get(s)})` : null))
          .filter(Boolean) as string[];
        if (conflicts.length) {
          toast.error(`Şubeler başka profilde: ${conflicts.slice(0, 3).join(', ')}`);
          return;
        }
        setBusy(true);
        void onSave({
          id: editing?.id,
          name: name.trim(),
          class_sections: sections,
          max_lessons_per_day: maxDay,
          education_shift: (shift as 'morning' | 'afternoon' | '') || null,
          start_time: editing?.start_time ?? '08:00',
          end_time: editing?.end_time ?? '14:00',
          internship_days: caps.classProfileInternship ? internDays : [],
        }).finally(() => setBusy(false));
      }}
    >
      {editing ? (
        <p className="sm:col-span-2 text-xs font-medium text-primary">Profil düzenleniyor: {editing.name}</p>
      ) : (
        <p className="sm:col-span-2 text-xs text-muted-foreground">Yeni sınıf profili — şubeleri seçerek kaydedin.</p>
      )}
      <div>
        <Label>Profil adı</Label>
        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label>Max ders/gün</Label>
        <Input
          className="mt-1"
          type="number"
          min={1}
          max={12}
          value={maxDay}
          onChange={(e) => setMaxDay(Number(e.target.value))}
        />
      </div>
      {caps.classProfileShift ? (
        <DdSelectField label="Vardiya (ikili eğitim)" value={shift} onValueChange={setShift} options={SHIFT_OPTS} />
      ) : null}
      <DdSectionMultiField
        className="sm:col-span-2"
        label="Şubeler"
        value={sections}
        onValueChange={(v) => setSections(sortClassSections(v))}
        extraSections={suggestedSections.filter((s) => !sectionTakenBy?.has(s))}
      />
      {sectionTakenBy && sectionTakenBy.size > 0 ? (
        <p className="sm:col-span-2 text-[11px] text-muted-foreground">
          Başka profilde olan şubeler listeden çıkarıldı. Çakışma olmaması için her şube tek profilde olmalı.
        </p>
      ) : null}
      {suggestedSections.length > 0 && (
        <div className="sm:col-span-2">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() =>
              setSections(suggestedSections.filter((s) => !sectionTakenBy?.has(s)))
            }
          >
            Tüm uygun şubeleri seç ({suggestedSections.filter((s) => !sectionTakenBy?.has(s)).length})
          </Button>
        </div>
      )}
      {caps.classProfileInternship ? (
        <div className="sm:col-span-2 space-y-1 rounded-lg border border-dashed p-3">
          <Label className="text-sm">Staj / beceri günleri (opsiyonel)</Label>
          <p className="text-[11px] text-muted-foreground">
            Bu profile bağlı tüm şubeler için. Şube özel günler için{' '}
            <Link href="/ders-dagit/studyo/sinif-saatleri" className="text-primary underline">
              sınıf saatleri
            </Link>{' '}
            kullanın.
          </p>
          <DdWeekdayPicker value={internDays} onChange={setInternDays} minSelected={0} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        <DdAccentButton type="submit" disabled={busy}>
          {editing ? 'Güncelle' : 'Profil kaydet'}
        </DdAccentButton>
        {editing && onCancelEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancelEdit}>
            İptal
          </Button>
        ) : null}
      </div>
    </form>
  );
}
