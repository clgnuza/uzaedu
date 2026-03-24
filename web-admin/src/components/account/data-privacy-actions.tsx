'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2 } from 'lucide-react';
import { apiFetch, type ApiError } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Bir hata oluştu';
}

function triggerJsonDownload(data: Record<string, unknown>, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataExportButton({ token }: { token: string | null }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    if (!token) {
      toast.error('Oturum bulunamadı');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<Record<string, unknown>>('/me/data-export', { method: 'GET', token });
      const safeName = `ogretmenpro-verilerim-${new Date().toISOString().slice(0, 10)}.json`;
      triggerJsonDownload(data, safeName);
      toast.success('Verileriniz indirildi');
    } catch (e) {
      const err = e as ApiError;
      toast.error(err?.message ? String(err.message) : errorMessage(e));
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!token || loading}
      aria-busy={loading}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
    >
      <Download className="size-4 shrink-0" aria-hidden />
      {loading ? 'İndiriliyor…' : 'Verilerimi indir'}
    </button>
  );
}

/** Diyalogda birebir yazılması gereken onay metni (Türkçe büyük/küçük harf eşleşmesi). */
const DELETE_CONFIRM_PHRASE = 'hesabımı sil';

function confirmPhraseMatches(input: string): boolean {
  return input.trim().toLocaleLowerCase('tr-TR') === DELETE_CONFIRM_PHRASE;
}

export function DeleteAccountButton({ token }: { token: string | null }) {
  const router = useRouter();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const handleOpenChange = (next: boolean) => {
    if (loading && !next) return;
    setOpen(next);
    if (!next) {
      setCurrentPassword('');
      setConfirmText('');
    }
  };

  const handleDelete = async () => {
    if (!token) {
      toast.error('Oturum bulunamadı');
      return;
    }
    if (!confirmPhraseMatches(confirmText)) {
      toast.error('Onay metnini doğru yazın');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/me/account', {
        method: 'DELETE',
        token,
        body: JSON.stringify({ current_password: currentPassword.trim() || undefined }),
      });
      setOpen(false);
      setCurrentPassword('');
      setConfirmText('');
      logout();
      toast.success('Hesabınız kapatıldı');
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      toast.error(err?.message ? String(err.message) : errorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!token}
        className="inline-flex items-center gap-2 rounded-lg border border-destructive/50 bg-background px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
      >
        <Trash2 className="size-4 shrink-0" aria-hidden />
        Hesabımı sil
      </button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent title="Hesabı kapat">
          <p className="mb-4 text-sm text-muted-foreground">
            Bu işlem geri alınamaz. Hesabınız kapatılır; e-posta ve kişisel veriler anonimleştirilir, bu adresle tekrar
            giriş yapılamaz.
          </p>
          <label htmlFor="delete-account-confirm" className="mb-1.5 block text-sm font-medium text-foreground">
            Onay için kutuya şunu yazın: <span className="font-mono text-foreground">HESABIMI SİL</span>
          </label>
          <input
            id="delete-account-confirm"
            type="text"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="mb-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="HESABIMI SİL"
            aria-invalid={confirmText.length > 0 && !confirmPhraseMatches(confirmText)}
          />
          <label htmlFor="delete-account-password" className="mb-1.5 block text-sm font-medium text-foreground">
            Mevcut şifre
          </label>
          <input
            id="delete-account-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mb-6 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
            placeholder="Şifre ile giriş yapıyorsanız zorunlu"
          />
          <p className="mb-6 text-xs text-muted-foreground">
            Sadece e-posta / sosyal giriş kullanıyorsanız şifre alanını boş bırakın.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              İptal
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading || !confirmPhraseMatches(confirmText)}
              aria-busy={loading}
              className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'İşleniyor…' : 'Evet, kapat'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
