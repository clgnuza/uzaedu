/** Kart dış çerçevesi — viewBox 0 0 100 100, preserveAspectRatio=none ile ölçeklenir */

export type LandingCardFrameRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
  ry: number;
};

/** İç halka kutusu piksel boyutuna göre köşe yarıçapı (CSS border-radius ile hizalı) */
export function landingCardFrameFromSize(
  w: number,
  h: number,
  radiusPx: number,
  strokeHalfPx = 1.25,
): LandingCardFrameRect {
  const x = (strokeHalfPx / w) * 100;
  const y = (strokeHalfPx / h) * 100;
  const width = 100 - 2 * x;
  const height = 100 - 2 * y;
  const rx = Math.min((radiusPx / w) * 100, width / 2);
  const ry = Math.min((radiusPx / h) * 100, height / 2);
  return { x, y, width, height, rx, ry };
}

/** İlk render / SSR tahmini */
export function landingCardFrame(): LandingCardFrameRect {
  return landingCardFrameFromSize(280, 260, 10, 1.25);
}
