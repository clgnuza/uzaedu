/** Sınıf tahtası TV URL — varsayılan Duyuru TV (kilit=1). Öğretmen QR ile kullanım modu açılır (usb=1 gerekmez). */
export function buildClassroomTvUrl(args: {
  origin?: string;
  schoolId: string;
  deviceId: string;
  /** Yalnızca eski yer imleri; yeni kurulumda kullanmayın */
  usb?: boolean;
  kiosk?: boolean;
  kilit?: boolean;
  setup?: boolean;
  schoolSetupCode?: string;
}): string {
  const origin =
    args.origin?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://panel.example.com');
  const q = new URLSearchParams();
  if (args.setup && args.schoolSetupCode) {
    q.set('setup', '1');
    q.set('school_code', args.schoolSetupCode);
    return `${origin}/tv/classroom?${q.toString()}`;
  }
  q.set('school_id', args.schoolId);
  q.set('device_id', args.deviceId);
  if (args.usb === true) q.set('usb', '1');
  if (args.kiosk !== false) q.set('kiosk', '1');
  if (args.kilit !== false) q.set('kilit', '1');
  return `${origin}/tv/classroom?${q.toString()}`;
}

export function buildClassroomSetupUrl(args: { origin?: string; setupCode: string }): string {
  const origin =
    args.origin?.replace(/\/$/, '') ??
    (typeof window !== 'undefined' ? window.location.origin : 'https://panel.example.com');
  const q = new URLSearchParams({ setup: '1', school_code: args.setupCode.trim().toUpperCase() });
  return `${origin}/tv/classroom?${q.toString()}`;
}
