'use client';

import Link from 'next/link';
import { Cookie, Mail } from 'lucide-react';
import type { GdprPublic } from '@/lib/gdpr-public';
import { cn } from '@/lib/utils';
import {
  gdprAccentStripCn,
  gdprGradientFrameCnPreview,
  gdprMobileIconShellCn,
  normalizeGdprBannerVisual,
} from '@/lib/gdpr-banner-visual';

const bodyProse = cn(
  'text-[11px] leading-snug text-muted-foreground sm:text-xs sm:leading-relaxed',
  '[&_p]:mb-1.5 [&_p:last-child]:mb-0',
  '[&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2',
  '[&_strong]:font-medium [&_strong]:text-foreground/85',
);

export function GdprBannerPreview({ form }: { form: GdprPublic }) {
  const shell = normalizeGdprBannerVisual(form.cookie_banner_visual);
  const policyPath = form.cookie_policy_path.startsWith('/') ? form.cookie_policy_path : `/${form.cookie_policy_path}`;
  const bannerTitle = (form.cookie_banner_title?.trim() || 'Çerez tercihleri').slice(0, 120);
  const acceptLabel = (form.accept_button_label?.trim() || 'Kabul et').slice(0, 64);
  const rejectLabel = (form.reject_button_label?.trim() || 'Reddet').slice(0, 64);

  if (!form.cookie_banner_enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-10 text-center text-[12px] text-muted-foreground">
        Çerez bildirimi kapalı; kaydedildiğinde ziyaretçilere şerit gösterilmez.
      </div>
    );
  }

  return (
    <div className={cn(gdprGradientFrameCnPreview(shell))}>
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.18)] ring-1 ring-black/5 dark:bg-zinc-950/95 dark:ring-white/10',
          'max-sm:rounded-[14px] max-sm:border-white/12 max-sm:bg-card/90 max-sm:backdrop-blur-md',
          'dark:max-sm:border-white/8 dark:max-sm:bg-zinc-950/88',
        )}
      >
        <div className={gdprAccentStripCn(shell)} aria-hidden />
        <div className="flex flex-col gap-3 px-3.5 pb-3.5 pt-1 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6 sm:p-5 sm:pt-5">
          <div className="flex min-w-0 flex-1 gap-2.5 sm:gap-3">
            <div
              className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/12 sm:flex sm:h-10 sm:w-10 sm:rounded-2xl"
              aria-hidden
            >
              <Cookie className="size-[18px] sm:size-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-start gap-2 sm:hidden">
                <div className={gdprMobileIconShellCn(shell)}>
                  <Cookie className="size-[15px]" strokeWidth={1.75} />
                </div>
                <p className="pt-0.5 text-[11px] font-semibold leading-tight text-foreground">{bannerTitle}</p>
              </div>
              {form.data_controller_name ? (
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Veri sorumlusu:{' '}
                  <span className="font-semibold text-foreground/90">{form.data_controller_name}</span>
                </p>
              ) : null}
              {form.cookie_banner_body_html ? (
                <div className={bodyProse} dangerouslySetInnerHTML={{ __html: form.cookie_banner_body_html }} />
              ) : (
                <div className={cn(bodyProse, 'space-y-1.5')}>
                  <p>
                    <strong>Zorunlu çerezler</strong> ile güvenli çalışma ve temel tercihler sağlanır.{' '}
                    <strong>Analitik ve pazarlama</strong> için işlem, yalnızca açık rızanızla yapılır (KVKK m.5/2-ç;
                    GDPR m.6(1)(a)).
                  </p>
                  <p>
                    Haklar ve amaçlar <Link href="/gizlilik" className="pointer-events-none font-medium text-primary" tabIndex={-1} aria-hidden>Aydınlatma Metni</Link>
                    ’nde; çerez türleri{' '}
                    <Link href={policyPath} className="pointer-events-none font-medium text-primary" tabIndex={-1} aria-hidden>Çerez Politikası</Link>
                    ’ndadır. Rızanızı geri çekebilir veya tarayıcıdan yönetebilirsiniz.
                  </p>
                </div>
              )}
              {form.dpo_email ? (
                <span className="inline-flex max-w-full items-center gap-1.5 truncate text-[10px] text-muted-foreground sm:text-[11px]">
                  <Mail className="size-3 shrink-0 opacity-80" strokeWidth={2} />
                  <span className="truncate">{form.dpo_email}</span>
                </span>
              ) : null}
            </div>
          </div>

          <div
            className={cn(
              'flex w-full shrink-0 flex-col gap-2 sm:flex-row sm:items-center md:w-auto md:flex-col md:justify-center',
              'md:min-w-44',
            )}
          >
            <span
              className={cn(
                'inline-flex h-10 w-full select-none items-center justify-center rounded-lg px-4 text-[12px] font-semibold shadow-sm sm:h-11 sm:rounded-xl sm:px-5 sm:text-sm',
                'bg-primary text-primary-foreground opacity-95 sm:min-w-34 md:w-full',
              )}
            >
              {acceptLabel}
            </span>
            {form.reject_button_visible ? (
              <span
                className={cn(
                  'inline-flex h-10 w-full select-none items-center justify-center rounded-lg border border-border bg-muted/55 px-4 text-[12px] font-semibold sm:h-11 sm:rounded-xl sm:px-5 sm:text-sm',
                  'text-foreground dark:bg-zinc-900/80 sm:min-w-34 md:w-full',
                )}
              >
                {rejectLabel}
              </span>
            ) : null}
          </div>
        </div>
        <p className="border-t border-border/40 bg-muted/12 px-3 py-1.5 text-center text-[9px] text-muted-foreground sm:text-[10px]">
          Canlı önizleme — düğmeler etkisiz; metin formdaki gibi görünür.
        </p>
      </div>
    </div>
  );
}
