/**
 * Pardus 23 (Etap) tahta: Chromium kiosk + yönetilen politika (yalnızca panel, API ve TV slaytlarında YouTube).
 * Okul / cihaz kimliği conf ile sabitlenir; sunucu tarafında cihaz + TV IP listesi doğrulaması gerekir.
 */
import JSZip from 'jszip';
import { buildPardusTahtaDebBlob } from '@/lib/pardus-tahta-deb-pack';
import { buildChromiumManagedPolicyJson, buildConf } from '@/lib/pardus-tahta-kiosk-config';
import { pardusKioskDebScripts } from '@/lib/pardus-tahta-kiosk-scripts';

const S = pardusKioskDebScripts;
import { normalizeHttpBaseUrl, normalizePanelOrigin, withPackBuildTimeout } from '@/lib/smart-board-pack-url';
import { sanitizeFileBase, triggerBlobDownload } from '@/lib/smart-board-usb-launcher';

export { buildChromiumManagedPolicyJson, buildConf } from '@/lib/pardus-tahta-kiosk-config';
export { pardusKioskDebScripts } from '@/lib/pardus-tahta-kiosk-scripts';

function resolvePackUrls(panelOrigin: string, apiBaseUrl: string): { panelOrigin: string; apiBaseUrl: string } {
  const panel = normalizePanelOrigin(panelOrigin);
  const api = normalizeHttpBaseUrl(apiBaseUrl, panel);
  return { panelOrigin: panel, apiBaseUrl: api };
}

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

const MAKEFILE = `# Uzaedu Öğretmen tahta — Pardus (Chromium kiosk). Giriş noktası: i-kilit-pardus-etap tarzı make.
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
  return `# Uzaedu Öğretmen — Pardus tahta kiosk paketi (${deviceLabel})

## Ne işe yarar?
- Chromium yalnızca **okul paneli**, **API** ve (duyuru slaytları için) **YouTube** adreslerine izin verir; diğer siteler politika ile engellenir (tabela / KioWare sınıfı kısıtlama).
- İlk açılışta kurulum sihirbazı (lisans + yerel not); ardından doğrudan Duyuru TV açılır. Yeni cihaz için panelde **Kurulum** sekmesi + \`setup=1&school_code=\` veya panelden cihaza özel .deb kullanın.
- \`KILIT_MODE=1\` iken adresde \`kilit=1\`: varsayılan **Duyuru TV** (yalnız slayt). Öğretmen panelden QR onayı ile tam TV düzeni açılır; oturum bitince duyuruya döner.
- Başlangıç: \`/tv/classroom?school_id=…&device_id=…&kiosk=1&kilit=1\` (usb=1 gerekmez).
- **Tam güvenlik** için ayrıca: TV sayfasında **izinli IP listesi**, ağ VLAN’ı, BIOS/UEFI parolası ve tahta için **ayrı kullanıcı** kullanın.

## Kurulum (Pardus 23 Etap)
1. \`sudo apt update && sudo apt install -y chromium\` (veya kurumda onaylı tarayıcı paketi). Ekranın uyku/DPMS ile kararmaması için: \`sudo apt install -y x11-xserver-utils\` (\`xset\` — başlatıcı açılışta dener).
2. Bu klasörde: \`chmod +x Makefile install.sh uninstall.sh bin/ogretmenpro-tahta-launch.sh packages/deb/build-deb.sh\`
3. Kurulum seçenekleri:
   - Terminal: \`sudo make install\` veya \`sudo ./install.sh\`
   - GUI (.deb): \`bash packages/deb/build-deb.sh 2.1.0\` ardından \`packages/deb/dist/*.deb\` dosyasını çift tıklayıp Pardus Paket Kurucu ile yükleyin.
4. İlk uygulama açılışında kurulum sihirbazını tamamlayın (lisans + sınıf adı).
5. Oturumu yenileyin veya komut: \`ogretmenpro-tahta-launch\`
6. Doğrulama: \`ogretmenpro-tahta-diagnostics\`
7. Kurulum raporu (JSON): \`/var/log/ogretmenpro-tahta/install-report.json\`

## Kaldırma
\`sudo make uninstall\`, \`sudo /usr/local/lib/ogretmenpro-tahta/uninstall.sh\` veya çıkarılan klasörde \`sudo ./uninstall.sh\`.

## Notlar
- Panel veya API adresi değişirse paketi panelden **yeniden indirin**.
- RSS görselleri harici alan adlarından geliyorsa politika kısıtına takılabilir; gerekirse okul IT ek alan adı ekler (şablon: chromium-policy-managed.json).
- Öğretmenin tahtayı **telefondan kontrolü** ayrıdır (JWT); bu paket yalnızca tahta tarayıcısını kilitler.
- \`ogretmenpro-tahta.conf\` içinde \`CHROME_EXTRA_FLAGS=\` ile ek bayrak (ör. \`--disable-gpu\`) verilebilir; boşlukla ayrılmış kelimeler, tırnak yok.
- Politika: uzantılar kapalı, misafir/çoklu profil ve görev yöneticisinden süreç sonlandırma kapatıldı.
- Klasör yapısı (örnek \`i-kilit-pardus-etap.zip\` ile uyum): \`Makefile\`, \`bin/\`, \`assets/\`, \`packages/\` — \`.deb\` üretimi için \`packages/deb\` içinde script+metadata bulunur.

## Güvenlik kontrol listesi (önerilen)
- Tahta için ayrı kullanıcı hesabı açın; yönetici şifresini öğretmenlerle paylaşmayın.
- BIOS/UEFI parolası, harici boot kilidi ve USB boot kapalı olmalı.
- Ağda yalnız okul VLAN + güvenli DNS; egress kuralında panel/API dışını kısıtlayın.
- \`tv_allowed_ips\` okul subnet’i ile uyumlu olmalı (sunucu tarafı erişim kuralı).
- Oturum açılış yöntemi olarak QR/OTP kullanıyorsanız kodları tek kullanımlık paylaşın, periyodik yenileyin.
- Paket güncellemesi sonrası \`sudo make install\` yeniden çalıştırın ve policy dosyasını doğrulayın.
`;
}

export async function buildPardusTahtaKioskZip(
  args: {
    panelOrigin: string;
    apiBaseUrl: string;
    schoolId: string;
    deviceId: string;
    deviceLabel: string;
    kiosk: boolean;
    tahtaKilit?: boolean;
    allowYoutubeEmbeds?: boolean;
  },
): Promise<Blob> {
  return withPackBuildTimeout(buildPardusTahtaKioskZipInner(args), 'Pardus ZIP');
}

async function buildPardusTahtaKioskZipInner(args: {
  panelOrigin: string;
  apiBaseUrl: string;
  schoolId: string;
  deviceId: string;
  deviceLabel: string;
  kiosk: boolean;
  tahtaKilit?: boolean;
  allowYoutubeEmbeds?: boolean;
}): Promise<Blob> {
  const urls = resolvePackUrls(args.panelOrigin, args.apiBaseUrl);
  const label = args.deviceLabel.trim() || 'sinif_tahtasi';
  const policy = buildChromiumManagedPolicyJson({
    panelOrigin: urls.panelOrigin,
    apiBaseUrl: urls.apiBaseUrl,
    allowYoutubeEmbeds: args.allowYoutubeEmbeds !== false,
  });
  const conf = buildConf({
    panelOrigin: urls.panelOrigin,
    schoolId: args.schoolId,
    deviceId: args.deviceId,
    kiosk: args.kiosk,
    apiBaseUrl: urls.apiBaseUrl,
    tahtaKilit: args.tahtaKilit !== false,
  });
  const zip = new JSZip();
  const root = zip.folder('ogretmenpro-tahta-pardus');
  if (!root) throw new Error('zip');
  root.file('README.md', buildReadme(label));
  root.file('Makefile', MAKEFILE);
  root.file('ogretmenpro-tahta.conf', conf);
  root.file('bin/ogretmenpro-tahta-launch.sh', S.LAUNCH_SH);
  root.file('bin/ogretmenpro-tahta-diagnostics.sh', S.DIAGNOSTICS_SH);
  root.file('bin/ogretmenpro-tahta-setup-wizard.sh', S.SETUP_WIZARD_SH);
  root.file('bin/desktop/ogretmenpro-tahta.desktop', S.DESKTOP);
  root.file('assets/ogretmenpro-tahta.svg', S.ICON_SVG);
  root.file('packages/README.txt', PACKAGES_README);
  root.file('packages/deb/build-deb.sh', BUILD_DEB_SH);
  root.file('packages/deb/DEBIAN/control.template', DEB_CONTROL);
  root.file('packages/deb/DEBIAN/postinst', S.DEB_POSTINST);
  root.file('packages/deb/DEBIAN/prerm', S.DEB_PRERM);
  root.file('install.sh', S.INSTALL_SH);
  root.file('uninstall.sh', S.UNINSTALL_SH);
  root.file('chromium-policy-managed.json', policy);
  try {
    const deb = await buildPardusTahtaDebBlob({ ...args, ...urls });
    const debBase = sanitizeFileBase(label);
    root.file(
      `packages/deb/dist/ogretmenpro-tahta_2.1.0_${debBase}.deb`,
      new Uint8Array(await deb.arrayBuffer()),
    );
  } catch {
    /* gzip yoksa ZIP scriptlerle kullanılabilir */
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

export function downloadPardusTahtaKioskZip(blob: Blob, deviceLabel: string): void {
  const base = sanitizeFileBase(deviceLabel.trim() || 'tahta');
  const zipBlob = blob.type ? blob : new Blob([blob], { type: 'application/zip' });
  triggerBlobDownload(zipBlob, `ogretmenpro_pardus_${base}.zip`);
}
