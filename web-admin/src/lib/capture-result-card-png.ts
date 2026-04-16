import { toPng } from 'html-to-image';

/**
 * DOM → PNG (`html-to-image` → Blob; gerekirse html2canvas).
 * Ekran dışı snapshot (`left: -9999px`) SVG foreignObject ile beyaz görüntü verebilir;
 * yakalama anında geçici olarak viewport köşesine alınır.
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
    s.setProperty('opacity', '0.01');
    s.setProperty('pointer-events', 'none');
    s.setProperty('transform', 'none');
    s.setProperty('visibility', 'visible');
  }

  async function afterLayout() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimeout(resolve, 48));
      });
    });
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
      const dataUrl = await toPng(el, {
        pixelRatio: Math.min(2.5, Math.max(1.5, window.devicePixelRatio || 2)),
        cacheBust: true,
        backgroundColor: '#ffffff',
        style: { transform: 'none' },
        filter: (node) => node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore'),
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
      for (const a of attempts) {
        try {
          const canvas = await html2canvas(el, {
            backgroundColor: '#ffffff',
            scale: a.scale,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            foreignObjectRendering: a.foreignObjectRendering,
            ignoreElements: (node) =>
              node instanceof HTMLElement && node.hasAttribute('data-html2canvas-ignore'),
            onclone: (clonedDoc) => {
              clonedDoc.documentElement.classList.remove('dark');
              clonedDoc.documentElement.style.colorScheme = 'light';
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
    if (png && !suspiciouslySmall(png)) return png;
    if (png && suspiciouslySmall(png)) {
      const h2 = await tryHtml2Canvas(el);
      if (h2 && !suspiciouslySmall(h2)) return h2;
    }
    const h2 = await tryHtml2Canvas(el);
    if (h2 && !suspiciouslySmall(h2)) return h2;
    if (h2) return h2;
    if (png) return png;
  }

  return null;
}
