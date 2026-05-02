import Link from 'next/link';
import { ArrowLeft, Shield, Lock, BookOpen, Cookie, FileText, Scale } from 'lucide-react';
import type { LegalPageContent } from '@/components/web-settings/legal-pages-types';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';
import { cn } from '@/lib/utils';

export function LegalPageLoadError() {
  return (
    <div
      className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-16"
      style={{ background: 'linear-gradient(160deg,#0d1e3f 0%,#0f2a52 55%,#0b2244 100%)' }}
    >
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute -left-24 top-0 size-96 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(59,130,246,0.15) 0%,transparent 65%)' }} />
        <div className="absolute -right-24 bottom-0 size-80 rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.12) 0%,transparent 65%)' }} />
      </div>
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-md">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10">
          <Shield className="size-7 text-blue-300" />
        </div>
        <h2 className="mb-2 text-lg font-bold text-white">İçerik Yüklenemedi</h2>
        <p className="mb-6 text-sm text-white/55">Lütfen daha sonra tekrar deneyin.</p>
        <a
          href="/login"
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-500 px-5 text-sm font-semibold text-white transition hover:bg-blue-400"
        >
          Giriş Sayfasına Dön
        </a>
      </div>
    </div>
  );
}

function resolvePageMeta(title: string): {
  icon: typeof Shield;
  color: string;
  badge: string;
} {
  const t = title.toLowerCase();
  if (t.includes('kvkk') || t.includes('kişisel')) {
    return { icon: Lock,    color: 'text-violet-400', badge: 'bg-violet-500/20 border-violet-400/30 text-violet-200' };
  }
  if (t.includes('gizlilik')) {
    return { icon: Shield,  color: 'text-blue-400',   badge: 'bg-blue-500/20 border-blue-400/30 text-blue-200' };
  }
  if (t.includes('cerez') || t.includes('çerez')) {
    return { icon: Cookie,  color: 'text-amber-400',  badge: 'bg-amber-500/20 border-amber-400/30 text-amber-200' };
  }
  if (t.includes('kullanım') || t.includes('şart')) {
    return { icon: Scale,   color: 'text-emerald-400',badge: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200' };
  }
  return   { icon: FileText,color: 'text-sky-400',    badge: 'bg-sky-500/20 border-sky-400/30 text-sky-200' };
}

const SITE_NAV = [
  { href: '/gizlilik',          label: 'Gizlilik Politikası',    icon: Shield  },
  { href: '/kullanim-sartlari', label: 'Kullanım Şartları',  icon: Scale   },
  { href: '/cerez',             label: 'Çerez Politikası',   icon: Cookie  },
];

const TRUST_ITEMS = [
  { emoji: '🔒', label: 'Şifreli Bağlantı', sub: 'SSL ile korunur'     },
  { emoji: '🇹🇷', label: 'Yerli Yazılım',   sub: 'Türkiye\'de geliştirildi' },
  { emoji: '📋', label: 'KVKK Bildirimi',   sub: 'Veri işleme bilgisi' },
  { emoji: '📄', label: 'Platform Belgesi', sub: 'Kullanım politikası'  },
];

export function LegalPublicPageView({
  block,
  links,
}: {
  block: LegalPageContent;
  links: { href: string; label: string }[];
}) {
  const updated = block.updated_at
    ? new Date(block.updated_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });

  const meta = resolvePageMeta(block.title ?? '');
  const PageIcon = meta.icon;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden">

      {/* ── Hero ─ koyu lacivert ── */}
      <div
        className="relative overflow-hidden pb-14 pt-5 sm:pb-20 sm:pt-8"
        style={{ background: 'linear-gradient(160deg,#0d1e3f 0%,#0f2a52 58%,#0b2244 100%)' }}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.022) 1px,transparent 1px)',
              backgroundSize: '36px 36px',
            }}
          />
          <div className="absolute -left-20 top-0 size-80 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(59,130,246,0.16) 0%,transparent 65%)' }} />
          <div className="absolute -right-16 bottom-0 size-64 rounded-full"
            style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.12) 0%,transparent 65%)' }} />
          <div className="absolute inset-x-0 top-0 h-px"
            style={{ background: 'linear-gradient(90deg,transparent,rgba(59,130,246,0.5),rgba(139,92,246,0.4),transparent)' }} />
        </div>

        <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
          {/* Geri + logo */}
          <div className="mb-5 flex items-center justify-between sm:mb-8">
            <a
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-[12px] font-medium text-white/70 backdrop-blur-sm transition hover:bg-white/14 hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              Girişe Dön
            </a>
            <Link href="/" className="text-[11px] font-bold tracking-tight text-white/50 transition hover:text-white/80">
              Uzaedu<span className="text-blue-400"> Öğretmen</span>
            </Link>
          </div>

          {/* İkon + başlık */}
          <div className="flex flex-col items-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl border border-white/15 bg-white/10 shadow-lg backdrop-blur-sm sm:size-14">
              <PageIcon className={cn('size-6 sm:size-7', meta.color)} />
            </div>
            <span className={cn(
              'mb-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest',
              meta.badge,
            )}>
              Bilgilendirme Belgesi
            </span>
            <h1 className="text-lg font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
              {block.title}
            </h1>
            <p className="mt-2 text-[11px] text-white/45">Son güncelleme: {updated}</p>
          </div>

          {/* Güven rozetleri */}
          <div className="mt-5 grid grid-cols-4 gap-1.5 sm:gap-2">
            {TRUST_ITEMS.map((t) => (
              <div
                key={t.label}
                className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/6 px-2 py-2 text-center backdrop-blur-sm sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-left"
              >
                <span className="text-base leading-none sm:text-lg">{t.emoji}</span>
                <div className="min-w-0 hidden sm:block">
                  <p className="text-[10px] font-bold leading-tight text-white/85">{t.label}</p>
                  <p className="text-[9px] leading-tight text-white/40">{t.sub}</p>
                </div>
                <p className="sm:hidden text-[9px] font-semibold leading-tight text-white/70">{t.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── İçerik kartı ─ hero üstüne taşıyor ── */}
      <div className="relative mx-auto -mt-8 max-w-3xl px-3 pb-10 sm:-mt-10 sm:px-6 sm:pb-16">
        <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl dark:border-slate-700/60 dark:bg-slate-950">

          {/* Üst şerit */}
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-900 sm:px-5 sm:py-3.5">
            <PageIcon className="size-4 shrink-0 text-slate-400 dark:text-slate-500" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">{block.title}</span>
            <span className="ml-auto inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {updated}
            </span>
          </div>

          {/* HTML içeriği */}
          <div
            className={cn(
              'legal-html-content not-prose px-4 py-5 sm:px-8 sm:py-8',
              'text-[13px] leading-relaxed text-slate-600 dark:text-slate-400 sm:text-[15px] sm:leading-[1.7]',
              '[&_h2]:mt-5 [&_h2]:scroll-mt-24 [&_h2]:border-b [&_h2]:border-slate-100 [&_h2]:pb-1.5 [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-slate-800 dark:[&_h2]:border-slate-800 dark:[&_h2]:text-slate-100',
              'sm:[&_h2]:mt-8 sm:[&_h2]:text-base md:[&_h2]:text-lg',
              '[&_h2:first-child]:mt-0',
              '[&_h3]:mt-6 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-700 dark:[&_h3]:text-slate-200 sm:[&_h3]:text-base',
              '[&_p]:mt-3.5 [&_p]:text-pretty [&_p]:first:mt-0',
              '[&_strong]:font-semibold [&_strong]:text-slate-800 dark:[&_strong]:text-slate-100',
              '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5',
              '[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5',
              '[&_li]:text-pretty',
              '[&_a]:text-blue-600 [&_a]:underline [&_a]:underline-offset-2 [&_a]:transition hover:[&_a]:text-blue-500 dark:[&_a]:text-blue-400',
              '[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-blue-400/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-slate-500',
            )}
            dangerouslySetInnerHTML={{ __html: block.body_html }}
          />

          {/* Alt navigasyon */}
          <div className="border-t border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 sm:px-5 sm:py-4">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Diğer Politikalar & Tercihler
            </p>
            <nav className="flex flex-wrap gap-2" aria-label="Diğer yasal sayfalar">
              {links.map((l) => {
                const navItem = SITE_NAV.find((n) => n.href === l.href);
                const NIcon = navItem?.icon ?? FileText;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 shadow-sm transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-blue-500/40 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
                  >
                    <NIcon className="size-3.5 shrink-0 opacity-70" />
                    {l.label}
                  </Link>
                );
              })}
              <CookiePreferencesLink className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700 shadow-sm transition hover:bg-amber-100 dark:border-amber-700/40 dark:bg-amber-900/20 dark:text-amber-300">
                <Cookie className="size-3.5 shrink-0 opacity-70" />
                Çerez Tercihleri
              </CookiePreferencesLink>
              <Link
                href="/iletisim"
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 dark:border-blue-700/40 dark:bg-blue-900/20 dark:text-blue-300"
              >
                <BookOpen className="size-3.5 shrink-0 opacity-70" />
                İletişim
              </Link>
            </nav>
          </div>
        </article>

        {/* Alt bilgi */}
        <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-600">
          &copy; {new Date().getFullYear()} Uzaedu Öğretmen &middot; UzaMobil Yazılım &middot; Tüm hakları saklıdır
        </p>
      </div>
    </div>
  );
}
