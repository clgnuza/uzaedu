'use client';

import Link from 'next/link';
import { Cookie, Mail } from 'lucide-react';
import type { GdprPublic } from '@/lib/gdpr-public';
import { cn } from '@/lib/utils';

export function GdprBannerPreview({ form }: { form: GdprPublic }) {
  const policyPath = form.cookie_policy_path.startsWith('/') ? form.cookie_policy_path : `/${form.cookie_policy_path}`;
  const bannerTitle = (form.cookie_banner_title?.trim() || 'Çerez tercihleri').slice(0, 120);
  const acceptLabel = (form.accept_button_label?.trim() || 'Kabul et').slice(0, 64);
  const rejectLabel = (form.reject_button_label?.trim() || 'Reddet').slice(0, 64);

  if (!form.cookie_banner_enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border/80 bg-muted/25 px-4 py-10 text-center text-sm text-muted-foreground">
        Çerez bildirimi kapalı; kaydedildiğinde ziyaretçilere şerit gösterilmez.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/95 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.2)] ring-1 ring-black/4 dark:bg-zinc-950/95 dark:ring-white/10">
      <div
        className="pointer-events-none h-1 bg-linear-to-r from-primary/0 via-primary/70 to-primary/0"
        aria-hidden
      />
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6 sm:p-5">
        <div className="flex min-w-0 flex-1 gap-3">
          <div
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 sm:flex"
            aria-hidden
          >
            <Cookie className="size-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-start gap-2 sm:hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Cookie className="size-[18px]" strokeWidth={1.75} />
              </div>
              <p className="pt-0.5 text-[13px] font-semibold leading-tight text-foreground">{bannerTitle}</p>
            </div>
            {form.data_controller_name ? (
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Veri sorumlusu:{' '}
                <span className="font-semibold text-foreground/90">{form.data_controller_name}</span>
              </p>
            ) : null}
            {form.cookie_banner_body_html ? (
              <div
                className="text-[13px] leading-relaxed text-muted-foreground sm:text-sm [&_a]:font-medium [&_a]:text-primary [&_a]:underline-offset-2"
                dangerouslySetInnerHTML={{ __html: form.cookie_banner_body_html }}
              />
            ) : (
              <div className="space-y-2 text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                <p>
                  <strong className="font-semibold text-foreground/90">Çerezler ve benzeri teknolojiler.</strong>{' '}
                  Siteyi sunmak, güvenliği sağlamak, tercihlerinizi hatırlamak ve yalnızca onay vermeniz halinde analitik
                  veya pazarlama çerezlerini kullanmak için işlem yapıyoruz.
                </p>
                <p>
                  Ayrıntılar{' '}
                  <Link
                    href="/gizlilik"
                    className="pointer-events-none font-medium text-primary underline-offset-2"
                    tabIndex={-1}
                    aria-hidden
                  >
                    Aydınlatma Metni
                  </Link>{' '}
                  ve{' '}
                  <Link
                    href={policyPath}
                    className="pointer-events-none font-medium text-primary underline-offset-2"
                    tabIndex={-1}
                    aria-hidden
                  >
                    Çerez Politikası
                  </Link>
                  ’nda; zorunlu olmayan çerezler için dayanak açık rızanızdır. Rızanızı geri çekebilir veya tarayıcıdan
                  çerezleri yönetebilirsiniz.
                </p>
              </div>
            )}
            {form.dpo_email ? (
              <span className="inline-flex max-w-full items-center gap-1.5 truncate text-[11px] text-muted-foreground sm:text-xs">
                <Mail className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
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
              'inline-flex h-11 w-full select-none items-center justify-center rounded-xl px-5 text-sm font-semibold shadow-sm',
              'bg-primary text-primary-foreground opacity-95 sm:min-w-34 md:w-full',
            )}
          >
            {acceptLabel}
          </span>
          {form.reject_button_visible ? (
            <span
              className={cn(
                'inline-flex h-11 w-full select-none items-center justify-center rounded-xl border border-border bg-muted/60 px-5 text-sm font-semibold',
                'text-foreground dark:bg-zinc-900/80 sm:min-w-34 md:w-full',
              )}
            >
              {rejectLabel}
            </span>
          ) : null}
        </div>
      </div>
      <p className="border-t border-border/40 bg-muted/15 px-3 py-2 text-center text-[10px] text-muted-foreground">
        Canlı önizleme — düğmeler etkisiz; metin formdaki gibi görünür.
      </p>
    </div>
  );
}
