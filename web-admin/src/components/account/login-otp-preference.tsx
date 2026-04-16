'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LoginOtpPreference({
  token,
  initialRequired,
  onSaved,
  className,
}: {
  token: string | null;
  initialRequired: boolean;
  onSaved: () => void;
  className?: string;
}) {
  const [required, setRequired] = useState(initialRequired);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRequired(initialRequired);
  }, [initialRequired]);

  const apply = async (next: boolean) => {
    if (!token) return;
    setSaving(true);
    try {
      await apiFetch('/me', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ login_otp_required: next }),
      });
      setRequired(next);
      toast.success(next ? 'E-posta ile giriş doğrulaması açıldı.' : 'E-posta ile giriş doğrulaması kapatıldı.');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-border/60 bg-linear-to-br from-muted/20 via-muted/10 to-muted/20 p-2.5 dark:border-zinc-700/60 dark:from-zinc-800/40 sm:rounded-xl sm:p-4',
        className,
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
        <h3 className="text-xs font-semibold text-foreground sm:text-sm">Giriş doğrulaması</h3>
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground leading-snug sm:text-xs">
        E-posta ve şifreden sonra gönderilen 6 haneli kod. Kapatırsanız yalnızca şifreyle giriş yapılır (kayıt / ilk doğrulama
        kodu yine gerekir).
      </p>
      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="checkbox"
          className="mt-0.5 size-3.5 shrink-0 rounded border-input"
          checked={required}
          disabled={saving}
          onChange={(e) => void apply(e.target.checked)}
        />
        <span className="text-xs text-muted-foreground leading-snug">
          E-posta ile girişte doğrulama kodu iste (önerilir)
        </span>
      </label>
    </div>
  );
}
