'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DdAccentButton, DdDialogContent } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import {
  IMPORTANCE_OPTIONS,
  type AdvancedRelationDef,
  type PlanningRelationRow,
  type SimpleRelationDef,
} from '@/lib/planning-relations';

type SubjectOpt = { id: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft: PlanningRelationRow | null;
  simpleCatalog: SimpleRelationDef[];
  advancedCatalog: AdvancedRelationDef[];
  subjects: SubjectOpt[];
  allSections: string[];
  defaultSections?: string[];
  onSave: (row: PlanningRelationRow) => void;
};

export function PlanningRelationEditorDialog({
  open,
  onOpenChange,
  draft,
  simpleCatalog,
  advancedCatalog,
  subjects,
  allSections,
  defaultSections,
  onSave,
}: Props) {
  const [row, setRow] = useState<PlanningRelationRow | null>(draft);

  useEffect(() => {
    setRow(draft);
  }, [draft, open]);

  const ruleOptions = useMemo(() => {
    if (!row) return [];
    if (row.kind === 'advanced') {
      return advancedCatalog.map((r) => ({
        value: r.id,
        label: `${r.asc_ref ? `${r.asc_ref} ` : ''}${r.label_tr}${r.solver_supported ? '' : ' (yakında)'}`,
      }));
    }
    return simpleCatalog.map((r) => ({
      value: r.id,
      label: `${r.label_tr}${r.solver_supported ? '' : ' (yakında)'}`,
    }));
  }, [row, simpleCatalog, advancedCatalog]);

  if (!row) return null;

  const def =
    row.kind === 'simple'
      ? simpleCatalog.find((r) => r.id === row.rule_id)
      : advancedCatalog.find((r) => r.id === row.rule_id);

  function toggleSubject(id: string, name: string) {
    const has = row!.subject_ids.includes(id);
    if (has) {
      const idx = row!.subject_ids.indexOf(id);
      setRow({
        ...row!,
        subject_ids: row!.subject_ids.filter((x) => x !== id),
        subject_labels: row!.subject_labels.filter((_, i) => i !== idx),
      });
    } else {
      setRow({
        ...row!,
        subject_ids: [...row!.subject_ids, id],
        subject_labels: [...row!.subject_labels, name],
      });
    }
  }

  function toggleSection(sec: string) {
    const has = row!.sections.includes(sec);
    setRow({
      ...row!,
      sections: has ? row!.sections.filter((s) => s !== sec) : [...row!.sections, sec],
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DdDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {row.kind === 'advanced' ? 'Gelişmiş planlama ilişkisi' : 'Planlama ilişkisi'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="space-y-2 rounded-lg border p-3">
            <p className="font-medium text-foreground">1. Dersler</p>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded border bg-muted/30 p-2">
              {subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">Önce stüdyoda ders tanımlayın.</p>
              ) : (
                subjects.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={row.subject_ids.includes(s.id)}
                      onChange={() => toggleSubject(s.id, s.name)}
                    />
                    {s.name}
                  </label>
                ))
              )}
            </div>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <p className="font-medium text-foreground">2. Sınıflar</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={row.sections_mode === 'all' ? 'default' : 'outline'}
                onClick={() => setRow({ ...row, sections_mode: 'all', sections: [] })}
              >
                Tümü
              </Button>
              <Button
                type="button"
                size="sm"
                variant={row.sections_mode === 'pick' ? 'default' : 'outline'}
                onClick={() =>
                  setRow({
                    ...row,
                    sections_mode: 'pick',
                    sections: defaultSections?.length ? [...defaultSections] : row.sections,
                  })
                }
              >
                Seçim
              </Button>
            </div>
            {row.sections_mode === 'pick' && (
              <div className="max-h-28 space-y-1 overflow-y-auto rounded border bg-muted/30 p-2">
                {allSections.map((sec) => (
                  <label key={sec} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input type="checkbox" checked={row.sections.includes(sec)} onChange={() => toggleSection(sec)} />
                    {sec}
                  </label>
                ))}
              </div>
            )}
            {row.sections_mode === 'all' && (
              <p className="text-xs text-muted-foreground">Tüm sınıflar</p>
            )}
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <p className="font-medium text-foreground">3. Durum</p>
            <DdSelectField
              label="Kural türü"
              value={row.rule_id}
              onValueChange={(v) => setRow({ ...row, rule_id: v })}
              options={ruleOptions}
            />
            {def && 'param_label' in def && def.param_label && (
              <div>
                <Label className="text-xs">{def.param_label}</Label>
                <Input
                  type="number"
                  className="mt-1 h-8"
                  min={1}
                  max={8}
                  value={Number(
                    row.params?.[
                      def.param_key === 'max_run'
                        ? 'max_run'
                        : def.param_key === 'min_gap'
                          ? 'min_gap'
                          : 'max'
                    ] ?? (def.param_key === 'max_run' ? 4 : def.param_key === 'min_gap' ? 2 : 2),
                  )}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    const key =
                      def.param_key === 'max_run'
                        ? 'max_run'
                        : def.param_key === 'min_gap'
                          ? 'min_gap'
                          : 'max';
                    setRow({ ...row, params: { ...row.params, [key]: n } });
                  }}
                />
              </div>
            )}
            {def && 'hint' in def && def.hint && (
              <p className="text-xs text-muted-foreground">{def.hint}</p>
            )}
            {def && 'solver_supported' in def && !def.solver_supported && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Kayıt tutulur; dağıtımda henüz uygulanmaz. Zorunlu seçerseniz üretim başlamaz.
              </p>
            )}
            {def && 'solver_supported' in def && def.solver_supported && 'catalog_key' in def && def.catalog_key && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Dağıtımda okul kuralı: {def.catalog_key}
              </p>
            )}
          </section>

          <DdSelectField
            label="Planlamadaki önemi"
            value={row.importance}
            onValueChange={(v) => setRow({ ...row, importance: v as PlanningRelationRow['importance'] })}
            options={IMPORTANCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
          <div>
            <Label className="text-xs">Not</Label>
            <Input
              className="mt-1 h-8"
              value={row.note ?? ''}
              onChange={(e) => setRow({ ...row, note: e.target.value })}
              placeholder="Tanımlama için kısa not"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <DdAccentButton
            type="button"
            onClick={() => {
              if (!row.subject_ids.length) return;
              onSave(row);
              onOpenChange(false);
            }}
            disabled={!row.subject_ids.length}
          >
            Tamam
          </DdAccentButton>
        </DialogFooter>
      </DdDialogContent>
    </Dialog>
  );
}
