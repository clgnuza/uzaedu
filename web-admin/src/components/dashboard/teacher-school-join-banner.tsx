'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import type { Me } from '@/providers/auth-provider';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Mail, ShieldAlert } from 'lucide-react';

type Props = { me: Me };

export function TeacherSchoolJoinBanner({ me }: Props) {
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  if (me.role !== 'teacher' || !me.school_id) return null;

  const stage = me.school_join_stage ?? 'none';
  if (stage === 'none') return null;

  const resend = async () => {
    setResendMsg('');
    setResending(true);
    try {
      await apiFetch<{ ok: boolean }>('/me/resend-school-join-email', { method: 'POST' });
      setResendMsg('Doğrulama bağlantısı e-posta adresinize gönderildi.');
    } catch (e) {
      setResendMsg(e instanceof Error ? e.message : 'Gönderilemedi.');
    } finally {
      setResending(false);
    }
  };

  if (stage === 'approved') {
    return null;
  }

  if (stage === 'email_pending') {
    return (
      <div className="space-y-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/25">
        <div className="flex flex-wrap items-start gap-2 text-sm text-amber-950 dark:text-amber-100">
          <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">E-posta adresinizi doğrulayın</p>
            <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-200/85">
              Gelen kutunuzdaki bağlantıya tıklayın; ardından okul yöneticiniz onayı tamamlar.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={resending} onClick={() => void resend()}>
            {resending ? 'Gönderiliyor…' : 'Bağlantıyı yeniden gönder'}
          </Button>
          {resendMsg && <span className="text-xs text-muted-foreground">{resendMsg}</span>}
        </div>
      </div>
    );
  }

  if (stage === 'school_pending') {
    return (
      <div className="space-y-2 rounded-xl border border-sky-200/80 bg-sky-50/90 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/25">
        <div className="flex flex-wrap items-start gap-2 text-sm text-sky-950 dark:text-sky-100">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Okul onayı bekleniyor</p>
            <p className="mt-1 text-xs text-sky-900/90 dark:text-sky-200/85">
              E-postanız doğrulandı. Okul yöneticisi onayladığında tam yetki ve e-posta ile giriş açılır. Çıkış yapıp tekrar
              girmeniz gerekirse Google, Apple veya telefon ile giriş kullanın.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'rejected') {
    return (
      <Alert variant="warning">
        <span>
          Okul başvurunuz reddedildi. Profilden yeni okul seçebilirsiniz:{' '}
          <Link href="/profile" className="font-medium text-primary underline">
            Profil
          </Link>
        </span>
      </Alert>
    );
  }

  return null;
}
