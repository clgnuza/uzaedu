import Link from 'next/link';
import { ArrowRight, LogIn, Sparkles } from 'lucide-react';
import {
  LANDING_MODULES_SEO,
  type LandingModuleSeo,
} from '@/lib/landing-modules-seo';
import { AuthTransitionLink } from '@/components/landing/auth-transition-link';
import {
  moduleAccentForSlug,
  ModulesPublicGridCard,
} from '@/components/landing/modules-public-card';
import { ModulesPublicHero, ModulesPublicShell } from '@/components/landing/modules-public-shell';
import { cn } from '@/lib/utils';

export function ModulePublicPage({ module }: { module: LandingModuleSeo }) {
  const Icon = module.icon;
  const accent = moduleAccentForSlug(module.slug);
  const others = LANDING_MODULES_SEO.filter((m) => m.slug !== module.slug).slice(0, 4);

  return (
    <ModulesPublicShell showAllModulesLink>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <div className={cn('modules-public-detail-hero', `modules-public-card--${accent}`)}>
          <div className="modules-public-detail-hero-inner">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <span className="modules-public-card-icon modules-public-detail-icon flex size-16 shrink-0 items-center justify-center rounded-2xl sm:size-[4.5rem]">
                <Icon className="size-8 sm:size-9" strokeWidth={1.55} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-red-300/90">
                  Uzaedu Öğretmen modülü
                </p>
                <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.65rem)] font-bold leading-tight tracking-tight text-zinc-50">
                  {module.label}
                </h1>
                <p className="mt-4 text-base leading-relaxed text-zinc-200 sm:text-lg">{module.description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="modules-public-panel mt-6 sm:mt-8">
          <p className="text-[15px] leading-relaxed text-zinc-300">{module.detail}</p>

          <ul className="mt-6 flex flex-wrap gap-2">
            {module.tags.map((tag) => (
              <li key={tag} className="modules-public-tag modules-public-tag--lg">
                <Sparkles className="size-3.5 shrink-0 text-fuchsia-300/80" aria-hidden />
                {tag}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3 border-t border-zinc-800/80 pt-8">
            <AuthTransitionLink
              href={module.href}
              className="modules-public-btn-primary inline-flex items-center gap-2"
            >
              <LogIn className="size-4" aria-hidden />
              Modüle giriş yap
              <ArrowRight className="size-4" aria-hidden />
            </AuthTransitionLink>
            <Link href="/register" className="modules-public-btn-secondary inline-flex items-center">
              Ücretsiz kayıt
            </Link>
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-12 sm:mt-14" aria-labelledby="related-modules-heading">
            <h2 id="related-modules-heading" className="text-sm font-bold uppercase tracking-[0.18em] text-zinc-500">
              Diğer modüller
            </h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {others.map((m) => (
                <ModulesPublicGridCard
                  key={m.slug}
                  module={m}
                  accent={moduleAccentForSlug(m.slug)}
                />
              ))}
            </ul>
          </section>
        )}
      </main>
    </ModulesPublicShell>
  );
}
