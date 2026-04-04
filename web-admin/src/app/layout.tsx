import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { SafeThemeProvider } from '@/components/safe-theme-provider';
import { StorageGuard } from '@/components/storage-guard';
import { Toaster } from 'sonner';
import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import { CookieBanner } from '@/components/cookie-banner';
import { AuthProvider } from '@/providers/auth-provider';
import { QueryProvider } from '@/providers/query-provider';
import { fetchWebExtrasPublic } from '@/lib/web-extras-public';
import { normalizePublicSiteUrl } from '@/lib/site-url';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'latin-ext'], preload: false });

const SITE_URL = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

function safeGtmId(id: string): boolean {
  return /^GTM-[A-Z0-9]+$/.test(id.trim());
}

function safeGa4Id(id: string): boolean {
  return /^G-[A-Z0-9]+$/.test(id.trim());
}

export async function generateMetadata(): Promise<Metadata> {
  const extras = await fetchWebExtrasPublic();
  const base: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: { default: 'Öğretmen Pro – Web Admin', template: '%s | Öğretmen Pro' },
    description: 'Okul ve kullanıcı yönetimi',
  };
  if (extras?.favicon_url) {
    base.icons = { icon: extras.favicon_url };
  }
  if (extras?.pwa_short_name) {
    base.applicationName = extras.pwa_short_name;
  }
  if (extras?.default_og_image_url) {
    base.openGraph = {
      images: [{ url: extras.default_og_image_url, width: 1200, height: 630, alt: extras.pwa_short_name || 'Öğretmen Pro' }],
    };
  }
  return base;
}

export async function generateViewport(): Promise<Viewport> {
  const extras = await fetchWebExtrasPublic();
  if (!extras?.theme_color) return {};
  return { themeColor: extras.theme_color };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const extras = await fetchWebExtrasPublic();
  const gtm = extras?.gtm_id && safeGtmId(extras.gtm_id) ? extras.gtm_id.trim() : null;
  const ga4 = extras?.ga4_measurement_id && safeGa4Id(extras.ga4_measurement_id) ? extras.ga4_measurement_id.trim() : null;

  return (
    <html lang="tr" className="h-full" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className={cn(
          'flex h-full text-base text-foreground bg-background antialiased',
          inter.className,
        )}
      >
        {gtm && (
          <noscript>
            <iframe
              title="Google Tag Manager"
              src={`https://www.googletagmanager.com/ns.html?id=${gtm}`}
              height="0"
              width="0"
              style={{ display: 'none', visibility: 'hidden' }}
            />
          </noscript>
        )}
        {gtm && (
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`,
            }}
          />
        )}
        {ga4 && (
          <>
            <Script
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4)}`}
            />
            <Script
              id="ga4-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4}');`,
              }}
            />
          </>
        )}
        <Script
          id="storage-guard-early"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('unhandledrejection',function(e){var m=(e.reason&&e.reason.message?String(e.reason.message):String(e.reason||'')).toLowerCase();if(m&&(m.indexOf('access to storage')>=0||m.indexOf('storage is not allowed')>=0||m.indexOf('not allowed from this context')>=0||(m.indexOf('storage')>=0&&m.indexOf('not allowed')>=0))){e.preventDefault();e.stopPropagation();}});`,
          }}
        />
        <StorageGuard>
          <SafeThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            <AuthProvider>
              <QueryProvider>
                <div className="min-h-full w-full">{children}</div>
              </QueryProvider>
            </AuthProvider>
            <CookieBanner />
            <Toaster position="top-right" richColors closeButton />
          </SafeThemeProvider>
        </StorageGuard>
      </body>
    </html>
  );
}
