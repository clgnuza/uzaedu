'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch, isApiErrorCode } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import {
  isFirebaseConfigured,
  isFirebasePhoneAuthConfigured,
  signInWithGoogle,
  signInWithApple,
  startPhoneVerification,
  normalizePhoneE164Turkey,
  formatFirebaseAuthError,
} from '@/lib/firebase';
import { toast } from 'sonner';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  Building2,
  ArrowRight,
  Info,
} from 'lucide-react';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthCard } from '@/components/auth/auth-card';
import { AuthCompactDetails } from '@/components/auth/auth-compact-details';
import { cn } from '@/lib/utils';

const RECAPTCHA_ID = 'recaptcha-phone';

type AuthResponse = { token: string };

const inputBase =
  'w-full rounded-lg border border-input bg-background px-3 py-2 pl-10 text-sm text-foreground placeholder:text-muted-foreground/70 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:rounded-xl sm:py-2.5';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams?.get('redirect') || '/dashboard';
  const { setToken } = useAuth();
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
  /** Okul / öğretmen bilgi kartları: yalnızca ilgili ikona tıklanınca açılır */
  const [openRoleHint, setOpenRoleHint] = useState<'school' | 'teacher' | null>(null);

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
      const res = await apiFetch<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: e1, password: p1 }),
      });
      await setTokenAndRedirect(res.token);
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'Giriş yapılamadı.';
      if (isApiErrorCode(err, 'TEACHER_PASSWORD_LOGIN_PENDING_SCHOOL_APPROVAL')) {
        msg = 'Onay beklenirken e-posta girişi kapalı. Sosyal veya SMS kullanın.';
        setExpandedAlt(true);
      }
      setError(msg);
      toast.error(msg);
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
    <AuthPageShell>
      <div className="mx-auto w-full max-w-md px-0">
          <AuthCard>
            <CardHeader className="space-y-0.5 px-3 pb-1.5 pt-2.5 sm:px-5 sm:pb-2 sm:pt-3.5">
              <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground sm:text-base">E-posta ile giriş</h2>
              <p className="text-[10px] text-muted-foreground sm:text-xs">E-posta ve şifre</p>
            </CardHeader>
            <CardContent className="space-y-2.5 px-3 pb-3 pt-0 sm:space-y-3 sm:px-5 sm:pb-4">
              <div className="grid gap-1.5">
                <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">Rol — dokun</p>
                <div className="flex gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenRoleHint((v) => (v === 'school' ? null : 'school'))}
                    aria-expanded={openRoleHint === 'school'}
                    aria-controls="login-hint-school"
                    className={cn(
                      'flex flex-1 flex-col items-center gap-1 rounded-xl border p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/40 sm:gap-1.5 sm:rounded-2xl sm:p-3',
                      openRoleHint === 'school'
                        ? 'border-amber-400 bg-amber-50/80 dark:border-amber-600 dark:bg-amber-950/40'
                        : 'border-border bg-muted/30 hover:bg-muted/50 dark:hover:bg-muted/40',
                    )}
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 sm:size-11 sm:rounded-xl dark:text-amber-200">
                      <Building2 className="size-[18px] sm:size-[20px]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="text-center text-[10px] font-semibold leading-tight text-foreground sm:text-[11px]">Okul yön.</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenRoleHint((v) => (v === 'teacher' ? null : 'teacher'))}
                    aria-expanded={openRoleHint === 'teacher'}
                    aria-controls="login-hint-teacher"
                    className={cn(
                      'flex flex-1 flex-col items-center gap-1 rounded-xl border p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500/40 sm:gap-1.5 sm:rounded-2xl sm:p-3',
                      openRoleHint === 'teacher'
                        ? 'border-violet-400 bg-violet-50/80 dark:border-violet-600 dark:bg-violet-950/40'
                        : 'border-border bg-muted/30 hover:bg-muted/50 dark:hover:bg-muted/40',
                    )}
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-violet-500/12 text-violet-800 sm:size-11 sm:rounded-xl dark:text-violet-200">
                      <GraduationCap className="size-[18px] sm:size-[20px]" strokeWidth={2} aria-hidden />
                    </span>
                    <span className="text-center text-[10px] font-semibold leading-tight text-foreground sm:text-[11px]">Öğretmen</span>
                  </button>
                </div>

                {openRoleHint === 'school' && (
                  <div
                    id="login-hint-school"
                    role="region"
                    aria-label="Okul yöneticisi bilgisi"
                    className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-2.5 dark:border-amber-900/50 dark:bg-amber-950/25"
                  >
                    <div className="flex gap-2">
                      <Building2 className="size-4 shrink-0 text-amber-700 dark:text-amber-300" strokeWidth={2} aria-hidden />
                      <p className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                        Kurumsal e-posta; okul alan adıyla uyumlu olmalı.
                      </p>
                    </div>
                  </div>
                )}

                {openRoleHint === 'teacher' && (
                  <div
                    id="login-hint-teacher"
                    role="region"
                    aria-label="Öğretmen bilgisi"
                    className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-2.5 dark:border-violet-900/45 dark:bg-violet-950/25"
                  >
                    <div className="flex gap-2">
                      <GraduationCap className="size-4 shrink-0 text-violet-700 dark:text-violet-300" strokeWidth={2} aria-hidden />
                      <div className="min-w-0 space-y-1">
                        <p className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
                          E-posta + şifre yeterli. Onay beklerken sosyal veya SMS kullanın.
                        </p>
                        <Link
                          href="/register"
                          className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary hover:underline sm:text-[11px]"
                        >
                          Kayıt <ArrowRight className="size-3" aria-hidden />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={(e) => doLogin(e)} className="space-y-3 sm:space-y-4">
                <div className="relative">
                  <label htmlFor="email" className="sr-only">E-posta</label>
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Kayıtlı e-posta adresiniz"
                    autoComplete="username"
                    disabled={loading}
                    className={cn(inputBase, 'disabled:opacity-60')}
                  />
                </div>
                <div className="relative">
                  <label htmlFor="password" className="sr-only">Şifre</label>
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden />
                  <input
                    id="password"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-xs font-medium text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 rounded"
                  >
                    Şifremi unuttum
                  </Link>
                </div>
                {error && <Alert message={error} className="px-2.5 py-2 text-[11px] leading-snug [&_svg]:size-4" />}
                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading}
                  className={cn(
                    'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all sm:rounded-xl sm:px-4 sm:py-2.5',
                    'hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                  )}
                >
                  {loading ? (
                    <LoadingDots className="text-primary-foreground" />
                  ) : (
                    <>
                      <LogIn className="size-4" aria-hidden />
                      Giriş yap
                    </>
                  )}
                </button>
              </form>

              <p className="text-center text-[10px] text-muted-foreground sm:text-xs">
                Hesabınız yok mu?{' '}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Kayıt
                </Link>
              </p>

              {hasAltOptions && (
                <div className="border-t border-border pt-2 sm:pt-3">
                  <button
                    type="button"
                    onClick={() => setExpandedAlt((v) => !v)}
                    className="flex w-full items-center justify-between rounded-lg py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground sm:py-1.5 sm:text-xs"
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
        </div>
    </AuthPageShell>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="text-muted-foreground">Yükleniyor…</div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
