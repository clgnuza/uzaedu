import { apiFetch } from './api';
import type { ProgramScoreBreakdown } from '@/lib/ders-dagit-score-breakdown';
import { resolveDefaultApiBase } from './resolve-api-base';

export type EditorEntry = {
  id: string;
  day_of_week: number;
  lesson_num: number;
  class_section: string;
  subject: string;
  user_id?: string | null;
  teacher_label?: string | null;
  room_id?: string | null;
  room_name?: string | null;
  is_locked?: boolean;
  assignment_id?: string | null;
};

export type ValidationIssue = {
  code: string;
  severity: string;
  message: string;
  fix_hint?: string;
  href?: string;
  entity_type?: string;
  entity_id?: string;
};

export type EditorContext = {
  program: { id: string; name: string | null; status: string; score: number | null };
  entries: EditorEntry[];
  period: {
    work_days: number[];
    lesson_schedule: Array<{ lesson_num: number; start_time: string; end_time: string }>;
    lesson_schedule_pm?: Array<{ lesson_num: number; start_time: string; end_time: string }>;
    lesson_schedule_weekend?: Array<{ lesson_num: number; start_time: string; end_time: string }> | null;
    lesson_schedule_weekend_pm?: Array<{ lesson_num: number; start_time: string; end_time: string }> | null;
  };
  grid: {
    blocked_lesson_nums: number[];
    long_breaks: Array<{ after_lesson: number; label?: string; blocked_slots?: number }>;
    lessons_per_day_by_dow: Record<string, number>;
  };
  rooms: Array<{ id: string; name: string }>;
  class_sections: string[];
  teachers: Array<{ id: string; label: string }>;
  teacher_availability: Array<{
    user_id: string;
    label: string;
    unavailable_periods: Array<{ day_of_week: number; lesson_num?: number }>;
  }>;
  unplaced: Array<{
    pool_id: string;
    assignment_id: string;
    subject_name: string;
    class_section: string;
    placed_hours?: number;
    remaining_hours: number;
    chunk_hours: number;
    pattern_label: string | null;
    user_id: string | null;
    teacher_label: string | null;
  }>;
  /** Atama kartı blok / haftalık dağılım — sürükle-bırak ve düzenleme */
  assignment_hints?: Record<
    string,
    { block_size: number; max_per_day: number; day_distribution: number[] | null }
  >;
  clashes: Array<{ entry_id: string; code: string; message: string; day_of_week?: number; lesson_num?: number }>;
  max_lesson: number;
  fairness: {
    ready: boolean;
    avg_lessons_per_teacher?: number;
    teacher_stats?: Array<{
      teacher_id: string;
      label: string;
      lesson_count: number;
      deviation_from_avg: number;
    }>;
  };
  /** Güncel program yerleşimine göre hesaplanır (kayıtlı meta değil). */
  score_breakdown?: ProgramScoreBreakdown | null;
};

export async function fetchEditorContext(token: string, studioId: string, programId: string) {
  return apiFetch<EditorContext>(`/ders-dagit/studios/${studioId}/programs/${programId}/editor-context`, {
    token,
  });
}

export async function patchEntry(
  token: string,
  studioId: string,
  programId: string,
  entryId: string,
  body: { day_of_week?: number; lesson_num?: number; is_locked?: boolean; room_id?: string | null },
) {
  return apiFetch<EditorEntry>(`/ders-dagit/studios/${studioId}/programs/${programId}/entries/${entryId}`, {
    token,
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function swapEntries(
  token: string,
  studioId: string,
  programId: string,
  entryIdA: string,
  entryIdB: string,
) {
  return apiFetch<{ ok: boolean }>(`/ders-dagit/studios/${studioId}/programs/${programId}/entries/swap`, {
    token,
    method: 'POST',
    body: JSON.stringify({ entry_id_a: entryIdA, entry_id_b: entryIdB }),
  });
}

export async function createEntryFromAssignment(
  token: string,
  studioId: string,
  programId: string,
  assignmentId: string,
  day: number,
  lesson: number,
  classSection?: string,
) {
  return apiFetch<EditorEntry>(`/ders-dagit/studios/${studioId}/programs/${programId}/entries`, {
    token,
    method: 'POST',
    body: JSON.stringify({
      assignment_id: assignmentId,
      day_of_week: day,
      lesson_num: lesson,
      ...(classSection ? { class_section: classSection } : {}),
    }),
  });
}

export async function deleteEntry(token: string, studioId: string, programId: string, entryId: string) {
  return apiFetch<{ ok: boolean }>(`/ders-dagit/studios/${studioId}/programs/${programId}/entries/${entryId}`, {
    token,
    method: 'DELETE',
  });
}

export async function downloadParentAllZip(token: string, studioId: string, programId: string) {
  const base = resolveDefaultApiBase().replace(/\/$/, '');
  const res = await fetch(
    `${base}/ders-dagit/studios/${studioId}/programs/${programId}/export/parent-all.zip`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error('Zip indirilemedi');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `veli-programlar-${programId.slice(0, 8)}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
