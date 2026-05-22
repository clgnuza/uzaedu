'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Archive,
  Copy,
  GripVertical,
  LayoutGrid,
  MousePointerClick,
  Pencil,
  Sparkles,
  Star,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useDersDagitStudio } from '@/hooks/use-ders-dagit-studio';
import { StudioValidationGate } from '@/components/ders-dagit/StudioValidationGate';
import { computeStudioReadiness, type StudioReadiness } from '@/lib/ders-dagit-readiness';
import { apiFetch } from '@/lib/api';
import {
  archiveProgram,
  cloneProgram,
  deleteProgram,
  listStudioPrograms,
  setFavoriteProgram,
  type DdProgramRow,
} from '@/lib/ders-dagit-program-api';
import { ProgramManageBar } from '@/components/timetable/ProgramManageBar';
import { TimetableReadonly } from '@/components/timetable/TimetableReadonly';
import { Button } from '@/components/ui/button';
import { DdAccentButton, DdCard, DdGlassPanel, DdPageHeader, CardContent, CardHeader, CardTitle } from '@/components/ders-dagit/dd-ui';
import { DdSelectField } from '@/components/ders-dagit/dd-select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type CompareRow = { id: string; name: string | null; score: number | null; entry_count: number };
type PreviewEntry = { day_of_week: number; lesson_num: number; class_section: string; subject: string };

type GenerateResult = {
  programs: Array<{ id: string; name: string; score: number | null }>;
  score?: number;
  violations?: string[];
  violation_links?: Array<{ text: string; href?: string }>;
  failed?: number;
  entries_count?: number;
};

const PREVIEW_DROP_ID = 'preview-drop';

function ReadinessRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <div className="relative size-[4.5rem] shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-[rgb(var(--dd-accent))] transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {percent}%
      </span>
    </div>
  );
}

function SortableDraftCard({
  draft,
  active,
  isBest,
  onSelect,
  onClone,
  onFavorite,
  onArchive,
  onDelete,
}: {
  draft: CompareRow;
  active: boolean;
  isBest: boolean;
  onSelect: () => void;
  onClone: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: draft.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const scorePct = draft.score != null ? Math.min(100, Math.max(0, draft.score)) : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-xl border bg-card/80 p-3 shadow-sm backdrop-blur-sm transition-shadow',
        active ? 'border-[rgb(var(--dd-accent))] ring-2 ring-[rgb(var(--dd-accent))]/25' : 'border-border/70',
        isBest && !active && 'border-emerald-500/50',
        isDragging && 'opacity-40',
      )}
    >
      <div className="flex gap-2">
        <button
          type="button"
          className="mt-0.5 shrink-0 cursor-grab touch-manipulation text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Sürükle"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
          <div className="flex items-start justify-between gap-2">
            <p className="truncate font-medium">{draft.name ?? draft.id.slice(0, 8)}</p>
            {isBest && (
              <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:text-emerald-200">
                Önerilen
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{draft.entry_count} ders saati</p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[rgb(var(--dd-accent))] to-violet-500 transition-all"
              style={{ width: `${scorePct}%` }}
            />
          </div>
          <p className="mt-1 text-xs tabular-nums">
            Puan <strong>{draft.score ?? '—'}</strong>
          </p>
        </button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Önizlemeye sürükleyin veya tıklayın</p>
      <div className="mt-2 flex flex-wrap gap-1 opacity-90 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
        <Button type="button" size="sm" variant={active ? 'default' : 'outline'} asChild>
          <Link href={`/ders-dagit/studyo/program?id=${draft.id}`}>
            <Pencil className="mr-1 size-3" />
            Düzenle
          </Link>
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onClone}>
          <Copy className="size-3" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onFavorite}>
          <Star className="size-3" />
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onArchive}>
          <Archive className="size-3" />
        </Button>
        <Button type="button" size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function DraftDragPreview({ draft }: { draft: CompareRow }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--dd-accent))] bg-card px-3 py-2 shadow-xl">
      <p className="text-sm font-medium">{draft.name ?? 'Taslak'}</p>
      <p className="text-xs text-muted-foreground">Puan {draft.score ?? '—'}</p>
    </div>
  );
}

function PreviewDropPanel({
  children,
  isOver,
  hasPreview,
  busy,
}: {
  children: React.ReactNode;
  isOver: boolean;
  hasPreview: boolean;
  busy: boolean;
}) {
  const { setNodeRef, isOver: over } = useDroppable({ id: PREVIEW_DROP_ID });
  const highlight = isOver || over;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-h-[280px] rounded-2xl border-2 border-dashed transition-all duration-200',
        highlight
          ? 'border-[rgb(var(--dd-accent))] bg-[rgb(var(--dd-accent))]/8 shadow-inner'
          : 'border-border/60 bg-muted/10',
        busy && 'animate-pulse',
      )}
    >
      {!hasPreview && !busy && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <LayoutGrid className="size-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">Önizleme alanı</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Taslak kartını buraya sürükleyin veya soldan seçin. Tam düzenleme için tablo görünümüne geçin.
          </p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full border border-border/80 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
            <MousePointerClick className="size-3" />
            Sürükle-bırak
          </span>
        </div>
      )}
      {busy && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/60 backdrop-blur-[2px]">
          <Wand2 className="size-8 animate-pulse text-[rgb(var(--dd-accent))]" />
          <p className="text-sm font-medium">Programlar oluşturuluyor…</p>
        </div>
      )}
      <div className={cn('relative p-2 sm:p-3', !hasPreview && !busy && 'opacity-0')}>{children}</div>
      {highlight && (
        <div className="pointer-events-none absolute inset-x-3 top-3 rounded-md bg-[rgb(var(--dd-accent))]/90 px-2 py-1 text-center text-xs font-medium text-white">
          Bırak — önizle
        </div>
      )}
    </div>
  );
}

export function ProgramGenerateStudio() {
  const { token } = useAuth();
  const { studio, overview, refresh } = useDersDagitStudio();
  const readiness = computeStudioReadiness(overview);
  const [busy, setBusy] = useState(false);
  const [useCsp, setUseCsp] = useState(true);
  const [versions, setVersions] = useState('3');
  const [durationSec, setDurationSec] = useState('90');
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [draftOrder, setDraftOrder] = useState<string[]>([]);
  const [compareMap, setCompareMap] = useState<Map<string, CompareRow>>(new Map());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewEntries, setPreviewEntries] = useState<PreviewEntry[]>([]);
  const [previewSection, setPreviewSection] = useState('');
  const [existing, setExisting] = useState<DdProgramRow[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 160, tolerance: 8 } }),
  );

  const orderedDrafts = useMemo(() => {
    return draftOrder.map((id) => compareMap.get(id)).filter(Boolean) as CompareRow[];
  }, [draftOrder, compareMap]);

  const bestId = useMemo(() => {
    const sorted = [...orderedDrafts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return sorted[0]?.id ?? null;
  }, [orderedDrafts]);

  const sections = useMemo(() => {
    const s = new Set(previewEntries.map((e) => e.class_section));
    return [...s].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [previewEntries]);

  useEffect(() => {
    if (sections.length && !previewSection) setPreviewSection(sections[0]!);
  }, [sections, previewSection]);

  const loadExisting = useCallback(async () => {
    if (!token || !studio) return;
    setExisting(await listStudioPrograms(token, studio.id));
  }, [token, studio]);

  useEffect(() => {
    void loadExisting();
  }, [loadExisting]);

  const loadPreview = useCallback(
    async (id: string) => {
      if (!token || !studio) return;
      setPreviewId(id);
      const d = await apiFetch<{ entries: PreviewEntry[] }>(
        `/ders-dagit/studios/${studio.id}/programs/${id}`,
        { token },
      );
      setPreviewEntries(d.entries);
      const secs = [...new Set(d.entries.map((e) => e.class_section))].sort((a, b) => a.localeCompare(b, 'tr'));
      setPreviewSection(secs[0] ?? '');
    },
    [token, studio],
  );

  function setCompareRows(rows: CompareRow[]) {
    setCompareMap(new Map(rows.map((r) => [r.id, r])));
    setDraftOrder(rows.map((r) => r.id));
  }

  async function generate() {
    if (!token || !studio) return;
    setBusy(true);
    setPreviewEntries([]);
    setPreviewId(null);
    try {
      const res = await apiFetch<GenerateResult & { entries_count: number }>(
        `/ders-dagit/studios/${studio.id}/generate`,
        { token, method: 'POST', body: { duration_sec: Number(durationSec), versions: Number(versions), use_csp: useCsp } },
      );
      setResult({
        programs: res.programs.map((p) => ({ id: p.id, name: p.name ?? 'Program', score: p.score })),
        score: res.score,
        violations: res.violations,
        violation_links: res.violation_links,
        failed: res.failed,
        entries_count: res.entries_count,
      });
      const ids = res.programs.map((p) => p.id).join(',');
      if (ids) {
        const cmp = await apiFetch<{ programs: CompareRow[] }>(
          `/ders-dagit/studios/${studio.id}/programs/compare?ids=${ids}`,
          { token },
        );
        setCompareRows(cmp.programs);
        const best = [...cmp.programs].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
        if (best) await loadPreview(best.id);
      }
      toast.success(`${res.entries_count} ders saati yerleştirildi`);
      await refresh({ force: true });
      await loadExisting();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Üretim başarısız');
    } finally {
      setBusy(false);
    }
  }

  function removeDraft(id: string) {
    setDraftOrder((o) => o.filter((x) => x !== id));
    setCompareMap((m) => {
      const n = new Map(m);
      n.delete(id);
      return n;
    });
    setResult((r) => (r ? { ...r, programs: r.programs.filter((p) => p.id !== id) } : r));
    if (previewId === id) {
      setPreviewId(null);
      setPreviewEntries([]);
    }
  }

  function onDragStart(ev: DragStartEvent) {
    setActiveDragId(String(ev.active.id));
  }

  function onDragEnd(ev: DragEndEvent) {
    setActiveDragId(null);
    const activeId = String(ev.active.id);
    const overId = ev.over?.id ? String(ev.over.id) : null;

    if (overId === PREVIEW_DROP_ID && compareMap.has(activeId)) {
      void loadPreview(activeId);
      return;
    }

    if (overId && activeId !== overId && draftOrder.includes(activeId) && draftOrder.includes(overId)) {
      const oldIndex = draftOrder.indexOf(activeId);
      const newIndex = draftOrder.indexOf(overId);
      setDraftOrder(arrayMove(draftOrder, oldIndex, newIndex));
    }
  }

  const violationItems =
    result?.violation_links?.length
      ? result.violation_links
      : result?.violations?.map((t) => ({ text: t })) ?? [];

  const dragDraft = activeDragId ? compareMap.get(activeDragId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        <DdPageHeader
          icon={Sparkles}
          title="Program oluştur"
          description="Taslakları sürükleyerek önizleyin; tabloda sürükle-bırak ile düzenleyin."
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start">
          <div className="space-y-4">
            <DdCard variant="sky">
              <CardContent className="flex gap-4 pt-5">
                <ReadinessRing percent={readiness.percent} />
                <div className="min-w-0 space-y-2 text-sm">
                  <p className="font-medium">Hazırlık</p>
                  <ReadinessChips readiness={readiness} />
                </div>
              </CardContent>
            </DdCard>

            <DdCard variant="indigo">
              <CardHeader>
                <CardTitle className="text-base">Üret</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <StudioValidationGate overview={overview} action="generate">
                  <div className="grid gap-2">
                    <DdSelectField
                      label="Taslak"
                      value={versions}
                      onValueChange={setVersions}
                      options={[
                        { value: '1', label: '1' },
                        { value: '2', label: '2' },
                        { value: '3', label: '3' },
                      ]}
                    />
                    <DdSelectField
                      label="Süre (sn)"
                      value={durationSec}
                      onValueChange={setDurationSec}
                      options={[
                        { value: '60', label: '60' },
                        { value: '90', label: '90' },
                        { value: '120', label: '120' },
                      ]}
                    />
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input type="checkbox" checked={useCsp} onChange={(e) => setUseCsp(e.target.checked)} />
                      Gelişmiş yerleştirme
                    </label>
                  </div>
                  <DdAccentButton type="button" className="w-full" disabled={busy || !studio} onClick={() => void generate()}>
                    <Wand2 className="mr-2 size-4" />
                    {busy ? 'Oluşturuluyor…' : `${versions} taslak oluştur`}
                  </DdAccentButton>
                </StudioValidationGate>
              </CardContent>
            </DdCard>

            {orderedDrafts.length > 0 && (
              <DdCard variant="violet">
                <CardHeader>
                  <CardTitle className="text-base">Taslaklar</CardTitle>
                </CardHeader>
                <CardContent>
                  <SortableContext items={draftOrder} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {orderedDrafts.map((d) => (
                        <SortableDraftCard
                          key={d.id}
                          draft={d}
                          active={previewId === d.id}
                          isBest={d.id === bestId}
                          onSelect={() => void loadPreview(d.id)}
                          onClone={() =>
                            void (async () => {
                              if (!token || !studio) return;
                              const c = await cloneProgram(token, studio.id, d.id);
                              toast.success('Kopyalandı');
                              await loadExisting();
                              await loadPreview(c.id);
                            })()
                          }
                          onFavorite={() =>
                            void (async () => {
                              if (!token || !studio) return;
                              await setFavoriteProgram(token, studio.id, d.id);
                              toast.success('Favori');
                              await loadExisting();
                            })()
                          }
                          onArchive={() =>
                            void (async () => {
                              if (!token || !studio) return;
                              await archiveProgram(token, studio.id, d.id);
                              toast.success('Arşivlendi');
                              removeDraft(d.id);
                              await loadExisting();
                            })()
                          }
                          onDelete={() => {
                            if (!window.confirm('Silinsin mi?') || !token || !studio) return;
                            void (async () => {
                              await deleteProgram(token, studio.id, d.id);
                              toast.success('Silindi');
                              removeDraft(d.id);
                              await loadExisting();
                            })();
                          }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </CardContent>
              </DdCard>
            )}

            {result && violationItems.length > 0 && (
              <ul className="max-h-24 overflow-y-auto rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
                {violationItems.slice(0, 8).map((v, i) => (
                  <li key={i} className="text-muted-foreground">
                    {v.href ? <Link href={v.href} className="underline">{v.text}</Link> : v.text}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DdGlassPanel strong className="space-y-3 p-3 sm:p-4 lg:sticky lg:top-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Görsel önizleme</h2>
              {result?.score != null && (
                <span className="rounded-full bg-[rgb(var(--dd-accent))]/15 px-2 py-0.5 text-xs font-medium tabular-nums">
                  En iyi puan {result.score}
                </span>
              )}
            </div>

            {sections.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {sections.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                      previewSection === sec
                        ? 'border-[rgb(var(--dd-accent))] bg-[rgb(var(--dd-accent))]/15 font-medium'
                        : 'border-border/70 hover:bg-muted/50',
                    )}
                    onClick={() => setPreviewSection(sec)}
                  >
                    {sec}
                  </button>
                ))}
              </div>
            )}

            <PreviewDropPanel isOver={!!activeDragId} hasPreview={previewEntries.length > 0} busy={busy}>
              {previewEntries.length > 0 && (
                <TimetableReadonly
                  entries={previewEntries}
                  classSection={sections.length > 1 ? previewSection : undefined}
                />
              )}
            </PreviewDropPanel>

            {previewId && token && studio && (
              <div className="space-y-2 border-t border-border/50 pt-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" asChild>
                    <Link href={`/ders-dagit/studyo/program?id=${previewId}`}>
                      <LayoutGrid className="mr-1 size-3.5" />
                      Tabloda sürükle-bırak düzenle
                    </Link>
                  </Button>
                </div>
                <ProgramManageBar
                  programId={previewId}
                  program={
                    existing.find((e) => e.id === previewId) ??
                    ({ id: previewId, name: null, status: 'generated', score: null } as DdProgramRow)
                  }
                  onChanged={async (opts) => {
                    await loadExisting();
                    if (opts?.removedId) removeDraft(opts.removedId);
                    if (opts?.selectId) await loadPreview(opts.selectId);
                  }}
                  compact
                />
              </div>
            )}
          </DdGlassPanel>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragDraft ? <DraftDragPreview draft={dragDraft} /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function ReadinessChips({ readiness }: { readiness: StudioReadiness }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {readiness.phases.data.steps
        .filter((s) => s.required)
        .map((s) => (
          <Link
            key={s.id}
            href={s.href}
            className={cn(
              'rounded-full border px-2 py-0.5 transition-colors',
              s.done ? 'border-emerald-500/40 bg-emerald-500/10' : 'border-amber-500/40 bg-amber-500/10',
            )}
          >
            {s.label}
          </Link>
        ))}
      <Link href="/ders-dagit/studyo/kurallar" className="rounded-full border px-2 py-0.5 hover:bg-muted/50">
        Kurallar
      </Link>
      <Link href="/ders-dagit/studyo/planlama-iliskileri" className="rounded-full border px-2 py-0.5 hover:bg-muted/50">
        Planlama
      </Link>
    </div>
  );
}
