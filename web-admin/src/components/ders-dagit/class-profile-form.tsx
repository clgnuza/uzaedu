'use client';

import { useEffect, useMemo, useState } from 'react';
import { DdAccentButton } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { DdSectionMultiField } from '@/components/ders-dagit/dd-section-picker';
import { DdWeekdayPicker } from '@/components/ders-dagit/dd-weekday-picker';
import Link from 'next/link';
import { dedupeSectionAliases } from '@/lib/class-section-canonical';
import { parseGradeFromClassSection, sortClassSections } from '@/lib/class-section-sort';
import { schoolSetupCapabilities } from '@/lib/school-profile-capabilities';
import type { ClassProfilePresetDef, ClassProfilePresetsRes } from '@/lib/class-profile-presets';
import { apiFetch } from '@/lib/api';
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
  max_weekly_lessons?: number;
  min_weekly_lessons?: number;
  education_shift?: 'morning' | 'afternoon' | null;
  start_time?: string;
  end_time?: string;
  internship_days?: number[];
  preset_id?: ClassProfilePresetDef['id'];
};

type Props = {
  schoolType?: string | null;
  studioId?: string;
  token?: string | null;
  suggestedSections: string[];
  sectionTakenBy?: Map<string, string>;
  editing?: ClassProfileDto | null;
  onSave: (dto: ClassProfileDto) => Promise<void>;
  onCancelEdit?: () => void;
};

export function ClassProfileForm({
  schoolType,
  studioId,
  token,
  suggestedSections,
  sectionTakenBy,
  editing,
  onSave,
  onCancelEdit,
}: Props) {
  const caps = schoolSetupCapabilities(schoolType);
  const [presetMeta, setPresetMeta] = useState<ClassProfilePresetsRes | null>(null);
  const [presetId, setPresetId] = useState<string>('genel');
  const [name, setName] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  const [maxDay, setMaxDay] = useState(8);
  const [maxWeek, setMaxWeek] = useState(37);
  const [minWeek, setMinWeek] = useState(32);
  const [shift, setShift] = useState('');
  const [internDays, setInternDays] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const availableSections = useMemo(
    () => suggestedSections.filter((s) => !sectionTakenBy?.has(s)),
    [suggestedSections, sectionTakenBy],
  );

  const displaySections = useMemo(() => dedupeSectionAliases(availableSections), [availableSections]);

  const presetSectionMatches = useMemo(
    () => filterSectionsForPreset(displaySections, presetId),
    [displaySections, presetId],
  );

  const presets = presetMeta?.presets ?? [];
  const activePreset = presets.find((p) => p.id === presetId) ?? presets[0];

  useEffect(() => {
    if (!token || !studioId) return;
    void apiFetch<ClassProfilePresetsRes>(`/ders-dagit/studios/${studioId}/class-profile-presets`, { token })
      .then(setPresetMeta)
      .catch(() => setPresetMeta(null));
  }, [token, studioId]);

  useEffect(() => {
    if (editing) {
      setName(editing.name);
      setSections(sortClassSections(editing.class_sections));
      setMaxDay(editing.max_lessons_per_day);
      setMaxWeek(editing.max_weekly_lessons ?? 37);
      setMinWeek(editing.min_weekly_lessons ?? 32);
      setShift(editing.education_shift ?? '');
      setInternDays(editing.internship_days ?? []);
      setPresetId(editing.preset_id ?? 'genel');
      return;
    }
    if (presets.length) {
      const p = presets.find((x) => x.id === presetId) ?? presets[0]!;
      applyPreset(p, false);
    }
  }, [editing?.id, presets.length]);

  function applyPreset(p: ClassProfilePresetDef, pickSections: boolean) {
    setPresetId(p.id);
    setName(p.label);
    setMaxDay(p.max_lessons_per_day);
    setMaxWeek(p.max_weekly_lessons);
    setMinWeek(p.min_weekly_lessons);
    if (p.education_shift) setShift(p.education_shift);
    else if (!caps.classProfileShift) setShift('');
    if (pickSections && displaySections.length) {
      const picked = filterSectionsForPreset(displaySections, p.id);
      if (picked.length) setSections(sortClassSections(picked));
    }
  }

  function filterSectionsForPreset(all: string[], id: string): string[] {
    const grade = (s: string, grades: number[]) => {
      const g = parseGradeFromClassSection(s);
      return g < 99 && grades.includes(g);
    };
    switch (id) {
      case 'ilk_1_3':
        return all.filter((s) => grade(s, [1, 2, 3]));
      case 'ilk_4':
        return all.filter((s) => grade(s, [4]));
      case 'orta_5_6':
        return all.filter((s) => grade(s, [5, 6]));
      case 'orta_7_8':
        return all.filter((s) => grade(s, [7, 8]));
      case 'lise_9_10':
        return all.filter((s) => grade(s, [9, 10]));
      case 'lise_11_12':
        return all.filter((s) => grade(s, [11, 12]));
      case 'lise_12_yks':
        return all.filter((s) => grade(s, [12]));
      case 'mtal_alan':
        return all.filter((s) => /\([^)]*(ALAN|HİZMET|BÖLÜM|AMP)/iu.test(s.toLocaleUpperCase('tr')));
      case 'mtal_sabah':
      case 'mtal_ogle':
      case 'genel':
      default:
        return all;
    }
  }

  const maxDayCap =
    presetMeta?.duty_max_lessons ?? presetMeta?.default_max_lessons_per_day ?? 12;
  const dutyHint = presetMeta?.duty_max_lessons ?? null;

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
          max_weekly_lessons: maxWeek,
          min_weekly_lessons: minWeek,
          education_shift: (shift as 'morning' | 'afternoon' | '') || null,
          start_time: editing?.start_time ?? '08:00',
          end_time: editing?.end_time ?? '14:00',
          internship_days: caps.classProfileInternship ? internDays : [],
          preset_id: presetId as ClassProfilePresetDef['id'],
        }).finally(() => setBusy(false));
      }}
    >
      {editing ? (
        <p className="sm:col-span-2 text-xs font-medium text-primary">Profil düzenleniyor: {editing.name}</p>
      ) : (
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          MEB program şablonu seçin; günlük/haftalık ders üst sınırları ve şube saatleri buna göre ayarlanır.
        </p>
      )}

      {presets.length > 0 ? (
        <DdSelectField
          className="sm:col-span-2"
          label="Program şablonu (MEB)"
          value={presetId}
          onValueChange={(v) => {
            const p = presets.find((x) => x.id === v);
            if (p) applyPreset(p, !editing);
          }}
          options={presets.map((p) => ({ value: p.id, label: p.label }))}
        />
      ) : null}

      {activePreset ? (
        <p className="sm:col-span-2 text-[11px] text-muted-foreground">{activePreset.hint}</p>
      ) : null}

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
          max={maxDayCap}
          value={maxDay}
          onChange={(e) => setMaxDay(Number(e.target.value))}
        />
        {dutyHint != null ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">Okul üst sınırı: {dutyHint} ders/gün</p>
        ) : null}
      </div>
      <div>
        <Label>Max haftalık saat</Label>
        <Input
          className="mt-1"
          type="number"
          min={1}
          max={50}
          value={maxWeek}
          onChange={(e) => setMaxWeek(Number(e.target.value))}
        />
      </div>
      <div>
        <Label>Min haftalık saat</Label>
        <Input
          className="mt-1"
          type="number"
          min={1}
          max={maxWeek}
          value={minWeek}
          onChange={(e) => setMinWeek(Number(e.target.value))}
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
        extraSections={displaySections}
      />

      {displaySections.length < availableSections.length ? (
        <p className="sm:col-span-2 text-[11px] text-muted-foreground">
          Aynı şubenin farklı kayıt adları (ör. 9-A ile okul listesindeki uzun ad) tek satırda gösterilir.
        </p>
      ) : null}

      {displaySections.length > 0 ? (
        <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
          {activePreset && presetId !== 'genel' && presetSectionMatches.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSections(sortClassSections(presetSectionMatches))}
            >
              {activePreset.label} — {presetSectionMatches.length} şube
            </Button>
          ) : null}
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-xs"
            onClick={() => setSections(displaySections)}
          >
            Tüm uygun şubeler ({displaySections.length})
          </Button>
        </div>
      ) : null}

      {sectionTakenBy && sectionTakenBy.size > 0 ? (
        <p className="sm:col-span-2 text-[11px] text-muted-foreground">
          Başka profilde olan şubeler listeden çıkarıldı.
        </p>
      ) : null}

      {caps.classProfileInternship ? (
        <div className="sm:col-span-2 space-y-1 rounded-lg border border-dashed p-3">
          <Label className="text-sm">Staj / beceri günleri (opsiyonel)</Label>
          <p className="text-[11px] text-muted-foreground">
            Şube özel günler için{' '}
            <Link href="/ders-dagit/studyo/sinif-saatleri" className="text-primary underline">
              sınıf saatleri
            </Link>
            .
          </p>
          <DdWeekdayPicker value={internDays} onChange={setInternDays} minSelected={0} />
        </div>
      ) : null}

      <p className="sm:col-span-2 text-[10px] text-muted-foreground">
        Kayıtta seçili şubelerin günlük ders üst sınırı «Sınıf saatleri» ile eşitlenir.
      </p>

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
