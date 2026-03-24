'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  User,
  Building2,
  Users,
  BarChart3,
  Mail,
  Info,
  CheckCircle2,
  Eye,
  EyeOff,
  FileDown,
  ShieldCheck,
  Clock,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { EvrakDefaultsForm } from '@/components/evrak-defaults-form';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { EvrakDefaults } from '@/components/evrak-defaults-form';
import { DeleteAccountButton } from '@/components/account/data-privacy-actions';
import { BackupExportPanel } from '@/components/account/backup-export-panel';
import { AvatarPickerField } from '@/components/account/avatar-picker';

const SCHOOL_TYPE_LABELS: Record<string, string> = {
  ilkokul: 'İlkokul',
  ortaokul: 'Ortaokul',
  lise: 'Lise',
  gsl: 'Güzel Sanatlar Lisesi',
  spor_l: 'Spor Lisesi',
  meslek: 'Meslek Lisesi',
  mesem: 'Mesleki Eğitim Merkezi',
};

/** Branş seçenekleri (MEB ders kataloğundan) */
const BRANCH_OPTIONS = [
  'Türk Dili ve Edebiyatı',
  'Türkçe',
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Tarih',
  'Coğrafya',
  'Felsefe',
  'Din Kültürü ve Ahlak Bilgisi',
  'İngilizce',
  'Almanca',
  'Fransızca',
  'Arapça',
  'Rehberlik',
  'Beden Eğitimi ve Spor',
  'Görsel Sanatlar',
  'Müzik',
  'Bilgisayar Bilimi',
  'Fen Bilimleri',
  'Sosyal Bilgiler',
  'Teknoloji ve Tasarım',
  'Birleştirilmiş Sınıf (1-2, 3-4)',
];

type TabId = 'hesap' | 'okul' | 'zumre' | 'limitlerim' | 'yedek';

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'hesap', label: 'Hesap', icon: User },
  { id: 'okul', label: 'Okul ve Branş', icon: Building2 },
  { id: 'zumre', label: 'Zümre', icon: Users },
  { id: 'limitlerim', label: 'Limitlerim', icon: BarChart3 },
  { id: 'yedek', label: 'Yedek', icon: FileDown },
];

const TAB_IDS: TabId[] = ['hesap', 'okul', 'zumre', 'limitlerim', 'yedek'];

export function TeacherAccountTabs() {
  const searchParams = useSearchParams();
  const { token, me, refetchMe } = useAuth();
  const [tab, setTab] = useState<TabId>('hesap');
  const [displayName, setDisplayName] = useState(me?.display_name ?? '');
  const [avatarKey, setAvatarKey] = useState<string | null>(me?.avatar_key ?? null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [schoolId, setSchoolId] = useState(me?.school_id ?? '');
  const [branchSelect, setBranchSelect] = useState(me?.teacher_branch ?? '');
  const [savingOkul, setSavingOkul] = useState(false);
  const [okulError, setOkulError] = useState<string | null>(null);
  const [nameMasked, setNameMasked] = useState(me?.teacher_public_name_masked !== false);

  useEffect(() => {
    const q = searchParams.get('tab');
    if (q && TAB_IDS.includes(q as TabId)) setTab(q as TabId);
  }, [searchParams]);

  useEffect(() => {
    setDisplayName(me?.display_name ?? '');
  }, [me?.display_name]);

  useEffect(() => {
    setAvatarKey(me?.avatar_key ?? null);
  }, [me?.avatar_key]);

  useEffect(() => {
    setSchoolId(me?.school_id ?? '');
    setBranchSelect(me?.teacher_branch ?? '');
  }, [me?.school_id, me?.teacher_branch]);

  useEffect(() => {
    setNameMasked(me?.teacher_public_name_masked !== false);
  }, [me?.teacher_public_name_masked]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingProfile(true);
    setProfileError(null);
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          avatar_key: avatarKey,
          teacher_public_name_masked: nameMasked,
        }),
      });
      toast.success('Profil güncellendi');
      refetchMe();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Güncellenemedi';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!newPassword && !currentPassword) return;
    if (newPassword) {
      if (newPassword.length < 8 || newPassword.length > 128) {
        setPasswordError('Yeni şifre 8–128 karakter arasında olmalıdır.');
        return;
      }
      if (!/^(?=.*\p{L})(?=.*\d).{8,128}$/u.test(newPassword)) {
        setPasswordError('Şifre en az bir harf ve bir rakam içermelidir.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setPasswordError('Yeni şifre ve tekrarı eşleşmiyor.');
        return;
      }
      if (!currentPassword) {
        setPasswordError('Mevcut şifre gereklidir.');
        return;
      }
    }
    setSavingPassword(true);
    setPasswordError(null);
    try {
      await apiFetch('/me/password', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      toast.success('Şifre güncellendi');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Şifre değiştirilemedi';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  const school = me?.school;
  const evrakDefaults = (me as { evrak_defaults?: EvrakDefaults })?.evrak_defaults ?? null;

  const handleSaveOkul = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingOkul(true);
    setOkulError(null);
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          school_id: schoolId || null,
          teacher_branch: branchSelect.trim() || null,
        }),
      });
      toast.success('Okul ve branş güncellendi');
      refetchMe();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Güncellenemedi';
      setOkulError(msg);
      toast.error(msg);
    } finally {
      setSavingOkul(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sekme navigasyonu – kompakt pill, bulutsal geçiş */}
      <div className="flex flex-wrap gap-0.5 rounded-xl border border-border/60 bg-linear-to-r from-muted/20 via-muted/30 to-muted/20 dark:from-zinc-800/80 dark:via-zinc-800/60 dark:to-zinc-800/80 dark:border-zinc-700/60 p-1 shadow-inner">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-300 ease-out',
                isActive
                  ? 'bg-background/90 text-foreground shadow-sm ring-1 ring-border/40 backdrop-blur-sm dark:bg-zinc-800/90 dark:ring-zinc-600/50'
                  : 'text-muted-foreground hover:bg-background/40 hover:text-foreground dark:hover:bg-zinc-800/50',
              )}
            >
              <Icon className={cn('size-3.5 shrink-0', isActive ? 'text-primary' : '')} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Sekme içerikleri */}
      {tab === 'hesap' && (
        <Card className="overflow-hidden border-border/50 shadow-sm bg-card/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <CardHeader className="border-b border-border/50 bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/80">
            <CardTitle>Profil düzenle</CardTitle>
            <CardDescription>Görünen ad ve şifre bu sekmede.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-5 space-y-5">
            <section>
              <AvatarPickerField
                value={avatarKey}
                onChange={setAvatarKey}
                disabled={savingProfile}
                idPrefix="hesap-av"
              />
            </section>

            {/* Görünen ad */}
            <section>
              <label htmlFor="hesap-ad" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                  <User className="size-3.5 text-primary" />
                </span>
                Görünen ad
              </label>
              <form onSubmit={handleSaveProfile} className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[180px]">
                  <input
                    id="hesap-ad"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={255}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground/70 transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="Adınız soyadınız"
                  />
                </div>
                <Button type="submit" disabled={savingProfile} className="rounded-lg">
                  {savingProfile ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              </form>
              {profileError && <Alert message={profileError} />}
              <label className="mt-3 flex cursor-pointer items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={nameMasked}
                  onChange={(e) => setNameMasked(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  Aynı okuldaki diğer öğretmenlere tam adımı gösterme; nöbet listelerinde kısaltılmış göster (ör. Ayşe K.).
                </span>
              </label>
            </section>

            {/* E-Posta */}
            <section className="rounded-xl border border-border/60 bg-linear-to-br from-muted/30 via-muted/20 to-muted/30 dark:border-zinc-700/60 dark:from-zinc-800/50 dark:via-zinc-800/30 dark:to-zinc-800/50 p-4 space-y-2 transition-all duration-300">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Mail className="size-4 text-primary" />
                E-Posta Adresi (Değiştirilemez)
              </label>
              <input
                type="email"
                value={me?.email ?? ''}
                readOnly
                className="w-full rounded-lg border border-border/60 bg-background/80 dark:bg-zinc-800/50 dark:border-zinc-700 px-3 py-2 text-foreground"
              />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0" />
                Güvenlik nedeniyle e-posta adresi değiştirilemez.
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200/80 bg-linear-to-r from-emerald-50/60 to-emerald-100/30 dark:border-emerald-800/50 dark:from-emerald-950/40 dark:via-emerald-900/30 dark:to-emerald-950/40 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200">
                <CheckCircle2 className="size-4 shrink-0" />
                E-posta adresiniz doğrulanmış
              </div>
            </section>

            {/* Şifre Değiştir */}
            <section className="rounded-xl border border-border/60 bg-linear-to-br from-muted/20 via-muted/10 to-muted/20 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/20 dark:to-zinc-800/40 p-4 space-y-3 transition-all duration-300">
              <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                  <User className="size-3.5 text-primary" />
                </span>
                Şifre Değiştir (Opsiyonel)
              </h3>
              <p className="text-xs text-muted-foreground">
                Şifrenizi değiştirmek istemiyorsanız bu alanları boş bırakın.
              </p>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordError && <Alert message={passwordError} />}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="mevcut-sifre" className="block text-sm font-medium text-foreground mb-1.5">
                      Mevcut şifre
                    </label>
                    <input
                      id="mevcut-sifre"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                      placeholder="Mevcut şifreniz"
                    />
                  </div>
                  <div>
                    <label htmlFor="yeni-sifre" className="block text-sm font-medium text-foreground mb-1.5">
                      Yeni Şifre
                    </label>
                    <div className="relative">
                      <input
                        id="yeni-sifre"
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        placeholder="Boş bırakın, değiştirmek istemezseniz"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="sifre-tekrar" className="block text-sm font-medium text-foreground mb-1.5">
                      Şifre Tekrar
                    </label>
                    <div className="relative">
                      <input
                        id="sifre-tekrar"
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                        className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                        placeholder="Yeni şifreyi tekrar girin"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button type="submit" disabled={savingPassword} className="rounded-lg">
                  {savingPassword ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
                </Button>
              </form>
            </section>

            {/* Hesap kapatma */}
            <section className="rounded-xl border border-border/60 bg-linear-to-br from-muted/20 via-muted/10 to-muted/20 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/20 dark:to-zinc-800/40 p-4 space-y-3 transition-all duration-300">
              <h3 className="text-sm font-semibold text-foreground">Hesap kapatma</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Veri indirme ve modül yedekleri için <strong>Yedek</strong> sekmesini kullanın.
              </p>
              <DeleteAccountButton token={token} />
            </section>
          </CardContent>
        </Card>
      )}

      {tab === 'okul' && (
        <Card className="overflow-hidden border-border/50 shadow-sm bg-card/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <CardContent className="p-4 md:p-5">
            {me?.teacher_school_membership === 'pending' && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200/80 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
                <Clock className="size-4 shrink-0 mt-0.5" />
                <span>Okul yöneticisi onayı bekleniyor. Onaylanınca &quot;doğrulanmış okul öğretmeni&quot; rozetiniz görünür.</span>
              </div>
            )}
            {me?.school_verified && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 text-sm font-medium text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100">
                <ShieldCheck className="size-4 shrink-0" />
                Okul öğretmeni olarak doğrulandınız
              </div>
            )}
            <form onSubmit={handleSaveOkul} className="space-y-4">
              {okulError && <Alert message={okulError} />}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-linear-to-br from-muted/15 via-muted/10 to-muted/15 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/25 dark:to-zinc-800/40 p-4 transition-all duration-300">
                  <label htmlFor="okul-brans" className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
                    <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                      <Building2 className="size-3.5 text-primary" />
                    </span>
                    Branş
                  </label>
                  <select
                    id="okul-brans"
                    value={branchSelect}
                    onChange={(e) => setBranchSelect(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  >
                    <option value="">Branş seçin</option>
                    {branchSelect && !BRANCH_OPTIONS.includes(branchSelect) && (
                      <option value={branchSelect}>{branchSelect}</option>
                    )}
                    {BRANCH_OPTIONS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div className="rounded-xl border border-border/60 bg-linear-to-br from-muted/15 via-muted/10 to-muted/15 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/25 dark:to-zinc-800/40 p-4 transition-all duration-300">
                  <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
                    <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                      <User className="size-3.5 text-primary" />
                    </span>
                    Görev
                  </label>
                  <p className="text-sm font-medium text-foreground">Öğretmen</p>
                </div>
              </div>
              <div className="rounded-xl border border-border/60 bg-linear-to-r from-muted/10 via-muted/5 to-muted/10 dark:border-zinc-700/60 dark:from-zinc-800/30 dark:via-zinc-800/20 dark:to-zinc-800/30 p-4 transition-all duration-300">
                <p className="mb-4 text-sm text-muted-foreground">
                  İl ve ilçe seçerek okulunuzu bulun. Otomatik veriler mevcut okulunuzdan doldurulur.
                </p>
                <SchoolSelectWithFilter
                  value={schoolId}
                  onChange={setSchoolId}
                  token={token}
                  placeholder="Okul seçin"
                  initialCity={school?.city}
                  initialDistrict={school?.district}
                />
              </div>
              <div className="rounded-xl border border-border/60 bg-linear-to-br from-muted/15 via-muted/10 to-muted/15 p-4 transition-all duration-300">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground mb-1.5">
                  <span className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                    <Building2 className="size-3.5 text-primary" />
                  </span>
                  Kurum Türü
                </label>
                <p className={cn('text-sm font-medium', school?.type ? 'text-foreground' : 'text-muted-foreground/70 italic')}>
                  {school?.type ? SCHOOL_TYPE_LABELS[school.type] ?? school.type : 'Okul seçin'}
                </p>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingOkul} className="gap-2 rounded-lg">
                  <CheckCircle2 className="size-4" />
                  {savingOkul ? 'Kaydediliyor…' : 'Güncelle'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'zumre' && (
        <Card className="overflow-hidden border-border/50 shadow-sm bg-card/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <CardHeader className="border-b border-border/50 bg-linear-to-r from-muted/20 via-muted/15 to-muted/20 dark:border-zinc-800 dark:from-zinc-800/70 dark:via-zinc-800/50 dark:to-zinc-800/70 px-4 md:px-5 py-4 transition-all duration-300">
            <CardTitle className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 shadow-inner">
                <Users className="size-4 text-primary" />
              </div>
              <div>
                <span className="block text-base font-semibold">Yıllık plan ve zümre varsayılanları</span>
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  Evrak ve planlar sayfasında otomatik doldurulacak değerler.
                </p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <EvrakDefaultsForm
              token={token}
              evrakDefaults={evrakDefaults}
              schoolName={school?.name}
              schoolPrincipal={me?.school?.principalName ?? undefined}
              onSuccess={refetchMe}
            />
          </CardContent>
        </Card>
      )}

      {tab === 'limitlerim' && (
        <Card className="overflow-hidden border-border/50 shadow-sm bg-card/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <CardContent className="py-12 md:py-14">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-muted/60 via-muted/40 to-muted/60 dark:from-zinc-800 dark:via-zinc-700/80 dark:to-zinc-800 ring-2 ring-border/20 dark:ring-zinc-600/40 transition-all duration-300">
                <BarChart3 className="size-7 text-muted-foreground" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Limitlerim</h3>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground leading-relaxed">
                  Kullanım limitleri ve kotanız burada görüntülenecektir. Bu özellik yakında eklenecektir.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'yedek' && (
        <Card className="overflow-hidden border-border/50 shadow-sm bg-card/90 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/95">
          <CardHeader className="border-b border-border/50 bg-muted/20 dark:border-zinc-800 dark:bg-zinc-900/80">
            <CardTitle className="flex items-center gap-2">
              <FileDown className="size-5 text-primary" />
              Veri indirme ve yedek
            </CardTitle>
            <CardDescription>
              Modül seçerek JSON yedeği alın. Hesap verisi KVKK kapsamındaki özet içerir; Öğretmen Ajandası not/görev
              vb. dahildir.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 md:p-5">
            <BackupExportPanel token={token} enabledModules={me?.school?.enabled_modules ?? null} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
