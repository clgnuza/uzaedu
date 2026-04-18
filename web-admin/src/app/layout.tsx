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

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  adjustFontFallback: true,
  preload: true,
});

const SITE_URL = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

function safeGtmId(id: string): boolean {
  return /^GTM-[A-Z0-9]+$/.test(id.trim());
}

function safeGa4Id(id: string): boolean {
  return /^G-[A-Z0-9]+$/.test(id.trim());
}

export async function generateMetadata(): Promise<Metadata> {
  const extras = await fetchWebExtrasPublic();
  const appName   = extras?.pwa_short_name?.trim() || 'Uzaedu Öğretmen';
  const siteTitle = `${appName} | Dijital Okul Yönetim Platformu`;
  const desc      = extras?.meta_description?.trim() ||
    'Öğretmenler ve okul yöneticileri için ders programı, sınav planlama, akademik takvim, ek ders hesaplama ve öğretmen ajandası. MEB uyumlu yerli yazılım.';
  const ogImage   = extras?.default_og_image_url || null;

  const base: Metadata = {
    metadataBase:    new URL(SITE_URL),
    title:           { default: siteTitle, template: `%s | ${appName}` },
    description:     desc,
    applicationName: appName,
    keywords:        [
      'öğretmen', 'okul yönetimi', 'ders programı', 'sınav planlama', 'akademik takvim',
      'ek ders hesaplama', 'nöbet', 'öğretmen ajandası', 'MEB', 'dijital okul',
      'Uzaedu Öğretmen', 'UzaMobil', 'yerli yazılım',
    ],
    authors:         [{ name: 'UzaMobil Yazılım', url: SITE_URL }],
    creator:         'UzaMobil',
    publisher:       'UzaMobil Yazılım',
    robots:          { index: true, follow: true, googleBot: { index: true, follow: true } },
    openGraph: {
      type:        'website',
      locale:      'tr_TR',
      url:         SITE_URL,
      siteName:    appName,
      title:       siteTitle,
      description: desc,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630, alt: appName }] } : {}),
    },
    twitter: {
      card:        'summary_large_image',
      title:       siteTitle,
      description: desc,
      site:        '@uzaeduapp',
      creator:     '@uzaeduapp',
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    alternates:  { canonical: SITE_URL },
    icons:       extras?.favicon_url ? { icon: extras.favicon_url } : undefined,
  };
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
          id="org-jsonld"
          type="application/ld+json"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  '@id': `${SITE_URL}/#organization`,
                  name: 'Uzaedu Öğretmen',
                  alternateName: 'UzaMobil Uzaedu Öğretmen',
                  url: SITE_URL,
                  logo: {
                    '@type': 'ImageObject',
                    url: `${SITE_URL}/icon-512.png`,
                    width: 512,
                    height: 512,
                  },
                  sameAs: [
                    'https://instagram.com/uzaeduapp',
                    'https://facebook.com/uzaeduapp',
                    'https://x.com/uzaeduapp',
                    'https://linkedin.com/company/uzaeduapp',
                    'https://youtube.com/@uzaeduapp',
                    'https://tiktok.com/@uzaeduapp',
                  ],
                  contactPoint: {
                    '@type': 'ContactPoint',
                    email: 'uzaeduapp@gmail.com',
                    contactType: 'customer support',
                    availableLanguage: 'Turkish',
                  },
                },
                {
                  '@type': 'WebSite',
                  '@id': `${SITE_URL}/#website`,
                  url: SITE_URL,
                  name: 'Uzaedu Öğretmen | Dijital Okul Yönetim Platformu',
                  description: 'Öğretmenler ve okul yöneticileri için ders programı, sınav planlama, akademik takvim ve daha fazlası.',
                  publisher: { '@id': `${SITE_URL}/#organization` },
                  inLanguage: 'tr',
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/haberler?q={search_term_string}` },
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />
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
