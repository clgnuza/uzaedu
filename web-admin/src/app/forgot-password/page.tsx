'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Info, Mail } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthCard } from '@/components/auth/auth-card';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';
import { AuthCompactDetails } from '@/components/auth/auth-compact-details';

type ForgotResponse = { ok: boolean; message: string };

const inputClass =
  'w-full rounded-md border border-input bg-background px-2 py-1.5 pl-8 text-[13px] text-foreground placeholder:text-muted-foreground/75 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 sm:rounded-lg sm:px-2.5 sm:py-2 sm:pl-9 sm:text-sm';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const e1 = email.trim().toLowerCase();
    if (!e1) {
      setError('E-posta adresi girin.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<ForgotResponse>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: e1 }),
      });
      if (res.ok === false) {
        setError(res.message ?? 'E-posta gönderilemedi.');
        return;
      }
      setSuccess(res.message ?? 'E-posta adresinize şifre sıfırlama bağlantısı gönderildi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPageShell compact eyebrow="Şifre sıfırlama">
      <AuthCard className="rounded-xl sm:rounded-2xl">
        <CardHeader className="space-y-0 px-2.5 pb-1 pt-2 sm:px-4 sm:pb-1.5 sm:pt-3">
          <h2 className="text-[0.8125rem] font-semibold leading-tight tracking-tight text-foreground sm:text-[0.9375rem]">
            Bağlantı iste
          </h2>
          <p className="text-[9px] leading-snug text-muted-foreground sm:text-[11px]">
            Kayıtlı e-postanıza sıfırlama linki gider.
          </p>
        </CardHeader>
        <CardContent className="space-y-2 px-2.5 pb-2.5 pt-0 sm:space-y-2.5 sm:px-4 sm:pb-3">
          <form onSubmit={handleSubmit} className="space-y-2 sm:space-y-2.5">
            <div>
              <label
                htmlFor="forgot-email"
                className="mb-0.5 block text-[10px] font-medium text-foreground sm:text-[11px]"
              >
                E-posta <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground/70 sm:left-2.5 sm:size-3.5"
                  aria-hidden
                />
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@okul.edu.tr"
                  autoComplete="email"
                  inputMode="email"
                  required
                  disabled={loading}
                  className={cn(inputClass, 'disabled:opacity-60')}
                />
              </div>
            </div>
            {error && (
              <Alert message={error} className="px-2 py-1.5 text-[10px] leading-snug [&_svg]:size-3.5 sm:text-[11px]" />
            )}
            {success && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1.5 text-[10px] leading-snug text-emerald-900 dark:text-emerald-100 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-[11px]"
              >
                {success}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="flex w-full items-center justify-center rounded-md bg-primary px-2.5 py-1.5 text-[13px] font-semibold text-primary-foreground shadow-md shadow-primary/15 transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-lg sm:px-3 sm:py-2 sm:text-sm"
            >
              {loading ? <LoadingDots className="text-primary-foreground" /> : 'Bağlantı gönder'}
            </button>
          </form>

          <AuthCompactDetails
            className="rounded-lg border-border/50"
            icon={<Info className="size-3" strokeWidth={2} aria-hidden />}
            title="E-posta gelmezse"
          >
            Spam klasörüne bakın; birkaç dakika sürebilir. Google ile kayıtlıysanız şifre sıfırlama yerine Google
            girişi kullanın.
          </AuthCompactDetails>

          <p className="pt-0 text-center text-[9px] text-muted-foreground sm:text-[10px]">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              Girişe dön
            </Link>
          </p>
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}
