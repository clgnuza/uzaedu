'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, ChevronRight, Settings } from 'lucide-react';

/** Yeni hesaplama ayarları eklemek için bu diziyi genişletin. */
const CALC_CARDS: { id: string; title: string; description: string; href: string; icon?: React.ReactNode }[] = [
  {
    id: 'ek-ders-calc',
    title: 'Ek Ders Hesaplama',
    description: 'Saat girişiyle brüt, vergi kesintileri ve net tahmini hesaplayın. Tüm kullanıcılar erişebilir.',
    href: '/extra-lesson-calc',
    icon: <Calculator className="size-6 text-primary" />,
  },
  {
    id: 'ek-ders-params',
    title: 'Ek Ders Parametreleri',
    description: 'Bütçe dönemleri, gösterge tablosu, birim ücretler, vergi dilimleri ve merkezi sınav rolleri.',
    href: '/extra-lesson-params/ek-ders',
    icon: <Settings className="size-6 text-primary" />,
  },
  // Yeni hesaplama türleri buraya eklenebilir:
  // { id: 'diger', title: 'Diğer Hesaplama', description: '...', href: '/extra-lesson-params/diger', icon: <Icon /> },
];

export default function CalcParamsHubPage() {
  const router = useRouter();
  const { me } = useAuth();

  const mods = (me as { moderator_modules?: string[] } | undefined)?.moderator_modules;
  const canManage =
    me?.role === 'superadmin' ||
    (me?.role === 'moderator' && Array.isArray(mods) && mods.includes('extra_lesson_params'));

  useEffect(() => {
    if (!canManage) {
      router.replace('/403');
    }
  }, [canManage, router]);

  if (!canManage) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Hesaplama Parametreleri</h1>
        <p className="text-sm text-muted-foreground">
          Hesaplama türlerine göre parametre ayarları. Her kutu ilgili ayarlara götürür.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CALC_CARDS.map((card) => (
          <Link key={card.id} href={card.href}>
            <Card className="flex h-full flex-col transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardHeader className="flex flex-row items-start gap-3 pb-2">
                <div className="rounded-lg bg-muted p-2">{card.icon}</div>
                <div className="flex-1 space-y-1">
                  <CardTitle className="text-base">{card.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{card.description}</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pt-0">
                <span className="text-sm font-medium text-primary">
                  {card.href.includes('/extra-lesson-calc') ? 'Hesaplamaya git →' : 'Ayarlara git →'}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
