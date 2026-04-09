import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { LegalPageContent } from '@/components/web-settings/legal-pages-types';
import { UzaEduLogo } from '@/components/auth/uza-edu-logo';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';
import { cn } from '@/lib/utils';

export function LegalPageLoadError() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-x-hidden bg-linear-to-b from-muted/35 via-background to-background px-4 py-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.3] dark:opacity-[0.18]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.45) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card/90 p-6 text-center shadow-sm backdrop-blur-sm">
        <Link href="/" className="mb-5 inline-flex justify-center">
          <UzaEduLogo className="h-8 w-auto dark:[&_text:first-of-type]:fill-white/90" />
        </Link>
        <p className="text-pretty text-sm text-muted-foreground sm:text-base">
          İçerik yüklenemedi. Lütfen daha sonra tekrar deneyin.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-11 min-w-[44px] items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Giriş
        </Link>
      </div>
    </div>
  );
}

function LegalPageBrandHeader() {
  return (
    <header className="mb-5 flex flex-col items-center text-center sm:mb-6">
      <Link href="/" className="relative mb-3 inline-flex sm:mb-4" aria-label="Ana sayfa">
        <span className="pointer-events-none absolute -inset-4 rounded-3xl bg-blue-500/14 blur-2xl dark:bg-blue-500/12" aria-hidden />
        <UzaEduLogo className="relative h-8 w-auto drop-shadow-sm sm:h-10 dark:[&_text:first-of-type]:fill-white/90" />
      </Link>
      <div className="flex flex-wrap items-baseline justify-center gap-x-1 leading-none tracking-tight">
        <span className="text-[1.35rem] font-extrabold text-foreground sm:text-[1.55rem]">Öğretmen</span>
        <span className="bg-linear-to-r from-indigo-500 via-blue-500 to-sky-400 bg-clip-text text-[1.35rem] font-extrabold text-transparent sm:text-[1.55rem]">
          Pro
        </span>
      </div>
      <span className="mt-2 inline-flex items-center rounded-full border border-border/50 bg-background/60 px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-sm backdrop-blur-md sm:mt-2.5 sm:px-3 sm:text-[10px] dark:bg-zinc-900/50">
        Yasal bilgilendirme
      </span>
    </header>
  );
}

const navPill =
  'inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-border/50 bg-muted/25 px-3 py-2 text-center text-[13px] font-medium text-primary transition-colors hover:border-primary/30 hover:bg-muted/50 active:bg-muted/70 sm:min-h-11 sm:flex-1 sm:px-4 sm:text-sm';

export function LegalPublicPageView({
  block,
  links,
}: {
  block: LegalPageContent;
  links: { href: string; label: string }[];
}) {
  const updated = block.updated_at
    ? new Date(block.updated_at).toLocaleDateString('tr-TR')
    : new Date().toLocaleDateString('tr-TR');

  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden bg-linear-to-b from-muted/35 via-background to-background">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.3] dark:opacity-[0.18]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(var(--border) / 0.45) 1px, transparent 0)`,
          backgroundSize: '24px 24px',
        }}
        aria-hidden
      />
      <div className="relative mx-auto w-full max-w-2xl px-3 py-5 sm:px-6 sm:py-8 lg:max-w-3xl lg:px-8 lg:py-10">
        <LegalPageBrandHeader />

        <nav className="mb-5 sm:mb-6" aria-label="Geri">
          <Link
            href="/login"
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border/60 bg-background/90 px-3 py-2 text-[13px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-border hover:text-foreground active:scale-[0.98] sm:min-h-11 sm:px-4 sm:text-sm"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span>Girişe dön</span>
          </Link>
        </nav>

        <article className="overflow-hidden rounded-2xl border border-border/40 bg-card/70 p-4 shadow-sm backdrop-blur-sm sm:p-6 md:p-8">
          <header className="border-b border-border/30 pb-4 sm:pb-6">
            <h1 className="text-balance text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl md:text-[1.75rem]">
              {block.title}
            </h1>
            <p className="mt-3 inline-flex max-w-full items-center rounded-full bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground ring-1 ring-border/40 sm:px-3 sm:py-1.5 sm:text-xs">
              Son güncelleme: {updated}
            </p>
          </header>

          <div
            className={cn(
              'legal-html-content not-prose mt-5 max-w-none sm:mt-6',
              'text-[14px] leading-relaxed text-muted-foreground sm:text-[15px] sm:leading-[1.65] md:text-base',
              '[&_h2]:mt-7 [&_h2]:scroll-mt-24 [&_h2]:text-balance [&_h2]:text-base [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-foreground',
              'sm:[&_h2]:mt-9 sm:[&_h2]:text-lg md:[&_h2]:text-xl',
              '[&_h2:first-child]:mt-0',
              '[&_p]:mt-3 [&_p]:text-pretty [&_p]:first:mt-0',
              '[&_strong]:font-semibold [&_strong]:text-foreground',
              '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-4 sm:[&_ul]:my-4 sm:[&_ul]:pl-5',
              '[&_li]:text-pretty [&_li]:pl-0.5',
            )}
            dangerouslySetInnerHTML={{ __html: block.body_html }}
          />
        </article>

        <nav
          className="mt-6 grid grid-cols-1 gap-2 sm:mt-8 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4"
          aria-label="Diğer yasal sayfalar ve tercihler"
        >
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={navPill}>
              {l.label}
            </Link>
          ))}
          <CookiePreferencesLink className={navPill}>Çerez tercihleri</CookiePreferencesLink>
          <Link
            href="/login"
            className={cn(
              navPill,
              'border-transparent bg-primary/10 font-semibold text-primary hover:bg-primary/15 active:bg-primary/20',
            )}
          >
            Giriş
          </Link>
        </nav>
      </div>
    </div>
  );
}
