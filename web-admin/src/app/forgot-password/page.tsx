'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Info, Mail } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthPortalHub } from '@/components/auth/auth-portal-hub';
import { AuthFlowSubnav } from '@/components/auth/auth-flow-subnav';
import { AuthCard } from '@/components/auth/auth-card';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { AuthCompactDetails } from '@/components/auth/auth-compact-details';

type ForgotResponse = { ok: boolean; message: string };

const inputClass =
  'h-11 w-full rounded-xl border border-input bg-background px-3 py-2 pl-10 text-sm text-foreground placeholder:text-muted-foreground/75 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-violet-500/20';

function ForgotPasswordContent() {
  const searchParams = useSearchParams();
  const q = searchParams?.toString() || undefined;
  const loginHub = q ? `/login?${q}` : '/login';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'email' | 'reset'>('email');

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const e1 = email.trim().toLowerCase();
    if (!e1) {
      setError('E-posta adresi girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<ForgotResponse>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: e1 }),
      });
      if (res.ok === false) {
        setError(res.message ?? 'Kod gönderilemedi.');
        return;
      }
      setSuccess(res.message ?? 'Doğrulama kodu gönderildi.');
      setPhase('reset');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const e1 = email.trim().toLowerCase();
    if (code.replace(/\s/g, '').length !== 6) {
      setError('6 haneli kodu girin.');
      return;
    }
    if (newPassword.length < 8 || newPassword !== confirm) {
      setError('Şifre 8+ karakter ve tekrar eşleşmeli.');
      return;
    }
    if (!/^(?=.*\p{L})(?=.*\d).{8,128}$/u.test(newPassword)) {
      setError('Şifre harf ve rakam içermeli.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/reset-password-code', {
        method: 'POST',
        body: JSON.stringify({
          email: e1,
          code: code.replace(/\s/g, ''),
          new_password: newPassword,
        }),
      });
      setSuccess('Şifre güncellendi. Giriş yapabilirsiniz.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sıfırlama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    const e1 = email.trim().toLowerCase();
    if (!e1) return;
    setLoading(true);
    try {
      await apiFetch('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: e1, purpose: 'forgot_password' }),
      });
      setSuccess('Yeni kod gönderildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell eyebrow="Şifre sıfırlama">
      <AuthPortalHub flow="forgot" redirectQuery={q} />
      <AuthFlowSubnav flow="forgot" role="teacher" redirectQuery={q} />
      <AuthCard className="shadow-[0_24px_64px_-16px_rgba(99,102,241,0.1)] ring-violet-500/10 dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]">
        <CardHeader className="space-y-2 border-b border-border/50 bg-linear-to-br from-violet-500/5 to-transparent px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {phase === 'email' ? 'Şifremi unuttum' : 'Yeni şifre'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {phase === 'email' ? 'Kayıtlı e-postanıza 6 haneli kod gönderilir.' : `${email} — kodu girin`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          {phase === 'email' ? (
            <form onSubmit={handleEmail} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-foreground">
                  E-posta <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
                  <input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@posta.com"
                    autoComplete="email"
                    disabled={loading}
                    className={cn(inputClass, 'disabled:opacity-60')}
                  />
                </div>
              </div>
              {error && <Alert message={error} />}
              {success && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
                  {success}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50"
              >
                {loading ? <LoadingDots className="text-primary-foreground" /> : 'Kod gönder'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Doğrulama kodu</label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={cn(inputClass, 'pl-3 text-center font-mono text-lg tracking-widest')}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Yeni şifre</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  disabled={loading}
                  minLength={8}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Yeni şifre tekrar</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className={inputClass}
                  disabled={loading}
                />
              </div>
              {error && <Alert message={error} />}
              {success && (
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100">
                  {success}{' '}
                  <Link href={loginHub} className="font-semibold text-violet-700 underline dark:text-violet-300">
                    Giriş
                  </Link>
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full justify-center rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50"
              >
                {loading ? <LoadingDots className="text-primary-foreground" /> : 'Şifreyi sıfırla'}
              </button>
              <button type="button" onClick={resend} className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400">
                Kodu yeniden gönder
              </button>
            </form>
          )}

          <AuthCompactDetails
            className="rounded-xl border-border/50"
            icon={<Info className="size-3.5" strokeWidth={2} aria-hidden />}
            title="Not"
          >
            Sosyal girişle oluşturulan hesaplarda şifre sıfırlama yoktur; Google / Apple ile giriş yapın.
          </AuthCompactDetails>

          <p className="text-center text-sm text-muted-foreground">
            <Link href={loginHub} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
              Girişe dön
            </Link>
          </p>
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
      <ForgotPasswordContent />
    </Suspense>
  );
}
