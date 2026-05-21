'use client';

import Link from 'next/link';
import { Cookie } from 'lucide-react';
import type { GdprPublic } from '@/lib/gdpr-public';
import { cn } from '@/lib/utils';
import {
  GDPR_BANNER_ACCENT_CN,
  GDPR_BANNER_BODY_PROSE_CN,
  GDPR_BANNER_CARD_CN,
  GDPR_BANNER_FRAME_CN_PREVIEW,
  GDPR_BANNER_ICON_CN,
} from '@/lib/gdpr-banner-visual';

export function GdprBannerPreview({ form }: { form: GdprPublic }) {
  const policyPath = form.cookie_policy_path.startsWith('/') ? form.cookie_policy_path : `/${form.cookie_policy_path}`;
  const bannerTitle = (form.cookie_banner_title?.trim() || 'Çerezler').slice(0, 80);
  const acceptLabel = (form.accept_button_label?.trim() || 'Kabul').slice(0, 32);
  const rejectLabel = (form.reject_button_label?.trim() || 'Reddet').slice(0, 32);

  if (!form.cookie_banner_enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-10 text-center text-[12px] text-muted-foreground">
        Çerez bildirimi kapalı; kaydedildiğinde ziyaretçilere şerit gösterilmez.
      </div>
    );
  }

  return (
    <div className={GDPR_BANNER_FRAME_CN_PREVIEW}>
      <div className={cn(GDPR_BANNER_CARD_CN, 'shadow-none')}>
        <div className="relative overflow-hidden rounded-[inherit]">
          <div className={GDPR_BANNER_ACCENT_CN} aria-hidden />
          <div className="flex flex-col gap-2 px-2.5 py-2">
            <div className="flex min-w-0 gap-2">
              <div className={GDPR_BANNER_ICON_CN} aria-hidden>
                <Cookie className="size-3" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[10px] font-semibold leading-tight text-zinc-200">{bannerTitle}</p>
                <div className={GDPR_BANNER_BODY_PROSE_CN}>
                  <p>
                    <strong>Zorunlu çerezler</strong> siteyi çalıştırır; <strong>analitik ve pazarlama</strong> yalnızca
                    rızanızla (KVKK/GDPR).{' '}
                    <Link href="/gizlilik" className="pointer-events-none" tabIndex={-1} aria-hidden>
                      Aydınlatma
                    </Link>
                    {' · '}
                    <Link href={policyPath} className="pointer-events-none" tabIndex={-1} aria-hidden>
                      Çerez
                    </Link>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              {form.reject_button_visible ? (
                <span className="inline-flex h-7 flex-1 items-center justify-center rounded-lg border border-zinc-700/80 bg-zinc-950/80 text-[10px] font-semibold text-zinc-300">
                  {rejectLabel}
                </span>
              ) : null}
              <span className="inline-flex h-7 flex-1 items-center justify-center rounded-lg bg-linear-to-r from-red-700 to-red-800 text-[10px] font-semibold text-white">
                {acceptLabel}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-center text-[9px] text-muted-foreground">Canlı önizleme — kamu sitesiyle aynı şerit.</p>
      </div>
    </div>
  );
}
