import JSZip from 'jszip';
import { buildPardusTahtaDebBlob } from '@/lib/pardus-tahta-deb-pack';
import { sanitizeFileBase } from '@/lib/smart-board-usb-launcher';

const INSTALL_SH = `#!/bin/bash
set -euo pipefail
echo ""
echo "  Uzaedu Öğretmen — Akıllı tahta (Pardus)"
echo "  ====================================="
echo ""
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
mapfile -t DEBS < <(find "$SCRIPT_DIR" -maxdepth 1 -name 'ogretmenpro-tahta_*.deb' -type f 2>/dev/null)
if [[ \${#DEBS[@]} -eq 0 ]]; then
  echo "Hata: Bu klasörde ogretmenpro-tahta_*.deb bulunamadı." >&2
  echo "Önce ZIP içeriğini açın (unzip)." >&2
  exit 1
fi
if [[ "\${EUID:-0}" -ne 0 ]]; then
  echo "Yönetici izni isteniyor (sudo)…"
  exec sudo bash "$0" "$@"
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>/dev/null || true
apt-get install -y chromium x11-xserver-utils 2>/dev/null \\
  || apt-get install -y chromium-browser x11-xserver-utils 2>/dev/null \\
  || echo "! Chromium kurulamadı; kurum IT ile yükleyin."
dpkg -i "\${DEBS[0]}" 2>/dev/null || apt-get install -f -y
dpkg -i "\${DEBS[0]}"
echo ""
echo "  Kurulum tamamlandı."
echo "  Oturumu kapatıp açın veya: ogretmenpro-tahta-launch"
echo ""
RUN_USER="\${SUDO_USER:-}"
if [[ -n "$RUN_USER" ]] && id "$RUN_USER" &>/dev/null; then
  su - "$RUN_USER" -c "ogretmenpro-tahta-launch" 2>/dev/null || true
else
  ogretmenpro-tahta-launch 2>/dev/null || true
fi
`;

export async function downloadPardusKurulumZip(args: {
  panelOrigin: string;
  apiBaseUrl: string;
  schoolId: string;
  deviceId: string;
  deviceLabel: string;
  setupCode: string;
}): Promise<void> {
  const debBlob = await buildPardusTahtaDebBlob({
    panelOrigin: args.panelOrigin,
    apiBaseUrl: args.apiBaseUrl,
    schoolId: args.schoolId,
    deviceId: args.deviceId,
    deviceLabel: args.deviceLabel,
    kiosk: true,
    tahtaKilit: true,
  });
  const base = sanitizeFileBase(args.deviceLabel.trim() || 'tahta');
  const debName = `ogretmenpro-tahta_${base}.deb`;
  const zip = new JSZip();
  zip.file(debName, debBlob);
  zip.file('kur-pardus.sh', INSTALL_SH);
  zip.file(
    'OKU.txt',
    [
      'Uzaedu Öğretmen — Pardus tahta kurulumu',
      '',
      `Okul kurulum kodu: ${args.setupCode}`,
      `Tahta: ${args.deviceLabel}`,
      '',
      '1) Bu ZIP dosyasını tahtaya kopyalayın',
      '2) Sağ tık → Arşivden çıkar',
      '3) Terminalde klasöre gidin',
      '4) chmod +x kur-pardus.sh',
      '5) ./kur-pardus.sh  (sudo isteyecektir)',
      '',
      'Kurulum bitince duyuru ekranı otomatik açılır.',
      '',
      'Öğretmen kullanımı:',
      '- Tahtada Uzaedu şifresi yok; MEB ETAP masaüstü girişi zorunlu değil.',
      '- Öğretmen telefonda Uzaedu (panel/PWA) ile giriş yapar, tahtadaki QR okutur.',
      '- Tahta birkaç saniye içinde kullanım moduna geçer.',
    ].join('\n'),
  );
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ogretmenpro-pardus-kurulum_${base}.zip`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
