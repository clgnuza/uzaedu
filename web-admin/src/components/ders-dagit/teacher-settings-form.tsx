'use client';

import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { TeacherConfig, TeacherDraft } from '@/components/ders-dagit/teacher-config-types';
import { cn } from '@/lib/utils';

const SHIFT_OPTS: Array<{ value: '' | 'morning' | 'afternoon'; label: string; hint: string }> = [
  { value: '', label: 'Sabah + öğle', hint: 'İkili eğitimde her iki vardiya' },
  { value: 'morning', label: 'Yalnız sabah', hint: 'Öğleden sonra ders yok' },
  { value: 'afternoon', label: 'Yalnız öğle', hint: 'Sabah dersi yok' },
];

const TABLE_HEAD = 'bg-muted text-xs uppercase text-muted-foreground';
const TABLE_TH = 'px-2 py-2 text-left font-medium';
const TABLE_TD = 'border-t px-2 py-1.5 align-middle';
const INPUT_CELL = 'h-8 w-full max-w-[7.5rem] rounded-md border bg-background px-2 text-sm tabular-nums';

type Props = {
  draft: TeacherDraft;
  onChange: (patch: Partial<TeacherDraft>) => void;
  schoolMaxLessons: number;
  disabled?: boolean;
};

function SettingsTable({
  caption,
  children,
}: {
  caption: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className={TABLE_HEAD}>
          <tr>
            <th className={cn(TABLE_TH, 'w-[42%]')}>Alan</th>
            <th className={TABLE_TH}>Değer</th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function FieldRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td className={cn(TABLE_TD, 'text-muted-foreground')}>
        <span className="font-medium text-foreground">{label}</span>
        {hint ? <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p> : null}
      </td>
      <td className={TABLE_TD}>{children}</td>
    </tr>
  );
}

export function TeacherLimitsForm({ draft, onChange, schoolMaxLessons, disabled }: Props) {
  const uid = useId();
  const fid = (f: string) => `${uid}-${f}`;

  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <SettingsTable caption="Saat limitleri">
        <FieldRow label="Branş">
          <Input
            id={fid('branch')}
            className={INPUT_CELL}
            value={draft.branch ?? ''}
            onChange={(e) => onChange({ branch: e.target.value || null })}
          />
        </FieldRow>
        <FieldRow label="Zorunlu saat / hafta" hint="Haftalık zorunlu ders yükü">
          <Input
            id={fid('mandatory')}
            type="number"
            min={0}
            max={40}
            className={INPUT_CELL}
            value={draft.mandatory_weekly_hours ?? ''}
            onChange={(e) =>
              onChange({ mandatory_weekly_hours: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </FieldRow>
        <FieldRow label="Ek ders üst sınırı">
          <Input
            id={fid('extra')}
            type="number"
            min={0}
            max={20}
            className={INPUT_CELL}
            value={draft.max_extra_weekly_hours ?? ''}
            onChange={(e) =>
              onChange({ max_extra_weekly_hours: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </FieldRow>
        <FieldRow label="En fazla ders / gün" hint={`Okul üst sınırı: ${schoolMaxLessons}`}>
          <Input
            id={fid('maxday')}
            type="number"
            min={1}
            max={12}
            className={INPUT_CELL}
            placeholder={String(schoolMaxLessons)}
            value={draft.max_lessons_per_day ?? ''}
            onChange={(e) =>
              onChange({ max_lessons_per_day: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </FieldRow>
        <FieldRow label="Çalışma günü (min – max)">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id={fid('minwd')}
              type="number"
              min={1}
              max={7}
              className={cn(INPUT_CELL, 'max-w-[4.5rem]')}
              aria-label="En az çalışma günü"
              value={draft.min_work_days ?? ''}
              onChange={(e) => onChange({ min_work_days: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <span className="text-muted-foreground">–</span>
            <Input
              id={fid('maxwd')}
              type="number"
              min={1}
              max={7}
              className={cn(INPUT_CELL, 'max-w-[4.5rem]')}
              aria-label="En fazla çalışma günü"
              value={draft.max_work_days ?? ''}
              onChange={(e) => onChange({ max_work_days: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </div>
        </FieldRow>
      </SettingsTable>
    </fieldset>
  );
}

export function TeacherConstraintsForm({ draft, onChange, disabled }: Omit<Props, 'schoolMaxLessons'>) {
  const uid = useId();
  const shift = draft.constraints?.education_shift ?? '';
  const gapId = `${uid}-gap`;

  return (
    <fieldset disabled={disabled} className="space-y-2 disabled:opacity-60">
      <p className="text-xs text-muted-foreground">
        Program üretiminde öğretmenin hangi vardiyada ders alabileceğini ve öğle arası boşluğu belirler.
      </p>
      <SettingsTable caption="Kısıtlamalar">
        <FieldRow label="İkili eğitim vardiyası" hint="Boş = her iki vardiyada ders verilebilir">
          <div
            className="inline-flex flex-wrap gap-1 rounded-md border bg-muted/20 p-0.5"
            role="group"
            aria-label="İkili eğitim vardiyası"
          >
            {SHIFT_OPTS.map((opt) => {
              const on = shift === opt.value;
              return (
                <button
                  key={opt.value || 'both'}
                  type="button"
                  title={opt.hint}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                    on
                      ? 'bg-background text-foreground shadow-sm ring-1 ring-border/60'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  )}
                  onClick={() =>
                    onChange({
                      constraints: {
                        ...(draft.constraints ?? {}),
                        education_shift: opt.value || null,
                      },
                    })
                  }
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </FieldRow>
        <FieldRow label="Sabah–öğle arası boşluk" hint="Kapalı: tek vardiyada ardışık blok zorunlu">
          <div className="flex items-center gap-3">
            <Switch
              id={gapId}
              checked={draft.allow_am_pm_gap}
              onCheckedChange={(v) => onChange({ allow_am_pm_gap: v })}
            />
            <span className="text-xs text-muted-foreground">
              {draft.allow_am_pm_gap ? 'Boşluğa izin var' : 'Boşluğa izin yok'}
            </span>
          </div>
        </FieldRow>
      </SettingsTable>
    </fieldset>
  );
}

/** Saat limitleri + kısıtlamalar (eski tek panel). */
export function TeacherSettingsForm(props: Props) {
  return (
    <div className="space-y-4">
      <TeacherLimitsForm {...props} />
      <TeacherConstraintsForm draft={props.draft} onChange={props.onChange} disabled={props.disabled} />
    </div>
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
