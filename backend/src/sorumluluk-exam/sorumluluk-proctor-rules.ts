import type { SorumlulukSession } from './entities/sorumluluk-session.entity';

export type SorumlulukProctorRules = {
  /** Öğrenci sayısı bu değeri aşınca salon başına gözcü gerekir. */
  studentThreshold: number;
  /** Küçük oturumlarda komisyon üye sayısı (genelde 2). */
  komisyonPerSession: number;
  /** Gözcü gerektiğinde salon başına gözcü sayısı. */
  gozcuPerRoom: number;
  /** true: öğrenci sayısı ve salon bölünmesine göre otomatik; false: sabit sayılar. */
  useSmartRules: boolean;
};

export type SessionProctorNeeds = {
  komisyon: number;
  gozcu: number;
  reason: string;
};

export const DEFAULT_SORUMLULUK_PROCTOR_RULES: SorumlulukProctorRules = {
  studentThreshold: 30,
  komisyonPerSession: 2,
  gozcuPerRoom: 1,
  useSmartRules: true,
};

export function mergeProctorRules(
  raw: Partial<SorumlulukProctorRules> | null | undefined,
): SorumlulukProctorRules {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SORUMLULUK_PROCTOR_RULES };
  return {
    studentThreshold:
      typeof raw.studentThreshold === 'number' && raw.studentThreshold > 0
        ? Math.round(raw.studentThreshold)
        : DEFAULT_SORUMLULUK_PROCTOR_RULES.studentThreshold,
    komisyonPerSession:
      typeof raw.komisyonPerSession === 'number' && raw.komisyonPerSession > 0
        ? Math.min(10, Math.round(raw.komisyonPerSession))
        : DEFAULT_SORUMLULUK_PROCTOR_RULES.komisyonPerSession,
    gozcuPerRoom:
      typeof raw.gozcuPerRoom === 'number' && raw.gozcuPerRoom >= 0
        ? Math.min(10, Math.round(raw.gozcuPerRoom))
        : DEFAULT_SORUMLULUK_PROCTOR_RULES.gozcuPerRoom,
    useSmartRules: raw.useSmartRules !== false,
  };
}

function toMinutes(t: string): number {
  const s = String(t ?? '').trim().slice(0, 5);
  const [h, m] = s.split(':').map((x) => parseInt(x, 10));
  return (h || 0) * 60 + (m || 0);
}

function clockRangesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return toMinutes(startA) < toMinutes(endB) && toMinutes(startB) < toMinutes(endA);
}

function sessionsOverlap(a: Pick<SorumlulukSession, 'sessionDate' | 'startTime' | 'endTime'>, b: Pick<SorumlulukSession, 'sessionDate' | 'startTime' | 'endTime'>): boolean {
  if (a.sessionDate.slice(0, 10) !== b.sessionDate.slice(0, 10)) return false;
  return clockRangesOverlap(
    a.startTime?.slice(0, 5) ?? '08:00',
    a.endTime?.slice(0, 5) ?? '09:00',
    b.startTime?.slice(0, 5) ?? '08:00',
    b.endTime?.slice(0, 5) ?? '09:00',
  );
}

function normalizeSubject(name: string): string {
  return name.toLowerCase().replace(/[^a-züğışöçı0-9]/gi, '').trim();
}

function roomKey(session: Pick<SorumlulukSession, 'id' | 'roomName'>): string {
  const r = (session.roomName ?? '').trim();
  return r || `__session_${session.id}`;
}

export function computeSessionProctorNeeds(
  session: Pick<SorumlulukSession, 'id' | 'sessionDate' | 'startTime' | 'endTime' | 'subjectName' | 'roomName'>,
  allSessions: Array<Pick<SorumlulukSession, 'id' | 'sessionDate' | 'startTime' | 'endTime' | 'subjectName' | 'roomName'>>,
  studentCount: number,
  skipSessionIds: Set<string>,
  rules: SorumlulukProctorRules,
): SessionProctorNeeds {
  if (!rules.useSmartRules) {
    return {
      komisyon: rules.komisyonPerSession,
      gozcu: rules.gozcuPerRoom,
      reason: 'Sabit sayı (akıllı kural kapalı)',
    };
  }

  const concurrent = allSessions.filter(
    (s) => s.id !== session.id && !skipSessionIds.has(s.id) && sessionsOverlap(session, s),
  );

  const subj = normalizeSubject(session.subjectName);
  const sameSubjectConcurrent = concurrent.filter((s) => normalizeSubject(s.subjectName) === subj);
  const roomsForSubject = new Set([roomKey(session), ...sameSubjectConcurrent.map(roomKey)]);
  const splitAcrossRooms = roomsForSubject.size > 1;

  const needsGozcu = studentCount > rules.studentThreshold || splitAcrossRooms;

  let reason: string;
  if (splitAcrossRooms && studentCount > rules.studentThreshold) {
    reason = `${rules.studentThreshold} öğrenciyi aştı ve aynı saatte ${roomsForSubject.size} salona bölündü`;
  } else if (splitAcrossRooms) {
    reason = `Aynı saatte ${roomsForSubject.size} salona bölündü`;
  } else if (studentCount > rules.studentThreshold) {
    reason = `Öğrenci sayısı ${rules.studentThreshold} üzeri (${studentCount})`;
  } else {
    reason = `${rules.studentThreshold} ve altı, tek salon — yalnızca komisyon`;
  }

  return {
    komisyon: rules.komisyonPerSession,
    gozcu: needsGozcu ? rules.gozcuPerRoom : 0,
    reason,
  };
}

export function sessionsOverlapForProctorConflict(
  a: Pick<SorumlulukSession, 'sessionDate' | 'startTime' | 'endTime'>,
  b: Pick<SorumlulukSession, 'sessionDate' | 'startTime' | 'endTime'>,
): boolean {
  return sessionsOverlap(a, b);
}
