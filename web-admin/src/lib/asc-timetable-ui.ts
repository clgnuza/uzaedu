/** aSc Timetables benzeri ızgara terimleri */

export const ASC_DAY_SHORT: Record<number, string> = {
  1: 'Pa',
  2: 'Sa',
  3: 'Ça',
  4: 'Pe',
  5: 'Cu',
  6: 'Ct',
  7: 'Pz',
};

export function ascDayShort(day: number): string {
  return ASC_DAY_SHORT[day] ?? `${day}`;
}

export type AscAvailState = 'available' | 'blocked' | 'conditional';

export const ASC_AVAIL_CYCLE: AscAvailState[] = ['available', 'blocked', 'conditional'];

export function cycleAscAvail(state: AscAvailState, reverse = false): AscAvailState {
  const i = ASC_AVAIL_CYCLE.indexOf(state);
  const next = reverse ? (i <= 0 ? ASC_AVAIL_CYCLE.length - 1 : i - 1) : (i + 1) % ASC_AVAIL_CYCLE.length;
  return ASC_AVAIL_CYCLE[next]!;
}
