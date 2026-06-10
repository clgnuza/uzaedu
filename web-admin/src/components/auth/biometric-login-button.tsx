'use client';

import { useEffect, useMemo, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type AuthPortal,
  clearPasskeyHint,
  fetchWebAuthnSupported,
  getRememberedLoginEmail,
  hasPasskeyForEmail,
  hasPasskeyHint,
  isWebAuthnAvailable,
  loginWithPasskey,
  rememberLoginEmail,
  setPasskeyHint,
} from '@/lib/webauthn';
import { getWebAuthnErrorMessage } from '@/lib/webauthn-error-message';
import { LoadingDots } from '@/components/ui/loading-spinner';

function probeEmail(email: string): string {
  return email.trim() || getRememberedLoginEmail();
}

export function BiometricLoginButton({
  portal,
  email,
  rememberMe,
  disabled,
  onSuccess,
  onError,
  className,
}: {
  portal: AuthPortal;
  email: string;
  rememberMe?: boolean;
  disabled?: boolean;
  onSuccess: (token: string) => void | Promise<void>;
  onError: (message: string) => void;
  className?: string;
}) {
  const resolvedEmail = useMemo(() => probeEmail(email), [email]);
  const optimistic = useMemo(
    () => isWebAuthnAvailable() && !!resolvedEmail && hasPasskeyHint(portal, resolvedEmail),
    [portal, resolvedEmail],
  );

  const [supported, setSupported] = useState(() => isWebAuthnAvailable());
  const [hasPasskey, setHasPasskey] = useState(optimistic);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(() => isWebAuthnAvailable() && !optimistic);

  useEffect(() => {
    if (!isWebAuthnAvailable()) {
      setSupported(false);
      setHasPasskey(false);
      setChecking(false);
      return;
    }

    const e = probeEmail(email);
    const hinted = !!e && hasPasskeyHint(portal, e);
    if (hinted) {
      setHasPasskey(true);
      setChecking(false);
    } else {
      setHasPasskey(false);
      setChecking(true);
    }

    let cancelled = false;
    void (async () => {
      const [srvSupported, avail] = await Promise.all([
        fetchWebAuthnSupported(),
        e ? hasPasskeyForEmail(e, portal) : Promise.resolve(false),
      ]);
      if (cancelled) return;
      setSupported(srvSupported);
      const ok = srvSupported && avail;
      setHasPasskey(ok);
      if (ok && e) setPasskeyHint(portal, e);
      else if (e && hinted && !avail) clearPasskeyHint(portal);
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [email, portal]);

  const run = async () => {
    const e = probeEmail(email);
    if (!e) {
      onError('Önce e-posta adresinizi girin.');
      return;
    }
    setLoading(true);
    onError('');
    try {
      const { token } = await loginWithPasskey(e, portal, rememberMe);
      rememberLoginEmail(e);
      setPasskeyHint(portal, e);
      await onSuccess(token);
    } catch (err) {
      onError(getWebAuthnErrorMessage(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return null;

  if (checking && !hasPasskey) {
    return <div className={cn('h-12 w-full rounded-xl bg-muted/40 animate-pulse', className)} aria-hidden />;
  }

  if (!hasPasskey) return null;

  return (
    <button
      type="button"
      disabled={disabled || loading || checking}
      onClick={() => void run()}
      className={cn(
        'flex w-full items-center justify-center gap-2.5 rounded-xl border-2 px-4 py-3.5',
        'border-emerald-500/70 bg-emerald-500/15 text-sm font-semibold text-emerald-900',
        'shadow-md shadow-emerald-500/15 ring-1 ring-emerald-500/25',
        'transition-all hover:border-emerald-500 hover:bg-emerald-500/25 hover:shadow-lg',
        'active:scale-[0.99] disabled:opacity-60',
        'dark:border-emerald-400/60 dark:bg-emerald-500/20 dark:text-emerald-50',
        className,
      )}
    >
      {loading ? (
        <LoadingDots className="size-5" />
      ) : (
        <Fingerprint className="size-5 shrink-0" aria-hidden />
      )}
      Parmak izi veya yüz ile giriş
    </button>
  );
}
