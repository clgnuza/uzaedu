/** Pardus kiosk shell scripts — deb-pack icin (kiosk-pack dongusu yok). */

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
if [[ ! -f "\${HOME}/.config/ogretmenpro-tahta/setup.done" ]] && [[ -x /usr/local/bin/ogretmenpro-tahta-setup-wizard ]]; then
  /usr/local/bin/ogretmenpro-tahta-setup-wizard --from-launcher || exit 0
fi
USER_OVERRIDE="\${HOME}/.config/ogretmenpro-tahta/wizard.env"
if [[ -f "\$USER_OVERRIDE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "\$USER_OVERRIDE"
  set +a
fi
if [[ -z "\${PANEL_ORIGIN:-}" || -z "\${SCHOOL_ID:-}" || -z "\${DEVICE_ID:-}" ]]; then
  echo "ogretmenpro-tahta: PANEL_ORIGIN, SCHOOL_ID, DEVICE_ID gerekli." >&2
  exit 1
fi
PO="\${PANEL_ORIGIN%/}"
if [[ "\$PO" != http://* && "\$PO" != https://* ]]; then
  echo "ogretmenpro-tahta: PANEL_ORIGIN http/https olmalı." >&2
  exit 1
fi
if [[ "\${API_BASE_URL:-}" != "" && "\${API_BASE_URL}" != http://* && "\${API_BASE_URL}" != https://* ]]; then
  echo "ogretmenpro-tahta: API_BASE_URL http/https olmalı." >&2
  exit 1
fi
QS="school_id=\${SCHOOL_ID}&device_id=\${DEVICE_ID}"
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
chmod 700 "\$USER_DATA" 2>/dev/null || true
if [[ -n "\${DISPLAY:-}" ]] && command -v xset >/dev/null 2>&1; then
  xset s off 2>/dev/null || true
  xset s noblank 2>/dev/null || true
  xset -dpms 2>/dev/null || true
fi
read -r -a EXTRA_FLAGS <<< "\${CHROME_EXTRA_FLAGS:-}"
exec "\$CHROME" \\
  --kiosk \\
  --start-maximized \\
  --no-first-run \\
  --noerrdialogs \\
  --disable-infobars \\
  --disable-session-crashed-bubble \\
  --disable-features=TranslateUI \\
  --disable-sync \\
  --disable-component-update \\
  --disable-default-apps \\
  --disable-extensions \\
  --disable-translate \\
  --overscroll-history-navigation=0 \\
  --disable-print-preview \\
  --disable-pinch \\
  --disable-dev-shm-usage \\
  --password-store=basic \\
  --disable-background-networking \\
  --user-data-dir="\$USER_DATA" \\
  "\${EXTRA_FLAGS[@]}" \\
  --app="\$TARGET"
`;

const SETUP_WIZARD_SH = `#!/bin/bash
set -euo pipefail
APP_DIR="\${HOME}/.config/ogretmenpro-tahta"
DONE_FILE="\${APP_DIR}/setup.done"
ENV_FILE="\${APP_DIR}/wizard.env"

if [[ -f "\$DONE_FILE" ]]; then
  exit 0
fi

mkdir -p "\$APP_DIR"

TITLE="Uzaedu Ogretmen Tahta Kurulum"
LICENSE_TEXT="Bu kurulum okulun akilli tahta kiosk ayarlarini baslatir.\\n\\nKullanici sorumluluklari:\\n- Cihazi okul aginda kullanin\\n- Yetkisiz erisimi engelleyin\\n- Kurum guvenlik politikasina uyun"

has_zenity=0
if command -v zenity >/dev/null 2>&1; then
  has_zenity=1
fi

class_name=""
extra_flags=""

if [[ "\$has_zenity" = "1" ]]; then
  zenity --info --title="\$TITLE" --width=520 --height=260 --text="Hos geldiniz.\\n\\nBu sihirbaz 3 adimda kurulum tamamlar:\\n1) Lisans onayi\\n2) Sinif bilgisi\\n3) Ozet ve baslatma" || exit 1
  zenity --text-info --title="\$TITLE - Lisans" --width=620 --height=360 --checkbox="Lisans kosullarini kabul ediyorum" --filename=/dev/stdin <<< "\$LICENSE_TEXT" >/dev/null || exit 1
  form_out="$(zenity --forms --title="\$TITLE - Sinif Bilgisi" --width=560 --height=300 --add-entry="Sinif Adi (yerel not)" --add-entry="Ek Chromium Bayraklari (ops.)" --text="Sinif panelde zaten tanimli; burasi yalnizca yerel not.\\nCihaz eslesmesi panelden indirilen .deb/conf ile gelir.")" || exit 1
  class_name="\${form_out%%|*}"
  extra_flags="\${form_out#*|}"
else
  echo "== \$TITLE =="
  echo
  echo "\$LICENSE_TEXT"
  echo
  read -r -p "Kabul ediyor musunuz? (yes/no): " yn
  [[ "\${yn}" == "yes" ]] || exit 1
  read -r -p "Sinif Adi [ETAP 23]: " class_name
  read -r -p "Ek Chromium Bayraklari (ops): " extra_flags
fi

class_name="\${class_name:-ETAP 23}"
class_name="\${class_name//\\\"/}"
extra_flags="\${extra_flags//\\\"/}"

cat > "\$ENV_FILE" <<EOF
CLASSROOM_NAME="\$class_name"
CHROME_EXTRA_FLAGS="\$extra_flags"
EOF
chmod 600 "\$ENV_FILE" || true
touch "\$DONE_FILE"

if [[ "\${1:-}" == "--from-launcher" ]]; then
  exec /usr/local/bin/ogretmenpro-tahta-launch
fi
if [[ "\$has_zenity" = "1" ]]; then
  zenity --info --title="\$TITLE - Tamamlandi" --width=520 --text="Kurulum tamamlandi.\\n\\nSinif (yerel not): \$class_name\\n\\nTahtayi menuden veya oturum acilisinda baslatin." || true
else
  echo "Kurulum tamamlandi. Sinif (yerel not): \$class_name"
fi
`;

const INSTALL_SH = `#!/bin/bash
set -euo pipefail
GREEN="\\033[0;32m"
CYAN="\\033[0;36m"
YELLOW="\\033[1;33m"
RED="\\033[0;31m"
NC="\\033[0m"
step() { echo -e "\\n\${CYAN}==>\${NC} $1"; }
ok() { echo -e "\${GREEN}✓\${NC} $1"; }
warn() { echo -e "\${YELLOW}! $1\${NC}"; }
die() { echo -e "\${RED}✗ $1\${NC}" >&2; exit 1; }
REPORT_DIR="/var/log/ogretmenpro-tahta"
REPORT_FILE="\${REPORT_DIR}/install-report.json"
if [[ "\${EUID:-0}" -ne 0 ]]; then
  die "Kurulum için: sudo ./install.sh"
fi
ROOT="$(cd "$(dirname "$0")" && pwd)"
umask 027
step "Uzaedu Ogretmen Tahta kurulumu baslatiliyor"
if [[ ! -f "\$ROOT/ogretmenpro-tahta.conf" || ! -f "\$ROOT/chromium-policy-managed.json" ]]; then
  die "Paket eksik veya bozuk. ZIP'i panelden yeniden indiriniz."
fi
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1 && ! command -v google-chrome >/dev/null 2>&1 && ! command -v google-chrome-stable >/dev/null 2>&1; then
  warn "Chromium/Chrome bulunamadi. Kurulum sonrasi: sudo apt install -y chromium x11-xserver-utils"
fi
step "Uygulama dosyalari kuruluyor"
install -d /usr/local/lib/ogretmenpro-tahta
install -m 644 "\$ROOT/ogretmenpro-tahta.conf" /usr/local/lib/ogretmenpro-tahta/
install -m 755 "\$ROOT/bin/ogretmenpro-tahta-launch.sh" /usr/local/bin/ogretmenpro-tahta-launch
install -m 755 "\$ROOT/bin/ogretmenpro-tahta-diagnostics.sh" /usr/local/bin/ogretmenpro-tahta-diagnostics
install -m 755 "\$ROOT/bin/ogretmenpro-tahta-setup-wizard.sh" /usr/local/bin/ogretmenpro-tahta-setup-wizard
ok "Calistirici ve teshis araclari yerlestirildi"
step "Kurumsal tarayici politikasi uygulanıyor"
install -d /etc/chromium/policies/managed
install -m 644 "\$ROOT/chromium-policy-managed.json" /etc/chromium/policies/managed/99-ogretmenpro-tahta.json
if [[ -d /etc/opt/chrome/policies/managed ]]; then
  install -m 644 "\$ROOT/chromium-policy-managed.json" /etc/opt/chrome/policies/managed/99-ogretmenpro-tahta.json
fi
ok "Policy dosyalari guncellendi"
step "Masaustu ve otomatik baslatma ayarlari"
install -d /usr/local/share/pixmaps
install -m 644 "\$ROOT/assets/ogretmenpro-tahta.svg" /usr/local/share/pixmaps/ogretmenpro-tahta.svg
install -d /usr/share/applications
install -m 644 "\$ROOT/bin/desktop/ogretmenpro-tahta.desktop" /usr/share/applications/ogretmenpro-tahta.desktop
if [[ -f "\$ROOT/uninstall.sh" ]]; then
  install -m 755 "\$ROOT/uninstall.sh" /usr/local/lib/ogretmenpro-tahta/uninstall.sh
fi
install -d /etc/xdg/autostart
ln -sf /usr/share/applications/ogretmenpro-tahta.desktop /etc/xdg/autostart/ogretmenpro-tahta.desktop
install -d -m 750 "\$REPORT_DIR"
cat > "\$REPORT_FILE" <<EOF
{
  "product": "Uzaedu Ogretmen Tahta",
  "status": "installed",
  "installed_at": "$(date -Iseconds)",
  "host": "$(hostname)",
  "policy_file": "$( [[ -f /etc/chromium/policies/managed/99-ogretmenpro-tahta.json || -f /etc/opt/chrome/policies/managed/99-ogretmenpro-tahta.json ]] && echo present || echo missing )",
  "launcher_file": "$( [[ -x /usr/local/bin/ogretmenpro-tahta-launch ]] && echo present || echo missing )",
  "setup_wizard_file": "$( [[ -x /usr/local/bin/ogretmenpro-tahta-setup-wizard ]] && echo present || echo missing )",
  "diagnostics_file": "$( [[ -x /usr/local/bin/ogretmenpro-tahta-diagnostics ]] && echo present || echo missing )"
}
EOF
chmod 640 "\$REPORT_FILE" || true
ok "Kurulum tamamlandi"
echo -e "\\n\${GREEN}Uzaedu Ogretmen Tahta basariyla kuruldu.\${NC}"
echo "Sonraki adimlar:"
echo "  1) Oturumu kapatip acin veya: ogretmenpro-tahta-launch"
echo "  2) Saglik kontrolu icin: ogretmenpro-tahta-diagnostics"
echo "  3) Kaldirma icin: sudo /usr/local/lib/ogretmenpro-tahta/uninstall.sh"
echo "  4) Kurulum raporu: \$REPORT_FILE"
`;

const UNINSTALL_SH = `#!/bin/bash
set -euo pipefail
RED="\\033[0;31m"
GREEN="\\033[0;32m"
NC="\\033[0m"
REPORT_DIR="/var/log/ogretmenpro-tahta"
REPORT_FILE="\${REPORT_DIR}/install-report.json"
if [[ "\${EUID:-0}" -ne 0 ]]; then
  echo "Kaldırma için: sudo \$0" >&2
  exit 1
fi
if [[ "\${1:-}" != "--yes" ]]; then
  echo -e "\${RED}Dikkat:\${NC} Uzaedu Ogretmen Tahta kaldirilacak."
  read -r -p "Devam etmek icin 'yes' yazin: " ans
  [[ "\$ans" == "yes" ]] || { echo "İptal edildi."; exit 1; }
fi
rm -f /usr/local/bin/ogretmenpro-tahta-launch
rm -f /usr/local/bin/ogretmenpro-tahta-diagnostics
rm -f /usr/local/bin/ogretmenpro-tahta-setup-wizard
rm -rf /usr/local/lib/ogretmenpro-tahta
rm -f /etc/chromium/policies/managed/99-ogretmenpro-tahta.json
rm -f /etc/opt/chrome/policies/managed/99-ogretmenpro-tahta.json
rm -f /usr/share/applications/ogretmenpro-tahta.desktop
rm -f /etc/xdg/autostart/ogretmenpro-tahta.desktop
rm -f /usr/local/share/pixmaps/ogretmenpro-tahta.svg
install -d -m 750 "\$REPORT_DIR"
cat > "\$REPORT_FILE" <<EOF
{
  "product": "Uzaedu Ogretmen Tahta",
  "status": "removed",
  "removed_at": "$(date -Iseconds)",
  "host": "$(hostname)"
}
EOF
chmod 640 "\$REPORT_FILE" || true
echo -e "\${GREEN}Uzaedu Ogretmen Tahta kaldirildi.\${NC}"
`;

const DESKTOP = `[Desktop Entry]
Type=Application
Name=Uzaedu Öğretmen Sınıf Tahtası
Comment=Kurumsal akıllı tahta kiosk deneyimi
Exec=/usr/local/bin/ogretmenpro-tahta-launch
Icon=/usr/local/share/pixmaps/ogretmenpro-tahta.svg
Terminal=false
Categories=Education;
StartupNotify=true
X-GNOME-FullName=Uzaedu Öğretmen Sınıf Tahtası
`;

const ICON_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
  <rect width="48" height="48" rx="10" fill="#1e3a8a"/>
  <text x="24" y="31" text-anchor="middle" fill="#fff" font-family="system-ui,sans-serif" font-size="11" font-weight="700">OP</text>
</svg>
`;

const PACKAGES_README = `Bu klasörde .deb üretimi için hazır dosyalar bulunur.
Hızlı akış (önerilen):
1) packages/deb/dist/*.deb dosyasını çift tıklayıp "Pardus Paket Kurucu" ile kurun.

Alternatif (terminal):
1) cd packages/deb
2) bash ./build-deb.sh 2.1.0
3) dist/ogretmenpro-tahta_2.1.0_all.deb dosyasını kurun.

Notlar:
- Tahtada yine Chromium gereklidir: sudo apt install -y chromium x11-xserver-utils
- GUI kurulum sonrası otomatik başlatma/politika/launcher bu paketle kurulur.
`;

const DEB_CONTROL = `Package: ogretmenpro-tahta
Version: __VERSION__
Section: education
Priority: optional
Architecture: all
Maintainer: Uzaedu <destek@uzaedu.com>
Depends: bash
Description: Uzaedu Ogretmen Akilli Tahta Kiosk (Pardus ETAP)
 Chromium kiosk, managed policy, autostart and smart board launcher.
`;

const DEB_POSTINST = `#!/bin/bash
set -e
chmod 755 /usr/local/bin/ogretmenpro-tahta-launch || true
chmod 755 /usr/local/bin/ogretmenpro-tahta-diagnostics || true
chmod 755 /usr/local/bin/ogretmenpro-tahta-setup-wizard || true
chmod 755 /usr/local/lib/ogretmenpro-tahta/uninstall.sh || true
chmod 644 /etc/chromium/policies/managed/99-ogretmenpro-tahta.json || true
chmod 644 /usr/share/applications/ogretmenpro-tahta.desktop || true
chmod 644 /etc/xdg/autostart/ogretmenpro-tahta.desktop || true
chmod 644 /usr/local/share/pixmaps/ogretmenpro-tahta.svg || true
exit 0
`;

const DEB_PRERM = `#!/bin/bash
set -e
if [ "$1" = "remove" ] || [ "$1" = "purge" ]; then
  rm -f /etc/chromium/policies/managed/99-ogretmenpro-tahta.json || true
  rm -f /etc/opt/chrome/policies/managed/99-ogretmenpro-tahta.json || true
  rm -f /etc/xdg/autostart/ogretmenpro-tahta.desktop || true
fi
exit 0
`;

const BUILD_DEB_SH = `#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKG_NAME="ogretmenpro-tahta"
VERSION="\${1:-2.1.0}"
DIST_DIR="$ROOT/packages/deb/dist"
BUILD_DIR="$ROOT/packages/deb/build/\${PKG_NAME}_\${VERSION}_all"
DEBIAN_DIR="$BUILD_DIR/DEBIAN"

command -v dpkg-deb >/dev/null 2>&1 || {
  echo "dpkg-deb bulunamadı. Kurun: sudo apt install -y dpkg-dev"
  exit 1
}

rm -rf "$BUILD_DIR"
mkdir -p "$DEBIAN_DIR"
mkdir -p "$BUILD_DIR/usr/local/lib/ogretmenpro-tahta"
mkdir -p "$BUILD_DIR/usr/local/bin"
mkdir -p "$BUILD_DIR/usr/share/applications"
mkdir -p "$BUILD_DIR/usr/local/share/pixmaps"
mkdir -p "$BUILD_DIR/etc/chromium/policies/managed"
mkdir -p "$BUILD_DIR/etc/xdg/autostart"

cp "$ROOT/ogretmenpro-tahta.conf" "$BUILD_DIR/usr/local/lib/ogretmenpro-tahta/ogretmenpro-tahta.conf"
cp "$ROOT/uninstall.sh" "$BUILD_DIR/usr/local/lib/ogretmenpro-tahta/uninstall.sh"
cp "$ROOT/bin/ogretmenpro-tahta-launch.sh" "$BUILD_DIR/usr/local/bin/ogretmenpro-tahta-launch"
cp "$ROOT/bin/ogretmenpro-tahta-diagnostics.sh" "$BUILD_DIR/usr/local/bin/ogretmenpro-tahta-diagnostics"
cp "$ROOT/bin/ogretmenpro-tahta-setup-wizard.sh" "$BUILD_DIR/usr/local/bin/ogretmenpro-tahta-setup-wizard"
cp "$ROOT/bin/desktop/ogretmenpro-tahta.desktop" "$BUILD_DIR/usr/share/applications/ogretmenpro-tahta.desktop"
cp "$ROOT/bin/desktop/ogretmenpro-tahta.desktop" "$BUILD_DIR/etc/xdg/autostart/ogretmenpro-tahta.desktop"
cp "$ROOT/assets/ogretmenpro-tahta.svg" "$BUILD_DIR/usr/local/share/pixmaps/ogretmenpro-tahta.svg"
cp "$ROOT/chromium-policy-managed.json" "$BUILD_DIR/etc/chromium/policies/managed/99-ogretmenpro-tahta.json"

chmod 755 "$BUILD_DIR/usr/local/bin/ogretmenpro-tahta-launch"
chmod 755 "$BUILD_DIR/usr/local/bin/ogretmenpro-tahta-diagnostics"
chmod 755 "$BUILD_DIR/usr/local/bin/ogretmenpro-tahta-setup-wizard"
chmod 755 "$BUILD_DIR/usr/local/lib/ogretmenpro-tahta/uninstall.sh"

sed "s/__VERSION__/\${VERSION}/g" "$ROOT/packages/deb/DEBIAN/control.template" > "$DEBIAN_DIR/control"
cp "$ROOT/packages/deb/DEBIAN/postinst" "$DEBIAN_DIR/postinst"
cp "$ROOT/packages/deb/DEBIAN/prerm" "$DEBIAN_DIR/prerm"
chmod 755 "$DEBIAN_DIR/postinst" "$DEBIAN_DIR/prerm"

mkdir -p "$DIST_DIR"
OUT="$DIST_DIR/\${PKG_NAME}_\${VERSION}_all.deb"
dpkg-deb --build "$BUILD_DIR" "$OUT"
echo "Hazır: $OUT"
`;

const DIAGNOSTICS_SH = `#!/bin/bash
set -euo pipefail
CONF="/usr/local/lib/ogretmenpro-tahta/ogretmenpro-tahta.conf"
REPORT_DIR="/var/log/ogretmenpro-tahta"
REPORT_FILE="\${REPORT_DIR}/install-report.json"
echo "== Uzaedu Ogretmen Tahta Diagnostics =="
[[ -f "$CONF" ]] && echo "CONF: OK ($CONF)" || { echo "CONF: MISSING"; exit 1; }
if command -v chromium >/dev/null 2>&1 || command -v chromium-browser >/dev/null 2>&1 || command -v google-chrome >/dev/null 2>&1 || command -v google-chrome-stable >/dev/null 2>&1; then
  echo "BROWSER: OK"
else
  echo "BROWSER: MISSING (sudo apt install -y chromium x11-xserver-utils)"
fi
if [[ -f /etc/chromium/policies/managed/99-ogretmenpro-tahta.json || -f /etc/opt/chrome/policies/managed/99-ogretmenpro-tahta.json ]]; then
  echo "POLICY: OK"
else
  echo "POLICY: MISSING"
fi
echo "AUTOSTART: $( [[ -L /etc/xdg/autostart/ogretmenpro-tahta.desktop ]] && echo OK || echo CHECK )"
install -d -m 750 "\$REPORT_DIR"
cat > "\$REPORT_FILE" <<EOF
{
  "product": "Uzaedu Ogretmen Tahta",
  "status": "diagnostics",
  "checked_at": "$(date -Iseconds)",
  "host": "$(hostname)",
  "conf": "$( [[ -f "$CONF" ]] && echo ok || echo missing )",
  "policy": "$( [[ -f /etc/chromium/policies/managed/99-ogretmenpro-tahta.json || -f /etc/opt/chrome/policies/managed/99-ogretmenpro-tahta.json ]] && echo ok || echo missing )",
  "autostart": "$( [[ -L /etc/xdg/autostart/ogretmenpro-tahta.desktop ]] && echo ok || echo check )"
}
EOF
chmod 640 "\$REPORT_FILE" || true
echo "REPORT: \$REPORT_FILE"
echo "Diagnostics tamamlandi."
`;

export const pardusKioskDebScripts = {
  LAUNCH_SH,
  INSTALL_SH,
  UNINSTALL_SH,
  DESKTOP,
  ICON_SVG,
  SETUP_WIZARD_SH,
  DIAGNOSTICS_SH,
  DEB_POSTINST,
  DEB_PRERM,
} as const;

