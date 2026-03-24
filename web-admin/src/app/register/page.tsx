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

type RegisterResponse = { token: string };
type SchoolHit = { id: string; name: string; city: string | null; district: string | null };
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
      apiFetch<RegisterSchoolsResponse>(`/auth/register-schools?q=${encodeURIComponent(q)}&limit=15`)
        .then((r) => setSchoolHits(r.items ?? []))
        .catch(() => setSchoolHits([]));
    }, 320);
    return () => clearTimeout(t);
  }, [schoolQuery, selectedSchool]);

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
        setToken(res.token);
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
        <CardHeader className="space-y-1 px-4 pb-2 pt-3.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Kayıt ol</h2>
          <p className="text-xs text-muted-foreground">E-posta ile hesap oluşturun.</p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-5">
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
                Okul (isteğe bağlı)
              </label>
              {selectedSchool ? (
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
              ) : (
                <>
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
                            {(s.district || s.city) && (
                              <span className="block text-[11px] text-muted-foreground">
                                {[s.district, s.city].filter(Boolean).join(' · ')}
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
                Okul yöneticisi onayından sonra hesabınız okulla doğrulanmış sayılır.
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

          <p className="pt-1 text-center text-xs text-muted-foreground">
            Hesabınız var mı?{' '}
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Giriş yap
            </Link>
          </p>
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}
