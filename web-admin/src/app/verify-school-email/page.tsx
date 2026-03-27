'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { LoadingDots } from '@/components/ui/loading-spinner';

function VerifyInner() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token')?.trim() ?? '';
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('err');
      setMessage('Geçersiz bağlantı.');
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
            : 'Kurumsal e-postanız doğrulandı. Okul yöneticisi onayından sonra tam erişim ve e-posta ile giriş açılır.',
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
        <h1 className="text-lg font-semibold text-foreground">E-posta doğrulama</h1>
        {status === 'loading' && (
          <div className="mt-6 flex items-center gap-2 text-muted-foreground">
            <LoadingDots />
            <span className="text-sm">İşleniyor…</span>
          </div>
        )}
        {status === 'ok' && <p className="mt-4 text-sm text-foreground leading-relaxed">{message}</p>}
        {status === 'err' && <Alert message={message || 'Hata'} className="mt-4" />}
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
