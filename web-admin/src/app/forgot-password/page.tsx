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
  'w-full rounded-lg border border-input bg-background px-2.5 py-1.5 pl-9 text-sm text-foreground placeholder:text-muted-foreground/80 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15 sm:rounded-xl sm:px-3 sm:py-2 sm:pl-10';

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
    <AuthPageShell>
      <AuthCard>
        <CardHeader className="space-y-0.5 px-3 pb-1.5 pt-2.5 sm:px-5 sm:pb-2 sm:pt-3.5">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground sm:text-base">Şifre sıfırlama</h2>
          <p className="text-[10px] text-muted-foreground sm:text-xs">E-postaya bağlantı</p>
        </CardHeader>
        <CardContent className="space-y-2.5 px-3 pb-3 pt-0 sm:space-y-3 sm:px-5 sm:pb-4">
          <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3">
            <div>
              <label htmlFor="forgot-email" className="mb-0.5 block text-[11px] font-medium text-foreground sm:text-xs">
                E-posta <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70 sm:left-3 sm:size-4" aria-hidden />
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ornek@okul.edu.tr"
                  autoComplete="email"
                  required
                  disabled={loading}
                  className={cn(inputClass, 'disabled:opacity-60')}
                />
              </div>
            </div>
            {error && <Alert message={error} className="px-2.5 py-2 text-[11px] leading-snug [&_svg]:size-4" />}
            {success && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2 text-[11px] leading-snug text-emerald-900 dark:text-emerald-100 sm:rounded-xl sm:px-3 sm:py-2.5 sm:text-xs"
              >
                {success}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="flex w-full items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-2.5"
            >
              {loading ? <LoadingDots className="text-primary-foreground" /> : 'Sıfırlama bağlantısı gönder'}
            </button>
          </form>

          <AuthCompactDetails
            icon={<Info className="size-3.5" strokeWidth={2} aria-hidden />}
            title="E-posta gelmezse"
          >
            Spam / gereksiz klasörüne bakın; birkaç dakika sürebilir.
          </AuthCompactDetails>

          <p className="pt-0.5 text-center text-[10px] text-muted-foreground sm:text-xs">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              ← Giriş
            </Link>
          </p>
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}
