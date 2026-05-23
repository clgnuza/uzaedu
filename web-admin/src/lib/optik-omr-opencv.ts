/**
 * OpenCV.js — tarayıcıda CDN lazy load (bundle/Turbopack şişmesini önler).
 * Yüklenemezse decode yerel algoritmaya düşer.
 */

import type { OmrScanLayout } from '@/lib/optik-api';

export type OmrPoint = { x: number; y: number };

export type OmrQuad = { tl: OmrPoint; tr: OmrPoint; bl: OmrPoint; br: OmrPoint };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvModule = any;

/** CDN önce; /opencv.js yalnızca public/ altında dosya varsa (404 HTML onload tuzağı) */
const OPENCV_JS_URLS = [
  'https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.12.0-release.1/dist/opencv.js',
  '/opencv.js',
];

declare global {
  interface Window {
    cv?: CvModule;
  }
}

let cvReady: Promise<CvModule> | null = null;
let cvFailed = false;

function waitCvRuntime(cv: CvModule): Promise<CvModule> {
  if (cv.Mat) return Promise.resolve(cv);
  return new Promise((resolve) => {
    cv.onRuntimeInitialized = () => resolve(cv);
  });
}

let injectPromise: Promise<CvModule> | null = null;

function injectOpenCvScript(): Promise<CvModule> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('OpenCV yalnızca tarayıcıda çalışır'));
  }
  if (window.cv) return waitCvRuntime(window.cv);
  if (injectPromise) return injectPromise;

  injectPromise = new Promise((resolve, reject) => {
    const finish = () => {
      if (!window.cv) return false;
      waitCvRuntime(window.cv).then(resolve).catch(reject);
      return true;
    };

    let urlIdx = 0;
    const tryNext = () => {
      if (finish()) return;
      if (urlIdx >= OPENCV_JS_URLS.length) {
        injectPromise = null;
        reject(new Error('OpenCV script yüklenemedi'));
        return;
      }
      const url = OPENCV_JS_URLS[urlIdx]!;
      urlIdx += 1;
      const s = document.createElement('script');
      s.src = url;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.dataset.optikOpencv = '1';
      s.onload = () => {
        if (finish()) return;
        s.remove();
        tryNext();
      };
      s.onerror = () => {
        s.remove();
        tryNext();
      };
      document.head.appendChild(s);
    };
    tryNext();
  });

  injectPromise.catch(() => {
    injectPromise = null;
  });

  return injectPromise;
}

/** İlk MC taramadan önce çağırın */
export function preloadOptikOpenCv(): Promise<boolean> {
  return loadOptikOpenCv()
    .then(() => true)
    .catch(() => false);
}

export function isOptikOpenCvFailed(): boolean {
  return cvFailed;
}

export async function loadOptikOpenCv(): Promise<CvModule> {
  if (cvFailed) throw new Error('OpenCV yüklenemedi');
  if (!cvReady) {
    cvReady = injectOpenCvScript().catch((e) => {
      cvFailed = true;
      cvReady = null;
      throw e;
    });
  }
  return cvReady;
}

function grayToMat(cv: CvModule, gray: Uint8Array, w: number, h: number) {
  const mat = new cv.Mat(h, w, cv.CV_8UC1);
  mat.data.set(gray);
  return mat;
}

function matToGray(cv: CvModule, mat: CvModule): Uint8Array {
  const out = new Uint8Array(mat.cols * mat.rows);
  out.set(mat.data);
  cv.delete(mat);
  return out;
}

function quadFromAnchors(
  corners: Array<OmrPoint | null>,
): { quad: OmrQuad; score: number } | null {
  if (corners.length < 4) return null;
  const [tl, tr, bl, br] = corners;
  const n = corners.filter(Boolean).length;
  if (n < 4 || !tl || !tr || !bl || !br) return null;
  return { quad: { tl, tr, bl, br }, score: n / 4 };
}

function findMarkerInRoi(
  cv: CvModule,
  gray: CvModule,
  w: number,
  h: number,
  expX: number,
  expY: number,
): OmrPoint | null {
  const roiR = Math.round(Math.min(w, h) * 0.14);
  const cx = Math.round(expX * w);
  const cy = Math.round(expY * h);
  const x0 = Math.max(0, cx - roiR);
  const y0 = Math.max(0, cy - roiR);
  const rw = Math.min(roiR * 2, w - x0);
  const rh = Math.min(roiR * 2, h - y0);
  if (rw < 8 || rh < 8) return null;

  const rect = new cv.Rect(x0, y0, rw, rh);
  const roi = gray.roi(rect);
  const blurred = new cv.Mat();
  const thresh = new cv.Mat();
  const morphed = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.GaussianBlur(roi, blurred, new cv.Size(7, 7), 0);
    
    const otsuThresh = new cv.Mat();
    cv.threshold(blurred, otsuThresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    
    cv.adaptiveThreshold(
      blurred,
      thresh,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      17,
      8,
    );
    
    cv.bitwise_and(thresh, otsuThresh, morphed);
    otsuThresh.delete();
    
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
    const closed = new cv.Mat();
    cv.morphologyEx(morphed, closed, cv.MORPH_CLOSE, kernel);
    kernel.delete();
    
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    closed.delete();

    const minArea = rw * rh * 0.0015;
    const maxArea = rw * rh * 0.42;
    let best: OmrPoint | null = null;
    let bestScore = 0;

    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area < minArea || area > maxArea) continue;
      const box = cv.boundingRect(c);
      const ar = box.width / Math.max(1, box.height);
      if (ar < 0.35 || ar > 2.8) continue;
      
      const m = cv.moments(c);
      if (m.m00 < 1) continue;
      const px = x0 + m.m10 / m.m00;
      const py = y0 + m.m01 / m.m00;
      const dist = Math.hypot(px - cx, py - cy);
      
      const compactness = 4 * Math.PI * area / (cv.arcLength(c, true) ** 2);
      const shapeScore = Math.min(1, compactness * 1.2);
      const distScore = Math.exp(-dist / roiR);
      const score = area * shapeScore * distScore;
      
      if (score > bestScore) {
        bestScore = score;
        best = { x: px, y: py };
      }
    }
    return best;
  } finally {
    roi.delete();
    blurred.delete();
    thresh.delete();
    morphed.delete();
    contours.delete();
    hierarchy.delete();
  }
}

export async function detectOmrQuadOpenCv(
  gray: Uint8Array,
  w: number,
  h: number,
  layout: OmrScanLayout,
): Promise<{ quad: OmrQuad; score: number } | null> {
  const anchors = layout.anchors ?? [];
  if (anchors.length < 4) return null;

  let cv: CvModule;
  try {
    cv = await loadOptikOpenCv();
  } catch {
    return null;
  }

  const mat = grayToMat(cv, gray, w, h);
  try {
    const corners = anchors.slice(0, 4).map((a) => findMarkerInRoi(cv, mat, w, h, a.x, a.y));
    return quadFromAnchors(corners);
  } finally {
    cv.delete(mat);
  }
}

export async function warpOmrOpenCv(
  gray: Uint8Array,
  w: number,
  h: number,
  quad: OmrQuad,
  outW: number,
  outH: number,
): Promise<Uint8Array | null> {
  let cv: CvModule;
  try {
    cv = await loadOptikOpenCv();
  } catch {
    return null;
  }

  const src = cv.matFromArray(4, 1, cv.CV_32FC2, [
    quad.tl.x,
    quad.tl.y,
    quad.tr.x,
    quad.tr.y,
    quad.br.x,
    quad.br.y,
    quad.bl.x,
    quad.bl.y,
  ]);
  const dst = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
  const M = cv.getPerspectiveTransform(src, dst);
  const mat = grayToMat(cv, gray, w, h);
  const warped = new cv.Mat();
  const denoised = new cv.Mat();
  const clahe = cv.createCLAHE(2.8, new cv.Size(8, 8));
  const enhanced = new cv.Mat();
  const bilateral = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(2, 2));
  const opened = new cv.Mat();

  try {
    cv.warpPerspective(
      mat,
      warped,
      M,
      new cv.Size(outW, outH),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255),
    );
    
    cv.bilateralFilter(warped, bilateral, 5, 50, 50);
    clahe.apply(bilateral, enhanced);
    cv.morphologyEx(enhanced, opened, cv.MORPH_OPEN, kernel);
    
    const sharpKernel = cv.matFromArray(3, 3, cv.CV_32F, [
      0, -0.5, 0,
      -0.5, 3, -0.5,
      0, -0.5, 0,
    ]);
    const sharpened = new cv.Mat();
    cv.filter2D(opened, sharpened, cv.CV_8U, sharpKernel);
    sharpKernel.delete();
    
    return matToGray(cv, sharpened);
  } finally {
    src.delete();
    dst.delete();
    M.delete();
    mat.delete();
    warped.delete();
    denoised.delete();
    clahe.delete();
    enhanced.delete();
    bilateral.delete();
    kernel.delete();
    opened.delete();
  }
}
