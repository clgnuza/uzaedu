'use client';

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ShoppingBag,
  FileText,
  Coins,
  Building2,
  UserRound,
  RefreshCw,
  History,
  Wallet,
  Sparkles,
  Receipt,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  CalendarDays,
  Calendar,
  ListTree,
  Timer,
  UserPlus,
  Copy,
  ExternalLink,
  Unlock,
  CheckCircle2,
  XCircle,
  BadgeCheck,
  BookOpen,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SCHOOL_MODULE_KEYS, SCHOOL_MODULE_LABELS, type SchoolModuleKey } from '@/config/school-modules';
import { MODULE_ACTIVATION_REFRESH_EVENT } from '@/lib/module-activation-events';
import { InfoHintDialog } from '@/components/market/info-hint-dialog';

type CurrencyPair = { jeton: number; ekders: number };
type ModuleScopeUsage = { monthly: CurrencyPair; yearly: CurrencyPair };
type ModuleEntryNotice = {
  notice_tr: string | null;
  notice_en: string | null;
  market_href?: string | null;
  cta_market_tr?: string | null;
  cta_market_en?: string | null;
  purchase_href?: string | null;
  cta_purchase_tr?: string | null;
  cta_purchase_en?: string | null;
};
type ModulePriceRow = {
  school: ModuleScopeUsage;
  teacher: ModuleScopeUsage;
  entry_notice?: ModuleEntryNotice;
};
type MarketPolicyLite = {
  module_prices: Record<string, ModulePriceRow>;
  rewarded_ad_jeton?: {
    enabled: boolean;
    jeton_per_reward: number;
    max_rewards_per_day: number;
    cooldown_seconds: number;
    allowed_ad_unit_ids: string[];
  };
  teacher_invite_jeton?: {
    enabled: boolean;
    jeton_for_invitee: number;
    jeton_for_inviter: number;
    max_invites_per_teacher: number;
    code_length: number;
  };
};

type TeacherInviteSummary = {
  enabled: boolean;
  code: string | null;
  total_redemptions: number;
  total_inviter_jeton: number;
  policy: {
    jeton_for_invitee: number;
    jeton_for_inviter: number;
    max_invites_per_teacher: number;
  };
};

type TeacherInviteRedemptionRow = {
  id: string;
  created_at: string;
  invitee_display: string | null;
  invitee_jeton: number;
  inviter_jeton: number;
};

type EntitlementItem = {
  entitlementType: string;
  quantity: number;
  expiresAt: string | null;
};

type WalletRes = {
  user: { jeton: number; ekders: number };
  school: { jeton: number; ekders: number } | null;
};

type UsageSlice = { period_label: string; jeton: number; ekders: number };

type UsageModuleSlice = UsageSlice & {
  by_module: Record<string, { jeton: number; ekders: number }>;
};

type UsageBreakdownRes = {
  periods: {
    month: { label: string; starts_at: string; ends_at: string };
    year: { label: string; starts_at: string; ends_at: string };
  };
  user: { month: UsageModuleSlice; year: UsageModuleSlice };
  school: { month: UsageModuleSlice; year: UsageModuleSlice } | null;
};

type LedgerRow = {
  id: string;
  platform: string;
  productId: string;
  status: string;
  currencyKind: string;
  creditTarget: string | null;
  amountCredited: string | null;
  creditsApplied: boolean;
  verificationNote: string | null;
  createdAt: string;
};

type UsageLedgerItem = {
  id: string;
  module_key: string;
  jeton_debit: string;
  ekders_debit: string;
  debit_target: string;
  created_at: string | null;
};

type ActivationStatusRes = {
  billing_account: 'user' | 'school';
  modules: Record<string, { free: boolean; active: boolean }>;
};

type ActivationLedgerRow = {
  id: string;
  module_key: string;
  billing_period: 'month' | 'year';
  period_label: string;
  debit_target: 'user' | 'school';
  debit_jeton?: number | null;
  debit_ekders?: number | null;
  created_at: string;
};

type SchoolCreditAdminRow = {
  id: string;
  school_id: string;
  school_name: string | null;
  school_city: string | null;
  school_district: string | null;
  jeton_credit: number;
  ekders_credit: number;
  note: string | null;
  created_at: string;
  created_by_user_id: string;
  creator_email: string | null;
  creator_display_name: string | null;
};

type SchoolManualCreditRow = {
  id: string;
  jeton_credit: number;
  ekders_credit: number;
  note: string | null;
  created_at: string;
  created_by_user_id: string;
  creator_email: string | null;
  creator_display_name: string | null;
};

type RewardedAdCreditRow = {
  id: string;
  transaction_id: string;
  jeton_credit: string;
  ad_unit_key: string | null;
  created_at: string | null;
};

type TeacherCreditAdminRow = {
  id: string;
  target_user_id: string;
  target_email: string | null;
  target_display_name: string | null;
  jeton_credit: number;
  ekders_credit: number;
  note: string | null;
  created_at: string;
  created_by_user_id: string;
  creator_email: string | null;
  creator_display_name: string | null;
};

function moduleLabel(key: string): string {
  return key in SCHOOL_MODULE_LABELS ? SCHOOL_MODULE_LABELS[key as SchoolModuleKey] : key;
}

function parseDebit(s: string | undefined): number {
  const n = parseFloat(String(s ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function tariffNonZero(p: CurrencyPair | undefined): boolean {
  if (!p) return false;
  const j = Number(p.jeton) || 0;
  const e = Number(p.ekders) || 0;
  return j > 0 || e > 0;
}

function pairNums(p: CurrencyPair | undefined): { jeton: number; ekders: number } {
  return { jeton: Number(p?.jeton) || 0, ekders: Number(p?.ekders) || 0 };
}

/** Tarifede tek kalem varsa o bakiye; iki kalem varsa payWith ile seçilen bakiye yeterli mi. */
function canAffordNeed(
  bal: { jeton: number; ekders: number },
  need: { jeton: number; ekders: number },
  payWith: 'jeton' | 'ekders',
): boolean {
  if (need.jeton <= 0 && need.ekders <= 0) return true;
  if (need.jeton > 0 && need.ekders <= 0) return bal.jeton >= need.jeton;
  if (need.ekders > 0 && need.jeton <= 0) return bal.ekders >= need.ekders;
  return payWith === 'jeton' ? bal.jeton >= need.jeton : bal.ekders >= need.ekders;
}

function payWithForTariff(
  need: { jeton: number; ekders: number },
  payWith: 'jeton' | 'ekders',
): 'jeton' | 'ekders' | undefined {
  if (need.jeton > 0 && need.ekders > 0) return payWith;
  return undefined;
}

type ActivationConfirmPayload = {
  moduleKey: string;
  billingPeriod: 'month' | 'year';
  targetMonth?: string;
  payWith?: 'jeton' | 'ekders';
  moduleLabel: string;
  periodTitleTr: string;
  paySummaryTr: string;
  walletLabel: string;
  isExempt: boolean;
  walletJeton: number;
  walletEkders: number;
  dualTariffJetonLine: string | null;
  dualTariffEkdersLine: string | null;
  selectedPayKind: 'jeton' | 'ekders';
  hasInsufficientBalance: boolean;
  idempotencyKey: string;
};

function fmtLedgerTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function utcMonthLabelNow(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function utcYearLabelNow(): string {
  return String(new Date().getUTCFullYear());
}

function utcMonthAdd(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function fmtYmTr(ym: string): string {
  const [y, mo] = ym.split('-').map(Number);
  if (!y || !mo) return ym;
  try {
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  } catch {
    return ym;
  }
}

function fmtMonthShortUtc(ym: string): string {
  const [y, mo] = ym.split('-').map(Number);
  if (!y || !mo) return ym;
  try {
    return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('tr-TR', { month: 'short', timeZone: 'UTC' });
  } catch {
    return ym;
  }
}

function monthsFromUtc(baseYm: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => utcMonthAdd(baseYm, i));
}

const ACTIVATION_MODULE_CARD_STYLES = [
  'border-teal-400/45 bg-linear-to-br from-teal-500/12 via-card to-cyan-500/8 dark:border-teal-700/50',
  'border-violet-400/45 bg-linear-to-br from-violet-500/12 via-card to-fuchsia-500/8 dark:border-violet-700/50',
  'border-sky-400/45 bg-linear-to-br from-sky-500/12 via-card to-blue-500/8 dark:border-sky-700/50',
  'border-amber-400/45 bg-linear-to-br from-amber-500/12 via-card to-orange-500/8 dark:border-amber-700/50',
  'border-rose-400/45 bg-linear-to-br from-rose-500/12 via-card to-pink-500/8 dark:border-rose-700/50',
  'border-emerald-400/45 bg-linear-to-br from-emerald-500/12 via-card to-teal-500/8 dark:border-emerald-700/50',
] as const;

const ENTITLEMENT_LABELS: Record<string, string> = {
  evrak_uretim: 'Evrak üretim hakkı',
  optik_okuma: 'Optik okuma',
  tahta_kilit: 'Akıllı tahta',
};

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(n);
}

function fmtActivationDebitRow(j: number | null | undefined, e: number | null | undefined): string {
  const jOk = j != null && Number.isFinite(j) && j > 0;
  const eOk = e != null && Number.isFinite(e) && e > 0;
  if (!jOk && !eOk) return '—';
  if (jOk && !eOk) return `${fmtNum(j!)} jeton`;
  if (eOk && !jOk) return `${fmtNum(e!)} ek ders`;
  return `${fmtNum(j!)} J / ${fmtNum(e!)} E`;
}

function TariffAmountHeader({
  periodShort,
  kind,
  paddedEnd,
  className,
}: {
  periodShort: 'Ay' | 'Yıl';
  kind: 'jeton' | 'ekders';
  paddedEnd?: boolean;
  className?: string;
}) {
  const isJ = kind === 'jeton';
  const periodTr = periodShort === 'Ay' ? 'Ay' : 'Yıl';
  const kindShort = isJ ? 'J' : 'E';
  return (
    <th
      scope="col"
      className={cn(
        paddedEnd ? 'px-4' : 'px-2',
        'align-middle py-2.5 text-right font-normal normal-case',
        className,
      )}
      title={
        isJ
          ? `${periodShort === 'Ay' ? 'Aylık' : 'Yıllık'} dönem · jeton (evrensel takvim)`
          : `${periodShort === 'Ay' ? 'Aylık' : 'Yıllık'} dönem · ek ders (evrensel takvim)`
      }
    >
      <div className="flex flex-col items-end justify-center gap-0.5">
        <span className="block text-[10px] font-bold uppercase leading-none tracking-wide text-muted-foreground">
          {periodTr}
        </span>
        <span className="inline-flex items-center justify-end gap-1 text-[11px] font-semibold leading-none text-foreground sm:text-xs">
          {isJ ? (
            <Coins className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          ) : (
            <BookOpen className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          )}
          <span className="tabular-nums">{kindShort}</span>
        </span>
      </div>
    </th>
  );
}

function formatRemainingTr(endsAtIso: string, nowMs: number): string {
  const t = new Date(endsAtIso).getTime() - nowMs;
  if (t <= 0) return 'Dönem yenileniyor';
  const d = Math.floor(t / 86400000);
  const h = Math.floor((t % 86400000) / 3600000);
  const min = Math.floor((t % 3600000) / 60000);
  if (d > 0) return `${d} gün ${h} sa`;
  if (h > 0) return `${h} sa ${min} dk`;
  return `${min} dk`;
}

function periodProgress(
  nowMs: number,
  endsAtIso: string,
  unit: 'month' | 'year',
  startsAtIso?: string,
): number {
  const end = new Date(endsAtIso).getTime();
  const startMs = startsAtIso
    ? new Date(startsAtIso).getTime()
    : (() => {
        const start = new Date(end);
        if (unit === 'month') start.setUTCMonth(start.getUTCMonth() - 1);
        else start.setUTCFullYear(start.getUTCFullYear() - 1);
        return start.getTime();
      })();
  const w = end - startMs;
  if (w <= 0) return 0;
  return Math.min(100, Math.max(0, ((nowMs - startMs) / w) * 100));
}

function fmtEndDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

const STATUS_LABEL: Record<string, string> = {
  verified: 'Onaylandı',
  rejected: 'Reddedildi',
  pending: 'Bekliyor',
  skipped_no_credentials: 'Doğrulama yok',
  duplicate: 'Yinelenen',
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    verified:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
    rejected: 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200',
    pending:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200',
    skipped_no_credentials:
      'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-200',
    duplicate: 'border-slate-200 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
  };
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        styles[status] ?? 'border-border bg-muted text-muted-foreground',
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function PlatformBadge({ platform }: { platform: string }) {
  const p = platform?.toLowerCase() === 'ios' ? 'ios' : 'android';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
        p === 'ios'
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'bg-emerald-600 text-white',
      )}
    >
      <Smartphone className="size-3 opacity-90" />
      {p}
    </span>
  );
}

function BalanceCard(props: {
  label: string;
  value: string;
  icon: ReactNode;
  accent: 'emerald' | 'amber' | 'blue';
  sub?: string;
  /** Özet şeridinde 4’lü ızgara için sıkı düzen */
  compact?: boolean;
}) {
  const ring =
    props.accent === 'blue'
      ? 'ring-blue-500/20 dark:ring-blue-400/20'
      : props.accent === 'amber'
        ? 'ring-amber-500/15 dark:ring-amber-400/15'
        : 'ring-emerald-500/15 dark:ring-emerald-400/15';
  const bg =
    props.accent === 'blue'
      ? 'from-blue-50/90 to-card dark:from-blue-950/40 dark:to-card'
      : props.accent === 'amber'
        ? 'from-amber-50/80 to-card dark:from-amber-950/30 dark:to-card'
        : 'from-emerald-50/80 to-card dark:from-emerald-950/25 dark:to-card';
  const c = props.compact;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/60 bg-linear-to-br shadow-sm ring-1 sm:rounded-2xl',
        c ? 'p-2.5 sm:p-3' : 'p-3 sm:p-5',
        ring,
        bg,
      )}
    >
      <div className={cn('absolute opacity-[0.07]', c ? '-right-1 -top-1' : '-right-2 -top-2')}>
        {c ? <span className="block scale-75">{props.icon}</span> : props.icon}
      </div>
      <p
        className={cn(
          'font-semibold uppercase tracking-wide text-muted-foreground',
          c ? 'text-[10px] leading-tight' : 'text-xs',
        )}
      >
        {props.label}
      </p>
      <p
        className={cn(
          'font-bold tabular-nums tracking-tight text-foreground',
          c ? 'mt-1 text-xl sm:text-2xl' : 'mt-1.5 text-2xl sm:mt-2 sm:text-3xl',
        )}
      >
        {props.value}
      </p>
      {props.sub && (
        <p className={cn('mt-0.5 hidden text-muted-foreground sm:block', c ? 'text-[10px]' : 'mt-1 text-xs')}>
          {props.sub}
        </p>
      )}
    </div>
  );
}

function UtcPeriodCard(props: {
  variant: 'month' | 'year';
  remaining: string;
  progressPct: number;
  jeton: number;
  ekders: number;
  startsAt: string;
  endsAt: string;
  periodLabel: string;
  compact?: boolean;
}) {
  const m = props.variant === 'month';
  const hint = (
    <>
      <p>
        Başlangıç: {fmtEndDate(props.startsAt)} · Dönem sonu: {fmtEndDate(props.endsAt)} · {props.periodLabel}
      </p>
    </>
  );
  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-linear-to-br transition',
        props.compact
          ? cn(
              'border-2 p-2.5 shadow-md hover:shadow-lg sm:p-3',
              m
                ? 'border-violet-500/55 from-violet-500/14 via-card to-card ring-2 ring-violet-500/30 dark:from-violet-950/35 dark:ring-violet-400/25'
                : 'border-amber-500/55 from-amber-500/14 via-card to-card ring-2 ring-amber-500/30 dark:from-amber-950/30 dark:ring-amber-400/25',
            )
          : cn(
              'border-2 shadow-md ring-1 ring-offset-0',
              m
                ? 'border-violet-500/50 from-violet-500/14 via-card to-card ring-violet-500/25 dark:from-violet-950/35'
                : 'border-amber-500/50 from-amber-500/14 via-card to-card ring-amber-500/25 dark:from-amber-950/30',
              'p-4 shadow-lg hover:shadow-xl sm:p-6',
            ),
      )}
    >
      {!props.compact && (
        <div
          className={cn(
            'pointer-events-none absolute -right-8 -top-8 size-32 rounded-full blur-2xl',
            m ? 'bg-violet-500/15' : 'bg-amber-500/15',
          )}
        />
      )}
      <div className="relative flex items-start justify-between gap-2">
        <div
          className={cn(
            'flex items-center gap-1.5 font-bold uppercase tracking-wide',
            m ? 'text-violet-700 dark:text-violet-300' : 'text-amber-800 dark:text-amber-200',
            props.compact ? 'text-[10px] sm:text-[11px]' : 'text-xs',
          )}
        >
          {m ? <CalendarDays className="size-3.5 shrink-0 sm:size-4" /> : <Calendar className="size-3.5 shrink-0 sm:size-4" />}
          {m ? 'Bu ay' : 'Bu yıl'}
        </div>
        <Timer className={cn('shrink-0 opacity-80', m ? 'size-4 text-violet-600 dark:text-violet-400' : 'size-4 text-amber-600 dark:text-amber-400')} />
      </div>
      <p
        className={cn(
          'relative tabular-nums text-foreground',
          props.compact ? 'mt-1.5 text-base font-bold leading-tight sm:text-lg' : 'mt-3 text-2xl font-bold',
        )}
      >
        {props.remaining}
      </p>
      {!props.compact && (
        <>
          <p className="relative mt-1 hidden text-xs text-muted-foreground sm:block">
            Başlangıç: {fmtEndDate(props.startsAt)} · Dönem sonu: {fmtEndDate(props.endsAt)} · {props.periodLabel}
          </p>
          <div className="relative mt-1 sm:hidden">
            <InfoHintDialog label="Dönem aralığı" title={m ? 'Bu ay — dönem bilgisi' : 'Bu yıl — dönem bilgisi'}>
              {hint}
              <p className="mt-2 text-muted-foreground">
                Ay/yıl sınırları evrensel takvime (UTC) göredir; yerel saat diliminizden bağımsız tek tip takvim kullanılır.
              </p>
            </InfoHintDialog>
          </div>
        </>
      )}
      {props.compact && (
        <div className="relative mt-1 flex items-center gap-1">
          <InfoHintDialog label="Dönem aralığı" title={m ? 'Bu ay — dönem bilgisi' : 'Bu yıl — dönem bilgisi'} buttonClassName="size-7">
            {hint}
            <p className="mt-2 text-muted-foreground">
              Ay/yıl sınırları evrensel takvime (UTC) göredir; yerel saat diliminizden bağımsız tek tip takvim kullanılır.
            </p>
          </InfoHintDialog>
          <span className="truncate text-[10px] text-muted-foreground">{props.periodLabel}</span>
        </div>
      )}
      <div className={cn('relative overflow-hidden rounded-full bg-muted', props.compact ? 'mt-2 h-1.5' : 'mt-4 h-2')}>
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500',
            m ? 'bg-linear-to-r from-violet-500 to-fuchsia-500' : 'bg-linear-to-r from-amber-500 to-orange-500',
          )}
          style={{ width: `${props.progressPct}%` }}
        />
      </div>
      <div className={cn('relative flex flex-wrap gap-x-2 gap-y-1', props.compact ? 'mt-2' : 'mt-4')}>
        <span
          className={cn(
            'inline-flex items-center rounded-md border border-amber-500/25 bg-amber-500/10 px-1.5 font-semibold tabular-nums text-foreground',
            props.compact ? 'py-0.5 text-[10px]' : 'text-sm',
          )}
        >
          <Coins className="mr-0.5 size-3 text-amber-600 dark:text-amber-400" aria-hidden />
          {fmtNum(props.jeton)}
        </span>
        <span
          className={cn(
            'inline-flex items-center rounded-md border border-sky-500/25 bg-sky-500/10 px-1.5 font-semibold tabular-nums text-foreground',
            props.compact ? 'py-0.5 text-[10px]' : 'text-sm',
          )}
        >
          <BookOpen className="mr-0.5 size-3 text-sky-600 dark:text-sky-400" aria-hidden />
          {fmtNum(props.ekders)}
        </span>
      </div>
      <p
        className={cn(
          'relative text-muted-foreground',
          props.compact ? 'mt-1.5 text-[10px] leading-tight' : 'mt-2 hidden text-[11px] sm:block',
        )}
      >
        {m ? 'Bu ay — bireysel harcama' : 'Bu yıl — bireysel harcama'}
      </p>
    </div>
  );
}

function LedgerTable({
  rows,
  showTarget,
  compact,
}: {
  rows: LedgerRow[];
  showTarget?: boolean;
  /** Okul market alt tabloları — mobilde sıkı */
  compact?: boolean;
}) {
  const cell = compact ? 'px-1.5 py-1 sm:px-3 sm:py-2.5' : 'px-2 py-2 sm:px-4 sm:py-3';
  const thRow = compact
    ? 'border-b border-border/80 bg-muted/50 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs'
    : 'border-b border-border/80 bg-muted/50 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs';
  return (
    <div className="overflow-hidden rounded-lg border border-border/80 bg-muted/20 sm:rounded-xl">
      <div className="table-x-scroll">
        <table
          className={cn(
            'w-full text-[11px] sm:text-sm',
            compact ? 'min-w-[300px] sm:min-w-[460px]' : 'min-w-[480px] sm:min-w-[540px]',
          )}
        >
          <thead>
            <tr className={thRow}>
              <th className={cell}>Tarih</th>
              <th className={cell}>Mağaza</th>
              <th className={cell}>Ürün</th>
              <th className={cell}>Durum</th>
              {showTarget && <th className={cell}>Hedef</th>}
              <th className={cn(cell, 'text-right')}>Yüklenen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/40">
                <td className={cn('whitespace-nowrap text-muted-foreground', cell)}>{fmtDate(r.createdAt)}</td>
                <td className={cell}>
                  <PlatformBadge platform={r.platform} />
                </td>
                <td className={cn('max-w-[200px]', cell)}>
                  <span
                    className={cn('font-mono text-foreground', compact ? 'text-[10px] sm:text-xs' : 'text-[11px] sm:text-xs')}
                    title={r.productId}
                  >
                    {r.productId}
                  </span>
                </td>
                <td className={cell}>
                  <StatusBadge status={r.status} />
                </td>
                {showTarget && (
                  <td className={cell}>
                    {r.creditTarget === 'school' ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-900 sm:px-2 sm:text-xs dark:bg-blue-950/60 dark:text-blue-200">
                        <Building2 className="size-3" />
                        Okul
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:px-2 sm:text-xs">
                        <UserRound className="size-3" />
                        Bireysel
                      </span>
                    )}
                  </td>
                )}
                <td className={cn('text-right tabular-nums text-foreground', cell)}>
                  {r.creditsApplied && r.amountCredited ? (
                    <span>
                      {fmtNum(parseFloat(r.amountCredited))}{' '}
                      <span className="text-muted-foreground">({r.currencyKind})</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyLedger({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-6 text-center sm:rounded-xl sm:px-6 sm:py-14">
      <div className="mb-2 rounded-full bg-muted p-3 sm:mb-3 sm:p-4">
        <Receipt className="size-6 text-muted-foreground sm:size-8" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <InfoHintDialog label="Açıklama" title={title} className="mt-2">
        <p>{hint}</p>
      </InfoHintDialog>
    </div>
  );
}

const PAGE_SIZE = 20;
const SCHOOL_CREDIT_ADMIN_PAGE = 15;
const TEACHER_CREDIT_ADMIN_PAGE = 15;
const SCHOOL_ADMIN_MANUAL_PAGE = 12;
const TEACHER_MANUAL_PAGE = 12;

export default function MarketPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, me } = useAuth();
  const [entitlements, setEntitlements] = useState<EntitlementItem[]>([]);
  const [wallet, setWallet] = useState<WalletRes | null>(null);
  const [breakdown, setBreakdown] = useState<UsageBreakdownRes | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [ledgerUser, setLedgerUser] = useState<UsageLedgerItem[]>([]);
  const [ledgerSchool, setLedgerSchool] = useState<UsageLedgerItem[]>([]);
  const [mine, setMine] = useState<{ items: LedgerRow[]; total: number } | null>(null);
  const [school, setSchool] = useState<{ items: LedgerRow[]; total: number } | null>(null);
  const [pageMine, setPageMine] = useState(1);
  const [pageSchool, setPageSchool] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<MarketPolicyLite | null>(null);
  const [schoolCreditAdmin, setSchoolCreditAdmin] = useState<{
    total: number;
    items: SchoolCreditAdminRow[];
  } | null>(null);
  const [schoolCreditAdminPage, setSchoolCreditAdminPage] = useState(1);
  const [scFrom, setScFrom] = useState('');
  const [scTo, setScTo] = useState('');
  const [scSchoolId, setScSchoolId] = useState('');
  const [schoolCreditAdminLoading, setSchoolCreditAdminLoading] = useState(false);
  const [saManual, setSaManual] = useState<{ total: number; items: SchoolManualCreditRow[] } | null>(null);
  const [saManualPage, setSaManualPage] = useState(1);
  const [saManualFrom, setSaManualFrom] = useState('');
  const [saManualTo, setSaManualTo] = useState('');
  const [saManualLoading, setSaManualLoading] = useState(false);
  const [teacherCreditAdmin, setTeacherCreditAdmin] = useState<{
    total: number;
    items: TeacherCreditAdminRow[];
  } | null>(null);
  const [teacherCreditAdminPage, setTeacherCreditAdminPage] = useState(1);
  const [tcFrom, setTcFrom] = useState('');
  const [tcTo, setTcTo] = useState('');
  const [tcUserId, setTcUserId] = useState('');
  const [teacherCreditAdminLoading, setTeacherCreditAdminLoading] = useState(false);
  const [tManual, setTManual] = useState<{ total: number; items: SchoolManualCreditRow[] } | null>(null);
  const [tManualPage, setTManualPage] = useState(1);
  const [tManualFrom, setTManualFrom] = useState('');
  const [tManualTo, setTManualTo] = useState('');
  const [tManualLoading, setTManualLoading] = useState(false);
  const [rewardedAdCredits, setRewardedAdCredits] = useState<{
    total: number;
    items: RewardedAdCreditRow[];
  } | null>(null);
  const [teacherInvite, setTeacherInvite] = useState<TeacherInviteSummary | null>(null);
  const [teacherInviteRedemptions, setTeacherInviteRedemptions] = useState<{
    total: number;
    items: TeacherInviteRedemptionRow[];
  } | null>(null);
  const [teacherInviteLoading, setTeacherInviteLoading] = useState(false);
  const [activationBusy, setActivationBusy] = useState<string | null>(null);
  const [activationStatus, setActivationStatus] = useState<ActivationStatusRes | null>(null);
  const [activationLedger, setActivationLedger] = useState<ActivationLedgerRow[]>([]);
  const [siteOrigin, setSiteOrigin] = useState('');
  useEffect(() => {
    setSiteOrigin(typeof window !== 'undefined' ? window.location.origin : '');
  }, []);

  const isTeacher = me?.role === 'teacher';
  const isSchoolAdmin = me?.role === 'school_admin';
  const isSuperadmin = me?.role === 'superadmin';
  const isSuperOrMod = me?.role === 'superadmin' || me?.role === 'moderator';
  const showSchoolTariffs = isSchoolAdmin || isSuperOrMod;
  /** Okul yöneticisi yalnızca okul tarifesi; öğretmen sütunu teacher / yönetici için */
  const showTeacherTariffs = isTeacher || isSuperOrMod;

  const activationByModule = useMemo(() => {
    const map = new Map<string, { months: Set<string>; hasYear: boolean }>();
    const yNow = utcYearLabelNow();
    for (const r of activationLedger) {
      const key = r.module_key;
      if (!map.has(key)) map.set(key, { months: new Set<string>(), hasYear: false });
      const e = map.get(key)!;
      if (r.billing_period === 'month') e.months.add(r.period_label);
      if (r.billing_period === 'year' && r.period_label === yNow) e.hasYear = true;
    }
    return map;
  }, [activationLedger]);

  const [extraMonthPick, setExtraMonthPick] = useState<Record<string, string>>({});
  const [payWithByModule, setPayWithByModule] = useState<Record<string, 'jeton' | 'ekders'>>({});
  const [activationConfirm, setActivationConfirm] = useState<ActivationConfirmPayload | null>(null);

  const canAccess =
    me?.role === 'teacher' ||
    me?.role === 'school_admin' ||
    me?.role === 'superadmin' ||
    me?.role === 'moderator';

  const loadAll = useCallback(async () => {
    if (!token) return;
    setError(null);
    setLoading(true);
    setUsageLoading(true);

    const loadUsageSlice = async () => {
      try {
        const [bd, lu, ls] = await Promise.all([
          apiFetch<UsageBreakdownRes>('/market/usage/breakdown', { token }),
          apiFetch<{ items: UsageLedgerItem[] }>(`/market/usage/ledger?page=1&limit=8`, { token }),
          isSchoolAdmin
            ? apiFetch<{ items: UsageLedgerItem[] }>(`/market/usage/ledger?scope=school&page=1&limit=8`, { token })
            : Promise.resolve({ items: [] }),
        ]);
        setBreakdown(bd);
        setLedgerUser(Array.isArray(lu.items) ? lu.items : []);
        setLedgerSchool(Array.isArray(ls.items) ? ls.items : []);
      } catch {
        setBreakdown(null);
        setLedgerUser([]);
        setLedgerSchool([]);
      } finally {
        setUsageLoading(false);
      }
    };

    const loadMainSlice = async () => {
      try {
        const [ent, w, m, s, pol, actSt, actLed] = await Promise.all([
          apiFetch<EntitlementItem[]>('/entitlements', { token }),
          apiFetch<WalletRes>('/market/wallet', { token }),
          apiFetch<{ items: LedgerRow[]; total: number }>(
            `/market/purchases/mine?page=${pageMine}&limit=${PAGE_SIZE}`,
            { token },
          ),
          isSchoolAdmin
            ? apiFetch<{ items: LedgerRow[]; total: number }>(
                `/market/purchases/school?page=${pageSchool}&limit=${PAGE_SIZE}`,
                { token },
              )
            : Promise.resolve(null),
          apiFetch<MarketPolicyLite>('content/market-policy').catch(() => null),
          apiFetch<ActivationStatusRes>('/market/modules/activation-status', { token }).catch(() => null),
          apiFetch<{ items: ActivationLedgerRow[] }>('/market/modules/activation-ledger?limit=40', { token }).catch(
            () => null,
          ),
        ]);
        setEntitlements(Array.isArray(ent) ? ent : []);
        setWallet(w);
        setMine(m);
        setSchool(s);
        setPolicy(pol && pol.module_prices ? pol : null);
        setActivationStatus(actSt && actSt.modules ? actSt : null);
        setActivationLedger(Array.isArray(actLed?.items) ? actLed.items : []);
        if (isTeacher) {
          setTeacherInviteLoading(true);
          try {
            const [rad, inv, red] = await Promise.all([
              apiFetch<{ total: number; items: RewardedAdCreditRow[] }>(
                '/market/wallet/rewarded-ad-credits?limit=30',
                { token },
              ).catch(() => null),
              apiFetch<TeacherInviteSummary>('/teacher-invite/me', { token }).catch(() => null),
              apiFetch<{ total: number; items: TeacherInviteRedemptionRow[] }>(
                '/teacher-invite/redemptions?limit=25',
                { token },
              ).catch(() => null),
            ]);
            setRewardedAdCredits(rad ? { total: rad.total, items: Array.isArray(rad.items) ? rad.items : [] } : null);
            setTeacherInvite(inv);
            setTeacherInviteRedemptions(
              red ? { total: red.total, items: Array.isArray(red.items) ? red.items : [] } : null,
            );
          } finally {
            setTeacherInviteLoading(false);
          }
        } else {
          setRewardedAdCredits(null);
          setTeacherInvite(null);
          setTeacherInviteRedemptions(null);
        }
      } catch {
        setError('Veriler yüklenemedi');
        setPolicy(null);
        setActivationStatus(null);
        setActivationLedger([]);
        setRewardedAdCredits(null);
      } finally {
        setLoading(false);
      }
    };

    await Promise.all([loadUsageSlice(), loadMainSlice()]);
  }, [token, pageMine, pageSchool, isSchoolAdmin, isTeacher]);

  const activateModulePeriod = useCallback(
    async (
      moduleKey: string,
      billingPeriod: 'month' | 'year',
      targetMonth?: string,
      payWith?: 'jeton' | 'ekders',
      idempotencyKey?: string,
    ) => {
      if (!token) return;
      const busyKey = `${moduleKey}:${billingPeriod}${targetMonth ? `:${targetMonth}` : ''}`;
      setActivationBusy(busyKey);
      try {
        const res = await apiFetch<{
          ok: boolean;
          already_active: boolean;
          billing_period: string;
          period_label?: string;
        }>('/market/modules/activate', {
          method: 'POST',
          token,
          body: JSON.stringify({
            module_key: moduleKey,
            billing_period: billingPeriod,
            ...(billingPeriod === 'month' && targetMonth ? { target_month: targetMonth } : {}),
            ...(payWith ? { pay_with: payWith } : {}),
            ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
          }),
        });
        const pl = res.period_label ? ` (${res.period_label})` : '';
        toast.success(
          res.already_active ? `Bu dönem için zaten etkin${pl}` : `Modül etkinleştirildi${pl}`,
        );
        await loadAll();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(MODULE_ACTIVATION_REFRESH_EVENT));
          window.setTimeout(() => {
            document.getElementById('market-activation-ledger')?.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
          }, 120);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Etkinleştirilemedi');
      } finally {
        setActivationBusy(null);
      }
    },
    [token, loadAll],
  );

  const openActivationConfirm = useCallback(
    (args: {
      moduleKey: string;
      billingPeriod: 'month' | 'year';
      targetMonth?: string;
      monthlyNeed: { jeton: number; ekders: number };
      yearlyNeed: { jeton: number; ekders: number };
      pw: 'jeton' | 'ekders';
      walletJeton: number;
      walletEkders: number;
    }) => {
      const need = args.billingPeriod === 'month' ? args.monthlyNeed : args.yearlyNeed;
      const resolvedPay = payWithForTariff(need, args.pw);
      let paySummaryTr = '';
      if (need.jeton > 0 && need.ekders <= 0) paySummaryTr = `${fmtNum(need.jeton)} jeton`;
      else if (need.ekders > 0 && need.jeton <= 0) paySummaryTr = `${fmtNum(need.ekders)} ek ders`;
      else paySummaryTr = args.pw === 'jeton' ? `${fmtNum(need.jeton)} jeton` : `${fmtNum(need.ekders)} ek ders`;

      let periodTitleTr: string;
      if (args.billingPeriod === 'year') periodTitleTr = 'Yıllık — geçerli yıl';
      else if (args.targetMonth) periodTitleTr = `Aylık — ${fmtYmTr(args.targetMonth)}`;
      else periodTitleTr = 'Aylık — bu ay';

      const bal = { jeton: args.walletJeton, ekders: args.walletEkders };
      const hasInsufficientBalance =
        !isSuperOrMod && (need.jeton > 0 || need.ekders > 0) && !canAffordNeed(bal, need, args.pw);
      const dual = need.jeton > 0 && need.ekders > 0;

      setActivationConfirm({
        moduleKey: args.moduleKey,
        billingPeriod: args.billingPeriod,
        targetMonth: args.targetMonth,
        payWith: resolvedPay,
        moduleLabel: SCHOOL_MODULE_LABELS[args.moduleKey as SchoolModuleKey],
        periodTitleTr,
        paySummaryTr,
        walletLabel: isSchoolAdmin ? 'Okul cüzdanı' : 'Bireysel cüzdan',
        isExempt: isSuperOrMod,
        walletJeton: args.walletJeton,
        walletEkders: args.walletEkders,
        dualTariffJetonLine: dual ? `${fmtNum(need.jeton)} jeton` : null,
        dualTariffEkdersLine: dual ? `${fmtNum(need.ekders)} ek ders` : null,
        selectedPayKind: args.pw,
        hasInsufficientBalance,
        idempotencyKey:
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      });
    },
    [isSchoolAdmin, isSuperOrMod],
  );

  const handleConfirmActivation = useCallback(() => {
    setActivationConfirm((prev) => {
      if (!prev) return null;
      void activateModulePeriod(
        prev.moduleKey,
        prev.billingPeriod,
        prev.targetMonth,
        prev.payWith,
        prev.idempotencyKey,
      );
      return null;
    });
  }, [activateModulePeriod]);

  const fetchSchoolCreditAdmin = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    setSchoolCreditAdminLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(schoolCreditAdminPage),
        limit: String(SCHOOL_CREDIT_ADMIN_PAGE),
      });
      if (scFrom.trim()) q.set('from', scFrom.trim());
      if (scTo.trim()) q.set('to', scTo.trim());
      if (scSchoolId.trim()) q.set('school_id', scSchoolId.trim());
      const res = await apiFetch<{ total: number; items: SchoolCreditAdminRow[] }>(
        `/market/admin/school-credits?${q}`,
        { token },
      );
      setSchoolCreditAdmin({ total: res.total, items: Array.isArray(res.items) ? res.items : [] });
    } catch {
      setSchoolCreditAdmin(null);
    } finally {
      setSchoolCreditAdminLoading(false);
    }
  }, [token, isSuperadmin, schoolCreditAdminPage, scFrom, scTo, scSchoolId]);

  useEffect(() => {
    if (!canAccess) {
      router.replace('/403');
      return;
    }
    loadAll();
  }, [canAccess, loadAll, router]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mod = searchParams.get('module')?.trim();
    if (!mod) return;
    const el = document.getElementById(`mod-activate-${mod}`);
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-teal-500/70', 'rounded-md', 'transition-shadow');
    });
    const t = window.setTimeout(() => {
      el.classList.remove('ring-2', 'ring-teal-500/70', 'rounded-md', 'transition-shadow');
    }, 4500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [searchParams]);

  useEffect(() => {
    if (token && isSuperadmin) void fetchSchoolCreditAdmin();
  }, [token, isSuperadmin, fetchSchoolCreditAdmin]);

  const fetchTeacherCreditAdmin = useCallback(async () => {
    if (!token || !isSuperadmin) return;
    setTeacherCreditAdminLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(teacherCreditAdminPage),
        limit: String(TEACHER_CREDIT_ADMIN_PAGE),
      });
      if (tcFrom.trim()) q.set('from', tcFrom.trim());
      if (tcTo.trim()) q.set('to', tcTo.trim());
      if (tcUserId.trim()) q.set('user_id', tcUserId.trim());
      const res = await apiFetch<{ total: number; items: TeacherCreditAdminRow[] }>(
        `/market/admin/teacher-credits?${q}`,
        { token },
      );
      setTeacherCreditAdmin({ total: res.total, items: Array.isArray(res.items) ? res.items : [] });
    } catch {
      setTeacherCreditAdmin(null);
    } finally {
      setTeacherCreditAdminLoading(false);
    }
  }, [token, isSuperadmin, teacherCreditAdminPage, tcFrom, tcTo, tcUserId]);

  useEffect(() => {
    if (token && isSuperadmin) void fetchTeacherCreditAdmin();
  }, [token, isSuperadmin, fetchTeacherCreditAdmin]);

  const fetchSchoolAdminManualCredits = useCallback(async () => {
    if (!token || !isSchoolAdmin) return;
    setSaManualLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(saManualPage),
        limit: String(SCHOOL_ADMIN_MANUAL_PAGE),
      });
      if (saManualFrom.trim()) q.set('from', saManualFrom.trim());
      if (saManualTo.trim()) q.set('to', saManualTo.trim());
      const res = await apiFetch<{ total: number; items: SchoolManualCreditRow[] }>(
        `/market/wallet/school-credits?${q}`,
        { token },
      );
      setSaManual({ total: res.total, items: Array.isArray(res.items) ? res.items : [] });
    } catch {
      setSaManual(null);
    } finally {
      setSaManualLoading(false);
    }
  }, [token, isSchoolAdmin, saManualPage, saManualFrom, saManualTo]);

  useEffect(() => {
    if (token && isSchoolAdmin) void fetchSchoolAdminManualCredits();
  }, [token, isSchoolAdmin, fetchSchoolAdminManualCredits]);

  const fetchTeacherManualCredits = useCallback(async () => {
    if (!token || !isTeacher) return;
    setTManualLoading(true);
    try {
      const q = new URLSearchParams({
        page: String(tManualPage),
        limit: String(TEACHER_MANUAL_PAGE),
      });
      if (tManualFrom.trim()) q.set('from', tManualFrom.trim());
      if (tManualTo.trim()) q.set('to', tManualTo.trim());
      const res = await apiFetch<{ total: number; items: SchoolManualCreditRow[] }>(
        `/market/wallet/user-credits?${q}`,
        { token },
      );
      setTManual({ total: res.total, items: Array.isArray(res.items) ? res.items : [] });
    } catch {
      setTManual(null);
    } finally {
      setTManualLoading(false);
    }
  }, [token, isTeacher, tManualPage, tManualFrom, tManualTo]);

  useEffect(() => {
    if (token && isTeacher) void fetchTeacherManualCredits();
  }, [token, isTeacher, fetchTeacherManualCredits]);

  if (!canAccess) return null;

  const evrakQty = entitlements.find((e) => e.entitlementType === 'evrak_uretim')?.quantity ?? 0;

  const totalPagesMine = mine ? Math.max(1, Math.ceil(mine.total / PAGE_SIZE)) : 1;
  const totalPagesSchool = school ? Math.max(1, Math.ceil(school.total / PAGE_SIZE)) : 1;

  const inviteRegisterUrl =
    teacherInvite?.code && siteOrigin
      ? `${siteOrigin}/register?invite=${encodeURIComponent(teacherInvite.code)}`
      : '';

  const scrollToMarketSection = (...ids: string[]) => {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
  };

  return (
    <div className="market-page space-y-5 pb-6 sm:space-y-8 sm:pb-10">
      <div className="relative overflow-hidden rounded-xl border border-violet-400/30 bg-linear-to-br from-violet-500/12 via-fuchsia-500/8 to-cyan-500/15 p-2.5 shadow-md ring-1 ring-violet-500/15 dark:border-violet-500/20 dark:from-violet-950/50 dark:via-fuchsia-950/30 dark:to-cyan-950/35 sm:rounded-2xl sm:p-3">
        <div
          className="pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-fuchsia-400/25 blur-3xl dark:bg-fuchsia-500/15"
          aria-hidden
        />
        <p className="sr-only">
          Cüzdan: jeton ve ek ders bakiyeleri, mağaza, kullanım hakları ve hareket geçmişi bu sayfada. Uygulama
          satın almaları sunucu doğrulamasıyla işlenir; modül düşümleri politika tarifesine göre aşağıda izlenir.
        </p>
        <div className="relative flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-white shadow-md ring-2 ring-white/25 dark:ring-white/10 sm:size-11">
            <Wallet className="size-[1.15rem] sm:size-5" aria-hidden />
          </div>
          <h1 className="min-w-0 flex-1 truncate text-[15px] font-bold leading-tight tracking-tight text-foreground sm:text-lg">
            Cüzdan
          </h1>
          <div
            className="flex shrink-0 items-center gap-0.5 sm:gap-1"
            role="group"
            aria-label="Özet bölümler"
          >
            {(
              [
                {
                  label: 'Jeton ve ek ders',
                  Icon: Coins,
                  box: 'border-amber-400/40 bg-amber-500/20 text-amber-800 dark:text-amber-200',
                  targetIds: ['market-bakiye-ozet', 'market-module-activation'] as const,
                },
                {
                  label: 'Mağaza',
                  Icon: ShoppingBag,
                  box: 'border-violet-400/40 bg-violet-500/20 text-violet-800 dark:text-violet-200',
                  targetIds: ['market-satin-alma-gecmisi', 'market-mobil-magaza'] as const,
                },
                {
                  label: 'Haklar ve kullanım',
                  Icon: Receipt,
                  box: 'border-emerald-400/40 bg-emerald-500/20 text-emerald-800 dark:text-emerald-200',
                  targetIds: ['market-gerceklesen-kullanim', 'market-module-activation'] as const,
                },
                {
                  label: 'Hareket geçmişi',
                  Icon: History,
                  box: 'border-sky-400/40 bg-sky-500/20 text-sky-900 dark:text-sky-100',
                  targetIds: ['market-son-dusumler', 'market-satin-alma-gecmisi'] as const,
                },
              ] as const
            ).map(({ label, Icon, box, targetIds }) => (
              <button
                key={label}
                type="button"
                title={label}
                aria-label={`${label} bölümüne git`}
                onClick={() => scrollToMarketSection(...targetIds)}
                className={cn(
                  'inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border shadow-sm backdrop-blur-sm transition-[opacity,transform] hover:opacity-95 active:scale-95 sm:size-9',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  box,
                )}
              >
                <Icon className="size-3.5 sm:size-4" aria-hidden />
                <span className="sr-only">{label}</span>
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {isSuperOrMod && (
              <>
                <Button type="button" variant="outline" size="icon" className="h-9 w-9 border-violet-500/35 sm:hidden" asChild>
                  <Link href="/market-policy" title="Market politikası">
                    <FileText className="size-4" />
                    <span className="sr-only">Market politikası</span>
                  </Link>
                </Button>
                <Button type="button" variant="outline" size="sm" className="hidden h-9 border-violet-500/35 sm:inline-flex" asChild>
                  <Link href="/market-policy">Politika</Link>
                </Button>
              </>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 border-violet-500/35 px-2.5 sm:px-3"
              onClick={() => void loadAll()}
              disabled={loading}
            >
              <RefreshCw className={cn('size-4 sm:mr-1.5', loading && 'animate-spin')} />
              <span className="sr-only sm:not-sr-only sm:inline">Yenile</span>
            </Button>
            <InfoHintDialog label="Sayfa bilgisi" title="Cüzdan" buttonClassName="h-9 w-9 border border-violet-500/25">
              <p>
                Satın almalar uygulama doğrulamasıyla işlenir. Jeton / ek ders bakiyesi, mağaza işlemleri, kullanım ve
                hareketler bu sayfada listelenir.
              </p>
            </InfoHintDialog>
          </div>
        </div>
      </div>

      {usageLoading ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-border/40 bg-muted/40 sm:h-32" />
          ))}
        </div>
      ) : null}
      {!usageLoading && breakdown ? (
        isSchoolAdmin ? (
          <section
            id="market-bakiye-ozet"
            className="scroll-mt-4 relative overflow-hidden rounded-2xl border-2 border-blue-400/45 bg-linear-to-br from-blue-500/8 via-card to-cyan-500/6 p-3 shadow-xl ring-2 ring-blue-500/15 ring-offset-0 sm:p-4 dark:border-blue-500/35"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden />
            <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
              <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground sm:text-base">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-blue-600 to-cyan-600 text-white shadow-md ring-2 ring-white/20">
                  <Building2 className="size-4" aria-hidden />
                </span>
                Okul özeti
              </h3>
              <span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Bakiye · dönem
              </span>
            </div>
            <div className="relative grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
              <BalanceCard
                compact
                label="Okul jeton"
                value={fmtNum(wallet?.school?.jeton ?? 0)}
                icon={<Building2 className="size-20" />}
                accent="blue"
                sub="Okul cüzdanı"
              />
              <BalanceCard
                compact
                label="Okul ek ders"
                value={fmtNum(wallet?.school?.ekders ?? 0)}
                icon={<Building2 className="size-20" />}
                accent="blue"
                sub="Okul cüzdanı"
              />
              <UtcPeriodCard
                compact
                variant="month"
                remaining={formatRemainingTr(breakdown.periods.month.ends_at, nowTick)}
                progressPct={periodProgress(
                  nowTick,
                  breakdown.periods.month.ends_at,
                  'month',
                  breakdown.periods.month.starts_at,
                )}
                jeton={breakdown.school?.month.jeton ?? 0}
                ekders={breakdown.school?.month.ekders ?? 0}
                startsAt={breakdown.periods.month.starts_at}
                endsAt={breakdown.periods.month.ends_at}
                periodLabel={breakdown.periods.month.label}
              />
              <UtcPeriodCard
                compact
                variant="year"
                remaining={formatRemainingTr(breakdown.periods.year.ends_at, nowTick)}
                progressPct={periodProgress(
                  nowTick,
                  breakdown.periods.year.ends_at,
                  'year',
                  breakdown.periods.year.starts_at,
                )}
                jeton={breakdown.school?.year.jeton ?? 0}
                ekders={breakdown.school?.year.ekders ?? 0}
                startsAt={breakdown.periods.year.starts_at}
                endsAt={breakdown.periods.year.ends_at}
                periodLabel={breakdown.periods.year.label}
              />
            </div>
          </section>
        ) : wallet ? (
          <section
            id="market-bakiye-ozet"
            className="scroll-mt-4 relative overflow-hidden rounded-2xl border-2 border-violet-400/45 bg-linear-to-br from-violet-500/8 via-card to-amber-500/6 p-3 shadow-xl ring-2 ring-violet-500/15 ring-offset-0 sm:p-4 dark:border-violet-500/35"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-fuchsia-500/10 blur-3xl" aria-hidden />
            <div className="relative mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
              <h3 className="flex items-center gap-2 text-sm font-bold tracking-tight text-foreground sm:text-base">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-violet-600 to-fuchsia-600 text-white shadow-md ring-2 ring-white/20">
                  <UserRound className="size-4" aria-hidden />
                </span>
                Bireysel özet
              </h3>
              <span className="rounded-full border border-border/60 bg-background/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Bakiye · dönem
              </span>
            </div>
            <div className="relative grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
              <BalanceCard
                compact
                label="Jeton bakiyesi"
                value={fmtNum(wallet.user.jeton)}
                icon={<Coins className="size-20" />}
                accent="emerald"
                sub="Öğretmen hesabınıza tanımlı"
              />
              <BalanceCard
                compact
                label="Ek ders bakiyesi"
                value={fmtNum(wallet.user.ekders)}
                icon={<Coins className="size-20" />}
                accent="amber"
                sub="Öğretmen hesabınıza tanımlı"
              />
              <UtcPeriodCard
                compact
                variant="month"
                remaining={formatRemainingTr(breakdown.periods.month.ends_at, nowTick)}
                progressPct={periodProgress(
                  nowTick,
                  breakdown.periods.month.ends_at,
                  'month',
                  breakdown.periods.month.starts_at,
                )}
                jeton={breakdown.user.month.jeton}
                ekders={breakdown.user.month.ekders}
                startsAt={breakdown.periods.month.starts_at}
                endsAt={breakdown.periods.month.ends_at}
                periodLabel={breakdown.periods.month.label}
              />
              <UtcPeriodCard
                compact
                variant="year"
                remaining={formatRemainingTr(breakdown.periods.year.ends_at, nowTick)}
                progressPct={periodProgress(
                  nowTick,
                  breakdown.periods.year.ends_at,
                  'year',
                  breakdown.periods.year.starts_at,
                )}
                jeton={breakdown.user.year.jeton}
                ekders={breakdown.user.year.ekders}
                startsAt={breakdown.periods.year.starts_at}
                endsAt={breakdown.periods.year.ends_at}
                periodLabel={breakdown.periods.year.label}
              />
            </div>
          </section>
        ) : (
          <div id="market-bakiye-ozet" className="scroll-mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <UtcPeriodCard
              variant="month"
              remaining={formatRemainingTr(breakdown.periods.month.ends_at, nowTick)}
              progressPct={periodProgress(
                nowTick,
                breakdown.periods.month.ends_at,
                'month',
                breakdown.periods.month.starts_at,
              )}
              jeton={breakdown.user.month.jeton}
              ekders={breakdown.user.month.ekders}
              startsAt={breakdown.periods.month.starts_at}
              endsAt={breakdown.periods.month.ends_at}
              periodLabel={breakdown.periods.month.label}
            />
            <UtcPeriodCard
              variant="year"
              remaining={formatRemainingTr(breakdown.periods.year.ends_at, nowTick)}
              progressPct={periodProgress(
                nowTick,
                breakdown.periods.year.ends_at,
                'year',
                breakdown.periods.year.starts_at,
              )}
              jeton={breakdown.user.year.jeton}
              ekders={breakdown.user.year.ekders}
              startsAt={breakdown.periods.year.starts_at}
              endsAt={breakdown.periods.year.ends_at}
              periodLabel={breakdown.periods.year.label}
            />
          </div>
        )
      ) : null}

      {policy && canAccess && (
        <>
        <Card
          id="market-module-activation"
          className="overflow-hidden border-2 border-teal-500/50 bg-teal-50/15 shadow-md ring-2 ring-teal-500/20 dark:border-teal-700/60 dark:bg-teal-950/25 dark:ring-teal-500/25">
          <CardHeader className="border-b border-teal-500/25 bg-teal-100/50 px-3 py-3 pb-2.5 dark:border-teal-900/40 dark:bg-teal-950/50 sm:px-6 sm:py-4 sm:pb-3">
            <div className="flex items-start gap-2 sm:gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-600/20 text-teal-900 sm:size-10 dark:text-teal-100">
                <Unlock className="size-4 sm:size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1">
                  <CardTitle className="text-sm sm:text-base">Modül etkinleştirme</CardTitle>
                  <InfoHintDialog label="Modül etkinleştirme kuralları" title="Modül etkinleştirme">
                    <p>
                      {isSchoolAdmin ? 'Ödeme okul cüzdanından' : 'Ödeme bireysel cüzdanınızdan'} yapılır. İki tutarlı
                      tarifede satın almadan önce ödeme türünü (jeton / ek ders) seçersiniz; tek tutarlıda düşüm otomatik.
                    </p>
                    <ul>
                      <li>
                        <strong>Bu ay:</strong> kayıtlar evrensel takvim ayına göredir (tek tip takvim, tüm kullanıcılar için aynı).
                      </li>
                      <li>Aynı tarifeden ileri aylar liste + Ekle ile eklenebilir.</li>
                      <li>
                        <strong>Yıllık</strong> satın alındıysa o yıl için aylık satın alma gerekmez.
                      </li>
                    </ul>
                  </InfoHintDialog>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-0 p-0">
            {wallet ? (
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-teal-500/15 bg-teal-500/6 px-2.5 py-1.5 text-[11px] leading-tight dark:border-teal-900/30 sm:gap-x-6 sm:gap-y-2 sm:px-4 sm:py-3 sm:text-sm">
                <span className="font-medium text-foreground">
                  {isSchoolAdmin && wallet.school ? 'Okul cüzdanı' : 'Bireysel cüzdan'}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  Jeton:{' '}
                  <span className="font-semibold text-foreground">
                    {fmtNum(isSchoolAdmin && wallet.school ? wallet.school.jeton : wallet.user.jeton)}
                  </span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  Ek ders:{' '}
                  <span className="font-semibold text-foreground">
                    {fmtNum(isSchoolAdmin && wallet.school ? wallet.school.ekders : wallet.user.ekders)}
                  </span>
                </span>
                {isSuperOrMod ? (
                  <span className="text-xs text-muted-foreground">(Yönetici: tarife düşümü uygulanmaz)</span>
                ) : null}
              </div>
            ) : (
              <p className="border-b border-border/50 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
                Cüzdan bakiyesi yüklenemedi; etkinleştirme öncesi kontrol için sayfayı yenileyin.
              </p>
            )}
            <div
              className="flex flex-wrap items-center gap-1 border-b border-teal-500/15 bg-teal-500/4 px-2.5 py-1 text-[10px] leading-tight text-muted-foreground dark:border-teal-900/25 sm:gap-2 sm:px-4 sm:py-2 sm:text-xs"
              id="market-activation-utc-hint"
            >
              <span className="font-medium text-foreground">Geçerli ay:</span>{' '}
              <span className="tabular-nums text-foreground">{fmtYmTr(utcMonthLabelNow())}</span>
              <InfoHintDialog label="Ay ve ödeme türü" title="Hangi ay? Hangi ödeme?">
                <p>
                  «Bu ay» evrensel takvimdeki aya karşılık gelir; ileri aylar için liste + Ekle kullanılır. İki tutarlı
                  tarifede ödeme türü satıra göre seçilir.
                </p>
              </InfoHintDialog>
            </div>
            <div
              className="space-y-2.5 p-2 sm:space-y-4 sm:p-4"
              aria-describedby="market-activation-utc-hint"
            >
                  {SCHOOL_MODULE_KEYS.map((k) => {
                    const row = policy.module_prices[k];
                    const scope = isSchoolAdmin ? row?.school : row?.teacher;
                    const mc = tariffNonZero(scope?.monthly);
                    const yc = tariffNonZero(scope?.yearly);
                    const free = !mc && !yc;
                    const actBal =
                      wallet &&
                      (isSchoolAdmin && wallet.school
                        ? { jeton: wallet.school.jeton, ekders: wallet.school.ekders }
                        : { jeton: wallet.user.jeton, ekders: wallet.user.ekders });
                    const monthlyNeed = pairNums(scope?.monthly);
                    const yearlyNeed = pairNums(scope?.yearly);
                    const pw = payWithByModule[k] ?? 'jeton';
                    const mixedMonth = monthlyNeed.jeton > 0 && monthlyNeed.ekders > 0;
                    const mixedYear = yearlyNeed.jeton > 0 && yearlyNeed.ekders > 0;
                    const showPayToggle = !free && !isSuperOrMod && (mixedMonth || mixedYear);
                    const okMonth =
                      isSuperOrMod || free || !mc || (actBal ? canAffordNeed(actBal, monthlyNeed, pw) : false);
                    const okYear =
                      isSuperOrMod || free || !yc || (actBal ? canAffordNeed(actBal, yearlyNeed, pw) : false);
                    const st = activationStatus?.modules[k];
                    const durum =
                      free ? (
                        <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:px-2 sm:text-[11px]">
                          Ücretsiz
                        </span>
                      ) : st?.active ? (
                        <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 sm:px-2 sm:text-[11px] dark:text-emerald-200">
                          Etkin
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 sm:px-2 sm:text-[11px] dark:text-amber-200">
                          Gerekli
                        </span>
                      );
                    const curYm = utcMonthLabelNow();
                    const actM = activationByModule.get(k);
                    const hasYearAct = actM?.hasYear ?? false;
                    const monthSet = actM?.months ?? new Set<string>();
                    const purchasedThisUtcMonth = monthSet.has(curYm);
                    const extraMonthOpts: string[] = [];
                    if (mc && !free && !hasYearAct) {
                      for (let i = 1; i <= 24; i++) {
                        const m = utcMonthAdd(curYm, i);
                        if (!monthSet.has(m)) extraMonthOpts.push(m);
                      }
                    }
                    const rawExtra = extraMonthPick[k];
                    const extraPick =
                      rawExtra && extraMonthOpts.includes(rawExtra) ? rawExtra : (extraMonthOpts[0] ?? '');
                    const disBuAy =
                      activationBusy !== null ||
                      !mc ||
                      free ||
                      hasYearAct ||
                      (!isSuperOrMod && !okMonth) ||
                      (purchasedThisUtcMonth && !isSuperOrMod);
                    const disExtraAy =
                      activationBusy !== null ||
                      !mc ||
                      free ||
                      hasYearAct ||
                      extraMonthOpts.length === 0 ||
                      !extraPick ||
                      (!isSuperOrMod && !okMonth);
                    const disYear =
                      activationBusy !== null ||
                      !yc ||
                      free ||
                      (!isSuperOrMod && !okYear) ||
                      (hasYearAct && !isSuperOrMod);
                    const modIdx = SCHOOL_MODULE_KEYS.indexOf(k);
                    const cardAccent =
                      ACTIVATION_MODULE_CARD_STYLES[
                        modIdx >= 0 ? modIdx % ACTIVATION_MODULE_CARD_STYLES.length : 0
                      ];
                    const timelineMonths = monthsFromUtc(curYm, 12);
                    return (
                      <article
                        key={k}
                        id={`mod-activate-${k}`}
                        className={cn(
                          'overflow-hidden rounded-xl border-2 shadow-md ring-1 ring-black/5 sm:rounded-2xl dark:ring-white/10',
                          cardAccent,
                        )}
                      >
                        <div className="flex flex-col gap-2.5 p-2 sm:gap-4 sm:p-4 lg:flex-row lg:items-stretch lg:gap-5">
                          <div className="min-w-0 flex-1 space-y-2 sm:space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-1.5 gap-y-1 sm:gap-2">
                              <div className="min-w-0 pr-1">
                                <h4 className="text-sm font-bold leading-snug text-foreground sm:text-base">
                                  {SCHOOL_MODULE_LABELS[k]}
                                </h4>
                                <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
                                  {isSchoolAdmin ? 'Okul' : 'Bireysel'} · J/E
                                </p>
                              </div>
                              {durum}
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
                              <div className="rounded-lg border border-violet-400/35 bg-violet-500/10 px-2 py-1.5 dark:border-violet-700/40 dark:bg-violet-950/30 sm:rounded-xl sm:px-2.5 sm:py-2">
                                <p className="text-[9px] font-bold uppercase tracking-wide text-violet-800 sm:text-[10px] dark:text-violet-200">
                                  Aylık
                                </p>
                                <p className="mt-0.5 tabular-nums text-[11px] font-medium text-foreground sm:text-xs">
                                  {mc ? (
                                    <>
                                      {fmtNum(monthlyNeed.jeton)} / {fmtNum(monthlyNeed.ekders)}
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </p>
                                <div className="mt-0.5 flex items-center justify-between gap-1 sm:mt-1">
                                  <span className="text-[9px] text-muted-foreground sm:text-[10px]">Bakiye</span>
                                  {!mc ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : okMonth ? (
                                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 sm:size-4 dark:text-emerald-400" aria-label="Yeterli" />
                                  ) : (
                                    <XCircle className="size-3.5 shrink-0 text-red-600 sm:size-4 dark:text-red-400" aria-label="Yetersiz" />
                                  )}
                                </div>
                              </div>
                              <div className="rounded-lg border border-fuchsia-400/35 bg-fuchsia-500/10 px-2 py-1.5 dark:border-fuchsia-700/40 dark:bg-fuchsia-950/25 sm:rounded-xl sm:px-2.5 sm:py-2">
                                <p className="text-[9px] font-bold uppercase tracking-wide text-fuchsia-900 sm:text-[10px] dark:text-fuchsia-100">
                                  Yıllık
                                </p>
                                <p className="mt-0.5 tabular-nums text-[11px] font-medium text-foreground sm:text-xs">
                                  {yc ? (
                                    <>
                                      {fmtNum(yearlyNeed.jeton)} / {fmtNum(yearlyNeed.ekders)}
                                    </>
                                  ) : (
                                    '—'
                                  )}
                                </p>
                                <div className="mt-0.5 flex items-center justify-between gap-1 sm:mt-1">
                                  <span className="text-[9px] text-muted-foreground sm:text-[10px]">Bakiye</span>
                                  {!yc ? (
                                    <span className="text-muted-foreground">—</span>
                                  ) : okYear ? (
                                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 sm:size-4 dark:text-emerald-400" aria-label="Yeterli" />
                                  ) : (
                                    <XCircle className="size-3.5 shrink-0 text-red-600 sm:size-4 dark:text-red-400" aria-label="Yetersiz" />
                                  )}
                                </div>
                              </div>
                              <div className="col-span-2 flex items-start gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/8 px-2 py-1.5 sm:col-span-2 sm:items-center sm:gap-2 sm:rounded-xl sm:px-2.5 sm:py-2">
                                <Coins className="size-3.5 shrink-0 text-amber-700 sm:size-4 dark:text-amber-300" aria-hidden />
                                <BookOpen className="size-3.5 shrink-0 text-sky-700 sm:size-4 dark:text-sky-300" aria-hidden />
                                <span className="text-[10px] leading-tight text-muted-foreground sm:text-[11px] sm:leading-snug">
                                  <span className="sm:hidden">Ödeme türüne göre bakiye üstte.</span>
                                  <span className="hidden sm:inline">
                                    Seçilen ödeme türüne göre bakiye yeterliliği yukarıda gösterilir.
                                  </span>
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex w-full min-w-0 shrink-0 flex-col gap-2 border-t border-border/50 pt-3 sm:gap-3 sm:pt-4 lg:max-w-[min(100%,320px)] lg:border-l lg:border-t-0 lg:pt-0 lg:pl-5">
                          {free ? (
                            <span className="text-[11px] text-muted-foreground sm:text-xs">—</span>
                          ) : (
                            <div className="flex w-full min-w-0 flex-col gap-2 sm:gap-3">
                              {showPayToggle ? (
                                <div className="w-full min-w-0 shrink-0 rounded-md border border-border/60 bg-muted/30 p-1.5 sm:rounded-lg sm:p-2">
                                  <p className="mb-1 text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:mb-1.5 sm:text-[10px]">
                                    Ödeme türü
                                  </p>
                                  <div className="grid w-full min-w-0 grid-cols-2 gap-1 sm:gap-1.5">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={pw === 'jeton' ? 'default' : 'outline'}
                                      className="h-7 min-h-0 min-w-0 truncate px-2 text-[11px] sm:h-8 sm:text-xs"
                                      onClick={() => setPayWithByModule((prev) => ({ ...prev, [k]: 'jeton' }))}
                                    >
                                      Jeton
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={pw === 'ekders' ? 'default' : 'outline'}
                                      className="h-7 min-h-0 min-w-0 truncate px-2 text-[11px] sm:h-8 sm:text-xs"
                                      onClick={() => setPayWithByModule((prev) => ({ ...prev, [k]: 'ekders' }))}
                                    >
                                      Ek ders
                                    </Button>
                                  </div>
                                </div>
                              ) : null}
                              {mc ? (
                                <div className="flex w-full min-w-0 shrink-0 flex-col gap-1 rounded-md border border-teal-500/15 bg-teal-500/4 px-1.5 py-1.5 dark:border-teal-900/30 sm:gap-1.5 sm:rounded-lg sm:px-2 sm:py-2">
                                  <span className="text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                                    Aylık · bu ay
                                  </span>
                                  <div className="flex w-full min-w-0 flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:justify-end">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="h-7 w-full min-w-0 shrink-0 border-teal-500/35 text-[11px] sm:h-8 sm:w-auto sm:text-xs"
                                      disabled={disBuAy}
                                      title={
                                        disBuAy && !activationBusy && mc
                                          ? !okMonth
                                            ? 'Aylık tarife için (seçilen türde) bakiye yetersiz'
                                            : hasYearAct
                                              ? 'Yıllık etkin; bu yıl için aylık satın almaya gerek yok'
                                              : purchasedThisUtcMonth
                                                ? 'Bu ay için zaten kayıt var'
                                                : undefined
                                          : 'Bu ay için aylık etkinleştir'
                                      }
                                      onClick={() =>
                                        openActivationConfirm({
                                          moduleKey: k,
                                          billingPeriod: 'month',
                                          monthlyNeed,
                                          yearlyNeed,
                                          pw,
                                          walletJeton: actBal?.jeton ?? 0,
                                          walletEkders: actBal?.ekders ?? 0,
                                        })
                                      }
                                    >
                                      {activationBusy === `${k}:month` ? '…' : 'Bu ay'}
                                    </Button>
                                    {extraMonthOpts.length > 0 ? (
                                      <div className="flex w-full min-w-0 flex-col gap-1.5 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
                                        <Select
                                          value={extraPick}
                                          onValueChange={(v) =>
                                            setExtraMonthPick((prev) => ({ ...prev, [k]: v }))
                                          }
                                          disabled={disExtraAy}
                                        >
                                          <SelectTrigger
                                            className="h-7 w-full min-w-0 py-1 text-[11px] sm:h-8 sm:text-xs sm:min-w-38 sm:max-w-56"
                                            id={`extra-month-${k}`}
                                          />
                                          <SelectValue placeholder="Ay seçin" />
                                          {extraMonthOpts.map((ym) => (
                                            <SelectItem key={ym} value={ym}>
                                              + {fmtYmTr(ym)}
                                            </SelectItem>
                                          ))}
                                        </Select>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="secondary"
                                          className="h-7 w-full min-w-0 shrink-0 text-[11px] sm:h-8 sm:w-auto sm:text-xs"
                                          disabled={disExtraAy}
                                          title={
                                            disExtraAy && !activationBusy && mc && extraPick
                                              ? !okMonth
                                                ? 'Aylık tarife için (seçilen türde) bakiye yetersiz'
                                                : undefined
                                              : extraPick
                                                ? `${fmtYmTr(extraPick)} için aylık etkinleştir`
                                                : undefined
                                          }
                                          onClick={() =>
                                            openActivationConfirm({
                                              moduleKey: k,
                                              billingPeriod: 'month',
                                              targetMonth: extraPick,
                                              monthlyNeed,
                                              yearlyNeed,
                                              pw,
                                              walletJeton: actBal?.jeton ?? 0,
                                              walletEkders: actBal?.ekders ?? 0,
                                            })
                                          }
                                        >
                                          {activationBusy === `${k}:month:${extraPick}` ? '…' : 'Ekle'}
                                        </Button>
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}
                              {yc ? (
                                <div className="flex w-full min-w-0 shrink-0 flex-col gap-1 rounded-md border border-teal-500/15 bg-background/80 px-1.5 py-1.5 dark:border-teal-900/30 sm:gap-1.5 sm:rounded-lg sm:px-2 sm:py-2">
                                  <span className="text-left text-[9px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                                    Yıllık
                                  </span>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 w-full min-w-0 text-[11px] sm:h-8 sm:w-auto sm:text-xs"
                                    disabled={disYear}
                                    title={
                                      disYear && !activationBusy && yc
                                        ? !okYear
                                          ? 'Yıllık tarife için (seçilen türde) bakiye yetersiz'
                                          : hasYearAct
                                            ? 'Bu yıl için yıllık kayıt zaten var'
                                            : undefined
                                        : 'Bu yıl için yıllık etkinleştir'
                                    }
                                    onClick={() =>
                                      openActivationConfirm({
                                        moduleKey: k,
                                        billingPeriod: 'year',
                                        monthlyNeed,
                                        yearlyNeed,
                                        pw,
                                        walletJeton: actBal?.jeton ?? 0,
                                        walletEkders: actBal?.ekders ?? 0,
                                      })
                                    }
                                  >
                                    {activationBusy === `${k}:year` ? '…' : 'Bu yıl'}
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          )}
                          </div>
                        </div>
                        <div className="border-t border-border/60 bg-linear-to-br from-muted/50 via-background/90 to-muted/30 px-2 py-2 sm:px-4 sm:py-3">
                          <div className="mb-1.5 flex flex-wrap items-center gap-1.5 sm:mb-2 sm:gap-2">
                            <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-cyan-500/15 text-cyan-800 sm:size-8 sm:rounded-lg dark:text-cyan-200">
                              <CalendarDays className="size-3.5 sm:size-4" aria-hidden />
                            </span>
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-foreground sm:text-[11px]">
                                Kullanım zaman çizelgesi
                              </p>
                              <p className="text-[9px] text-muted-foreground sm:text-[10px]">Aylık kayıtlar · evrensel takvim</p>
                            </div>
                          </div>
                          {free ? (
                            <p className="text-[11px] text-muted-foreground sm:text-xs">Ücretsiz modül — çizelge yok.</p>
                          ) : hasYearAct ? (
                            <div className="flex flex-col gap-1.5 rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-2 py-2 dark:border-emerald-700/50 dark:bg-emerald-950/40 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5">
                              <div className="flex items-start gap-1.5 sm:items-center sm:gap-2">
                                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700 sm:mt-0 sm:size-5 dark:text-emerald-300" aria-hidden />
                                <p className="text-xs font-semibold leading-snug text-emerald-950 sm:text-sm dark:text-emerald-50">
                                  {utcYearLabelNow()} — yıllık lisans aktif
                                </p>
                              </div>
                              <p className="text-[10px] leading-snug text-emerald-900/90 sm:text-[11px] sm:leading-relaxed dark:text-emerald-100/90">
                                Aylık satın almaya gerek yok (yıllık paket).
                              </p>
                              <div
                                className="h-2 w-full overflow-hidden rounded-full bg-emerald-950/15 sm:h-2.5 dark:bg-emerald-500/10"
                                aria-hidden
                              >
                                <div className="h-full w-full bg-linear-to-r from-emerald-500 via-teal-400 to-cyan-400 opacity-90" />
                              </div>
                            </div>
                          ) : (
                            <div
                              role="list"
                              className="touch-pan-x flex gap-1 overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] sm:gap-1.5 sm:pb-1"
                            >
                              {timelineMonths.map((ym) => {
                                const covered = monthSet.has(ym);
                                const isNow = ym === curYm;
                                const yy = ym.split('-')[0] ?? '';
                                return (
                                  <div
                                    key={ym}
                                    role="listitem"
                                    title={fmtYmTr(ym)}
                                    className={cn(
                                      'flex min-w-[2.7rem] shrink-0 flex-col items-center justify-center rounded-lg border px-1 py-1.5 text-center transition-colors sm:min-w-[3.1rem] sm:rounded-xl sm:border-2 sm:px-1.5 sm:py-2',
                                      covered
                                        ? 'border-emerald-400/70 bg-emerald-500/25 text-emerald-950 shadow-sm dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-50'
                                        : 'border-border/60 bg-muted/50 text-muted-foreground dark:border-border/80',
                                      isNow &&
                                        'ring-2 ring-violet-500/80 ring-offset-1 ring-offset-background sm:ring-offset-2 dark:ring-violet-400/80',
                                    )}
                                  >
                                    <span className="max-w-16 truncate text-[9px] font-semibold leading-none sm:text-[10px]">
                                      {fmtMonthShortUtc(ym)}
                                    </span>
                                    <span className="mt-0.5 text-[8px] font-bold tabular-nums opacity-80 sm:text-[9px]">
                                      {`'${yy.slice(-2)}`}
                                    </span>
                                    {covered ? (
                                      <CheckCircle2 className="mt-0.5 size-3 text-emerald-700 sm:mt-1 sm:size-3.5 dark:text-emerald-300" aria-hidden />
                                    ) : (
                                      <span className="mt-0.5 block size-3 rounded-full border border-dashed border-border/80 sm:mt-1 sm:h-3.5 sm:w-3.5" aria-hidden />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {!free && !hasYearAct && mc ? (
                            <p className="mt-1.5 text-[9px] text-muted-foreground sm:mt-2 sm:text-[10px]">
                              <span className="sm:hidden">Yeşil: kayıtlı ay · Mor: bu ay</span>
                              <span className="hidden sm:inline">
                                Yeşil: o ay için aylık kayıt var. Mor çerçeve: şu anki ay (evrensel takvim).
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
            </div>
            {activationLedger.length > 0 ? (
              <div
                id="market-activation-ledger"
                className="scroll-mt-4 border-t border-border/60 bg-muted/20 px-2 py-3 sm:px-4 sm:py-4"
              >
                <p className="mb-2 text-xs font-semibold text-foreground sm:mb-3 sm:text-sm">
                  Etkinleştirme kayıtları (son işlemler)
                </p>
                <div className="table-x-scroll">
                  <table className="w-full min-w-[300px] text-[11px] sm:min-w-[640px] sm:text-sm">
                    <thead>
                      <tr className="border-b border-border/60 text-left text-[11px] font-medium uppercase text-muted-foreground">
                        <th className="py-2 pr-3" title="Evrensel saat (UTC)">
                          Zaman
                        </th>
                        <th className="py-2 pr-3">Modül</th>
                        <th className="py-2 pr-3">Tür</th>
                        <th className="py-2 pr-3">Dönem</th>
                        <th className="py-2 pr-3 text-right">Düşüm</th>
                        <th className="py-2">Cüzdan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {activationLedger.map((r) => (
                        <tr key={r.id} className="text-muted-foreground">
                          <td className="py-2 pr-3 tabular-nums text-foreground">{fmtLedgerTs(r.created_at)}</td>
                          <td className="py-2 pr-3 font-medium text-foreground">
                            {r.module_key in SCHOOL_MODULE_LABELS
                              ? SCHOOL_MODULE_LABELS[r.module_key as SchoolModuleKey]
                              : r.module_key}
                          </td>
                          <td className="py-2 pr-3">{r.billing_period === 'month' ? 'Aylık' : 'Yıllık'}</td>
                          <td className="py-2 pr-3 tabular-nums">{r.period_label}</td>
                          <td className="py-2 pr-3 text-right tabular-nums text-foreground">
                            {fmtActivationDebitRow(r.debit_jeton, r.debit_ekders)}
                          </td>
                          <td className="py-2">{r.debit_target === 'school' ? 'Okul' : 'Bireysel'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Dialog
          open={activationConfirm !== null}
          onOpenChange={(o) => {
            if (!o) setActivationConfirm(null);
          }}
        >
          <DialogContent
            title="Satın almayı onayla"
            descriptionId="activation-confirm-desc"
            className="max-w-md overflow-hidden border-teal-500/30 bg-card p-0 shadow-2xl ring-2 ring-teal-500/15"
          >
            {activationConfirm ? (
              <div className="relative space-y-4">
                <div
                  className={cn(
                    'pointer-events-none absolute inset-x-0 -top-px h-28 bg-linear-to-b from-teal-500/18 via-emerald-500/10 to-transparent',
                  )}
                />
                <div className="relative flex gap-3">
                  <div
                    className={cn(
                      'flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-teal-500/30 to-emerald-500/20 text-teal-900 shadow-inner ring-1 ring-teal-500/35',
                      'dark:from-teal-400/20 dark:to-emerald-500/15 dark:text-teal-100',
                    )}
                  >
                    <BadgeCheck className="size-6" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
                      <Sparkles className="size-3.5" aria-hidden />
                      Modül etkinleştirme
                    </p>
                    <p
                      id="activation-confirm-desc"
                      className="text-sm leading-relaxed text-muted-foreground"
                    >
                      Seçilen cüzdandan aşağıdaki tutar düşülecek. Aynı onay için tekrar gönderimde çift düşüm
                      engellenir.
                    </p>
                  </div>
                </div>
                <dl className="relative space-y-0 overflow-hidden rounded-xl border border-border/60 bg-muted/25 text-sm">
                  <div className="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5">
                    <dt className="shrink-0 text-muted-foreground">Modül</dt>
                    <dd className="min-w-0 text-right font-medium text-foreground">
                      {activationConfirm.moduleLabel}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5">
                    <dt className="shrink-0 text-muted-foreground">Dönem</dt>
                    <dd className="min-w-0 text-right font-medium text-foreground">
                      {activationConfirm.periodTitleTr}
                    </dd>
                  </div>
                  {activationConfirm.dualTariffJetonLine && activationConfirm.dualTariffEkdersLine ? (
                    <div className="border-b border-border/50 px-3 py-2.5">
                      <p className="mb-1 text-muted-foreground">Tarife seçenekleri</p>
                      <div className="space-y-1 text-right font-medium tabular-nums text-foreground">
                        <div>{activationConfirm.dualTariffJetonLine}</div>
                        <div>{activationConfirm.dualTariffEkdersLine}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          Seçiminiz:{' '}
                          {activationConfirm.selectedPayKind === 'jeton' ? 'Jeton' : 'Ek ders'}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5">
                    <dt className="shrink-0 text-muted-foreground">Düşülecek</dt>
                    <dd className="min-w-0 text-right font-medium tabular-nums text-foreground">
                      {activationConfirm.paySummaryTr}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 border-b border-border/50 px-3 py-2.5">
                    <dt className="shrink-0 text-muted-foreground">Mevcut bakiye</dt>
                    <dd className="min-w-0 text-right font-medium tabular-nums text-foreground">
                      {fmtNum(activationConfirm.walletJeton)} J · {fmtNum(activationConfirm.walletEkders)} E
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <dt className="shrink-0 text-muted-foreground">Cüzdan</dt>
                    <dd className="min-w-0 text-right font-medium text-foreground">
                      {activationConfirm.walletLabel}
                    </dd>
                  </div>
                </dl>
                {activationConfirm.hasInsufficientBalance && !activationConfirm.isExempt ? (
                  <p className="relative rounded-lg border border-red-500/35 bg-red-500/10 px-3 py-2 text-xs text-red-900 dark:text-red-100">
                    Seçilen ödeme türü için bakiye yetersiz. Önce cüzdanı yükleyin veya ödeme türünü değiştirin.
                  </p>
                ) : null}
                {activationConfirm.isExempt ? (
                  <p className="relative rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                    Yönetici hesabı: tarife düşümü uygulanmaz; kayıt yine oluşturulur.
                  </p>
                ) : null}
                <DialogFooter className="border-t-0 p-0 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setActivationConfirm(null)}>
                    Vazgeç
                  </Button>
                  <Button
                    type="button"
                    className="gap-2 bg-linear-to-r from-teal-600 to-emerald-600 text-white shadow-md hover:from-teal-600/95 hover:to-emerald-600/95"
                    onClick={handleConfirmActivation}
                    disabled={
                      activationBusy !== null ||
                      (activationConfirm.hasInsufficientBalance && !activationConfirm.isExempt)
                    }
                  >
                    {activationBusy !== null ? '…' : 'Onayla ve etkinleştir'}
                  </Button>
                </DialogFooter>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
        </>
      )}

      {isTeacher && (
        <Card className="overflow-hidden border-2 border-teal-500/45 bg-linear-to-br from-teal-500/10 via-card to-card shadow-md ring-2 ring-teal-500/20 dark:border-teal-700/50">
          <CardHeader className="border-b border-border/50 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-teal-600/15 text-teal-800 dark:text-teal-200 sm:size-11 sm:rounded-xl">
                  <UserPlus className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1">
                    <CardTitle className="text-base">Arkadaşını davet et</CardTitle>
                    <InfoHintDialog label="Davetiye ve ödüller" title="Arkadaşını davet et">
                      <p>
                        Jeton ödülleri market politikasının <strong>öğretmen davetiye</strong> kurallarına göre hesaplanır.
                      </p>
                      <p className="font-medium text-foreground">Nasıl kullanılır?</p>
                      <ul>
                        <li>«Kod oluştur / göster» ile kişisel davet kodunuzu alın (bir kez üretilir).</li>
                        <li>Kayıt linkini veya kodu paylaşın; mobil kayıtta kod girilebilir.</li>
                        <li>Kayıt tamamlanınca ödüller jeton cüzdanınıza işlenir.</li>
                      </ul>
                    </InfoHintDialog>
                  </div>
                </div>
              </div>
              {teacherInvite?.enabled ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={teacherInviteLoading}
                  onClick={() => {
                    if (!token) return;
                    void (async () => {
                      setTeacherInviteLoading(true);
                      try {
                        await apiFetch('/teacher-invite/ensure-code', { method: 'POST', token });
                        const [inv, red] = await Promise.all([
                          apiFetch<TeacherInviteSummary>('/teacher-invite/me', { token }),
                          apiFetch<{ total: number; items: TeacherInviteRedemptionRow[] }>(
                            '/teacher-invite/redemptions?limit=25',
                            { token },
                          ),
                        ]);
                        setTeacherInvite(inv);
                        setTeacherInviteRedemptions(
                          red ? { total: red.total, items: Array.isArray(red.items) ? red.items : [] } : null,
                        );
                        toast.success('Davet kodunuz hazır');
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'İşlem başarısız');
                      } finally {
                        setTeacherInviteLoading(false);
                      }
                    })();
                  }}
                >
                  Kod oluştur / göster
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3 text-sm text-muted-foreground sm:space-y-4 sm:pt-4">
            {teacherInviteLoading && !teacherInvite ? (
              <LoadingSpinner label="Davetiye bilgisi yükleniyor…" />
            ) : !teacherInvite && !teacherInviteLoading ? (
              <Alert variant="warning" message="Davet bilgisi alınamadı. Sayfayı yenileyin veya daha sonra tekrar deneyin." />
            ) : teacherInvite && !teacherInvite.enabled ? (
              <Alert
                variant="warning"
                message="Davetiye sistemi yönetici tarafından kapalı. Açıldığında buradan kod oluşturabilirsiniz."
              />
            ) : (
              <>
                {teacherInvite?.enabled && teacherInvite.policy ? (
                  <p className="rounded-lg border border-teal-500/25 bg-teal-500/6 px-3 py-2 text-xs text-foreground">
                    Politika özeti: Yeni öğretmen{' '}
                    <span className="font-semibold tabular-nums">+{fmtNum(teacherInvite.policy.jeton_for_invitee)}</span>{' '}
                    jeton · Siz (davet eden){' '}
                    <span className="font-semibold tabular-nums">+{fmtNum(teacherInvite.policy.jeton_for_inviter)}</span>{' '}
                    jeton
                    {teacherInvite.policy.max_invites_per_teacher > 0 ? (
                      <>
                        {' '}
                        · En fazla{' '}
                        <span className="font-semibold tabular-nums">
                          {teacherInvite.policy.max_invites_per_teacher}
                        </span>{' '}
                        davet / öğretmen
                      </>
                    ) : (
                      <> · Davet kotası sınırsız</>
                    )}
                  </p>
                ) : null}
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Davet kodunuz</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-lg font-semibold tracking-wider text-foreground">
                      {teacherInvite?.code ?? '—'}
                    </span>
                    {teacherInvite?.code ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => {
                            void navigator.clipboard.writeText(teacherInvite.code ?? '').then(
                              () => toast.success('Kod panoya kopyalandı'),
                              () => toast.error('Kopyalanamadı'),
                            );
                          }}
                        >
                          <Copy className="mr-1 size-3.5" />
                          Kodu kopyala
                        </Button>
                        {inviteRegisterUrl ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                void navigator.clipboard.writeText(inviteRegisterUrl).then(
                                  () => toast.success('Kayıt linki kopyalandı'),
                                  () => toast.error('Kopyalanamadı'),
                                );
                              }}
                            >
                              <Copy className="mr-1 size-3.5" />
                              Kayıt linkini kopyala
                            </Button>
                            <Button type="button" size="sm" variant="secondary" className="h-8" asChild>
                              <Link
                                href={`/register?invite=${encodeURIComponent(teacherInvite.code ?? '')}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink className="mr-1 size-3.5" />
                                Kayıt sayfasını aç
                              </Link>
                            </Button>
                          </>
                        ) : null}
                      </>
                    ) : teacherInvite?.enabled ? (
                      <span className="text-xs text-amber-800 dark:text-amber-200">
                        Henüz kod yok — «Kod oluştur / göster»e tıklayın.
                      </span>
                    ) : null}
                  </div>
                  {inviteRegisterUrl ? (
                    <div className="rounded-md border border-dashed border-teal-500/30 bg-muted/40 px-3 py-2 font-mono text-[11px] break-all text-foreground">
                      {inviteRegisterUrl}
                    </div>
                  ) : null}
                </div>
                <p className="text-xs">
                  Toplam davet:{' '}
                  <span className="font-medium text-foreground">{teacherInvite?.total_redemptions ?? 0}</span>
                  {' · '}
                  Davetçi olarak kazanılan jeton (özet):{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {fmtNum(teacherInvite?.total_inviter_jeton ?? 0)}
                  </span>
                </p>
                <div className="rounded-xl border border-teal-500/20 bg-background/80">
                  <p className="border-b border-border/60 px-4 py-2 text-xs font-medium text-foreground">
                    Davet kullanımları
                  </p>
                  {teacherInviteRedemptions && teacherInviteRedemptions.items.length > 0 ? (
                    <div className="table-x-scroll">
                      <table className="w-full min-w-[280px] text-sm">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                            <th className="px-4 py-2">Tarih</th>
                            <th className="px-4 py-2">Öğretmen</th>
                            <th className="px-4 py-2 text-right">Ona jeton</th>
                            <th className="px-4 py-2 text-right">Size jeton</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {teacherInviteRedemptions.items.map((row) => (
                            <tr key={row.id} className="hover:bg-muted/40">
                              <td className="whitespace-nowrap px-4 py-2 text-foreground">
                                {row.created_at ? fmtDate(row.created_at) : '—'}
                              </td>
                              <td className="px-4 py-2 text-foreground">{row.invitee_display ?? '—'}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                                +{fmtNum(row.invitee_jeton)}
                              </td>
                              <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                                +{fmtNum(row.inviter_jeton)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                      Henüz davet kullanımı yok. Linki veya kodu paylaştığınızda burada listelenir.
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isTeacher && (
        <Card className="overflow-hidden border-2 border-violet-500/45 bg-linear-to-br from-violet-500/12 via-card to-card shadow-md ring-2 ring-violet-500/20 dark:border-violet-600/45">
          <CardHeader className="border-b border-border/50 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-600/15 text-violet-800 dark:text-violet-200 sm:size-11 sm:rounded-xl">
                  <Smartphone className="size-5 sm:size-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1">
                    <CardTitle className="text-base">Ödüllü reklam</CardTitle>
                    <InfoHintDialog label="Ödüllü reklam" title="Ödüllü reklam">
                      <p>
                        Reklamlar yalnızca mobil uygulamada izlenir; bu sayfada oynatılmaz. Kurallar ve mağaza linkleri için
                        «Ayrıntılar» sayfasını açın.
                      </p>
                    </InfoHintDialog>
                  </div>
                </div>
              </div>
              <Button type="button" size="sm" variant="secondary" asChild>
                <Link href="/market/rewarded-ad">Ayrıntılar</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-3 text-sm text-muted-foreground sm:space-y-4 sm:pt-4">
            <p>
              Durum:{' '}
              <span className="font-medium text-foreground">
                {policy?.rewarded_ad_jeton?.enabled ? 'Açık (mobilde kullanılabilir)' : 'Kapalı veya yapılandırılmadı'}
              </span>
              {policy?.rewarded_ad_jeton?.enabled ? (
                <>
                  {' '}
                  · Ödül başına ~{' '}
                  <span className="tabular-nums font-medium text-foreground">
                    {fmtNum(policy.rewarded_ad_jeton.jeton_per_reward)}
                  </span>{' '}
                  jeton
                </>
              ) : null}
            </p>
            <div className="rounded-xl border border-violet-500/20 bg-background/80">
              <p className="border-b border-border/60 px-4 py-2 text-xs font-medium text-foreground">
                Ödüllü reklamla kazanılan jetonlar
              </p>
              {rewardedAdCredits && rewardedAdCredits.items.length > 0 ? (
                <div className="table-x-scroll">
                  <table className="w-full min-w-[280px] text-sm">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/30 text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2">Tarih / saat</th>
                        <th className="px-4 py-2 text-right">Kazanılan jeton</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {rewardedAdCredits.items.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/40">
                          <td className="whitespace-nowrap px-4 py-2 text-foreground">
                            {row.created_at ? fmtDate(row.created_at) : '—'}
                          </td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                            +{fmtNum(parseFloat(row.jeton_credit || '0'))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Henüz kayıt yok. Ödüllü reklamı mobil uygulamada izlediğinizde kazanımlar burada listelenir.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {policy && (showTeacherTariffs || showSchoolTariffs) && (
        <section
          aria-labelledby={
            showTeacherTariffs ? 'policy-tariff-teacher-heading' : 'policy-tariff-school-heading'
          }
          className="space-y-2"
        >
          <div className="flex items-center gap-1 px-0.5">
            <span className="text-xs font-medium text-muted-foreground">Birim fiyatlar</span>
            <InfoHintDialog label="Tarife tablosu" title="Birim fiyatlar (tarife)">
              <p>
                Her kullanımda düşecek jeton / ek ders tutarları (fiyat listesi). Günlük hareket veya toplam özet değildir.
              </p>
            </InfoHintDialog>
          </div>
          <div className={cn('grid gap-6', showTeacherTariffs && showSchoolTariffs ? 'lg:grid-cols-2' : '')}>
            {showTeacherTariffs ? (
            <Card className="overflow-hidden border-2 border-emerald-500/35 bg-emerald-50/20 shadow-md ring-1 ring-emerald-500/15 dark:border-emerald-800/50 dark:bg-emerald-950/25">
              <CardHeader className="border-b border-emerald-500/25 bg-emerald-100/40 pb-3 dark:border-emerald-800/40 dark:bg-emerald-950/50">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200">
                    <UserRound className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <CardTitle id="policy-tariff-teacher-heading" className="text-base">
                        Öğretmen tarifeleri
                      </CardTitle>
                      <span className="inline-flex shrink-0 rounded-full border border-emerald-600/30 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                        Tarife
                      </span>
                      <InfoHintDialog label="Öğretmen tarifesi" title="Öğretmen tarifeleri">
                        <p>
                          Aylık ve yıllık satırlar ayrıdır; varsayılan uygulama genelde aylık tarifedir.
                        </p>
                      </InfoHintDialog>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[360px] sm:min-w-[520px] text-sm">
                    <caption className="sr-only">Öğretmen: modül başına aylık ve yıllık birim fiyatlar</caption>
                    <thead>
                      <tr className="border-b border-emerald-500/20 bg-emerald-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-emerald-950 dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-100">
                        <th scope="col" className="align-middle px-4 py-2.5" title="Modül adı">
                          Modül
                        </th>
                        <TariffAmountHeader periodShort="Ay" kind="jeton" />
                        <TariffAmountHeader periodShort="Ay" kind="ekders" />
                        <TariffAmountHeader periodShort="Yıl" kind="jeton" />
                        <TariffAmountHeader periodShort="Yıl" kind="ekders" paddedEnd />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-500/15 bg-background/80 dark:divide-emerald-900/40">
                      {SCHOOL_MODULE_KEYS.map((k) => {
                        const row = policy.module_prices[k];
                        const t = row?.teacher;
                        return (
                          <tr key={k} className="hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30">
                            <td className="px-4 py-2 font-medium">{SCHOOL_MODULE_LABELS[k]}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtNum(t?.monthly?.jeton ?? 0)}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtNum(t?.monthly?.ekders ?? 0)}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtNum(t?.yearly?.jeton ?? 0)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtNum(t?.yearly?.ekders ?? 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            ) : null}

          {showSchoolTariffs ? (
            <Card className="overflow-hidden border-2 border-blue-400/35 bg-blue-50/15 shadow-md ring-1 ring-blue-500/15 dark:border-blue-800/50 dark:bg-blue-950/20">
              <CardHeader className="border-b border-blue-500/25 bg-blue-100/40 pb-3 dark:border-blue-800/40 dark:bg-blue-950/40">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/20 text-blue-900 dark:bg-blue-500/20 dark:text-blue-100">
                    <Building2 className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 gap-y-1">
                      <CardTitle id="policy-tariff-school-heading" className="text-base text-blue-950 dark:text-blue-50">
                        Okul tarifeleri
                      </CardTitle>
                      <span className="inline-flex shrink-0 rounded-full border border-blue-600/30 bg-blue-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-900 dark:text-blue-100">
                        Tarife
                      </span>
                      <InfoHintDialog label="Okul tarifesi" title="Okul tarifeleri">
                        <p>Okul yöneticisi işlemlerinde okul bakiyesinden düşecek birim tutarlar (aylık / yıllık).</p>
                      </InfoHintDialog>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[360px] sm:min-w-[520px] text-sm">
                    <caption className="sr-only">Okul: modül başına aylık ve yıllık birim fiyatlar</caption>
                    <thead>
                      <tr className="border-b border-blue-500/25 bg-blue-100/60 text-left text-[11px] font-semibold uppercase tracking-wide text-blue-950 dark:border-blue-800/50 dark:bg-blue-950/50 dark:text-blue-50">
                        <th scope="col" className="align-middle px-4 py-2.5">
                          Modül
                        </th>
                        <TariffAmountHeader periodShort="Ay" kind="jeton" />
                        <TariffAmountHeader periodShort="Ay" kind="ekders" />
                        <TariffAmountHeader periodShort="Yıl" kind="jeton" />
                        <TariffAmountHeader periodShort="Yıl" kind="ekders" paddedEnd />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-500/10 bg-background/80 dark:divide-blue-900/40">
                      {SCHOOL_MODULE_KEYS.map((k) => {
                        const row = policy.module_prices[k];
                        const s = row?.school;
                        return (
                          <tr key={k} className="hover:bg-blue-50/50 dark:hover:bg-blue-950/30">
                            <td className="px-4 py-2 font-medium">{SCHOOL_MODULE_LABELS[k]}</td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtNum(s?.monthly?.jeton ?? 0)}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtNum(s?.monthly?.ekders ?? 0)}
                            </td>
                            <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtNum(s?.yearly?.jeton ?? 0)}
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                              {fmtNum(s?.yearly?.ekders ?? 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
          </div>
        </section>
      )}

      {!usageLoading && breakdown ? (
        <div id="market-gerceklesen-kullanim" className="scroll-mt-4 space-y-6 sm:space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-1 px-0.5">
              <span className="text-xs font-medium text-muted-foreground">Gerçekleşen kullanım</span>
              <InfoHintDialog label="Gerçekleşen kullanım" title="Gerçekleşen kullanım">
                <p>Tarife tablosundan ayrıdır; bu ay ve bu yıl için toplanan gerçek düşümler.</p>
              </InfoHintDialog>
            </div>
            <div
              className={cn(
                'grid gap-6',
                !isSchoolAdmin && breakdown.school ? 'lg:grid-cols-2' : '',
              )}
            >
            {!isSchoolAdmin ? (
            <Card className="overflow-hidden border-2 border-violet-500/45 shadow-lg ring-2 ring-violet-500/25 dark:border-violet-700/55 dark:bg-card dark:ring-violet-500/20">
              <CardHeader className="border-b border-violet-500/20 bg-linear-to-r from-violet-500/12 to-transparent pb-4 dark:from-violet-950/40">
                <div className="flex flex-wrap items-center gap-2 gap-y-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <UserRound className="size-5 text-violet-600 dark:text-violet-400" />
                    Modül harcamaları (bireysel)
                  </CardTitle>
                  <span className="inline-flex items-center rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-900 dark:text-violet-200">
                    Özet
                  </span>
                  <InfoHintDialog label="Modül harcamaları" title="Modül harcamaları (bireysel)">
                    <p>Bu ay ve bu yıl içinde bireysel cüzdanınızdan modüllere göre düşen jeton / ek ders.</p>
                    <p>
                      Aylık sütunlar bu ayın dönemine (kalan: {formatRemainingTr(breakdown.periods.month.ends_at, nowTick)}
                      ), yıllık sütunlar bu yılın dönemine (kalan:{' '}
                      {formatRemainingTr(breakdown.periods.year.ends_at, nowTick)}) aittir — evrensel takvime göre.
                    </p>
                  </InfoHintDialog>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[300px] sm:min-w-[420px] text-sm">
                    <caption className="sr-only">Bireysel: bu ay ve bu yıl modül harcama toplamları</caption>
                    <thead>
                      <tr className="border-b border-violet-500/20 bg-violet-100/50 text-left text-[11px] font-semibold uppercase tracking-wide text-violet-950 dark:border-violet-800/50 dark:bg-violet-950/40 dark:text-violet-100">
                        <th scope="col" className="align-middle px-4 py-3">
                          Modül
                        </th>
                        <TariffAmountHeader periodShort="Ay" kind="jeton" className="py-3" />
                        <TariffAmountHeader periodShort="Ay" kind="ekders" className="py-3" />
                        <TariffAmountHeader periodShort="Yıl" kind="jeton" className="py-3" />
                        <TariffAmountHeader periodShort="Yıl" kind="ekders" paddedEnd className="py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {SCHOOL_MODULE_KEYS.map((k) => {
                        const am = breakdown.user.month.by_module[k];
                        const ay = breakdown.user.year.by_module[k];
                        const z = (x: { jeton: number; ekders: number } | undefined) => x ?? { jeton: 0, ekders: 0 };
                        const m = z(am);
                        const y = z(ay);
                        const empty = m.jeton + m.ekders + y.jeton + y.ekders === 0;
                        return (
                          <tr
                            key={k}
                            className={cn(
                              'transition-colors hover:bg-violet-50/40 dark:hover:bg-violet-950/25',
                              empty && 'text-muted-foreground/70',
                            )}
                          >
                            <td className="px-4 py-2.5 font-medium">{SCHOOL_MODULE_LABELS[k]}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{fmtNum(m.jeton)}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{fmtNum(m.ekders)}</td>
                            <td className="px-2 py-2.5 text-right tabular-nums">{fmtNum(y.jeton)}</td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(y.ekders)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            ) : null}

            {breakdown.school && (
              <Card className="overflow-hidden border-2 border-blue-500/45 shadow-lg ring-2 ring-blue-500/25 dark:border-blue-700/55 dark:bg-card dark:ring-blue-500/20">
                <CardHeader className="border-b border-border/60 bg-linear-to-r from-blue-500/15 to-transparent pb-4 dark:from-blue-950/40">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="flex items-center gap-2 text-lg text-blue-950 dark:text-blue-50">
                      <Building2 className="size-5 text-blue-600 dark:text-blue-400" />
                      Modül harcamaları (okul)
                    </CardTitle>
                    <InfoHintDialog label="Okul modül harcamaları" title="Okul modül harcamaları">
                      <p>Okul bakiyesinden düşen kullanım; ay ve yıl toplamları tabloda modül bazlıdır.</p>
                      <p>
                        Aylık: bu ay (kalan {formatRemainingTr(breakdown.periods.month.ends_at, nowTick)}). Yıllık: bu yıl
                        (kalan {formatRemainingTr(breakdown.periods.year.ends_at, nowTick)}) — evrensel takvime göre.
                      </p>
                    </InfoHintDialog>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="table-x-scroll">
                    <table className="w-full min-w-[300px] sm:min-w-[420px] text-sm">
                      <thead>
                        <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                          <th className="align-middle px-4 py-3">Modül</th>
                          <TariffAmountHeader periodShort="Ay" kind="jeton" className="py-3" />
                          <TariffAmountHeader periodShort="Ay" kind="ekders" className="py-3" />
                          <TariffAmountHeader periodShort="Yıl" kind="jeton" className="py-3" />
                          <TariffAmountHeader periodShort="Yıl" kind="ekders" paddedEnd className="py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {SCHOOL_MODULE_KEYS.map((k) => {
                          const am = breakdown.school!.month.by_module[k];
                          const ay = breakdown.school!.year.by_module[k];
                          const z = (x: { jeton: number; ekders: number } | undefined) => x ?? { jeton: 0, ekders: 0 };
                          const m = z(am);
                          const y = z(ay);
                          const empty = m.jeton + m.ekders + y.jeton + y.ekders === 0;
                          return (
                            <tr
                              key={k}
                              className={cn(
                                'transition-colors hover:bg-muted/40',
                                empty && 'text-muted-foreground/70',
                              )}
                            >
                              <td className="px-4 py-2.5 font-medium">{SCHOOL_MODULE_LABELS[k]}</td>
                              <td className="px-2 py-2.5 text-right tabular-nums">{fmtNum(m.jeton)}</td>
                              <td className="px-2 py-2.5 text-right tabular-nums">{fmtNum(m.ekders)}</td>
                              <td className="px-2 py-2.5 text-right tabular-nums">{fmtNum(y.jeton)}</td>
                              <td className="px-4 py-2.5 text-right tabular-nums">{fmtNum(y.ekders)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
            </div>
          </div>
        </div>
      ) : null}

      {!usageLoading &&
        ((!isSchoolAdmin && ledgerUser.length > 0) || ledgerSchool.length > 0) && (
        <div
          id="market-son-dusumler"
          className={cn(
            'scroll-mt-4 grid gap-6',
            ledgerSchool.length > 0 && ledgerUser.length > 0 && !isSchoolAdmin ? 'lg:grid-cols-2' : '',
          )}
        >
          {!isSchoolAdmin && ledgerUser.length > 0 ? (
            <Card className="overflow-hidden border-2 border-amber-500/35 shadow-md ring-2 ring-amber-500/15 dark:border-amber-800/50">
              <CardHeader className="border-b border-border/60 bg-amber-50/30 pb-3 dark:bg-amber-950/15">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-900 dark:text-amber-200">
                    <ListTree className="size-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1">
                      <CardTitle className="text-base">Son düşümler (hareket)</CardTitle>
                      <InfoHintDialog label="Hareket açıklaması" title="Son düşümler">
                        <p>Bireysel cüzdan — tarih sıralı jeton / ek ders kesintileri (tarife tablosu değil).</p>
                      </InfoHintDialog>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[300px] sm:min-w-[420px] text-sm">
                    <caption className="sr-only">Bireysel: son düşümler</caption>
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                        <th className="align-middle px-4 py-2">Tarih</th>
                        <th className="align-middle px-4 py-2">Modül</th>
                        <th className="align-middle px-4 py-2 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5 leading-none">
                            <Coins className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                            <span>Jeton</span>
                          </span>
                        </th>
                        <th className="align-middle px-4 py-2 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5 leading-none">
                            <BookOpen className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                            <span>Ek ders</span>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {ledgerUser.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                            {row.created_at ? fmtDate(row.created_at) : '—'}
                          </td>
                          <td className="px-4 py-2 font-medium">{moduleLabel(row.module_key)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{fmtNum(parseDebit(row.jeton_debit))}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{fmtNum(parseDebit(row.ekders_debit))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : null}
          {isSchoolAdmin && ledgerSchool.length > 0 && (
            <Card className="overflow-hidden border-2 border-blue-400/45 shadow-md ring-2 ring-blue-500/15 dark:border-blue-700/55 dark:ring-blue-500/20">
              <CardHeader className="border-b border-border/60 bg-blue-50/40 pb-3 dark:bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white dark:bg-blue-500">
                    <ListTree className="size-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1">
                      <CardTitle className="text-base text-blue-950 dark:text-blue-50">Modül tüketimi (okul cüzdanı)</CardTitle>
                      <InfoHintDialog label="Okul hareketleri" title="Modül tüketimi">
                        <p>Okul bakiyesinden düşen son işlemler.</p>
                      </InfoHintDialog>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[300px] sm:min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                        <th className="align-middle px-4 py-2">Tarih</th>
                        <th className="align-middle px-4 py-2">Modül</th>
                        <th className="align-middle px-4 py-2 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5 leading-none">
                            <Coins className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                            <span>Jeton</span>
                          </span>
                        </th>
                        <th className="align-middle px-4 py-2 text-right">
                          <span className="inline-flex items-center justify-end gap-1.5 leading-none">
                            <BookOpen className="size-3.5 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
                            <span>Ek ders</span>
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {ledgerSchool.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                            {row.created_at ? fmtDate(row.created_at) : '—'}
                          </td>
                          <td className="px-4 py-2 font-medium">{moduleLabel(row.module_key)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{fmtNum(parseDebit(row.jeton_debit))}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{fmtNum(parseDebit(row.ekders_debit))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isSuperadmin && (
        <Card className="overflow-hidden border-2 border-amber-200/60 shadow-md dark:border-amber-900/40">
          <CardHeader className="border-b border-border/60 bg-amber-50/50 pb-4 dark:bg-amber-950/25">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-800 dark:text-amber-200">
                  <Wallet className="size-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1">
                    <CardTitle className="text-lg">Okul market — manuel yükleme</CardTitle>
                    <InfoHintDialog label="Okul manuel yükleme" title="Okul manuel yükleme kayıtları">
                      <p>
                        Okullar sayfasından eklenen <strong>jeton</strong> ve <strong>ek ders</strong> tutarları. Mağaza
                        (IAP) değil; superadmin kurumsal yükleme hareketleri.
                      </p>
                    </InfoHintDialog>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void fetchSchoolCreditAdmin()}
                disabled={schoolCreditAdminLoading}
              >
                <RefreshCw className={cn('mr-2 size-4', schoolCreditAdminLoading && 'animate-spin')} />
                Yenile
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-muted-foreground">Okul ID</label>
                <input
                  type="text"
                  value={scSchoolId}
                  onChange={(e) => {
                    setScSchoolId(e.target.value);
                    setSchoolCreditAdminPage(1);
                  }}
                  placeholder="UUID ile filtrele"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Başlangıç</label>
                <input
                  type="date"
                  value={scFrom}
                  onChange={(e) => {
                    setScFrom(e.target.value);
                    setSchoolCreditAdminPage(1);
                  }}
                  className="mt-1 rounded-lg border border-input bg-background px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Bitiş</label>
                <input
                  type="date"
                  value={scTo}
                  onChange={(e) => {
                    setScTo(e.target.value);
                    setSchoolCreditAdminPage(1);
                  }}
                  className="mt-1 rounded-lg border border-input bg-background px-2 py-2 text-sm"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="mb-0.5"
                onClick={() => void fetchSchoolCreditAdmin()}
                disabled={schoolCreditAdminLoading}
              >
                Listeyi güncelle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {schoolCreditAdminLoading && !schoolCreditAdmin ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner label="Kayıtlar yükleniyor…" />
              </div>
            ) : !schoolCreditAdmin?.items.length ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                Kayıt yok veya filtreye uygun sonuç bulunamadı.
              </div>
            ) : (
              <>
                <div className="table-x-scroll">
                  <table className="w-full min-w-[720px] sm:min-w-[880px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
                        <th className="px-4 py-3">Tarih / saat</th>
                        <th className="px-4 py-3">Okul</th>
                        <th className="px-4 py-3">Konum</th>
                        <th className="px-4 py-3 text-right">Eklenen jeton</th>
                        <th className="px-4 py-3 text-right">Eklenen ek ders</th>
                        <th className="px-4 py-3">İşlemi yapan</th>
                        <th className="px-4 py-3">Not</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/80">
                      {schoolCreditAdmin.items.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {row.created_at ? fmtDate(row.created_at) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/schools/${row.school_id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {row.school_name ?? 'Okul'}
                            </Link>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.school_id}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {[row.school_city, row.school_district].filter(Boolean).join(' / ') || '—'}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-amber-900 dark:text-amber-100">
                            +{fmtNum(row.jeton_credit)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-sky-900 dark:text-sky-100">
                            +{fmtNum(row.ekders_credit)}
                          </td>
                          <td className="max-w-[180px] px-4 py-3 text-foreground">
                            <span className="line-clamp-2">
                              {row.creator_display_name || row.creator_email || '—'}
                            </span>
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-muted-foreground">
                            <span className="line-clamp-2" title={row.note ?? ''}>
                              {row.note || '—'}
                            </span>
                          </td>
                      </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {schoolCreditAdmin.total > SCHOOL_CREDIT_ADMIN_PAGE && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Toplam {schoolCreditAdmin.total} kayıt · Sayfa {schoolCreditAdminPage} /{' '}
                      {Math.max(1, Math.ceil(schoolCreditAdmin.total / SCHOOL_CREDIT_ADMIN_PAGE))}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={schoolCreditAdminPage <= 1 || schoolCreditAdminLoading}
                        onClick={() => setSchoolCreditAdminPage((p) => p - 1)}
                      >
                        <ChevronLeft className="mr-1 size-4" />
                        Önceki
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          schoolCreditAdminPage * SCHOOL_CREDIT_ADMIN_PAGE >= schoolCreditAdmin.total ||
                          schoolCreditAdminLoading
                        }
                        onClick={() => setSchoolCreditAdminPage((p) => p + 1)}
                      >
                        Sonraki
                        <ChevronRight className="ml-1 size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {isSuperadmin && (
        <Card className="overflow-hidden border-2 border-violet-200/60 shadow-md dark:border-violet-900/40">
          <CardHeader className="border-b border-border/60 bg-violet-50/50 pb-4 dark:bg-violet-950/25">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-800 dark:text-violet-200">
                  <UserRound className="size-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1">
                    <CardTitle className="text-lg">Öğretmen market — manuel yükleme</CardTitle>
                    <InfoHintDialog label="Öğretmen manuel yükleme" title="Öğretmen manuel yükleme">
                      <p>
                        Kullanıcı detayından eklenen <strong>bireysel</strong> jeton ve ek ders yüklemeleri (IAP değil).
                      </p>
                    </InfoHintDialog>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => void fetchTeacherCreditAdmin()}
                disabled={teacherCreditAdminLoading}
              >
                <RefreshCw className={cn('mr-2 size-4', teacherCreditAdminLoading && 'animate-spin')} />
                Yenile
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[140px]">
                <label className="block text-xs font-medium text-muted-foreground">Öğretmen kullanıcı ID</label>
                <input
                  type="text"
                  value={tcUserId}
                  onChange={(e) => {
                    setTcUserId(e.target.value);
                    setTeacherCreditAdminPage(1);
                  }}
                  placeholder="UUID ile filtrele"
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Başlangıç</label>
                <input
                  type="date"
                  value={tcFrom}
                  onChange={(e) => {
                    setTcFrom(e.target.value);
                    setTeacherCreditAdminPage(1);
                  }}
                  className="mt-1 rounded-lg border border-input bg-background px-2 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Bitiş</label>
                <input
                  type="date"
                  value={tcTo}
                  onChange={(e) => {
                    setTcTo(e.target.value);
                    setTeacherCreditAdminPage(1);
                  }}
                  className="mt-1 rounded-lg border border-input bg-background px-2 py-2 text-sm"
                />
              </div>
              <Button
                type="button"
                size="sm"
                className="mb-0.5"
                onClick={() => void fetchTeacherCreditAdmin()}
                disabled={teacherCreditAdminLoading}
              >
                Listeyi güncelle
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {teacherCreditAdminLoading && !teacherCreditAdmin ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner label="Kayıtlar yükleniyor…" />
              </div>
            ) : !teacherCreditAdmin?.items.length ? (
              <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                Kayıt yok veya filtreye uygun sonuç bulunamadı.
              </div>
            ) : (
              <>
                <div className="table-x-scroll">
                  <table className="w-full min-w-[720px] text-sm sm:min-w-[920px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold text-muted-foreground">
                        <th className="px-4 py-3">Tarih / saat</th>
                        <th className="px-4 py-3">Öğretmen</th>
                        <th className="px-4 py-3 text-right">Eklenen jeton</th>
                        <th className="px-4 py-3 text-right">Eklenen ek ders</th>
                        <th className="px-4 py-3">İşlemi yapan</th>
                        <th className="px-4 py-3">Not</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/80">
                      {teacherCreditAdmin.items.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30">
                          <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                            {row.created_at ? fmtDate(row.created_at) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/users/${row.target_user_id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {row.target_display_name || row.target_email || 'Öğretmen'}
                            </Link>
                            <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{row.target_user_id}</div>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-amber-900 dark:text-amber-100">
                            +{fmtNum(row.jeton_credit)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium text-sky-900 dark:text-sky-100">
                            +{fmtNum(row.ekders_credit)}
                          </td>
                          <td className="max-w-[180px] px-4 py-3 text-foreground">
                            <span className="line-clamp-2">
                              {row.creator_display_name || row.creator_email || '—'}
                            </span>
                          </td>
                          <td className="max-w-[220px] px-4 py-3 text-muted-foreground">
                            <span className="line-clamp-2" title={row.note ?? ''}>
                              {row.note || '—'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {teacherCreditAdmin.total > TEACHER_CREDIT_ADMIN_PAGE && (
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                    <p className="text-sm text-muted-foreground">
                      Toplam {teacherCreditAdmin.total} kayıt · Sayfa {teacherCreditAdminPage} /{' '}
                      {Math.max(1, Math.ceil(teacherCreditAdmin.total / TEACHER_CREDIT_ADMIN_PAGE))}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={teacherCreditAdminPage <= 1 || teacherCreditAdminLoading}
                        onClick={() => setTeacherCreditAdminPage((p) => p - 1)}
                      >
                        <ChevronLeft className="mr-1 size-4" />
                        Önceki
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          teacherCreditAdminPage * TEACHER_CREDIT_ADMIN_PAGE >= teacherCreditAdmin.total ||
                          teacherCreditAdminLoading
                        }
                        onClick={() => setTeacherCreditAdminPage((p) => p + 1)}
                      >
                        Sonraki
                        <ChevronRight className="ml-1 size-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {error && <Alert message={error} />}

      {loading && !wallet ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 sm:min-h-[220px] sm:rounded-2xl">
          <LoadingSpinner label="Hesap bilgileri yükleniyor…" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            {!(breakdown && wallet) && !isSchoolAdmin && (
              <>
                <div className="flex items-center gap-2 px-1">
                  <UserRound className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bireysel hesap</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                  <BalanceCard
                    label="Jeton bakiyesi"
                    value={fmtNum(wallet?.user.jeton ?? 0)}
                    icon={<Coins className="size-20" />}
                    accent="emerald"
                    sub="Öğretmen hesabınıza tanımlı"
                  />
                  <BalanceCard
                    label="Ek ders bakiyesi"
                    value={fmtNum(wallet?.user.ekders ?? 0)}
                    icon={<Coins className="size-20" />}
                    accent="amber"
                    sub="Öğretmen hesabınıza tanımlı"
                  />
                </div>
              </>
            )}
            {isTeacher && (
              <Card className="overflow-hidden border-emerald-200/60 shadow-sm dark:border-emerald-900/50">
                <CardHeader className="border-b border-border/60 bg-emerald-50/40 pb-3 dark:bg-emerald-950/25">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-1">
                        <CardTitle className="text-base">Bireysel manuel yüklemler</CardTitle>
                        <InfoHintDialog label="Manuel yükleme" title="Bireysel manuel yüklemler">
                          <p>
                            Yöneticinin <strong>bireysel</strong> cüzdanınıza eklediği jeton ve ek ders (mağaza satın alması
                            değil).
                          </p>
                        </InfoHintDialog>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void fetchTeacherManualCredits()}
                      disabled={tManualLoading}
                    >
                      <RefreshCw className={cn('mr-2 size-4', tManualLoading && 'animate-spin')} />
                      Yenile
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground">Başlangıç</label>
                      <input
                        type="date"
                        value={tManualFrom}
                        onChange={(e) => {
                          setTManualFrom(e.target.value);
                          setTManualPage(1);
                        }}
                        className="mt-1 rounded-lg border border-input bg-background px-2 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground">Bitiş</label>
                      <input
                        type="date"
                        value={tManualTo}
                        onChange={(e) => {
                          setTManualTo(e.target.value);
                          setTManualPage(1);
                        }}
                        className="mt-1 rounded-lg border border-input bg-background px-2 py-2 text-sm"
                      />
                    </div>
                    <Button type="button" size="sm" className="mb-0.5" onClick={() => void fetchTeacherManualCredits()} disabled={tManualLoading}>
                      Filtrele
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {tManualLoading && !tManual ? (
                    <div className="flex justify-center py-10">
                      <LoadingSpinner label="Yüklemeler yükleniyor…" />
                    </div>
                  ) : !tManual?.items.length ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Henüz kayıt yok veya seçilen tarihlerde manuel yükleme bulunmuyor.
                    </p>
                  ) : (
                    <>
                      <div className="table-x-scroll">
                        <table className="w-full min-w-[320px] sm:min-w-[640px] text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/35 text-left text-xs font-semibold text-muted-foreground">
                              <th className="px-4 py-2.5">Tarih / saat</th>
                              <th className="px-4 py-2.5 text-right">Eklenen jeton</th>
                              <th className="px-4 py-2.5 text-right">Eklenen ek ders</th>
                              <th className="px-4 py-2.5">Ekleyen</th>
                              <th className="px-4 py-2.5">Not</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/80">
                            {tManual.items.map((row) => (
                              <tr key={row.id} className="hover:bg-muted/25">
                                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                                  {row.created_at ? fmtDate(row.created_at) : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-amber-900 dark:text-amber-100">
                                  +{fmtNum(row.jeton_credit)}
                                </td>
                                <td className="px-4 py-2.5 text-right tabular-nums font-medium text-sky-900 dark:text-sky-100">
                                  +{fmtNum(row.ekders_credit)}
                                </td>
                                <td className="max-w-[200px] px-4 py-2.5 text-foreground">
                                  <span className="line-clamp-2">
                                    {row.creator_display_name || row.creator_email || '—'}
                                  </span>
                                </td>
                                <td className="max-w-[220px] px-4 py-2.5 text-muted-foreground">
                                  <span className="line-clamp-2" title={row.note ?? ''}>
                                    {row.note || '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {tManual.total > TEACHER_MANUAL_PAGE && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            Toplam {tManual.total} kayıt · Sayfa {tManualPage} /{' '}
                            {Math.max(1, Math.ceil(tManual.total / TEACHER_MANUAL_PAGE))}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={tManualPage <= 1 || tManualLoading}
                              onClick={() => setTManualPage((p) => p - 1)}
                            >
                              <ChevronLeft className="mr-1 size-4" />
                              Önceki
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={tManualPage * TEACHER_MANUAL_PAGE >= tManual.total || tManualLoading}
                              onClick={() => setTManualPage((p) => p + 1)}
                            >
                              Sonraki
                              <ChevronRight className="ml-1 size-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </section>

          {isSchoolAdmin && wallet?.school && (
            <section className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <Building2 className="size-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-blue-900/80 dark:text-blue-200">
                  Okul cüzdanı
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
                <BalanceCard
                  label="Okul jeton"
                  value={fmtNum(wallet.school.jeton)}
                  icon={<Building2 className="size-20" />}
                  accent="blue"
                  sub="Kurumsal özellikler için"
                />
                <BalanceCard
                  label="Okul ek ders"
                  value={fmtNum(wallet.school.ekders)}
                  icon={<Building2 className="size-20" />}
                  accent="blue"
                  sub="Kurumsal özellikler için"
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch lg:gap-4">
              <Card className="flex min-h-0 flex-col overflow-hidden border-blue-200/60 shadow-sm dark:border-blue-900/50">
                <CardHeader className="border-b border-border/60 bg-blue-50/40 px-3 pb-2 pt-3 sm:px-6 sm:pb-3 dark:bg-blue-950/25">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-1">
                        <CardTitle className="text-sm sm:text-base">Kurumsal manuel yüklemler</CardTitle>
                        <InfoHintDialog label="Kurumsal manuel" title="Kurumsal manuel yüklemler">
                          <p>
                            Yöneticinin okul cüzdanınıza eklediği <strong>jeton</strong> ve <strong>ek ders</strong>. Ekleyen ve
                            not burada; mağaza satın alması değil.
                          </p>
                        </InfoHintDialog>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 px-2 text-xs sm:h-9 sm:px-3"
                      onClick={() => void fetchSchoolAdminManualCredits()}
                      disabled={saManualLoading}
                    >
                      <RefreshCw className={cn('mr-1 size-3.5 sm:mr-2 sm:size-4', saManualLoading && 'animate-spin')} />
                      Yenile
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-end gap-2 sm:mt-3 sm:gap-3">
                    <div className="min-w-0 flex-1 sm:min-w-[140px] sm:flex-none">
                      <label className="block text-[10px] font-medium text-muted-foreground sm:text-xs">Başlangıç</label>
                      <input
                        type="date"
                        value={saManualFrom}
                        onChange={(e) => {
                          setSaManualFrom(e.target.value);
                          setSaManualPage(1);
                        }}
                        className="mt-0.5 w-full max-w-44 rounded-md border border-input bg-background px-1.5 py-1 text-xs sm:mt-1 sm:rounded-lg sm:px-2 sm:py-2 sm:text-sm"
                      />
                    </div>
                    <div className="min-w-0 flex-1 sm:min-w-[140px] sm:flex-none">
                      <label className="block text-[10px] font-medium text-muted-foreground sm:text-xs">Bitiş</label>
                      <input
                        type="date"
                        value={saManualTo}
                        onChange={(e) => {
                          setSaManualTo(e.target.value);
                          setSaManualPage(1);
                        }}
                        className="mt-0.5 w-full max-w-44 rounded-md border border-input bg-background px-1.5 py-1 text-xs sm:mt-1 sm:rounded-lg sm:px-2 sm:py-2 sm:text-sm"
                      />
                    </div>
                    <Button type="button" size="sm" className="mb-0.5 h-8 px-2 text-xs sm:h-9 sm:px-3" onClick={() => void fetchSchoolAdminManualCredits()} disabled={saManualLoading}>
                      Filtrele
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 p-0">
                  {saManualLoading && !saManual ? (
                    <div className="flex justify-center py-8 sm:py-10">
                      <LoadingSpinner label="Yüklemeler yükleniyor…" />
                    </div>
                  ) : !saManual?.items.length ? (
                    <p className="px-3 py-8 text-center text-xs text-muted-foreground sm:px-4 sm:py-10 sm:text-sm">
                      Henüz kayıt yok veya seçilen tarihlerde manuel yükleme bulunmuyor.
                    </p>
                  ) : (
                    <>
                      <div className="table-x-scroll">
                        <table className="w-full min-w-[260px] text-[11px] sm:min-w-[520px] sm:text-sm">
                          <thead>
                            <tr className="border-b border-border bg-muted/35 text-left text-[10px] font-semibold text-muted-foreground sm:text-xs">
                              <th className="px-2 py-1.5 sm:px-3 sm:py-2">Tarih</th>
                              <th className="px-1.5 py-1.5 text-right sm:px-2 sm:py-2">Jeton</th>
                              <th className="px-1.5 py-1.5 text-right sm:px-2 sm:py-2">Ek ders</th>
                              <th className="hidden px-2 py-1.5 sm:table-cell sm:px-3 sm:py-2">Ekleyen</th>
                              <th className="px-2 py-1.5 sm:px-3 sm:py-2">Not</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/80">
                            {saManual.items.map((row) => (
                              <tr key={row.id} className="hover:bg-muted/25">
                                <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground sm:px-3 sm:py-2">
                                  {row.created_at ? fmtDate(row.created_at) : '—'}
                                </td>
                                <td className="px-1.5 py-1.5 text-right tabular-nums font-medium text-amber-900 sm:px-2 sm:py-2 dark:text-amber-100">
                                  +{fmtNum(row.jeton_credit)}
                                </td>
                                <td className="px-1.5 py-1.5 text-right tabular-nums font-medium text-sky-900 sm:px-2 sm:py-2 dark:text-sky-100">
                                  +{fmtNum(row.ekders_credit)}
                                </td>
                                <td className="hidden max-w-[140px] px-2 py-1.5 text-foreground sm:table-cell sm:max-w-[200px] sm:px-3 sm:py-2">
                                  <span className="line-clamp-2 text-[10px] sm:text-xs">
                                    {row.creator_display_name || row.creator_email || '—'}
                                  </span>
                                </td>
                                <td className="max-w-[min(40vw,8rem)] px-2 py-1.5 text-muted-foreground sm:max-w-[220px] sm:px-3 sm:py-2">
                                  <span className="line-clamp-2 text-[10px] sm:text-sm" title={row.note ?? ''}>
                                    {row.note || '—'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {saManual.total > SCHOOL_ADMIN_MANUAL_PAGE && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-2 py-2 sm:px-4 sm:py-3">
                          <p className="text-[10px] text-muted-foreground sm:text-xs">
                            Toplam {saManual.total} kayıt · Sayfa {saManualPage} /{' '}
                            {Math.max(1, Math.ceil(saManual.total / SCHOOL_ADMIN_MANUAL_PAGE))}
                          </p>
                          <div className="flex gap-1.5 sm:gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs sm:h-9"
                              disabled={saManualPage <= 1 || saManualLoading}
                              onClick={() => setSaManualPage((p) => p - 1)}
                            >
                              <ChevronLeft className="mr-0.5 size-4 sm:mr-1" />
                              Önceki
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs sm:h-9"
                              disabled={
                                saManualPage * SCHOOL_ADMIN_MANUAL_PAGE >= saManual.total || saManualLoading
                              }
                              onClick={() => setSaManualPage((p) => p + 1)}
                            >
                              Sonraki
                              <ChevronRight className="ml-0.5 size-4 sm:ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card
                id="market-satin-alma-gecmisi"
                className="flex min-h-0 flex-col overflow-hidden border-2 border-blue-400/45 shadow-md ring-2 ring-blue-500/15 dark:border-blue-700/55 dark:ring-blue-500/20"
              >
                <CardHeader className="border-b border-border/60 bg-blue-50/50 px-3 pb-3 pt-3 dark:bg-blue-950/20 sm:px-6 sm:pb-4">
                  <div className="flex items-start gap-2 sm:gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white sm:size-10 dark:bg-blue-500">
                      <Wallet className="size-4 sm:size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1">
                        <CardTitle className="text-sm text-blue-950 sm:text-lg dark:text-blue-50">Okul cüzdanı işlemleri</CardTitle>
                        <InfoHintDialog label="Okul satın alma" title="Okul cüzdanı işlemleri">
                          <p>Okul adına yüklenen jeton / ek ders (satın almada okul cüzdanı seçildiğinde).</p>
                        </InfoHintDialog>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="min-h-0 flex-1 space-y-2 px-3 pt-3 sm:space-y-3 sm:px-6 sm:pt-6">
                  {!school?.items.length ? (
                    <EmptyLedger
                      title="Henüz okul işlemi yok"
                      hint="Okul cüzdanına yapılan ilk satın alma doğrulaması burada görünür."
                    />
                  ) : (
                    <>
                      <LedgerTable rows={school.items} showTarget={false} compact />
                      {school.total > PAGE_SIZE && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3 sm:gap-3 sm:pt-4">
                          <p className="text-[10px] text-muted-foreground sm:text-xs">
                            Sayfa {pageSchool} / {totalPagesSchool} · Toplam {school.total} kayıt
                          </p>
                          <div className="flex gap-1.5 sm:gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs sm:h-9"
                              disabled={pageSchool <= 1}
                              onClick={() => setPageSchool((p) => Math.max(1, p - 1))}
                            >
                              <ChevronLeft className="mr-0.5 size-4 sm:mr-1" />
                              Önceki
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs sm:h-9"
                              disabled={pageSchool >= totalPagesSchool}
                              onClick={() => setPageSchool((p) => p + 1)}
                            >
                              Sonraki
                              <ChevronRight className="ml-0.5 size-4 sm:ml-1" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
              </div>
            </section>
          )}

          {!isSchoolAdmin ? (
          <div className="grid max-w-4xl gap-5 sm:gap-8">
            <Card
              id="market-satin-alma-gecmisi"
              className="scroll-mt-4 overflow-hidden border-2 border-violet-400/35 shadow-md ring-2 ring-violet-500/10 dark:border-violet-700/40"
            >
              <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <History className="size-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1">
                      <CardTitle className="text-lg">Satın alma geçmişim</CardTitle>
                      <InfoHintDialog label="Satın alma geçmişi" title="Satın alma geçmişim">
                        <p>Bu hesapla doğrulanan mağaza işlemleri. Okul adına yüklemeler «Okul» hedefiyle işaretlenir.</p>
                      </InfoHintDialog>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-4 sm:space-y-4 sm:pt-6">
                {!mine?.items.length ? (
                  <EmptyLedger
                    title="Henüz satın alma kaydı yok"
                    hint="Mobil uygulamadan paket satın aldığınızda işlemler burada listelenir."
                  />
                ) : (
                  <>
                    <LedgerTable rows={mine.items} showTarget />
                    {mine.total > PAGE_SIZE && (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                        <p className="text-xs text-muted-foreground">
                          Sayfa {pageMine} / {totalPagesMine} · Toplam {mine.total} kayıt
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pageMine <= 1}
                            onClick={() => setPageMine((p) => Math.max(1, p - 1))}
                          >
                            <ChevronLeft className="mr-1 size-4" />
                            Önceki
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={pageMine >= totalPagesMine}
                            onClick={() => setPageMine((p) => p + 1)}
                          >
                            Sonraki
                            <ChevronRight className="ml-1 size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
          ) : null}

          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/15">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  <FileText className="size-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-1">
                    <CardTitle className="text-lg">Kullanım hakları</CardTitle>
                    <InfoHintDialog label="Kullanım hakları" title="Kullanım hakları">
                      <p>
                        Evrak vb. kullanımlardan düşen haklar. Ücretli modüllerde jeton/ek ders düşümü üstteki özet ve
                        tüketim tablolarında izlenir.
                      </p>
                    </InfoHintDialog>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 sm:pt-6">
              {entitlements.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                  <p className="text-sm text-muted-foreground">Henüz kayıtlı hak yok.</p>
                  <InfoHintDialog label="Kullanım hakları hakkında" title="Kullanım hakları">
                    <p>Evrak ürettiğinizde varsayılan kotanız oluşturulur.</p>
                  </InfoHintDialog>
                </div>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {entitlements.map((e) => (
                    <li
                      key={e.entitlementType}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={cn(
                            'flex size-9 shrink-0 items-center justify-center rounded-lg',
                            e.entitlementType === 'evrak_uretim' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {e.entitlementType === 'evrak_uretim' ? (
                            <FileText className="size-4" />
                          ) : (
                            <Coins className="size-4" />
                          )}
                        </div>
                        <span className="truncate font-medium text-foreground">
                          {ENTITLEMENT_LABELS[e.entitlementType] ?? e.entitlementType}
                        </span>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 rounded-lg px-2.5 py-1 text-sm font-semibold tabular-nums',
                          e.quantity > 0
                            ? 'bg-primary/12 text-primary'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
                        )}
                      >
                        {e.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card
            id="market-mobil-magaza"
            className="scroll-mt-4 overflow-hidden border-2 border-dashed border-primary/25 bg-linear-to-br from-primary/5 via-card to-violet-500/5 shadow-sm"
          >
            <CardContent className="flex flex-col items-center px-4 py-8 text-center sm:px-6 sm:py-12">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/20">
                <ShoppingBag className="size-8" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Mobil satın alma</h3>
                  <InfoHintDialog label="Mobil mağaza" title="Mobil uygulamadan satın alma">
                    <p>
                      Jeton ve ek ders paketleri Google Play ve App Store üzerinden alınır; uygulama doğrulama gönderir.
                      Ürün kimlikleri ve fiyatlar Market Politikasından yönetilir.
                    </p>
                  </InfoHintDialog>
                </div>
              </div>
              {isTeacher && evrakQty <= 0 && (
                <Button asChild className="mt-6" size="lg">
                  <Link href="/evrak">Evrak modülüne git</Link>
                </Button>
              )}
              {isSuperOrMod && (
                <Button asChild variant="outline" className="mt-4 max-sm:max-w-full max-sm:truncate" size="sm">
                  <Link href="/market-policy">
                    <span className="sm:hidden">Market politikası</span>
                    <span className="hidden sm:inline">Market politikası ve platform özeti</span>
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
