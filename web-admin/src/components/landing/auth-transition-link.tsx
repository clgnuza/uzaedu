'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useEffect, useState, type ComponentProps } from 'react';
import { createPortal } from 'react-dom';

/** Navigasyon, overlay ile çakışsın; uzun bekleme yok */
const NAV_MS = 120;

function isAuthHref(href: ComponentProps<typeof Link>['href']): href is string {
  if (typeof href !== 'string') return false;
  return (
    href === '/login' ||
    href.startsWith('/login?') ||
    href === '/register' ||
    href.startsWith('/register?')
  );
}

function AuthNavOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-200 will-change-[opacity,transform]"
      style={{
        background:
          'radial-gradient(ellipse 80% 58% at 50% 44%, rgba(153,27,27,0.38) 0%, rgba(0,0,0,0.82) 58%, rgba(0,0,0,0.94) 100%)',
        animation: 'landing-auth-overlay 0.22s cubic-bezier(0.33, 1, 0.68, 1) forwards',
      }}
      aria-hidden
    />
  );
}

export function AuthTransitionLink({
  href,
  onClick,
  ...rest
}: ComponentProps<typeof Link>) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => setMounted(true), []);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      if (!isAuthHref(href)) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
      e.preventDefault();
      setPending(true);
      window.setTimeout(() => {
        startTransition(() => {
          router.push(href);
        });
      }, NAV_MS);
    },
    [href, onClick, router],
  );

  return (
    <>
      {mounted && pending && createPortal(<AuthNavOverlay />, document.body)}
      <Link href={href} onClick={handleClick} {...rest} />
    </>
  );
}
