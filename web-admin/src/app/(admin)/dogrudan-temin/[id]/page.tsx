'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtReadonlyLoadFeedback, type DtReadonlyLoadBanner } from '@/lib/dt-readonly-load-error';
import { dtUrl } from '@/lib/dt-url';
import { Toolbar, ToolbarActions, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import {
  ClipboardList,
  CheckCircle2,
  ChevronLeft,
  Copy,
  FileDown,
  Search,
  Sparkles,
  Archive,
  FolderArchive,
  Share2,
  Mail,
  Banknote,
  Users,
  PackageSearch,
  Handshake,
  Landmark,
  FileStack,
  FileText,
  Library,
  Pencil,
  Trash2,
  Info,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import {
  DT_DETAIL_TABS,
  DT_INPUT_SM,
  DT_ITEM_UNIT_PRESETS,
  DT_LEGAL_NOTICE,
  DT_SECTION_HINTS,
  DT_TEXTAREA_SM,
  DT_UNIT_SELECT_CUSTOM,
  type DtDetailTabId,
  dtBudgetBlockStatusLabel,
  dtDocTypeLabel,
  dtFileStatusBadgeClass,
  dtFileStatusLabel,
  dtFormatNumberTr,
  dtParseAmount,
  dtQuoteStatusChipClass,
  dtQuoteStatusHint,
  dtQuoteStatusLabel,
  dtStripNumericTrailingZeros,
  dtTeminTypeLabel,
} from '@/lib/dt-ui';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';
import { DtFileWizard } from '@/components/dogrudan-temin/dt-wizard';

type DtFileItem = {
  id: string;
  year: number;
  fileNo: string;
  subject: string;
  teminType: string;
  status: string;
  budgetAccountId: string | null;
  approxTotal: string | null;
  decisionTotal: string | null;
  paymentTotal: string | null;
  procurementRef?: string | null;
  archivedAt?: string | null;
};

type DtItem = {
  id: string;
  name: string;
  spec: string | null;
  qty: string;
  unit: string | null;
  vatRate: number;
  estimatedUnitPrice: string | null;
};

type MatLibRow = {
  id: string;
  code: string;
  name: string;
  unit: string | null;
  vatRate: number;
  description?: string | null;
};

type VendorItem = { id: string; title: string };
type Quote = { id: string; vendorId: string; status: string; purpose?: string };
type QuoteItem = { id: string; quoteId: string; dtItemId: string; unitPrice: string };

function normalizeQuotePurpose(p: string | null | undefined): 'bid' | 'market_research' {
  return p === 'market_research' ? 'market_research' : 'bid';
}

/** Firma bazlı sabit pastel kart (aynı vendorId her zaman aynı ton). */
function vendorQuoteCardShell(vendorId: string): string {
  const shells = [
    'rounded-lg border shadow-sm border-violet-200/90 bg-violet-50/95 dark:border-violet-800/55 dark:bg-violet-950/45',
    'rounded-lg border shadow-sm border-teal-200/90 bg-teal-50/95 dark:border-teal-800/55 dark:bg-teal-950/45',
    'rounded-lg border shadow-sm border-rose-200/90 bg-rose-50/95 dark:border-rose-800/55 dark:bg-rose-950/45',
    'rounded-lg border shadow-sm border-cyan-200/90 bg-cyan-50/95 dark:border-cyan-800/55 dark:bg-cyan-950/45',
    'rounded-lg border shadow-sm border-fuchsia-200/90 bg-fuchsia-50/90 dark:border-fuchsia-800/55 dark:bg-fuchsia-950/40',
    'rounded-lg border shadow-sm border-lime-200/90 bg-lime-50/88 dark:border-lime-800/55 dark:bg-lime-950/38',
  ];
  let h = 0;
  for (let i = 0; i < vendorId.length; i++) h = (h * 31 + vendorId.charCodeAt(i)) >>> 0;
  return `${shells[h % shells.length]} space-y-2 p-3`;
}

function DtItemUnitSelect({ value, onChange }: { value: string; onChange: (u: string) => void }) {
  const [otherOpen, setOtherOpen] = useState(false);
  const presets = DT_ITEM_UNIT_PRESETS as readonly string[];
  const trimmed = value.trim();
  const inList = (presets as readonly string[]).includes(trimmed);
  const selectValue = inList ? trimmed : !trimmed && !otherOpen ? '' : DT_UNIT_SELECT_CUSTOM;

  return (
    <div className="space-y-1.5">
      <select
        className={cn('h-9 w-full rounded border border-input bg-background px-2 text-xs')}
        value={selectValue}
        onChange={(e) => {
          const nv = e.target.value;
          if (nv === '') {
            onChange('');
            setOtherOpen(false);
          } else if (nv === DT_UNIT_SELECT_CUSTOM) {
            onChange('');
            setOtherOpen(true);
          } else {
            onChange(nv);
            setOtherOpen(false);
          }
        }}
      >
        <option value="">— Birim —</option>
        {presets.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
        <option value={DT_UNIT_SELECT_CUSTOM}>Diğer…</option>
      </select>
      {!inList && !!(trimmed || otherOpen) && (
        <Input
          className={DT_INPUT_SM}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Birim yazın"
        />
      )}
    </div>
  );
}
type DocItem = { id: string; docType: string; fileFormat: string; filename: string; createdAt: string };
type BudgetAccount = {
  id: string;
  year: number;
  parentId: string | null;
  code: string | null;
  label: string;
  allocated: string;
  blocked: string;
  spent: string;
};
type BudgetBlock = {
  id: string;
  budgetAccountId: string;
  amount: string;
  status: string;
  blockedAt: string;
  releasedAt: string | null;
};

type DtRules = {
  require_award_before_payment: boolean;
  require_budget_account_on_file: boolean;
  require_quote_on_payment: boolean;
  payment_note_min_length: number;
  platform_notice_tr: string;
};

type DtPaymentRow = {
  id: string;
  amount: string;
  quoteId: string | null;
  paidAt: string;
  note: string | null;
  referenceNo: string | null;
};

type DtAcceptanceCommission = {
  id: string;
  chairmanUserId: string | null;
  kind?: string;
};

type DtAcceptanceCommissionMember = {
  id: string;
  userId: string;
  title: string | null;
};

type CommissionTeacherOption = { id: string; display_name?: string | null; email?: string | null };

const COMMISSION_KIND_LABELS: Record<'yaklasik_maliyet' | 'piyasa_satinalma' | 'muayene_kabul', string> = {
  yaklasik_maliyet: 'Yaklaşık maliyet',
  piyasa_satinalma: 'Piyasa / satın alma',
  muayene_kabul: 'Muayene / kabul',
};

type RegistryEntry = {
  stage: string;
  docDate: string | null;
  numberPrefix: string | null;
  numberSuffix: string | null;
  meta: Record<string, unknown>;
};

type DtSchoolSettings = {
  officialCorrespondenceCode: string | null;
};

export default function DtFileDetailPage() {
  const { token, me } = useAuth();
  const params = useParams<{ id: string }>();
  const id = String(params?.id ?? '').trim();
  const router = useRouter();
  const searchParams = useSearchParams();

  const isSuperadmin = me?.role === 'superadmin' || me?.role === 'moderator';
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(() => searchParams.get('school_id') ?? '');
  const schoolId = isSuperadmin ? selectedSchoolId : ((me as { school_id?: string })?.school_id ?? me?.school?.id ?? '');
  const enabled = me?.school?.enabled_modules ?? null;
  const ok = isSuperadmin || enabled === null || enabled.length === 0 || enabled.includes('dogrudan_temin');

  const [loading, setLoading] = useState(true);
  const [loadBanner, setLoadBanner] = useState<DtReadonlyLoadBanner | null>(null);
  const [file, setFile] = useState<DtFileItem | null>(null);
  const [items, setItems] = useState<DtItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyForm, setCopyForm] = useState({ target_year: '', file_no: '' });
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [quoteVendorId, setQuoteVendorId] = useState('');
  const [quoteItems, setQuoteItems] = useState<Record<string, QuoteItem[]>>({});
  const quoteItemsLoadedRef = useRef<Set<string>>(new Set());
  const [priceDraft, setPriceDraft] = useState<Record<string, Record<string, string>>>({});

  useEffect(() => {
    quoteItemsLoadedRef.current = new Set();
    setQuoteItems({});
    setPriceDraft({});
  }, [id]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docVendorId, setDocVendorId] = useState('');
  const [docFormat, setDocFormat] = useState<'docx' | 'pdf'>('docx');
  const [registryEntries, setRegistryEntries] = useState<RegistryEntry[]>([]);
  const [registryDraft, setRegistryDraft] = useState<
    Record<string, { doc_date: string; number_prefix: string; number_suffix: string; meta: { karar_no?: string } }>
  >({});
  const [officialCode, setOfficialCode] = useState('');
  const [budgetAccounts, setBudgetAccounts] = useState<BudgetAccount[]>([]);
  const [budgetBlocks, setBudgetBlocks] = useState<BudgetBlock[]>([]);
  const [budgetForm, setBudgetForm] = useState({ budget_account_id: '', amount: '' });
  const [dtRules, setDtRules] = useState<DtRules | null>(null);
  const [payments, setPayments] = useState<DtPaymentRow[]>([]);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    quote_id: '',
    note: '',
    reference_no: '',
    paid_at: '',
  });
  const [itemForm, setItemForm] = useState({
    name: '',
    spec: '',
    qty: '1',
    unit: '',
    vat_rate: '20',
    estimated_unit_price: '',
  });
  const [libSearch, setLibSearch] = useState('');
  const [libRows, setLibRows] = useState<MatLibRow[]>([]);
  const [libLoading, setLibLoading] = useState(false);
  const [libStaged, setLibStaged] = useState<Array<{ row: MatLibRow; qty: string }>>([]);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] = useState({
    name: '',
    spec: '',
    qty: '1',
    unit: '',
    vat_rate: '20',
    estimated_unit_price: '',
  });
  const [commission, setCommission] = useState<DtAcceptanceCommission | null>(null);
  const [commissionMembers, setCommissionMembers] = useState<DtAcceptanceCommissionMember[]>([]);
  const [commissionsAll, setCommissionsAll] = useState<Array<{ kind: string }>>([]);
  const [activeTab, setActiveTab] = useState<DtDetailTabId>('items');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [commissionTeachers, setCommissionTeachers] = useState<CommissionTeacherOption[]>([]);
  const [commissionForm, setCommissionForm] = useState({
    chairman_pick: '',
    chairman_manual: '',
    member_pick: '',
    member_manual: '',
    member_title: '',
    apply_all_kinds: true,
  });
  const [commissionCreateDialogOpen, setCommissionCreateDialogOpen] = useState(false);
  const [commissionMemberDialogOpen, setCommissionMemberDialogOpen] = useState(false);
  const [commissionChairmanDialogOpen, setCommissionChairmanDialogOpen] = useState(false);
  const [commissionTeacherQuery, setCommissionTeacherQuery] = useState('');
  const [commissionKind, setCommissionKind] = useState<'muayene_kabul' | 'yaklasik_maliyet' | 'piyasa_satinalma'>('muayene_kabul');
  const [procurementRefDraft, setProcurementRefDraft] = useState('');
  const [quotePurpose, setQuotePurpose] = useState<'bid' | 'market_research'>('bid');
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [confirmReleaseAllOpen, setConfirmReleaseAllOpen] = useState(false);
  const [confirmAutoAwardOpen, setConfirmAutoAwardOpen] = useState(false);
  const [archiveList, setArchiveList] = useState<DtFileItem[]>([]);
  const [archiveListLoading, setArchiveListLoading] = useState(false);

  const tabIcons: Record<DtDetailTabId, LucideIcon> = {
    items: PackageSearch,
    quotes: Handshake,
    registry: FileText,
    budget: Landmark,
    payments: Banknote,
    commission: Users,
    docs: FileStack,
    archive: FolderArchive,
  };

  const canFetch = useMemo(() => !!token && !!id && ok && (!isSuperadmin || !!schoolId), [token, id, ok, isSuperadmin, schoolId]);

  const setSchool = useCallback(
    (sid: string) => {
      setSelectedSchoolId(sid);
      const u = new URLSearchParams(searchParams.toString());
      if (sid) u.set('school_id', sid);
      else u.delete('school_id');
      router.replace(`/dogrudan-temin/${encodeURIComponent(id)}?${u.toString()}`);
    },
    [id, router, searchParams],
  );

  const fetchAll = useCallback(async () => {
    if (!canFetch) return;
    setLoading(true);
    setLoadBanner(null);
    try {
      const [f, it, v, q, d, rulesRes, payRes, commRes, regRes, settingsRes, commAllRes] = await Promise.all([
        apiFetch<DtFileItem>(dtUrl(`/dogrudan-temin/files/${id}`, me?.role, schoolId), { token: token! }),
        apiFetch<{ items: DtItem[] }>(dtUrl(`/dogrudan-temin/files/${id}/items`, me?.role, schoolId), { token: token! }),
        apiFetch<{ items: VendorItem[] }>(dtUrl(`/dogrudan-temin/vendors`, me?.role, schoolId), { token: token! }),
        apiFetch<{ items: Quote[] }>(dtUrl(`/dogrudan-temin/files/${id}/quotes`, me?.role, schoolId), { token: token! }),
        apiFetch<{ items: DocItem[] }>(dtUrl(`/dogrudan-temin/files/${id}/docs`, me?.role, schoolId), { token: token! }),
        apiFetch<DtRules>(dtUrl('/dogrudan-temin/rules', me?.role, schoolId), { token: token! }),
        apiFetch<{ items: DtPaymentRow[] }>(dtUrl(`/dogrudan-temin/files/${id}/payments`, me?.role, schoolId), { token: token! }),
        apiFetch<{ commission: DtAcceptanceCommission | null; members: DtAcceptanceCommissionMember[] }>(
          dtUrl(
            `/dogrudan-temin/files/${id}/commission?kind=${encodeURIComponent(commissionKind)}`,
            me?.role,
            schoolId,
          ),
          { token: token! },
        ).catch(() => ({ commission: null, members: [] })),
        apiFetch<{ entries: RegistryEntry[] }>(dtUrl(`/dogrudan-temin/files/${id}/document-registry`, me?.role, schoolId), { token: token! }).catch(
          () => ({ entries: [] }),
        ),
        apiFetch<DtSchoolSettings>(dtUrl(`/dogrudan-temin/school-settings`, me?.role, schoolId), { token: token! }).catch(
          () => ({ officialCorrespondenceCode: null }),
        ),
        apiFetch<{ commissions: Array<{ commission: { kind: string } }> }>(dtUrl(`/dogrudan-temin/files/${id}/commissions`, me?.role, schoolId), {
          token: token!,
        }).catch(() => ({ commissions: [] })),
      ]);
      setFile(f);
      setItems(it.items ?? []);
      setVendors(v.items ?? []);
      setQuotes(q.items ?? []);
      setDocs(d.items ?? []);
      setDtRules(rulesRes);
      setPayments(payRes.items ?? []);
      setCommission(commRes?.commission ?? null);
      setCommissionMembers(commRes?.members ?? []);
      setRegistryEntries(regRes.entries ?? []);
      setCommissionsAll((commAllRes?.commissions ?? []).map((x) => ({ kind: x.commission.kind })));
      const code = String(settingsRes?.officialCorrespondenceCode ?? '').trim();
      setOfficialCode(code);
      setRegistryDraft(() => {
        const stageDefaults: Record<string, { ref: string; seq: string }> = {
          ihtiyac_listesi: { ref: '934.01.01', seq: '1' },
          komisyon_onay: { ref: '934.01.99', seq: '2' },
          fiyat_arastirma: { ref: '934.02.03', seq: '3' },
          ihale_onay: { ref: '934.01.02', seq: '4' },
        };
        const next: Record<string, { doc_date: string; number_prefix: string; number_suffix: string; meta: { karar_no?: string } }> = {};
        (regRes.entries ?? []).forEach((r) => {
          const def = stageDefaults[r.stage];
          const shouldFillPrefix = !String(r.numberPrefix ?? '').trim() && !!code && !!def?.ref;
          const shouldFillSuffix = !String(r.numberSuffix ?? '').trim() && !!def?.seq;
          next[r.stage] = {
            doc_date: r.docDate ?? '',
            number_prefix: shouldFillPrefix ? `${code}-${def.ref}` : (r.numberPrefix ?? ''),
            number_suffix: shouldFillSuffix ? def.seq : (r.numberSuffix ?? ''),
            meta: { karar_no: typeof r.meta?.karar_no === 'string' ? (r.meta.karar_no as string) : '' },
          };
        });
        return next;
      });

      const [bud, bl] = await Promise.all([
        apiFetch<{ items: BudgetAccount[] }>(
          dtUrl(`/dogrudan-temin/budgets?year=${encodeURIComponent(String(f.year))}`, me?.role, schoolId),
          { token: token! },
        ),
        apiFetch<{ items: BudgetBlock[] }>(dtUrl(`/dogrudan-temin/files/${id}/budget/blocks`, me?.role, schoolId), { token: token! }),
      ]);
      setBudgetAccounts(bud.items ?? []);
      setBudgetBlocks(bl.items ?? []);
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setLoading(false);
    }
  }, [canFetch, commissionKind, id, me?.role, schoolId, token]);

  useEffect(() => {
    if (!canFetch || activeTab !== 'commission') return;
    if (isSuperadmin && !schoolId) return;
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch<{ items?: CommissionTeacherOption[] }>(
          dtUrl('/dogrudan-temin/commission-teacher-options', me?.role, schoolId),
          { token },
        );
        if (!cancelled) setCommissionTeachers(Array.isArray(res.items) ? res.items : []);
      } catch {
        if (!cancelled) setCommissionTeachers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, canFetch, isSuperadmin, me?.role, schoolId, token]);

  const blockBudget = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    if (!budgetForm.budget_account_id) {
      toast.error('Önce bütçe hesabı seçin.');
      return;
    }
    const amt = dtParseAmount(budgetForm.amount);
    if (!budgetForm.amount.trim() || amt == null || amt <= 0) {
      toast.error('Bloke tutarı pozitif bir sayı olmalı.');
      return;
    }
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/budget/block`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ budget_account_id: budgetForm.budget_account_id, amount: budgetForm.amount }),
      });
      setBudgetForm({ budget_account_id: budgetForm.budget_account_id, amount: '' });
      toast.success('Bütçe bloke edildi.');
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [budgetForm.amount, budgetForm.budget_account_id, fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const releaseBudget = useCallback(
    async (block_id?: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/budget/release`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify(block_id ? { block_id } : {}),
        });
        await fetchAll();
        if (block_id) toast.success('Blokaj kaldırıldı.');
        else toast.success('Tüm blokeler kaldırıldı.');
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchAll, id, isSuperadmin, me?.role, schoolId, token],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    setSelectedQuoteIds((prev) => prev.filter((qid) => quotes.some((q) => q.id === qid)));
  }, [quotes]);

  useEffect(() => {
    const w = String(searchParams.get('wizard') ?? '').trim().toLowerCase();
    if (w === '1' || w === 'true' || w === 'yes') setWizardOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (file?.id) setProcurementRefDraft(String(file.procurementRef ?? '').trim());
  }, [file?.id, file?.procurementRef]);

  useEffect(() => {
    if (!token) return;
    if (isSuperadmin && !schoolId) {
      setLoading(false);
      setFile(null);
      setItems([]);
      setVendors([]);
      setQuotes([]);
      setDocs([]);
      setBudgetAccounts([]);
      setBudgetBlocks([]);
      setDtRules(null);
      setPayments([]);
      setCommission(null);
      setCommissionMembers([]);
    }
  }, [isSuperadmin, schoolId, token]);

  const autoAward = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/awards/auto`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ mode: 'per_item_lowest' }),
      });
      await fetchAll();
      toast.success('Otomatik karar uygulandı (kalem bazında en düşük teklif).');
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const generateDoc = useCallback(
    async (doc_type: string, vendor_id?: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        const res = await apiFetch<{ download_url: string }>(dtUrl(`/dogrudan-temin/files/${id}/docs/generate`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({ doc_type, file_format: docFormat, ...(vendor_id ? { vendor_id } : {}) }),
        });
        if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
        await fetchAll();
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [docFormat, fetchAll, id, isSuperadmin, me?.role, schoolId, token],
  );

  const downloadDoc = useCallback(
    async (docId: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        const res = await apiFetch<{ download_url: string }>(dtUrl(`/dogrudan-temin/docs/${docId}/download`, me?.role, schoolId), { token });
        if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [isSuperadmin, me?.role, schoolId, token],
  );

  const addItem = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/items`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: itemForm.name,
          spec: itemForm.spec || null,
          qty: dtStripNumericTrailingZeros(itemForm.qty.trim()) || itemForm.qty.trim(),
          unit: itemForm.unit || null,
          vat_rate: Number(itemForm.vat_rate || 20),
          estimated_unit_price: itemForm.estimated_unit_price.trim()
            ? dtStripNumericTrailingZeros(itemForm.estimated_unit_price.trim())
            : null,
        }),
      });
      setAddOpen(false);
      setItemForm({ name: '', spec: '', qty: '1', unit: '', vat_rate: '20', estimated_unit_price: '' });
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, itemForm.estimated_unit_price, itemForm.name, itemForm.qty, itemForm.spec, itemForm.unit, itemForm.vat_rate, me?.role, schoolId, token]);

  useEffect(() => {
    if (!addOpen || !token) return;
    if (isSuperadmin && !schoolId) return;
    const h = setTimeout(() => {
      void (async () => {
        setLibLoading(true);
        try {
          const qs = new URLSearchParams();
          qs.set('limit', '120');
          qs.set('skip', '0');
          if (libSearch.trim()) qs.set('search', libSearch.trim());
          const res = await apiFetch<{ items: MatLibRow[] }>(
            dtUrl(`/dogrudan-temin/materials/library?${qs.toString()}`, me?.role, schoolId),
            { token },
          );
          setLibRows(res.items ?? []);
        } catch {
          setLibRows([]);
        } finally {
          setLibLoading(false);
        }
      })();
    }, 320);
    return () => clearTimeout(h);
  }, [addOpen, isSuperadmin, libSearch, me?.role, schoolId, token]);

  const addLibToStaged = useCallback((row: MatLibRow) => {
    setLibStaged((prev) => {
      if (prev.some((p) => p.row.id === row.id)) {
        toast('Bu kalem zaten sepette.');
        return prev;
      }
      return [...prev, { row, qty: '1' }];
    });
  }, []);

  const removeLibStaged = useCallback((libId: string) => {
    setLibStaged((prev) => prev.filter((p) => p.row.id !== libId));
  }, []);

  const addLibraryBatch = useCallback(async () => {
    if (!token || libStaged.length === 0) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    const batch = [...libStaged];
    try {
      for (const { row, qty } of batch) {
        const specParts = [row.description?.trim(), row.code ? `Kütüphane kodu: ${row.code}` : ''].filter(Boolean);
        await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/items`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({
            name: row.name.trim(),
            spec: specParts.length ? specParts.join('\n') : null,
            qty: qty.trim() || '1',
            unit: row.unit?.trim() || null,
            vat_rate: Number(row.vatRate ?? 20) || 20,
            estimated_unit_price: null,
          }),
        });
      }
      setLibStaged([]);
      toast.success(`${batch.length} kalem eklendi.`);
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, libStaged, me?.role, schoolId, token]);

  const deleteItemRow = useCallback(
    async (itemId: string) => {
      if (!window.confirm('Bu kalemi dosyadan silmek istediğinize emin misiniz?')) return;
      if (!token || (isSuperadmin && !schoolId)) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        await apiFetch(dtUrl(`/dogrudan-temin/items/${itemId}`, me?.role, schoolId), { token, method: 'DELETE' });
        toast.success('Kalem silindi.');
        await fetchAll();
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchAll, isSuperadmin, me?.role, schoolId, token],
  );

  const openItemEdit = useCallback((x: DtItem) => {
    setEditItemId(x.id);
    setEditItemForm({
      name: x.name,
      spec: x.spec ?? '',
      qty: dtStripNumericTrailingZeros(String(x.qty ?? '1')),
      unit: x.unit ?? '',
      vat_rate: String(x.vatRate ?? 20),
      estimated_unit_price:
        x.estimatedUnitPrice != null && String(x.estimatedUnitPrice).trim() !== ''
          ? dtStripNumericTrailingZeros(String(x.estimatedUnitPrice))
          : '',
    });
  }, []);

  const saveItemEdit = useCallback(async () => {
    if (!token || !editItemId || !editItemForm.name.trim()) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/items/${editItemId}`, me?.role, schoolId), {
        token,
        method: 'PATCH',
        body: JSON.stringify({
          name: editItemForm.name.trim(),
          spec: editItemForm.spec.trim() || null,
          qty: dtStripNumericTrailingZeros(editItemForm.qty.trim()) || editItemForm.qty.trim(),
          unit: editItemForm.unit.trim() || null,
          vat_rate: Number(editItemForm.vat_rate) || 20,
          estimated_unit_price: editItemForm.estimated_unit_price.trim()
            ? dtStripNumericTrailingZeros(editItemForm.estimated_unit_price.trim())
            : null,
        }),
      });
      setEditItemId(null);
      toast.success('Kalem güncellendi.');
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [editItemForm, editItemId, fetchAll, isSuperadmin, me?.role, schoolId, token]);

  const archive = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/archive`, me?.role, schoolId), { token, method: 'POST' });
      await fetchAll();
      toast.success('Dosya arşivlendi.');
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const unarchive = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/unarchive`, me?.role, schoolId), { token, method: 'POST' });
      await fetchAll();
      toast.success('Dosya arşivden çıkarıldı.');
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const sharePageUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, [id, schoolId]);

  const copyShareLink = useCallback(async () => {
    const url = sharePageUrl || (typeof window !== 'undefined' ? window.location.href : '');
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Bağlantı panoya kopyalandı.');
    } catch {
      toast.error('Panoya kopyalanamadı.');
    }
  }, [sharePageUrl]);

  const mailShareLink = useCallback(() => {
    const url = sharePageUrl || (typeof window !== 'undefined' ? window.location.href : '');
    const subj = encodeURIComponent(file?.subject ? `DT: ${file.subject}` : 'Doğrudan temin dosyası');
    const body = encodeURIComponent(`Merhaba,\n\nDosya bağlantısı:\n${url}\n`);
    window.open(`mailto:?subject=${subj}&body=${body}`, '_blank');
  }, [file?.subject, sharePageUrl]);

  useEffect(() => {
    if (activeTab !== 'archive' || !canFetch || !token) return;
    let cancelled = false;
    setArchiveListLoading(true);
    void (async () => {
      try {
        const res = await apiFetch<{ items: DtFileItem[] }>(
          dtUrl('/dogrudan-temin/files?include_archived=1', me?.role, schoolId),
          { token },
        );
        const rows = (res.items ?? []).filter((x) => !!x.archivedAt);
        if (!cancelled) setArchiveList(rows);
      } catch {
        if (!cancelled) setArchiveList([]);
      } finally {
        if (!cancelled) setArchiveListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, canFetch, me?.role, schoolId, token]);

  const copyFile = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      const res = await apiFetch<{ id: string }>(dtUrl(`/dogrudan-temin/files/${id}/copy`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          target_year: copyForm.target_year ? Number(copyForm.target_year) : undefined,
          file_no: copyForm.file_no || undefined,
        }),
      });
      setCopyOpen(false);
      setCopyForm({ target_year: '', file_no: '' });
      if (res?.id) {
        router.push(
          isSuperadmin && schoolId
            ? `/dogrudan-temin/${res.id}?school_id=${encodeURIComponent(schoolId)}`
            : `/dogrudan-temin/${res.id}`,
        );
      }
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [copyForm.file_no, copyForm.target_year, id, isSuperadmin, me?.role, router, schoolId, token]);

  const createQuote = useCallback(async () => {
    if (!token || !quoteVendorId) return;
    if (isSuperadmin && !schoolId) return;
    if (!vendors.length) {
      toast.error('Önce en az bir firma kaydı oluşturun (Firmalar menüsü).');
      return;
    }
    const createdPurpose = quotePurpose;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/quotes`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ vendor_id: quoteVendorId, purpose: quotePurpose }),
      });
      setQuoteOpen(false);
      setQuoteVendorId('');
      setQuotePurpose('bid');
      await fetchAll();
      toast.success(
        createdPurpose === 'market_research' ? 'Fiyat araştırması kaydı oluşturuldu.' : 'Teklif kaydı oluşturuldu.',
      );
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, quotePurpose, quoteVendorId, schoolId, token, vendors.length]);

  const copyResearchQuotesToBid = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      const res = await apiFetch<{ created: number; merged?: number }>(
        dtUrl(`/dogrudan-temin/files/${id}/quotes/copy-research-to-bid`, me?.role, schoolId),
        { token, method: 'POST', body: '{}' },
      );
      quoteItemsLoadedRef.current.clear();
      setQuoteItems({});
      const c = res.created ?? 0;
      const m = res.merged ?? 0;
      toast.success(m ? `Yeni: ${c}, güncellenen firma: ${m}` : `Yeni teklif: ${c}`);
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const researchQuotes = useMemo(
    () => quotes.filter((q) => normalizeQuotePurpose(q.purpose) === 'market_research'),
    [quotes],
  );
  const bidQuotes = useMemo(
    () => quotes.filter((q) => normalizeQuotePurpose(q.purpose) !== 'market_research'),
    [quotes],
  );

  const quoteResearchByVendor = useMemo(() => {
    const m = new Map<string, Quote>();
    for (const q of researchQuotes) {
      if (!m.has(q.vendorId)) m.set(q.vendorId, q);
    }
    return m;
  }, [researchQuotes]);

  const quoteBidByVendor = useMemo(() => {
    const m = new Map<string, Quote>();
    for (const q of bidQuotes) {
      if (!m.has(q.vendorId)) m.set(q.vendorId, q);
    }
    return m;
  }, [bidQuotes]);

  /** Sol–sağ aynı satırda aynı firma (ada göre TR sıra). */
  const quoteVendorsOrdered = useMemo(() => {
    const ids = new Set<string>();
    researchQuotes.forEach((q) => ids.add(q.vendorId));
    bidQuotes.forEach((q) => ids.add(q.vendorId));
    return Array.from(ids).sort((a, b) => {
      const ta = vendors.find((v) => v.id === a)?.title ?? a;
      const tb = vendors.find((v) => v.id === b)?.title ?? b;
      return ta.localeCompare(tb, 'tr', { sensitivity: 'base' });
    });
  }, [bidQuotes, researchQuotes, vendors]);

  const quotesOverviewSorted = useMemo(
    () =>
      [...quotes].sort((a, b) => {
        const ta = vendors.find((v) => v.id === a.vendorId)?.title ?? a.vendorId;
        const tb = vendors.find((v) => v.id === b.vendorId)?.title ?? b.vendorId;
        const c = ta.localeCompare(tb, 'tr', { sensitivity: 'base' });
        if (c !== 0) return c;
        const pa = normalizeQuotePurpose(a.purpose);
        const pb = normalizeQuotePurpose(b.purpose);
        if (pa === pb) return 0;
        return pa === 'market_research' ? -1 : 1;
      }),
    [quotes, vendors],
  );

  /** Aynı firma + aynı amaç (araştırma veya teklif) birden fazlaysa uyarı metinleri. */
  const duplicateQuoteWarnings = useMemo(() => {
    const byKey = new Map<string, Quote[]>();
    for (const q of quotes) {
      const pur = normalizeQuotePurpose(q.purpose);
      const k = `${q.vendorId}\t${pur}`;
      const arr = byKey.get(k) ?? [];
      arr.push(q);
      byKey.set(k, arr);
    }
    const lines: string[] = [];
    for (const [, list] of byKey) {
      if (list.length <= 1) continue;
      const q0 = list[0];
      const title = vendors.find((v) => v.id === q0.vendorId)?.title ?? q0.vendorId;
      const purposeLabel =
        normalizeQuotePurpose(q0.purpose) === 'market_research' ? 'Fiyat araştırması' : 'Teklif / ihale';
      lines.push(
        `${title} — ${purposeLabel}: ${list.length} kayıt var; dosya başına bu amaçta yalnızca bir kayıt olmalı. Fazlaları silin veya birleştirin.`,
      );
    }
    return lines;
  }, [quotes, vendors]);

  const createQuoteWouldDuplicate = useMemo(() => {
    if (!quoteVendorId) return false;
    return quotes.some(
      (q) => q.vendorId === quoteVendorId && normalizeQuotePurpose(q.purpose) === quotePurpose,
    );
  }, [quotes, quoteVendorId, quotePurpose]);

  const duplicateQuoteRowKeys = useMemo(() => {
    const byKey = new Map<string, number>();
    for (const q of quotes) {
      const k = `${q.vendorId}\t${normalizeQuotePurpose(q.purpose)}`;
      byKey.set(k, (byKey.get(k) ?? 0) + 1);
    }
    const dup = new Set<string>();
    for (const [k, n] of byKey) {
      if (n > 1) dup.add(k);
    }
    return dup;
  }, [quotes]);

  const allQuotesOverviewSelected =
    quotesOverviewSorted.length > 0 && quotesOverviewSorted.every((q) => selectedQuoteIds.includes(q.id));

  const toggleQuoteRowSelect = useCallback((qid: string) => {
    setSelectedQuoteIds((prev) => (prev.includes(qid) ? prev.filter((x) => x !== qid) : [...prev, qid]));
  }, []);

  const toggleSelectAllQuotesOverview = useCallback(() => {
    const ids = quotesOverviewSorted.map((q) => q.id);
    setSelectedQuoteIds((prev) => {
      if (ids.length && ids.every((i) => prev.includes(i))) return prev.filter((x) => !ids.includes(x));
      return [...new Set([...prev, ...ids])];
    });
  }, [quotesOverviewSorted]);

  const syncCommissionFromApprox = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/commissions/sync`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ from_kind: 'yaklasik_maliyet', to_kinds: ['piyasa_satinalma', 'muayene_kabul'] }),
      });
      toast.success('Komisyon üyeleri kopyalandı.');
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const saveProcurementRef = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}`, me?.role, schoolId), {
        token,
        method: 'PATCH',
        body: JSON.stringify({ procurement_ref: procurementRefDraft.trim() || null }),
      });
      toast.success('İhale kayıt no güncellendi.');
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, procurementRefDraft, schoolId, token]);

  const saveRegistry = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      const entries = Object.entries(registryDraft).map(([stage, v]) => ({
        stage,
        doc_date: v.doc_date.trim() || null,
        number_prefix: v.number_prefix.trim() || null,
        number_suffix: v.number_suffix.trim() || null,
        meta: stage === 'muayene_kabul' && v.meta?.karar_no?.trim() ? { karar_no: v.meta.karar_no.trim() } : {},
      }));
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/document-registry`, me?.role, schoolId), {
        token,
        method: 'PUT',
        body: JSON.stringify({ entries }),
      });
      toast.success('Evrak defteri kaydedildi.');
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, registryDraft, schoolId, token]);

  const fetchQuoteItems = useCallback(
    async (qid: string) => {
      if (!token || !qid) return;
      if (isSuperadmin && !schoolId) return;
      if (quoteItemsLoadedRef.current.has(qid)) return;
      quoteItemsLoadedRef.current.add(qid);
      try {
        const res = await apiFetch<{ items: QuoteItem[] }>(dtUrl(`/dogrudan-temin/quotes/${qid}/items`, me?.role, schoolId), { token });
        setQuoteItems((s) => ({ ...s, [qid]: res.items ?? [] }));
        const map: Record<string, string> = {};
        (res.items ?? []).forEach((x) => {
          map[x.dtItemId] = dtStripNumericTrailingZeros(String(x.unitPrice ?? ''));
        });
        setPriceDraft((s) => ({ ...s, [qid]: { ...(s[qid] ?? {}), ...map } }));
      } catch (e) {
        quoteItemsLoadedRef.current.delete(qid);
        throw e;
      }
    },
    [isSuperadmin, me?.role, schoolId, token],
  );

  useEffect(() => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    let cancelled = false;
    void (async () => {
      for (const q of quotes) {
        if (cancelled) return;
        try {
          await fetchQuoteItems(q.id);
        } catch {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelled) return;
          try {
            await fetchQuoteItems(q.id);
          } catch {
            /* throttle / ağ */
          }
        }
        await new Promise((r) => setTimeout(r, 40));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotes, fetchQuoteItems, isSuperadmin, schoolId, token]);

  const postQuoteItemUnitPrice = useCallback(
    async (qid: string, dtItemId: string, unit_price: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      await apiFetch(dtUrl(`/dogrudan-temin/quotes/${qid}/items`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ dt_item_id: dtItemId, unit_price }),
      });
    },
    [isSuperadmin, me?.role, schoolId, token],
  );

  const saveQuotePrice = useCallback(
    async (qid: string, dtItemId: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      const raw = priceDraft[qid]?.[dtItemId];
      if (!raw || !raw.trim()) {
        toast.error('Birim fiyat girin.');
        return;
      }
      const t = raw.trim();
      if (dtParseAmount(t) == null) {
        toast.error('Geçersiz birim fiyatı.');
        return;
      }
      const unit_price = dtStripNumericTrailingZeros(t) || t;
      setBusy(true);
      setLoadBanner(null);
      try {
        await postQuoteItemUnitPrice(qid, dtItemId, unit_price);
        setQuoteItems((s) => {
          const next = { ...s };
          delete next[qid];
          return next;
        });
        quoteItemsLoadedRef.current.delete(qid);
        await fetchQuoteItems(qid);
        toast.success('Birim fiyat kaydedildi.');
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchQuoteItems, isSuperadmin, me?.role, postQuoteItemUnitPrice, priceDraft, schoolId, token],
  );

  const saveAllQuotePricesForQuote = useCallback(
    async (qid: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      const targets = items.filter((it) => (priceDraft[qid]?.[it.id] ?? '').trim());
      if (!targets.length) {
        toast.message('Kaydedilecek birim fiyatı yok.');
        return;
      }
      for (const it of targets) {
        const t = (priceDraft[qid]?.[it.id] ?? '').trim();
        if (dtParseAmount(t) == null) {
          toast.error(`Geçersiz birim fiyatı: ${it.name}`);
          return;
        }
      }
      setBusy(true);
      setLoadBanner(null);
      try {
        for (const it of targets) {
          const t = (priceDraft[qid]?.[it.id] ?? '').trim();
          const unit_price = dtStripNumericTrailingZeros(t) || t;
          await postQuoteItemUnitPrice(qid, it.id, unit_price);
        }
        setQuoteItems((s) => {
          const next = { ...s };
          delete next[qid];
          return next;
        });
        quoteItemsLoadedRef.current.delete(qid);
        await fetchQuoteItems(qid);
        toast.success(`${targets.length} kalem kaydedildi.`);
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchQuoteItems, isSuperadmin, items, me?.role, postQuoteItemUnitPrice, priceDraft, schoolId, token],
  );

  const stripPriceDraftCell = useCallback((qid: string, dtItemId: string) => {
    const cur = priceDraft[qid]?.[dtItemId];
    if (cur == null || !String(cur).trim()) return;
    const t = dtStripNumericTrailingZeros(cur);
    if (t !== cur) setPriceDraft((s) => ({ ...s, [qid]: { ...(s[qid] ?? {}), [dtItemId]: t } }));
  }, [priceDraft]);

  const updateQuoteStatus = useCallback(
    async (qid: string, status: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      if (!id) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/quotes/${qid}`, me?.role, schoolId), {
          token,
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        setQuotes((s) => s.map((q) => (q.id === qid ? { ...q, status } : q)));
        toast.success('Teklif durumu güncellendi.');
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [token, isSuperadmin, schoolId, id, me?.role],
  );

  const deleteQuote = useCallback(
    async (qid: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      if (!id) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/quotes/${qid}`, me?.role, schoolId), {
          token,
          method: 'DELETE',
        });
        setQuotes((s) => s.filter((q) => q.id !== qid));
        setSelectedQuoteIds((prev) => prev.filter((x) => x !== qid));
        setQuoteItems((s) => {
          const next = { ...s };
          delete next[qid];
          return next;
        });
        setPriceDraft((s) => {
          const next = { ...s };
          delete next[qid];
          return next;
        });
        quoteItemsLoadedRef.current.delete(qid);
        setDeleteQuoteId(null);
        toast.success('Teklif silindi.');
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [token, isSuperadmin, schoolId, id, me?.role],
  );

  const deleteQuotesBulk = useCallback(async () => {
    if (!token || !selectedQuoteIds.length) return;
    if (isSuperadmin && !schoolId) return;
    if (!id) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/quotes/bulk-delete`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ quote_ids: selectedQuoteIds }),
      });
      const removed = new Set(selectedQuoteIds);
      setQuotes((s) => s.filter((q) => !removed.has(q.id)));
      setQuoteItems((s) => {
        const next = { ...s };
        for (const qid of removed) delete next[qid];
        return next;
      });
      setPriceDraft((s) => {
        const next = { ...s };
        for (const qid of removed) delete next[qid];
        return next;
      });
      for (const qid of removed) quoteItemsLoadedRef.current.delete(qid);
      setSelectedQuoteIds([]);
      setBulkDeleteOpen(false);
      toast.success(`${removed.size} teklif silindi.`);
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [token, isSuperadmin, schoolId, id, me?.role, selectedQuoteIds]);

  const vendorQuotePanel = useCallback(
    (q: Quote | null, emptyLabel: string) => {
      if (!q) {
        return (
          <div className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/35 bg-muted/10 p-4 text-center text-[11px] text-muted-foreground">
            {emptyLabel}
          </div>
        );
      }
      const pur = normalizeQuotePurpose(q.purpose);
      return (
        <div className={cn(vendorQuoteCardShell(q.vendorId))}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/5 pb-2 dark:border-white/10">
            <div className="flex flex-wrap items-center gap-2">
            {pur === 'market_research' ? (
              <span className="rounded-md border border-amber-400/50 bg-amber-100/80 px-1.5 py-0.5 text-[9px] font-semibold text-amber-950 dark:bg-amber-950/50 dark:text-amber-50">
                Araştırma
              </span>
            ) : (
              <span className="rounded-md border border-sky-400/50 bg-sky-100/80 px-1.5 py-0.5 text-[9px] font-semibold text-sky-950 dark:bg-sky-950/50 dark:text-sky-50">
                Teklif
              </span>
            )}
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[9px] font-semibold',
                dtQuoteStatusChipClass(q.status),
              )}
              title={dtQuoteStatusHint(q.status)}
            >
              {dtQuoteStatusLabel(q.status)}
            </span>
            <select
              value={q.status}
              onChange={(e) => void updateQuoteStatus(q.id, e.target.value)}
              disabled={busy}
              className="h-7 text-[10px] rounded border border-input bg-background px-1.5"
            >
              <option value="requested">İstendi</option>
              <option value="received">Alındı</option>
              <option value="accepted">Kabul</option>
              <option value="rejected">Red</option>
            </select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-950/30"
              disabled={busy}
              onClick={() => setDeleteQuoteId(q.id)}
              title="Teklifi sil"
            >
              <Trash2 className="size-4" />
            </Button>
            </div>
            {items.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-[10px]"
                disabled={
                  busy ||
                  !items.some((it) => (priceDraft[q.id]?.[it.id] ?? '').trim())
                }
                onClick={() => void saveAllQuotePricesForQuote(q.id)}
              >
                Tümünü kaydet
              </Button>
            ) : null}
          </div>
          <div className="table-x-scroll rounded-md border border-black/10 bg-background/50 text-xs dark:border-white/10">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-border bg-muted/35 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-1.5">Kalem</th>
                  <th className="px-2 py-1.5 w-[100px]">Miktar</th>
                  <th className="px-2 py-1.5 w-[72px]">Birim</th>
                  <th className="px-2 py-1.5">Birim fiyat (TL)</th>
                  <th className="px-2 py-1.5 w-[1%]"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((it) => (
                  <tr key={`${q.id}-${it.id}`} className="hover:bg-muted/25">
                    <td className="px-2 py-1">
                      <div className="font-medium">{it.name}</div>
                      {it.spec ? <div className="text-[11px] text-muted-foreground">{it.spec}</div> : null}
                    </td>
                    <td className="px-2 py-1 tabular-nums">{it.qty}</td>
                    <td className="px-2 py-1 text-muted-foreground">{it.unit?.trim() || '—'}</td>
                    <td className="px-2 py-1">
                      <Input
                        value={priceDraft[q.id]?.[it.id] ?? ''}
                        onChange={(e) =>
                          setPriceDraft((s) => ({
                            ...s,
                            [q.id]: { ...(s[q.id] ?? {}), [it.id]: e.target.value },
                          }))
                        }
                        className="h-8 w-[140px] px-2 py-1 text-xs"
                        placeholder="0,00"
                        inputMode="decimal"
                        onBlur={() => stripPriceDraftCell(q.id, it.id)}
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !(priceDraft[q.id]?.[it.id] ?? '').trim()}
                        onClick={() => void saveQuotePrice(q.id, it.id)}
                      >
                        Kaydet
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    },
    [busy, items, priceDraft, saveAllQuotePricesForQuote, saveQuotePrice, stripPriceDraftCell, updateQuoteStatus],
  );

  const recordPayment = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    if (!paymentForm.amount.trim()) {
      toast.error('Ödeme tutarını girin.');
      return;
    }
    const payAmt = dtParseAmount(paymentForm.amount);
    if (payAmt == null || payAmt <= 0) {
      toast.error('Tutar geçerli pozitif bir sayı olmalı.');
      return;
    }
    if (dtRules?.require_quote_on_payment && !paymentForm.quote_id.trim()) {
      toast.error('Platform kuralı: ödeme için teklif seçimi zorunlu.');
      return;
    }
    const minNote = dtRules?.payment_note_min_length ?? 0;
    if (minNote > 0 && paymentForm.note.trim().length < minNote) {
      toast.error(`Ödeme notu en az ${minNote} karakter olmalı.`);
      return;
    }
    if (dtRules?.require_budget_account_on_file && !file?.budgetAccountId) {
      toast.error('Platform kuralı: dosyada bütçe hesabı atanmış olmalı.');
      return;
    }
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/payments`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          amount: paymentForm.amount.trim(),
          quote_id: paymentForm.quote_id.trim() || null,
          note: paymentForm.note.trim() || null,
          reference_no: paymentForm.reference_no.trim() || null,
          paid_at: paymentForm.paid_at.trim() ? `${paymentForm.paid_at.trim()}T00:00:00Z` : null,
        }),
      });
      setPaymentForm({ amount: '', quote_id: '', note: '', reference_no: '', paid_at: '' });
      toast.success('Ödeme kaydı eklendi.');
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [
    dtRules?.payment_note_min_length,
    dtRules?.require_budget_account_on_file,
    dtRules?.require_quote_on_payment,
    fetchAll,
    file?.budgetAccountId,
    id,
    isSuperadmin,
    me?.role,
    paymentForm.amount,
    paymentForm.note,
    paymentForm.paid_at,
    paymentForm.quote_id,
    paymentForm.reference_no,
    schoolId,
    token,
  ]);

  const filteredCommissionTeachers = useMemo(() => {
    const q = commissionTeacherQuery.trim().toLowerCase();
    if (!q) return commissionTeachers;
    return commissionTeachers.filter((t) => {
      const dn = (t.display_name || '').toLowerCase();
      const em = (t.email || '').toLowerCase();
      return dn.includes(q) || em.includes(q) || t.id.toLowerCase().includes(q);
    });
  }, [commissionTeacherQuery, commissionTeachers]);

  const createCommission = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/commission`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          chairman_user_id: (commissionForm.chairman_manual.trim() || commissionForm.chairman_pick.trim()) || null,
          dt_file_id: id,
          kind: commissionKind,
        }),
      });
      setCommissionForm({
        chairman_pick: '',
        chairman_manual: '',
        member_pick: '',
        member_manual: '',
        member_title: '',
        apply_all_kinds: true,
      });
      setCommissionCreateDialogOpen(false);
      await fetchAll();
      toast.success(`${COMMISSION_KIND_LABELS[commissionKind]} komisyonu oluşturuldu.`);
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [
    commissionForm.chairman_manual,
    commissionForm.chairman_pick,
    commissionKind,
    fetchAll,
    id,
    isSuperadmin,
    me?.role,
    schoolId,
    token,
  ]);

  const saveCommissionChairman = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    if (!id || !commission) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/commission`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          dt_file_id: id,
          kind: commissionKind,
          chairman_user_id: (commissionForm.chairman_manual.trim() || commissionForm.chairman_pick.trim()) || null,
        }),
      });
      setCommissionChairmanDialogOpen(false);
      setCommissionTeacherQuery('');
      setCommissionForm((s) => ({
        ...s,
        chairman_pick: '',
        chairman_manual: '',
      }));
      await fetchAll();
      toast.success('Komisyon başkanı güncellendi.');
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [
    commission,
    commissionForm.chairman_manual,
    commissionForm.chairman_pick,
    commissionKind,
    fetchAll,
    id,
    isSuperadmin,
    me?.role,
    schoolId,
    token,
  ]);

  const addCommissionMember = useCallback(async () => {
    if (!token || !commission) return;
    if (isSuperadmin && !schoolId) return;
    const uid = commissionForm.member_manual.trim() || commissionForm.member_pick.trim();
    if (!uid) {
      toast.error('Öğretmen seçin veya UUID girin.');
      return;
    }
    setBusy(true);
    setLoadBanner(null);
    try {
      if (commissionForm.apply_all_kinds) {
        await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/commission/members-all-kinds`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({
            user_id: uid,
            title: commissionForm.member_title.trim() || null,
          }),
        });
      } else {
        await apiFetch(dtUrl(`/dogrudan-temin/commission/${commission.id}/members`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({
            user_id: uid,
            title: commissionForm.member_title.trim() || null,
          }),
        });
      }
      setCommissionForm({
        chairman_pick: '',
        chairman_manual: '',
        member_pick: '',
        member_manual: '',
        member_title: '',
        apply_all_kinds: commissionForm.apply_all_kinds,
      });
      setCommissionMemberDialogOpen(false);
      await fetchAll();
      toast.success(commissionForm.apply_all_kinds ? 'Üye tüm komisyon türlerine eklendi.' : 'Üye eklendi.');
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [
    commission,
    commissionForm.apply_all_kinds,
    commissionForm.member_manual,
    commissionForm.member_pick,
    commissionForm.member_title,
    fetchAll,
    id,
    isSuperadmin,
    me?.role,
    schoolId,
    token,
  ]);

  const removeCommissionMemberRow = useCallback(
    async (memberId: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        await apiFetch(dtUrl(`/dogrudan-temin/commission/members/${memberId}`, me?.role, schoolId), {
          token,
          method: 'DELETE',
        });
        await fetchAll();
        toast.success('Üye kaldırıldı.');
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchAll, isSuperadmin, me?.role, schoolId, token],
  );

  const downloadPaymentOrderPdf = useCallback(async (paymentId: string) => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ buffer: string; filename: string }>(
        dtUrl(`/dogrudan-temin/payments/${paymentId}/order-pdf`, me?.role, schoolId),
        {
          token,
          method: 'POST',
          body: JSON.stringify({}),
        }
      );
      if (res?.buffer && res?.filename) {
        const link = document.createElement('a');
        link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${res.buffer}`;
        link.download = res.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [id, isSuperadmin, me?.role, schoolId, token]);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  return (
    <div className="space-y-2 px-2 pb-8 text-xs sm:space-y-3 sm:px-0">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-sm sm:text-base">Doğrudan temin dosyası</ToolbarPageTitle>
        </ToolbarHeading>
        <ToolbarActions>
          <Button variant="secondary" size="sm" disabled={busy} onClick={() => setWizardOpen(true)}>
            <Sparkles className="size-4" />
            Akış sihirbazı
          </Button>
          {isSuperadmin ? (
            <div className="w-full min-w-0 sm:w-[min(320px,70vw)]">
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          ) : null}
        </ToolbarActions>
      </Toolbar>

      <DtFileWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        role={me?.role ?? null}
        schoolId={schoolId}
        token={token}
        fileId={id}
        subject={file?.subject ?? ''}
        itemsCount={items.length}
        registryEntries={registryEntries}
        quotes={quotes}
        docs={docs}
        commissions={commissionsAll}
        docVendorId={docVendorId}
        onGoTab={(t) => setActiveTab(t as DtDetailTabId)}
        onGenerateDoc={(docType, vendorId) => void generateDoc(docType, vendorId)}
      />

      <div className="flex items-center gap-2 text-[11px]">
        <Link
          href={isSuperadmin && schoolId ? `/dogrudan-temin?school_id=${encodeURIComponent(schoolId)}` : '/dogrudan-temin'}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ChevronLeft className="size-3.5" /> Dosyalar
        </Link>
      </div>

      {loadBanner ? <Alert variant={loadBanner.variant} message={loadBanner.message} /> : null}
      {loading ? (
        <LoadingSpinner label="Yükleniyor…" className="py-10 text-xs" />
      ) : file ? (
        <>
          <div className="rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/12 via-violet-500/8 to-sky-500/10 px-3 py-2.5 shadow-sm sm:px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <ClipboardList className="mt-0.5 size-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold leading-snug text-foreground sm:text-base">{file.subject}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${dtFileStatusBadgeClass(file.status)}`}>
                        {dtFileStatusLabel(file.status)}
                      </span>
                      {file.archivedAt ? (
                        <span className="rounded-md border border-rose-400/50 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900 dark:text-rose-100">
                          Arşivde
                        </span>
                      ) : null}
                      <span className="text-[10px] text-muted-foreground">
                        {file.year} · #{file.fileNo}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">{dtTeminTypeLabel(file.teminType)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/70 px-2 py-0.5 text-[10px]">
                        <span className="text-muted-foreground">Yaklaşık</span>
                        <span className="font-semibold tabular-nums text-foreground">{dtFormatNumberTr(file.approxTotal)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-background/70 px-2 py-0.5 text-[10px]">
                        <span className="text-muted-foreground">Karar</span>
                        <span className="font-semibold tabular-nums text-foreground">{dtFormatNumberTr(file.decisionTotal)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-900 dark:text-emerald-100">
                        <span className="text-emerald-800/80 dark:text-emerald-200/90">Ödenen</span>
                        <span className="font-semibold tabular-nums">{dtFormatNumberTr(file.paymentTotal)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  title="Arşiv sekmesinde detay"
                  disabled={busy}
                  onClick={() => setActiveTab('archive')}
                >
                  <FolderArchive className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  title="Arşivle"
                  disabled={busy}
                  onClick={() => setConfirmArchiveOpen(true)}
                >
                  <Archive className="size-4" />
                </Button>
                <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 px-2" title="Dosyayı kopyala" disabled={busy}>
                      <Copy className="size-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg" title="Dosyayı kopyala">
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">Hedef yıl (opsiyonel)</div>
                          <Input
                            value={copyForm.target_year}
                            onChange={(e) => setCopyForm((s) => ({ ...s, target_year: e.target.value }))}
                            className={DT_INPUT_SM}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">Yeni dosya no (opsiyonel)</div>
                          <Input
                            value={copyForm.file_no}
                            onChange={(e) => setCopyForm((s) => ({ ...s, file_no: e.target.value }))}
                            className={DT_INPUT_SM}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setCopyOpen(false)} disabled={busy}>
                          Vazgeç
                        </Button>
                        <Button onClick={copyFile} disabled={busy}>
                          Kopyala
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/40 pt-2">
              <span className="text-[10px] text-muted-foreground">İhale kayıt no</span>
              <Input
                value={procurementRefDraft}
                onChange={(e) => setProcurementRefDraft(e.target.value)}
                className={cn(DT_INPUT_SM, 'max-w-[min(100%,220px)]')}
                placeholder="örn. 2025/12"
              />
              <Button type="button" variant="outline" size="sm" className="h-8" disabled={busy} onClick={() => void saveProcurementRef()}>
                Kaydet
              </Button>
            </div>
          </div>

          <Alert variant="info" message={DT_LEGAL_NOTICE} />

          {dtRules?.platform_notice_tr?.trim() ? (
            <Alert variant="warning" message={dtRules.platform_notice_tr.trim()} />
          ) : null}

          <div className="rounded-xl border border-border/70 bg-muted/20 p-1.5 shadow-inner">
            <div className="grid grid-cols-2 gap-1 sm:flex sm:flex-wrap sm:gap-1">
              {DT_DETAIL_TABS.map((tab) => {
                const Icon = tabIcons[tab.id];
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.shortHint}
                    className={cn(
                      'flex items-center justify-center gap-1.5 rounded-lg border-2 px-2 py-1.5 text-[11px] font-semibold transition-all sm:justify-start sm:px-2.5 sm:text-xs',
                      active ? tab.activeClass : tab.inactiveClass,
                    )}
                  >
                    <Icon
                      className={cn(
                        'size-3.5 shrink-0 sm:size-4',
                        active ? tab.iconActiveClass : 'text-muted-foreground/80',
                      )}
                    />
                    <span className="truncate">{tab.label}</span>
                    <DtInfoHint title={tab.shortHint} className="hidden opacity-70 sm:inline" />
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 border-t border-border/50 px-1.5 pt-1.5 text-[10px] leading-snug text-muted-foreground sm:text-[11px]">
              {DT_SECTION_HINTS[activeTab]}
            </p>
          </div>

          {activeTab === 'items' && (
          <>
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PackageSearch className="size-4 text-emerald-600" />
                  İhtiyaç listesi
                  <DtInfoHint title={DT_SECTION_HINTS.items} />
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog
                    open={addOpen}
                    onOpenChange={(v) => {
                      setAddOpen(v);
                      if (!v) {
                        setLibStaged([]);
                        setLibSearch('');
                      }
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={busy}>
                        Kalem ekle
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-3xl" title="Kalem ekle">
                      <div className="space-y-4">
                        <div className="rounded-lg border border-emerald-200/50 bg-emerald-500/5 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-foreground">
                            <Library className="size-4 text-emerald-600" />
                            Malzeme kütüphanesi
                            <DtInfoHint title="Okul kütüphanesindeki CPV / malzeme satırlarını arayıp sepete ekleyin; sepetten çıkarabilir veya topluca dosyaya işlersiniz." />
                          </div>
                          <Input
                            value={libSearch}
                            onChange={(e) => setLibSearch(e.target.value)}
                            className={DT_INPUT_SM}
                            placeholder="Kütüphanede ara (kod / ad)…"
                          />
                          <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border/70 bg-background text-[11px]">
                            {libLoading ? (
                              <p className="p-2 text-muted-foreground">Yükleniyor…</p>
                            ) : libRows.length ? (
                              libRows.map((r) => (
                                <div
                                  key={r.id}
                                  className="flex items-start justify-between gap-2 border-b border-border/50 px-2 py-1.5 last:border-0"
                                >
                                  <div className="min-w-0 flex-1">
                                    <span className="font-mono text-[10px] text-primary">{r.code}</span>
                                    <p className="leading-snug text-foreground">{r.name}</p>
                                  </div>
                                  <Button type="button" size="sm" variant="secondary" className="h-7 shrink-0 text-[10px]" onClick={() => addLibToStaged(r)}>
                                    Sepete
                                  </Button>
                                </div>
                              ))
                            ) : (
                              <p className="p-2 text-muted-foreground">Sonuç yok. Kütüphaneyi güncellemek için{' '}
                                <Link href={dtUrl('/dogrudan-temin/malzeme-kutuphanesi', me?.role, schoolId)} className="text-primary underline">
                                  Malzeme kütüphanesi
                                </Link>
                                .
                              </p>
                            )}
                          </div>
                          {libStaged.length > 0 ? (
                            <div className="mt-2 space-y-1.5 rounded-md border border-primary/25 bg-primary/5 p-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Sepet ({libStaged.length})</p>
                              {libStaged.map(({ row, qty }) => (
                                <div key={row.id} className="flex flex-wrap items-center gap-2 border-b border-border/40 py-1 last:border-0">
                                  <span className="min-w-0 flex-1 truncate font-medium text-foreground">{row.name}</span>
                                  <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    Miktar
                                    <Input
                                      className="h-7 w-16 px-1 text-[11px]"
                                      value={qty}
                                      onChange={(e) =>
                                        setLibStaged((prev) =>
                                          prev.map((p) => (p.row.id === row.id ? { ...p, qty: e.target.value } : p)),
                                        )
                                      }
                                    />
                                  </label>
                                  <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => removeLibStaged(row.id)}>
                                    Çıkar
                                  </Button>
                                </div>
                              ))}
                              <Button type="button" size="sm" className="mt-1 w-full" disabled={busy} onClick={() => void addLibraryBatch()}>
                                Sepettekileri dosyaya ekle
                              </Button>
                            </div>
                          ) : null}
                        </div>

                        <div className="border-t border-border/60 pt-3">
                          <p className="mb-2 text-[11px] font-semibold text-muted-foreground">Elle kalem</p>
                          <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            Kalem adı
                            <DtInfoHint title="Satın alınacak mal veya hizmetin kısa adı." />
                          </div>
                          <Input
                            value={itemForm.name}
                            onChange={(e) => setItemForm((s) => ({ ...s, name: e.target.value }))}
                            className={DT_INPUT_SM}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">Teknik açıklama / şartname özeti</div>
                          <textarea
                            value={itemForm.spec}
                            onChange={(e) => setItemForm((s) => ({ ...s, spec: e.target.value }))}
                            className={DT_TEXTAREA_SM}
                          />
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">Miktar</div>
                            <Input
                              value={itemForm.qty}
                              onChange={(e) => setItemForm((s) => ({ ...s, qty: e.target.value }))}
                              onBlur={(e) => {
                                const t = dtStripNumericTrailingZeros(e.target.value);
                                if (t !== e.target.value) setItemForm((s) => ({ ...s, qty: t }));
                              }}
                              className={DT_INPUT_SM}
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">Birim</div>
                            <DtItemUnitSelect value={itemForm.unit} onChange={(u) => setItemForm((s) => ({ ...s, unit: u }))} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">KDV %</div>
                            <Input
                              value={itemForm.vat_rate}
                              onChange={(e) => setItemForm((s) => ({ ...s, vat_rate: e.target.value }))}
                              className={DT_INPUT_SM}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            Tahmini birim fiyat (TL)
                            <DtInfoHint title="Piyasa araştırması sonucu; KDV hariç veya kurumunuza göre — tutarlılığı kontrol edin." />
                          </div>
                          <Input
                            value={itemForm.estimated_unit_price}
                            onChange={(e) => setItemForm((s) => ({ ...s, estimated_unit_price: e.target.value }))}
                            onBlur={(e) => {
                              const t = dtStripNumericTrailingZeros(e.target.value);
                              if (t !== e.target.value) setItemForm((s) => ({ ...s, estimated_unit_price: t }));
                            }}
                            className={DT_INPUT_SM}
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setAddOpen(false)} disabled={busy}>
                            Vazgeç
                          </Button>
                          <Button onClick={addItem} disabled={busy || !itemForm.name.trim()}>
                            Kaydet
                          </Button>
                        </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || items.length === 0}
                    onClick={() => setConfirmAutoAwardOpen(true)}
                    title="Her kalem için en düşük birim fiyatlı teklifi seçer"
                  >
                    <Sparkles className="size-3.5 mr-1 inline" />
                    Karar otomatik
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('ihtiyac_listesi')}>
                    <FileDown className="size-3.5 mr-1 inline" />
                    İhtiyaç listesi (DOCX)
                  </Button>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('karar')}>
                    <FileDown className="size-3.5 mr-1 inline" />
                    Karar (DOCX)
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {items.length ? (
                <div className="table-x-scroll rounded-md border border-border text-xs">
                  <table className="w-full min-w-[960px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Kalem</th>
                        <th className="px-2 py-1.5">Miktar</th>
                        <th className="px-2 py-1.5">Birim</th>
                        <th className="px-2 py-1.5">KDV</th>
                        <th className="px-2 py-1.5">Tahmini BF</th>
                        <th className="w-px whitespace-nowrap px-1 py-1.5 text-center">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((x) => (
                        <tr key={x.id} className="hover:bg-muted/30">
                          <td className="px-2 py-1">
                            <div className="font-medium">{x.name}</div>
                            {x.spec ? <div className="text-[11px] text-muted-foreground">{x.spec}</div> : null}
                          </td>
                          <td className="px-2 py-1">{x.qty}</td>
                          <td className="px-2 py-1">{x.unit ?? '—'}</td>
                          <td className="px-2 py-1">%{x.vatRate}</td>
                          <td className="px-2 py-1">{x.estimatedUnitPrice ?? '—'}</td>
                          <td className="px-1 py-0.5 text-center">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                disabled={busy}
                                aria-label="Düzenle"
                                onClick={() => openItemEdit(x)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:bg-destructive/10"
                                disabled={busy}
                                aria-label="Kalemi sil"
                                onClick={() => void deleteItemRow(x.id)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-[11px] text-muted-foreground">Henüz kalem yok. Teklif ve karar önce kalemleri tanımlayın.</p>
              )}
            </CardContent>
          </Card>
          <Dialog open={!!editItemId} onOpenChange={(v) => !v && setEditItemId(null)}>
            <DialogContent className="max-w-lg" title="Kalemi düzenle">
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">Kalem adı *</div>
                  <Input
                    value={editItemForm.name}
                    onChange={(e) => setEditItemForm((s) => ({ ...s, name: e.target.value }))}
                    className={DT_INPUT_SM}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">Teknik açıklama / şartname özeti</div>
                  <textarea
                    value={editItemForm.spec}
                    onChange={(e) => setEditItemForm((s) => ({ ...s, spec: e.target.value }))}
                    className={DT_TEXTAREA_SM}
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">Miktar</div>
                    <Input
                      value={editItemForm.qty}
                      onChange={(e) => setEditItemForm((s) => ({ ...s, qty: e.target.value }))}
                      onBlur={(e) => {
                        const t = dtStripNumericTrailingZeros(e.target.value);
                        if (t !== e.target.value) setEditItemForm((s) => ({ ...s, qty: t }));
                      }}
                      className={DT_INPUT_SM}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">Birim</div>
                    <DtItemUnitSelect value={editItemForm.unit} onChange={(u) => setEditItemForm((s) => ({ ...s, unit: u }))} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[11px] text-muted-foreground">KDV %</div>
                    <Input
                      value={editItemForm.vat_rate}
                      onChange={(e) => setEditItemForm((s) => ({ ...s, vat_rate: e.target.value }))}
                      className={DT_INPUT_SM}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-[11px] text-muted-foreground">Tahmini birim fiyat (TL)</div>
                  <Input
                    value={editItemForm.estimated_unit_price}
                    onChange={(e) => setEditItemForm((s) => ({ ...s, estimated_unit_price: e.target.value }))}
                    onBlur={(e) => {
                      const t = dtStripNumericTrailingZeros(e.target.value);
                      if (t !== e.target.value) setEditItemForm((s) => ({ ...s, estimated_unit_price: t }));
                    }}
                    className={DT_INPUT_SM}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditItemId(null)} disabled={busy}>
                    Vazgeç
                  </Button>
                  <Button onClick={() => void saveItemEdit()} disabled={busy || !editItemForm.name.trim()}>
                    Kaydet
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </>
          )}

          {activeTab === 'quotes' && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Handshake className="size-4 text-sky-600" />
                  Teklifler
                  <DtInfoHint title={DT_SECTION_HINTS.quotes} />
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  {selectedQuoteIds.length > 0 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-rose-300/70 text-rose-800 hover:bg-rose-50 dark:border-rose-700/50 dark:text-rose-200 dark:hover:bg-rose-950/40"
                      disabled={busy}
                      onClick={() => setBulkDeleteOpen(true)}
                    >
                      Seçilenleri sil ({selectedQuoteIds.length})
                    </Button>
                  ) : null}
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void copyResearchQuotesToBid()}>
                    Araştırmayı teklife aktar
                  </Button>
                  <Dialog open={quoteOpen} onOpenChange={setQuoteOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={busy}>
                      Teklif ekle
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg" title="Yeni teklif kaydı">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="text-[11px] font-medium text-foreground">Amaç</div>
                        <select
                          value={quotePurpose}
                          onChange={(e) => setQuotePurpose(e.target.value as 'bid' | 'market_research')}
                          className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="bid">Teklif / ihale</option>
                          <option value="market_research">Fiyat araştırması</option>
                        </select>
                        <p className="text-[11px] leading-snug text-muted-foreground">
                          Araştırma kayıtları sol sütunda, teklif/ihale kayıtları sağ sütunda gösterilir. Özet tabloda amaç sütununu kontrol edin.
                        </p>
                      </div>
                      <div className="space-y-1">
                        <div className="text-[11px] text-muted-foreground">Firma</div>
                        <select
                          value={quoteVendorId}
                          onChange={(e) => setQuoteVendorId(e.target.value)}
                          className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="">Seçin</option>
                          {vendors.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      {createQuoteWouldDuplicate ? (
                        <p className="rounded-md border border-amber-300/70 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/35 dark:text-amber-50">
                          Bu firma ve amaç için zaten bir kayıt var. Aynı türde ikinci kayıt eklenemez; fazla satırları listeden silin.
                        </p>
                      ) : null}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setQuoteOpen(false)} disabled={busy}>
                          Vazgeç
                        </Button>
                        <Button onClick={createQuote} disabled={busy || !quoteVendorId || createQuoteWouldDuplicate}>
                          Kaydet
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-6">
              {duplicateQuoteWarnings.length ? (
                <Alert variant="warning" message={duplicateQuoteWarnings.join(' ')} />
              ) : null}
              {quotes.length ? (
                <div className="space-y-6">
                  <div className="overflow-x-auto rounded-lg border border-border bg-muted/10">
                    <div className="border-b border-border bg-muted/30 px-3 py-2 text-xs font-semibold text-foreground">
                      Özet — tüm firmalar (amaç ayrımı)
                    </div>
                    <table className="w-full min-w-[680px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/25 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          <th className="w-10 px-2 py-2 text-center">
                            <input
                              type="checkbox"
                              className="size-4 cursor-pointer accent-primary"
                              checked={allQuotesOverviewSelected}
                              onChange={toggleSelectAllQuotesOverview}
                              aria-label="Özet tabloda tümünü seç"
                            />
                          </th>
                          <th className="px-3 py-2 w-[140px]">Amaç</th>
                          <th className="px-3 py-2">Firma</th>
                          <th className="px-3 py-2 w-[120px]">Durum</th>
                          <th className="px-3 py-2 text-right w-[120px]">Fiyat girilen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {quotesOverviewSorted.map((q) => {
                          const v = vendors.find((x) => x.id === q.vendorId);
                          const pur = normalizeQuotePurpose(q.purpose);
                          const rowTint =
                            pur === 'market_research'
                              ? 'bg-amber-50/80 dark:bg-amber-950/25'
                              : 'bg-sky-50/80 dark:bg-sky-950/25';
                          const qi = quoteItems[q.id] ?? [];
                          const pricedFromApi = qi.filter((x) => String(x.unitPrice ?? '').trim() !== '').length;
                          const pricedFromDraft = items.reduce(
                            (n, it) => n + ((priceDraft[q.id]?.[it.id] ?? '').trim() ? 1 : 0),
                            0,
                          );
                          const priced = Math.max(pricedFromApi, pricedFromDraft);
                          const dupKey = `${q.vendorId}\t${pur}`;
                          const isDupRow = duplicateQuoteRowKeys.has(dupKey);
                          return (
                            <tr
                              key={`ov-${q.id}`}
                              className={cn(
                                rowTint,
                                'hover:bg-background/40',
                                isDupRow && 'outline outline-2 -outline-offset-2 outline-amber-500/90 dark:outline-amber-400/80',
                              )}
                            >
                              <td className="px-2 py-2 text-center align-middle">
                                <input
                                  type="checkbox"
                                  className="size-4 cursor-pointer accent-primary"
                                  checked={selectedQuoteIds.includes(q.id)}
                                  onChange={() => toggleQuoteRowSelect(q.id)}
                                  aria-label="Satırı seç"
                                />
                              </td>
                              <td className="px-3 py-2 align-middle">
                                {pur === 'market_research' ? (
                                  <span className="inline-flex rounded-md border border-amber-300/70 bg-amber-100/90 px-2 py-0.5 text-[10px] font-semibold text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/50 dark:text-amber-50">
                                    Araştırma
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-md border border-sky-300/70 bg-sky-100/90 px-2 py-0.5 text-[10px] font-semibold text-sky-950 dark:border-sky-700/60 dark:bg-sky-950/50 dark:text-sky-50">
                                    Teklif
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 font-bold text-foreground">{v?.title ?? q.vendorId}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={cn(
                                    'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold',
                                    dtQuoteStatusChipClass(q.status),
                                  )}
                                  title={dtQuoteStatusHint(q.status)}
                                >
                                  {dtQuoteStatusLabel(q.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                                {priced} / {items.length}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-hidden rounded-xl border-2 border-border/70 shadow-sm">
                    <div className="grid grid-cols-1 divide-y divide-border bg-muted/15 lg:grid-cols-2 lg:divide-x lg:divide-y-0">
                      <div className="bg-amber-50/95 px-3 py-2 text-xs font-bold text-amber-950 dark:bg-amber-950/45 dark:text-amber-50">
                        Fiyat araştırması
                      </div>
                      <div className="bg-sky-50/95 px-3 py-2 text-xs font-bold text-sky-950 dark:bg-sky-950/45 dark:text-sky-50 lg:border-l lg:border-border/50">
                        Teklif / ihale
                      </div>
                    </div>
                    <div className="divide-y divide-border">
                      {quoteVendorsOrdered.length === 0 ? (
                        <p className="p-6 text-center text-[11px] text-muted-foreground">Kayıt yok.</p>
                      ) : (
                        quoteVendorsOrdered.map((vendorId, rowIdx) => {
                          const qRes = quoteResearchByVendor.get(vendorId) ?? null;
                          const qBid = quoteBidByVendor.get(vendorId) ?? null;
                          const vtitle = vendors.find((x) => x.id === vendorId)?.title ?? vendorId;
                          return (
                            <div
                              key={vendorId}
                              className={cn('border-t border-border', rowIdx === 0 && 'border-t-0')}
                            >
                              <div className="bg-muted/30 px-3 py-1.5 text-center text-[11px] font-semibold text-foreground">
                                {vtitle}
                              </div>
                              <div className="grid grid-cols-1 lg:grid-cols-2">
                                <div className="border-border/60 bg-amber-50/25 p-3 dark:bg-amber-950/15 lg:border-r">
                                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                                    Araştırma
                                  </div>
                                  {vendorQuotePanel(qRes, 'Bu firmada araştırma kaydı yok.')}
                                </div>
                                <div className="bg-sky-50/25 p-3 dark:bg-sky-950/15">
                                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                                    Teklif
                                  </div>
                                  {vendorQuotePanel(qBid, 'Bu firmada teklif kaydı yok.')}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="py-4 text-center text-[11px] text-muted-foreground">Teklif yok.</p>
              )}
              <Dialog open={!!deleteQuoteId} onOpenChange={(open) => !open && setDeleteQuoteId(null)}>
                <DialogContent className="max-w-sm">
                  <div className="space-y-3">
                    <div className="flex gap-2 rounded-lg border border-rose-200/50 bg-rose-500/8 p-3 dark:border-rose-500/20 dark:bg-rose-950/25">
                      <Info className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                      <p className="text-sm text-rose-950/90 dark:text-rose-100/90">
                        <strong className="font-semibold">Teklif silinecek!</strong> Bu işlem geri alınamaz.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-3">
                      <Button variant="outline" size="sm" onClick={() => setDeleteQuoteId(null)} disabled={busy}>
                        İptal
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => deleteQuoteId && void deleteQuote(deleteQuoteId)}
                        disabled={busy}
                      >
                        Sil
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <DialogContent className="max-w-sm">
                  <div className="space-y-3">
                    <div className="flex gap-2 rounded-lg border border-rose-200/50 bg-rose-500/8 p-3 dark:border-rose-500/20 dark:bg-rose-950/25">
                      <Info className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                      <p className="text-sm text-rose-950/90 dark:text-rose-100/90">
                        <strong className="font-semibold">{selectedQuoteIds.length} teklif silinecek.</strong> İlişkili fiyat satırları ve ödemelerdeki teklif bağlantısı kaldırılır. Geri alınamaz.
                      </p>
                    </div>
                    <div className="flex justify-end gap-2 border-t pt-3">
                      <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(false)} disabled={busy}>
                        İptal
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => void deleteQuotesBulk()} disabled={busy || !selectedQuoteIds.length}>
                        Hepsini sil
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
          )}

          {activeTab === 'registry' && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="size-4 text-fuchsia-600" />
                  Evrak defteri (tarih / sayı)
                  <DtInfoHint title={DT_SECTION_HINTS.registry} />
                </CardTitle>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void saveRegistry()}>
                  Kaydet
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {officialCode ? (
                <div className="mb-3 text-[11px] text-muted-foreground">
                  Resmî yazışma kodu: <span className="font-semibold text-foreground">{officialCode}</span>
                </div>
              ) : null}
              <div className="table-x-scroll rounded-md border border-border text-xs">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5">Belge</th>
                      <th className="px-2 py-1.5 w-[170px]">Tarih</th>
                      <th className="px-2 py-1.5">Sayı (prefix)</th>
                      <th className="px-2 py-1.5 w-[120px]">Ek / no</th>
                      <th className="px-2 py-1.5 w-[140px]">Karar no</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(registryEntries.length ? registryEntries : [
                      { stage: 'ihtiyac_listesi', docDate: null, numberPrefix: null, numberSuffix: null, meta: {} },
                      { stage: 'komisyon_onay', docDate: null, numberPrefix: null, numberSuffix: null, meta: {} },
                      { stage: 'fiyat_arastirma', docDate: null, numberPrefix: null, numberSuffix: null, meta: {} },
                      { stage: 'yaklasik_maliyet', docDate: null, numberPrefix: null, numberSuffix: null, meta: {} },
                      { stage: 'ihale_onay', docDate: null, numberPrefix: null, numberSuffix: null, meta: {} },
                      { stage: 'teklif_mektubu', docDate: null, numberPrefix: null, numberSuffix: null, meta: {} },
                      { stage: 'piyasa_arastirma', docDate: null, numberPrefix: null, numberSuffix: null, meta: {} },
                      { stage: 'muayene_kabul', docDate: null, numberPrefix: null, numberSuffix: null, meta: {} },
                    ]).map((r) => {
                      const d = registryDraft[r.stage] ?? { doc_date: r.docDate ?? '', number_prefix: r.numberPrefix ?? '', number_suffix: r.numberSuffix ?? '', meta: {} };
                      const label: Record<string, string> = {
                        ihtiyac_listesi: 'İhtiyaç listesi',
                        komisyon_onay: 'Komisyon onayı',
                        fiyat_arastirma: 'Fiyat araştırması',
                        yaklasik_maliyet: 'Yaklaşık maliyet',
                        ihale_onay: 'İhale onay belgesi',
                        teklif_mektubu: 'Teklif mektubu',
                        piyasa_arastirma: 'Piyasa araştırması',
                        muayene_kabul: 'Muayene kabul',
                      };
                      return (
                        <tr key={r.stage} className="hover:bg-muted/30">
                          <td className="px-2 py-1.5 font-medium">{label[r.stage] ?? r.stage}</td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="date"
                              className="h-8 text-xs"
                              value={d.doc_date}
                              onChange={(e) =>
                                setRegistryDraft((s) => ({
                                  ...s,
                                  [r.stage]: { ...d, doc_date: e.target.value },
                                }))
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              className="h-8 text-xs"
                              placeholder="örn. 123456789-934.01"
                              value={d.number_prefix}
                              onChange={(e) =>
                                setRegistryDraft((s) => ({
                                  ...s,
                                  [r.stage]: { ...d, number_prefix: e.target.value },
                                }))
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <Input
                              className="h-8 text-xs"
                              placeholder="örn. 1"
                              value={d.number_suffix}
                              onChange={(e) =>
                                setRegistryDraft((s) => ({
                                  ...s,
                                  [r.stage]: { ...d, number_suffix: e.target.value },
                                }))
                              }
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            {r.stage === 'muayene_kabul' ? (
                              <Input
                                className="h-8 text-xs"
                                placeholder="örn. 2023/3"
                                value={d.meta?.karar_no ?? ''}
                                onChange={(e) =>
                                  setRegistryDraft((s) => ({
                                    ...s,
                                    [r.stage]: { ...d, meta: { ...(d.meta ?? {}), karar_no: e.target.value } },
                                  }))
                                }
                              />
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
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

          {activeTab === 'budget' && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Landmark className="size-4 text-amber-600" />
                  Bütçe bloke
                  <DtInfoHint title={DT_SECTION_HINTS.budget} />
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={budgetForm.budget_account_id}
                    onChange={(e) => setBudgetForm((s) => ({ ...s, budget_account_id: e.target.value }))}
                    className="h-8 rounded border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Hesap seçin</option>
                    {budgetAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a.code ? `${a.code} · ` : '') + a.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    value={budgetForm.amount}
                    onChange={(e) => setBudgetForm((s) => ({ ...s, amount: e.target.value }))}
                    className="h-8 w-[140px] px-2 py-1 text-xs"
                    placeholder="Bloke tutar"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !budgetForm.budget_account_id || !budgetForm.amount.trim()}
                    onClick={() => void blockBudget()}
                  >
                    Bloke et
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || budgetBlocks.length === 0}
                    onClick={() => setConfirmReleaseAllOpen(true)}
                  >
                    Blokeleri kaldır
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {budgetBlocks.length ? (
                <div className="table-x-scroll rounded-md border border-border text-xs">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Hesap</th>
                        <th className="px-2 py-1.5">Tutar</th>
                        <th className="px-2 py-1.5">Durum</th>
                        <th className="px-2 py-1.5 w-[1%]"> </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {budgetBlocks.map((b) => {
                        const acc = budgetAccounts.find((x) => x.id === b.budgetAccountId);
                        return (
                          <tr key={b.id} className="hover:bg-muted/30">
                            <td className="px-2 py-1">{acc ? (acc.code ? `${acc.code} · ` : '') + acc.label : b.budgetAccountId.slice(0, 8)}</td>
                            <td className="px-2 py-1">{b.amount}</td>
                            <td className="px-2 py-1">{dtBudgetBlockStatusLabel(b.status)}</td>
                            <td className="px-2 py-1 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy || b.status !== 'blocked'}
                                onClick={() => void releaseBudget(b.id)}
                              >
                                Kaldır
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-center text-[11px] text-muted-foreground">Bloke yok.</p>
              )}
            </CardContent>
          </Card>
          )}

          {activeTab === 'payments' && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Banknote className="size-4 text-lime-700 dark:text-lime-300" />
                  Ödemeler
                  <DtInfoHint title={DT_SECTION_HINTS.payments} />
                </CardTitle>
                {dtRules ? (
                  <p className="text-[10px] text-muted-foreground">
                    {dtRules.require_quote_on_payment ? 'Teklif zorunlu. ' : ''}
                    {dtRules.require_award_before_payment ? 'Karar zorunlu. ' : ''}
                    {dtRules.require_budget_account_on_file ? 'Bütçe hesabı zorunlu. ' : ''}
                    {dtRules.payment_note_min_length > 0 ? `Not min. ${dtRules.payment_note_min_length} karakter. ` : ''}
                  </p>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase">Tutar *</label>
                    <Input
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
                      className="text-xs"
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase">Teklif (Firma)</label>
                    <select
                      value={paymentForm.quote_id}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, quote_id: e.target.value }))}
                      className="w-full h-9 rounded border border-input bg-background px-2 text-xs"
                    >
                      <option value="">—</option>
                      {quotes.map((q) => {
                        const v = vendors.find((vendor) => vendor.id === q.vendorId);
                        const vn = v?.title ?? q.vendorId.slice(0, 8);
                        return (
                          <option key={q.id} value={q.id}>
                            {vn}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase">Ref No</label>
                    <Input
                      value={paymentForm.reference_no}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, reference_no: e.target.value }))}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground uppercase">Ödeme Tarihi</label>
                    <Input
                      type="date"
                      value={paymentForm.paid_at}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, paid_at: e.target.value }))}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1 border-t pt-3">
                <label className="text-[11px] font-medium text-muted-foreground uppercase">Not</label>
                <Input
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm((s) => ({ ...s, note: e.target.value }))}
                  className="text-xs"
                  placeholder="Ödeme hakkında notlar..."
                />
              </div>
              <Button
                className="w-full mt-3"
                disabled={
                  busy ||
                  !paymentForm.amount.trim() ||
                  (dtRules?.require_quote_on_payment && !paymentForm.quote_id.trim())
                }
                onClick={() => void recordPayment()}
              >
                Ödeme Kaydı Ekle
              </Button>
              {payments.length ? (
                <div className="table-x-scroll rounded-lg border border-border text-xs overflow-hidden">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/60 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2.5">Tarih</th>
                        <th className="px-3 py-2.5 text-right">Tutar</th>
                        <th className="px-3 py-2.5">Teklif</th>
                        <th className="px-3 py-2.5">Ref No</th>
                        <th className="px-3 py-2.5">Not</th>
                        <th className="px-3 py-2.5 w-[1%]"> </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payments.map((p) => {
                        const q = p.quoteId ? quotes.find((x) => x.id === p.quoteId) : null;
                        const vn = q ? vendors.find((v) => v.id === q.vendorId)?.title : null;
                        return (
                          <tr key={p.id} className="hover:bg-primary/5 transition-colors">
                            <td className="px-3 py-2 whitespace-nowrap font-medium">
                              {p.paidAt ? new Date(p.paidAt).toLocaleDateString('tr-TR') : '—'}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-green-600">{p.amount}</td>
                            <td className="px-3 py-2 text-muted-foreground">{vn ?? (p.quoteId ? p.quoteId.slice(0, 8) : '—')}</td>
                            <td className="px-3 py-2 text-muted-foreground">{p.referenceNo ?? '—'}</td>
                            <td className="px-3 py-2 text-muted-foreground truncate" title={p.note ?? ''}>{p.note ?? '—'}</td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                onClick={() => void downloadPaymentOrderPdf(p.id)}
                                title="Ödeme Emri PDF"
                              >
                                <FileDown className="size-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground py-4">Henüz ödeme kaydı yok.</p>
              )}
            </CardContent>
          </Card>
          )}

          {activeTab === 'commission' && (
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="space-y-4 border-b border-border/70 bg-gradient-to-br from-violet-500/[0.06] via-muted/15 to-transparent py-4 dark:from-violet-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-violet-600/12 text-violet-700 dark:text-violet-300">
                      <Users className="size-4" />
                    </span>
                    Komisyonlar
                    <DtInfoHint title={DT_SECTION_HINTS.commission} />
                  </CardTitle>
                  <p className="max-w-lg text-[11px] leading-relaxed text-muted-foreground">
                    Tür seçin; her biri için ayrı başkan ve üye listesi tutulur. Belgeler bu kayıtlardan üretilir.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5 border-violet-200/80 bg-background/80 dark:border-violet-800/50"
                  disabled={busy}
                  onClick={() => void syncCommissionFromApprox()}
                >
                  Yaklaşıktan kopyala
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    { id: 'yaklasik_maliyet' as const, hint: 'Fiyat araştırması ve maliyet cetveli' },
                    { id: 'piyasa_satinalma' as const, hint: 'İhale öncesi piyasa komisyonu' },
                    { id: 'muayene_kabul' as const, hint: 'Teslim ve muayene / kabul' },
                  ] as const
                ).map((k) => {
                  const active = commissionKind === k.id;
                  const created = commissionsAll.some((c) => c.kind === k.id);
                  return (
                    <button
                      key={k.id}
                      type="button"
                      disabled={busy}
                      onClick={() => setCommissionKind(k.id)}
                      className={cn(
                        'rounded-xl border px-3 py-2.5 text-left text-xs transition-all',
                        active
                          ? 'border-violet-500/90 bg-violet-500/[0.1] shadow-sm ring-2 ring-violet-500/20 dark:bg-violet-950/40'
                          : 'border-border/90 bg-background/60 hover:border-violet-300/50 hover:bg-muted/40',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[12px] font-semibold leading-tight">{COMMISSION_KIND_LABELS[k.id]}</span>
                        {created ? (
                          <CheckCircle2
                            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                            aria-label="Bu türde kayıt var"
                          />
                        ) : (
                          <span
                            className="mt-0.5 size-3.5 shrink-0 rounded-full border border-dashed border-muted-foreground/30"
                            aria-hidden
                          />
                        )}
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground leading-snug">{k.hint}</p>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                {commission ? (
                  <Dialog
                    open={commissionMemberDialogOpen}
                    onOpenChange={(o) => {
                      setCommissionMemberDialogOpen(o);
                      if (o) setCommissionTeacherQuery('');
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button type="button" size="sm" className="gap-1.5 shadow-sm" disabled={busy}>
                        <UserPlus className="size-3.5" />
                        Üye ekle
                      </Button>
                    </DialogTrigger>
                    <DialogContent title={`Üye ekle — ${COMMISSION_KIND_LABELS[commissionKind]}`} className="max-w-md sm:max-w-lg">
                      <div className="space-y-4">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Aşağıdan arayıp seçin. İsterseniz aynı kişiyi üç komisyona birden ekleyebilirsiniz.
                        </p>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Listeden seç
                          </label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={commissionTeacherQuery}
                              onChange={(e) => setCommissionTeacherQuery(e.target.value)}
                              placeholder="İsim veya e-posta…"
                              className="h-9 pl-8 text-xs"
                            />
                          </div>
                          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/80 bg-muted/10 p-1">
                            {filteredCommissionTeachers.length === 0 ? (
                              <p className="py-6 text-center text-[11px] text-muted-foreground">Eşleşen öğretmen yok.</p>
                            ) : (
                              filteredCommissionTeachers.map((t) => {
                                const picked = commissionForm.member_pick === t.id;
                                return (
                                  <button
                                    key={t.id}
                                    type="button"
                                    onClick={() =>
                                      setCommissionForm((s) => ({ ...s, member_pick: t.id, member_manual: '' }))
                                    }
                                    className={cn(
                                      'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
                                      picked
                                        ? 'bg-violet-600/15 ring-1 ring-violet-500/35 dark:bg-violet-500/15'
                                        : 'hover:bg-muted/70',
                                    )}
                                  >
                                    <span
                                      className={cn(
                                        'flex size-3.5 shrink-0 rounded-full border-2',
                                        picked ? 'border-violet-600 bg-violet-600' : 'border-muted-foreground/35',
                                      )}
                                    />
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate font-medium">
                                        {(t.display_name || t.email || t.id).slice(0, 88)}
                                      </span>
                                      {t.email ? (
                                        <span className="block truncate text-[10px] text-muted-foreground">{t.email}</span>
                                      ) : null}
                                    </span>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                        <details className="rounded-lg border border-border/70 bg-muted/15 px-2 py-1.5 text-[11px]">
                          <summary className="cursor-pointer select-none font-medium text-foreground">Gelişmiş (UUID)</summary>
                          <Input
                            value={commissionForm.member_manual}
                            onChange={(e) => setCommissionForm((s) => ({ ...s, member_manual: e.target.value }))}
                            placeholder="Kullanıcı UUID"
                            className="mt-2 text-xs"
                          />
                        </details>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Ünvan (opsiyonel)
                          </label>
                          <Input
                            value={commissionForm.member_title}
                            onChange={(e) => setCommissionForm((s) => ({ ...s, member_title: e.target.value }))}
                            placeholder="Komisyondaki ünvan"
                            className="text-xs"
                          />
                        </div>
                        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/60 bg-muted/10 px-2 py-2 text-[11px] leading-snug">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-3.5 shrink-0 accent-violet-600"
                            checked={commissionForm.apply_all_kinds}
                            onChange={(e) => setCommissionForm((s) => ({ ...s, apply_all_kinds: e.target.checked }))}
                          />
                          <span>Tüm komisyon türlerine aynı üyeyi ekle</span>
                        </label>
                        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                          <Button variant="outline" size="sm" onClick={() => setCommissionMemberDialogOpen(false)} disabled={busy}>
                            Vazgeç
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => void addCommissionMember()}
                            disabled={
                              busy || !(commissionForm.member_manual.trim() || commissionForm.member_pick.trim())
                            }
                          >
                            Ekle
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Dialog
                    open={commissionCreateDialogOpen}
                    onOpenChange={(o) => {
                      setCommissionCreateDialogOpen(o);
                      if (o) setCommissionTeacherQuery('');
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button type="button" size="sm" className="gap-1.5 shadow-sm" disabled={busy}>
                        <UserPlus className="size-3.5" />
                        {COMMISSION_KIND_LABELS[commissionKind]} — oluştur
                      </Button>
                    </DialogTrigger>
                    <DialogContent title={`Komisyon oluştur — ${COMMISSION_KIND_LABELS[commissionKind]}`} className="max-w-md sm:max-w-lg">
                      <div className="space-y-4">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Başkan seçimi zorunlu değildir; sonradan da atayabilirsiniz. Hızlı kurulum için listeden seçin.
                        </p>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Başkan (opsiyonel)
                          </label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={commissionTeacherQuery}
                              onChange={(e) => setCommissionTeacherQuery(e.target.value)}
                              placeholder="İsim veya e-posta…"
                              className="h-9 pl-8 text-xs"
                            />
                          </div>
                          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/80 bg-muted/10 p-1">
                            <button
                              type="button"
                              onClick={() => setCommissionForm((s) => ({ ...s, chairman_pick: '', chairman_manual: '' }))}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
                                !commissionForm.chairman_pick.trim() && !commissionForm.chairman_manual.trim()
                                  ? 'bg-muted/80 ring-1 ring-border'
                                  : 'hover:bg-muted/50',
                              )}
                            >
                              <span className="flex size-3.5 shrink-0 rounded-full border-2 border-muted-foreground/35" />
                              <span className="font-medium text-muted-foreground">Başkan yok (boş kur)</span>
                            </button>
                            {filteredCommissionTeachers.map((t) => {
                              const picked = commissionForm.chairman_pick === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() =>
                                    setCommissionForm((s) => ({ ...s, chairman_pick: t.id, chairman_manual: '' }))
                                  }
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
                                    picked
                                      ? 'bg-violet-600/15 ring-1 ring-violet-500/35 dark:bg-violet-500/15'
                                      : 'hover:bg-muted/70',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'flex size-3.5 shrink-0 rounded-full border-2',
                                      picked ? 'border-violet-600 bg-violet-600' : 'border-muted-foreground/35',
                                    )}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">
                                      {(t.display_name || t.email || t.id).slice(0, 88)}
                                    </span>
                                    {t.email ? (
                                      <span className="block truncate text-[10px] text-muted-foreground">{t.email}</span>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <details className="rounded-lg border border-border/70 bg-muted/15 px-2 py-1.5 text-[11px]">
                          <summary className="cursor-pointer select-none font-medium text-foreground">Gelişmiş (UUID)</summary>
                          <Input
                            value={commissionForm.chairman_manual}
                            onChange={(e) => setCommissionForm((s) => ({ ...s, chairman_manual: e.target.value }))}
                            placeholder="Başkan kullanıcı UUID"
                            className="mt-2 text-xs"
                          />
                        </details>
                        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                          <Button variant="outline" size="sm" onClick={() => setCommissionCreateDialogOpen(false)} disabled={busy}>
                            Vazgeç
                          </Button>
                          <Button size="sm" onClick={() => void createCommission()} disabled={busy}>
                            Oluştur
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {!commission ? (
                <div className="rounded-2xl border border-dashed border-violet-300/55 bg-gradient-to-br from-violet-500/[0.07] via-background to-background p-6 text-center dark:border-violet-800/45 dark:from-violet-800/15">
                  <p className="text-sm font-semibold text-foreground">{COMMISSION_KIND_LABELS[commissionKind]}</p>
                  <p className="mx-auto mt-1 max-w-sm text-[11px] leading-relaxed text-muted-foreground">
                    Bu tür için henüz kayıt yok. Öğretmen listesinden başkan seçerek veya boş kurarak devam edin; üyeleri sonradan
                    ekleyebilirsiniz.
                  </p>
                  <Button
                    type="button"
                    className="mt-4 gap-2"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      setCommissionTeacherQuery('');
                      setCommissionCreateDialogOpen(true);
                    }}
                  >
                    <UserPlus className="size-4" />
                    Kurulumu aç
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <Dialog open={commissionChairmanDialogOpen} onOpenChange={setCommissionChairmanDialogOpen}>
                    <DialogContent title={`Başkan — ${COMMISSION_KIND_LABELS[commissionKind]}`} className="max-w-md sm:max-w-lg">
                      <div className="space-y-4">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Listeden seçin veya başkanı kaldırmak için «Başkan yok» satırını işaretleyin.
                        </p>
                        <div className="space-y-2">
                          <label className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Başkan
                          </label>
                          <div className="relative">
                            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              value={commissionTeacherQuery}
                              onChange={(e) => setCommissionTeacherQuery(e.target.value)}
                              placeholder="İsim veya e-posta…"
                              className="h-9 pl-8 text-xs"
                            />
                          </div>
                          <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border/80 bg-muted/10 p-1">
                            <button
                              type="button"
                              onClick={() => setCommissionForm((s) => ({ ...s, chairman_pick: '', chairman_manual: '' }))}
                              className={cn(
                                'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
                                !commissionForm.chairman_pick.trim() && !commissionForm.chairman_manual.trim()
                                  ? 'bg-muted/80 ring-1 ring-border'
                                  : 'hover:bg-muted/50',
                              )}
                            >
                              <span className="flex size-3.5 shrink-0 rounded-full border-2 border-muted-foreground/35" />
                              <span className="font-medium text-muted-foreground">Başkan yok</span>
                            </button>
                            {filteredCommissionTeachers.map((t) => {
                              const picked = commissionForm.chairman_pick === t.id;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() =>
                                    setCommissionForm((s) => ({ ...s, chairman_pick: t.id, chairman_manual: '' }))
                                  }
                                  className={cn(
                                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors',
                                    picked
                                      ? 'bg-violet-600/15 ring-1 ring-violet-500/35 dark:bg-violet-500/15'
                                      : 'hover:bg-muted/70',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'flex size-3.5 shrink-0 rounded-full border-2',
                                      picked ? 'border-violet-600 bg-violet-600' : 'border-muted-foreground/35',
                                    )}
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate font-medium">
                                      {(t.display_name || t.email || t.id).slice(0, 88)}
                                    </span>
                                    {t.email ? (
                                      <span className="block truncate text-[10px] text-muted-foreground">{t.email}</span>
                                    ) : null}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <details className="rounded-lg border border-border/70 bg-muted/15 px-2 py-1.5 text-[11px]">
                          <summary className="cursor-pointer select-none font-medium text-foreground">Gelişmiş (UUID)</summary>
                          <Input
                            value={commissionForm.chairman_manual}
                            onChange={(e) => setCommissionForm((s) => ({ ...s, chairman_manual: e.target.value }))}
                            placeholder="Başkan kullanıcı UUID"
                            className="mt-2 text-xs"
                          />
                        </details>
                        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                          <Button variant="outline" size="sm" onClick={() => setCommissionChairmanDialogOpen(false)} disabled={busy}>
                            Vazgeç
                          </Button>
                          <Button size="sm" onClick={() => void saveCommissionChairman()} disabled={busy}>
                            Kaydet
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3 dark:border-emerald-700/30 dark:bg-emerald-950/25">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                        Aktif — {COMMISSION_KIND_LABELS[commissionKind]}
                      </span>
                      <span className="rounded-md bg-background/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {commission.id.slice(0, 10)}…
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm text-foreground">
                        Başkan:{' '}
                        <span className="font-semibold">
                          {commission.chairmanUserId ? (
                            commissionTeachers.find((t) => t.id === commission.chairmanUserId)?.display_name?.trim() ||
                            `${commission.chairmanUserId.slice(0, 8)}…`
                          ) : (
                            <span className="font-normal text-muted-foreground">atanmadı</span>
                          )}
                        </span>
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-[10px]"
                        disabled={busy}
                        onClick={() => {
                          setCommissionTeacherQuery('');
                          setCommissionForm((s) => ({
                            ...s,
                            chairman_pick: commission.chairmanUserId || '',
                            chairman_manual: '',
                          }));
                          setCommissionChairmanDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3" />
                        Düzenle
                      </Button>
                    </div>
                  </div>
                  {commissionMembers.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-border/80">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/50 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2 text-left">Üye</th>
                            <th className="px-3 py-2 text-left">Ünvan</th>
                            <th className="w-10 px-2 py-2" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {commissionMembers.map((m) => (
                            <tr key={m.id} className="hover:bg-muted/25">
                              <td className="px-3 py-2 font-medium">
                                {commissionTeachers.find((t) => t.id === m.userId)?.display_name?.trim() ||
                                  `${m.userId.slice(0, 8)}…`}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">{m.title || '—'}</td>
                              <td className="px-2 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                  disabled={busy}
                                  onClick={() => void removeCommissionMemberRow(m.id)}
                                  aria-label="Kaldır"
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border py-6 text-center text-[11px] text-muted-foreground">
                      Henüz üye yok. «Üye ekle» ile listeden seçin.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {activeTab === 'docs' && (
          <Card>
            <CardHeader className="py-3 space-y-2">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileStack className="size-4 text-slate-600" />
                  Belgeler
                  <DtInfoHint title={DT_SECTION_HINTS.docs} />
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={docFormat}
                    onChange={(e) => setDocFormat(e.target.value as 'docx' | 'pdf')}
                    className="h-8 rounded border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="docx">DOCX</option>
                    <option value="pdf">PDF</option>
                  </select>
                  <select
                    value={docVendorId}
                    onChange={(e) => setDocVendorId(e.target.value)}
                    className="h-8 rounded border border-input bg-background px-2 py-1 text-xs"
                  >
                    <option value="">Firma (ops.)</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('ihtiyac_listesi')}>
                    İhtiyaç listesi
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !docVendorId}
                    onClick={() => void generateDoc('fiyat_arastirmasi', docVendorId)}
                  >
                    Fiyat araştırması
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !docVendorId}
                    onClick={() => void generateDoc('teklif_isteme', docVendorId)}
                  >
                    Teklif mektubu
                  </Button>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('karar')}>
                    Karar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || !docVendorId || docFormat === 'pdf'}
                    onClick={() => void generateDoc('sozlesme', docVendorId)}
                  >
                    Sözleşme
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('komisyon_onay')}>
                  Komisyon onay
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('onay_belgesi')}>
                  Onay belgesi
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('piyasa_arastirma_tutanagi')}>
                  Piyasa tutanağı
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('yaklasik_maliyet_cetveli')}>
                  Yaklaşık maliyet cetveli
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('muayene_kabul_tutanagi')}>
                  Muayene kabul
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('teknik_sartname')}>
                  Teknik şartname
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('teslim_tesellum_tutanagi')}>
                  Teslim/tesellüm
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {docs.length ? (
                <div className="table-x-scroll rounded-md border border-border text-xs">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Tür</th>
                        <th className="px-2 py-1.5">Dosya</th>
                        <th className="px-2 py-1.5 w-[1%]"> </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {docs.map((d) => (
                        <tr key={d.id} className="hover:bg-muted/30">
                          <td className="px-2 py-1">{dtDocTypeLabel(d.docType)}</td>
                          <td className="px-2 py-1">{d.filename}</td>
                          <td className="px-2 py-1 text-right">
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => void downloadDoc(d.id)}>
                              İndir
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-4 text-center text-[11px] text-muted-foreground">Belge yok.</p>
              )}
            </CardContent>
          </Card>
          )}

          {activeTab === 'archive' && (
            <Card className="overflow-hidden border-rose-200/40 shadow-sm dark:border-rose-900/30">
              <CardHeader className="border-b border-rose-500/10 bg-gradient-to-r from-rose-500/10 to-amber-500/8 py-3">
                <CardTitle className="flex items-center gap-2 text-sm text-rose-900 dark:text-rose-100">
                  <FolderArchive className="size-4 shrink-0" />
                  Modül arşivi ve paylaşım
                  <DtInfoHint title={DT_SECTION_HINTS.archive} />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                {file.archivedAt ? (
                  <div className="rounded-lg border border-rose-300/50 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-950 dark:border-rose-800/60 dark:bg-rose-950/20 dark:text-rose-50">
                    Bu kayıt arşivde. Liste görünümünde gizlenir; arşiv filtresiyle erişilir.
                  </div>
                ) : (
                  <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] text-muted-foreground">
                    Dosyayı arşivlediğinizde varsayılan listeden kalkar; buradan geri alabilir veya kopyalayabilirsiniz.
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {file.archivedAt ? (
                    <Button type="button" size="sm" variant="default" disabled={busy} onClick={() => void unarchive()}>
                      Arşivden çıkar
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmArchiveOpen(true)}>
                      <Archive className="mr-1 size-3.5" /> Arşivle
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setCopyOpen(true)}>
                    <Copy className="mr-1 size-3.5" /> Kopyala
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void copyShareLink()}>
                    <Share2 className="mr-1 size-3.5" /> Bağlantı kopyala
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={mailShareLink}>
                    <Mail className="mr-1 size-3.5" /> E-posta gönder
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setActiveTab('registry')}>
                    Evrak düzenle
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setActiveTab('items')}>
                    Kalemler
                  </Button>
                </div>
                <div>
                  <div className="mb-2 text-[11px] font-semibold text-foreground">Okul arşivindeki diğer dosyalar</div>
                  {archiveListLoading ? (
                    <LoadingSpinner label="Arşiv yükleniyor…" className="py-6 text-xs" />
                  ) : archiveList.length ? (
                    <div className="max-h-[min(50vh,320px)] overflow-auto rounded-lg border border-border text-[11px]">
                      <table className="w-full min-w-[280px] text-left">
                        <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
                          <tr className="border-b border-border text-[10px] font-semibold uppercase text-muted-foreground">
                            <th className="px-2 py-1.5">Yıl / No</th>
                            <th className="px-2 py-1.5">Konu</th>
                            <th className="px-2 py-1.5 w-[1%]" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {archiveList.map((a) => (
                            <tr key={a.id} className={a.id === id ? 'bg-rose-500/10' : 'hover:bg-muted/40'}>
                              <td className="px-2 py-1.5 whitespace-nowrap">
                                {a.year} · {a.fileNo}
                              </td>
                              <td className="px-2 py-1.5">{a.subject}</td>
                              <td className="px-2 py-1.5 text-right">
                                <Link
                                  href={
                                    isSuperadmin && schoolId
                                      ? `/dogrudan-temin/${a.id}?school_id=${encodeURIComponent(schoolId)}`
                                      : `/dogrudan-temin/${a.id}`
                                  }
                                  className="text-primary hover:underline"
                                >
                                  Aç
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed border-border/70 py-6 text-center text-[11px] text-muted-foreground">
                      Arşivde başka dosya yok.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <p className="py-10 text-center text-[11px] text-muted-foreground">Dosya bulunamadı.</p>
      )}

      <Dialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
        <DialogContent title="Dosyayı arşive al">
          <p className="text-sm text-muted-foreground">
            Arşivlenen dosya varsayılan listede gizlenir. Arşiv dahil filtresiyle tekrar bulunabilir.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setConfirmArchiveOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                setConfirmArchiveOpen(false);
                await archive();
              }}
            >
              Arşivle
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReleaseAllOpen} onOpenChange={setConfirmReleaseAllOpen}>
        <DialogContent title="Tüm bütçe blokelerini kaldır">
          <p className="text-sm text-muted-foreground">
            Bu dosyaya ait tüm aktif blokeler serbest bırakılır. Devam etmeden önce mali işler biriminizle uyumlu olduğundan emin olun.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setConfirmReleaseAllOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setConfirmReleaseAllOpen(false);
                await releaseBudget();
              }}
            >
              Tümünü kaldır
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmAutoAwardOpen} onOpenChange={setConfirmAutoAwardOpen}>
        <DialogContent title="Otomatik karar">
          <p className="text-sm text-muted-foreground">
            Her kalem için girilmiş teklif fiyatları arasından en düşük birim fiyatı kabul olarak işaretlenir. Mevzuat ve kurum içi karar sürecinize aykırı olmadığını kontrol edin.
          </p>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setConfirmAutoAwardOpen(false)} disabled={busy}>
              Vazgeç
            </Button>
            <Button
              type="button"
              disabled={busy || items.length === 0}
              onClick={async () => {
                setConfirmAutoAwardOpen(false);
                await autoAward();
              }}
            >
              Uygula
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

