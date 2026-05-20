import { buildClassroomTvUrl } from '@/lib/smart-board-classroom-url';

/** Windows: çift tıklanınca Chromium/Edge kiosk açar. */
export function buildWindowsTahtaBat(args: {
  panelOrigin: string;
  schoolId: string;
  deviceId: string;
  deviceLabel: string;
}): string {
  const url = buildClassroomTvUrl({
    origin: args.panelOrigin,
    schoolId: args.schoolId,
    deviceId: args.deviceId,
  });
  const chrome =
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  return `@echo off\r\nREM ${args.deviceLabel}\r\nset URL=${url}\r\nif exist "${chrome}" (\r\n  start "" "${chrome}" --kiosk --app=%URL%\r\n) else if exist "${edge}" (\r\n  start "" "${edge}" --kiosk --app=%URL%\r\n) else (\r\n  start "" %URL%\r\n)\r\n`;
}

/** Linux masaüstü kısayolu (.desktop içeriği). */
export function buildLinuxDesktopEntry(args: {
  panelOrigin: string;
  schoolId: string;
  deviceId: string;
  deviceLabel: string;
}): string {
  const url = buildClassroomTvUrl({
    origin: args.panelOrigin,
    schoolId: args.schoolId,
    deviceId: args.deviceId,
  });
  const id = `ogretmenpro-tahta-${args.deviceId.slice(0, 8)}`;
  return `[Desktop Entry]
Type=Application
Name=${args.deviceLabel}
Comment=Uzaedu sınıf tahtası
Exec=chromium --kiosk --app="${url}" %U
Terminal=false
Categories=Education;
StartupNotify=false
X-GNOME-Autostart-enabled=true
`;
}

export function downloadTextFile(filename: string, content: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
