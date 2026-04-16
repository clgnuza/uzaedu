'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { AvatarPickerField } from '@/components/account/avatar-picker';
import { UserAvatarBubble } from '@/components/user-avatar';
import { cn } from '@/lib/utils';

const profileInput = cn(
  'h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm text-foreground shadow-sm',
  'focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15',
  'max-sm:h-8 max-sm:px-2 max-sm:text-[13px] sm:rounded-lg sm:px-3',
);
const profileLabel = 'mb-0.5 block text-xs font-medium text-foreground sm:mb-1 sm:text-sm';

export function EditProfileForm({
  token,
  displayName: initialDisplayName,
  avatarKey: initialAvatarKey,
  avatarUrl,
  onSuccess,
  compact,
}: {
  token: string | null;
  displayName: string;
  avatarKey?: string | null;
  avatarUrl?: string | null;
  onSuccess: () => void;
  /** Öğretmen hesap sekmesi ile aynı: mobilde daha küçük ikon ızgarası */
  compact?: boolean;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarKey, setAvatarKey] = useState<string | null>(initialAvatarKey ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(initialDisplayName);
  }, [initialDisplayName]);

  useEffect(() => {
    setAvatarKey(initialAvatarKey ?? null);
  }, [initialAvatarKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({
          display_name: displayName.trim() || null,
          avatar_key: avatarKey,
        }),
      });
      toast.success('Profil güncellendi');
      onSuccess();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Güncellenemedi';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-3 sm:space-y-4', compact && 'max-sm:space-y-2')}>
      {error && <Alert message={error} />}
      <div
        className={cn(
          'w-full min-w-0 max-w-full border border-border/50 bg-muted/10',
          compact ? 'rounded-lg p-2.5 sm:rounded-xl sm:p-4' : 'rounded-xl p-3 sm:p-4',
        )}
      >
        <div
          className={cn(
            'flex flex-col items-stretch lg:flex-row lg:items-start',
            compact ? 'gap-2.5 lg:gap-4' : 'gap-3 lg:gap-5',
          )}
        >
          <div className={cn('flex flex-col items-center gap-1 lg:shrink-0', compact ? 'lg:w-[100px]' : 'lg:w-[104px]')}>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Önizleme</span>
            <UserAvatarBubble
              avatarKey={avatarKey}
              avatarUrl={avatarUrl ?? null}
              displayName={displayName}
              email=""
              size="lg"
            />
          </div>
          <div className="min-w-0 flex-1">
            <AvatarPickerField
              value={avatarKey}
              onChange={setAvatarKey}
              disabled={submitting}
              idPrefix="profile-av"
              compact={compact}
            />
          </div>
        </div>
      </div>
      <div className="space-y-0.5 sm:space-y-1">
        <label htmlFor="profile-display-name" className={profileLabel}>
          Görünen ad
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={255}
          className={profileInput}
          placeholder="Ad Soyad"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:rounded-lg sm:px-4"
      >
        {submitting ? 'Kaydediliyor…' : 'Kaydet'}
      </button>
    </form>
  );
}

export function ChangePasswordForm({ token }: { token: string | null }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (newPassword.length < 8 || newPassword.length > 128) {
      setError('Yeni şifre 8–128 karakter arasında olmalıdır.');
      return;
    }
    if (!/^(?=.*\p{L})(?=.*\d).{8,128}$/u.test(newPassword)) {
      setError('Şifre en az bir harf ve bir rakam içermelidir.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifre ve tekrarı eşleşmiyor.');
      return;
    }
    setSubmitting(true);
    setError(null);
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
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-4">
      {error && <Alert message={error} />}
      <div className="space-y-0.5 sm:space-y-1">
        <label htmlFor="current-password" className={profileLabel}>
          Mevcut şifre
        </label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={profileInput}
          placeholder="········"
        />
      </div>
      <div className="space-y-0.5 sm:space-y-1">
        <label htmlFor="new-password" className={profileLabel}>
          Yeni şifre
        </label>
        <p className="text-[11px] text-muted-foreground sm:text-xs">8–128 karakter, harf + rakam.</p>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className={profileInput}
          placeholder="Yeni şifre"
        />
      </div>
      <div className="space-y-0.5 sm:space-y-1">
        <label htmlFor="confirm-password" className={profileLabel}>
          Tekrar
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className={profileInput}
          placeholder="Tekrar"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:rounded-lg sm:px-4"
      >
        {submitting ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
      </button>
    </form>
  );
}
