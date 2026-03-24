'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { AvatarPickerField } from '@/components/account/avatar-picker';

export function EditProfileForm({
  token,
  displayName: initialDisplayName,
  avatarKey: initialAvatarKey,
  onSuccess,
}: {
  token: string | null;
  displayName: string;
  avatarKey?: string | null;
  onSuccess: () => void;
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert message={error} />}
      <AvatarPickerField value={avatarKey} onChange={setAvatarKey} disabled={submitting} idPrefix="profile-av" />
      <div>
        <label htmlFor="profile-display-name" className="block text-sm font-medium text-foreground">
          Görünen ad
        </label>
        <input
          id="profile-display-name"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={255}
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="Adınız soyadınız"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert message={error} />}
      <div>
        <label htmlFor="current-password" className="block text-sm font-medium text-foreground">
          Mevcut şifre
        </label>
        <input
          id="current-password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="Mevcut şifreniz"
        />
      </div>
      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-foreground">
          Yeni şifre
        </label>
        <p className="mt-0.5 text-xs text-muted-foreground">8–128 karakter; en az bir harf ve bir rakam.</p>
        <input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="Yeni şifre"
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-foreground">
          Yeni şifre (tekrar)
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
          className="mt-1.5 w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
          placeholder="Yeni şifreyi tekrar girin"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        aria-busy={submitting}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? 'Kaydediliyor…' : 'Şifreyi güncelle'}
      </button>
    </form>
  );
}
