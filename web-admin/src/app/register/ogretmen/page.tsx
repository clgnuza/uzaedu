'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthFlowSubnav } from '@/components/auth/auth-flow-subnav';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { AuthCard } from '@/components/auth/auth-card';
import { toast } from 'sonner';
import { ArrowRight, GraduationCap, Info, MapPin, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthCompactDetails } from '@/components/auth/auth-compact-details';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ORDER, formatSchoolTypeLabel } from '@/lib/school-labels';

type RegisterResponse = { verification_required: true; email: string };
type RegisterVerifyResponse = { token: string; school_verify_email_sent?: boolean };
type SchoolHit = {
  id: string;
  name: string;
  city: string | null;
  district: string | null;
  type?: string | null;
  institutional_domain?: string | null;
};
type RegisterSchoolsResponse = { items: SchoolHit[] };

const inputClass =
  'w-full min-h-9 rounded-xl border border-input bg-background px-2.5 py-1.5 text-left text-[13px] text-foreground placeholder:text-muted-foreground/75 shadow-sm transition-colors focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 sm:min-h-10 sm:px-3 sm:text-sm';

function RegisterOgretmenContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams?.toString() || undefined;
  const loginHref = q ? `/login/ogretmen?${q}` : '/login/ogretmen';
  const schoolRegHref = q ? `/register/okul?${q}` : '/register/okul';
  const { setToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [schoolHits, setSchoolHits] = useState<SchoolHit[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<SchoolHit | null>(null);
  const [regCity, setRegCity] = useState('');
  const [regDistrict, setRegDistrict] = useState('');
  const [regType, setRegType] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [regPhase, setRegPhase] = useState<'form' | 'otp'>('form');
  const [regEmail, setRegEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = new URLSearchParams(window.location.search).get('invite');
    if (v) setInviteCode(v.trim());
  }, []);

  useEffect(() => {
    if (selectedSchool) return;
    const q = schoolQuery.trim();
    if (q.length < 2) {
      setSchoolHits([]);
      return;
    }
    const t = setTimeout(() => {
      const p = new URLSearchParams();
      p.set('q', q);
      p.set('limit', '15');
      if (regCity.trim()) p.set('city', regCity.trim());
      if (regDistrict.trim()) p.set('district', regDistrict.trim());
      if (regType) p.set('type', regType);
      apiFetch<RegisterSchoolsResponse>(`/auth/register-schools?${p.toString()}`)
        .then((r) => setSchoolHits(r.items ?? []))
        .catch(() => setSchoolHits([]));
    }, 320);
    return () => clearTimeout(t);
  }, [schoolQuery, selectedSchool, regCity, regDistrict, regType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const e1 = email.trim().toLowerCase();
    if (!e1) {
      setError('E-posta gerekli.');
      return;
    }
    if (password.length < 8 || password.length > 128) {
      setError('Şifre 8–128 karakter arasında olmalıdır.');
      return;
    }
    if (!/^(?=.*\p{L})(?=.*\d).{8,128}$/u.test(password)) {
      setError('Şifre en az bir harf ve bir rakam içermelidir.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Şifre ve tekrarı eşleşmiyor.');
      return;
    }
    if (!consentTerms) {
      setError('Gizlilik politikası ve kullanım şartlarını kabul etmelisiniz.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: e1,
          password,
          display_name: displayName.trim() || undefined,
          consent_terms: true,
          consent_marketing: consentMarketing,
          school_id: selectedSchool?.id,
          invite_code: inviteCode.trim() || undefined,
        }),
      });
      if (res.verification_required) {
        setRegEmail(res.email);
        setRegPhase('otp');
        setOtpCode('');
        toast.success('E-postanıza doğrulama kodu gönderildi.');
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (otpCode.replace(/\s/g, '').length !== 6) {
      setError('6 haneli kodu girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<RegisterVerifyResponse>('/auth/register-verify', {
        method: 'POST',
        body: JSON.stringify({ email: regEmail, code: otpCode.replace(/\s/g, '') }),
      });
      await setToken(res.token);
      if (selectedSchool) {
        if (res.school_verify_email_sent === false) {
          toast.warning('Kurumsal doğrulama kodu e-postası gönderilemedi (SMTP). Profilden yeniden deneyin.', {
            duration: 12_000,
          });
        } else if (res.school_verify_email_sent) {
          toast.success('Kayıt tamam. Gelen ikinci kodla kurumsal e-postayı doğrulayın; okul onayı ayrıdır.');
        }
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız.');
    } finally {
      setLoading(false);
    }
  };

  const resendRegOtp = async () => {
    setLoading(true);
    try {
      await apiFetch('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email: regEmail, purpose: 'register_teacher' }),
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
      <AuthFlowSubnav flow="register" role="teacher" redirectQuery={q} gateForgot />
      <AuthCard className="shadow-[0_24px_64px_-16px_rgba(99,102,241,0.1)] ring-violet-500/10 dark:shadow-[0_24px_64px_-16px_rgba(0,0,0,0.45)]">
        <CardHeader className="space-y-1.5 border-b border-violet-500/15 bg-linear-to-br from-violet-500/10 to-transparent px-3 pb-3 pt-3 sm:space-y-2 sm:px-5 sm:pb-4 sm:pt-4">
          <h2 className="text-left text-base font-extrabold tracking-tight text-foreground sm:text-lg">
            {regPhase === 'otp' ? 'E-postayı doğrula' : 'Öğretmen kaydı'}
          </h2>
          <p className="text-left text-[11px] leading-snug text-muted-foreground sm:text-sm">
            {regPhase === 'otp' ? regEmail : 'Kişisel e-posta; okul yöneticisi kaydı ayrıdır.'}
          </p>
          {regPhase === 'form' && (
            <Link
              href={schoolRegHref}
              className="inline-block text-left text-[11px] font-bold text-amber-700 hover:underline sm:text-sm dark:text-amber-300"
            >
              Okul yöneticisi kaydı →
            </Link>
          )}
        </CardHeader>
        <CardContent className="space-y-3 px-3 pb-4 pt-3 sm:space-y-4 sm:px-5 sm:pb-5 sm:pt-4">
          {regPhase === 'otp' ? (
            <form onSubmit={submitOtp} className="space-y-2.5 sm:space-y-3">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="6 haneli kod"
                className={cn(inputClass, 'text-center font-mono text-lg tracking-widest')}
                disabled={loading}
              />
              {error && <Alert message={error} />}
              <button
                type="submit"
                disabled={loading}
                className="flex h-10 w-full items-center justify-center rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-violet-500/25 disabled:opacity-50 sm:h-11"
              >
                {loading ? <LoadingDots className="text-white" /> : 'Hesabı tamamla'}
              </button>
              <button type="button" onClick={resendRegOtp} className="text-xs font-medium text-primary hover:underline">
                Kodu yeniden gönder
              </button>
            </form>
          ) : (
            <>
          <AuthCompactDetails
            icon={<ShieldCheck className="size-3.5 text-primary" strokeWidth={2} aria-hidden />}
            title="Kayıt akışı (detay)"
          >
            E-posta doğrulama kodu sonrası giriş. Okul seçtiyseniz ikinci kod kurumsal adresi doğrular; okul onayı ayrıdır.
          </AuthCompactDetails>

          <Link
            href={loginHref}
            className={cn(
              'flex min-h-10 items-center justify-center gap-2 rounded-xl border border-violet-300/50 bg-linear-to-r from-violet-500/10 to-indigo-500/10 px-3 py-2 text-[13px] font-semibold transition-colors hover:from-violet-500/15 dark:border-violet-600/30',
            )}
          >
            <GraduationCap className="size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
            <span className="text-muted-foreground">Hesabınız var mı?</span>
            <span className="font-extrabold text-foreground">Giriş</span>
            <ArrowRight className="size-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          </Link>

          <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
            <div>
              <label htmlFor="reg-email" className="mb-1 block text-left text-[11px] font-bold text-foreground sm:text-xs">
                E-posta <span className="text-destructive">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@okul.edu.tr"
                autoComplete="email"
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="reg-display-name" className="mb-1 block text-left text-[11px] font-bold text-foreground sm:text-xs">
                Görünen ad
              </label>
              <input
                id="reg-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="İsteğe bağlı"
                autoComplete="nickname"
                maxLength={255}
                className={inputClass}
              />
              <AuthCompactDetails
                icon={<Info className="size-3.5" strokeWidth={2} aria-hidden />}
                title="Görünen ad"
                className="mt-1.5"
              >
                Zorunlu değil; aynı okulda maskelenebilir.
              </AuthCompactDetails>
            </div>
            <div>
              <label htmlFor="reg-invite" className="mb-1 block text-left text-[11px] font-bold text-foreground sm:text-xs">
                Davet kodu
              </label>
              <input
                id="reg-invite"
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                placeholder="Öğretmen davet kodu"
                autoComplete="off"
                maxLength={32}
                className={inputClass}
              />
            </div>
            <div className="relative">
              <label htmlFor="reg-school" className="mb-1 block text-left text-[11px] font-bold text-foreground sm:text-xs">
                Okul <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
              </label>
              {selectedSchool ? (
                <div className="space-y-2">
                  <div className="overflow-hidden rounded-2xl border-2 border-violet-400/55 bg-linear-to-br from-violet-500/15 via-fuchsia-500/8 to-card p-3 shadow-md shadow-violet-500/10 dark:border-violet-600/40">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 text-left">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-violet-800 dark:text-violet-200">Seçilen okul</p>
                        <p className="mt-0.5 text-sm font-extrabold leading-tight text-foreground sm:text-base">{selectedSchool.name}</p>
                        {(selectedSchool.city || selectedSchool.district) && (
                          <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-violet-950 shadow-sm ring-1 ring-violet-200 dark:bg-violet-950/60 dark:text-violet-50 dark:ring-violet-700/50">
                            <MapPin className="size-3.5 shrink-0 text-fuchsia-600 dark:text-fuchsia-400" aria-hidden />
                            {[selectedSchool.district, selectedSchool.city].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        {selectedSchool.type && (
                          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{formatSchoolTypeLabel(selectedSchool.type)}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg border border-border bg-background px-2 py-1 text-[11px] font-bold text-foreground hover:bg-muted"
                        onClick={() => {
                          setSelectedSchool(null);
                          setSchoolQuery('');
                          setSchoolHits([]);
                        }}
                      >
                        Kaldır
                      </button>
                    </div>
                    <p className="mt-2 text-left text-[10px] text-muted-foreground sm:text-[11px]">E-postayı doğrulayın; sonra okul onayı.</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-1.5 grid grid-cols-1 gap-1.5 sm:mb-2 sm:grid-cols-3 sm:gap-2">
                    <select
                      value={regCity}
                      onChange={(e) => {
                        setRegCity(e.target.value);
                        setRegDistrict('');
                      }}
                      className={inputClass}
                      aria-label="İl filtresi"
                    >
                      <option value="">Tüm iller</option>
                      {TURKEY_CITIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={regDistrict}
                      onChange={(e) => setRegDistrict(e.target.value)}
                      disabled={!regCity || getDistrictsForCity(regCity, []).length === 0}
                      className={inputClass}
                      aria-label="İlçe filtresi"
                    >
                      <option value="">{regCity ? 'Tüm ilçeler' : 'Önce il seçin'}</option>
                      {getDistrictsForCity(regCity, []).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <select
                      value={regType}
                      onChange={(e) => setRegType(e.target.value)}
                      className={inputClass}
                      aria-label="Okul türü filtresi"
                    >
                      <option value="">Tüm türler</option>
                      {SCHOOL_TYPE_ORDER.map((k) => (
                        <option key={k} value={k}>{SCHOOL_TYPE_LABELS[k] ?? k}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    id="reg-school"
                    type="text"
                    value={schoolQuery}
                    onChange={(e) => setSchoolQuery(e.target.value)}
                    placeholder="Okul ara (2+ harf)"
                    autoComplete="off"
                    className={inputClass}
                  />
                  {schoolHits.length > 0 && (
                    <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover py-1 text-sm shadow-md">
                      {schoolHits.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left hover:bg-violet-500/10"
                            onClick={() => {
                              setSelectedSchool(s);
                              setSchoolQuery('');
                              setSchoolHits([]);
                            }}
                          >
                            {(s.district || s.city) && (
                              <span className="mb-0.5 flex items-center gap-1 text-[11px] font-extrabold text-violet-800 dark:text-violet-200">
                                <MapPin className="size-3 shrink-0 opacity-80" aria-hidden />
                                {[s.district, s.city].filter(Boolean).join(' · ')}
                              </span>
                            )}
                            <span className="block font-semibold text-foreground">{s.name}</span>
                            {s.type && (
                              <span className="mt-0.5 block text-[10px] text-muted-foreground">{formatSchoolTypeLabel(s.type)}</span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
              <AuthCompactDetails icon={<Info className="size-3.5" strokeWidth={2} aria-hidden />} title="Okul seçmeden" className="mt-1.5">
                Hesap genel açılır; sonra profilden okul bağlanır.
              </AuthCompactDetails>
            </div>
            <div>
              <label htmlFor="reg-password" className="mb-1 block text-left text-[11px] font-bold text-foreground sm:text-xs">
                Şifre <span className="text-destructive">*</span>
              </label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                className={inputClass}
              />
              <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-[11px]">8–128 karakter, harf + rakam.</p>
            </div>
            <div>
              <label htmlFor="reg-confirm" className="mb-1 block text-left text-[11px] font-bold text-foreground sm:text-xs">
                Şifre tekrar <span className="text-destructive">*</span>
              </label>
              <input
                id="reg-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5 pt-0.5 sm:space-y-2 sm:pt-1">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={consentTerms}
                  onChange={(e) => setConsentTerms(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                />
                <span className="text-[10px] leading-snug text-foreground sm:text-[11px]">
                  <Link href="/gizlilik" target="_blank" className="text-primary hover:underline">
                    Gizlilik
                  </Link>
                  {' / '}
                  <Link href="/kullanim-sartlari" target="_blank" className="text-primary hover:underline">
                    Şartlar
                  </Link>{' '}
                  — okudum; KVKK kapsamında kabul. <span className="text-destructive">*</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={consentMarketing}
                  onChange={(e) => setConsentMarketing(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                />
                <span className="text-[10px] leading-snug text-muted-foreground sm:text-[11px]">Kampanya (isteğe bağlı)</span>
              </label>
            </div>
            {error && <Alert message={error} className="px-2.5 py-2 text-[11px] leading-snug [&_svg]:size-4" />}
            <button
              type="submit"
              disabled={loading || !consentTerms}
              aria-busy={loading}
              className="flex h-10 w-full items-center justify-center rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 text-sm font-extrabold text-white shadow-lg shadow-violet-500/25 transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11"
            >
              {loading ? <LoadingDots className="text-white" /> : 'Kayıt ol'}
            </button>
          </form>

          <p className="pt-0.5 text-center text-[11px] text-muted-foreground sm:text-sm">
            Zaten hesap:{' '}
            <Link href={loginHref} className="font-bold text-violet-600 hover:underline dark:text-violet-400">
              Giriş
            </Link>
          </p>
            </>
          )}
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}

export default function RegisterOgretmenPage() {
  return (
    <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Yükleniyor…</p>}>
      <RegisterOgretmenContent />
    </Suspense>
  );
}
