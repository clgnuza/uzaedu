'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, AUTH_WRONG_PORTAL_TEACHER_LOGIN, isApiErrorCode } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, LogIn, Building2 } from 'lucide-react';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthFlowSubnav } from '@/components/auth/auth-flow-subnav';
import { cn } from '@/lib/utils';
import { getPostLoginRedirect } from '@/lib/post-login-redirect';

type AuthResponse = { token: string };
type OtpPurposeSchool = 'login_school' | 'register_school';
type LoginStepResponse =
  | AuthResponse
  | { needs_verification_code: true; email: string; otp_purpose: OtpPurposeSchool };

const inputBase =
  'h-11 w-full rounded-xl border border-input bg-background px-3 py-2 pl-10 text-sm text-foreground placeholder:text-muted-foreground/70 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-amber-500/25';

function SchoolLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectQuery = searchParams?.get('redirect') ?? null;
  const { setToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpPhase, setOtpPhase] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<OtpPurposeSchool>('login_school');
  const navQ = searchParams?.toString() || undefined;
  const regHref = navQ ? `/register/okul?${navQ}` : '/register/okul';
  const teacherLoginHref = navQ ? `/login/ogretmen?${navQ}` : '/login/ogretmen';
  const [fromTeacherBanner, setFromTeacherBanner] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    const wp = searchParams?.get('wrong_portal');
    if (wp !== 'from_teacher') return;
    setFromTeacherBanner(true);
    const p = new URLSearchParams(searchParams!.toString());
    p.delete('wrong_portal');
    const q = p.toString();
    router.replace(q ? `/login/okul?${q}` : '/login/okul', { scroll: false });
  }, [searchParams, router]);

  const setTokenAndRedirect = async (token: string) => {
    await setToken(token);
    router.push(getPostLoginRedirect(redirectQuery));
    router.refresh();
  };

  const doLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const e1 = email.trim().toLowerCase();
    if (!e1 || !password) {
      setError('E-posta ve şifre gerekli.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<LoginStepResponse>('/auth/school/login', {
        method: 'POST',
        body: JSON.stringify({ email: e1, password, remember_me: rememberMe }),
      });
      if ('needs_verification_code' in res && res.needs_verification_code) {
        setPendingEmail(res.email);
        setOtpPurpose(res.otp_purpose);
        setOtpPhase(true);
        setOtpCode('');
        toast.success('Kurumsal e-postanıza kod gönderildi.');
        return;
      }
      if ('token' in res && res.token) {
        await setTokenAndRedirect(res.token);
      }
    } catch (err) {
      if (isApiErrorCode(err, AUTH_WRONG_PORTAL_TEACHER_LOGIN)) {
        const msg = err instanceof Error ? err.message : 'Yönlendiriliyorsunuz.';
        toast.error(msg);
        const next = teacherLoginHref.includes('?')
          ? `${teacherLoginHref}&wrong_portal=from_school`
          : `${teacherLoginHref}?wrong_portal=from_school`;
        router.replace(next);
        setLoading(false);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Giriş yapılamadı.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const e1 = pendingEmail || email.trim().toLowerCase();
    if (!e1 || otpCode.replace(/\s/g, '').length !== 6) {
      setError('6 haneli kodu girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/auth/school/login-verify', {
        method: 'POST',
        body: JSON.stringify({ email: e1, code: otpCode.replace(/\s/g, ''), remember_me: rememberMe }),
      });
      await setTokenAndRedirect(res.token);
    } catch (err) {
      if (isApiErrorCode(err, AUTH_WRONG_PORTAL_TEACHER_LOGIN)) {
        const msg = err instanceof Error ? err.message : 'Yönlendiriliyorsunuz.';
        toast.error(msg);
        const next = teacherLoginHref.includes('?')
          ? `${teacherLoginHref}&wrong_portal=from_school`
          : `${teacherLoginHref}?wrong_portal=from_school`;
        router.replace(next);
        setLoading(false);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Kod doğrulanamadı.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    const e1 = pendingEmail || email.trim().toLowerCase();
    if (!e1) return;
    setLoading(true);
    try {
      await apiFetch('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: e1, purpose: otpPurpose }),
      });
      toast.success('Kod yeniden gönderildi.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthFlowSubnav flow="login" role="school" redirectQuery={navQ} gateForgot />
      <div className="mx-auto w-full max-w-md px-0">
        <AuthCard className="shadow-[0_24px_64px_-16px_rgba(245,158,11,0.12)] ring-amber-500/15 dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]">
          <CardHeader className="space-y-2 border-b border-border/50 bg-linear-to-br from-amber-500/8 to-transparent px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
            <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
              {otpPhase ? 'Kurumsal doğrulama' : 'Okul yöneticisi girişi'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {otpPhase ? pendingEmail : 'Kurumsal e-posta ve şifre; ardından 6 haneli kod.'}
            </p>
            {!otpPhase && (
              <Link
                href={regHref}
                className="inline-block text-sm font-semibold text-amber-700 hover:underline dark:text-amber-300"
              >
                İlk kayıt (kurum kodu) →
              </Link>
            )}
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground sm:text-sm">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-3.5 rounded border border-input accent-amber-600 sm:size-4"
              />
              Beni hatırla (bu cihazda uzun oturum)
            </label>
            {fromTeacherBanner && (
              <Alert
                message="Öğretmen giriş sayfasından yönlendirildiniz. Bu hesap okul yöneticisi — kurumsal e-posta ve şifre ile buradan giriş yapın."
                className="text-[11px] leading-snug"
              />
            )}
            <div className="flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/25">
              <Building2 className="size-4 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={2} />
              <p className="text-muted-foreground">
                Öğretmen hesabı:{' '}
                <Link href={teacherLoginHref} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
                  öğretmen girişi
                </Link>
              </p>
            </div>
            {otpPhase ? (
              <form onSubmit={submitOtp} className="space-y-3">
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className={cn(inputBase, 'pl-3 text-center font-mono text-lg tracking-widest')}
                  disabled={loading}
                />
                {error && <Alert message={error} className="text-[11px]" />}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-amber-600 to-orange-600 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {loading ? <LoadingDots className="text-primary-foreground" /> : 'Oturum aç'}
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={resendOtp} className="text-[11px] font-medium text-primary hover:underline">
                    Kodu yeniden gönder
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpPhase(false);
                      setOtpCode('');
                      setError('');
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Geri
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={doLogin} className="space-y-3">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mudur@okul.k12.tr"
                    autoComplete="username"
                    disabled={loading}
                    className={cn(inputBase, 'disabled:opacity-60')}
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    disabled={loading}
                    className={cn(inputBase, 'pr-11 disabled:opacity-60')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground"
                    aria-label="Şifre"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {error && <Alert message={error} className="text-[11px]" />}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-amber-600 to-orange-600 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 disabled:opacity-50"
                >
                  {loading ? <LoadingDots className="text-primary-foreground" /> : <><LogIn className="size-4" /> Devam (kod gönder)</>}
                </button>
              </form>
            )}
            <p className="text-center text-sm text-muted-foreground">
              <Link href={teacherLoginHref} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
                Öğretmen girişi
              </Link>
            </p>
          </CardContent>
        </AuthCard>
      </div>
    </AuthPageShell>
  );
}

export default function SchoolLoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center"><LoadingDots /></div>}>
      <SchoolLoginForm />
    </Suspense>
  );
}
