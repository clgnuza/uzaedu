import JSZip from 'jszip';
import { buildSmartBoardUsbLauncherHtml, sanitizeFileBase } from '@/lib/smart-board-usb-launcher';
import type { Device } from '@/app/(admin)/akilli-tahta/types';

export async function downloadAllSmartBoardUsbLaunchers(args: {
  panelOrigin: string;
  devices: Device[];
  schoolLabel: string;
}): Promise<void> {
  const zip = new JSZip();
  const folder = zip.folder(sanitizeFileBase(args.schoolLabel)) ?? zip;
  for (const d of args.devices) {
    const html = buildSmartBoardUsbLauncherHtml({
      panelOrigin: args.panelOrigin,
      schoolId: d.school_id,
      deviceId: d.id,
      deviceLabel: d.name,
      kiosk: true,
      tahtaKilit: true,
    });
    const base = sanitizeFileBase(`${d.classSection ?? d.name}_${d.id.slice(0, 8)}`);
    folder.file(`${base}.html`, html);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileBase(args.schoolLabel)}_tahta_usb.zip`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
