'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { Alert } from '@/components/ui/alert';
import { AuthPageShell } from '@/components/auth/auth-page-shell';
import { AuthCard } from '@/components/auth/auth-card';
import { CardContent, CardHeader } from '@/components/ui/card';
import { LoadingDots } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

type ForgotResponse = { ok: boolean; message: string };

const inputClass =
  'w-full rounded-xl border border-input bg-background px-3 py-2 pl-10 text-sm text-foreground placeholder:text-muted-foreground/80 shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15';

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
        <CardHeader className="space-y-1 px-4 pb-2 pt-3.5 sm:px-5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">Şifre unuttum</h2>
          <p className="text-xs text-muted-foreground">
            Kayıtlı e-postanıza sıfırlama bağlantısı gönderilir.
          </p>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:px-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label htmlFor="forgot-email" className="mb-1 block text-xs font-medium text-foreground">
                E-posta <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" aria-hidden />
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
            {error && <Alert message={error} />}
            {success && (
              <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5 text-xs leading-relaxed text-emerald-900 dark:text-emerald-100"
              >
                {success}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-opacity hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <LoadingDots className="text-primary-foreground" /> : 'Sıfırlama bağlantısı gönder'}
            </button>
          </form>

          <p className="pt-1 text-center text-xs text-muted-foreground">
            <Link href="/login" className="font-semibold text-primary hover:underline">
              ← Girişe dön
            </Link>
          </p>
        </CardContent>
      </AuthCard>
    </AuthPageShell>
  );
}
