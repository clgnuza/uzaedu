import JSZip from 'jszip';
import { buildPardusTahtaDebBlob } from '@/lib/pardus-tahta-deb-pack';
import { sanitizeFileBase, triggerBlobDownload } from '@/lib/smart-board-usb-launcher';

export type PardusKurulumPackArgs = {
  panelOrigin: string;
  apiBaseUrl: string;
  schoolId: string;
  deviceId: string;
  deviceLabel: string;
  setupCode: string;
};

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
  echo "Önce ZIP içeriğini açın veya .run dosyasını kullanın." >&2
  exit 1
fi
if [[ "\${EUID:-0}" -ne 0 ]]; then
  echo "Yönetici izni isteniyor (sudo)…"
  exec sudo bash "$0" "$@"
fi
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>/dev/null || true
apt-get install -y chromium x11-xserver-utils unzip 2>/dev/null \\
  || apt-get install -y chromium-browser x11-xserver-utils unzip 2>/dev/null \\
  || echo "! Chromium/unzip kurulamadı; kurum IT ile yükleyin."
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

const KURULUM_DESKTOP = `[Desktop Entry]
Version=1.0
Type=Application
Name=Uzaedu Tahta Kurulumunu Başlat
Comment=Akıllı tahta .deb paketini kurar (sudo isteyebilir)
Exec=bash -c 'cd "$(dirname "$(readlink -f "%k" 2>/dev/null || echo %k)")" && chmod +x kur-pardus.sh && ./kur-pardus.sh'
Terminal=true
Icon=system-software-install
Categories=Education;
StartupNotify=true
`;

/** ZIP arşivinden sonra eklenen ikili; self-extracting .run dosyası bunu ayırır. */
export const PARDUS_KURULUM_ZIP_MARKER = '__OGRETMENPRO_ZIP_ARCHIVE__';

const RUN_WRAPPER_SH = `#!/bin/bash
set -euo pipefail
echo ""
echo "  Uzaedu Öğretmen — otomatik tahta kurulumu"
echo "  ========================================="
echo ""
SELF="$(readlink -f "$0" 2>/dev/null || realpath "$0" 2>/dev/null || echo "$0")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
LINE="$(grep -an "^${PARDUS_KURULUM_ZIP_MARKER}$" "$SELF" | head -1 | cut -d: -f1)"
if [[ -z "$LINE" ]]; then
  echo "Hata: Kurulum paketi bozuk. Panelden yeniden indirin." >&2
  exit 1
fi
OFFSET=$((LINE + 1))
tail -n +"$OFFSET" "$SELF" > "$TMP/pkg.zip"
if ! command -v unzip >/dev/null 2>&1; then
  echo "unzip bulunamadı. Kuruluyor…"
  if [[ "\${EUID:-0}" -ne 0 ]]; then
    exec sudo bash -c 'apt-get update -qq; apt-get install -y unzip; bash "$1"' bash "$SELF"
  fi
  apt-get update -qq 2>/dev/null || true
  apt-get install -y unzip 2>/dev/null || { echo "unzip kurulamadı." >&2; exit 1; }
fi
unzip -qo "$TMP/pkg.zip" -d "$TMP/ext"
cd "$TMP/ext"
chmod +x kur-pardus.sh
exec ./kur-pardus.sh
`;

function buildOkuTxt(args: PardusKurulumPackArgs): string {
  return [
    'Uzaedu Öğretmen — Pardus tahta kurulumu',
    '',
    `Okul kurulum kodu: ${args.setupCode}`,
    `Tahta: ${args.deviceLabel}`,
    '',
    'Önerilen (tek adım):',
    '  Panelden indirdiğiniz .run dosyası:',
    '  bash ogretmenpro-pardus-kurulum_*.run',
    '  (sudo isteyebilir; ZIP açma gerekmez)',
    '',
    'ZIP kullandıysanız:',
    '  1) Arşivden çıkar',
    '  2) «Uzaedu Tahta Kurulumunu Başlat» simgesine çift tıklayın',
    '     veya: chmod +x kur-pardus.sh && ./kur-pardus.sh',
    '',
    'Kurulum bitince duyuru ekranı otomatik açılır.',
    'Öğretmen telefonda Uzaedu ile QR okutur; tahtada şifre gerekmez.',
  ].join('\n');
}

/** ZIP içeriği: .deb + kurulum betiği + masaüstü kısayolu */
export async function buildPardusKurulumZipBlob(args: PardusKurulumPackArgs): Promise<Blob> {
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
  zip.file('Kurulumu-Baslat.desktop', KURULUM_DESKTOP);
  zip.file('OKU.txt', buildOkuTxt(args));
  return zip.generateAsync({ type: 'blob' });
}

/** ZIP açmadan: tek .run dosyası arşivi çıkarır ve kur-pardus.sh çalıştırır */
export async function downloadPardusKurulumRun(args: PardusKurulumPackArgs): Promise<void> {
  const zipBlob = await buildPardusKurulumZipBlob(args);
  const zipBytes = new Uint8Array(await zipBlob.arrayBuffer());
  const base = sanitizeFileBase(args.deviceLabel.trim() || 'tahta');
  const enc = new TextEncoder();
  const header = enc.encode(RUN_WRAPPER_SH);
  const marker = enc.encode(`\n${PARDUS_KURULUM_ZIP_MARKER}\n`);
  const combined = new Uint8Array(header.length + marker.length + zipBytes.length);
  combined.set(header, 0);
  combined.set(marker, header.length);
  combined.set(zipBytes, header.length + marker.length);
  triggerBlobDownload(
    new Blob([combined], { type: 'application/x-sh' }),
    `ogretmenpro-pardus-kurulum_${base}.run`,
  );
}

export async function downloadPardusKurulumZip(args: PardusKurulumPackArgs): Promise<void> {
  const zipBlob = await buildPardusKurulumZipBlob(args);
  const base = sanitizeFileBase(args.deviceLabel.trim() || 'tahta');
  triggerBlobDownload(zipBlob, `ogretmenpro-pardus-kurulum_${base}.zip`);
}
