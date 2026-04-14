'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { useAuth } from '@/hooks/use-auth';

function VerifyByCodePanel() {
  const { token, me, refetchMe } = useAuth();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  if (!token || me?.school_join_stage !== 'email_pending') return null;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    if (code.replace(/\s/g, '').length !== 6) {
      setErr('6 haneli kodu girin.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/verify-school-join', {
        method: 'POST',
        body: JSON.stringify({ code: code.replace(/\s/g, '') }),
        token,
      });
      await refetchMe();
      setMsg('Kurumsal e-posta doğrulandı. Okul onayını bekleyebilirsiniz.');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Hata');
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mt-6 rounded-xl border border-border bg-muted/30 p-4">
      <h2 className="text-sm font-semibold">Veya kodu buradan girin</h2>
      <p className="mt-1 text-xs text-muted-foreground">Panele giriş yaptıysanız e-postadaki 6 haneli kodu yazın.</p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <input
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-center font-mono tracking-widest sm:max-w-[10rem]"
          placeholder="000000"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {loading ? '…' : 'Doğrula'}
        </button>
      </form>
      {err && <Alert message={err} className="mt-2 text-xs" />}
      {msg && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">{msg}</p>}
    </div>
  );
}

function VerifyInner() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token')?.trim() ?? '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('idle');
      setMessage('');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    apiFetch<{ ok: boolean; already_verified?: boolean }>('/auth/verify-school-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
      credentials: 'include',
    })
      .then((r) => {
        if (cancelled) return;
        setStatus('ok');
        setMessage(
          r.already_verified
            ? 'E-posta adresiniz zaten doğrulanmış. Okul yöneticisi onayını bekleyebilirsiniz.'
            : 'Kurumsal e-postanız doğrulandı. Okul yöneticisi onayından sonra tam erişim sağlanır.',
        );
      })
      .catch((e) => {
        if (cancelled) return;
        setStatus('err');
        setMessage(e instanceof Error ? e.message : 'Doğrulama başarısız.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <h1 className="text-lg font-semibold text-foreground">Kurumsal e-posta doğrulama</h1>
        {token ? (
          <>
            {status === 'loading' && (
              <div className="mt-6 flex items-center gap-2 text-muted-foreground">
                <LoadingDots />
                <span className="text-sm">İşleniyor…</span>
              </div>
            )}
            {status === 'ok' && <p className="mt-4 text-sm text-foreground leading-relaxed">{message}</p>}
            {status === 'err' && <Alert message={message || 'Hata'} className="mt-4" />}
          </>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            E-postadaki bağlantı geçerli değil veya süresi dolmuş olabilir. Giriş yapıp aşağıdan kodu girebilir veya profilden «Yeniden gönder» kullanabilirsiniz.
          </p>
        )}
        <VerifyByCodePanel />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/login" className="text-sm font-medium text-primary hover:underline">
            Giriş yap
          </Link>
          <Link href="/dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Panele git
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifySchoolEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <LoadingDots />
        </div>
      }
    >
      <VerifyInner />
    </Suspense>
  );
}
