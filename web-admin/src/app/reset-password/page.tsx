'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { LoadingDots } from '@/components/ui/loading-spinner';

type ResetResponse = { ok: boolean };

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
      <div className="space-y-6">
        <div className="rounded-lg border border-green-500/50 bg-green-500/10 px-4 py-3 text-sm text-green-800 dark:text-green-200">
          Şifreniz başarıyla güncellendi. Giriş yapabilirsiniz.
        </div>
        <Link
          href="/login"
          className="block w-full rounded-lg bg-primary px-4 py-2.5 text-center font-medium text-primary-foreground hover:opacity-90"
        >
          Giriş sayfasına git
        </Link>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="space-y-6">
        <Alert message="Geçersiz veya eksik sıfırlama bağlantısı. Lütfen şifre unuttum sayfasından tekrar talep edin." />
        <Link href="/forgot-password" className="font-medium text-primary hover:underline">
          Şifre unuttum sayfasına git
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
          Yeni şifre <span className="text-destructive">*</span>
        </label>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="8–128 karakter; harf ve rakam"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
          Yeni şifre (tekrar) <span className="text-destructive">*</span>
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Şifreyi tekrar girin"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
      </div>
      {error && <Alert message={error} />}
      <button
        type="submit"
        disabled={loading}
        aria-busy={loading}
        className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? <LoadingDots /> : 'Şifremi güncelle'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen w-full">
      <div className="hidden w-1/2 flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div>
          <Link
            href="/"
            className="inline-block rounded-lg outline-none transition-opacity hover:opacity-95 focus-visible:ring-2 focus-visible:ring-primary-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
          >
            <h1 className="text-2xl font-bold tracking-tight">Öğretmen Pro</h1>
            <p className="mt-1 text-sm opacity-90">Web Admin</p>
          </Link>
        </div>
        <div className="space-y-4">
          <p className="text-lg font-medium">Yeni şifre belirleyin</p>
          <p className="text-sm opacity-90">
            E-posta bağlantısından gelen token ile yeni şifrenizi girin.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-background px-4 py-10 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link
              href="/"
              className="inline-block rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              <h1 className="text-2xl font-bold text-foreground">Öğretmen Pro</h1>
              <p className="text-sm text-muted-foreground">Web Admin</p>
            </Link>
          </div>

          <h2 className="text-xl font-semibold text-foreground">Şifre sıfırlama</h2>
          <p className="mt-1 mb-6 text-sm text-muted-foreground">
            Yeni şifrenizi girin (8–128 karakter; en az bir harf ve bir rakam).
          </p>

          <Suspense fallback={<LoadingDots />}>
            <ResetPasswordForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-primary hover:underline">
              ← Giriş sayfasına dön
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
