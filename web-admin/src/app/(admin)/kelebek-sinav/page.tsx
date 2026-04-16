'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { butterflyExamApiQuery } from '@/lib/butterfly-exam-school-q';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Building2, Calendar, Sparkles, Users, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCallback, useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type Stats = { classCount: number; studentCount: number; roomCount: number; totalCapacity: number; planCount: number };

type StepCard = {
  title: string;
  desc: string;
  icon: LucideIcon;
  href: string;
  cta: string;
  tone: string;
  adminOnly?: boolean;
};

const STEPS: StepCard[] = [
  {
    title: 'Sınıf ve öğrenci',
    desc: 'Şube ve öğrenci sayıları; E-Okul listesi önizlemesi için içe aktar sekmesi.',
    icon: BookOpen,
    href: '/kelebek-sinav/sinif-ogrenci',
    cta: 'Özet ve bağlantılar',
    tone: 'from-sky-500/20 to-cyan-500/10 border-sky-400/35',
  },
  {
    title: 'Salon ve bina',
    desc: 'Kapasite ve sıra düzeni; yerleştirme bu salonlara göre yapılır.',
    icon: Building2,
    href: '/kelebek-sinav/yerlesim',
    cta: 'Salonları düzenle',
    tone: 'from-violet-500/20 to-indigo-500/10 border-violet-400/35',
    adminOnly: true,
  },
  {
    title: 'Sınav işlemleri',
    desc: 'Oturum listesi ve adım adım sınav oluşturma sihirbazı.',
    icon: Calendar,
    href: '/kelebek-sinav/sinav-islemleri',
    cta: 'Sınav oturumları',
    tone: 'from-fuchsia-500/20 to-pink-500/10 border-fuchsia-400/35',
  },
];

export default function KelebekSinavOverviewPage() {
  const { me, token } = useAuth();
  const searchParams = useSearchParams();
  const schoolQ = butterflyExamApiQuery(me?.role ?? null, searchParams.get('school_id'));
  const isSchoolAdmin = me?.role === 'school_admin';
  const canSalon =
    me?.role === 'school_admin' || me?.role === 'superadmin' || me?.role === 'moderator';
  const needSchool =
    (me?.role === 'superadmin' || me?.role === 'moderator') && !searchParams.get('school_id');
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const s = await apiFetch<Stats>(`/butterfly-exam/overview-stats${schoolQ}`, { token });
      setStats(s);
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [token, schoolQ]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-w-0 space-y-4">
      {needSchool ? (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/35 dark:bg-amber-950/40 dark:text-amber-100">
          Süper yönetici olarak okul verisini görmek için URL&apos;ye{' '}
          <code className="rounded bg-amber-950/10 px-1.5 py-0.5 font-mono text-xs dark:bg-amber-500/15">
            ?school_id=...
          </code>{' '}
          ekleyin veya okul detayından bu modülü açın.
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Card className="border-indigo-200/40 bg-white/80 dark:bg-zinc-900/50">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Users className="size-4 text-indigo-600" />
                Öğrenci
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">{stats.studentCount}</CardContent>
          </Card>
          <Card className="border-indigo-200/40 bg-white/80 dark:bg-zinc-900/50">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <LayoutList className="size-4 text-violet-600" />
                Sınıf
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">{stats.classCount}</CardContent>
          </Card>
          <Card className="border-indigo-200/40 bg-white/80 dark:bg-zinc-900/50">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Building2 className="size-4 text-amber-600" />
                Salon
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">{stats.roomCount}</CardContent>
          </Card>
          <Card className="border-indigo-200/40 bg-white/80 dark:bg-zinc-900/50">
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-4 text-fuchsia-600" />
                Toplam koltuk
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold tabular-nums">{stats.totalCapacity}</CardContent>
          </Card>
        </div>
      ) : null}

      <Card className="border-indigo-300/40 bg-gradient-to-br from-indigo-500/15 to-violet-600/10 dark:border-indigo-800/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-indigo-950 sm:text-base dark:text-indigo-50">
            <Sparkles className="size-4 shrink-0 text-amber-500 sm:size-5" />
            Hızlı başlangıç
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap">
          <Button asChild size="sm" variant="secondary" className="w-full sm:w-auto">
            <Link href={`/kelebek-sinav/sinav-olustur${schoolQ}`}>Yeni sınav sihirbazı</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link href={`/kelebek-sinav/sinav-islemleri${schoolQ}`}>Oturum listesi</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.filter((s) => !s.adminOnly || canSalon).map((step) => {
          const Icon = step.icon;
          return (
            <Card
              key={step.title}
              className={cn(
                'overflow-hidden border bg-gradient-to-br shadow-sm transition hover:shadow-md',
                step.tone,
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start gap-2 text-sm sm:items-center sm:text-base">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/70 sm:size-9 dark:bg-zinc-900/60">
                    <Icon className="size-4 text-indigo-600 sm:size-5 dark:text-indigo-300" />
                  </span>
                  <span className="min-w-0 break-words leading-snug">{step.title}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p className="text-[13px] leading-relaxed sm:text-sm">{step.desc}</p>
                <Button asChild size="sm" className="w-full sm:w-auto">
                  <Link href={`${step.href}${schoolQ}`}>{step.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
