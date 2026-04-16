'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { KeyRound, Lock } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthCard } from '@/components/auth/auth-card';
import { CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ResetResponse = { ok: boolean };

const inputClass =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 pl-8 text-[13px] text-foreground placeholder:text-muted-foreground/75 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 sm:rounded-lg sm:px-2.5 sm:py-2 sm:pl-9 sm:text-sm';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Geçersiz sıfırlama bağlantısı. Lütfen şifre unuttum sayfasından tekrar talep edin.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError('Yeni şifre 8–128 karakter arasında olmalıdır.');
      return;
    }
    if (!/^(?=.*\p{L})(?=.*\d).{8,128}$/u.test(newPassword)) {
      setError('Şifre en az bir harf ve bir rakam içermelidir.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch<ResetResponse>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="space-y-2 sm:space-y-2.5">
        <div
          role="status"
          className="rounded-md border border-emerald-500/45 bg-emerald-500/10 px-2 py-1.5 text-[10px] leading-snug text-emerald-900 dark:text-emerald-100 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-[11px]"
        >
          Şifreniz güncellendi. Giriş yapabilirsiniz.
        </div>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-md bg-primary px-2.5 py-1.5 text-center text-[13px] font-semibold text-primary-foreground shadow-md shadow-primary/15 hover:opacity-95 sm:rounded-lg sm:py-2 sm:text-sm"
        >
          Girişe git
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-2">
        <Alert
          message="Geçersiz veya eksik sıfırlama bağlantısı. Şifre unuttum sayfasından tekrar talep edin."
          className="px-2 py-1.5 text-[10px] leading-snug sm:text-[11px]"
        />
        <Link
          href="/forgot-password/ogretmen"
          className="block text-center text-[10px] font-semibold text-primary hover:underline sm:text-[11px]"
        >
          Şifre unuttum
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
      <div>
        <label htmlFor="new-password" className="mb-0.5 block text-[10px] font-medium text-foreground sm:text-[11px]">
          Yeni şifre <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <Lock
            className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/70 sm:left-2.5 sm:size-3.5"
            aria-hidden
          />
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="8+ karakter, harf ve rakam"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            className={cn(inputClass)}
          />
        </div>
      </div>
      <div>
        <label
          htmlFor="confirm-password"
          className="mb-0.5 block text-[10px] font-medium text-foreground sm:text-[11px]"
        >
          Tekrar <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/70 sm:left-2.5 sm:size-3.5"
            aria-hidden
          />
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Şifreyi tekrar"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            className={cn(inputClass)}
          />
        </div>
      </div>
      {error && (
        <Alert message={error} className="px-2 py-1.5 text-[10px] leading-snug [&_svg]:size-3.5 sm:text-[11px]" />
      )}
      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="flex w-full items-center justify-center rounded-md bg-primary px-2.5 py-1.5 text-[13px] font-semibold text-primary-foreground shadow-md shadow-primary/15 transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm"
      >
        {loading ? <LoadingDots className="text-primary-foreground" /> : 'Şifreyi kaydet'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthPageShell compact eyebrow="Yeni şifre">
      <AuthCard className="rounded-xl sm:rounded-2xl">
        <CardHeader className="space-y-0 px-2.5 pb-1 pt-2 sm:px-4 sm:pb-1.5 sm:pt-3">
          <h2 className="text-[0.8125rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[0.9375rem]">
            Şifreyi belirle
          </h2>
          <p className="text-[9px] leading-snug text-muted-foreground sm:text-[11px]">
            8–128 karakter; en az bir harf ve bir rakam.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 px-2.5 pb-2.5 pt-0 sm:px-4 sm:pb-3">
          <Suspense fallback={<LoadingDots />}>
            <ResetPasswordForm />
          </Suspense>
          <p className="pt-0 text-center text-[9px] text-muted-foreground sm:text-[10px]">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Girişe dön
            </Link>
          </p>
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}
