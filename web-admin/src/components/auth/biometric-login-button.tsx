'use client';

import { useEffect, useState } from 'react';
import { Fingerprint } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type AuthPortal,
  fetchWebAuthnSupported,
  getRememberedLoginEmail,
  hasPasskeyForEmail,
  loginWithPasskey,
  rememberLoginEmail,
} from '@/lib/webauthn';
import { getWebAuthnErrorMessage } from '@/lib/webauthn-error-message';
import { LoadingDots } from '@/components/ui/loading-spinner';

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
  const [supported, setSupported] = useState(false);
  const [hasPasskey, setHasPasskey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await fetchWebAuthnSupported();
      if (cancelled) return;
      setSupported(ok);
      if (!ok) {
        setChecking(false);
        return;
      }
      const remembered = getRememberedLoginEmail();
      const probe = email.trim() || remembered;
      if (probe) {
        const avail = await hasPasskeyForEmail(probe, portal);
        if (!cancelled) setHasPasskey(avail);
      }
      if (!cancelled) setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [email, portal]);

  useEffect(() => {
    if (!supported || !email.trim()) return;
    let cancelled = false;
    hasPasskeyForEmail(email, portal).then((avail) => {
      if (!cancelled) setHasPasskey(avail);
    });
    return () => {
      cancelled = true;
    };
  }, [email, portal, supported]);

  const run = async () => {
    const e = email.trim() || getRememberedLoginEmail();
    if (!e) {
      onError('Önce e-posta adresinizi girin.');
      return;
    }
    setLoading(true);
    onError('');
    try {
      const { token } = await loginWithPasskey(e, portal, rememberMe);
      rememberLoginEmail(e);
      await onSuccess(token);
    } catch (err) {
      onError(getWebAuthnErrorMessage(err, 'login'));
    } finally {
      setLoading(false);
    }
  };

  if (!supported || checking || !hasPasskey) return null;

  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={() => void run()}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50 sm:rounded-xl sm:py-3',
        className,
      )}
    >
      {loading ? (
        <LoadingDots className="size-4" />
      ) : (
        <Fingerprint className="size-4 shrink-0" aria-hidden />
      )}
      Parmak izi veya yüz ile giriş
    </button>
  );
}
