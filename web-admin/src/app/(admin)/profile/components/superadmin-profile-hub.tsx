'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  LayoutDashboard,
  LineChart,
  Puzzle,
  School,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { useStatsQuery } from '@/hooks/use-stats-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type Props = { token: string | null };

export function SuperadminProfileHub({ token }: Props) {
  const { data: stats, isPending, error } = useStatsQuery(token);
  const err = error ? (error instanceof Error ? error.message : '—') : null;
  const sa = stats?.superadmin;
  const loading = isPending && !err;

  const nearPct = sa?.teacher_quota_near_ratio != null ? Math.round(sa.teacher_quota_near_ratio * 100) : 90;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 sm:px-4 lg:px-2">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/dashboard', label: 'Genel pano', desc: 'Grafikler ve uyarılar', icon: LayoutDashboard },
          { href: '/schools', label: 'Okullar', desc: 'Durum ve kota', icon: School },
          { href: '/users', label: 'Kullanıcılar', desc: 'Roller ve kayıtlar', icon: Users },
          { href: '/modules', label: 'Modüller', desc: 'Okul bazlı aç/kapa', icon: Puzzle },
        ].map((x) => (
          <Link
            key={x.href}
            href={x.href}
            className="group flex flex-col justify-between rounded-2xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm transition-all hover:border-primary/35 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{x.label}</p>
                <p className="text-xs text-muted-foreground">{x.desc}</p>
              </div>
              <x.icon className="size-5 shrink-0 text-primary/80" />
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
              Aç
              <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { t: 'Okullar', v: stats?.schools },
          { t: 'Kullanıcılar', v: stats?.users },
          { t: 'Onay bekleyen öğretmen', v: sa?.teachers_pending_approval },
          { t: 'Duyurular', v: stats?.announcements },
        ].map((k) => (
          <Card key={k.t} className="border-border/60 shadow-sm">
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.t}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-semibold tabular-nums">{err ? '—' : k.v ?? '—'}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="size-4 text-violet-600" />
              Özet
            </CardTitle>
            <p className="text-xs text-muted-foreground">Rol ve okul durumu (pano ile aynı önbellek)</p>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              sa && (
                <>
                  <div className="flex justify-between gap-2 border-b border-border/50 py-1">
                    <span className="text-muted-foreground">Kullanıcı rolleri</span>
                    <span className="font-medium">
                      {Object.entries(sa.users_by_role)
                        .map(([r, n]) => `${r}: ${n}`)
                        .join(' · ')}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2 py-1">
                    <span className="text-muted-foreground">Okul durumu</span>
                    <span className="font-medium">
                      {Object.entries(sa.schools_by_status)
                        .map(([s, n]) => `${s}: ${n}`)
                        .join(' · ')}
                    </span>
                  </div>
                </>
              )
            )}
          </CardContent>
        </Card>

        <Card className="border-amber-500/20 bg-amber-500/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-amber-600" />
              Dikkat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              sa && (
                <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                  <li>
                    Askıda okul:{' '}
                    <Link href="/schools?status=askida" className="font-medium text-primary hover:underline">
                      {sa.schools_by_status?.askida ?? 0}
                    </Link>
                  </li>
                  <li>
                    Öğretmen kotası dolu okul:{' '}
                    <strong className="text-foreground">{sa.schools_teacher_quota_full}</strong>
                  </li>
                  <li>
                    Kota %{nearPct}+ dolu: <strong className="text-foreground">{sa.schools_teacher_quota_near}</strong>
                  </li>
                </ul>
              )
            )}
            <Link
              href="/dashboard"
              className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <LineChart className="size-4" />
              Tüm grafiklere git
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
