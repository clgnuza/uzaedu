'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, AUTH_WRONG_PORTAL_SCHOOL_LOGIN, isApiErrorCode } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import {
  isFirebaseConfigured,
  isFirebasePhoneAuthConfigured,
  signInWithGoogle,
  signInWithApple,
  startPhoneVerification,
  formatFirebaseAuthError,
} from '@/lib/firebase';
import { toast } from 'sonner';
import { Mail, Lock, Eye, EyeOff, LogIn, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthCompactDetails } from '@/components/auth/auth-compact-details';
import { ForgotPasswordGateDialog } from '@/components/auth/forgot-password-gate-dialog';
import { cn } from '@/lib/utils';

const RECAPTCHA_ID = 'recaptcha-phone';

type AuthResponse = { token: string };
type OtpPurposeTeacher = 'login_teacher' | 'register_teacher';
type LoginStepResponse =
  | AuthResponse
  | { needs_verification_code: true; email: string; otp_purpose: OtpPurposeTeacher };

const inputBase =
  'w-full rounded-lg border border-input bg-background px-3 py-2 pl-10 text-sm text-foreground placeholder:text-muted-foreground/70 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:rounded-xl sm:py-2.5';

export function TeacherLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/dashboard';
  const regQuery = searchParams?.toString();
  const registerHref = regQuery ? `/register/ogretmen?${regQuery}` : '/register/ogretmen';
  const forgotHref = regQuery ? `/forgot-password/ogretmen?${regQuery}` : '/forgot-password/ogretmen';
  const schoolLoginHref = regQuery ? `/login/okul?${regQuery}` : '/login/okul';
  const { setToken } = useAuth();
  const [fromSchoolBanner, setFromSchoolBanner] = useState(false);

  useEffect(() => {
    if (searchParams?.get('wrong_portal') !== 'from_school') return;
    setFromSchoolBanner(true);
    const p = new URLSearchParams(searchParams.toString());
    p.delete('wrong_portal');
    const q = p.toString();
    router.replace(q ? `/login/ogretmen?${q}` : '/login/ogretmen', { scroll: false });
  }, [searchParams, router]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phoneStep, setPhoneStep] = useState<'idle' | 'code'>('idle');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneConfirm, setPhoneConfirm] = useState<{ confirm: (code: string) => Promise<string> } | null>(null);
  const [expandedAlt, setExpandedAlt] = useState(false);
  const [forgotGateOpen, setForgotGateOpen] = useState(false);
  const [otpPhase, setOtpPhase] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpPurpose, setOtpPurpose] = useState<OtpPurposeTeacher>('login_teacher');

  const setTokenAndRedirect = async (token: string) => {
    await setToken(token);
    const target = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
    router.push(target);
    router.refresh();
  };

  const doFirebaseToken = async (idToken: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch<AuthResponse>('/auth/firebase-token', {
        method: 'POST',
        body: JSON.stringify({ id_token: idToken }),
      });
      await setTokenAndRedirect(res.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sosyal giriş yapılamadı.');
      toast.error(err instanceof Error ? err.message : 'Sosyal giriş yapılamadı.');
    } finally {
      setLoading(false);
    }
  };

  const doLogin = async (e: React.FormEvent, useEmail?: string, usePassword?: string) => {
    e.preventDefault();
    setError('');
    const e1 = (useEmail ?? email).trim().toLowerCase();
    const p1 = usePassword ?? password;
    if (!e1 || !p1) {
      setError('E-posta ve şifre gerekli.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<LoginStepResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: e1, password: p1 }),
      });
      if ('needs_verification_code' in res && res.needs_verification_code) {
        setPendingEmail(res.email);
        setOtpPurpose(res.otp_purpose);
        setOtpPhase(true);
        setOtpCode('');
        toast.success('E-postanıza 6 haneli kod gönderildi.');
        return;
      }
      if ('token' in res && res.token) {
        await setTokenAndRedirect(res.token);
      }
    } catch (err) {
      if (isApiErrorCode(err, AUTH_WRONG_PORTAL_SCHOOL_LOGIN)) {
        const msg = err instanceof Error ? err.message : 'Yönlendiriliyorsunuz.';
        toast.error(msg);
        const next = schoolLoginHref.includes('?')
          ? `${schoolLoginHref}&wrong_portal=from_teacher`
          : `${schoolLoginHref}?wrong_portal=from_teacher`;
        router.replace(next);
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
      const res = await apiFetch<AuthResponse>('/auth/teacher/login-verify', {
        method: 'POST',
        body: JSON.stringify({ email: e1, code: otpCode.replace(/\s/g, '') }),
      });
      await setTokenAndRedirect(res.token);
    } catch (err) {
      if (isApiErrorCode(err, AUTH_WRONG_PORTAL_SCHOOL_LOGIN)) {
        const msg = err instanceof Error ? err.message : 'Yönlendiriliyorsunuz.';
        toast.error(msg);
        const next = schoolLoginHref.includes('?')
          ? `${schoolLoginHref}&wrong_portal=from_teacher`
          : `${schoolLoginHref}?wrong_portal=from_teacher`;
        router.replace(next);
        return;
      }
      const msg = err instanceof Error ? err.message : 'Kod doğrulanamadı.';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const resendTeacherOtp = async () => {
    const e1 = pendingEmail || email.trim().toLowerCase();
    if (!e1) return;
    setError('');
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

  const onGoogle = async () => {
    if (!isFirebaseConfigured()) {
      toast.error('Google girişi için Firebase yapılandırılmalı.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      await doFirebaseToken(idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google ile giriş yapılamadı.');
      toast.error(err instanceof Error ? err.message : 'Google ile giriş yapılamadı.');
      setLoading(false);
    }
  };

  const onApple = async () => {
    if (!isFirebaseConfigured()) {
      toast.error('Apple girişi için Firebase yapılandırılmalı.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const idToken = await signInWithApple();
      await doFirebaseToken(idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apple ile giriş yapılamadı.');
      setLoading(false);
    }
  };

  const onPhoneSendCode = async () => {
    if (!isFirebaseConfigured()) {
      toast.error('Telefon girişi için Firebase yapılandırılmalı.');
      return;
    }
    const normalized = phoneNumber.trim().replace(/^0/, '+90');
    if (!normalized || normalized.length < 10) {
      setError('Geçerli bir telefon numarası girin (örn. 5XX XXX XX XX).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const confirmFn = await startPhoneVerification(RECAPTCHA_ID, normalized.startsWith('+') ? normalized : `+90${normalized}`);
      setPhoneConfirm(() => confirmFn);
      setPhoneStep('code');
      toast.success('Doğrulama kodu SMS ile gönderildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod gönderilemedi.');
      toast.error(err instanceof Error ? err.message : 'Kod gönderilemedi.');
    } finally {
      setLoading(false);
    }
  };

  const onPhoneConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneConfirm || !phoneCode.trim()) return;
    setError('');
    setLoading(true);
    try {
      const idToken = await phoneConfirm.confirm(phoneCode.trim());
      await doFirebaseToken(idToken);
    } catch (err) {
      const msg = formatFirebaseAuthError(err);
      setError(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const firebaseReady = isFirebaseConfigured();
  const phoneAuthReady = firebaseReady && isFirebasePhoneAuthConfigured();
  const hasAltOptions = firebaseReady || true;

  return (
    <AuthCard className="shadow-[0_24px_64px_-16px_rgba(99,102,241,0.12)] ring-violet-500/10 dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]">
            <CardHeader className="space-y-2 border-b border-border/50 bg-linear-to-br from-violet-500/5 to-transparent px-4 pb-4 pt-4 sm:px-6 sm:pb-5 sm:pt-5">
              <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                {otpPhase ? 'Doğrulama kodu' : 'Öğretmen girişi'}
              </h2>
              <p className="text-sm text-muted-foreground">
                {otpPhase ? (
                  <span className="font-medium text-foreground">{pendingEmail}</span>
                ) : (
                  'Şifre sonrası e-postanıza 6 haneli kod gelir. İsterseniz Google, Apple veya SMS kullanın.'
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4 px-4 pb-5 pt-4 sm:space-y-5 sm:px-6 sm:pb-6 sm:pt-5">
              {fromSchoolBanner && (
                <Alert
                  message="Okul yöneticisi giriş sayfasından yönlendirildiniz. Öğretmen hesabınızla bu sayfada giriş yapın."
                  className="px-2.5 py-2 text-[11px] leading-snug [&_svg]:size-4"
                />
              )}
              {otpPhase ? (
                <form onSubmit={submitOtp} className="space-y-3 sm:space-y-4">
                  <div>
                    <label htmlFor="otp" className="mb-1 block text-[10px] font-medium text-foreground sm:text-[11px]">
                      Doğrulama kodu
                    </label>
                    <input
                      id="otp"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      disabled={loading}
                      className={cn(inputBase, 'pl-3 text-center font-mono text-lg tracking-widest disabled:opacity-60')}
                    />
                  </div>
                  {error && <Alert message={error} className="px-2.5 py-2 text-[11px] leading-snug [&_svg]:size-4" />}
                  <button
                    type="submit"
                    disabled={loading}
                    className={cn(
                      'flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 px-3 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 sm:px-4',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                  >
                    {loading ? <LoadingDots className="text-primary-foreground" /> : 'Oturum aç'}
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={resendTeacherOtp}
                      disabled={loading}
                      className="text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
                    >
                      Kodu yeniden gönder
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOtpPhase(false);
                        setOtpCode('');
                        setError('');
                      }}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      Geri
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={(e) => doLogin(e)} className="space-y-4">
                  <div className="relative">
                    <label htmlFor="email" className="sr-only">E-posta</label>
                    <Mail className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Kayıtlı e-posta adresiniz"
                      autoComplete="username"
                      disabled={loading}
                      className={cn(inputBase, 'h-11 rounded-xl disabled:opacity-60')}
                    />
                  </div>
                  <div className="relative">
                    <label htmlFor="password" className="sr-only">Şifre</label>
                    <Lock className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading}
                      className={cn(inputBase, 'h-11 rounded-xl pr-11 disabled:opacity-60')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setForgotGateOpen(true)}
                      className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
                    >
                      Şifremi unuttum
                    </button>
                  </div>
                  <ForgotPasswordGateDialog
                    open={forgotGateOpen}
                    onOpenChange={setForgotGateOpen}
                    continueHref={forgotHref}
                    role="teacher"
                  />
                  {error && <Alert message={error} className="px-2.5 py-2 text-[11px] leading-snug [&_svg]:size-4" />}
                  <button
                    type="submit"
                    disabled={loading}
                    aria-busy={loading}
                    className={cn(
                      'flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white shadow-lg shadow-violet-500/25 transition-all',
                      'hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-2',
                      'disabled:cursor-not-allowed disabled:opacity-60',
                    )}
                  >
                    {loading ? (
                      <LoadingDots className="text-primary-foreground" />
                    ) : (
                      <>
                        <LogIn className="size-4" aria-hidden />
                        Devam (kod gönder)
                      </>
                    )}
                  </button>
                </form>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Hesabınız yok mu?{' '}
                <Link href={registerHref} className="font-semibold text-violet-600 hover:underline dark:text-violet-400">
                  Öğretmen kaydı
                </Link>
              </p>

              {hasAltOptions && (
                <div className="border-t border-border/60 pt-4">
                  <button
                    type="button"
                    onClick={() => setExpandedAlt((v) => !v)}
                    className="flex w-full items-center justify-between rounded-xl py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>Sosyal · SMS</span>
                    {expandedAlt ? <ChevronUp className="size-3.5 sm:size-4" /> : <ChevronDown className="size-3.5 sm:size-4" />}
                  </button>
                  {expandedAlt && (
                    <div className="mt-1.5 space-y-2 opacity-100 transition-opacity duration-200 sm:mt-2 sm:space-y-3">
                      {firebaseReady ? (
                        <div className="flex flex-col gap-1.5 sm:gap-2">
                            <button
                              type="button"
                              onClick={onGoogle}
                              disabled={loading}
                              className="flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                            >
                              <svg className="size-4 shrink-0 sm:size-5" viewBox="0 0 24 24" aria-hidden>
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                              </svg>
                              Google ile giriş
                            </button>
                            <button
                              type="button"
                              onClick={onApple}
                              disabled={loading}
                              className="flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                            >
                              <svg className="size-4 shrink-0 sm:size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                              </svg>
                              Apple ile giriş
                            </button>
                            {!phoneAuthReady ? (
                              <AuthCompactDetails
                                icon={<Info className="size-3.5" strokeWidth={2} aria-hidden />}
                                title="SMS için .env (Firebase)"
                                className="border-amber-200/50 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/20"
                              >
                                <code className="rounded bg-background/70 px-0.5">NEXT_PUBLIC_FIREBASE_APP_ID</code>,{' '}
                                <code className="rounded bg-background/70 px-0.5">NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</code> — web-admin{' '}
                                <code className="rounded bg-background/70 px-0.5">.env.local</code>; Firebase Console → Genel.
                              </AuthCompactDetails>
                            ) : phoneStep === 'idle' ? (
                              <div className="space-y-1.5">
                                <div className="flex gap-1.5 sm:gap-2">
                                  <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="5XX XXX XX XX"
                                    disabled={loading}
                                    className={cn(inputBase, 'flex-1 pl-3 sm:pl-4')}
                                  />
                                  <button
                                    type="button"
                                    onClick={onPhoneSendCode}
                                    disabled={loading}
                                    className="shrink-0 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-3 sm:py-2 sm:text-xs"
                                  >
                                    Kod
                                  </button>
                                </div>
                                <AuthCompactDetails
                                  icon={<Info className="size-3.5" strokeWidth={2} aria-hidden />}
                                  title="Kod ve güvenlik kutusu"
                                >
                                  Önce &quot;Kod&quot;; altta çıkan kutuyu işaretleyin, sonra SMS gelir.
                                </AuthCompactDetails>
                                <div
                                  id={RECAPTCHA_ID}
                                  className="flex min-h-[64px] w-full justify-center overflow-x-auto rounded-lg border border-border/60 bg-muted/15 py-1.5 sm:min-h-[78px] sm:py-2 dark:bg-muted/25"
                                />
                              </div>
                            ) : (
                              <form onSubmit={onPhoneConfirm} className="flex gap-2">
                                <input
                                  type="text"
                                  value={phoneCode}
                                  onChange={(e) => setPhoneCode(e.target.value)}
                                  placeholder="SMS kodu"
                                  maxLength={6}
                                  className={cn(inputBase, 'flex-1 pl-4')}
                                />
                                <button
                                  type="submit"
                                  disabled={loading || !phoneCode.trim()}
                                  className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Giriş
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setPhoneStep('idle'); setPhoneConfirm(null); setPhoneCode(''); }}
                                  className="shrink-0 rounded-xl border border-border px-2 py-2 text-xs text-muted-foreground hover:bg-muted"
                                >
                                  İptal
                                </button>
                              </form>
                            )}
                        </div>
                      ) : (
                        <AuthCompactDetails
                          icon={<Info className="size-3.5" strokeWidth={2} aria-hidden />}
                          title="Sosyal giriş için Firebase"
                        >
                          E-posta + şifre her zaman kullanılabilir.
                        </AuthCompactDetails>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
    </AuthCard>
  );
}
