import type { EditorContext } from '@/lib/ders-dagit-timetable-api';
import type { ParsedPoolDragId } from '@/lib/timetable-pool-id';
import { buildPoolId, parsePoolDragId } from '@/lib/timetable-pool-id';

export type UnplacedPoolRow = EditorContext['unplaced'][number];

export function findUnplacedPoolRow(
  ctx: EditorContext,
  poolKey: string | ParsedPoolDragId,
): UnplacedPoolRow | undefined {
  if (typeof poolKey === 'string') {
    const byId = ctx.unplaced.find((u) => u.pool_id === poolKey);
    if (byId) return byId;
  }
  const parsed = typeof poolKey === 'string' ? parsePoolDragId(poolKey) : poolKey;
  if (!parsed) return undefined;
  const built = buildPoolId(
    parsed.assignmentId,
    parsed.classSection,
    parsed.chunkHours,
    parsed.chunkIndex,
  );
  return (
    ctx.unplaced.find((u) => u.pool_id === built) ??
    ctx.unplaced.find(
      (u) =>
        u.assignment_id === parsed.assignmentId &&
        (!parsed.classSection || u.class_section === parsed.classSection) &&
        (u.chunk_hours ?? u.remaining_hours) === parsed.chunkHours,
    )
  );
}
