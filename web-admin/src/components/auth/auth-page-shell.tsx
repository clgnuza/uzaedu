import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { CookiePreferencesLink } from '@/components/cookie-preferences-link';

type AuthPageShellProps = {
  children: React.ReactNode;
  /** Ana başlık altı kısa metin */
  eyebrow?: string;
};

const footerLinks = [
  { href: '/gizlilik', label: 'Gizlilik' },
  { href: '/kullanim-sartlari', label: 'Şartlar' },
  { href: '/cerez', label: 'Çerez politikası' },
] as const;

export function AuthPageShell({ children, eyebrow = 'Web Admin' }: AuthPageShellProps) {
  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden supports-[min-height:100dvh]:min-h-dvh">
      <div
        className="pointer-events-none absolute inset-0 bg-linear-to-b from-primary/[0.07] via-muted/25 to-background dark:from-primary/10 dark:via-zinc-950 dark:to-zinc-950"
        aria-hidden
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-5 flex flex-col items-center text-center sm:mb-6">
          <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-1 ring-primary/20">
            <GraduationCap className="size-6" aria-hidden />
          </div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">Öğretmen Pro</h1>
        </header>

        <div className="mx-auto w-full max-w-[360px]">{children}</div>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground sm:mt-10">
          {footerLinks.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-foreground transition-colors">
              {l.label}
            </Link>
          ))}
          <CookiePreferencesLink className="hover:text-foreground transition-colors" />
        </footer>
      </div>
    </div>
  );
}
