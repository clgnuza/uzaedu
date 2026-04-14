/**
 * Pardus 23 (Etap) tahta: Chromium kiosk + yönetilen politika (yalnızca panel, API ve TV slaytlarında YouTube).
 * Okul / cihaz kimliği conf ile sabitlenir; sunucu tarafında cihaz + TV IP listesi doğrulaması gerekir.
 */
import JSZip from 'jszip';
import { sanitizeFileBase } from '@/lib/smart-board-usb-launcher';

function originPattern(base: string): string {
  const u = new URL(base.endsWith('/') ? base : `${base}/`);
  return `${u.protocol}//${u.host}/*`;
}

/** Chromium managed policy (Linux: /etc/chromium/policies/managed/) */
export function buildChromiumManagedPolicyJson(args: {
  panelOrigin: string;
  apiBaseUrl: string;
  /** TV slaytlarında YouTube gömüleri */
  allowYoutubeEmbeds: boolean;
}): string {
  const allow: string[] = [originPattern(args.panelOrigin), originPattern(args.apiBaseUrl)];
  if (args.allowYoutubeEmbeds) {
    allow.push(
      'https://www.youtube.com/*',
      'https://www.youtube-nocookie.com/*',
      'https://i.ytimg.com/*',
      'https://www.google.com/*',
    );
  }
  const unique = [...new Set(allow)];
  return `${JSON.stringify(
    {
      URLBlocklist: ['*'],
      URLAllowlist: unique,
      IncognitoModeAvailability: 1,
      DeveloperToolsAvailability: 2,
      DefaultPopupsSetting: 2,
      DownloadRestrictions: 3,
      PrintingEnabled: false,
      EditBookmarksEnabled: false,
      BookmarkBarEnabled: false,
      SavingBrowserHistoryDisabled: true,
      DefaultSearchProviderEnabled: false,
      PasswordManagerEnabled: false,
      AutofillAddressEnabled: false,
      AutofillCreditCardEnabled: false,
      ExtensionInstallBlocklist: ['*'],
      BrowserAddPersonEnabled: false,
      BrowserGuestModeEnabled: false,
      TaskManagerEndProcessEnabled: false,
      MetricsReportingEnabled: false,
    },
    null,
    2,
  )}\n`;
}

function buildConf(args: {
  panelOrigin: string;
  schoolId: string;
  deviceId: string;
  kiosk: boolean;
  apiBaseUrl: string;
  tahtaKilit: boolean;
}): string {
  const o = args.panelOrigin.replace(/\/$/, '');
  return `# ÖğretmenPRO akıllı tahta — okul/cihaz bağlamı (yeniden indirip kurun)
PANEL_ORIGIN=${o}
SCHOOL_ID=${args.schoolId}
DEVICE_ID=${args.deviceId}
KIOSK_MODE=${args.kiosk ? '1' : '0'}
KILIT_MODE=${args.tahtaKilit ? '1' : '0'}
USB_PIN_FLOW=1
API_BASE_URL=${args.apiBaseUrl.replace(/\/$/, '')}
# İsteğe bağlı: ek Chromium bayrakları (boşlukla ayrılmış, tırnak kullanmayın)
CHROME_EXTRA_FLAGS=
`;
}

const LAUNCH_SH = `#!/bin/bash
set -euo pipefail
CONF_DIR="/usr/local/lib/ogretmenpro-tahta"
CONF="\${CONF_DIR}/ogretmenpro-tahta.conf"
if [[ ! -f "\$CONF" ]]; then
  echo "ogretmenpro-tahta: yapılandırma yok: \$CONF" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1090
source "\$CONF"
set +a
if [[ -z "\${PANEL_ORIGIN:-}" || -z "\${SCHOOL_ID:-}" || -z "\${DEVICE_ID:-}" ]]; then
  echo "ogretmenpro-tahta: PANEL_ORIGIN, SCHOOL_ID, DEVICE_ID gerekli." >&2
  exit 1
fi
PO="\${PANEL_ORIGIN%/}"
QS="school_id=\${SCHOOL_ID}&device_id=\${DEVICE_ID}&usb=1"
[[ "\${USB_PIN_FLOW:-1}" == "1" ]] || QS="school_id=\${SCHOOL_ID}&device_id=\${DEVICE_ID}"
[[ "\${KIOSK_MODE:-1}" == "1" ]] && QS="\${QS}&kiosk=1"
[[ "\${KILIT_MODE:-1}" == "1" ]] && QS="\${QS}&kilit=1"
TARGET="\${PO}/tv/classroom?\${QS}"
CHROME=""
for c in chromium chromium-browser google-chrome google-chrome-stable; do
  if command -v "\$c" >/dev/null 2>&1; then CHROME="\$c"; break; fi
done
if [[ -z "\$CHROME" ]]; then
  echo "ogretmenpro-tahta: Chromium veya Google Chrome bulunamadı (apt ile chromium kurun)." >&2
  exit 1
fi
USER_DATA="\${HOME}/.config/ogretmenpro-tahta-chromium"
mkdir -p "\$USER_DATA"
if [[ -n "\${DISPLAY:-}" ]] && command -v xset >/dev/null 2>&1; then
  xset s off 2>/dev/null || true
  xset s noblank 2>/dev/null || true
  xset -dpms 2>/dev/null || true
fi
read -r -a EXTRA_FLAGS <<< "\${CHROME_EXTRA_FLAGS:-}"
exec "\$CHROME" \\
  --kiosk \\
  --no-first-run \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --disable-features=TranslateUI \\
  --disable-print-preview \\
  --disable-pinch \\
  --disable-dev-shm-usage \\
  --password-store=basic \\
  --disable-background-networking \\
  --user-data-dir="\$USER_DATA" \\
  "\${EXTRA_FLAGS[@]}" \\
  --app="\$TARGET"
`;

const INSTALL_SH = `#!/bin/bash
set -euo pipefail
if [[ "\${EUID:-0}" -ne 0 ]]; then
  echo "Kurulum için: sudo ./install.sh"
  exit 1
fi
ROOT="$(cd "$(dirname "$0")" && pwd)"
install -d /usr/local/lib/ogretmenpro-tahta
install -m 644 "\$ROOT/ogretmenpro-tahta.conf" /usr/local/lib/ogretmenpro-tahta/
install -m 755 "\$ROOT/bin/ogretmenpro-tahta-launch.sh" /usr/local/bin/ogretmenpro-tahta-launch
install -d /etc/chromium/policies/managed
install -m 644 "\$ROOT/chromium-policy-managed.json" /etc/chromium/policies/managed/99-ogretmenpro-tahta.json
if [[ -d /etc/opt/chrome/policies/managed ]]; then
  install -m 644 "\$ROOT/chromium-policy-managed.json" /etc/opt/chrome/policies/managed/99-ogretmenpro-tahta.json
fi
install -d /usr/local/share/pixmaps
install -m 644 "\$ROOT/assets/ogretmenpro-tahta.svg" /usr/local/share/pixmaps/ogretmenpro-tahta.svg
install -d /usr/share/applications
install -m 644 "\$ROOT/bin/desktop/ogretmenpro-tahta.desktop" /usr/share/applications/ogretmenpro-tahta.desktop
if [[ -f "\$ROOT/uninstall.sh" ]]; then
  install -m 755 "\$ROOT/uninstall.sh" /usr/local/lib/ogretmenpro-tahta/uninstall.sh
fi
install -d /etc/xdg/autostart
ln -sf /usr/share/applications/ogretmenpro-tahta.desktop /etc/xdg/autostart/ogretmenpro-tahta.desktop
echo "ÖğretmenPRO tahta kuruldu. Oturumu kapatıp açın veya: ogretmenpro-tahta-launch"
echo "Kaldırma: sudo /usr/local/lib/ogretmenpro-tahta/uninstall.sh"
`;

const UNINSTALL_SH = `#!/bin/bash
set -euo pipefail
if [[ "\${EUID:-0}" -ne 0 ]]; then
  echo "Kaldırma için: sudo \$0" >&2
  exit 1
fi
rm -f /usr/local/bin/ogretmenpro-tahta-launch
rm -rf /usr/local/lib/ogretmenpro-tahta
rm -f /etc/chromium/policies/managed/99-ogretmenpro-tahta.json
rm -f /etc/opt/chrome/policies/managed/99-ogretmenpro-tahta.json
rm -f /usr/share/applications/ogretmenpro-tahta.desktop
rm -f /etc/xdg/autostart/ogretmenpro-tahta.desktop
rm -f /usr/local/share/pixmaps/ogretmenpro-tahta.svg
echo "ÖğretmenPRO tahta kaldırıldı."
`;

const DESKTOP = `[Desktop Entry]
Type=Application
Name=ÖğretmenPRO Sınıf Tahtası
Comment=Okula özel kiosk — yalnızca panel ve API
Exec=/usr/local/bin/ogretmenpro-tahta-launch
Icon=/usr/local/share/pixmaps/ogretmenpro-tahta.svg
Terminal=false
Categories=Education;
`;

const ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
  <rect width="48" height="48" rx="10" fill="#1e3a8a"/>
  <text x="24" y="31" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="11" font-weight="700">OP</text>
</svg>
`;

const PACKAGES_README = `Bu paket harici .deb içermez (ör. i-kilit gibi wmctrl/xinput burada yok).
Tahtada: sudo apt install -y chromium x11-xserver-utils
`;

const MAKEFILE = `# ÖğretmenPRO tahta — Pardus (Chromium kiosk). Giriş noktası: i-kilit-pardus-etap tarzı make.
.PHONY: install uninstall
DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))

install:
	@test "$$(id -u)" = "0" || { echo "Kurulum: sudo make install"; exit 1; }
	@cd "$$(DIR)" && bash ./install.sh

uninstall:
	@test "$$(id -u)" = "0" || { echo "Kaldırma: sudo make uninstall"; exit 1; }
	@if [ -x /usr/local/lib/ogretmenpro-tahta/uninstall.sh ]; then bash /usr/local/lib/ogretmenpro-tahta/uninstall.sh; \\
	else cd "$$(DIR)" && bash ./uninstall.sh; fi
`;

function buildReadme(deviceLabel: string): string {
  return `# ÖğretmenPRO — Pardus tahta kiosk paketi (${deviceLabel})

## Ne işe yarar?
- Chromium yalnızca **okul paneli**, **API** ve (duyuru slaytları için) **YouTube** adreslerine izin verir; diğer siteler politika ile engellenir (tabela / KioWare sınıfı kısıtlama).
- \`KILIT_MODE=1\` iken adresde \`kilit=1\`: ekranda **yalnızca okul duyuru slaytları**; yan panel, RSS, hava, alt şeritler ve slayt tıklaması kapalı. PIN ile açılış öğretmen/idare onayıdır.
- Başlangıç adresi bu tahtaya özel \`/tv/classroom\` + \`school_id\` + \`device_id\` + USB PIN akışıdır.
- **Tam güvenlik** için ayrıca: TV sayfasında **izinli IP listesi**, ağ VLAN’ı, BIOS/UEFI parolası ve tahta için **ayrı kullanıcı** kullanın.

## Kurulum (Pardus 23 Etap)
1. \`sudo apt update && sudo apt install -y chromium\` (veya kurumda onaylı tarayıcı paketi). Ekranın uyku/DPMS ile kararmaması için: \`sudo apt install -y x11-xserver-utils\` (\`xset\` — başlatıcı açılışta dener).
2. Bu klasörde: \`chmod +x Makefile install.sh uninstall.sh bin/ogretmenpro-tahta-launch.sh\`
3. \`sudo make install\` veya \`sudo ./install.sh\`
4. Oturumu yenileyin veya komut: \`ogretmenpro-tahta-launch\`

## Kaldırma
\`sudo make uninstall\`, \`sudo /usr/local/lib/ogretmenpro-tahta/uninstall.sh\` veya çıkarılan klasörde \`sudo ./uninstall.sh\`.

## Notlar
- Panel veya API adresi değişirse paketi panelden **yeniden indirin**.
- RSS görselleri harici alan adlarından geliyorsa politika kısıtına takılabilir; gerekirse okul IT ek alan adı ekler (şablon: chromium-policy-managed.json).
- Öğretmenin tahtayı **telefondan kontrolü** ayrıdır (JWT); bu paket yalnızca tahta tarayıcısını kilitler.
- \`ogretmenpro-tahta.conf\` içinde \`CHROME_EXTRA_FLAGS=\` ile ek bayrak (ör. \`--disable-gpu\`) verilebilir; boşlukla ayrılmış kelimeler, tırnak yok.
- Politika: uzantılar kapalı, misafir/çoklu profil ve görev yöneticisinden süreç sonlandırma kapatıldı.
- Klasör yapısı (örnek \`i-kilit-pardus-etap.zip\` ile uyum): \`Makefile\`, \`bin/\`, \`assets/\`, \`packages/\` — native kilit ikiliği / sudoers / .deb paketleri **yok** (yalnızca Chromium + politika).
`;
}

export async function buildPardusTahtaKioskZip(args: {
  panelOrigin: string;
  apiBaseUrl: string;
  schoolId: string;
  deviceId: string;
  deviceLabel: string;
  kiosk: boolean;
  tahtaKilit?: boolean;
  allowYoutubeEmbeds?: boolean;
}): Promise<Blob> {
  const label = args.deviceLabel.trim() || 'sinif_tahtasi';
  const policy = buildChromiumManagedPolicyJson({
    panelOrigin: args.panelOrigin,
    apiBaseUrl: args.apiBaseUrl,
    allowYoutubeEmbeds: args.allowYoutubeEmbeds !== false,
  });
  const conf = buildConf({
    panelOrigin: args.panelOrigin,
    schoolId: args.schoolId,
    deviceId: args.deviceId,
    kiosk: args.kiosk,
    apiBaseUrl: args.apiBaseUrl,
    tahtaKilit: args.tahtaKilit !== false,
  });
  const zip = new JSZip();
  const root = zip.folder('ogretmenpro-tahta-pardus');
  if (!root) throw new Error('zip');
  root.file('README.md', buildReadme(label));
  root.file('Makefile', MAKEFILE);
  root.file('ogretmenpro-tahta.conf', conf);
  root.file('bin/ogretmenpro-tahta-launch.sh', LAUNCH_SH);
  root.file('bin/desktop/ogretmenpro-tahta.desktop', DESKTOP);
  root.file('assets/ogretmenpro-tahta.svg', ICON_SVG);
  root.file('packages/README.txt', PACKAGES_README);
  root.file('install.sh', INSTALL_SH);
  root.file('uninstall.sh', UNINSTALL_SH);
  root.file('chromium-policy-managed.json', policy);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function downloadPardusTahtaKioskZip(blob: Blob, deviceLabel: string): void {
  const base = sanitizeFileBase(deviceLabel.trim() || 'tahta');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ogretmenpro_pardus_${base}.zip`;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
