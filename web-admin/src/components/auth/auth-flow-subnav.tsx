'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { ForgotPasswordGateDialog } from '@/components/auth/forgot-password-gate-dialog';

type Flow = 'login' | 'register' | 'forgot';
type Role = 'teacher' | 'school';

function suffix(role: Role) {
  return role === 'teacher' ? '/ogretmen' : '/okul';
}

export function AuthFlowSubnav({
  flow,
  role,
  redirectQuery,
  gateForgot,
}: {
  flow: Flow;
  role: Role;
  redirectQuery?: string;
  /** Giriş/kayıtta "Şifremi unuttum" sekmesinde önce uyarı diyaloğu */
  gateForgot?: boolean;
}) {
  const [forgotGateOpen, setForgotGateOpen] = useState(false);
  const q = redirectQuery?.startsWith('?') ? redirectQuery : redirectQuery ? `?${redirectQuery}` : '';
  const baseLogin = `/login${suffix(role)}${q}`;
  const baseReg = `/register${suffix(role)}${q}`;
  const forgot = `/forgot-password${suffix(role)}${q}`;
  const hub = flow === 'login' ? `/login${q}` : flow === 'register' ? `/register${q}` : `/login${q}`;

  const items: { key: Flow; label: string; labelSm: string; href: string }[] = [
    { key: 'login', label: 'Giriş', labelSm: 'Giriş', href: baseLogin },
    { key: 'register', label: 'Kayıt', labelSm: 'Kayıt', href: baseReg },
    { key: 'forgot', label: 'Şifremi unuttum', labelSm: 'Şifre', href: forgot },
  ];

  const roleLabel = role === 'teacher' ? 'Öğretmen' : 'Okul yön.';
  const otherHref =
    flow === 'login'
      ? `/login${suffix(role === 'teacher' ? 'school' : 'teacher')}${q}`
      : flow === 'register'
        ? `/register${suffix(role === 'teacher' ? 'school' : 'teacher')}${q}`
        : `/login${suffix(role === 'teacher' ? 'school' : 'teacher')}${q}`;
  const otherLabel = role === 'teacher' ? 'Okul sayfası' : 'Öğretmen sayfası';

  const activeTeacher =
    'bg-linear-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30 ring-0 dark:from-violet-500 dark:to-indigo-500';
  const activeSchool =
    'bg-linear-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25 ring-0 dark:from-amber-500 dark:to-orange-600';
  const activeClass = role === 'teacher' ? activeTeacher : activeSchool;

  const tabClass = (active: boolean) =>
    cn(
      'flex min-h-9 flex-1 items-center justify-center rounded-xl px-1 py-1.5 text-center text-[10px] font-bold leading-tight transition sm:min-h-10 sm:px-2 sm:py-2 sm:text-xs',
      active
        ? activeClass
        : cn(
            'text-muted-foreground hover:bg-background/80 hover:text-foreground',
            role === 'teacher' ? 'active:bg-violet-500/5' : 'active:bg-amber-500/5',
          ),
    );

  return (
    <div className="mb-3 space-y-2 sm:mb-5 sm:space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <Link
          href={hub}
          className="inline-flex items-center text-[10px] font-semibold text-muted-foreground transition hover:text-foreground sm:text-xs"
        >
          ← Rol
        </Link>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:px-3 sm:py-1 sm:text-[10px]',
            role === 'teacher'
              ? 'bg-violet-500/20 text-violet-800 ring-1 ring-violet-500/30 dark:text-violet-200'
              : 'bg-amber-500/20 text-amber-900 ring-1 ring-amber-500/35 dark:text-amber-200',
          )}
        >
          {roleLabel}
        </span>
      </div>
      <nav
        className={cn(
          'flex gap-0.5 rounded-2xl border border-border/60 p-0.5 shadow-inner sm:gap-1 sm:p-1',
          role === 'teacher'
            ? 'bg-violet-500/10 dark:bg-violet-950/40'
            : 'bg-amber-500/10 dark:bg-amber-950/35',
        )}
        aria-label="Hesap adımları"
      >
        {items.map((it) => {
          const active = flow === it.key;
          if (gateForgot && it.key === 'forgot' && flow !== 'forgot') {
            return (
              <button
                key={it.key}
                type="button"
                onClick={() => setForgotGateOpen(true)}
                className={tabClass(active)}
              >
                <span className="max-sm:sr-only">{it.label}</span>
                <span className="sm:hidden">{it.labelSm}</span>
              </button>
            );
          }
          return (
            <Link key={it.key} href={it.href} className={tabClass(active)}>
              <span className="max-sm:sr-only">{it.label}</span>
              <span className="sm:hidden">{it.labelSm}</span>
            </Link>
          );
        })}
      </nav>
      {gateForgot && (
        <ForgotPasswordGateDialog
          open={forgotGateOpen}
          onOpenChange={setForgotGateOpen}
          continueHref={forgot}
          role={role}
        />
      )}
      <p className="text-center text-[10px] text-muted-foreground sm:text-[11px]">
        <Link
          href={otherHref}
          className={cn(
            'font-bold underline-offset-2 hover:underline',
            role === 'teacher' ? 'text-amber-600 dark:text-amber-400' : 'text-violet-600 dark:text-violet-400',
          )}
        >
          {otherLabel}
        </Link>
      </p>
    </div>
  );
}
