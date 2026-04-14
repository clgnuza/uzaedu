/**
 * USB üzerinde çift tıklanınca tarayıcıda sınıf tahtası (tv/classroom) açılır.
 * file:// ile açıldığında hedef HTTPS panel adresine yönlendirir.
 */
export function buildSmartBoardUsbLauncherHtml(args: {
  panelOrigin: string;
  schoolId: string;
  deviceId: string;
  deviceLabel: string;
  kiosk: boolean;
  /** false ise tam TV düzeni (yan panel, RSS…). Varsayılan: kilit açık (yalnız duyuru slayt alanı). */
  tahtaKilit?: boolean;
}): string {
  const origin = args.panelOrigin.replace(/\/$/, '');
  const q = new URLSearchParams({ school_id: args.schoolId, device_id: args.deviceId });
  q.set('usb', '1');
  if (args.kiosk) q.set('kiosk', '1');
  if (args.tahtaKilit !== false) q.set('kilit', '1');
  const target = `${origin}/tv/classroom?${q.toString()}`;
  const label = args.deviceLabel.trim() || 'Sınıf tahtası';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(label)}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: #0f172a; color: #e2e8f0; padding: 1rem; text-align: center; }
    a { color: #38bdf8; }
    .box { max-width: 28rem; line-height: 1.5; }
  </style>
  <script>
    var TARGET = ${JSON.stringify(target)};
    function go() {
      try { location.replace(TARGET); } catch (e) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', go);
    } else { go(); }
  </script>
</head>
<body>
  <div class="box">
    <p><strong>${escapeHtml(label)}</strong></p>
    <p>Sınıf tahtası açılıyor…</p>
    <p><a href="${escapeAttr(target)}">Otomatik açılmazsa tıklayın</a></p>
  </div>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}

export function downloadSmartBoardUsbLauncher(
  args: Parameters<typeof buildSmartBoardUsbLauncherHtml>[0],
  fileBaseName: string,
): void {
  const html = buildSmartBoardUsbLauncherHtml(args);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFileBase(fileBaseName)}.html`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function sanitizeFileBase(name: string): string {
  const s = name
    .replace(/[^a-zA-Z0-9\u00C0-\u024F\-_]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return s.slice(0, 72) || 'sinif_tahtasi';
}
