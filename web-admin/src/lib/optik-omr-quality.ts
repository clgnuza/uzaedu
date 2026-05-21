/** JPEG/base64 görüntü kalitesi — bulanık/karanlık taramayı erken reddet */

export type OmrImageQuality = {
  ok: boolean;
  blurScore: number;
  brightness: number;
  message?: string;
};

function loadGrayThumb(b64: string, maxW = 320): Promise<{ gray: Uint8Array; w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        reject(new Error('Canvas yok'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const id = ctx.getImageData(0, 0, w, h);
      const gray = new Uint8Array(w * h);
      for (let i = 0, p = 0; i < id.data.length; i += 4, p++) {
        gray[p] = Math.round(0.299 * id.data[i]! + 0.587 * id.data[i + 1]! + 0.114 * id.data[i + 2]!);
      }
      resolve({ gray, w, h });
    };
    img.onerror = () => reject(new Error('Görüntü yüklenemedi'));
    img.src = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  });
}

/** Laplacian varyans — düşük = bulanık */
function laplacianVariance(gray: Uint8Array, w: number, h: number): number {
  let sum = 0;
  let sum2 = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = gray[y * w + x]!;
      const lap = Math.abs(
        4 * c -
          gray[y * w + (x - 1)]! -
          gray[y * w + (x + 1)]! -
          gray[(y - 1) * w + x]! -
          gray[(y + 1) * w + x]!,
      );
      sum += lap;
      sum2 += lap * lap;
      n++;
    }
  }
  if (n < 1) return 0;
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

export async function assessOmrImageQuality(b64: string): Promise<OmrImageQuality> {
  const { gray, w, h } = await loadGrayThumb(b64);
  let bright = 0;
  for (let i = 0; i < gray.length; i++) bright += gray[i]!;
  const brightness = bright / gray.length;
  const blurScore = laplacianVariance(gray, w, h);

  if (brightness < 72) {
    return { ok: false, blurScore, brightness, message: 'Görüntü çok karanlık — flaş veya ışık artırın' };
  }
  if (brightness > 238) {
    return { ok: false, blurScore, brightness, message: 'Görüntü aşırı parlak — gölge/refleksiyon azaltın' };
  }
  if (blurScore < 28) {
    return { ok: false, blurScore, brightness, message: 'Görüntü bulanık — telefonu sabit tutup yeniden çekin' };
  }
  return { ok: true, blurScore, brightness };
}
