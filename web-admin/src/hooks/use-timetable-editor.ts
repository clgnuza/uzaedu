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
};

export function useTimetableEditor(token: string | null, studioId: string | null) {
  const [programId, setProgramId] = useState('');
  const [ctx, setCtx] = useState<EditorContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<ValidationIssue[]>([]);
  const undoStack = useRef<UndoOp[]>([]);
  const [undoCount, setUndoCount] = useState(0);

  const reloadEditor = useCallback(
    async (id: string) => {
      if (!token || !studioId) return;
      const ed = await fetchEditorContext(token, studioId, id);
      setCtx(ed);
      setProgramId(id);
    },
    [token, studioId],
  );

  const load = useCallback(
    async (pid?: string, opts?: TimetableLoadOpts) => {
      const id = pid ?? programId;
      if (!token || !studioId || !id) return;
      const includeValidation = opts?.validation === true;
      setLoading(true);
      try {
        if (includeValidation) {
          const [ed, issues] = await Promise.all([
            fetchEditorContext(token, studioId, id),
            apiFetch<ValidationIssue[]>(`/ders-dagit/studios/${studioId}/validation`, { token }),
          ]);
          setCtx(ed);
          setProgramId(id);
          setValidation(issues);
        } else {
          await reloadEditor(id);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Yüklenemedi');
      } finally {
        setLoading(false);
      }
    },
    [token, studioId, programId, reloadEditor],
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

  const placeUnplaced = useCallback(
    async (assignmentId: string, day: number, lesson: number, opts?: { silent?: boolean }) => {
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
        );
        setCtx((prev) => (prev ? addEntryToContext(prev, created) : prev));
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
    placeUnplaced,
    removeEntry,
    removeEntries,
    setEntryRoom,
    toggleLock,
    undo,
    undoCount,
    canUndo: undoCount > 0,
  };
}
