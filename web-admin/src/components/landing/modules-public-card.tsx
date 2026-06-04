import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { LandingModuleSeo } from '@/lib/landing-modules-seo';
import { moduleMetaDescription, modulePublicPath } from '@/lib/landing-modules-seo';
import { cn } from '@/lib/utils';

export type ModuleAccent = 'crimson' | 'violet' | 'amber';

const ACCENTS: ModuleAccent[] = ['crimson', 'violet', 'amber'];

export function moduleAccentForSlug(slug: string): ModuleAccent {
  let n = 0;
  for (let i = 0; i < slug.length; i++) n += slug.charCodeAt(i);
  return ACCENTS[n % ACCENTS.length]!;
}

export function ModulesPublicGridCard({ module, accent }: { module: LandingModuleSeo; accent: ModuleAccent }) {
  const Icon = module.icon;
  const path = modulePublicPath(module);

  return (
    <li className="flex min-h-[148px]">
      <Link
        href={path}
        className={cn('modules-public-card group flex w-full flex-col', `modules-public-card--${accent}`)}
      >
        <div className="modules-public-card-inner flex flex-1 flex-col p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="modules-public-card-icon flex size-11 shrink-0 items-center justify-center rounded-xl">
              <Icon className="size-5" strokeWidth={1.65} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold leading-snug text-zinc-50 sm:text-[17px]">{module.label}</h2>
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-zinc-400">
                {moduleMetaDescription(module)}
              </p>
            </div>
          </div>
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {module.tags.slice(0, 2).map((tag) => (
              <li key={tag} className="modules-public-tag">
                <Sparkles className="size-2.5 shrink-0 opacity-80" aria-hidden />
                {tag}
              </li>
            ))}
          </ul>
          <span className="modules-public-card-cta mt-auto pt-4 text-xs font-semibold text-zinc-200">
            Modülü incele
            <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </Link>
    </li>
  );
}
