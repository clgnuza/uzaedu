'use client';

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { resolveDefaultApiBase } from '@/lib/resolve-api-base';
import { cn } from '@/lib/utils';

/* ── Doğrulama ─────────────────────────────────────────────────── */
function validateField(key: string, value: string): string {
  switch (key) {
    case 'name':
      if (!value.trim()) return 'Ad Soyad zorunludur';
      if (value.trim().length < 2) return 'En az 2 karakter olmalıdır';
      return '';
    case 'email':
      if (!value.trim()) return 'E-posta adresi zorunludur';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Geçerli bir e-posta giriniz';
      return '';
    case 'subject':
      if (!value) return 'Lütfen bir konu seçin';
      return '';
    case 'message':
      if (!value.trim()) return 'Mesaj zorunludur';
      if (value.trim().length < 10) return 'En az 10 karakter olmalıdır';
      return '';
    default:
      return '';
  }
}

const SUBJECTS = [
  'Teknik Destek',
  'Fiyatlandırma ve Lisans',
  'Okul Kaydı',
  'Uygulama Önerisi',
  'Hata Bildirimi',
  'İş Birliği',
  'Diğer',
];

/* ── Hata ikoncu ───────────────────────────────────────────────── */
const ErrIcon = () => (
  <svg viewBox="0 0 16 16" fill="currentColor" className="size-3 shrink-0" aria-hidden>
    <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.75a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5ZM8 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z" clipRule="evenodd" />
  </svg>
);

type Status = 'idle' | 'loading' | 'success' | 'error' | 'rate_limited';

export default function IletisimPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const honeypotRef = useRef<HTMLInputElement>(null);
  const lastSentRef = useRef<number>(0);

  const validateAll = useCallback(() => {
    const errs: Record<string, string> = {};
    for (const k of ['name', 'email', 'subject', 'message'] as const) {
      const e = validateField(k, form[k]);
      if (e) errs[k] = e;
    }
    setErrors(errs);
    setTouched({ name: true, email: true, subject: true, message: true });
    return Object.keys(errs).length === 0;
  }, [form]);

  const handleChange = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const val = e.target.value;
      setForm((f) => ({ ...f, [k]: val }));
      if (touched[k]) setErrors((prev) => ({ ...prev, [k]: validateField(k, val) }));
    };

  const handleBlur = (k: keyof typeof form) => () => {
    setTouched((t) => ({ ...t, [k]: true }));
    setErrors((prev) => ({ ...prev, [k]: validateField(k, form[k]) }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (honeypotRef.current?.value) return;
    if (!validateAll()) return;
    if (Date.now() - lastSentRef.current < 30_000) { setStatus('rate_limited'); return; }
    setStatus('loading');
    setErrorMsg('');
    try {
      const base = resolveDefaultApiBase();
      const res = await fetch(`${base}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, website: '' }),
      });
      if (res.status === 429) { setStatus('rate_limited'); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string | string[] };
        const msg = Array.isArray(data.message) ? data.message[0] : data.message;
        throw new Error(msg ?? 'Bir hata oluştu');
      }
      lastSentRef.current = Date.now();
      setStatus('success');
      setForm({ name: '', email: '', subject: '', message: '' });
      setTouched({}); setErrors({});
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Sunucuya bağlanılamadı');
    }
  };

  const inputBase = 'w-full rounded-xl border px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none transition-all bg-background dark:bg-card';
  const inputOk  = 'border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/12 dark:border-border/50';
  const inputErr = 'border-red-400/70 focus:border-red-400 focus:ring-2 focus:ring-red-400/12 dark:border-red-600/60';
  const fieldCls = (k: string) => cn(inputBase, errors[k] ? inputErr : inputOk);

  return (
    <div className="relative min-h-screen">

      {/* ── Arka plan: güven verici degrade ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {/* Üst: derin lacivert → arka plan */}
        <div className="absolute inset-x-0 top-0 h-[420px] bg-linear-to-b from-[#0a1628] via-[#0d1f3c] to-transparent dark:from-[#060d1a] dark:via-[#0a1526] dark:to-transparent" />
        {/* Işık halkası */}
        <div className="absolute left-1/2 top-0 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(0,123,255,0.18)_0%,transparent_65%)]" />
        {/* Zemin ızgara */}
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[40px_40px]" />
      </div>

      {/* ── Hero bölümü ── */}
      <div className="relative px-4 pb-8 pt-14 text-center sm:pt-16">
        {/* Güven rozeti */}
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/8 px-4 py-1.5 backdrop-blur-sm">
          <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
          <span className="text-[11px] font-semibold tracking-wide text-white/80">Güvenli · Şifreli · 24 saat içinde yanıt</span>
        </div>

        <h1 className="mx-auto max-w-xs text-2xl font-extrabold tracking-tight text-white sm:max-w-none sm:text-3xl">
          Nasıl yardımcı olabiliriz?
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-white/60 sm:max-w-md">
          Sorunuzu veya talebinizi bizimle paylaşın,<br className="hidden sm:inline" /> ekibimiz kısa sürede size ulaşsın.
        </p>

        {/* 3 mini güven istatistiği */}
        <div className="mt-6 flex items-center justify-center gap-0.5">
          {[
            { icon: '⚡', text: '< 24 saat yanıt' },
            { icon: '🔒', text: 'Güvenli iletim' },
            { icon: '🇹🇷', text: 'Türkçe destek' },
          ].map((s, i) => (
            <div key={s.text} className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white/70',
              i < 2 && 'border-r border-white/15',
            )}>
              <span>{s.icon}</span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Ana içerik ── */}
      <div className="relative mx-auto max-w-lg px-4 pb-16 pt-2 sm:px-6">

        {/* Form kartı */}
        <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-xl dark:border-border/35 dark:bg-card/95">
          {/* Üst renk şeridi */}
          <div className="h-[3px] bg-linear-to-r from-primary via-blue-400 to-violet-500" />

          <div className="p-5 sm:p-7">
            {status === 'success' ? (
              /* Başarı */
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-8 text-emerald-600 dark:text-emerald-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-foreground">Mesajınız iletildi!</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">uzaeduapp@gmail.com</span> adresinden<br />en kısa sürede geri döneceğiz.
                </p>
                <button onClick={() => setStatus('idle')}
                  className="mt-5 rounded-xl border border-border/50 bg-muted/50 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
                  Yeni mesaj gönder
                </button>
              </div>

            ) : status === 'rate_limited' ? (
              /* Hız limiti */
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/40">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-8 text-amber-600 dark:text-amber-400">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold text-foreground">Çok fazla istek</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">Lütfen birkaç dakika bekleyip tekrar deneyin.</p>
                <button onClick={() => setStatus('idle')}
                  className="mt-5 rounded-xl border border-border/50 bg-muted/50 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent">
                  Geri dön
                </button>
              </div>

            ) : (
              /* Form */
              <form onSubmit={submit} noValidate>
                {/* Honeypot */}
                <div className="absolute opacity-0 pointer-events-none" aria-hidden tabIndex={-1}>
                  <input ref={honeypotRef} type="text" name="website" autoComplete="off" tabIndex={-1} />
                </div>

                <p className="mb-5 text-xs text-muted-foreground">
                  Mesajınız <span className="font-medium text-foreground">uzaeduapp@gmail.com</span> adresine iletilir.
                </p>

                <div className="space-y-4">
                  {/* Ad Soyad + E-posta yan yana (sm+) */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Ad Soyad */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Ad Soyad <span className="text-red-500">*</span>
                      </label>
                      <input type="text" placeholder="Adınız soyadınız"
                        value={form.name} onChange={handleChange('name')} onBlur={handleBlur('name')}
                        className={fieldCls('name')} />
                      {touched.name && errors.name && (
                        <p className="flex items-center gap-1 text-[11px] text-red-500 dark:text-red-400">
                          <ErrIcon />{errors.name}
                        </p>
                      )}
                    </div>

                    {/* E-posta */}
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        E-posta <span className="text-red-500">*</span>
                      </label>
                      <input type="email" placeholder="ornek@mail.com"
                        value={form.email} onChange={handleChange('email')} onBlur={handleBlur('email')}
                        className={fieldCls('email')} />
                      {touched.email && errors.email && (
                        <p className="flex items-center gap-1 text-[11px] text-red-500 dark:text-red-400">
                          <ErrIcon />{errors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Konu */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Konu <span className="text-red-500">*</span>
                    </label>
                    <select value={form.subject} onChange={handleChange('subject')} onBlur={handleBlur('subject')}
                      className={cn(fieldCls('subject'), !form.subject && 'text-muted-foreground/50')}>
                      <option value="">Konu seçin...</option>
                      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {touched.subject && errors.subject && (
                      <p className="flex items-center gap-1 text-[11px] text-red-500 dark:text-red-400">
                        <ErrIcon />{errors.subject}
                      </p>
                    )}
                  </div>

                  {/* Mesaj */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">
                      Mesajınız <span className="text-red-500">*</span>
                    </label>
                    <textarea rows={4} placeholder="Mesajınızı buraya yazın..."
                      value={form.message} onChange={handleChange('message')} onBlur={handleBlur('message')}
                      className={cn(fieldCls('message'), 'resize-none')} />
                    <div className="flex items-center justify-between">
                      {touched.message && errors.message
                        ? <p className="flex items-center gap-1 text-[11px] text-red-500 dark:text-red-400"><ErrIcon />{errors.message}</p>
                        : <span />}
                      <p className={cn('text-[10px]', form.message.length > 1900 ? 'text-amber-500' : 'text-muted-foreground/50')}>
                        {form.message.length}/2000
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sunucu hatası */}
                {status === 'error' && (
                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50 px-3.5 py-3 dark:border-red-900/30 dark:bg-red-950/20">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0 text-red-500" aria-hidden>
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-red-700 dark:text-red-400">{errorMsg || 'Mesaj gönderilemedi.'}</p>
                  </div>
                )}

                {/* Gönder */}
                <button type="submit" disabled={status === 'loading'}
                  className={cn(
                    'mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-sm transition-all duration-200',
                    'bg-primary hover:bg-primary/90 active:scale-[0.98]',
                    status === 'loading' && 'opacity-70 cursor-not-allowed',
                  )}>
                  {status === 'loading' ? (
                    <>
                      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Gönderiliyor...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden>
                        <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
                      </svg>
                      Mesaj Gönder
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Kart alt güven şeridi */}
          {status !== 'success' && status !== 'rate_limited' && (
            <div className="flex items-center justify-center gap-4 border-t border-border/40 bg-muted/30 px-5 py-3">
              {[
                { icon: '🔒', text: 'SSL Şifreli' },
                { icon: '🛡️', text: 'Spam Korumalı' },
                { icon: '✉️', text: 'uzaeduapp@gmail.com' },
              ].map((b) => (
                <div key={b.text} className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <span>{b.icon}</span>
                  <span>{b.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sosyal medya kısa linkleri */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {[
            { label: 'Instagram', href: 'https://instagram.com/uzaeduapp' },
            { label: 'X',         href: 'https://x.com/uzaeduapp' },
            { label: 'YouTube',   href: 'https://youtube.com/@uzaeduapp' },
            { label: 'LinkedIn',  href: 'https://linkedin.com/company/uzaeduapp' },
          ].map((s) => (
            <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
              className="rounded-lg border border-border/50 bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:border-primary/30 hover:text-primary">
              {s.label}
            </a>
          ))}
        </div>

        <p className="mt-5 text-center text-[11px] text-muted-foreground/50">
          Zaten hesabınız var mı?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">Giriş yap</Link>
        </p>
      </div>
    </div>
  );
}
