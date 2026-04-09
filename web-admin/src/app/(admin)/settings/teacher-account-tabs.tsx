'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  User,
  Building2,
  Users,
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
import { formatSchoolTypeLabel } from '@/lib/school-labels';

const fieldIn = cn(
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground shadow-sm',
  'transition-[color,box-shadow] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15',
  'max-sm:h-8 max-sm:px-2 max-sm:text-[13px] sm:rounded-lg sm:px-3',
);
const fieldInEye = cn(fieldIn, 'pr-9 sm:pr-10');
const lblB = 'mb-0.5 block text-xs font-medium text-foreground sm:mb-1 sm:text-sm';
const lblRow = 'mb-0 flex items-center gap-1.5 text-xs font-medium text-foreground sm:gap-2 sm:text-sm';
const iconBox = 'flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 sm:size-7';

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

type TabId = 'hesap' | 'okul' | 'zumre' | 'yedek';

const TABS: { id: TabId; label: string; ariaLabel: string; icon: React.ElementType }[] = [
  { id: 'hesap', label: 'Hesap', ariaLabel: 'Hesap', icon: User },
  { id: 'okul', label: 'Okul', ariaLabel: 'Okul ve branş', icon: Building2 },
  { id: 'zumre', label: 'Zümre', ariaLabel: 'Zümre', icon: Users },
  { id: 'yedek', label: 'Yedek', ariaLabel: 'Yedek', icon: FileDown },
];

const TAB_STYLE: Record<
  TabId,
  { active: string; idle: string; iconActive: string; iconIdle: string }
> = {
  hesap: {
    active:
      'bg-sky-600 text-white shadow-md ring-2 ring-sky-400/45 dark:bg-sky-500 dark:ring-sky-300/35',
    idle:
      'border border-sky-200/80 bg-sky-500/12 text-sky-950 hover:bg-sky-500/22 dark:border-sky-800/60 dark:bg-sky-950/45 dark:text-sky-100 dark:hover:bg-sky-900/55',
    iconActive: 'text-white',
    iconIdle: 'text-sky-600 dark:text-sky-400',
  },
  okul: {
    active:
      'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400/45 dark:bg-emerald-600 dark:ring-emerald-300/35',
    idle:
      'border border-emerald-200/80 bg-emerald-500/12 text-emerald-950 hover:bg-emerald-500/22 dark:border-emerald-800/60 dark:bg-emerald-950/45 dark:text-emerald-100 dark:hover:bg-emerald-900/55',
    iconActive: 'text-white',
    iconIdle: 'text-emerald-600 dark:text-emerald-400',
  },
  zumre: {
    active:
      'bg-violet-600 text-white shadow-md ring-2 ring-violet-400/45 dark:bg-violet-500 dark:ring-violet-300/35',
    idle:
      'border border-violet-200/80 bg-violet-500/12 text-violet-950 hover:bg-violet-500/22 dark:border-violet-800/60 dark:bg-violet-950/45 dark:text-violet-100 dark:hover:bg-violet-900/55',
    iconActive: 'text-white',
    iconIdle: 'text-violet-600 dark:text-violet-400',
  },
  yedek: {
    active:
      'bg-amber-500 text-amber-950 shadow-md ring-2 ring-amber-400/55 dark:bg-amber-500 dark:text-amber-950 dark:ring-amber-300/40',
    idle:
      'border border-amber-200/90 bg-amber-500/15 text-amber-950 hover:bg-amber-500/28 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-900/50',
    iconActive: 'text-amber-950 dark:text-amber-950',
    iconIdle: 'text-amber-700 dark:text-amber-400',
  },
};

const TAB_IDS: TabId[] = ['hesap', 'okul', 'zumre', 'yedek'];

export function TeacherAccountTabs() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
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

  const goTab = (id: TabId) => {
    if (tab === id) return;
    setTab(id);
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', id);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

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
    <div className="space-y-2.5 sm:space-y-5">
      <div
        className="rounded-lg border border-border/60 bg-linear-to-r from-sky-500/8 via-violet-500/6 to-amber-500/8 p-1 shadow-md ring-1 ring-black/8 dark:border-zinc-700 dark:from-zinc-900/80 dark:via-zinc-900/60 dark:to-zinc-900/80 dark:ring-white/8 sm:rounded-xl sm:p-1.5"
        role="tablist"
        aria-label="Profil bölümleri"
      >
        <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:grid sm:grid-cols-4 sm:gap-1.5 sm:overflow-visible sm:pb-0 [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            const st = TAB_STYLE[t.id];
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={t.ariaLabel}
                onClick={() => goTab(t.id)}
                className={cn(
                  'flex min-h-10 min-w-19 shrink-0 snap-start items-center justify-center gap-1 rounded-lg px-2 py-2 text-center text-[11px] font-bold tracking-tight transition-[color,box-shadow,background-color,border-color] duration-200 sm:min-h-12 sm:min-w-0 sm:gap-2 sm:rounded-xl sm:py-2.5 sm:text-sm',
                  isActive ? st.active : st.idle,
                )}
              >
                <Icon
                  className={cn('size-3.5 shrink-0 sm:size-4', isActive ? st.iconActive : st.iconIdle)}
                  aria-hidden
                />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sekme içerikleri */}
      {tab === 'hesap' && (
        <Card className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:border-border/80 dark:bg-card dark:ring-white/6 sm:rounded-xl sm:border-2 sm:shadow-md sm:ring-black/4">
          <CardHeader className="border-b border-border/50 bg-muted/25 px-2.5 py-2 dark:border-zinc-800 sm:px-6 sm:py-4">
            <CardTitle className="text-[15px] sm:text-lg">Profil düzenle</CardTitle>
            <CardDescription className="text-[11px] sm:text-sm">Ad, şifre ve hesap.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 p-2.5 sm:space-y-5 sm:p-5">
            <section className="space-y-1.5 sm:space-y-2">
              <AvatarPickerField
                value={avatarKey}
                onChange={setAvatarKey}
                disabled={savingProfile}
                idPrefix="hesap-av"
                compact
              />
            </section>

            {/* Görünen ad */}
            <section className="space-y-1 sm:space-y-1.5">
              <label htmlFor="hesap-ad" className={lblRow}>
                <span className={iconBox}>
                  <User className="size-3.5 text-primary" />
                </span>
                Görünen ad
              </label>
              <form onSubmit={handleSaveProfile} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
                <div className="w-full min-w-0 sm:min-w-[180px] sm:flex-1">
                  <input
                    id="hesap-ad"
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={255}
                    className={cn(fieldIn, 'placeholder:text-muted-foreground/70')}
                    placeholder="Ad Soyad"
                  />
                </div>
                <Button type="submit" disabled={savingProfile} size="sm" className="h-8 w-full shrink-0 sm:h-9 sm:w-auto">
                  {savingProfile ? 'Kaydediliyor…' : 'Kaydet'}
                </Button>
              </form>
              {profileError && <Alert message={profileError} />}
              <label className="mt-2 flex cursor-pointer items-start gap-2 sm:mt-2.5 sm:gap-2.5">
                <input
                  type="checkbox"
                  checked={nameMasked}
                  onChange={(e) => setNameMasked(e.target.checked)}
                  className="mt-0.5 size-3.5 shrink-0 rounded border-input"
                />
                <span className="text-xs text-muted-foreground leading-snug">
                  Okuldaki öğretmenlere tam adı gösterme; nöbette kısalt.
                </span>
              </label>
            </section>

            {/* E-Posta */}
            <section className="space-y-1.5 rounded-lg border border-border/60 bg-linear-to-br from-muted/30 via-muted/20 to-muted/30 p-2.5 transition-all duration-300 dark:border-zinc-700/60 dark:from-zinc-800/50 dark:via-zinc-800/30 dark:to-zinc-800/50 sm:space-y-2 sm:rounded-xl sm:p-4">
              <label className={cn(lblRow, 'gap-1.5')}>
                <Mail className="size-3.5 shrink-0 text-primary sm:size-4" />
                E-posta (sabit)
              </label>
              <input
                type="email"
                value={me?.email ?? ''}
                readOnly
                className={cn(fieldIn, 'border-border/60 bg-muted/30 dark:bg-zinc-800/50 dark:border-zinc-700')}
              />
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground sm:text-xs">
                <Info className="size-3 shrink-0" />
                Değiştirilemez.
              </p>
              <div className="flex items-center gap-1.5 rounded-md border border-emerald-200/80 bg-linear-to-r from-emerald-50/60 to-emerald-100/30 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-800/50 dark:from-emerald-950/40 dark:via-emerald-900/30 dark:to-emerald-950/40 dark:text-emerald-200 sm:gap-2 sm:px-3 sm:py-2 sm:text-sm">
                <CheckCircle2 className="size-3.5 shrink-0 sm:size-4" />
                Doğrulandı
              </div>
            </section>

            {/* Şifre Değiştir */}
            <section className="space-y-1.5 rounded-lg border border-border/60 bg-linear-to-br from-muted/20 via-muted/10 to-muted/20 p-2.5 transition-all duration-300 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/20 dark:to-zinc-800/40 sm:space-y-2 sm:rounded-xl sm:p-4">
              <h3 className={cn(lblRow, 'font-medium')}>
                <span className={iconBox}>
                  <User className="size-3.5 text-primary" />
                </span>
                Şifre
              </h3>
              <p className="text-[11px] text-muted-foreground sm:text-xs">Boş bırakılabilir.</p>
              <form onSubmit={handleChangePassword} className="space-y-2 sm:space-y-4">
                {passwordError && <Alert message={passwordError} />}
                <div className="grid gap-2 sm:grid-cols-3 sm:gap-4">
                  <div className="space-y-0.5 sm:space-y-1">
                    <label htmlFor="mevcut-sifre" className={lblB}>
                      Mevcut
                    </label>
                    <input
                      id="mevcut-sifre"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      className={fieldIn}
                      placeholder="········"
                    />
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    <label htmlFor="yeni-sifre" className={lblB}>
                      Yeni
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
                        className={fieldInEye}
                        placeholder="Opsiyonel"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground sm:right-3"
                      >
                        {showNewPass ? <EyeOff className="size-3.5 sm:size-4" /> : <Eye className="size-3.5 sm:size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-0.5 sm:space-y-1">
                    <label htmlFor="sifre-tekrar" className={lblB}>
                      Tekrar
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
                        className={fieldInEye}
                        placeholder="Tekrar"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground sm:right-3"
                      >
                        {showConfirmPass ? <EyeOff className="size-3.5 sm:size-4" /> : <Eye className="size-3.5 sm:size-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button type="submit" disabled={savingPassword} size="sm" className="h-8 sm:h-9">
                  {savingPassword ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
                </Button>
              </form>
            </section>

            {/* Hesap kapatma */}
            <section className="space-y-1.5 rounded-lg border border-border/60 bg-linear-to-br from-muted/20 via-muted/10 to-muted/20 p-2.5 transition-all duration-300 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/20 dark:to-zinc-800/40 sm:space-y-2 sm:rounded-xl sm:p-4">
              <h3 className="text-xs font-semibold text-foreground sm:text-sm">Hesap kapatma</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Önce veri için <strong>Yedek</strong> sekmesi.
              </p>
              <DeleteAccountButton token={token} />
            </section>
          </CardContent>
        </Card>
      )}

      {tab === 'okul' && (
        <Card className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:border-border/80 dark:bg-card dark:ring-white/6 sm:rounded-xl sm:border-2 sm:shadow-md sm:ring-black/4">
          <CardContent className="p-2.5 sm:p-5">
            {me?.teacher_school_membership === 'pending' && (
              <div className="mb-3 flex items-start gap-1.5 rounded-lg border border-amber-200/80 bg-amber-50/80 px-2.5 py-2 text-xs text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100 sm:mb-4 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm">
                <Clock className="size-4 shrink-0 mt-0.5" />
                <span>Yönetici onayı bekleniyor.</span>
              </div>
            )}
            {me?.school_verified && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-emerald-200/80 bg-emerald-50/60 px-2.5 py-2 text-xs font-medium text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-100 sm:mb-4 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-sm">
                <ShieldCheck className="size-4 shrink-0" />
                Okul öğretmeni doğrulandı
              </div>
            )}
            <form onSubmit={handleSaveOkul} className="space-y-3 sm:space-y-4">
              {okulError && <Alert message={okulError} />}
              <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
                <div className="space-y-1 rounded-lg border border-border/60 bg-linear-to-br from-muted/15 via-muted/10 to-muted/15 p-2.5 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/25 dark:to-zinc-800/40 sm:rounded-xl sm:p-4">
                  <label htmlFor="okul-brans" className={cn(lblRow, 'mb-0')}>
                    <span className={iconBox}>
                      <Building2 className="size-3.5 text-primary" />
                    </span>
                    Branş
                  </label>
                  <select
                    id="okul-brans"
                    value={branchSelect}
                    onChange={(e) => setBranchSelect(e.target.value)}
                    className={cn(fieldIn, 'cursor-pointer')}
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
                <div className="space-y-1 rounded-lg border border-border/60 bg-linear-to-br from-muted/15 via-muted/10 to-muted/15 p-2.5 dark:border-zinc-700/60 dark:from-zinc-800/40 dark:via-zinc-800/25 dark:to-zinc-800/40 sm:rounded-xl sm:p-4">
                  <label className={cn(lblRow, 'mb-0')}>
                    <span className={iconBox}>
                      <User className="size-3.5 text-primary" />
                    </span>
                    Görev
                  </label>
                  <p className="text-sm font-medium text-foreground">Öğretmen</p>
                </div>
              </div>
              <div className="space-y-1.5 rounded-lg border border-border/60 bg-linear-to-r from-muted/10 via-muted/5 to-muted/10 p-2.5 dark:border-zinc-700/60 dark:from-zinc-800/30 dark:via-zinc-800/20 dark:to-zinc-800/30 sm:rounded-xl sm:p-4">
                <p className="text-[11px] text-muted-foreground sm:text-sm">İl/ilçe ile okul seçin.</p>
                <SchoolSelectWithFilter
                  value={schoolId}
                  onChange={setSchoolId}
                  token={token}
                  placeholder="Okul seçin"
                  initialCity={school?.city}
                  initialDistrict={school?.district}
                />
              </div>
              <div className="space-y-1 rounded-lg border border-border/60 bg-linear-to-br from-muted/15 via-muted/10 to-muted/15 p-2.5 sm:rounded-xl sm:p-4">
                <label className={cn(lblRow, 'mb-0')}>
                  <span className={iconBox}>
                    <Building2 className="size-3.5 text-primary" />
                  </span>
                  Kurum türü
                </label>
                <p className={cn('text-sm font-medium', school?.type ? 'text-foreground' : 'text-muted-foreground/70 italic')}>
                  {school?.type ? formatSchoolTypeLabel(school.type) : 'Okul seçin'}
                </p>
              </div>
              <div className="flex justify-end pt-0.5">
                <Button type="submit" disabled={savingOkul} size="sm" className="h-8 gap-1.5 sm:h-9 sm:gap-2">
                  <CheckCircle2 className="size-4" />
                  {savingOkul ? 'Kaydediliyor…' : 'Güncelle'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'zumre' && (
        <Card className="overflow-hidden rounded-lg border border-violet-200/50 bg-card shadow-sm ring-1 ring-violet-500/10 backdrop-blur-sm dark:border-violet-900/35 dark:bg-card dark:ring-violet-500/10 sm:rounded-xl sm:border-2 sm:shadow-md">
          <CardHeader className="border-b border-violet-200/40 bg-linear-to-r from-violet-500/12 via-violet-500/8 to-fuchsia-500/10 px-2.5 py-2 dark:border-violet-900/50 dark:from-violet-950/50 dark:via-violet-950/35 dark:to-fuchsia-950/30 sm:px-5 sm:py-4">
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/20 text-violet-700 shadow-inner dark:bg-violet-500/25 dark:text-violet-200 sm:size-9 sm:rounded-xl">
                <Users className="size-3.5 sm:size-4" />
              </div>
              <div className="min-w-0 space-y-0.5">
                <CardTitle className="text-sm font-semibold leading-tight sm:text-base">Zümre ve evrak varsayılanları</CardTitle>
                <CardDescription className="text-[11px] sm:text-xs">
                  Okul adı kayıttan; müdür adı zümre listesinde «Okul Müdürü» satırından. İmza, liste ve tarihler burada — evrak ve yıllık planda kullanılır.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-2.5 sm:p-5">
            <EvrakDefaultsForm
              token={token}
              evrakDefaults={evrakDefaults}
              schoolName={school?.name}
              schoolDistrict={school?.district ?? undefined}
              schoolCity={school?.city ?? undefined}
              teacherBranch={me?.teacher_branch ?? undefined}
              schoolConnected={!!me?.school_id}
              onSuccess={refetchMe}
            />
          </CardContent>
        </Card>
      )}

      {tab === 'yedek' && (
        <Card className="overflow-hidden rounded-lg border border-border/80 bg-card shadow-sm ring-1 ring-black/5 backdrop-blur-sm dark:border-border/80 dark:bg-card dark:ring-white/6 sm:rounded-xl sm:border-2 sm:shadow-md sm:ring-black/4">
          <CardHeader className="border-b border-border/50 bg-muted/25 px-2.5 py-2 dark:border-zinc-800 sm:px-6 sm:py-4">
            <CardTitle className="flex items-center gap-2 text-[15px] sm:text-lg">
              <FileDown className="size-4 shrink-0 text-primary sm:size-5" />
              Yedek indir
            </CardTitle>
            <CardDescription className="text-[11px] sm:text-sm">
              Modül seç, JSON indir. KVKK özeti ve ajanda dahil.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2.5 sm:p-5">
            <BackupExportPanel token={token} enabledModules={me?.school?.enabled_modules ?? null} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
