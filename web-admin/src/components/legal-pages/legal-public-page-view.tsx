import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { LegalPageContent } from '@/components/web-settings/legal-pages-types';
import { cn } from '@/lib/utils';

export function LegalPageLoadError() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-linear-to-b from-muted/50 to-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/80 p-6 text-center shadow-sm backdrop-blur-sm">
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
    <div className="min-h-dvh bg-linear-to-b from-muted/35 via-background to-background">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10 lg:max-w-3xl lg:px-8 lg:py-12">
        <nav className="mb-6 sm:mb-8" aria-label="Geri">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/60 bg-background/90 px-4 py-2.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:border-border hover:text-foreground active:scale-[0.98]"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span>Giriş sayfasına dön</span>
          </Link>
        </nav>

        <article className="overflow-hidden rounded-2xl border border-border/40 bg-card/60 p-5 shadow-sm backdrop-blur-sm sm:p-8">
          <header className="border-b border-border/30 pb-6 sm:pb-8">
            <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl lg:text-[2rem]">
              {block.title}
            </h1>
            <p className="mt-4 inline-flex max-w-full items-center rounded-full bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-border/40 sm:text-sm">
              Son güncelleme: {updated}
            </p>
          </header>

          <div
            className={cn(
              'legal-html-content not-prose mt-6 max-w-none sm:mt-8',
              'text-[15px] leading-relaxed text-muted-foreground sm:text-base sm:leading-[1.65]',
              '[&_h2]:mt-8 [&_h2]:scroll-mt-20 [&_h2]:text-balance [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:text-foreground',
              'sm:[&_h2]:mt-10 sm:[&_h2]:text-xl',
              '[&_h2:first-child]:mt-0',
              '[&_p]:mt-3 [&_p]:text-pretty [&_p]:first:mt-0',
              '[&_strong]:font-semibold [&_strong]:text-foreground',
              '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-4 sm:[&_ul]:pl-5',
              '[&_li]:text-pretty [&_li]:pl-0.5',
            )}
            dangerouslySetInnerHTML={{ __html: block.body_html }}
          />
        </article>

        <nav
          className="mt-8 flex flex-col gap-2 sm:mt-10 sm:flex-row sm:flex-wrap sm:gap-3"
          aria-label="Diğer yasal sayfalar"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border/50 bg-muted/25 px-4 py-2.5 text-center text-sm font-medium text-primary transition-colors hover:border-primary/30 hover:bg-muted/50 active:bg-muted/70"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-transparent bg-primary/10 px-4 py-2.5 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/15 active:bg-primary/20"
          >
            Giriş
          </Link>
        </nav>
      </div>
    </div>
  );
}
