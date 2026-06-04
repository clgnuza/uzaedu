export type PwaInstallPlatformId =
  | 'ios-safari'
  | 'ios-other'
  | 'android-chrome'
  | 'android-samsung'
  | 'android-other'
  | 'desktop-chrome'
  | 'desktop-edge'
  | 'desktop-safari'
  | 'desktop-firefox'
  | 'unknown';

export type PwaInstallStep = {
  title: string;
  detail?: string;
};

export type PwaInstallGuide = {
  id: PwaInstallPlatformId;
  label: string;
  browserLabel: string;
  steps: PwaInstallStep[];
};

export function detectPwaInstallPlatform(): PwaInstallPlatformId {
  if (typeof navigator === 'undefined') return 'unknown';
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isEdge = /Edg\//i.test(ua);
  const isFirefox = /Firefox/i.test(ua);
  const isChrome = /Chrome/i.test(ua) && !isEdge && !/OPR\//i.test(ua);
  const isSafari = /Safari/i.test(ua) && !isChrome && !isEdge;

  if (isIOS) return isSafari ? 'ios-safari' : 'ios-other';
  if (isAndroid) {
    if (isSamsung) return 'android-samsung';
    if (isChrome) return 'android-chrome';
    return 'android-other';
  }
  if (isEdge) return 'desktop-edge';
  if (isChrome) return 'desktop-chrome';
  if (isSafari) return 'desktop-safari';
  if (isFirefox) return 'desktop-firefox';
  return 'unknown';
}

const GUIDES: Record<PwaInstallPlatformId, PwaInstallGuide> = {
  'ios-safari': {
    id: 'ios-safari',
    label: 'iPhone / iPad',
    browserLabel: 'Safari',
    steps: [
      { title: 'Paylaş düğmesine dokunun', detail: 'Alt çubuktaki kare ve ok simgesi' },
      { title: 'Ana Ekrana Ekle', detail: 'Listede aşağı kaydırın' },
      { title: 'Ekle ile onaylayın', detail: 'Simge ana ekranda görünür' },
    ],
  },
  'ios-other': {
    id: 'ios-other',
    label: 'iPhone / iPad',
    browserLabel: 'Safari gerekli',
    steps: [
      { title: 'Sayfayı Safari ile açın', detail: 'Chrome/Firefox iOS’ta tam PWA desteklemez' },
      { title: 'Paylaş → Ana Ekrana Ekle', detail: 'Safari menüsünden' },
    ],
  },
  'android-chrome': {
    id: 'android-chrome',
    label: 'Android',
    browserLabel: 'Chrome',
    steps: [
      { title: 'Sağ üst menü (⋮)', detail: 'veya adres çubuğundaki yükle simgesi' },
      { title: 'Ana ekrana ekle / Uygulamayı yükle', detail: 'Sürümüne göre metin değişir' },
      { title: 'Kurulumu onaylayın', detail: 'Bildirim izni sonradan sorulabilir' },
    ],
  },
  'android-samsung': {
    id: 'android-samsung',
    label: 'Android',
    browserLabel: 'Samsung Internet',
    steps: [
      { title: 'Alt menü veya ⋮', detail: 'Sayfa menüsünü açın' },
      { title: 'Sayfayı ekle → Ana ekran', detail: 'Kısayol oluşturur' },
      { title: 'Simgeyi ana ekrana sabitleyin', detail: 'Tam ekran açılış için Chrome da denenebilir' },
    ],
  },
  'android-other': {
    id: 'android-other',
    label: 'Android',
    browserLabel: 'Tarayıcı',
    steps: [
      { title: 'Chrome yükleyin (önerilir)', detail: 'En iyi PWA desteği' },
      { title: 'Menüden Ana ekrana ekle', detail: 'veya “Uygulamayı yükle” bildirimi' },
    ],
  },
  'desktop-chrome': {
    id: 'desktop-chrome',
    label: 'Bilgisayar',
    browserLabel: 'Chrome',
    steps: [
      { title: 'Adres çubuğundaki yükle simgesi', detail: 'Monitör + ok' },
      { title: 'Yükle / Kur', detail: 'Masaüstü kısayolu da oluşur' },
    ],
  },
  'desktop-edge': {
    id: 'desktop-edge',
    label: 'Bilgisayar',
    browserLabel: 'Edge',
    steps: [
      { title: 'Adres çubuğu → Uygulamada yükle', detail: 'veya ⋮ menüsü' },
      { title: 'Yükle ile onaylayın', detail: 'Başlat menüsüne eklenir' },
    ],
  },
  'desktop-safari': {
    id: 'desktop-safari',
    label: 'Mac',
    browserLabel: 'Safari',
    steps: [
      { title: 'Dosya → Ana Ekrana Ekle', detail: 'macOS Sonoma+' },
      { title: 'Dock’tan açın', detail: 'Tam ekran uygulama modu' },
    ],
  },
  'desktop-firefox': {
    id: 'desktop-firefox',
    label: 'Bilgisayar (Windows)',
    browserLabel: 'Firefox',
    steps: [
      {
        title: 'Firefox Labs’ı açın',
        detail: 'about:preferences#experimental → “Görev çubuğuna site ekle” işaretli (FF 143+)',
      },
      {
        title: 'Adres çubuğundaki simge',
        detail: 'Kutu + ok → “Görev çubuğuna ekle” (Microsoft Store Firefox sürümünde olmayabilir)',
      },
      {
        title: 'Tam PWA için Chrome / Edge',
        detail: 'Push, tam ekran ve kurulum bildirimi Chromium’da daha tutarlı',
      },
    ],
  },
  unknown: {
    id: 'unknown',
    label: 'Cihazınız',
    browserLabel: 'Tarayıcı',
    steps: [
      { title: 'Chrome, Edge veya Safari deneyin', detail: 'Menüden “Ana ekrana ekle” arayın' },
      { title: 'Kurulumdan sonra giriş yapın', detail: 'Bildirimler ayarlardan açılır' },
    ],
  },
};

export function getPwaInstallGuide(id: PwaInstallPlatformId): PwaInstallGuide {
  return GUIDES[id] ?? GUIDES.unknown;
}

export const PWA_INSTALL_GUIDE_LIST: PwaInstallGuide[] = [
  GUIDES['ios-safari'],
  GUIDES['android-chrome'],
  GUIDES['android-samsung'],
  GUIDES['desktop-chrome'],
  GUIDES['desktop-edge'],
  GUIDES['desktop-firefox'],
];

/** Chromium dışı: beforeinstallprompt ve tam PWA genelde yok */
export function isFirefoxBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Firefox/i.test(navigator.userAgent);
}
