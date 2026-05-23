'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { sortClassSections } from '@/lib/class-section-sort';
import { useSearchParams } from 'next/navigation';
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Play,
  Square,
  Sparkles,
  Scale,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { apiFetch } from '@/lib/api';
import {
  defaultImportanceForRule,
  defaultParamsForRule,
  newRelationId,
  relationSummary,
  type AdvancedRelationDef,
  type PlanningRelationRow,
  type SimpleRelationDef,
} from '@/lib/planning-relations';
import { PlanningRelationEditorDialog } from '@/components/ders-dagit/planning-relation-editor-dialog';
import { PlanningRelationRulePickerDialog } from '@/components/ders-dagit/planning-relation-rule-picker-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type RulesRes = {
  planning_relations: PlanningRelationRow[];
  simple_planning_catalog: SimpleRelationDef[];
  advanced_planning_catalog: AdvancedRelationDef[];
  class_profiles?: Array<{ id: string; name: string; class_sections?: string[] }>;
};

type SubjectRow = { id: string; name: string };

function emptyRow(kind: 'simple' | 'advanced', ruleId: string, order: number): PlanningRelationRow {
  return {
    id: newRelationId(),
    active: true,
    kind,
    rule_id: ruleId,
    importance: 'normal',
    subject_ids: [],
    subject_labels: [],
    sections_mode: 'all',
    sections: [],
    sort_order: order,
  };
}

export function PlanningRelationsPanel() {
  const { token } = useAuth();
  const { studio } = useDersDagitStudio();
  const searchParams = useSearchParams();
  const [data, setData] = useState<RulesRes | null>(null);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [rows, setRows] = useState<PlanningRelationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<PlanningRelationRow | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'simple' | 'advanced'>('simple');
  const [saving, setSaving] = useState(false);

  const defaultSections = useMemo(() => {
    const sec = searchParams.get('section');
    return sec ? [sec] : [];
  }, [searchParams]);

  const allSections = useMemo(() => {
    const s = new Set<string>();
    for (const p of data?.class_profiles ?? []) {
      for (const x of p.class_sections ?? []) s.add(x);
    }
    return sortClassSections([...s]);
  }, [data]);

  const load = useCallback(async () => {
    if (!token || !studio) return;
    const [r, subj] = await Promise.all([
      apiFetch<RulesRes>(`/ders-dagit/studios/${studio.id}/rules`, { token }),
      apiFetch<SubjectRow[]>(`/ders-dagit/studios/${studio.id}/subjects`, { token }),
    ]);
    setData(r);
    setSubjects(subj);
    const list = [...(r.planning_relations ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    setRows(list);
    if (list.length) setSelectedId((prev) => prev ?? list[0]!.id);
  }, [token, studio]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const simple = data?.simple_planning_catalog ?? [];
  const advanced = data?.advanced_planning_catalog ?? [];

  async function persist(next: PlanningRelationRow[]) {
    if (!token || !studio) return;
    setSaving(true);
    try {
      const res = await apiFetch<RulesRes>(`/ders-dagit/studios/${studio.id}/planning-relations`, {
        token,
        method: 'PATCH',
        body: JSON.stringify({ relations: next.map((r, i) => ({ ...r, sort_order: i })) }),
      });
      setData(res);
      const list = [...(res.planning_relations ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      setRows(list);
      toast.success('Planlama ilişkileri kaydedildi');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
    } finally {
      setSaving(false);
    }
  }

  function openNew(kind: 'simple' | 'advanced', ruleId: string) {
    const def =
      kind === 'simple'
        ? simple.find((r) => r.id === ruleId)
        : advanced.find((r) => r.id === ruleId);
    const row = emptyRow(kind, ruleId, rows.length);
    row.importance = defaultImportanceForRule(def);
    const params = defaultParamsForRule(def);
    if (params) row.params = params;
    if (defaultSections.length) {
      row.sections_mode = 'pick';
      row.sections = [...defaultSections];
    }
    setDraft(row);
    setEditorOpen(true);
  }

  function openEdit() {
    if (!selected) return;
    setDraft({ ...selected });
    setEditorOpen(true);
  }

  async function onSave(row: PlanningRelationRow) {
    const i = rows.findIndex((r) => r.id === row.id);
    const next = i >= 0 ? rows.map((r) => (r.id === row.id ? row : r)) : [...rows, row];
    setRows(next);
    setSelectedId(row.id);
    await persist(next);
  }

  function move(delta: -1 | 1) {
    if (!selectedId) return;
    const i = rows.findIndex((r) => r.id === selectedId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= rows.length) return;
    const next = [...rows];
    const t = next[i]!;
    next[i] = next[j]!;
    next[j] = t;
    setRows(next);
    void persist(next);
  }

  const scopeHint = searchParams.get('section');

  return (
    <div className="space-y-3">
      {scopeHint && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <strong>Şube kapsamı:</strong> {scopeHint} — yeni ilişkilerde sınıf seçimi önceden doldurulur.
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground max-w-xl">
          Plan Kartları: ders, şube ve ilişki türü. Aktif ve dağıtım destekli kurallar üretimde okul kurallarıyla
          birleştirilir; seçilen dersler yalnızca o ders atamalarına uygulanır.
        </p>
        <Link
          href="/ders-dagit/studyo/kurallar"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Scale className="h-3.5 w-3.5" />
          Okul kuralları (switch listesi)
        </Link>
      </div>

      <div className="dd-glass-panel flex flex-wrap items-center gap-2 rounded-xl border p-3">
        <p className="w-full text-sm font-medium">Kural ekle</p>
        <Button
          type="button"
          size="sm"
          disabled={saving || !simple.length}
          onClick={() => {
            setPickerMode('simple');
            setPickerOpen(true);
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Basit ilişki
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving || !advanced.length}
          onClick={() => {
            setPickerMode('advanced');
            setPickerOpen(true);
          }}
        >
          <Sparkles className="mr-1 h-3.5 w-3.5" />
          Plan Kartı (gelişmiş)
        </Button>
      </div>

      <div className="dd-glass-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Dersler</TableHead>
              <TableHead>Uygula</TableHead>
              <TableHead>Tanımlama</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  Kayıt yok. Yukarıdan kural ekleyin.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow
                  key={r.id}
                  className={r.id === selectedId ? 'bg-muted/60' : 'cursor-pointer'}
                  onClick={() => setSelectedId(r.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedId === r.id}
                      onChange={() => setSelectedId(r.id)}
                      aria-label="Seç"
                      className="size-4 rounded border-border accent-[rgb(var(--dd-accent))]"
                    />
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.subject_labels.length ? r.subject_labels.join(', ') : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.sections_mode === 'all' ? 'Tüm sınıflar' : r.sections.join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className={r.active ? '' : 'text-muted-foreground line-through'}>
                      {relationSummary(r, simple, advanced)}
                    </span>
                    {!r.active && <span className="ml-1 text-amber-600">(kapalı)</span>}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t pt-3">
        <Button type="button" size="sm" variant="outline" disabled={!selected || saving} onClick={openEdit}>
          <Pencil className="mr-1 h-3.5 w-3.5" />
          Düzenle
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected || saving}
          onClick={() => {
            if (!selected) return;
            const next = rows.filter((r) => r.id !== selected.id);
            setRows(next);
            setSelectedId(next[0]?.id ?? null);
            void persist(next);
          }}
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Sil
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected || saving}
          onClick={() => {
            if (!selected) return;
            const next = rows.map((r) => (r.id === selected.id ? { ...r, active: true } : r));
            setRows(next);
            void persist(next);
          }}
        >
          <Play className="mr-1 h-3.5 w-3.5" />
          Aktif
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected || saving}
          onClick={() => {
            if (!selected) return;
            const next = rows.map((r) => (r.id === selected.id ? { ...r, active: false } : r));
            setRows(next);
            void persist(next);
          }}
        >
          <Square className="mr-1 h-3.5 w-3.5" />
          Kapat
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!selected || saving} onClick={() => move(-1)}>
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={!selected || saving} onClick={() => move(1)}>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!selected || saving}
          onClick={() => {
            if (!selected) return;
            const copy: PlanningRelationRow = {
              ...selected,
              id: newRelationId(),
              sort_order: rows.length,
            };
            const next = [...rows, copy];
            setRows(next);
            setSelectedId(copy.id);
            void persist(next);
          }}
        >
          <Copy className="mr-1 h-3.5 w-3.5" />
          Kopyala
        </Button>
      </div>

      <PlanningRelationRulePickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        simpleCatalog={simple}
        advancedCatalog={advanced}
        initialMode={pickerMode}
        onPick={(kind, ruleId) => openNew(kind, ruleId)}
      />

      <PlanningRelationEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        draft={draft}
        simpleCatalog={simple}
        advancedCatalog={advanced}
        subjects={subjects}
        allSections={allSections}
        defaultSections={defaultSections}
        onSave={(row) => void onSave(row)}
      />
    </div>
  );
}
