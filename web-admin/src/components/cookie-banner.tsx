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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

type Consent = 'accepted' | 'rejected' | null;

const defaultCfg: GdprPublic = {
  cookie_banner_enabled: true,
  cookie_banner_body_html: null,
  consent_version: '1',
  data_controller_name: null,
  dpo_email: null,
  cookie_policy_path: '/cerez',
  reject_button_visible: true,
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
        const res = await fetch(`${API_BASE.replace(/\/$/, '')}/content/gdpr`);
        if (!res.ok) throw new Error('gdpr');
        const j = (await res.json()) as GdprPublic;
        if (!cancelled) setCfg({ ...defaultCfg, ...j });
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

  const saveConsent = (value: 'accepted' | 'rejected') => {
    writeStoredConsent(cfg.consent_version, value);
    setConsent(value);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center p-3 sm:p-4 md:p-5"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div
        role="dialog"
        aria-live="polite"
        aria-label="Çerez tercihleri"
        className={cn(
          'pointer-events-auto w-full max-w-[min(100%,42rem)] animate-in fade-in slide-in-from-bottom-3 duration-300 md:max-w-5xl',
          'rounded-2xl border border-border/80 bg-card/95 shadow-[0_-8px_40px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl',
          'ring-1 ring-black/4 dark:bg-zinc-950/95 dark:ring-white/10 dark:shadow-[0_-12px_48px_-8px_rgba(0,0,0,0.45)]',
        )}
      >
        <div className="relative overflow-hidden rounded-2xl">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-primary/0 via-primary/70 to-primary/0"
            aria-hidden
          />
          <div className="flex flex-col gap-4 p-4 sm:gap-5 sm:p-5 md:flex-row md:items-stretch md:justify-between md:gap-8 md:p-6">
            <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
              <div
                className="hidden shrink-0 sm:flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 dark:bg-primary/15"
                aria-hidden
              >
                <Cookie className="size-5" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start gap-2 sm:hidden">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Cookie className="size-[18px]" strokeWidth={1.75} />
                  </div>
                  <p className="pt-0.5 text-[13px] font-semibold leading-tight text-foreground">Çerez tercihleri</p>
                </div>
                {cfg.data_controller_name ? (
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
                    Veri sorumlusu: <span className="font-semibold text-foreground/90">{cfg.data_controller_name}</span>
                  </p>
                ) : null}
                {cfg.cookie_banner_body_html ? (
                  <div
                    className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2 [&_a]:hover:underline"
                    dangerouslySetInnerHTML={{ __html: cfg.cookie_banner_body_html }}
                  />
                ) : (
                  <div className="space-y-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                    <p>
                      <strong className="font-semibold text-foreground/90">Çerezler ve benzeri teknolojiler.</strong>{' '}
                      Siteyi sunmak, güvenliği sağlamak, tercihlerinizi hatırlamak ve yalnızca onay vermeniz halinde
                      analitik veya pazarlama çerezlerini kullanmak için işlem yapıyoruz.
                    </p>
                    <p>
                      Ayrıntılar{' '}
                      <Link
                        href="/gizlilik"
                        className="font-medium text-primary underline-offset-2 transition-colors hover:text-primary/90 hover:underline"
                      >
                        Aydınlatma Metni
                      </Link>{' '}
                      ve{' '}
                      <Link
                        href={policyPath}
                        className="font-medium text-primary underline-offset-2 transition-colors hover:text-primary/90 hover:underline"
                      >
                        Çerez Politikası
                      </Link>
                      ’nda; zorunlu olmayan çerezler için dayanak açık rızanızdır. Rızanızı geri çekebilir veya tarayıcıdan
                      çerezleri yönetebilirsiniz.
                    </p>
                  </div>
                )}
                {cfg.dpo_email ? (
                  <a
                    href={`mailto:${cfg.dpo_email}`}
                    className="inline-flex max-w-full items-center gap-1.5 truncate text-[11px] text-muted-foreground transition-colors hover:text-primary sm:text-xs"
                  >
                    <Mail className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                    <span className="truncate">{cfg.dpo_email}</span>
                  </a>
                ) : null}
              </div>
            </div>

            <div
              className={cn(
                'flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:flex-col md:justify-center',
                'md:min-w-44',
              )}
            >
              <button
                type="button"
                onClick={() => saveConsent('accepted')}
                className={cn(
                  'inline-flex h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-sm transition-all',
                  'bg-primary text-primary-foreground hover:bg-primary/92 active:scale-[0.98]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  'sm:min-w-34 md:w-full',
                )}
              >
                Kabul et
              </button>
              {cfg.reject_button_visible ? (
                <button
                  type="button"
                  onClick={() => saveConsent('rejected')}
                  className={cn(
                    'inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-muted/60 px-5 text-sm font-semibold',
                    'text-foreground transition-all hover:bg-muted active:scale-[0.98]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'dark:bg-zinc-900/80 dark:hover:bg-zinc-800',
                    'sm:min-w-34 md:w-full',
                  )}
                >
                  Reddet
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
