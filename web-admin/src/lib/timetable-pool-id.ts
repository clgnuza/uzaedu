/** Havuz sürükleme kimliği: pool:{assignmentId}|{section}|{chunkHours}|{chunkIndex} */
export type ParsedPoolDragId = {
  assignmentId: string;
  classSection: string;
  chunkHours: number;
  chunkIndex: number;
};

export function buildPoolId(
  assignmentId: string,
  classSection: string,
  chunkHours: number,
  chunkIndex: number,
): string {
  return `pool:${assignmentId}|${encodeURIComponent(classSection)}|${chunkHours}|${chunkIndex}`;
}

export function parsePoolDragId(activeId: string): ParsedPoolDragId | null {
  if (activeId.startsWith('pool:')) {
    const rest = activeId.slice(5);
    const parts = rest.split('|');
    if (parts.length < 4) return null;
    const assignmentId = parts[0]!;
    const classSection = decodeURIComponent(parts[1]!);
    const chunkHours = Math.max(1, Number(parts[2]) || 1);
    const chunkIndex = Math.max(0, Number(parts[3]) || 0);
    if (!assignmentId) return null;
    return { assignmentId, classSection, chunkHours, chunkIndex };
  }
  if (activeId.startsWith('pool-')) {
    const assignmentId = activeId.slice(5);
    if (!assignmentId) return null;
    return { assignmentId, classSection: '', chunkHours: 1, chunkIndex: 0 };
  }
  return null;
}

/** @deprecated use parsePoolDragId */
export function parsePoolAssignmentId(activeId: string): string | null {
  return parsePoolDragId(activeId)?.assignmentId ?? null;
}
