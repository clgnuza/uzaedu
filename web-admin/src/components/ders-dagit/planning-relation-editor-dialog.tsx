'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DdAccentButton, DdDialogContent } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { PlanningRelationConditionPanel } from '@/components/ders-dagit/planning-relation-condition-panel';
import {
  IMPORTANCE_OPTIONS,
  advancedRuleOptionLabel,
  catalogKeyLabel,
  defaultImportanceForRule,
  defaultParamsForRule,
  minSubjectsForRule,
  planningCatalogRuleHint,
  simpleRuleOptionLabel,
  validatePlanningRelationRow,
  type AdvancedRelationDef,
  type PlanningRelationRow,
  type SimpleRelationDef,
} from '@/lib/planning-relations';
import { toast } from 'sonner';

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

const IMPORTANCE_HINTS: Record<PlanningRelationRow['importance'], string> = {
  strict: 'İhlal edilirse program üretimi başarısız olabilir.',
  normal: 'Mümkün olduğunca uygulanır; çakışan tercihlerde esnetilir.',
  low: 'Son aşamada, diğer kurallardan sonra denenir.',
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
  const [subjectFilter, setSubjectFilter] = useState('');

  useEffect(() => {
    setRow(draft);
    setSubjectFilter('');
  }, [draft, open]);

  const ruleOptions = useMemo(() => {
    if (!row) return [];
    if (row.kind === 'advanced') {
      return advancedCatalog.map((r) => ({
        value: r.id,
        label: advancedRuleOptionLabel(r),
      }));
    }
    return simpleCatalog.map((r) => ({
      value: r.id,
      label: simpleRuleOptionLabel(r),
    }));
  }, [row, simpleCatalog, advancedCatalog]);

  const filteredSubjects = useMemo(() => {
    const q = subjectFilter.trim().toLocaleLowerCase('tr');
    if (!q) return subjects;
    return subjects.filter((s) => s.name.toLocaleLowerCase('tr').includes(q));
  }, [subjects, subjectFilter]);

  if (!row) return null;
  const editing = row;

  const def =
    editing.kind === 'simple'
      ? simpleCatalog.find((r) => r.id === editing.rule_id)
      : advancedCatalog.find((r) => r.id === editing.rule_id);

  const catalogLabel = def?.catalog_key ? catalogKeyLabel(def.catalog_key) : undefined;
  const catalogHint = def?.catalog_key ? planningCatalogRuleHint(def.catalog_key) : undefined;
  const minSubj = minSubjectsForRule(editing.rule_id, editing.kind);

  function applyRuleChange(ruleId: string) {
    const nextDef =
      editing.kind === 'simple'
        ? simpleCatalog.find((r) => r.id === ruleId)
        : advancedCatalog.find((r) => r.id === ruleId);
    setRow({
      ...editing,
      rule_id: ruleId,
      importance: defaultImportanceForRule(nextDef),
      params: defaultParamsForRule(nextDef),
    });
  }

  function toggleSubject(id: string, name: string) {
    const has = editing.subject_ids.includes(id);
    if (has) {
      const idx = editing.subject_ids.indexOf(id);
      setRow({
        ...editing,
        subject_ids: editing.subject_ids.filter((x) => x !== id),
        subject_labels: editing.subject_labels.filter((_, i) => i !== idx),
      });
    } else {
      setRow({
        ...editing,
        subject_ids: [...editing.subject_ids, id],
        subject_labels: [...editing.subject_labels, name],
      });
    }
  }

  function selectAllSubjects() {
    setRow({
      ...editing,
      subject_ids: subjects.map((s) => s.id),
      subject_labels: subjects.map((s) => s.name),
    });
  }

  function clearSubjects() {
    setRow({ ...editing, subject_ids: [], subject_labels: [] });
  }

  function toggleSection(sec: string) {
    const has = editing.sections.includes(sec);
    setRow({
      ...editing,
      sections: has ? editing.sections.filter((s) => s !== sec) : [...editing.sections, sec],
    });
  }

  function selectAllSections() {
    setRow({ ...editing, sections_mode: 'pick', sections: [...allSections] });
  }

  function handleSave() {
    const v = validatePlanningRelationRow(editing, allSections, simpleCatalog, advancedCatalog);
    if (!v.ok) {
      toast.error(v.message);
      return;
    }
    onSave(editing);
    onOpenChange(false);
  }

  const stepsReady = validatePlanningRelationRow(
    editing,
    allSections,
    simpleCatalog,
    advancedCatalog,
  ).ok;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DdDialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kural koşulları</DialogTitle>
          <p className="text-xs text-muted-foreground">
            {editing.kind === 'advanced' ? 'Plan Kartı' : 'Basit ilişki'} — ders, şube, sayı ve öncelik
          </p>
        </DialogHeader>

        <PlanningRelationConditionPanel row={editing} def={def} allSections={allSections} />

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor="pr-active" className="text-sm font-medium">
            Kural aktif
          </Label>
          <Switch
            id="pr-active"
            checked={editing.active}
            onCheckedChange={(active) => setRow({ ...editing, active })}
          />
        </div>

        <div className="space-y-4 text-sm">
          <section className="space-y-2 rounded-lg border p-3">
            <p className="font-medium text-foreground">1. Kural türü</p>
            <DdSelectField
              label="İlişki"
              value={editing.rule_id}
              onValueChange={applyRuleChange}
              options={ruleOptions}
            />
            {def?.hint && <p className="text-xs text-muted-foreground">{def.hint}</p>}
            {catalogLabel && (
              <div className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
                <span className="text-muted-foreground">Okul kuralı: </span>
                <span className="font-medium">{catalogLabel}</span>
                {catalogHint && <p className="mt-0.5 text-muted-foreground">{catalogHint}</p>}
              </div>
            )}
            {!def?.solver_supported && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Dağıtımda henüz uygulanmaz; zorunlu seçmeyin.
              </p>
            )}
            {def?.param_label && def.param_key && (
              <div>
                <Label className="text-xs">{def.param_label}</Label>
                <Input
                  type="number"
                  className="mt-1 h-8 max-w-[8rem]"
                  min={1}
                  max={8}
                  value={Number(
                    editing.params?.[
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
                    setRow({ ...editing, params: { ...editing.params, [key]: n } });
                  }}
                />
              </div>
            )}
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">
                2. Dersler
                {minSubj > 1 && (
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    (en az {minSubj})
                  </span>
                )}
              </p>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllSubjects}>
                  Tümü
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSubjects}>
                  Temizle
                </Button>
              </div>
            </div>
            <Input
              className="h-8"
              placeholder="Ders ara…"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
            />
            <div className="max-h-36 space-y-1 overflow-y-auto rounded border bg-muted/30 p-2">
              {subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">Önce stüdyoda ders tanımlayın.</p>
              ) : filteredSubjects.length === 0 ? (
                <p className="text-xs text-muted-foreground">Eşleşen ders yok.</p>
              ) : (
                filteredSubjects.map((s) => (
                  <label key={s.id} className="flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={editing.subject_ids.includes(s.id)}
                      onChange={() => toggleSubject(s.id, s.name)}
                    />
                    {s.name}
                  </label>
                ))
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {editing.subject_ids.length} ders seçili — yalnız bu derslerin atamalarına uygulanır.
            </p>
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">3. Şubeler</p>
              {editing.sections_mode === 'pick' && allSections.length > 0 && (
                <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllSections}>
                  Tüm şubeler
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={editing.sections_mode === 'all' ? 'default' : 'outline'}
                onClick={() => setRow({ ...editing, sections_mode: 'all', sections: [] })}
              >
                Tümü
              </Button>
              <Button
                type="button"
                size="sm"
                variant={editing.sections_mode === 'pick' ? 'default' : 'outline'}
                onClick={() =>
                  setRow({
                    ...editing,
                    sections_mode: 'pick',
                    sections: defaultSections?.length ? [...defaultSections] : editing.sections,
                  })
                }
              >
                Seçili şubeler
              </Button>
            </div>
            {editing.sections_mode === 'pick' && (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded border bg-muted/30 p-2">
                {allSections.length === 0 ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Tanımlı şube yok. Sınıf profillerinde şube ekleyin veya “Tümü” kullanın.
                  </p>
                ) : (
                  allSections.map((sec) => (
                    <label key={sec} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={editing.sections.includes(sec)}
                        onChange={() => toggleSection(sec)}
                      />
                      {sec}
                    </label>
                  ))
                )}
              </div>
            )}
          </section>

          <section className="space-y-2 rounded-lg border p-3">
            <p className="font-medium text-foreground">4. Öncelik ve not</p>
            <DdSelectField
              label="Üretimdeki önemi"
              value={editing.importance}
              onValueChange={(v) =>
                setRow({ ...editing, importance: v as PlanningRelationRow['importance'] })
              }
              options={IMPORTANCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <p className="text-[11px] text-muted-foreground">{IMPORTANCE_HINTS[editing.importance]}</p>
            <div>
              <Label className="text-xs">Not (isteğe bağlı)</Label>
              <Input
                className="mt-1 h-8"
                value={editing.note ?? ''}
                onChange={(e) => setRow({ ...editing, note: e.target.value })}
                placeholder="Örn. 10-A matematik–fizik aynı gün olmasın"
              />
            </div>
          </section>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <DdAccentButton type="button" onClick={handleSave} disabled={!stepsReady}>
            Koşulları kaydet
          </DdAccentButton>
        </DialogFooter>
      </DdDialogContent>
    </Dialog>
  );
}
