'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Container } from '@/components/common/container';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';
import { fetchWebPublicPartial } from '@/lib/fetch-web-public';
import { FOOTER_CONSENT_HREF } from '@/lib/footer-consent-href';
import { cn } from '@/lib/utils';
import {
  WEB_PUBLIC_DEFAULT_FOOTER,
  type WebPublicConfig,
} from '@/components/web-settings/web-public-panel';

/* â”€â”€ Sosyal ikonlar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const IconInstagram = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[17px]">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
  </svg>
);
const IconFacebook = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[17px]">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[14px]">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.262 5.635 5.902-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const IconLinkedIn = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[17px]">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);
const IconYouTube = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[17px]">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);
const IconTikTok = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[15px]">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.17 8.17 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
  </svg>
);

const SOCIAL_LINKS = [
  { label: 'Instagram', href: 'https://instagram.com/uzaeduapp',        icon: IconInstagram, color: 'hover:bg-pink-500/20 hover:text-pink-300 hover:border-pink-500/40'    },
  { label: 'Facebook',  href: 'https://facebook.com/uzaeduapp',         icon: IconFacebook,  color: 'hover:bg-blue-600/20 hover:text-blue-300 hover:border-blue-500/40'    },
  { label: 'X',         href: 'https://x.com/uzaeduapp',                icon: IconX,         color: 'hover:bg-slate-400/20 hover:text-slate-200 hover:border-slate-400/40' },
  { label: 'LinkedIn',  href: 'https://linkedin.com/company/uzaeduapp', icon: IconLinkedIn,  color: 'hover:bg-sky-500/20 hover:text-sky-300 hover:border-sky-500/40'        },
  { label: 'YouTube',   href: 'https://youtube.com/@uzaeduapp',         icon: IconYouTube,   color: 'hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40'        },
  { label: 'TikTok',    href: 'https://tiktok.com/@uzaeduapp',          icon: IconTikTok,    color: 'hover:bg-fuchsia-500/20 hover:text-fuchsia-300 hover:border-fuchsia-500/40' },
];

const APP_LINKS = [
  {
    label: 'App Store', sub: 'iPhone & iPad', href: 'https://apps.apple.com',
    gradient: 'from-slate-600 to-slate-800',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5 shrink-0 text-white">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
      </svg>
    ),
  },
  {
    label: 'Google Play', sub: 'Android', href: 'https://play.google.com',
    gradient: 'from-green-600 to-emerald-700',
    icon: () => (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-5 shrink-0 text-white">
        <path d="M3.18 23.76c.34.19.72.24 1.09.16l12.37-6.94-2.73-2.73-10.73 9.51zM.3 1.48C.11 1.79 0 2.17 0 2.61v18.78c0 .44.11.82.3 1.13l.06.06 10.52-10.52v-.25L.36 1.42.3 1.48zM20.65 10.27l-2.93-1.65-3.07 3.07 3.07 3.07 2.94-1.65c.84-.47.84-1.37-.01-1.84zm-17.47 13.49L14.55 13.4l-2.73-2.73-8.64 8.64c.39.39.84.64 1.4.45z" />
      </svg>
    ),
  },
];


export function Footer() {
  const year = new Date().getFullYear();
  const [footerCfg, setFooterCfg] = useState<Pick<
    WebPublicConfig,
    'footer_copyright_suffix' | 'footer_nav_items' | 'footer_tagline'
  > | null>(null);

  useEffect(() => {
    fetchWebPublicPartial()
      .then((d: Partial<WebPublicConfig> | null) => {
        if (!d) return;
        setFooterCfg({
          footer_copyright_suffix: d.footer_copyright_suffix ?? WEB_PUBLIC_DEFAULT_FOOTER.footer_copyright_suffix,
          footer_tagline: d.footer_tagline ?? null,
          footer_nav_items:
            Array.isArray(d.footer_nav_items) && d.footer_nav_items.length > 0
              ? d.footer_nav_items
              : WEB_PUBLIC_DEFAULT_FOOTER.footer_nav_items,
        });
      })
      .catch(() => setFooterCfg(null));
  }, []);

  const suffix  = footerCfg?.footer_copyright_suffix ?? WEB_PUBLIC_DEFAULT_FOOTER.footer_copyright_suffix;
  const tagline = footerCfg?.footer_tagline ?? 'Öğretmenler için üretilmiş dijital okul yönetim platformu';
  const baseItems = footerCfg?.footer_nav_items?.length
    ? footerCfg.footer_nav_items
    : WEB_PUBLIC_DEFAULT_FOOTER.footer_nav_items;
  const items = baseItems.some((x) => x.href === '/iletisim')
    ? baseItems
    : [{ label: 'İletişim', href: '/iletisim' }, ...baseItems];

  return (
    <>
      {/* â”€â”€ Sayfa â†’ Footer geçiş köprüsü â”€â”€ */}
      <div
        className="print:hidden pointer-events-none h-14 sm:h-20"
        aria-hidden
        style={{
          background:
            'linear-gradient(180deg,' +
            'transparent 0%,' +
            'rgba(11,21,40,0.18) 30%,' +
            'rgba(11,21,40,0.55) 60%,' +
            'rgba(11,21,40,0.82) 82%,' +
            '#0b1528 100%)',
          marginTop: '-3.5rem',
        }}
      />
    <footer className="relative print:hidden overflow-hidden" style={{ background: 'linear-gradient(180deg,#0b1528 0%,#07101e 100%)' }}>

      {/* IÅŸÄ±klÄ± arka plan katmanlarÄ± */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        {/* Izgara */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)',
            backgroundSize: '44px 44px',
          }} />
        {/* Mavi Ä±ÅŸÄ±k halkalarÄ± */}
        <div className="absolute -left-32 top-0 h-72 w-72 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(59,130,246,0.12) 0%,transparent 70%)' }} />
        <div className="absolute -right-20 bottom-0 h-60 w-60 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.10) 0%,transparent 70%)' }} />
        {/* Ãœst renk Ã§izgisi */}
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.6),rgba(139,92,246,0.5),transparent)' }} />
      </div>

      <Container className="relative max-w-6xl">

        {/* â”€â”€ Ana iÃ§erik â”€â”€ */}
        <div className="flex flex-col gap-6 py-5 lg:flex-row lg:items-start lg:justify-between lg:gap-10">

          {/* Sol: Marka */}
          <div className="flex flex-col items-center gap-3 lg:items-start">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl"
                style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="size-5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342M6.75 15a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm0 0v-3.675A55.378 55.378 0 0 1 12 8.443m-7.007 11.55A5.981 5.981 0 0 0 6.75 15.75v-1.5" />
                </svg>
              </div>
              <div>
                <p className="text-base font-extrabold tracking-tight text-white">
                  Uzaedu<span className="text-blue-400"> Öğretmen</span>
                </p>
                <p className="text-[10px] text-white/40">by UzaMobil</p>
              </div>
            </div>

            <p className="max-w-[220px] text-center text-[11px] leading-relaxed text-white/40 lg:text-left">
              {tagline}
            </p>

            {/* Sosyal medya */}
            <div>
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30 lg:text-left">
                Bizi takip edin · @uzaeduapp
              </p>
              <div className="flex items-center gap-1.5">
                {SOCIAL_LINKS.map(({ label, href, icon: Icon, color }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    aria-label={label} title={`@uzaeduapp â€” ${label}`}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/50',
                      'transition-all duration-200 hover:scale-110 active:scale-95',
                      color,
                    )}>
                    <Icon />
                  </a>
                ))}
              </div>
            </div>

            {/* Ä°letiÅŸim CTA */}
            <Link href="/iletisim"
              className="group flex items-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-2 text-[12px] font-semibold text-blue-300 transition-all hover:bg-blue-500/20 hover:border-blue-400/40">
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5 shrink-0" aria-hidden>
                <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
                <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
              </svg>
              Bizimle iletişime geçin
            </Link>
          </div>

          {/* SaÄŸ: Uygulama + Nav */}
          <div className="flex flex-col items-center gap-4 lg:items-end">

            {/* Uygulama indirme */}
            <div>
              <p className="mb-2.5 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30 lg:text-right">
                Uygulamaı İndir
              </p>
              <div className="flex flex-wrap justify-center gap-2 lg:justify-end">
                {APP_LINKS.map(({ label, sub, href, gradient, icon: Icon }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-4 py-2.5 transition-all duration-200',
                      'hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]',
                      'bg-linear-to-br', gradient,
                    )}>
                    <Icon />
                    <div className="text-left">
                      <p className="text-[11px] font-bold leading-tight text-white">{label}</p>
                      <p className="text-[9px] text-white/60">{sub}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>

            {/* Nav linkleri */}
            <div>
              <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-white/30 lg:text-right">
                Bağlantılar
              </p>
              <nav aria-label="Alt bilgi bağlantıları">
                <ul className="flex flex-wrap justify-center gap-0.5 lg:justify-end">
                  {items.map((item, i) => {
                    const key = `${item.href}-${i}`;
                    const isExternal = item.href.startsWith('https://');
                    const lCls = 'rounded-lg px-2.5 py-1.5 text-[11px] text-white/40 transition-colors hover:bg-white/6 hover:text-white/75';

                    if (item.href === FOOTER_CONSENT_HREF) {
                      return <li key={key}><CookiePreferencesLink className={lCls}>{item.label}</CookiePreferencesLink></li>;
                    }
                    if (isExternal) {
                      return (
                        <li key={key}>
                          <a href={item.href} target="_blank" rel="noopener noreferrer" className={cn(lCls, 'inline-flex items-center gap-1 group')}>
                            {item.label}
                            <ExternalLink className="size-3 opacity-30 group-hover:opacity-60" aria-hidden />
                          </a>
                        </li>
                      );
                    }
                    return <li key={key}><Link href={item.href} className={lCls}>{item.label}</Link></li>;
                  })}
                </ul>
              </nav>
            </div>
          </div>
        </div>

        {/* â”€â”€ Alt ÅŸerit â”€â”€ */}
        <div className="flex flex-col items-center gap-1 border-t border-white/8 py-2.5 sm:flex-row sm:justify-between">
          <p className="flex items-center gap-2 text-[11px] text-white/30">
            <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/50">
              {year}
            </span>
            {suffix}
          </p>
          <p className="text-[10px] text-white/20">
            Tüm hakları saklıdır · UzaMobil Yazılım
          </p>
        </div>

      </Container>
    </footer>
    </>
  );
}
