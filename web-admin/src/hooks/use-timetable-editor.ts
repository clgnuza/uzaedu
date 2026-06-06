'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  createEntryFromAssignment,
  deleteEntry,
  fetchEditorContext,
  fetchEditorExtras,
  patchEntry,
  swapEntries,
  type EditorContext,
  type EditorEntry,
  type ValidationIssue,
} from '@/lib/ders-dagit-timetable-api';
import { clashAtSlot } from '@/lib/timetable-clash';
import { detectSwapPair, orderMovesForApply } from '@/lib/timetable-drag-resolve';
import { apiFetch } from '@/lib/api';
import {
  addEntryToContext,
  mergeEntryInContext,
  removeEntriesFromContext,
  swapEntriesInContext,
} from '@/lib/timetable-editor-state';

type UndoMove = {
  kind: 'move';
  entryId: string;
  fromDay: number;
  fromLesson: number;
  toDay: number;
  toLesson: number;
};
type UndoSwap = { kind: 'swap'; a: string; b: string };
type UndoOp = UndoMove | UndoSwap;

export type TimetableLoadOpts = {
  /** Yalnızca program değişiminde; her taşıma/silmede çalıştırma */
  validation?: boolean;
  /** Layout overview — ayrı /validation isteği atlanır */
  validationIssues?: ValidationIssue[];
};

export function useTimetableEditor(token: string | null, studioId: string | null) {
  const [programId, setProgramId] = useState('');
  const [ctx, setCtx] = useState<EditorContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ValidationIssue[]>([]);
  const undoStack = useRef<UndoOp[]>([]);
  const [undoCount, setUndoCount] = useState(0);

  const loadEditorExtras = useCallback(
    (id: string) => {
      if (!token || !studioId) return;
      void fetchEditorExtras(token, studioId, id)
        .then((extras) => {
          setCtx((prev) => {
            if (!prev || prev.program.id !== id) return prev;
            return {
              ...prev,
              program: { ...prev.program, score: extras.program_score ?? prev.program.score },
              score_breakdown: extras.score_breakdown,
              fairness: extras.fairness,
            };
          });
        })
        .catch(() => {});
    },
    [token, studioId],
  );

  const reloadEditor = useCallback(
    async (id: string) => {
      if (!token || !studioId) return;
      const ed = await fetchEditorContext(token, studioId, id, { light: true });
      setCtx(ed);
      setProgramId(id);
      loadEditorExtras(id);
    },
    [token, studioId, loadEditorExtras],
  );

  const load = useCallback(
    async (pid?: string, opts?: TimetableLoadOpts) => {
      const id = pid ?? programId;
      if (!token || !studioId || !id) return;
      const includeValidation = opts?.validation === true;
      const presetValidation = opts?.validationIssues;
      setLoading(true);
      try {
        if (includeValidation) {
          const ed = await fetchEditorContext(token, studioId, id, { light: true });
          setCtx(ed);
          setProgramId(id);
          loadEditorExtras(id);
          if (presetValidation != null) {
            setValidation(presetValidation);
          } else {
            const issues = await apiFetch<ValidationIssue[]>(
              `/ders-dagit/studios/${studioId}/validation`,
              { token },
            );
            setValidation(issues);
          }
        } else {
          await reloadEditor(id);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
      } finally {
        setLoading(false);
      }
    },
    [token, studioId, programId, reloadEditor, loadEditorExtras],
  );

  const entries = ctx?.entries ?? [];

  const moveEntry = useCallback(
    async (entryId: string, toDay: number, toLesson: number, swapWithId?: string) => {
      if (!token || !studioId || !programId || !ctx) return;
      const entry = entries.find((e) => e.id === entryId);
      if (!entry || entry.is_locked) {
        toast.error('Kilitli slot taşınamaz');
        return;
      }
      if (swapWithId) {
        const other = entries.find((e) => e.id === swapWithId);
        if (!other?.is_locked) {
          setBusy(true);
          try {
            await swapEntries(token, studioId, programId, entryId, swapWithId);
            undoStack.current.push({ kind: 'swap', a: entryId, b: swapWithId });
            setUndoCount(undoStack.current.length);
            setCtx((prev) => (prev ? swapEntriesInContext(prev, entryId, swapWithId) : prev));
            toast.success('Takas edildi');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Takas başarısız');
          } finally {
            setBusy(false);
          }
          return;
        }
      }
      const occupant = entries.find(
        (e) => e.day_of_week === toDay && e.lesson_num === toLesson && e.id !== entryId,
      );
      if (occupant && !occupant.is_locked) {
        await moveEntry(entryId, toDay, toLesson, occupant.id);
        return;
      }
      const clashCtx = ctx?.group_modes ? { group_modes: ctx.group_modes } : undefined;
      const clash = clashAtSlot(
        entries,
        entryId,
        toDay,
        toLesson,
        swapWithId ? new Set([swapWithId]) : undefined,
        clashCtx,
      );
      if (clash && !swapWithId) {
        toast.error(clash === 'CLASS_CLASH' ? 'Sınıf çakışması' : 'Öğretmen çakışması');
        return;
      }
      if (occupant) {
        toast.error('Hedef dolu (kilitli)');
        return;
      }
      setBusy(true);
      try {
        const updated = await patchEntry(token, studioId, programId, entryId, {
          day_of_week: toDay,
          lesson_num: toLesson,
        });
        undoStack.current.push({
          kind: 'move',
          entryId,
          fromDay: entry.day_of_week,
          fromLesson: entry.lesson_num,
          toDay,
          toLesson,
        });
        setUndoCount(undoStack.current.length);
        setCtx((prev) => (prev ? mergeEntryInContext(prev, updated) : prev));
        toast.success('Taşındı');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Taşınamadı');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId, entries, ctx],
  );

  /** Birden çok taşımayı sırayla uygular (akıllı yer açma). */
  const applyMoves = useCallback(
    async (
      moves: Array<{ entryId: string; day: number; lesson: number }>,
      opts?: {
        primaryEntryId?: string;
        target?: { day: number; lesson: number };
        silent?: boolean;
      },
    ): Promise<boolean> => {
      if (!token || !studioId || !programId || !moves.length || !ctx) return false;
      const primary = opts?.primaryEntryId ?? moves[moves.length - 1]!.entryId;
      const target = opts?.target ?? {
        day: moves[moves.length - 1]!.day,
        lesson: moves[moves.length - 1]!.lesson,
      };
      const ordered = orderMovesForApply(moves, primary, target, ctx.entries);
      const swapPair = detectSwapPair(ordered, ctx.entries);

      setBusy(true);
      try {
        if (swapPair) {
          await swapEntries(token, studioId, programId, swapPair.a, swapPair.b);
          setCtx((prev) => (prev ? swapEntriesInContext(prev, swapPair.a, swapPair.b) : prev));
          return true;
        }
        const movingIds = new Set(ordered.map((m) => m.entryId));
        let working = ctx.entries;
        for (const m of ordered) {
          const clashCtx = ctx.group_modes ? { group_modes: ctx.group_modes } : undefined;
          const clash = clashAtSlot(working, m.entryId, m.day, m.lesson, movingIds, clashCtx);
          if (clash) {
            toast.error(clash === 'CLASS_CLASH' ? 'Sınıf çakışması' : 'Öğretmen çakışması');
            await reloadEditor(programId);
            return false;
          }
          const updated = await patchEntry(token, studioId, programId, m.entryId, {
            day_of_week: m.day,
            lesson_num: m.lesson,
          });
          working = working.map((e) => (e.id === m.entryId ? updated : e));
          setCtx((prev) => (prev ? mergeEntryInContext(prev, updated) : prev));
        }
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Taşıma başarısız');
        await reloadEditor(programId);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId, ctx, reloadEditor],
  );

  const placeUnplaced = useCallback(
    async (
      assignmentId: string,
      day: number,
      lesson: number,
      opts?: { silent?: boolean; classSection?: string; removePoolId?: string },
    ) => {
      if (!token || !studioId || !programId) return;
      setBusy(true);
      try {
        const created = await createEntryFromAssignment(
          token,
          studioId,
          programId,
          assignmentId,
          day,
          lesson,
          opts?.classSection,
        );
        setCtx((prev) =>
          prev ? addEntryToContext(prev, created, { removePoolId: opts?.removePoolId }) : prev,
        );
        if (!opts?.silent) toast.success('Yerleştirildi');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Yerleştirilemedi');
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId],
  );

  /** Ardışık saatleri tek busy döngüsünde yerleştirir (UI kilitlenmesini azaltır). */
  const placeUnplacedChunk = useCallback(
    async (
      assignmentId: string,
      day: number,
      startLesson: number,
      chunkHours: number,
      opts?: { silent?: boolean; classSection?: string; removePoolId?: string },
    ) => {
      if (!token || !studioId || !programId || chunkHours < 1) return;
      setBusy(true);
      try {
        let nextCtx = ctx;
        for (let i = 0; i < chunkHours; i++) {
          const created = await createEntryFromAssignment(
            token,
            studioId,
            programId,
            assignmentId,
            day,
            startLesson + i,
            opts?.classSection,
          );
          if (nextCtx) {
            nextCtx = addEntryToContext(nextCtx, created, {
              removePoolId: i === chunkHours - 1 ? opts?.removePoolId : undefined,
            });
          }
        }
        if (nextCtx) setCtx(nextCtx);
        if (!opts?.silent) {
          toast.success(chunkHours > 1 ? `${chunkHours} saatlik blok yerleştirildi` : 'Yerleştirildi');
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Yerleştirilemedi');
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId, ctx],
  );

  const removeEntry = useCallback(
    async (entryId: string) => {
      if (!token || !studioId || !programId) return;
      setBusy(true);
      try {
        await deleteEntry(token, studioId, programId, entryId);
        setCtx((prev) => (prev ? removeEntriesFromContext(prev, new Set([entryId])) : prev));
        toast.success('Silindi');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Silinemedi');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId],
  );

  const toggleLock = useCallback(
    async (entryId: string, locked: boolean) => {
      if (!token || !studioId || !programId) return;
      setBusy(true);
      try {
        const updated = await patchEntry(token, studioId, programId, entryId, { is_locked: locked });
        setCtx((prev) => (prev ? mergeEntryInContext(prev, updated) : prev));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId],
  );

  const setEntryRoom = useCallback(
    async (entryId: string, roomId: string | null) => {
      if (!token || !studioId || !programId) return;
      setBusy(true);
      try {
        const updated = await patchEntry(token, studioId, programId, entryId, { room_id: roomId });
        setCtx((prev) => (prev ? mergeEntryInContext(prev, updated) : prev));
        toast.success(roomId ? 'Derslik güncellendi' : 'Derslik kaldırıldı');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Derslik kaydedilemedi');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId],
  );

  const removeEntries = useCallback(
    async (entryIds: string[], successMessage?: string) => {
      if (!token || !studioId || !programId || !entryIds.length) return;
      setBusy(true);
      try {
        await Promise.all(entryIds.map((id) => deleteEntry(token, studioId, programId, id)));
        const removed = new Set(entryIds);
        setCtx((prev) => (prev ? removeEntriesFromContext(prev, removed) : prev));
        toast.success(successMessage ?? (entryIds.length === 1 ? 'Silindi' : `${entryIds.length} kart silindi`));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Silinemedi');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId],
  );

  const undo = useCallback(async () => {
    const op = undoStack.current.pop();
    setUndoCount(undoStack.current.length);
    if (!op || !token || !studioId || !programId) return;
    setBusy(true);
    try {
      if (op.kind === 'move') {
        const updated = await patchEntry(token, studioId, programId, op.entryId, {
          day_of_week: op.fromDay,
          lesson_num: op.fromLesson,
        });
        setCtx((prev) => (prev ? mergeEntryInContext(prev, updated) : prev));
      } else {
        await swapEntries(token, studioId, programId, op.a, op.b);
        setCtx((prev) => (prev ? swapEntriesInContext(prev, op.a, op.b) : prev));
      }
      toast.success('Geri alındı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Geri alınamadı');
    } finally {
      setBusy(false);
    }
  }, [token, studioId, programId]);

  const clashIds = useMemo(() => new Set((ctx?.clashes ?? []).map((c) => c.entry_id)), [ctx?.clashes]);

  return {
    programId,
    setProgramId,
    ctx,
    loading,
    busy,
    validation,
    entries,
    clashIds,
    load,
    reloadEditor,
    moveEntry,
    applyMoves,
    placeUnplaced,
    placeUnplacedChunk,
    removeEntry,
    removeEntries,
    setEntryRoom,
    toggleLock,
    undo,
    undoCount,
    canUndo: undoCount > 0,
  };
}
