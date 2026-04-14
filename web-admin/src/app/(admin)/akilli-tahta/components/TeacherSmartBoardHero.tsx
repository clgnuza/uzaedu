'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SmartBoardIcon } from './SmartBoardIcon';
import type { Status } from '../types';

function Pill({
  ok,
  labelOk,
  labelBad,
}: {
  ok: boolean;
  labelOk: string;
  labelBad: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs',
        ok
          ? 'border-emerald-300/60 bg-emerald-500/10 text-emerald-800 dark:border-emerald-700/50 dark:text-emerald-200'
          : 'border-amber-300/60 bg-amber-500/10 text-amber-900 dark:border-amber-800/50 dark:text-amber-100',
      )}
    >
      {ok ? <CheckCircle2 className="size-3.5 shrink-0" /> : <XCircle className="size-3.5 shrink-0" />}
      <span className="truncate">{ok ? labelOk : labelBad}</span>
    </span>
  );
}

export function TeacherSmartBoardHero({
  status,
  deviceCount,
  schoolName,
}: {
  status: Status | null;
  deviceCount: number;
  schoolName?: string | null;
}) {
  return (
    <Card className="mb-3 overflow-hidden border-sky-200/55 bg-linear-to-br from-sky-500/8 via-background to-violet-500/5 shadow-sm ring-1 ring-sky-500/10 dark:border-sky-900/45 dark:from-sky-950/35 dark:to-violet-950/20 dark:ring-sky-900/20 sm:mb-5">
      <CardContent className="flex gap-2 p-2.5 sm:gap-4 sm:p-4">
        <div
          className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 shadow-inner ring-1 ring-sky-500/25 dark:bg-sky-500/10 dark:text-sky-400 sm:size-16 sm:rounded-2xl"
          aria-hidden
        >
          <SmartBoardIcon size={34} isOnline={!!status?.enabled} className="text-sky-600 sm:hidden dark:text-sky-400" />
          <SmartBoardIcon size={48} isOnline={!!status?.enabled} className="hidden text-sky-600 sm:block dark:text-sky-400" />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
          <div>
            <h2 className="text-sm font-bold tracking-tight text-foreground sm:text-lg">Sınıf tahtasına bağlan</h2>
            {schoolName ? <p className="truncate text-[10px] text-muted-foreground sm:text-xs">{schoolName}</p> : null}
          </div>
          {!status ? (
            <p className="text-xs text-muted-foreground">Durum yükleniyor…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Pill ok={status.enabled} labelOk="Modül açık" labelBad="Modül kapalı" />
                <Pill
                  ok={status.authorized}
                  labelOk="Bağlanma yetkisi var"
                  labelBad="Yetki yok — idareye danışın"
                />
              </div>
              {status.enabled && status.authorized && (
                <p className="text-[11px] leading-snug text-muted-foreground sm:text-xs">
                  {deviceCount > 0
                    ? `${deviceCount} tahta · Son kullandığınız üstte listelenir.`
                    : 'Tahta kaydı yoksa idareye bildirin.'}
                </p>
              )}
              {status.enabled && !status.authorized ? (
                <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200">
                  Yetki için okul yönetiminize başvurun.
                </p>
              ) : null}
              {!status.enabled ? (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Modül kapalıyken bağlanamazsınız.
                </p>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
