/** public/pwa — npm run pwa:assets (scripts/generate-pwa-brand-assets.mjs) */
export const UZAEDU_APP_ICON_SVG = '/pwa/uzaedu-app-icon.svg';
export const PWA_ICON_192 = '/icon-192.png';
export const PWA_ICON_512 = '/icon-512.png';
export const PWA_MASKABLE_ICON = '/pwa/icon-maskable-512.png';
export const PWA_APPLE_ICON = PWA_ICON_512;

export const PWA_SPLASH_LINKS = [
  {
    href: '/pwa/splash-iphone-15-pro-max.png',
    media:
      '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/pwa/splash-iphone-14.png',
    media:
      '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)',
  },
  {
    href: '/pwa/splash-android-portrait.png',
    media: '(orientation: portrait)',
  },
] as const;

export const PWA_SCREENSHOTS = [
  { src: '/pwa/screenshot-wide.png', sizes: '1280x720', type: 'image/png', form_factor: 'wide' as const },
  { src: '/pwa/screenshot-narrow.png', sizes: '720x1280', type: 'image/png', form_factor: 'narrow' as const },
];
