'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { ZamanCizelgesiForm } from '@/components/ders-programi/zaman-cizelgesi-form';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
import { Clock, Calendar } from 'lucide-react';

export default function DersProgramiAyarlarPage() {
  const { me } = useAuth();
  const isAdmin = me?.role === 'school_admin';

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Ayarlar</h1>
        <p className="text-sm text-muted-foreground">Bu sayfaya sadece okul yöneticileri erişebilir.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Toolbar>
        <ToolbarHeading>
          <nav className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider mb-1">
            <Link href="/dashboard" className="hover:text-primary transition-colors">Anasayfa</Link>
            <span className="text-border">/</span>
            <Link href="/ders-programi" className="hover:text-primary transition-colors">Ders Programı</Link>
            <span className="text-border">/</span>
            <span className="text-foreground font-medium">Ayarlar</span>
          </nav>
          <ToolbarPageTitle className="text-2xl">Ders Programı Ayarları</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Zaman çizelgesi', icon: Clock },
              { label: 'Ders saati', icon: Calendar },
            ]}
            summary="Zaman çizelgesi ve ders saati ayarları. Ders Programı ve Nöbet modüllerinde kullanılır."
          />
        </ToolbarHeading>
      </Toolbar>

      <ZamanCizelgesiForm />
    </div>
  );
}
