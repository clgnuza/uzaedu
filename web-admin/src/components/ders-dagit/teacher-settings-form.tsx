'use client';

import { useId } from 'react';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { TeacherConfig, TeacherDraft } from '@/components/ders-dagit/teacher-config-types';

const SHIFT_OPTS = [
  { value: '', label: 'Sabah ve öğle' },
  { value: 'morning', label: 'Yalnız sabah' },
  { value: 'afternoon', label: 'Yalnız öğle' },
];

type Props = {
  draft: TeacherDraft;
  onChange: (patch: Partial<TeacherDraft>) => void;
  schoolMaxLessons: number;
  disabled?: boolean;
};

export function TeacherSettingsForm({ draft, onChange, schoolMaxLessons, disabled }: Props) {
  const uid = useId();
  const fid = (f: string) => `${uid}-${f}`;

  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
      <legend className="sr-only">Öğretmen limitleri</legend>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <Label htmlFor={fid('branch')}>Branş</Label>
          <Input
            id={fid('branch')}
            className="mt-1 h-9"
            value={draft.branch ?? ''}
            onChange={(e) => onChange({ branch: e.target.value || null })}
          />
        </div>
        <div>
          <Label htmlFor={fid('mandatory')}>Zorunlu saat / hafta</Label>
          <Input
            id={fid('mandatory')}
            type="number"
            min={0}
            max={40}
            className="mt-1 h-9"
            value={draft.mandatory_weekly_hours ?? ''}
            onChange={(e) =>
              onChange({ mandatory_weekly_hours: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label htmlFor={fid('extra')}>Ek ders üst sınırı</Label>
          <Input
            id={fid('extra')}
            type="number"
            min={0}
            max={20}
            className="mt-1 h-9"
            value={draft.max_extra_weekly_hours ?? ''}
            onChange={(e) =>
              onChange({ max_extra_weekly_hours: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label htmlFor={fid('maxday')}>En fazla ders / gün</Label>
          <Input
            id={fid('maxday')}
            type="number"
            min={1}
            max={12}
            className="mt-1 h-9"
            placeholder={String(schoolMaxLessons)}
            value={draft.max_lessons_per_day ?? ''}
            onChange={(e) =>
              onChange({ max_lessons_per_day: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label htmlFor={fid('minwd')}>En az çalışma günü</Label>
          <Input
            id={fid('minwd')}
            type="number"
            min={1}
            max={7}
            className="mt-1 h-9"
            value={draft.min_work_days ?? ''}
            onChange={(e) => onChange({ min_work_days: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
        <div>
          <Label htmlFor={fid('maxwd')}>En fazla çalışma günü</Label>
          <Input
            id={fid('maxwd')}
            type="number"
            min={1}
            max={7}
            className="mt-1 h-9"
            value={draft.max_work_days ?? ''}
            onChange={(e) => onChange({ max_work_days: e.target.value === '' ? null : Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <DdSelectField
          label="İkili eğitim vardiyası"
          value={draft.constraints?.education_shift ?? ''}
          onValueChange={(v) =>
            onChange({
              constraints: {
                ...(draft.constraints ?? {}),
                education_shift: (v || null) as 'morning' | 'afternoon' | null,
              },
            })
          }
          options={SHIFT_OPTS}
        />
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/15 px-3 py-2">
          <div>
            <Label htmlFor={fid('gap')}>Sabah–öğle arasında boşluk</Label>
            <p id={fid('gap-hint')} className="text-xs text-muted-foreground">
              Kapalıysa tek vardiyada ardışık blok.
            </p>
          </div>
          <Switch
            id={fid('gap')}
            checked={draft.allow_am_pm_gap}
            onCheckedChange={(v) => onChange({ allow_am_pm_gap: v })}
            aria-describedby={fid('gap-hint')}
          />
        </div>
      </div>
    </fieldset>
  );
}

export function teacherToDraft(t: TeacherConfig): TeacherDraft {
  return {
    branch: t.branch,
    mandatory_weekly_hours: t.mandatory_weekly_hours,
    max_extra_weekly_hours: t.max_extra_weekly_hours,
    max_lessons_per_day: t.max_lessons_per_day,
    min_work_days: t.min_work_days,
    max_work_days: t.max_work_days,
    allow_am_pm_gap: t.allow_am_pm_gap,
    unavailable_periods: t.unavailable_periods,
    constraints: t.constraints,
  };
}
