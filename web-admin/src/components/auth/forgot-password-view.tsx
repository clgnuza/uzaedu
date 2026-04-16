'use client';

import { useState } from 'react';
import Link from 'next/link';
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

type ForgotResponse = { ok: boolean; message: string; code?: string };

export type ForgotPasswordRole = 'teacher' | 'school';

const teacherInput =
  'h-11 w-full rounded-xl border border-input bg-background px-3 py-2 pl-10 text-sm text-foreground placeholder:text-muted-foreground/75 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-violet-500/20';
const schoolInput =
  'h-11 w-full rounded-xl border border-input bg-background px-3 py-2 pl-10 text-sm text-foreground placeholder:text-muted-foreground/75 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-amber-500/25';

export function ForgotPasswordView({ role, redirectQuery }: { role: ForgotPasswordRole; redirectQuery?: string }) {
  const q = redirectQuery;
  const loginReturnHref =
    role === 'school' ? (q ? `/login/okul?${q}` : '/login/okul') : q ? `/login/ogretmen?${q}` : '/login/ogretmen';

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<'email' | 'reset'>('email');
  const [socialOnly, setSocialOnly] = useState(false);
  const [socialMessage, setSocialMessage] = useState<string | null>(null);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSocialOnly(false);
    setSocialMessage(null);
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
      if (res.code === 'SOCIAL_AUTH_ONLY' || (!res.ok && /sosyal/i.test(res.message ?? ''))) {
        setSocialOnly(true);
        setSocialMessage(res.message ?? null);
        setError('');
        return;
      }
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

  const isSchool = role === 'school';
  const inputClass = isSchool ? schoolInput : teacherInput;
  const cardClass = isSchool
    ? 'shadow-[0_24px_64px_-16px_rgba(245,158,11,0.12)] ring-amber-500/15 dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]'
    : 'shadow-[0_24px_64px_-16px_rgba(99,102,241,0.1)] ring-violet-500/10 dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]';
  const headerBg = isSchool
    ? 'border-b border-border/50 bg-linear-to-br from-amber-500/8 to-transparent'
    : 'border-b border-border/50 bg-linear-to-br from-violet-500/5 to-transparent';
  const primaryBtn = isSchool
    ? 'flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-amber-600 to-orange-600 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 disabled:opacity-50'
    : 'flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50';
  const secondaryLink = isSchool
    ? 'font-semibold text-amber-700 underline dark:text-amber-300'
    : 'font-semibold text-violet-700 underline dark:text-violet-300';
  const footerLink = isSchool
    ? 'font-semibold text-amber-700 hover:underline dark:text-amber-300'
    : 'font-semibold text-violet-600 hover:underline dark:text-violet-400';
  const resendBtn = isSchool
    ? 'text-sm font-medium text-amber-700 hover:underline dark:text-amber-300'
    : 'text-sm font-medium text-violet-600 hover:underline dark:text-violet-400';

  const bannerClass = isSchool
    ? 'rounded-xl border border-amber-300/80 bg-amber-50/90 px-3 py-2.5 text-xs leading-relaxed text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100 sm:px-4 sm:text-sm'
    : 'rounded-xl border border-violet-300/80 bg-violet-50/90 px-3 py-2.5 text-xs leading-relaxed text-violet-950 dark:border-violet-800/60 dark:bg-violet-950/35 dark:text-violet-100 sm:px-4 sm:text-sm';

  return (
    <AuthPageShell eyebrow="Şifre sıfırlama">
      <AuthPortalHub flow="forgot" redirectQuery={q} />
      <AuthFlowSubnav flow="forgot" role={isSchool ? 'school' : 'teacher'} redirectQuery={q} />
      <p className={cn('mx-auto mb-3 max-w-md px-0', bannerClass)}>
        <strong className="font-semibold text-foreground">Önemli:</strong> Google / Apple / SMS ile kayıtlı hesaplarda e-posta şifresi
        yoktur; şifre sıfırlama uygulanmaz. Yalnızca e-posta ve şifre ile oluşturduğunuz hesaplar için aşağıdaki adımlar geçerlidir.
      </p>
      <AuthCard className={cardClass}>
        <CardHeader className={cn('space-y-2 px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5', headerBg)}>
          <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {socialOnly ? 'Sosyal / şifresiz hesap' : phase === 'email' ? 'Şifremi unuttum' : 'Yeni şifre'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {socialOnly
              ? 'Bu e-posta şifre sıfırlamaya uygun değil.'
              : phase === 'email'
                ? 'Kayıtlı e-postanıza 6 haneli kod gönderilir.'
                : `${email} — kodu girin`}
          </p>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          {socialOnly ? (
            <div className="space-y-4">
              <div
                className={cn(
                  'rounded-xl border px-3 py-3 text-sm leading-relaxed sm:px-4',
                  isSchool
                    ? 'border-amber-400/70 bg-amber-500/10 text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-50'
                    : 'border-violet-400/70 bg-violet-500/10 text-violet-950 dark:border-violet-700/50 dark:bg-violet-950/40 dark:text-violet-50',
                )}
              >
                {socialMessage ?? (
                  <>
                    Bu hesap sosyal giriş veya şifresiz kayıt ile oluşturulmuş olabilir. Şifre sıfırlanmaz; giriş sayfasında{' '}
                    {isSchool ? (
                      <>kurumsal e-posta ve şifre ile veya size tanımlı giriş yöntemini kullanın.</>
                    ) : (
                      <>Google, Apple veya SMS ile oturum açın.</>
                    )}
                  </>
                )}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                <Link href={loginReturnHref} className={footerLink}>
                  Girişe dön
                </Link>
              </p>
            </div>
          ) : phase === 'email' ? (
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
                    placeholder={isSchool ? 'mudur@okul.k12.tr' : 'ornek@posta.com'}
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
              <button type="submit" disabled={loading} className={primaryBtn}>
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
                  <Link href={loginReturnHref} className={secondaryLink}>
                    Giriş
                  </Link>
                </div>
              )}
              <button type="submit" disabled={loading} className={primaryBtn}>
                {loading ? <LoadingDots className="text-primary-foreground" /> : 'Şifreyi sıfırla'}
              </button>
              <button type="button" onClick={resend} className={resendBtn}>
                Kodu yeniden gönder
              </button>
            </form>
          )}

          {!socialOnly && (
            <AuthCompactDetails
              className="rounded-xl border-border/50"
              icon={<Info className="size-3.5" strokeWidth={2} aria-hidden />}
              title="Not"
            >
              Sosyal girişle oluşturulan hesaplarda şifre sıfırlama yoktur; Google / Apple ile giriş yapın.
            </AuthCompactDetails>
          )}

          {!socialOnly && (
            <p className="text-center text-sm text-muted-foreground">
              <Link href={loginReturnHref} className={footerLink}>
                Girişe dön
              </Link>
            </p>
          )}
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}
