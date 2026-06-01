'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { PlanningLessonSlotList } from '@/components/ders-dagit/planning-lesson-slot-list';
import {
  IMPORTANCE_OPTIONS,
  blockedLessonsFromParams,
  catalogKeyLabel,
  defaultParamsForRule,
  planningCatalogRuleHint,
  type AdvancedRelationDef,
  type PlanningRelationRow,
  type SimpleRelationDef,
} from '@/lib/planning-relations';
import {
  defaultParamsForFlow,
  flowParamKey,
  getPlanningRuleFlow,
  type PlanningRuleFlowConfig,
} from '@/lib/planning-rule-flow';

type SubjectOpt = { id: string; name: string };

type Props = {
  row: PlanningRelationRow;
  setRow: (row: PlanningRelationRow) => void;
  def: SimpleRelationDef | AdvancedRelationDef | undefined;
  flow: PlanningRuleFlowConfig;
  ruleOptions: { value: string; label: string }[];
  subjects: SubjectOpt[];
  allSections: string[];
  defaultSections?: string[];
  onRuleChange: (ruleId: string) => void;
};

export function PlanningRelationRuleFlow({
  row,
  setRow,
  def,
  flow,
  ruleOptions,
  subjects,
  allSections,
  defaultSections,
  onRuleChange,
}: Props) {
  const [subjectFilter, setSubjectFilter] = useState('');

  const catalogLabel = def?.catalog_key ? catalogKeyLabel(def.catalog_key) : undefined;
  const catalogHint = def?.catalog_key ? planningCatalogRuleHint(def.catalog_key) : undefined;

  const filteredSubjects = useMemo(() => {
    const q = subjectFilter.trim().toLocaleLowerCase('tr');
    if (!q) return subjects;
    return subjects.filter((s) => s.name.toLocaleLowerCase('tr').includes(q));
  }, [subjects, subjectFilter]);

  const subjectOptions = subjects.map((s) => ({ value: s.id, label: s.name }));

  function setParamValue(n: number) {
    const key = flowParamKey(flow.paramKind);
    if (!key) return;
    setRow({ ...row, params: { ...row.params, [key]: n } });
  }

  function paramValue(): number {
    const key = flowParamKey(flow.paramKind);
    if (!key) return flow.paramDefault ?? 2;
    return Number(row.params?.[key] ?? flow.paramDefault ?? (key === 'max_run' ? 4 : key === 'min_gap' ? 2 : 2));
  }

  function setOrderedSubject(slot: 0 | 1, id: string) {
    const sub = subjects.find((s) => s.id === id);
    if (!sub) return;
    const ids = [...row.subject_ids];
    const labels = [...row.subject_labels];
    ids[slot] = id;
    labels[slot] = sub.name;
    setRow({ ...row, subject_ids: ids, subject_labels: labels });
  }

  function toggleSubject(id: string, name: string) {
    const has = row.subject_ids.includes(id);
    if (has) {
      const idx = row.subject_ids.indexOf(id);
      setRow({
        ...row,
        subject_ids: row.subject_ids.filter((x) => x !== id),
        subject_labels: row.subject_labels.filter((_, i) => i !== idx),
      });
      return;
    }
    if (flow.subjectMode === 'pair_exactly_2' && row.subject_ids.length >= 2) return;
    setRow({
      ...row,
      subject_ids: [...row.subject_ids, id],
      subject_labels: [...row.subject_labels, name],
    });
  }

  function selectAllSubjects() {
    if (flow.subjectMode === 'pair_exactly_2' || flow.subjectMode === 'ordered_ab') return;
    setRow({
      ...row,
      subject_ids: subjects.map((s) => s.id),
      subject_labels: subjects.map((s) => s.name),
    });
  }

  function clearSubjects() {
    setRow({ ...row, subject_ids: [], subject_labels: [] });
  }

  function toggleSection(sec: string) {
    const has = row.sections.includes(sec);
    setRow({
      ...row,
      sections: has ? row.sections.filter((s) => s !== sec) : [...row.sections, sec],
    });
  }

  function selectAllSections() {
    setRow({ ...row, sections_mode: 'pick', sections: [...allSections] });
  }

  const showParamStep = flow.paramKind !== 'none';
  let stepNum = 1;

  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-2 rounded-lg border p-3">
        <p className="font-medium text-foreground">
          {stepNum++}. Kural — {flow.emoji} {flow.title}
        </p>
        <DdSelectField
          label="İlişki türü"
          value={row.rule_id}
          onValueChange={onRuleChange}
          options={ruleOptions}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">{flow.intro}</p>
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
        {flow.showAssignmentLink && (
          <p className="rounded-md border border-dashed px-2 py-1.5 text-xs text-muted-foreground">
            Sabit saatler atama kartından tanımlanır; bu kural yalnız o atamaları kilitler.
          </p>
        )}
        {flow.tips.length > 0 && (
          <ul className="list-inside list-disc text-[11px] text-muted-foreground">
            {flow.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
      </section>

      {showParamStep && (
        <section className="space-y-2 rounded-lg border p-3">
          <p className="font-medium text-foreground">
            {stepNum++}. {flow.paramTitle ?? 'Sayısal ayar'}
          </p>
          {flow.paramKind === 'lesson_nums' ? (
            <PlanningLessonSlotList
              variant={row.rule_id === 'adv_no_end_hour' ? 'end' : 'start'}
              selected={blockedLessonsFromParams(row.params)}
              onChange={(blocked_lessons) =>
                setRow({ ...row, params: { ...row.params, blocked_lessons } })
              }
            />
          ) : (
            <>
              {flow.paramHint && (
                <p className="text-xs text-muted-foreground">{flow.paramHint}</p>
              )}
              <div>
                <Label className="text-xs">{flow.paramTitle}</Label>
                <Input
                  type="number"
                  className="mt-1 h-8 max-w-[8rem]"
                  min={flow.paramMin ?? 1}
                  max={flow.paramMax ?? 8}
                  value={paramValue()}
                  onChange={(e) => setParamValue(Number(e.target.value))}
                />
              </div>
            </>
          )}
        </section>
      )}

      <section className="space-y-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">
            {stepNum++}. {flow.subjectTitle}
          </p>
          {flow.subjectMode === 'multi' && (
            <div className="flex gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllSubjects}>
                Tümü
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={clearSubjects}>
                Temizle
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{flow.subjectHint}</p>

        {flow.subjectMode === 'ordered_ab' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <DdSelectField
              label="A — önce gelen"
              value={row.subject_ids[0] ?? ''}
              onValueChange={(v) => setOrderedSubject(0, v)}
              options={subjectOptions}
              placeholder="Ders seçin"
            />
            <DdSelectField
              label="B — sonra gelen"
              value={row.subject_ids[1] ?? ''}
              onValueChange={(v) => setOrderedSubject(1, v)}
              options={subjectOptions.filter((o) => o.value !== row.subject_ids[0])}
              placeholder="Ders seçin"
            />
          </div>
        ) : flow.subjectMode === 'pair_exactly_2' ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <DdSelectField
              label="1. ders kartı"
              value={row.subject_ids[0] ?? ''}
              onValueChange={(v) => setOrderedSubject(0, v)}
              options={subjectOptions}
              placeholder="Ders seçin"
            />
            <DdSelectField
              label="2. ders kartı"
              value={row.subject_ids[1] ?? ''}
              onValueChange={(v) => setOrderedSubject(1, v)}
              options={subjectOptions.filter((o) => o.value !== row.subject_ids[0])}
              placeholder="Ders seçin"
            />
          </div>
        ) : (
          <>
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
                      checked={row.subject_ids.includes(s.id)}
                      onChange={() => toggleSubject(s.id, s.name)}
                    />
                    {s.name}
                  </label>
                ))
              )}
            </div>
          </>
        )}
        <p className="text-[11px] text-muted-foreground">
          {row.subject_ids.length} ders seçili
          {flow.subjectMode === 'ordered_ab' && row.subject_labels.length === 2
            ? ` — ${row.subject_labels[0]} → ${row.subject_labels[1]}`
            : ''}
        </p>
      </section>

      <section className="space-y-2 rounded-lg border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium text-foreground">{stepNum++}. Şubeler</p>
          {row.sections_mode === 'pick' && allSections.length > 0 && (
            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAllSections}>
              Tüm şubeler
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{flow.sectionsHint}</p>
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
            Seçili şubeler
          </Button>
        </div>
        {row.sections_mode === 'pick' && (
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
                    checked={row.sections.includes(sec)}
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
        <p className="font-medium text-foreground">{stepNum++}. Öncelik ve not</p>
        <DdSelectField
          label="Üretimdeki önemi"
          value={row.importance}
          onValueChange={(v) => setRow({ ...row, importance: v as PlanningRelationRow['importance'] })}
          options={IMPORTANCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <p className="text-[11px] text-muted-foreground">{flow.importanceHint}</p>
        <div>
          <Label className="text-xs">Not</Label>
          <Input
            className="mt-1 h-8"
            value={row.note ?? ''}
            onChange={(e) => setRow({ ...row, note: e.target.value })}
            placeholder={flow.notePlaceholder}
          />
        </div>
      </section>
    </div>
  );
}

export function applyPlanningRuleChange(
  row: PlanningRelationRow,
  ruleId: string,
  simpleCatalog: SimpleRelationDef[],
  advancedCatalog: AdvancedRelationDef[],
): PlanningRelationRow {
  const nextDef =
    row.kind === 'simple'
      ? simpleCatalog.find((r) => r.id === ruleId)
      : advancedCatalog.find((r) => r.id === ruleId);
  const flow = getPlanningRuleFlow(ruleId, row.kind);
  return {
    ...row,
    rule_id: ruleId,
    importance: flow.importanceDefault,
    params: defaultParamsForFlow(flow) ?? defaultParamsForRule(nextDef),
    subject_ids: [],
    subject_labels: [],
  };
}
