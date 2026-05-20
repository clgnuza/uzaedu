import JSZip from 'jszip';
import { buildPardusTahtaDebBlob } from '@/lib/pardus-tahta-deb-pack';
import { sanitizeFileBase } from '@/lib/smart-board-usb-launcher';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import type { Device } from '@/app/(admin)/akilli-tahta/types';

export async function downloadAllSmartBoardDebPackages(args: {
  panelOrigin: string;
  devices: Device[];
  schoolLabel: string;
}): Promise<void> {
  const apiBaseUrl = resolveDefaultApiBase();
  const zip = new JSZip();
  const folder = zip.folder(sanitizeFileBase(args.schoolLabel)) ?? zip;
  for (const d of args.devices) {
    const deb = await buildPardusTahtaDebBlob({
      panelOrigin: args.panelOrigin,
      apiBaseUrl,
      schoolId: d.school_id,
      deviceId: d.id,
      deviceLabel: d.name,
      kiosk: true,
      tahtaKilit: true,
    });
    const base = sanitizeFileBase(`${d.classSection ?? d.name}_${d.id.slice(0, 8)}`);
    folder.file(`ogretmenpro-tahta_2.1.0_${base}.deb`, deb);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileBase(args.schoolLabel)}_tahta_deb.zip`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
