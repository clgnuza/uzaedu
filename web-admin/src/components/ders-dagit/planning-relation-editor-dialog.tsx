'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DdAccentButton, DdDialogContent } from '@/components/ders-dagit/dd-ui';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PlanningRelationConditionPanel } from '@/components/ders-dagit/planning-relation-condition-panel';
import {
  applyPlanningRuleChange,
  PlanningRelationRuleFlow,
} from '@/components/ders-dagit/planning-relation-rule-flow';
import {
  advancedRuleOptionLabel,
  simpleRuleOptionLabel,
  validatePlanningRelationRow,
  type AdvancedRelationDef,
  type PlanningRelationRow,
  type SimpleRelationDef,
} from '@/lib/planning-relations';
import { getPlanningRuleFlow } from '@/lib/planning-rule-flow';
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
        label: advancedRuleOptionLabel(r),
      }));
    }
    return simpleCatalog.map((r) => ({
      value: r.id,
      label: simpleRuleOptionLabel(r),
    }));
  }, [row, simpleCatalog, advancedCatalog]);

  if (!row) return null;

  const def =
    row.kind === 'simple'
      ? simpleCatalog.find((r) => r.id === row.rule_id)
      : advancedCatalog.find((r) => r.id === row.rule_id);

  const flow = getPlanningRuleFlow(row.rule_id, row.kind);

  function applyRuleChange(ruleId: string) {
    setRow((prev) =>
      prev ? applyPlanningRuleChange(prev, ruleId, simpleCatalog, advancedCatalog) : prev,
    );
  }

  function handleSave() {
    setRow((prev) => {
      if (!prev) return prev;
      const v = validatePlanningRelationRow(prev, allSections, simpleCatalog, advancedCatalog);
      if (!v.ok) {
        toast.error(v.message);
        return prev;
      }
      onSave(prev);
      onOpenChange(false);
      return prev;
    });
  }

  const stepsReady = validatePlanningRelationRow(
    row,
    allSections,
    simpleCatalog,
    advancedCatalog,
  ).ok;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DdDialogContent className="max-h-[92vh] max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {flow.emoji} {flow.title}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {row.kind === 'advanced' ? 'Plan Kartı' : 'Basit ilişki'} — kurala özel akış
          </p>
        </DialogHeader>

        <PlanningRelationConditionPanel row={row} def={def} allSections={allSections} />

        <div className="flex items-center justify-between rounded-lg border px-3 py-2">
          <Label htmlFor="pr-active" className="text-sm font-medium">
            Kural aktif
          </Label>
          <Switch
            id="pr-active"
            checked={row.active}
            onCheckedChange={(active) => setRow({ ...row, active })}
          />
        </div>

        <PlanningRelationRuleFlow
          row={row}
          setRow={setRow}
          def={def}
          flow={flow}
          ruleOptions={ruleOptions}
          subjects={subjects}
          allSections={allSections}
          defaultSections={defaultSections}
          onRuleChange={applyRuleChange}
        />

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
