'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import type { GdprPublic } from '@/lib/gdpr-public';
import {
  COOKIE_CONSENT_RESET_EVENT,
  readStoredConsent,
  writeStoredConsent,
} from '@/lib/cookie-consent';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api';
import {
  GDPR_BANNER_ACCENT_CN,
  GDPR_BANNER_BODY_PROSE_CN,
  GDPR_BANNER_CARD_CN,
  GDPR_BANNER_FRAME_CN,
  GDPR_BANNER_ICON_CN,
} from '@/lib/gdpr-banner-visual';

type Consent = 'accepted' | 'rejected' | null;

let gdprInflight: Promise<GdprPublic> | null = null;

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
  cookie_banner_visual: 'landing',
  cache_ttl_gdpr: 120,
};

function BannerBody({ policyPath }: { policyPath: string }) {
  return (
    <p>
      <strong>Zorunlu çerezler</strong> siteyi çalıştırır; <strong>analitik ve pazarlama</strong> yalnızca
      rızanızla (KVKK/GDPR).{' '}
      <Link href="/gizlilik">Aydınlatma</Link>
      {' · '}
      <Link href={policyPath}>Çerez</Link>
    </p>
  );
}

export function CookieBanner() {
  const [cfg, setCfg] = useState<GdprPublic | null>(null);
  const [consent, setConsent] = useState<Consent>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const p =
      gdprInflight ??
      (gdprInflight = (async (): Promise<GdprPublic> => {
        try {
          const res = await fetch(getApiUrl('/content/gdpr'), { cache: 'no-store' });
          if (!res.ok) throw new Error('gdpr');
          const j = (await res.json()) as GdprPublic;
          return { ...defaultCfg, ...j, cookie_banner_visual: 'landing' };
        } catch {
          return defaultCfg;
        }
      })().finally(() => {
        gdprInflight = null;
      }));
    void p.then((cfgNext) => {
      if (!cancelled) setCfg(cfgNext);
    });
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
    const onReset = () => setConsent(null);
    window.addEventListener(COOKIE_CONSENT_RESET_EVENT, onReset);
    return () => window.removeEventListener(COOKIE_CONSENT_RESET_EVENT, onReset);
  }, []);

  if (!mounted || !cfg || !cfg.cookie_banner_enabled || consent !== null) return null;

  const policyPath = cfg.cookie_policy_path.startsWith('/') ? cfg.cookie_policy_path : `/${cfg.cookie_policy_path}`;
  const bannerTitle = (cfg.cookie_banner_title?.trim() || 'Çerezler').slice(0, 80);
  const acceptLabel = (cfg.accept_button_label?.trim() || 'Kabul').slice(0, 32);
  const rejectLabel = (cfg.reject_button_label?.trim() || 'Reddet').slice(0, 32);

  const saveConsent = (value: 'accepted' | 'rejected') => {
    writeStoredConsent(cfg.consent_version, value);
    setConsent(value);
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-2 pb-2 pt-1 sm:px-4 sm:pb-3"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className={GDPR_BANNER_FRAME_CN}>
        <div role="dialog" aria-live="polite" aria-label={bannerTitle} className={GDPR_BANNER_CARD_CN}>
          <div className="relative overflow-hidden rounded-[inherit]">
            <div className={GDPR_BANNER_ACCENT_CN} aria-hidden />
            <div className="flex flex-col gap-2 px-2.5 py-2 sm:gap-2.5 sm:px-3.5 sm:py-2.5">
              <div className="flex min-w-0 gap-2">
                <div className={cn(GDPR_BANNER_ICON_CN, 'mt-0.5')} aria-hidden>
                  <Cookie className="size-3" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[10px] font-semibold leading-tight text-zinc-200 sm:text-[11px]">{bannerTitle}</p>
                  <div className={GDPR_BANNER_BODY_PROSE_CN}>
                    <BannerBody policyPath={policyPath} />
                  </div>
                </div>
              </div>
              <div className="flex w-full shrink-0 gap-1.5">
                {cfg.reject_button_visible ? (
                  <button
                    type="button"
                    onClick={() => saveConsent('rejected')}
                    className={cn(
                      'inline-flex h-7 min-h-7 flex-1 items-center justify-center rounded-lg border border-zinc-700/80',
                      'bg-zinc-950/80 px-2 text-[10px] font-semibold text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-900',
                      'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 sm:h-8 sm:text-[11px]',
                    )}
                  >
                    {rejectLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => saveConsent('accepted')}
                  className={cn(
                    'inline-flex h-7 min-h-7 flex-1 items-center justify-center rounded-lg px-2 text-[10px] font-semibold text-white transition',
                    'bg-linear-to-r from-red-700 to-red-800 shadow-md shadow-red-950/40 hover:from-red-600 hover:to-red-700',
                    'active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 sm:h-8 sm:text-[11px]',
                  )}
                >
                  {acceptLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
