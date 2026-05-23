/** Program Stüdyosu — haftalık ders ızgarası */

export const STUDIO_DAY_SHORT: Record<number, string> = {
  1: 'Pa',
  2: 'Sa',
  3: 'Ça',
  4: 'Pe',
  5: 'Cu',
  6: 'Ct',
  7: 'Pz',
};

export function weekdayShort(day: number): string {
  return STUDIO_DAY_SHORT[day] ?? `${day}`;
}

export type StudioAvailState = 'available' | 'blocked' | 'conditional';

export const STUDIO_AVAIL_CYCLE: StudioAvailState[] = ['available', 'blocked', 'conditional'];

export function cycleStudioAvail(state: StudioAvailState, reverse = false): StudioAvailState {
  const i = STUDIO_AVAIL_CYCLE.indexOf(state);
  const next = reverse
    ? i <= 0
      ? STUDIO_AVAIL_CYCLE.length - 1
      : i - 1
    : (i + 1) % STUDIO_AVAIL_CYCLE.length;
  return STUDIO_AVAIL_CYCLE[next]!;
}
