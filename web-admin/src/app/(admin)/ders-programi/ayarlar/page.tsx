'use client';

import { useAuth } from '@/hooks/use-auth';
import { ZamanCizelgesiForm } from '@/components/ders-programi/zaman-cizelgesi-form';
import { Settings2 } from 'lucide-react';

export default function DersProgramiAyarlarPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'school_admin';

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Ayarlar</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">Bu sayfaya sadece okul yöneticileri erişebilir.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-3 pb-16 sm:pb-4">
      <header className="rounded-xl border border-border/70 bg-linear-to-br from-primary/5 via-background to-muted/30 p-3 sm:p-3.5">
        <div className="flex gap-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Settings2 className="size-[18px]" aria-hidden />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h1 className="text-base font-semibold leading-snug tracking-tight sm:text-lg">Zaman çizelgesi ayarları</h1>
            <p className="text-xs text-muted-foreground leading-snug sm:text-[13px] sm:leading-relaxed">
              Okulun ders saatleri buradan tanımlanır; <span className="text-foreground/90">Ders Programı</span> ve{' '}
              <span className="text-foreground/90">Nöbet</span> ekranlarında aynı veri kullanılır.
            </p>
          </div>
        </div>
      </header>

      <ZamanCizelgesiForm />
    </div>
  );
}
