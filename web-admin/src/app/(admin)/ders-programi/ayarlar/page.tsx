'use client';

import { useAuth } from '@/hooks/use-auth';
import { ZamanCizelgesiForm } from '@/components/ders-programi/zaman-cizelgesi-form';
import { DersProgramiSubpageIntro } from '@/components/ders-programi/ders-programi-subpage-intro';

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
      <DersProgramiSubpageIntro
        title="Zaman çizelgesi"
        subtitle="Ders Programı ve Nöbet aynı saat dilimlerini kullanır."
        accent="sky"
      />

      <ZamanCizelgesiForm />
    </div>
  );
}
