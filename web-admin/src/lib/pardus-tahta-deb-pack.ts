/**
 * Tarayıcıda cihaza özel .deb (dpkg-deb / build-deb.sh gerekmez).
 */
import { buildChromiumManagedPolicyJson, buildConf } from '@/lib/pardus-tahta-kiosk-config';
import { pardusKioskDebScripts } from '@/lib/pardus-tahta-kiosk-scripts';
import { normalizeHttpBaseUrl, normalizePanelOrigin, withPackBuildTimeout } from '@/lib/smart-board-pack-url';
import { sanitizeFileBase, triggerBlobDownload } from '@/lib/smart-board-usb-launcher';

const VERSION = '2.1.0';

function padOctal(n: number, len: number): string {
  return n.toString(8).padStart(len, '0');
}

function ustarChecksum(h: Uint8Array): void {
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += h[i]!;
  const s = padOctal(sum, 6) + '\0 ';
  const enc = new TextEncoder();
  enc.encodeInto(s, h.subarray(148, 156));
}

function ustarEntry(path: string, data: Uint8Array, mode = 0o644): Uint8Array[] {
  const enc = new TextEncoder();
  const name = path.replace(/^\.\//, '');
  const h = new Uint8Array(512);
  const w = (off: number, s: string, len: number) => enc.encodeInto(s.slice(0, len), h.subarray(off, off + len));
  if (name.length <= 100) w(0, name, 100);
  else {
    w(0, name.slice(0, 155), 155);
    w(345, name.slice(155), 155);
  }
  w(100, padOctal(mode, 7), 8);
  w(108, padOctal(0, 7), 8);
  w(116, padOctal(0, 7), 8);
  w(124, padOctal(data.length, 11), 12);
  w(136, padOctal(Math.floor(Date.now() / 1000), 11), 12);
  w(148, '        ', 8);
  h[156] = '0'.charCodeAt(0)!;
  enc.encodeInto('ustar\x00', h.subarray(257, 265));
  h[265] = '0'.charCodeAt(0)!;
  h[266] = '0'.charCodeAt(0)!;
  ustarChecksum(h);
  const padLen = (512 - (data.length % 512)) % 512;
  const out: Uint8Array[] = [h, data];
  if (padLen) out.push(new Uint8Array(padLen));
  return out;
}

function buildTar(entries: Array<{ path: string; data: Uint8Array; mode?: number }>): Uint8Array {
  const chunks: Uint8Array[] = [];
  for (const e of entries) chunks.push(...ustarEntry(e.path, e.data, e.mode ?? 0o644));
  chunks.push(new Uint8Array(512));
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

async function gzipBytes(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('Tarayıcı gzip desteklemiyor; Chrome veya Edge kullanın.');
  }
  const ab = await new Response(
    new Blob([new Uint8Array(data)]).stream().pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  return new Uint8Array(ab);
}

function arEntry(name: string, data: Uint8Array): Uint8Array {
  const enc = new TextEncoder();
  const n = name.padEnd(16, ' ');
  const headerStr =
    n +
    padOctal(Math.floor(Date.now() / 1000), 12) +
    padOctal(0, 6) +
    padOctal(0, 6) +
    padOctal(644, 8) +
    padOctal(data.length, 10) +
    '`\n';
  const header = enc.encode(headerStr);
  const padByte = data.length % 2 === 1 ? 1 : 0;
  const out = new Uint8Array(header.length + data.length + padByte);
  out.set(header, 0);
  out.set(data, header.length);
  return new Uint8Array(out);
}

function buildAr(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [new Uint8Array(enc.encode('!<arch>\n'))];
  for (const f of files) parts.push(arEntry(f.name, new Uint8Array(f.data)));
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return new Uint8Array(out);
}

export async function buildPardusTahtaDebBlob(args: {
  panelOrigin: string;
  apiBaseUrl: string;
  schoolId: string;
  deviceId: string;
  deviceLabel: string;
  kiosk?: boolean;
  tahtaKilit?: boolean;
  allowYoutubeEmbeds?: boolean;
}): Promise<Blob> {
  const panelOrigin = normalizePanelOrigin(args.panelOrigin);
  const apiBaseUrl = normalizeHttpBaseUrl(args.apiBaseUrl, panelOrigin);
  const S = pardusKioskDebScripts;
  const enc = new TextEncoder();
  const policy = buildChromiumManagedPolicyJson({
    panelOrigin,
    apiBaseUrl,
    allowYoutubeEmbeds: args.allowYoutubeEmbeds !== false,
  });
  const conf = buildConf({
    panelOrigin,
    schoolId: args.schoolId,
    deviceId: args.deviceId,
    kiosk: args.kiosk !== false,
    apiBaseUrl,
    tahtaKilit: args.tahtaKilit !== false,
  });
  const controlTar = buildTar([
    {
      path: './DEBIAN/control',
      data: enc.encode(
        `Package: ogretmenpro-tahta\nVersion: ${VERSION}\nArchitecture: all\nMaintainer: Uzaedu <destek@uzaedu.com>\nDescription: Okul akilli tahta (${args.deviceLabel})\nDepends: bash\n`,
      ),
    },
    { path: './DEBIAN/postinst', data: enc.encode(S.DEB_POSTINST), mode: 0o755 },
    { path: './DEBIAN/prerm', data: enc.encode(S.DEB_PRERM), mode: 0o755 },
  ]);
  const dataTar = buildTar([
    { path: './usr/local/lib/ogretmenpro-tahta/ogretmenpro-tahta.conf', data: enc.encode(conf) },
    { path: './usr/local/lib/ogretmenpro-tahta/uninstall.sh', data: enc.encode(S.UNINSTALL_SH), mode: 0o755 },
    { path: './usr/local/bin/ogretmenpro-tahta-launch', data: enc.encode(S.LAUNCH_SH), mode: 0o755 },
    { path: './usr/local/bin/ogretmenpro-tahta-diagnostics', data: enc.encode(S.DIAGNOSTICS_SH), mode: 0o755 },
    { path: './usr/local/bin/ogretmenpro-tahta-setup-wizard', data: enc.encode(S.SETUP_WIZARD_SH), mode: 0o755 },
    { path: './usr/share/applications/ogretmenpro-tahta.desktop', data: enc.encode(S.DESKTOP) },
    { path: './etc/xdg/autostart/ogretmenpro-tahta.desktop', data: enc.encode(S.DESKTOP) },
    { path: './usr/local/share/pixmaps/ogretmenpro-tahta.svg', data: enc.encode(S.ICON_SVG) },
    { path: './etc/chromium/policies/managed/99-ogretmenpro-tahta.json', data: enc.encode(policy) },
    { path: './usr/local/lib/ogretmenpro-tahta/install.sh', data: enc.encode(S.INSTALL_SH), mode: 0o755 },
  ]);
  const controlGz = await gzipBytes(controlTar);
  const dataGz = await gzipBytes(dataTar);
  const deb = buildAr([
    { name: 'debian-binary', data: enc.encode('2.0\n') },
    { name: 'control.tar.gz', data: controlGz },
    { name: 'data.tar.gz', data: dataGz },
  ]);
  return new Blob([new Uint8Array(deb)], { type: 'application/octet-stream' });
}

export async function downloadPardusTahtaDeb(args: Parameters<typeof buildPardusTahtaDebBlob>[0]): Promise<void> {
  const blob = await withPackBuildTimeout(buildPardusTahtaDebBlob(args), '.deb');
  const base = sanitizeFileBase(args.deviceLabel.trim() || 'tahta');
  triggerBlobDownload(blob, `ogretmenpro-tahta_${VERSION}_${base}.deb`);
}
