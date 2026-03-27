'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { Container } from '@/components/common/container';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';
import { getApiUrl } from '@/lib/api';
import { FOOTER_CONSENT_HREF } from '@/lib/footer-consent-href';
import { cn } from '@/lib/utils';
import {
  WEB_PUBLIC_DEFAULT_FOOTER,
  type WebPublicConfig,
} from '@/components/web-settings/web-public-panel';

const chipLink =
  'inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-background hover:text-foreground hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-[13px]';

export function Footer() {
  const year = new Date().getFullYear();
  const [footerCfg, setFooterCfg] = useState<Pick<
    WebPublicConfig,
    'footer_copyright_suffix' | 'footer_nav_items'
  > | null>(null);

  useEffect(() => {
    fetch(getApiUrl('/content/web-public'), { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Partial<WebPublicConfig> | null) => {
        if (!d) return;
        setFooterCfg({
          footer_copyright_suffix: d.footer_copyright_suffix ?? WEB_PUBLIC_DEFAULT_FOOTER.footer_copyright_suffix,
          footer_nav_items:
            Array.isArray(d.footer_nav_items) && d.footer_nav_items.length > 0
              ? d.footer_nav_items
              : WEB_PUBLIC_DEFAULT_FOOTER.footer_nav_items,
        });
      })
      .catch(() => setFooterCfg(null));
  }, []);

  const suffix = footerCfg?.footer_copyright_suffix ?? WEB_PUBLIC_DEFAULT_FOOTER.footer_copyright_suffix;
  const items =
    footerCfg?.footer_nav_items?.length ? footerCfg.footer_nav_items : WEB_PUBLIC_DEFAULT_FOOTER.footer_nav_items;

  return (
    <footer className="relative print:hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-linear-to-r from-transparent via-primary/30 to-transparent"
        aria-hidden
      />
      <div className="relative border-t border-border/40 bg-background/80 backdrop-blur-md supports-backdrop-filter:bg-background/70 dark:border-border/25 dark:bg-background/60">
        <Container className="max-w-6xl">
          <div className="flex flex-col items-center gap-3 py-4 sm:flex-row sm:justify-between sm:gap-6 sm:py-3.5">
            <div className="flex max-w-md flex-col items-center gap-1 text-center sm:max-w-none sm:flex-row sm:items-baseline sm:gap-2.5 sm:text-left">
              <span className="inline-flex shrink-0 items-center rounded-lg border border-border/50 bg-muted/40 px-2 py-0.5 text-[11px] font-semibold tracking-tight text-foreground tabular-nums shadow-xs dark:bg-muted/25">
                {year}
              </span>
              <p className="text-balance text-xs leading-snug text-muted-foreground sm:text-[13px]">{suffix}</p>
            </div>

            <nav aria-label="Alt bilgi bağlantıları">
              <ul
                className={cn(
                  'flex flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-border/45 bg-muted/35 p-1 shadow-inner',
                  'dark:border-border/30 dark:bg-muted/20',
                )}
              >
                {items.map((item, i) => {
                  const key = `${item.href}-${i}`;
                  const isExternal = item.href.startsWith('https://');
                  if (item.href === FOOTER_CONSENT_HREF) {
                    return (
                      <li key={key}>
                        <CookiePreferencesLink className={chipLink}>{item.label}</CookiePreferencesLink>
                      </li>
                    );
                  }
                  if (isExternal) {
                    return (
                      <li key={key}>
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(chipLink, 'group')}
                        >
                          <span>{item.label}</span>
                          <ExternalLink
                            className="size-3 shrink-0 opacity-40 transition-opacity group-hover:opacity-80"
                            aria-hidden
                          />
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={key}>
                      <Link href={item.href} className={chipLink}>
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        </Container>
      </div>
    </footer>
  );
}
