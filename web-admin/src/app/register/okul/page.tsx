'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFlowSubnav } from '@/components/auth/auth-flow-subnav';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthCard } from '@/components/auth/auth-card';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { Building2, MapPin, Hash, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatSchoolTypeLabel } from '@/lib/school-labels';

type LookupResponse = {
  school_id: string;
  name: string;
  city: string | null;
  district: string | null;
  type: string | null;
  institution_code: string | null;
  required_email_domain: string | null;
  institutional_email_sample: string | null;
};
type RegStart = { verification_required: true; email: string; school_id: string };
type RegVerify = { token: string };

const inputClass =
  'w-full min-h-9 rounded-xl border border-input bg-background px-2.5 py-1.5 text-left text-[13px] text-foreground placeholder:text-muted-foreground/75 shadow-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 sm:min-h-10 sm:px-3 sm:text-sm';

function StepTabs({ step }: { step: 'code' | 'form' | 'otp' }) {
  const steps: { id: 'code' | 'form' | 'otp'; n: string; t: string }[] = [
    { id: 'code', n: '1', t: 'Kurum' },
    { id: 'form', n: '2', t: 'Kayıt' },
    { id: 'otp', n: '3', t: 'Kod' },
  ];
  const order = { code: 0, form: 1, otp: 2 };
  const cur = order[step];
  return (
    <div className="mb-3 flex rounded-2xl border border-amber-500/25 bg-linear-to-r from-amber-500/12 to-orange-500/8 p-1 shadow-inner dark:from-amber-950/50 dark:to-orange-950/30 sm:mb-4">
      {steps.map((s, i) => {
        const done = i < cur;
        const active = s.id === step;
        return (
          <div
            key={s.id}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-center transition sm:py-2',
              active &&
                'bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/30',
              done && !active && 'text-amber-800 dark:text-amber-200',
              !active && !done && 'text-muted-foreground/80',
            )}
          >
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[9px] font-extrabold sm:size-6 sm:text-[10px]',
                active ? 'bg-white/25 text-white' : done ? 'bg-amber-500/25 text-amber-900 dark:text-amber-100' : 'bg-muted/50',
              )}
            >
              {done && !active ? '✓' : s.n}
            </span>
            <span className="text-[9px] font-bold leading-none sm:text-[10px]">{s.t}</span>
          </div>
        );
      })}
    </div>
  );
}

function SchoolFoundHero({ lookup }: { lookup: LookupResponse }) {
  const loc = [lookup.city, lookup.district].filter(Boolean).join(' · ');
  const typeLabel = lookup.type ? formatSchoolTypeLabel(lookup.type) : null;
  return (
    <div className="mb-3 overflow-hidden rounded-2xl border-2 border-amber-400/60 bg-linear-to-br from-amber-50 via-orange-50/80 to-amber-100/50 p-3 shadow-lg shadow-amber-500/15 dark:from-amber-950/60 dark:via-orange-950/40 dark:to-amber-950/50 dark:border-amber-600/40 sm:mb-4 sm:p-4">
      <p className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-200">Bulunan okul</p>
      <p className="mt-1 text-base font-extrabold leading-tight text-foreground sm:text-lg">{lookup.name}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {loc && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-amber-950 shadow-sm ring-1 ring-amber-200/80 dark:bg-amber-950/80 dark:text-amber-50 dark:ring-amber-700/50">
            <MapPin className="size-3.5 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
            {loc}
          </span>
        )}
        {typeLabel && (
          <span className="rounded-full bg-orange-500/20 px-2.5 py-1 text-[11px] font-bold text-orange-900 dark:bg-orange-500/30 dark:text-orange-100">
            {typeLabel}
          </span>
        )}
        {lookup.institution_code && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-900/10 px-2.5 py-1 text-[11px] font-bold text-amber-950 dark:bg-white/10 dark:text-amber-100">
            <Hash className="size-3.5 opacity-70" aria-hidden />
            {lookup.institution_code}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1 rounded-xl border border-amber-200/60 bg-white/60 p-2.5 text-left dark:border-amber-800/40 dark:bg-black/20">
        <p className="flex items-start gap-1.5 text-[11px] font-semibold text-foreground sm:text-xs">
          <Mail className="mt-0.5 size-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
          <span>
            E-posta alan adı:{' '}
            <strong className="text-amber-900 dark:text-amber-100">@{lookup.required_email_domain}</strong>
          </span>
        </p>
        {lookup.institutional_email_sample && (
          <p className="pl-5 text-[10px] text-muted-foreground sm:text-[11px]">Örnek: {lookup.institutional_email_sample}</p>
        )}
      </div>
    </div>
  );
}

function RegisterOkulContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams?.toString() || undefined;
  const teacherRegHref = q ? `/register/ogretmen?${q}` : '/register/ogretmen';
  const { setToken } = useAuth();
  const [step, setStep] = useState<'code' | 'form' | 'otp'>('code');
  const [institutionCode, setInstitutionCode] = useState('');
  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [consentTerms, setConsentTerms] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const doLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const c = institutionCode.trim();
    if (c.length < 4) {
      setError('Kurum kodunu girin.');
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({ institution_code: c });
      const res = await apiFetch<LookupResponse>(`/auth/school/lookup?${qs.toString()}`);
      setLookup(res);
      setStep('form');
      toast.success('Okul bulundu.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Okul bulunamadı.');
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!consentTerms) {
      setError('Şartları kabul edin.');
      return;
    }
    const e1 = email.trim().toLowerCase();
    if (!e1 || password.length < 8) {
      setError('E-posta ve şifre (min. 8) gerekli.');
      return;
    }
    if (!/^(?=.*\p{L})(?=.*\d).{8,128}$/u.test(password)) {
      setError('Şifre harf ve rakam içermeli.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<RegStart>('/auth/school/register', {
        method: 'POST',
        body: JSON.stringify({
          institution_code: institutionCode.trim(),
          email: e1,
          password,
          display_name: displayName.trim() || undefined,
          consent_terms: true,
        }),
      });
      if (res.verification_required) {
        setRegEmail(res.email);
        setStep('otp');
        setOtpCode('');
        toast.success('Doğrulama kodu e-postanıza gönderildi.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const doVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.replace(/\s/g, '').length !== 6) {
      setError('6 haneli kod.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<RegVerify>('/auth/school/register-verify', {
        method: 'POST',
        body: JSON.stringify({ email: regEmail, code: otpCode.replace(/\s/g, '') }),
      });
      await setToken(res.token);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    setLoading(true);
    try {
      await apiFetch('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: regEmail, purpose: 'register_school' }),
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
      <AuthFlowSubnav flow="register" role="school" redirectQuery={q} gateForgot />
      <AuthCard className="shadow-[0_20px_50px_-12px_rgba(245,158,11,0.2)] ring-2 ring-amber-500/15 dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]">
        <CardHeader className="space-y-1.5 border-b border-amber-500/15 bg-linear-to-br from-amber-500/12 to-transparent px-3 pb-3 pt-3 sm:space-y-2 sm:px-5 sm:pb-4 sm:pt-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-amber-500 to-orange-600 text-white shadow-md sm:size-10">
              <Building2 className="size-[18px] sm:size-5" strokeWidth={2.25} />
            </span>
            <h2 className="text-left text-base font-extrabold leading-tight tracking-tight sm:text-lg">Okul yöneticisi kaydı</h2>
          </div>
          <p className="text-left text-[11px] leading-snug text-muted-foreground sm:text-sm">
            Kurum kodu → bilgiler → e-posta kodu.
          </p>
          <Link href={teacherRegHref} className="inline-block text-left text-[11px] font-bold text-violet-600 hover:underline sm:text-sm dark:text-violet-400">
            Öğretmen kaydı →
          </Link>
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-4 pt-3 sm:space-y-4 sm:px-5 sm:pb-5 sm:pt-4">
          <StepTabs step={step} />

          {step === 'code' && (
            <form onSubmit={doLookup} className="space-y-2.5 sm:space-y-3">
              <div>
                <label className="mb-1 block text-left text-[11px] font-bold text-foreground sm:text-xs">Kurum kodu</label>
                <input
                  value={institutionCode}
                  onChange={(e) => setInstitutionCode(e.target.value)}
                  className={inputClass}
                  placeholder="Örn. 123456"
                  disabled={loading}
                  inputMode="numeric"
                />
              </div>
              {error && <Alert message={error} />}
              <button
                type="submit"
                disabled={loading}
                className="flex h-10 w-full items-center justify-center rounded-xl bg-linear-to-r from-amber-500 to-orange-600 text-sm font-extrabold text-white shadow-lg shadow-amber-500/25 disabled:opacity-50 sm:h-11"
              >
                {loading ? <LoadingDots className="text-white" /> : 'Okulu bul'}
              </button>
            </form>
          )}

          {step === 'form' && lookup && (
            <form onSubmit={doRegister} className="space-y-2.5 sm:space-y-3">
              <SchoolFoundHero lookup={lookup} />
              <div>
                <label className="mb-1 block text-left text-[11px] font-bold sm:text-xs">Kurumsal e-posta</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-left text-[11px] font-bold sm:text-xs">Görünen ad</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-left text-[11px] font-bold sm:text-xs">Şifre</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required minLength={8} />
              </div>
              <label className="flex items-start gap-2 text-left text-[11px] leading-snug sm:text-xs">
                <input type="checkbox" checked={consentTerms} onChange={(e) => setConsentTerms(e.target.checked)} className="mt-0.5 size-4 shrink-0 rounded" />
                Gizlilik ve kullanım şartlarını kabul ediyorum.
              </label>
              {error && <Alert message={error} />}
              <button
                type="submit"
                disabled={loading || !consentTerms}
                className="flex h-10 w-full items-center justify-center rounded-xl bg-linear-to-r from-amber-500 to-orange-600 text-sm font-extrabold text-white shadow-lg shadow-amber-500/25 disabled:opacity-50 sm:h-11"
              >
                {loading ? <LoadingDots className="text-white" /> : 'Kayıt — kod gönder'}
              </button>
              <button
                type="button"
                onClick={() => setStep('code')}
                className="w-full text-center text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                ← Kurum kodu
              </button>
            </form>
          )}

          {step === 'otp' && lookup && (
            <form onSubmit={doVerify} className="space-y-2.5 sm:space-y-3">
              <div className="rounded-xl border border-amber-200/70 bg-amber-500/5 p-2.5 dark:border-amber-800/50">
                <p className="text-[10px] font-bold uppercase text-amber-800 dark:text-amber-200">Okul</p>
                <p className="text-sm font-extrabold leading-tight">{lookup.name}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {[lookup.district, lookup.city].filter(Boolean).join(' · ')}
                </p>
              </div>
              <p className="text-left text-[11px] text-muted-foreground sm:text-xs">{regEmail}</p>
              <input
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className={cn(inputClass, 'text-center font-mono text-lg tracking-widest')}
                placeholder="000000"
              />
              {error && <Alert message={error} />}
              <button
                type="submit"
                disabled={loading}
                className="flex h-10 w-full items-center justify-center rounded-xl bg-linear-to-r from-amber-500 to-orange-600 text-sm font-extrabold text-white shadow-lg shadow-amber-500/25 disabled:opacity-50 sm:h-11"
              >
                {loading ? <LoadingDots className="text-white" /> : 'Doğrula ve giriş'}
              </button>
              <button type="button" onClick={resendOtp} className="w-full text-center text-[11px] font-bold text-amber-700 hover:underline dark:text-amber-400">
                Kodu yeniden gönder
              </button>
            </form>
          )}
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}

export default function RegisterOkulPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
      <RegisterOkulContent />
    </Suspense>
  );
}
