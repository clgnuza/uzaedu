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
import { ArrowRight, GraduationCap, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TURKEY_CITIES, getDistrictsForCity } from '@/lib/turkey-addresses';
import { SCHOOL_TYPE_LABELS, SCHOOL_TYPE_ORDER, formatSchoolTypeLabel } from '@/lib/school-labels';

type RegisterResponse = { token: string };
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
  'w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/80 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';

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
        toast.success('Kayıt oluşturuldu. E-postanızdaki kurumsal doğrulama bağlantısına tıklayın; ardından okul yöneticisi onayı beklenir.');
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
        <CardHeader className="space-y-0.5 px-4 pb-2 pt-3.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Öğretmen kaydı</h2>
          <p className="text-xs text-muted-foreground">E-posta ile hesap oluşturun — okul yöneticisi kaydı değildir.</p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-5">
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-br from-primary/6 via-background to-sky-500/5 p-3.5 shadow-sm ring-1 ring-black/3 dark:from-primary/8 dark:to-sky-950/30 dark:ring-white/5">
            <div className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full bg-primary/10 blur-2xl" aria-hidden />
            <div className="relative flex gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary shadow-inner shadow-primary/10">
                <ShieldCheck className="size-[18px]" strokeWidth={2} aria-hidden />
              </div>
              <div className="min-w-0 space-y-1.5">
                <p className="text-xs font-semibold tracking-tight text-foreground">Öğretmen kaydı</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Öğretmen hesabı için kurumsal e-posta zorunlu değildir. İsterseniz okul seçip kaydı tamamladıktan sonra
                  e-posta doğrulaması ve okul yöneticisi onayı ile okulunuza bağlanabilirsiniz.
                </p>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  <span className="font-medium text-foreground/90">Okul seçerek kayıt</span>
                  <span className="mx-1 text-primary" aria-hidden>
                    →
                  </span>
                  okul seçin, bu sayfada kayıt olun, gelen e-postayı doğrulayın, ardından okul onayını bekleyin.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/login"
            className={cn(
              'flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-2.5 text-xs transition-colors hover:bg-muted/50',
            )}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <GraduationCap className="size-4 shrink-0 text-primary" aria-hidden />
              <span>
                Zaten hesabınız var mı?{' '}
                <span className="font-semibold text-foreground">E-posta ile giriş</span>
                <span className="text-muted-foreground"> — hesabınızla giriş yapın</span>
              </span>
            </span>
            <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden />
          </Link>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="reg-email" className="mb-1 block text-xs font-medium text-foreground">
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
              <label htmlFor="reg-display-name" className="mb-1 block text-xs font-medium text-foreground">
                Görünen ad
              </label>
              <input
                id="reg-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Rumuz veya ad (isteğe bağlı)"
                autoComplete="nickname"
                maxLength={255}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Tam adınızı paylaşmak zorunda değilsiniz; aynı okuldaki öğretmenlere adınız isteğe bağlı maskelenebilir.
              </p>
            </div>
            <div>
              <label htmlFor="reg-invite" className="mb-1 block text-xs font-medium text-foreground">
                Davet kodu (isteğe bağlı)
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
              <label htmlFor="reg-school" className="mb-1 block text-xs font-medium text-foreground">
                Okulunuz <span className="font-normal text-muted-foreground">(isteğe bağlı)</span>
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
                  <p className="text-[11px] text-muted-foreground">
                    Kayıt sonrası gelen e-postadaki bağlantı ile adresinizi doğrulayın; ardından okul yöneticisi onayı beklenir.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-2 grid gap-2 sm:grid-cols-3">
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
                    placeholder="En az 2 harf ile ara…"
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
              <p className="mt-1 text-[11px] text-muted-foreground">
                Okul seçmezseniz hesap genel öğretmen olarak açılır; sonra profilden okul bağlayabilirsiniz.
              </p>
            </div>
            <div>
              <label htmlFor="reg-password" className="mb-1 block text-xs font-medium text-foreground">
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
              <p className="mt-1 text-[11px] text-muted-foreground">8–128 karakter; en az bir harf ve bir rakam.</p>
            </div>
            <div>
              <label htmlFor="reg-confirm" className="mb-1 block text-xs font-medium text-foreground">
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
            <div className="space-y-2 pt-1">
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={consentTerms}
                  onChange={(e) => setConsentTerms(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                />
                <span className="text-[11px] leading-snug text-foreground">
                  <Link href="/gizlilik" target="_blank" className="text-primary hover:underline">
                    Gizlilik
                  </Link>
                  {', '}
                  <Link href="/kullanim-sartlari" target="_blank" className="text-primary hover:underline">
                    Kullanım Şartları
                  </Link>
                  ’nı okudum; kişisel verilerimin KVKK kapsamında bu metinlere uygun işlenmesini kabul ediyorum.{' '}
                  <span className="text-destructive">*</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={consentMarketing}
                  onChange={(e) => setConsentMarketing(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                />
                <span className="text-[11px] leading-snug text-muted-foreground">Kampanya iletişim izni (isteğe bağlı)</span>
              </label>
            </div>
            {error && <Alert message={error} />}
            <button
              type="submit"
              disabled={loading || !consentTerms}
              aria-busy={loading}
              className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <LoadingDots className="text-primary-foreground" /> : 'Kayıt ol'}
            </button>
          </form>

          <p className="pt-1 text-center text-[11px] text-muted-foreground">
            Yukarıdaki karttan veya{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              giriş sayfasından
            </Link>{' '}
            e-posta ile oturum açın.
          </p>
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}
