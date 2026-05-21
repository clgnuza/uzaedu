/** OCR yükleme: küçük görüntü = daha hızlı API */

const OCR_MAX_EDGE = 1600;
const OCR_JPEG_QUALITY = 0.82;

export function compressImageBase64ForOcr(b64: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      const maxE = Math.max(w, h);
      if (maxE > OCR_MAX_EDGE) {
        const s = OCR_MAX_EDGE / maxE;
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas yok'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', OCR_JPEG_QUALITY);
      resolve(dataUrl.split(',')[1] ?? dataUrl);
    };
    img.onerror = () => reject(new Error('Görüntü okunamadı'));
    img.src = b64.startsWith('data:') ? b64 : `data:image/jpeg;base64,${b64}`;
  });
}
