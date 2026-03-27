'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Button } from '@/components/ui/button';
import { Toolbar, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { ToolbarIconHints } from '@/components/layout/toolbar-icon-hints';
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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SCHOOL_MODULE_KEYS, SCHOOL_MODULE_LABELS, type SchoolModuleKey } from '@/config/school-modules';

type CurrencyPair = { jeton: number; ekders: number };
type ModuleScopeUsage = { monthly: CurrencyPair; yearly: CurrencyPair };
type ModuleEntryNotice = { notice_tr: string | null; notice_en: string | null };
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
    month: { label: string; ends_at: string };
    year: { label: string; ends_at: string };
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

const ENTITLEMENT_LABELS: Record<string, string> = {
  evrak_uretim: 'Evrak üretim hakkı',
  optik_okuma: 'Optik okuma',
  tahta_kilit: 'Akıllı tahta',
};

function fmtNum(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(n);
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

function periodProgress(nowMs: number, endsAtIso: string, unit: 'month' | 'year'): number {
  const end = new Date(endsAtIso).getTime();
  const start = new Date(end);
  if (unit === 'month') start.setUTCMonth(start.getUTCMonth() - 1);
  else start.setUTCFullYear(start.getUTCFullYear() - 1);
  const w = end - start.getTime();
  if (w <= 0) return 0;
  return Math.min(100, Math.max(0, ((nowMs - start.getTime()) / w) * 100));
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

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-linear-to-br p-5 shadow-sm ring-1',
        ring,
        bg,
      )}
    >
      <div className="absolute -right-2 -top-2 opacity-[0.07]">{props.icon}</div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{props.label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{props.value}</p>
      {props.sub && <p className="mt-1 text-xs text-muted-foreground">{props.sub}</p>}
    </div>
  );
}

function LedgerTable({
  rows,
  showTarget,
}: {
  rows: LedgerRow[];
  showTarget?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/80 bg-muted/20">
      <div className="table-x-scroll">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-border/80 bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Tarih</th>
              <th className="px-4 py-3">Mağaza</th>
              <th className="px-4 py-3">Ürün</th>
              <th className="px-4 py-3">Durum</th>
              {showTarget && <th className="px-4 py-3">Hedef</th>}
              <th className="px-4 py-3 text-right">Yüklenen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card">
            {rows.map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-muted/40">
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                <td className="px-4 py-3">
                  <PlatformBadge platform={r.platform} />
                </td>
                <td className="max-w-[200px] px-4 py-3">
                  <span className="font-mono text-xs text-foreground" title={r.productId}>
                    {r.productId}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                {showTarget && (
                  <td className="px-4 py-3">
                    {r.creditTarget === 'school' ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-950/60 dark:text-blue-200">
                        <Building2 className="size-3" />
                        Okul
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                        <UserRound className="size-3" />
                        Bireysel
                      </span>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-right tabular-nums text-foreground">
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
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-muted/20 px-6 py-14 text-center">
      <div className="mb-3 rounded-full bg-muted p-4">
        <Receipt className="size-8 text-muted-foreground" />
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
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
  const [siteOrigin, setSiteOrigin] = useState('');
  useEffect(() => {
    setSiteOrigin(typeof window !== 'undefined' ? window.location.origin : '');
  }, []);

  const isTeacher = me?.role === 'teacher';
  const isSchoolAdmin = me?.role === 'school_admin';
  const isSuperadmin = me?.role === 'superadmin';
  const isSuperOrMod = me?.role === 'superadmin' || me?.role === 'moderator';
  const showSchoolTariffs = isSchoolAdmin || isSuperOrMod;

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
    try {
      const [ent, w, m, s, pol] = await Promise.all([
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
      ]);
      setEntitlements(Array.isArray(ent) ? ent : []);
      setWallet(w);
      setMine(m);
      setSchool(s);
      setPolicy(pol && pol.module_prices ? pol : null);
      if (isTeacher) {
        const rad = await apiFetch<{ total: number; items: RewardedAdCreditRow[] }>(
          '/market/wallet/rewarded-ad-credits?limit=30',
          { token },
        ).catch(() => null);
        setRewardedAdCredits(rad ? { total: rad.total, items: Array.isArray(rad.items) ? rad.items : [] } : null);
        setTeacherInviteLoading(true);
        try {
          const [inv, red] = await Promise.all([
            apiFetch<TeacherInviteSummary>('/teacher-invite/me', { token }).catch(() => null),
            apiFetch<{ total: number; items: TeacherInviteRedemptionRow[] }>(
              '/teacher-invite/redemptions?limit=25',
              { token },
            ).catch(() => null),
          ]);
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
      setRewardedAdCredits(null);
    } finally {
      setLoading(false);
    }
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
  }, [token, pageMine, pageSchool, isSchoolAdmin, isTeacher]);

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

  return (
    <div className="space-y-8 pb-10">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Market / Cüzdan</ToolbarPageTitle>
          <ToolbarIconHints
            items={[
              { label: 'Jeton ve ek ders', icon: Coins },
              { label: 'Mağaza', icon: ShoppingBag },
              { label: 'Haklar ve kullanım', icon: Receipt },
              { label: 'Hareket geçmişi', icon: History },
            ]}
            summary="Jeton ve ek ders bakiyelerinizi, mağaza satın almalarınızı ve kullanım haklarınızı tek ekranda takip edin."
          />
        </ToolbarHeading>
        <div className="flex flex-wrap gap-2">
          {isSuperOrMod && (
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/market-policy">Market politikası</Link>
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={cn('mr-2 size-4', loading && 'animate-spin')} />
            Yenile
          </Button>
        </div>
      </Toolbar>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-linear-to-br from-primary/5 via-card to-card p-5 shadow-sm md:col-span-2">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground">Özet</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Mobil uygulamadan yapılan satın almalar sunucu doğrulaması ve market politikasındaki ürün eşlemesiyle
                bakiyeye yansır. Modül kullanımında politika tarifesine göre (aylık veya yıllık) jeton/ek ders düşümü
                aşağıda özet ve günlükte izlenir.
              </p>
            </div>
          </div>
        </div>
      </div>

      {isTeacher && (
        <Card className="overflow-hidden border-teal-500/30 bg-linear-to-br from-teal-500/10 via-card to-card shadow-sm ring-1 ring-teal-500/10">
          <CardHeader className="border-b border-border/50 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-600/15 text-teal-800 dark:text-teal-200">
                  <UserPlus className="size-6" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base">Arkadaşını davet et</CardTitle>
                  <CardDescription className="text-xs">
                    Bu kartı Market sayfasının üstünde görürsünüz. Jeton ödülleri sunucudaki market politikasının{' '}
                    <span className="font-medium text-foreground">öğretmen davetiye</span> bölümüne göre hesaplanır.
                  </CardDescription>
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
          <CardContent className="space-y-4 pt-4 text-sm text-muted-foreground">
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
                <Alert variant="info" className="text-xs leading-relaxed [&_strong]:text-foreground">
                  <div>
                    <p className="font-medium text-foreground">Nasıl kullanılır?</p>
                    <ul className="mt-2 list-inside list-disc space-y-1.5 text-muted-foreground">
                      <li>«Kod oluştur / göster» ile kişisel davet kodunuzu alın (bir kez üretilir, değişmez).</li>
                      <li>
                        Aşağıdaki <strong>kayıt linkini</strong> kopyalayıp paylaşın veya yalnızca{' '}
                        <strong>kodu</strong> mesajla gönderin. Mobil uygulamada kayıt ekranına aynı kod yazılabilir.
                      </li>
                      <li>Yeni öğretmen kaydı tamamlanınca ödüller jeton cüzdanınıza işlenir; kullanımlar tabloda listelenir.</li>
                    </ul>
                  </div>
                </Alert>
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
        <Card className="overflow-hidden border-violet-500/30 bg-linear-to-br from-violet-500/12 via-card to-card shadow-sm ring-1 ring-violet-500/10">
          <CardHeader className="border-b border-border/50 pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-violet-600/15 text-violet-800 dark:text-violet-200">
                  <Smartphone className="size-6" />
                </div>
                <div>
                  <CardTitle className="text-base">Ödüllü reklamla jeton kazan</CardTitle>
                  <CardDescription className="text-xs">
                    Mobil uygulamada reklam izleyerek jeton kazanın. Bu web sayfasında reklam oynatılmaz; yönlendirme ve
                    kurallar için aşağıdaki sayfayı açın.
                  </CardDescription>
                </div>
              </div>
              <Button type="button" size="sm" variant="secondary" asChild>
                <Link href="/market/rewarded-ad">Ayrıntılar ve mağaza linkleri</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-sm text-muted-foreground">
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

      {policy && (
        <div className={cn('grid gap-6', showSchoolTariffs ? 'lg:grid-cols-2' : '')}>
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-emerald-50/30 pb-3 dark:bg-emerald-950/20">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-800 dark:text-emerald-300">
                  <UserRound className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Öğretmen (bireysel) — kullanım tarifeleri</CardTitle>
                  <CardDescription className="text-xs">
                    Her kullanımda düşecek jeton / ek ders (aylık ve yıllık ayrı). Varsayılan uygulama aylık tarifedir.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="table-x-scroll">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border/80 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-4 py-2">Modül</th>
                      <th className="px-2 py-2 text-right">Aylık J</th>
                      <th className="px-2 py-2 text-right">Aylık E</th>
                      <th className="px-2 py-2 text-right">Yıllık J</th>
                      <th className="px-4 py-2 text-right">Yıllık E</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {SCHOOL_MODULE_KEYS.map((k) => {
                      const row = policy.module_prices[k];
                      const t = row?.teacher;
                      return (
                        <tr key={k} className="hover:bg-muted/30">
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

          {showSchoolTariffs && (
            <Card className="overflow-hidden border-blue-200/50 shadow-sm dark:border-blue-900/40">
              <CardHeader className="border-b border-border/60 bg-blue-50/40 pb-3 dark:bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-800 dark:text-blue-300">
                    <Building2 className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-blue-950 dark:text-blue-50">Okul cüzdanı — kullanım tarifeleri</CardTitle>
                    <CardDescription className="text-xs text-blue-900/80 dark:text-blue-200/90">
                      Okul yöneticisi işlemlerinde okul bakiyesinden düşecek tutarlar (aylık / yıllık).
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2">Modül</th>
                        <th className="px-2 py-2 text-right">Aylık J</th>
                        <th className="px-2 py-2 text-right">Aylık E</th>
                        <th className="px-2 py-2 text-right">Yıllık J</th>
                        <th className="px-4 py-2 text-right">Yıllık E</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {SCHOOL_MODULE_KEYS.map((k) => {
                        const row = policy.module_prices[k];
                        const s = row?.school;
                        return (
                          <tr key={k} className="hover:bg-muted/30">
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
          )}
        </div>
      )}

      {usageLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-border/40 bg-muted/40" />
          ))}
        </div>
      ) : breakdown ? (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="group relative overflow-hidden rounded-2xl border border-violet-500/25 bg-linear-to-br from-violet-500/12 via-card to-card p-6 shadow-lg ring-1 ring-violet-500/10 transition hover:shadow-xl dark:from-violet-950/40 dark:ring-violet-400/10">
              <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-violet-500/15 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  <CalendarDays className="size-4" />
                  Takvim ayı (UTC)
                </div>
                <Timer className="size-5 text-violet-600/80 dark:text-violet-400" />
              </div>
              <p className="relative mt-3 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {formatRemainingTr(breakdown.periods.month.ends_at, nowTick)}
              </p>
              <p className="relative mt-1 text-xs text-muted-foreground">
                Dönem sonu: {fmtEndDate(breakdown.periods.month.ends_at)} · {breakdown.periods.month.label}
              </p>
              <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-linear-to-r from-violet-500 to-fuchsia-500 transition-[width] duration-500"
                  style={{ width: `${periodProgress(nowTick, breakdown.periods.month.ends_at, 'month')}%` }}
                />
              </div>
              <div className="relative mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  <span className="text-muted-foreground">Harcama jeton</span>{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmtNum(breakdown.user.month.jeton)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Harcama ek ders</span>{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmtNum(breakdown.user.month.ekders)}
                  </span>
                </span>
              </div>
              <p className="relative mt-2 text-[11px] text-muted-foreground">Bireysel cüzdan — bu ay toplam</p>
            </div>

            <div className="group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-linear-to-br from-amber-500/12 via-card to-card p-6 shadow-lg ring-1 ring-amber-500/10 transition hover:shadow-xl dark:from-amber-950/35 dark:ring-amber-400/10">
              <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-amber-500/15 blur-2xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                  <Calendar className="size-4" />
                  Takvim yılı (UTC)
                </div>
                <Timer className="size-5 text-amber-600/80 dark:text-amber-400" />
              </div>
              <p className="relative mt-3 text-2xl font-bold tabular-nums tracking-tight text-foreground">
                {formatRemainingTr(breakdown.periods.year.ends_at, nowTick)}
              </p>
              <p className="relative mt-1 text-xs text-muted-foreground">
                Dönem sonu: {fmtEndDate(breakdown.periods.year.ends_at)} · {breakdown.periods.year.label}
              </p>
              <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-linear-to-r from-amber-500 to-orange-500 transition-[width] duration-500"
                  style={{ width: `${periodProgress(nowTick, breakdown.periods.year.ends_at, 'year')}%` }}
                />
              </div>
              <div className="relative mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                <span>
                  <span className="text-muted-foreground">Harcama jeton</span>{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmtNum(breakdown.user.year.jeton)}
                  </span>
                </span>
                <span>
                  <span className="text-muted-foreground">Harcama ek ders</span>{' '}
                  <span className="font-semibold tabular-nums text-foreground">
                    {fmtNum(breakdown.user.year.ekders)}
                  </span>
                </span>
              </div>
              <p className="relative mt-2 text-[11px] text-muted-foreground">Bireysel cüzdan — bu yıl toplam</p>
            </div>
          </div>

          <div className={cn('grid gap-6', breakdown.school ? 'lg:grid-cols-2' : '')}>
            <Card className="overflow-hidden border-emerald-500/20 shadow-lg ring-1 ring-emerald-500/10 dark:bg-card">
              <CardHeader className="border-b border-border/60 bg-linear-to-r from-emerald-500/10 to-transparent pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserRound className="size-5 text-emerald-600 dark:text-emerald-400" />
                  Öğretmen — modül harcamaları
                </CardTitle>
                <CardDescription className="text-xs">
                  Bu ay ve bu yıl içinde bireysel cüzdanınızdan modüllere göre düşen jeton / ek ders.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-3">Modül</th>
                        <th className="px-2 py-3 text-right">Ay J</th>
                        <th className="px-2 py-3 text-right">Ay E</th>
                        <th className="px-2 py-3 text-right">Yıl J</th>
                        <th className="px-4 py-3 text-right">Yıl E</th>
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

            {breakdown.school && (
              <Card className="overflow-hidden border-blue-500/25 shadow-lg ring-1 ring-blue-500/15 dark:border-blue-900/50 dark:bg-card">
                <CardHeader className="border-b border-border/60 bg-linear-to-r from-blue-500/15 to-transparent pb-4 dark:from-blue-950/40">
                  <CardTitle className="flex items-center gap-2 text-lg text-blue-950 dark:text-blue-50">
                    <Building2 className="size-5 text-blue-600 dark:text-blue-400" />
                    Okul cüzdanı — modül harcamaları
                  </CardTitle>
                  <CardDescription className="text-xs text-blue-900/80 dark:text-blue-200/90">
                    Okul bakiyesinden düşen kullanım; ay ve yıl toplamları aşağıdaki tabloda modül bazlıdır.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="table-x-scroll">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="border-b border-border/80 bg-muted/40 text-left text-xs font-medium text-muted-foreground">
                          <th className="px-4 py-3">Modül</th>
                          <th className="px-2 py-3 text-right">Ay J</th>
                          <th className="px-2 py-3 text-right">Ay E</th>
                          <th className="px-2 py-3 text-right">Yıl J</th>
                          <th className="px-4 py-3 text-right">Yıl E</th>
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
      ) : null}

      {!usageLoading && (ledgerUser.length > 0 || ledgerSchool.length > 0) && (
        <div className={cn('grid gap-6', ledgerSchool.length > 0 && isSchoolAdmin ? 'lg:grid-cols-2' : '')}>
          {ledgerUser.length > 0 && (
            <Card className="overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="border-b border-border/60 bg-muted/15 pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-800 dark:text-violet-300">
                    <ListTree className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Modül tüketimi (bireysel)</CardTitle>
                    <CardDescription className="text-xs">Son kayıtlar — jeton / ek ders düşümleri</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2">Tarih</th>
                        <th className="px-4 py-2">Modül</th>
                        <th className="px-4 py-2 text-right">Jeton</th>
                        <th className="px-4 py-2 text-right">Ek ders</th>
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
          )}
          {isSchoolAdmin && ledgerSchool.length > 0 && (
            <Card className="overflow-hidden border-blue-200/50 shadow-sm dark:border-blue-900/40">
              <CardHeader className="border-b border-border/60 bg-blue-50/40 pb-3 dark:bg-blue-950/20">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white dark:bg-blue-500">
                    <ListTree className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base text-blue-950 dark:text-blue-50">Modül tüketimi (okul cüzdanı)</CardTitle>
                    <CardDescription className="text-xs text-blue-900/80 dark:text-blue-200/90">
                      Okul bakiyesinden düşen son işlemler
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="table-x-scroll">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-border/80 bg-muted/30 text-left text-xs font-medium text-muted-foreground">
                        <th className="px-4 py-2">Tarih</th>
                        <th className="px-4 py-2">Modül</th>
                        <th className="px-4 py-2 text-right">Jeton</th>
                        <th className="px-4 py-2 text-right">Ek ders</th>
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
                  <CardTitle className="text-lg">Okul market — manuel yükleme kayıtları</CardTitle>
                  <CardDescription className="mt-1 max-w-3xl text-sm">
                    Okullar sayfasından eklenen <strong className="font-medium text-foreground">jeton</strong> ve{' '}
                    <strong className="font-medium text-foreground">ek ders</strong> tutarlarının tam listesi. Mağaza
                    (IAP) satın almaları değil; sadece superadmin kurumsal yükleme hareketleri.
                  </CardDescription>
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
                  <table className="w-full min-w-[880px] text-sm">
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
                  <CardTitle className="text-lg">Öğretmen market — manuel yükleme kayıtları</CardTitle>
                  <CardDescription className="mt-1 max-w-3xl text-sm">
                    Kullanıcı detayından eklenen <strong className="font-medium text-foreground">bireysel</strong> jeton ve ek
                    ders yüklemelerinin tam listesi (IAP değil).
                  </CardDescription>
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
                  <table className="w-full min-w-[920px] text-sm">
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
        <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20">
          <LoadingSpinner label="Hesap bilgileri yükleniyor…" />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <UserRound className="size-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bireysel hesap</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
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
            {isTeacher && (
              <Card className="overflow-hidden border-emerald-200/60 shadow-sm dark:border-emerald-900/50">
                <CardHeader className="border-b border-border/60 bg-emerald-50/40 pb-3 dark:bg-emerald-950/25">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Bireysel manuel yüklemler</CardTitle>
                      <CardDescription className="mt-1 max-w-2xl text-sm">
                        Platform yöneticisinin <strong className="font-medium text-foreground">bireysel</strong> cüzdanınıza
                        eklediği jeton ve ek ders (mağaza satın alması değildir).
                      </CardDescription>
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
                        <table className="w-full min-w-[640px] text-sm">
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
              <div className="grid gap-4 sm:grid-cols-2">
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

              <Card className="overflow-hidden border-blue-200/60 shadow-sm dark:border-blue-900/50">
                <CardHeader className="border-b border-border/60 bg-blue-50/40 pb-3 dark:bg-blue-950/25">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <CardTitle className="text-base">Kurumsal manuel yüklemler</CardTitle>
                      <CardDescription className="mt-1 max-w-2xl text-sm">
                        Platform yöneticisinin okul cüzdanınıza eklediği <strong className="font-medium text-foreground">jeton</strong> ve{' '}
                        <strong className="font-medium text-foreground">ek ders</strong> tutarları. Kim tarafından eklendiği ve
                        isteğe bağlı not burada görünür (mağaza satın alması değildir).
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => void fetchSchoolAdminManualCredits()}
                      disabled={saManualLoading}
                    >
                      <RefreshCw className={cn('mr-2 size-4', saManualLoading && 'animate-spin')} />
                      Yenile
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground">Başlangıç</label>
                      <input
                        type="date"
                        value={saManualFrom}
                        onChange={(e) => {
                          setSaManualFrom(e.target.value);
                          setSaManualPage(1);
                        }}
                        className="mt-1 rounded-lg border border-input bg-background px-2 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground">Bitiş</label>
                      <input
                        type="date"
                        value={saManualTo}
                        onChange={(e) => {
                          setSaManualTo(e.target.value);
                          setSaManualPage(1);
                        }}
                        className="mt-1 rounded-lg border border-input bg-background px-2 py-2 text-sm"
                      />
                    </div>
                    <Button type="button" size="sm" className="mb-0.5" onClick={() => void fetchSchoolAdminManualCredits()} disabled={saManualLoading}>
                      Filtrele
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {saManualLoading && !saManual ? (
                    <div className="flex justify-center py-10">
                      <LoadingSpinner label="Yüklemeler yükleniyor…" />
                    </div>
                  ) : !saManual?.items.length ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                      Henüz kayıt yok veya seçilen tarihlerde manuel yükleme bulunmuyor.
                    </p>
                  ) : (
                    <>
                      <div className="table-x-scroll">
                        <table className="w-full min-w-[640px] text-sm">
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
                            {saManual.items.map((row) => (
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
                      {saManual.total > SCHOOL_ADMIN_MANUAL_PAGE && (
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                          <p className="text-xs text-muted-foreground">
                            Toplam {saManual.total} kayıt · Sayfa {saManualPage} /{' '}
                            {Math.max(1, Math.ceil(saManual.total / SCHOOL_ADMIN_MANUAL_PAGE))}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={saManualPage <= 1 || saManualLoading}
                              onClick={() => setSaManualPage((p) => p - 1)}
                            >
                              <ChevronLeft className="mr-1 size-4" />
                              Önceki
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                saManualPage * SCHOOL_ADMIN_MANUAL_PAGE >= saManual.total || saManualLoading
                              }
                              onClick={() => setSaManualPage((p) => p + 1)}
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
            </section>
          )}

          <div className={cn('grid gap-8', isSchoolAdmin ? 'lg:grid-cols-2' : 'max-w-4xl')}>
            <Card className="overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <History className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Satın alma geçmişim</CardTitle>
                    <CardDescription>
                      Bu hesapla doğrulanan mağaza işlemleri. Okul adına yapılan yüklemeler &quot;Okul&quot; hedefiyle
                      işaretlenir.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
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

            {isSchoolAdmin && (
              <Card className="overflow-hidden border-blue-200/50 shadow-sm dark:border-blue-900/40">
                <CardHeader className="border-b border-border/60 bg-blue-50/50 pb-4 dark:bg-blue-950/20">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white dark:bg-blue-500">
                      <Wallet className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-blue-950 dark:text-blue-50">Okul cüzdanı işlemleri</CardTitle>
                      <CardDescription className="text-blue-900/80 dark:text-blue-200/90">
                        Okul adına yüklenen jeton / ek ders (satın almada okul cüzdanı seçildiğinde).
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {!school?.items.length ? (
                    <EmptyLedger
                      title="Henüz okul işlemi yok"
                      hint="Okul cüzdanına yapılan ilk satın alma doğrulaması burada görünür."
                    />
                  ) : (
                    <>
                      <LedgerTable rows={school.items} showTarget={false} />
                      {school.total > PAGE_SIZE && (
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                          <p className="text-xs text-muted-foreground">
                            Sayfa {pageSchool} / {totalPagesSchool} · Toplam {school.total} kayıt
                          </p>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pageSchool <= 1}
                              onClick={() => setPageSchool((p) => Math.max(1, p - 1))}
                            >
                              <ChevronLeft className="mr-1 size-4" />
                              Önceki
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pageSchool >= totalPagesSchool}
                              onClick={() => setPageSchool((p) => p + 1)}
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
          </div>

          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b border-border/60 bg-muted/15">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-300">
                  <FileText className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg">Kullanım hakları</CardTitle>
                  <CardDescription>
                    Evrak üretimi gibi modül kullanımlarından düşen haklar. Ücretli modüllerde politika tarifesine göre
                    jeton/ek ders düşümü üstteki özet ve tüketim tablolarında görünür.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              {entitlements.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                  Henüz kayıtlı hak yok. Evrak ürettiğinizde varsayılan kotanız oluşturulur.
                </p>
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

          <Card className="overflow-hidden border-2 border-dashed border-primary/25 bg-linear-to-br from-primary/5 via-card to-violet-500/5 shadow-sm">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <div className="mb-5 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-inner ring-1 ring-primary/20">
                <ShoppingBag className="size-8" />
              </div>
              <h3 className="text-xl font-semibold tracking-tight text-foreground">Mobil uygulamadan satın alma</h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">
                Jeton ve ek ders paketleri Google Play ve App Store üzerinden satın alınır; uygulama sunucuya doğrulama
                gönderir. Ürün kimlikleri ve fiyatlar yönetim panelindeki Market Politikasından yönetilir.
              </p>
              {isTeacher && evrakQty <= 0 && (
                <Button asChild className="mt-6" size="lg">
                  <Link href="/evrak">Evrak modülüne git</Link>
                </Button>
              )}
              {isSuperOrMod && (
                <Button asChild variant="outline" className="mt-4" size="sm">
                  <Link href="/market-policy">Market politikası ve platform özeti</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
