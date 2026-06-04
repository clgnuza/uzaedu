import { PWA_MASKABLE_ICON, PWA_SPLASH_LINKS } from '@/lib/pwa-assets';

/** iOS ana ekran açılış görseli + maskable ikon */
export function PwaHeadLinks({ themeColor }: { themeColor: string }) {
  return (
    <>
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <link rel="apple-touch-icon" href={PWA_MASKABLE_ICON} />
      {PWA_SPLASH_LINKS.map((s) => (
        <link key={s.href + s.media} rel="apple-touch-startup-image" href={s.href} media={s.media} />
      ))}
      <link rel="apple-touch-startup-image" href="/pwa/splash-android-portrait.png" />
      <meta name="theme-color" content={themeColor} media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0f172a" media="(prefers-color-scheme: dark)" />
      <style
        dangerouslySetInnerHTML={{
          __html: `:root{--pwa-theme:${themeColor};--pwa-splash-bg:#0f172a}`,
        }}
      />
    </>
  );
}
