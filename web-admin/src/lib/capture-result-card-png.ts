import { toPng } from 'html-to-image';

function isDarkCaptureRoot(el: HTMLElement): boolean {
  return el.hasAttribute('data-capture-keep-dark');
}

/**
 * DOM → PNG (önce html2canvas — Recharts / gradient; sonra `html-to-image` toPng).
 * Ekran dışı snapshot (`left: -9999px`) SVG foreignObject ile beyaz görüntü verebilir;
 * yakalama anında geçici olarak viewport köşesine alınır (opacity 1 — 0.01 bazı tarayıcılarda boş raster).
 */
export async function captureResultCardAsPng(
  visibleCard: HTMLElement | null,
  shareSnapshot: HTMLElement | null,
): Promise<Blob | null> {
  if (typeof window === 'undefined') return null;

  const candidates: HTMLElement[] = [];
  if (shareSnapshot) candidates.push(shareSnapshot);
  if (visibleCard && visibleCard !== shareSnapshot) candidates.push(visibleCard);
  if (!candidates.length && visibleCard) candidates.push(visibleCard);
  if (!candidates.length) return null;

  const stripBackdropOnClone = (cloned: HTMLElement) => {
    cloned.querySelectorAll<HTMLElement>('*').forEach((node) => {
      const w = cloned.ownerDocument.defaultView;
      if (!w) return;
      try {
        const st = w.getComputedStyle(node);
        if (st.backdropFilter && st.backdropFilter !== 'none') {
          node.style.backdropFilter = 'none';
        }
        if (st.filter && st.filter !== 'none' && st.filter.includes('blur')) {
          node.style.filter = 'none';
        }
      } catch {
        /* ignore */
      }
    });
  };

  type StyleBackup = Record<string, string>;
  const KEYS = [
    'position',
    'left',
    'top',
    'right',
    'bottom',
    'zIndex',
    'opacity',
    'pointerEvents',
    'transform',
    'visibility',
  ] as const;

  function stashStyles(el: HTMLElement): StyleBackup {
    const s = el.style;
    const o: StyleBackup = {};
    for (const k of KEYS) {
      o[k] = (s as unknown as Record<string, string>)[k] ?? '';
    }
    return o;
  }

  function restoreStyles(el: HTMLElement, b: StyleBackup) {
    const s = el.style;
    for (const k of KEYS) {
      const v = b[k];
      if (v === '') s.removeProperty(k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()) as never);
      else (s as unknown as Record<string, string>)[k] = v;
    }
  }

  /** foreignObject / raster için düğümü gerçekten “çizilen” alana taşır (görünürlük ~0). */
  function placeOnscreenForCapture(el: HTMLElement) {
    const s = el.style;
    s.setProperty('position', 'fixed');
    s.setProperty('left', '0');
    s.setProperty('top', '0');
    s.setProperty('right', 'auto');
    s.setProperty('bottom', 'auto');
    s.setProperty('z-index', '2147483646');
    s.setProperty('opacity', '1');
    s.setProperty('pointer-events', 'none');
    s.setProperty('transform', 'none');
    s.setProperty('visibility', 'visible');
  }

  async function afterLayout() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimeout(resolve, 80));
      });
    });
  }

  /** html2canvas bazen (özellikle ekran dışı klon) tüm beyaz raster döndürür; boyut yine de “normal” olabilir. */
  async function blobLooksNearlyUniformWhite(blob: Blob): Promise<boolean> {
    try {
      const bmp = await createImageBitmap(blob);
      const w = Math.min(48, bmp.width);
      const h = Math.min(48, bmp.height);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        bmp.close();
        return false;
      }
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      const d = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      const n = (d.length / 4) | 0;
      for (let i = 0; i < d.length; i += 4) {
        sum += d[i]! + d[i + 1]! + d[i + 2]!;
      }
      const avg = n > 0 ? sum / (n * 3) : 0;
      return avg >= 248;
    } catch {
      return false;
    }
  }

  async function tryToPng(el: HTMLElement): Promise<Blob | null> {
    const back = stashStyles(el);
    placeOnscreenForCapture(el);
    await afterLayout();

    if (el.offsetWidth < 8 || el.offsetHeight < 8) {
      restoreStyles(el, back);
      return null;
    }

    try {
      const dark = isDarkCaptureRoot(el);
      const dataUrl = await toPng(el, {
        pixelRatio: Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 2)),
        cacheBust: true,
        backgroundColor: dark ? '#0b1220' : '#ffffff',
        style: { transform: 'none' },
        filter: (node) =>
          !(node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore')),
      });
      const raw = await (await fetch(dataUrl)).blob();
      const blob =
        raw.type === 'image/png' ? raw : new Blob([await raw.arrayBuffer()], { type: 'image/png' });
      return blob.size > 80 ? blob : null;
    } catch {
      return null;
    } finally {
      restoreStyles(el, back);
    }
  }

  async function tryHtml2Canvas(el: HTMLElement): Promise<Blob | null> {
    const back = stashStyles(el);
    placeOnscreenForCapture(el);
    await afterLayout();

    try {
      const html2canvas = (await import('html2canvas')).default;
      const attempts: Array<{ scale: number; foreignObjectRendering?: boolean }> = [
        { scale: Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 2)) },
        { scale: 2 },
        { scale: 1.5, foreignObjectRendering: true },
        { scale: 1 },
      ];
      const darkRoot = isDarkCaptureRoot(el);
      for (const a of attempts) {
        try {
          const canvas = await html2canvas(el, {
            backgroundColor: darkRoot ? '#0b1220' : '#ffffff',
            scale: a.scale,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            foreignObjectRendering: a.foreignObjectRendering,
            ignoreElements: (node) =>
              node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore'),
            onclone: (clonedDoc, refEl) => {
              const keepDark =
                refEl instanceof HTMLElement &&
                (refEl.hasAttribute('data-capture-keep-dark') ||
                  Boolean(refEl.closest('[data-capture-keep-dark]')));
              if (!keepDark) {
                clonedDoc.documentElement.classList.remove('dark');
                clonedDoc.documentElement.style.colorScheme = 'light';
              }
              if (clonedDoc.body) stripBackdropOnClone(clonedDoc.body);
            },
          });
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/png', 0.92),
          );
          if (blob && blob.size > 80) return blob;
        } catch {
          /* sonraki */
        }
      }
    } finally {
      restoreStyles(el, back);
    }
    return null;
  }

  /** Çok küçük dosya genelde boş/beyaz canvas. */
  const suspiciouslySmall = (b: Blob) => b.size < 1800;

  for (const el of candidates) {
    const png = await tryToPng(el);
    if (png && !suspiciouslySmall(png) && !(await blobLooksNearlyUniformWhite(png))) return png;
    const h2 = await tryHtml2Canvas(el);
    if (h2 && !suspiciouslySmall(h2) && !(await blobLooksNearlyUniformWhite(h2))) return h2;
    if (png && !(await blobLooksNearlyUniformWhite(png))) return png;
    if (h2 && !(await blobLooksNearlyUniformWhite(h2))) return h2;
    if (png) return png;
    if (h2) return h2;
  }

  return null;
}
