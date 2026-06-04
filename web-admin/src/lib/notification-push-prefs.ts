/** Dakika (0–1439) ↔ HTML time input (HH:mm) */
export function minutesToTimeInput(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function timeInputToMinutes(value: string): number {
  const [h, min] = value.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(min)) return 0;
  return Math.min(1439, Math.max(0, h * 60 + min));
}

export type PushUserSettings = {
  quiet_hours_enabled: boolean;
  quiet_start_minutes: number;
  quiet_end_minutes: number;
  timezone: string;
  sound_enabled: boolean;
  vibration_enabled: boolean;
};

export const DEFAULT_PUSH_SETTINGS: PushUserSettings = {
  quiet_hours_enabled: false,
  quiet_start_minutes: 22 * 60,
  quiet_end_minutes: 8 * 60,
  timezone: 'Europe/Istanbul',
  sound_enabled: true,
  vibration_enabled: true,
};
