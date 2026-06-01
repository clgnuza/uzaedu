import { isSlotBlocked, periodsToBlockedKeys, type UnavailablePeriod } from '@/lib/teacher-availability';
import type { StudioCellVisual } from '@/components/ders-dagit/dd-studio-time-table';

export type ReviewCellKind = 'available' | 'approved' | 'denied' | 'admin_added';

export type ReviewSummary = {
  approved: number;
  denied: number;
  admin_added: number;
  program_restrictions: number;
};

function slotKeys(workDays: number[], maxLessons: number): string[] {
  const days = workDays.length ? workDays : [1, 2, 3, 4, 5];
  const out: string[] = [];
  for (const d of days) {
    for (let l = 1; l <= maxLessons; l++) out.push(`${d}:${l}`);
  }
  return out;
}

export function computeReviewSummary(
  teacherRequest: UnavailablePeriod[],
  approved: UnavailablePeriod[] | null,
  workDays: number[],
  maxLessons: number,
): ReviewSummary {
  const teacherKeys = periodsToBlockedKeys(teacherRequest);
  const approvedKeys = periodsToBlockedKeys(approved ?? []);
  let approvedN = 0;
  let deniedN = 0;
  let adminN = 0;
  for (const key of slotKeys(workDays, maxLessons)) {
    const [d, l] = key.split(':');
    const day = Number(d);
    const lesson = Number(l);
    const wanted = isSlotBlocked(teacherKeys, day, lesson);
    const applied = isSlotBlocked(approvedKeys, day, lesson);
    if (wanted && applied) approvedN++;
    else if (wanted && !applied) deniedN++;
    else if (!wanted && applied) adminN++;
  }
  return {
    approved: approvedN,
    denied: deniedN,
    admin_added: adminN,
    program_restrictions: approvedN + adminN,
  };
}

export function reviewCellVisual(
  teacherRequest: UnavailablePeriod[],
  approved: UnavailablePeriod[] | null,
  day: number,
  lesson: number,
): StudioCellVisual {
  const teacherKeys = periodsToBlockedKeys(teacherRequest);
  const approvedKeys = periodsToBlockedKeys(approved ?? []);
  const wanted = isSlotBlocked(teacherKeys, day, lesson);
  const applied = isSlotBlocked(approvedKeys, day, lesson);

  if (wanted && applied) {
    return {
      state: 'approved',
      title: 'Talebiniz onaylandı — bu saat programda uygun değil',
    };
  }
  if (wanted && !applied) {
    return {
      state: 'denied',
      title: 'Talebiniz reddedildi — bu saat uygun kabul edildi',
    };
  }
  if (!wanted && applied) {
    return {
      state: 'blocked',
      title: 'İdare bu saati programa kısıt olarak ekledi',
    };
  }
  return { state: 'available', title: 'Uygun — programa kısıt yok' };
}

export function reviewCellKind(
  teacherRequest: UnavailablePeriod[],
  approved: UnavailablePeriod[] | null,
  day: number,
  lesson: number,
): ReviewCellKind {
  const teacherKeys = periodsToBlockedKeys(teacherRequest);
  const approvedKeys = periodsToBlockedKeys(approved ?? []);
  const wanted = isSlotBlocked(teacherKeys, day, lesson);
  const applied = isSlotBlocked(approvedKeys, day, lesson);
  if (wanted && applied) return 'approved';
  if (wanted && !applied) return 'denied';
  if (!wanted && applied) return 'admin_added';
  return 'available';
}
