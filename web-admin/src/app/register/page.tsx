'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { AuthCard } from '@/components/auth/auth-card';
import { toast } from 'sonner';
import { ArrowRight, GraduationCap, Info, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AuthCompactDetails } from '@/components/auth/auth-compact-details';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ORDER, formatSchoolTypeLabel } from '@/lib/school-labels';

type RegisterResponse = { token: string; school_verify_email_sent?: boolean };
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
  'w-full rounded-lg border border-input bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/80 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 sm:rounded-xl sm:px-3 sm:py-2';

export default function RegisterPage() {
  const router = useRouter();
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
      if (res.token) {
        await setToken(res.token);
      }
      if (selectedSchool) {
        if (res.school_verify_email_sent === false) {
          toast.warning(
            'Hesabınız oluşturuldu ancak doğrulama e-postası gönderilemedi. Okul yöneticisi SMTP ayarlarını kontrol etmeli; panele girişten sonra «Yeniden gönder» ile tekrar deneyebilirsiniz.',
            { duration: 12_000 },
          );
        } else {
          toast.success(
            'Kayıt oluşturuldu. E-postanızdaki kurumsal doğrulama bağlantısına tıklayın; ardından okul yöneticisi onayı beklenir.',
          );
        }
      }
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell>
      <AuthCard>
        <CardHeader className="space-y-0.5 px-3 pb-1.5 pt-2.5 sm:px-5 sm:pb-2 sm:pt-3.5">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground sm:text-base">Öğretmen kaydı</h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">E-posta ile hesap (okul yöneticisi değil)</p>
        </CardHeader>
        <CardContent className="space-y-2.5 px-3 pb-3 pt-0 sm:space-y-3 sm:px-5 sm:pb-4">
          <AuthCompactDetails
            icon={<ShieldCheck className="size-3.5 text-primary" strokeWidth={2} aria-hidden />}
            title="Kayıt akışı (detay)"
          >
            Kurumsal e-posta zorunlu değil. İsterseniz okul seçin → e-postayı doğrulayın → yönetici onayı. Okulsuz da
            açılır; sonra profilden bağlanırsınız.
          </AuthCompactDetails>

          <Link
            href="/login"
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-muted/25 px-2.5 py-2 text-[11px] font-medium transition-colors hover:bg-muted/45 sm:rounded-xl sm:py-2.5 sm:text-xs',
            )}
          >
            <GraduationCap className="size-3.5 shrink-0 text-primary" aria-hidden />
            <span className="text-muted-foreground">Hesabınız var mı?</span>
            <span className="font-semibold text-foreground">Giriş</span>
            <ArrowRight className="size-3.5 shrink-0 text-primary" aria-hidden />
          </Link>

          <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
            <div>
              <label htmlFor="reg-email" className="mb-0.5 block text-[11px] font-medium text-foreground sm:text-xs">
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
              <label htmlFor="reg-display-name" className="mb-0.5 block text-[11px] font-medium text-foreground sm:text-xs">
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
              <label htmlFor="reg-invite" className="mb-0.5 block text-[11px] font-medium text-foreground sm:text-xs">
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
              <label htmlFor="reg-school" className="mb-0.5 block text-[11px] font-medium text-foreground sm:text-xs">
                Okul <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
              </label>
              {selectedSchool ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 rounded-xl border border-input bg-muted/40 px-3 py-2 text-sm">
                    <span className="flex-1 truncate">{selectedSchool.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-primary hover:underline"
                      onClick={() => {
                        setSelectedSchool(null);
                        setSchoolQuery('');
                        setSchoolHits([]);
                      }}
                    >
                      Kaldır
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground sm:text-[11px]">
                    E-postayı doğrulayın; sonra okul onayı.
                  </p>
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
                            className="w-full px-3 py-2 text-left hover:bg-muted"
                            onClick={() => {
                              setSelectedSchool(s);
                              setSchoolQuery('');
                              setSchoolHits([]);
                            }}
                          >
                            <span className="font-medium text-foreground">{s.name}</span>
                            {(s.district || s.city || s.type) && (
                              <span className="block text-[11px] text-muted-foreground">
                                {[
                                  s.district,
                                  s.city,
                                  s.type ? formatSchoolTypeLabel(s.type) : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
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
              <label htmlFor="reg-password" className="mb-0.5 block text-[11px] font-medium text-foreground sm:text-xs">
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
              <label htmlFor="reg-confirm" className="mb-0.5 block text-[11px] font-medium text-foreground sm:text-xs">
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
              className="flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-2.5"
            >
              {loading ? <LoadingDots className="text-primary-foreground" /> : 'Kayıt ol'}
            </button>
          </form>

          <p className="pt-0.5 text-center text-[10px] text-muted-foreground sm:text-[11px]">
            Zaten hesap:{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              giriş
            </Link>
          </p>
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}
