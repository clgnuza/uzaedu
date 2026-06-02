import type { EditorEntry } from '@/lib/ders-dagit-timetable-api';
import { clashAtSlot } from '@/lib/timetable-clash';
import { closureAt, type SlotClosure } from '@/lib/timetable-slot-closures';
import type { SlotDropStatus } from '@/lib/timetable-slot-status';
import { computeSlotDropStatus } from '@/lib/timetable-slot-status';

export function dropStatusMessage(
  status: SlotDropStatus,
  closure?: SlotClosure,
): string {
  if (closure) return closure.label;
  switch (status) {
    case 'ok':
      return 'Bırakın — ders bu saate yerleşir';
    case 'swap':
      return 'Bırakın — mevcut dersle takas edilir';
    case 'occupied':
      return 'Çakışma — sınıf veya öğretmen bu saatte başka derste';
    case 'same':
      return 'Ders zaten bu saatte';
    case 'forbidden':
      return 'Kapalı saat — buraya bırakılamaz';
    default:
      return '';
  }
}

export type MoveValidationInput = {
  entryId: string;
  day: number;
  lesson: number;
  entries: EditorEntry[];
  closures: Map<string, SlotClosure>;
  dragging?: EditorEntry | null;
  poolClassSection?: string | null;
};

export type MoveValidationResult =
  | { ok: true; autoSwapId?: string }
  | { ok: false; message: string; status?: SlotDropStatus };

export function validateTimetableMove(input: MoveValidationInput): MoveValidationResult {
  const { entryId, day, lesson, entries, closures, dragging, poolClassSection } = input;
  const key = `${day}-${lesson}`;
  const closure = closureAt(closures, day, lesson);
  if (closure) {
    return { ok: false, message: closure.label, status: 'forbidden' };
  }

  const entry = entries.find((e) => e.id === entryId);
  if (entry?.is_locked) {
    return { ok: false, message: 'Kilitli ders taşınamaz. Önce kilidi kaldırın.' };
  }

  const dragEntry = dragging ?? entry ?? null;
  const status = computeSlotDropStatus(dragEntry, poolClassSection ?? null, day, lesson, entries, new Set(closures.keys()));

  if (status === 'same') {
    return { ok: false, message: 'Ders zaten bu saatte.', status };
  }
  if (status === 'forbidden') {
    return { ok: false, message: 'Kapalı saat.', status };
  }
  if (status === 'occupied') {
    return {
      ok: false,
      message: 'Bu saatte sınıf veya öğretmen çakışması var. Başka saat seçin veya takas kullanın.',
      status,
    };
  }

  const occupants = entries.filter(
    (e) => e.day_of_week === day && e.lesson_num === lesson && e.id !== entryId,
  );
  if (occupants.length > 1) {
    return {
      ok: false,
      message: `Bu saatte ${occupants.length} ders var. Önce çakışmayı çözün veya takas seçin.`,
    };
  }

  if (entry) {
    const clash = clashAtSlot(entries, entryId, day, lesson);
    if (clash && occupants.length === 0) {
      return {
        ok: false,
        message: clash === 'CLASS_CLASH' ? 'Sınıf bu saatte başka derste.' : 'Öğretmen bu saatte başka derste.',
        status: 'occupied',
      };
    }
  }

  if (occupants.length === 1) {
    const other = occupants[0]!;
    if (other.is_locked) {
      return { ok: false, message: 'Hedef saatte kilitli ders var; takas yapılamaz.' };
    }
    return { ok: true, autoSwapId: other.id };
  }

  if (status === 'swap' && occupants.length === 1) {
    return { ok: true, autoSwapId: occupants[0]!.id };
  }

  return { ok: true };
}

export function validatePoolPlace(
  assignmentId: string,
  day: number,
  lesson: number,
  entries: EditorEntry[],
  classSection: string,
  closures: Map<string, SlotClosure>,
  teacherId?: string | null,
): MoveValidationResult {
  const closure = closureAt(closures, day, lesson);
  if (closure) {
    return { ok: false, message: closure.label, status: 'forbidden' };
  }
  const occupants = entries.filter((e) => e.day_of_week === day && e.lesson_num === lesson);
  if (occupants.length > 1) {
    return { ok: false, message: 'Saat dolu — önce çakışmayı giderin.' };
  }
  if (occupants.some((o) => o.class_section === classSection)) {
    return { ok: false, message: 'Bu sınıfın aynı saatte zaten dersi var.', status: 'occupied' };
  }
  if (
    teacherId &&
    entries.some((e) => e.day_of_week === day && e.lesson_num === lesson && e.user_id === teacherId)
  ) {
    return { ok: false, message: 'Öğretmen bu saatte başka derste.', status: 'occupied' };
  }
  if (occupants.length === 1) {
    return { ok: false, message: 'Dolu saat — bırakınca uygun boş saat aranır veya ders taşınır.', status: 'swap' };
  }
  void assignmentId;
  return { ok: true };
}
