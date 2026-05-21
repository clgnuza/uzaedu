'use client';

import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SMART_BOARD_QR_FLOW_SUMMARY } from '@/lib/smart-board-teacher-qr-flow';
import type { Status } from '../types';

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        ok
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100',
      )}
    >
      {ok ? <CheckCircle2 className="size-3 shrink-0" /> : <XCircle className="size-3 shrink-0" />}
      <span className="truncate">{label}</span>
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
    <div className="mb-2 space-y-2 sm:mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/80 px-3 py-2.5 shadow-sm">
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-foreground">Akıllı tahta</p>
          {schoolName ? <p className="truncate text-[11px] text-muted-foreground">{schoolName}</p> : null}
        </div>
        {!status ? (
          <span className="text-[10px] text-muted-foreground">Yükleniyor…</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-1">
            <Pill ok={status.enabled} label={status.enabled ? 'Modül açık' : 'Modül kapalı'} />
            <Pill ok={status.authorized} label={status.authorized ? 'Yetki var' : 'Yetki yok'} />
          </div>
        )}
      </div>

      {status?.enabled && status.authorized ? (
        <p className="text-[11px] leading-snug text-muted-foreground">{SMART_BOARD_QR_FLOW_SUMMARY}</p>
      ) : null}

      {status?.enabled && status.authorized && deviceCount > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          <span className="font-medium text-foreground">{deviceCount}</span> kayıtlı tahta · Duyuru modunda QR ile ders
        </p>
      ) : null}

      {status?.enabled && !status.authorized ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-2.5 py-2 text-[11px] text-amber-900 dark:text-amber-100">
          Yetki için okul yönetiminize başvurun.
        </p>
      ) : null}

      {/* Klavye kısayolu — yalnız masaüstü / geniş ekran */}
      {status?.enabled && status.authorized ? (
        <p className="hidden text-[10px] leading-snug text-muted-foreground md:block">
          <span className="font-medium text-foreground">Tahta TV:</span> Sekme odaktayken{' '}
          <kbd className="rounded border bg-muted px-1 font-mono">←</kbd>{' '}
          <kbd className="rounded border bg-muted px-1 font-mono">→</kbd>{' '}
          <kbd className="rounded border bg-muted px-1 font-mono">Space</kbd>
        </p>
      ) : null}
    </div>
  );
}
