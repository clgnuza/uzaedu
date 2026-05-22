'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  createEntryFromAssignment,
  deleteEntry,
  fetchEditorContext,
  patchEntry,
  swapEntries,
  type EditorContext,
  type EditorEntry,
  type ValidationIssue,
} from '@/lib/ders-dagit-timetable-api';
import { clashAtSlot } from '@/lib/timetable-clash';
import { apiFetch } from '@/lib/api';

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

export function useTimetableEditor(token: string | null, studioId: string | null) {
  const [programId, setProgramId] = useState('');
  const [ctx, setCtx] = useState<EditorContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ValidationIssue[]>([]);
  const undoStack = useRef<UndoOp[]>([]);
  const [undoCount, setUndoCount] = useState(0);

  const load = useCallback(
    async (pid?: string) => {
      const id = pid ?? programId;
      if (!token || !studioId || !id) return;
      setLoading(true);
      try {
        const [ed, issues] = await Promise.all([
          fetchEditorContext(token, studioId, id),
          apiFetch<ValidationIssue[]>(`/ders-dagit/studios/${studioId}/validation`, { token }),
        ]);
        setCtx(ed);
        setProgramId(id);
        setValidation(issues);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
      } finally {
        setLoading(false);
      }
    },
    [token, studioId, programId],
  );

  const entries = ctx?.entries ?? [];

  const moveEntry = useCallback(
    async (entryId: string, toDay: number, toLesson: number, swapWithId?: string) => {
      if (!token || !studioId || !programId) return;
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
            await load(programId);
            toast.success('Takas edildi');
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Takas başarısız');
          } finally {
            setBusy(false);
          }
          return;
        }
      }
      const clash = clashAtSlot(entries, entryId, toDay, toLesson, swapWithId);
      if (clash && !swapWithId) {
        toast.error(clash === 'CLASS_CLASH' ? 'Sınıf çakışması' : 'Öğretmen çakışması');
        return;
      }
      const occupant = entries.find(
        (e) => e.day_of_week === toDay && e.lesson_num === toLesson && e.id !== entryId,
      );
      if (occupant && !occupant.is_locked) {
        await moveEntry(entryId, toDay, toLesson, occupant.id);
        return;
      }
      if (occupant) {
        toast.error('Hedef dolu (kilitli)');
        return;
      }
      setBusy(true);
      try {
        await patchEntry(token, studioId, programId, entryId, {
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
        await load(programId);
        toast.success('Taşındı');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Taşınamadı');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId, entries, load],
  );

  const placeUnplaced = useCallback(
    async (assignmentId: string, day: number, lesson: number) => {
      if (!token || !studioId || !programId) return;
      setBusy(true);
      try {
        await createEntryFromAssignment(token, studioId, programId, assignmentId, day, lesson);
        await load(programId);
        toast.success('Yerleştirildi');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Yerleştirilemedi');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId, load],
  );

  const removeEntry = useCallback(
    async (entryId: string) => {
      if (!token || !studioId || !programId) return;
      setBusy(true);
      try {
        await deleteEntry(token, studioId, programId, entryId);
        await load(programId);
        toast.success('Silindi');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Silinemedi');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId, load],
  );

  const toggleLock = useCallback(
    async (entryId: string, locked: boolean) => {
      if (!token || !studioId || !programId) return;
      setBusy(true);
      try {
        await patchEntry(token, studioId, programId, entryId, { is_locked: locked });
        await load(programId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Kayıt başarısız');
      } finally {
        setBusy(false);
      }
    },
    [token, studioId, programId, load],
  );

  const undo = useCallback(async () => {
    const op = undoStack.current.pop();
    setUndoCount(undoStack.current.length);
    if (!op || !token || !studioId || !programId) return;
    setBusy(true);
    try {
      if (op.kind === 'move') {
        await patchEntry(token, studioId, programId, op.entryId, {
          day_of_week: op.fromDay,
          lesson_num: op.fromLesson,
        });
      } else {
        await swapEntries(token, studioId, programId, op.a, op.b);
      }
      await load(programId);
      toast.success('Geri alındı');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Geri alınamadı');
    } finally {
      setBusy(false);
    }
  }, [token, studioId, programId, load]);

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
    moveEntry,
    placeUnplaced,
    removeEntry,
    toggleLock,
    undo,
    undoCount,
    canUndo: undoCount > 0,
  };
}
