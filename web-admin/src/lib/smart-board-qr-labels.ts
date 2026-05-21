import { buildClassroomTvUrl } from '@/lib/smart-board-classroom-url';
import { buildClassroomQrImageSrc } from '@/lib/smart-board-classroom-api';
import type { Device } from '@/app/(admin)/akilli-tahta/types';

/** false = açılır pencere engellendi */
export function openSmartBoardLabelsPrint(args: {
  schoolName: string;
  setupCode: string;
  devices: Device[];
  origin?: string;
}): boolean {
  const origin = args.origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  const setupUrl = `${origin}/tv/classroom?setup=1&school_code=${encodeURIComponent(args.setupCode)}`;
  const cards = args.devices
    .map((d) => {
      const url = buildClassroomTvUrl({
        origin,
        schoolId: d.school_id,
        deviceId: d.id,
      });
      const cls = d.classSection ? ` · ${d.classSection}` : '';
      return `
      <section class="card">
        <h2>${escapeHtml(d.name)}${escapeHtml(cls)}</h2>
        <p class="code">Kurulum: <strong>${escapeHtml(args.setupCode)}</strong> · Eşleme: ${escapeHtml(d.pairing_code)}</p>
        <div class="qrs">
          <div><img src="${buildClassroomQrImageSrc(url)}" alt="" width="160" height="160"/><p class="cap">Bu sınıf</p></div>
        </div>
        <p class="url">${escapeHtml(url)}</p>
      </section>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"><title>Tahta etiketleri — ${escapeHtml(args.schoolName)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  body { font-family: system-ui, sans-serif; color: #111; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  .school-setup { display: flex; gap: 16px; align-items: center; margin-bottom: 20px; padding: 12px; border: 2px dashed #0d9488; border-radius: 12px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .card { break-inside: avoid; border: 1px solid #ccc; border-radius: 10px; padding: 10px; page-break-inside: avoid; }
  .card h2 { font-size: 14px; margin: 0 0 4px; }
  .code { font-size: 11px; color: #444; margin: 0 0 8px; }
  .url { font-size: 8px; word-break: break-all; color: #666; margin: 6px 0 0; }
  .cap { font-size: 10px; text-align: center; margin: 4px 0 0; }
  .qrs { display: flex; justify-content: center; }
  @media print { .no-print { display: none; } }
</style></head><body>
  <button class="no-print" onclick="window.print()" style="margin-bottom:12px;padding:8px 16px">Yazdır</button>
  <h1>${escapeHtml(args.schoolName)} — Akıllı tahta etiketleri</h1>
  <div class="school-setup">
    <img src="${buildClassroomQrImageSrc(setupUrl)}" width="140" height="140" alt=""/>
    <div>
      <p><strong>Okul kurulum kodu:</strong> <span style="font-size:22px;letter-spacing:0.2em">${escapeHtml(args.setupCode)}</span></p>
      <p style="font-size:12px">Yeni tahta: bu QR ile sınıf seçilir. Kayıtlı tahta: listeden seç + etiketteki eşleştirme kodu.</p>
      <p style="font-size:10px;word-break:break-all">${escapeHtml(setupUrl)}</p>
    </div>
  </div>
  <div class="grid">${cards || '<p>Henüz tahta yok.</p>'}</div>
</body></html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  return true;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
