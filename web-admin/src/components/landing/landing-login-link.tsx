'use client';

import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { AuthTransitionLink } from '@/components/landing/auth-transition-link';
import { useAuth } from '@/hooks/use-auth';

const className =
  'flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-950/70 px-3 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur-sm transition hover:border-zinc-600 hover:text-white sm:px-4 sm:py-2';

export function LandingLoginLink() {
  const { me, loading } = useAuth();
  if (me && !loading) {
    return (
      <Link href="/dashboard" className={className}>
        <LogIn className="size-3.5" strokeWidth={2} />
        Giriş
      </Link>
    );
  }
  return (
    <AuthTransitionLink href="/login" className={className}>
      <LogIn className="size-3.5" strokeWidth={2} />
      Giriş
    </AuthTransitionLink>
  );
}
