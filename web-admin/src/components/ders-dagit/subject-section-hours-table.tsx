'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { sortClassSections } from '@/lib/class-section-sort';

type Props = {
  classHours: Record<string, number>;
  sections: string[];
  onChange: (hours: Record<string, number>) => void;
};

export function SubjectSectionHoursTable({ classHours, sections, onChange }: Props) {
  const rows = sortClassSections(Object.keys(classHours ?? {})).map((sec) => [sec, classHours[sec]!] as const);

  function setSection(sec: string, hrs: number) {
    const next = { ...classHours, [sec]: Math.max(0, hrs) };
    if (next[sec] === 0) delete next[sec];
    onChange(next);
  }

  function removeSection(sec: string) {
    const next = { ...classHours };
    delete next[sec];
    onChange(next);
  }

  function addSection() {
    const candidate = sections.find((s) => !(s in classHours)) ?? '5A';
    onChange({ ...classHours, [candidate]: 4 });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Şube başına haftalık saat — hücreye tıklayıp düzenleyin.</p>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b text-xs uppercase text-muted-foreground">
            <th className="px-2 py-1.5 text-left">Şube</th>
            <th className="px-2 py-1.5 text-right w-24">Saat</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map(([sec, hrs]) => (
            <tr key={sec} className="border-t hover:bg-muted/30">
              <td className="px-2 py-1 font-medium">{sec}</td>
              <td className="px-2 py-1">
                <Input
                  type="number"
                  min={0}
                  max={40}
                  className="h-8 text-right tabular-nums"
                  value={hrs}
                  onChange={(e) => setSection(sec, Number(e.target.value))}
                />
              </td>
              <td className="px-1 py-1">
                <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeSection(sec)}>
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={3} className="px-2 py-4 text-center text-xs text-muted-foreground">
                Şube satırı yok — ekleyin veya TTKB yükleyin.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Button type="button" size="sm" variant="outline" onClick={addSection}>
        <Plus className="mr-1 size-3.5" />
        Şube satırı ekle
      </Button>
    </div>
  );
}
