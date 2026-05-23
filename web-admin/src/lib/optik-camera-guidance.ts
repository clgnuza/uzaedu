/** Kamera canlı rehberliği — mesafe, açı, ışık */

export type CameraGuidance = {
  ready: boolean;
  distance: 'too_close' | 'too_far' | 'ok';
  angle: 'tilted' | 'ok';
  lighting: 'dark' | 'bright' | 'ok';
  message: string;
  score: number;
};

export type DetectedQuad = {
  tl: { x: number; y: number };
  tr: { x: number; y: number };
  bl: { x: number; y: number };
  br: { x: number; y: number };
};

function analyzeQuadGeometry(quad: DetectedQuad, w: number, h: number) {
  const topW = Math.hypot(quad.tr.x - quad.tl.x, quad.tr.y - quad.tl.y);
  const bottomW = Math.hypot(quad.br.x - quad.bl.x, quad.br.y - quad.bl.y);
  const leftH = Math.hypot(quad.bl.x - quad.tl.x, quad.bl.y - quad.tl.y);
  const rightH = Math.hypot(quad.br.x - quad.tr.x, quad.br.y - quad.tr.y);

  const avgW = (topW + bottomW) / 2;
  const avgH = (leftH + rightH) / 2;
  const area = avgW * avgH;
  const frameArea = w * h;
  const coverage = area / frameArea;

  const widthSkew = Math.abs(topW - bottomW) / Math.max(topW, bottomW);
  const heightSkew = Math.abs(leftH - rightH) / Math.max(leftH, rightH);
  const skew = Math.max(widthSkew, heightSkew);

  return { coverage, skew, avgW, avgH };
}

function analyzeBrightness(
  videoEl: HTMLVideoElement,
  w: number,
  h: number,
): { brightness: number; variance: number } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(160, w);
  canvas.height = Math.min(120, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { brightness: 128, variance: 0 };

  ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = id.data;

  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    sum += gray;
  }
  const brightness = sum / (data.length / 4);

  let varianceSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    varianceSum += (gray - brightness) ** 2;
  }
  const variance = varianceSum / (data.length / 4);

  return { brightness, variance };
}

export function assessCameraGuidance(
  videoEl: HTMLVideoElement | null,
  detectedQuad: DetectedQuad | null,
): CameraGuidance {
  if (!videoEl || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
    return {
      ready: false,
      distance: 'too_far',
      angle: 'tilted',
      lighting: 'ok',
      message: 'Kamera yükleniyor...',
      score: 0,
    };
  }

  const w = videoEl.videoWidth;
  const h = videoEl.videoHeight;
  const { brightness, variance } = analyzeBrightness(videoEl, w, h);

  let lighting: CameraGuidance['lighting'] = 'ok';
  let lightMsg = '';
  if (brightness < 75) {
    lighting = 'dark';
    lightMsg = 'Çok karanlık — daha fazla ışık gerekli';
  } else if (brightness > 235) {
    lighting = 'bright';
    lightMsg = 'Çok parlak — refleksiyonu azaltın';
  }

  if (!detectedQuad) {
    return {
      ready: false,
      distance: 'too_far',
      angle: 'tilted',
      lighting,
      message: lightMsg || 'Formu kare içine alın',
      score: 0,
    };
  }

  const { coverage, skew } = analyzeQuadGeometry(detectedQuad, w, h);

  let distance: CameraGuidance['distance'] = 'ok';
  let distMsg = '';
  if (coverage < 0.25) {
    distance = 'too_far';
    distMsg = 'Daha yakın tutun';
  } else if (coverage > 0.85) {
    distance = 'too_close';
    distMsg = 'Daha uzak tutun';
  }

  let angle: CameraGuidance['angle'] = 'ok';
  let angleMsg = '';
  if (skew > 0.18) {
    angle = 'tilted';
    angleMsg = 'Telefonu düzleştirin';
  }

  const distScore = coverage >= 0.35 && coverage <= 0.75 ? 1 : 0.5;
  const angleScore = skew < 0.15 ? 1 : 0.5;
  const lightScore = brightness >= 85 && brightness <= 225 ? 1 : 0.7;
  const score = (distScore + angleScore + lightScore) / 3;

  const ready = distance === 'ok' && angle === 'ok' && lighting === 'ok';
  const message = distMsg || angleMsg || lightMsg || (ready ? 'Hazır — fotoğraf çekin' : 'Ayarlayın');

  return { ready, distance, angle, lighting, message, score };
}
