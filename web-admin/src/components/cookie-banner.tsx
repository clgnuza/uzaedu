'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie, Mail } from 'lucide-react';
import type { GdprPublic } from '@/lib/gdpr-public';
import {
  COOKIE_CONSENT_RESET_EVENT,
  readStoredConsent,
  writeStoredConsent,
} from '@/lib/cookie-consent';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api';
import {
  gdprAccentStripCn,
  gdprGradientFrameCn,
  gdprMobileIconShellCn,
  normalizeGdprBannerVisual,
} from '@/lib/gdpr-banner-visual';

type Consent = 'accepted' | 'rejected' | null;

const bannerBodyProse = cn(
  'text-[11px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed',
  '[&_p]:mb-1.5 [&_p:last-child]:mb-0',
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2 [&_a]:hover:underline',
  '[&_strong]:font-medium [&_strong]:text-foreground/85',
);

const defaultCfg: GdprPublic = {
  cookie_banner_enabled: true,
  cookie_banner_title: null,
  accept_button_label: null,
  reject_button_label: null,
  cookie_banner_body_html: null,
  consent_version: '1',
  data_controller_name: null,
  dpo_email: null,
  cookie_policy_path: '/cerez',
  reject_button_visible: true,
  cookie_banner_visual: 'gradient',
  cache_ttl_gdpr: 120,
};

export function CookieBanner() {
  const [cfg, setCfg] = useState<GdprPublic | null>(null);
  const [consent, setConsent] = useState<Consent>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(getApiUrl('/content/gdpr'), {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('gdpr');
        const j = (await res.json()) as GdprPublic;
        if (!cancelled) {
          setCfg({
            ...defaultCfg,
            ...j,
            cookie_banner_visual: normalizeGdprBannerVisual(j.cookie_banner_visual),
          });
        }
      } catch {
        if (!cancelled) setCfg(defaultCfg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!cfg) return;
    try {
      setConsent(readStoredConsent(cfg.consent_version));
    } catch {
      setConsent(null);
    }
    setMounted(true);
  }, [cfg]);

  useEffect(() => {
    const onReset = () => {
      setConsent(null);
    };
    window.addEventListener(COOKIE_CONSENT_RESET_EVENT, onReset);
    return () => window.removeEventListener(COOKIE_CONSENT_RESET_EVENT, onReset);
  }, []);

  if (!mounted || !cfg || !cfg.cookie_banner_enabled || consent !== null) return null;

  const policyPath = cfg.cookie_policy_path.startsWith('/') ? cfg.cookie_policy_path : `/${cfg.cookie_policy_path}`;
  const bannerTitle = (cfg.cookie_banner_title?.trim() || 'Çerez tercihleri').slice(0, 120);
  const acceptLabel = (cfg.accept_button_label?.trim() || 'Kabul et').slice(0, 64);
  const rejectLabel = (cfg.reject_button_label?.trim() || 'Reddet').slice(0, 64);
  const visual = normalizeGdprBannerVisual(cfg.cookie_banner_visual);

  const saveConsent = (value: 'accepted' | 'rejected') => {
    writeStoredConsent(cfg.consent_version, value);
    setConsent(value);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 pt-2 sm:px-4 sm:pb-4 sm:pt-3 md:p-5"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className={cn(gdprGradientFrameCn(visual))}>
        <div
          role="dialog"
          aria-live="polite"
          aria-label={bannerTitle}
          className={cn(
            'w-full overflow-hidden rounded-xl border border-border/70 bg-card/98 shadow-lg shadow-black/10 backdrop-blur-xl',
            'ring-1 ring-black/5 dark:border-white/10 dark:bg-zinc-950/98 dark:ring-white/8 dark:shadow-black/40',
            'max-sm:rounded-[14px] max-sm:border-white/12 max-sm:bg-card/90 max-sm:backdrop-blur-xl dark:max-sm:bg-zinc-950/88',
            'sm:rounded-2xl md:shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.2)]',
          )}
        >
          <div className="relative overflow-hidden rounded-[inherit]">
            <div className={gdprAccentStripCn(visual)} aria-hidden />
            <div className="flex max-h-[min(72dvh,560px)] flex-col md:max-h-none md:flex-row md:items-stretch md:gap-6 md:p-6">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4 md:min-h-0 md:overflow-visible md:p-0">
                <div className="flex min-w-0 gap-2.5 sm:gap-4">
                  <div
                    className="hidden shrink-0 sm:flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/12 dark:bg-primary/15 md:h-11 md:w-11 md:rounded-2xl"
                    aria-hidden
                  >
                    <Cookie className="size-[18px] md:size-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                    <div className="flex items-center gap-2 sm:hidden">
                      <div className={gdprMobileIconShellCn(visual)}>
                        <Cookie className="size-4" strokeWidth={1.75} />
                      </div>
                      <p className="text-[11px] font-semibold leading-tight text-foreground">{bannerTitle}</p>
                    </div>
                    {cfg.data_controller_name ? (
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                        Veri sorumlusu:{' '}
                        <span className="font-semibold text-foreground/90">{cfg.data_controller_name}</span>
                      </p>
                    ) : null}
                    {cfg.cookie_banner_body_html ? (
                      <div className={bannerBodyProse} dangerouslySetInnerHTML={{ __html: cfg.cookie_banner_body_html }} />
                    ) : (
                      <div className={cn(bannerBodyProse, 'space-y-1.5 sm:space-y-2')}>
                        <p>
                          <strong>Zorunlu çerezler</strong> ile güvenli çalışma ve temel tercihler sağlanır.{' '}
                          <strong>Analitik ve pazarlama</strong> için işlem, yalnızca açık rızanızla yapılır (KVKK m.5/2-ç;
                          GDPR m.6(1)(a)).
                        </p>
                        <p>
                          Haklar ve amaçlar{' '}
                          <Link
                            href="/gizlilik"
                            className="font-medium text-primary underline-offset-2 transition-colors hover:text-primary/90 hover:underline"
                          >
                            Aydınlatma Metni
                          </Link>
                          ’nde; çerez türleri{' '}
                          <Link
                            href={policyPath}
                            className="font-medium text-primary underline-offset-2 transition-colors hover:text-primary/90 hover:underline"
                          >
                            Çerez Politikası
                          </Link>
                          ’ndadır. Rızanızı geri çekebilir veya tarayıcıdan yönetebilirsiniz.
                        </p>
                      </div>
                    )}
                  {cfg.dpo_email ? (
                    <a
                      href={`mailto:${cfg.dpo_email}`}
                      className="inline-flex max-w-full items-center gap-1.5 truncate text-[10px] text-muted-foreground transition-colors hover:text-primary sm:text-xs"
                    >
                      <Mail className="size-3 shrink-0 opacity-80" strokeWidth={2} />
                      <span className="truncate">{cfg.dpo_email}</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            <div
              className={cn(
                'flex shrink-0 flex-row gap-2 border-t border-border/50 bg-muted/20 px-3 py-2.5 dark:bg-zinc-900/50 sm:px-5 sm:py-3',
                'md:w-44 md:min-w-44 md:flex-col md:justify-center md:gap-2 md:border-l md:border-t-0 md:bg-transparent md:px-0 md:py-0',
              )}
            >
              <button
                type="button"
                onClick={() => saveConsent('accepted')}
                className={cn(
                  'inline-flex h-9 min-h-9 flex-1 items-center justify-center rounded-lg px-3 text-xs font-semibold shadow-sm transition-all sm:h-11 sm:min-h-11 sm:flex-initial sm:rounded-xl sm:px-5 sm:text-sm',
                  'bg-primary text-primary-foreground hover:bg-primary/92 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'md:w-full',
                )}
              >
                {acceptLabel}
              </button>
              {cfg.reject_button_visible ? (
                <button
                  type="button"
                  onClick={() => saveConsent('rejected')}
                  className={cn(
                    'inline-flex h-9 min-h-9 flex-1 items-center justify-center rounded-lg border border-border bg-background/90 px-3 text-xs font-semibold sm:h-11 sm:min-h-11 sm:flex-initial sm:rounded-xl sm:px-5 sm:text-sm',
                    'text-foreground transition-all hover:bg-muted active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'dark:bg-zinc-900/70 dark:hover:bg-zinc-800',
                    'md:w-full',
                  )}
                >
                  {rejectLabel}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
