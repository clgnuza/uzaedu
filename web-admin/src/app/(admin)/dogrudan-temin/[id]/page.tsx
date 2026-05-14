'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/lib/api';
import { dtUrl } from '@/lib/dt-url';
import { Toolbar, ToolbarActions, ToolbarHeading, ToolbarPageTitle } from '@/components/layout/toolbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Alert } from '@/components/ui/alert';
import { ForbiddenView } from '@/components/errors/forbidden-view';
import {
  ClipboardList,
  ChevronLeft,
  Copy,
  FileDown,
  Sparkles,
  Archive,
  Banknote,
  Users,
  PackageSearch,
  Handshake,
  Landmark,
  FileStack,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import {
  DT_DETAIL_TABS,
  DT_LEGAL_NOTICE,
  DT_SECTION_HINTS,
  type DtDetailTabId,
  dtBudgetBlockStatusLabel,
  dtDocTypeLabel,
  dtFileStatusBadgeClass,
  dtFileStatusLabel,
  dtQuoteStatusChipClass,
  dtQuoteStatusHint,
  dtQuoteStatusLabel,
  dtTeminTypeLabel,
} from '@/lib/dt-ui';
import { DtInfoHint } from '@/components/dogrudan-temin/dt-info-hint';

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

type VendorItem = { id: string; title: string };
type Quote = { id: string; vendorId: string; status: string; purpose?: string };
type QuoteItem = { id: string; quoteId: string; dtItemId: string; unitPrice: string };
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

type RegistryEntry = {
  stage: string;
  docDate: string | null;
  numberPrefix: string | null;
  numberSuffix: string | null;
  meta: Record<string, unknown>;
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
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<DtFileItem | null>(null);
  const [items, setItems] = useState<DtItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyForm, setCopyForm] = useState({ target_year: '', file_no: '' });
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteVendorId, setQuoteVendorId] = useState('');
  const [activeQuoteId, setActiveQuoteId] = useState<string>('');
  const [quoteItems, setQuoteItems] = useState<Record<string, QuoteItem[]>>({});
  const [priceDraft, setPriceDraft] = useState<Record<string, Record<string, string>>>({});
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [docVendorId, setDocVendorId] = useState('');
  const [docFormat, setDocFormat] = useState<'docx' | 'pdf'>('docx');
  const [registryEntries, setRegistryEntries] = useState<RegistryEntry[]>([]);
  const [registryDraft, setRegistryDraft] = useState<Record<string, { doc_date: string; number_prefix: string; number_suffix: string }>>({});
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
  const [commission, setCommission] = useState<DtAcceptanceCommission | null>(null);
  const [commissionMembers, setCommissionMembers] = useState<DtAcceptanceCommissionMember[]>([]);
  const [activeTab, setActiveTab] = useState<DtDetailTabId>('items');
  const [commissionForm, setCommissionForm] = useState({ chairman_user_id: '', member_title: '' });
  const [commissionDialogOpen, setCommissionDialogOpen] = useState(false);
  const [commissionKind, setCommissionKind] = useState<'muayene_kabul' | 'yaklasik_maliyet' | 'piyasa_satinalma'>('muayene_kabul');
  const [procurementRefDraft, setProcurementRefDraft] = useState('');
  const [quotePurpose, setQuotePurpose] = useState<'bid' | 'market_research'>('bid');
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [confirmReleaseAllOpen, setConfirmReleaseAllOpen] = useState(false);
  const [confirmAutoAwardOpen, setConfirmAutoAwardOpen] = useState(false);

  const tabIcons: Record<DtDetailTabId, LucideIcon> = {
    items: PackageSearch,
    quotes: Handshake,
    registry: FileText,
    budget: Landmark,
    payments: Banknote,
    commission: Users,
    docs: FileStack,
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
    setError(null);
    try {
      const [f, it, v, q, d, rulesRes, payRes, commRes, regRes] = await Promise.all([
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
      setRegistryDraft(() => {
        const next: Record<string, { doc_date: string; number_prefix: string; number_suffix: string }> = {};
        (regRes.entries ?? []).forEach((r) => {
          next[r.stage] = {
            doc_date: r.docDate ?? '',
            number_prefix: r.numberPrefix ?? '',
            number_suffix: r.numberSuffix ?? '',
          };
        });
        return next;
      });
      const firstQuote = (q.items ?? [])[0]?.id ?? '';
      setActiveQuoteId((cur) => cur || firstQuote);

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
      setError(e instanceof Error ? e.message : 'Yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [canFetch, commissionKind, id, me?.role, schoolId, token]);

  const blockBudget = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    if (!budgetForm.budget_account_id) {
      toast.error('Önce bütçe hesabı seçin.');
      return;
    }
    const amt = Number(String(budgetForm.amount).replace(',', '.'));
    if (!budgetForm.amount.trim() || !Number.isFinite(amt) || amt <= 0) {
      toast.error('Bloke tutarı pozitif bir sayı olmalı.');
      return;
    }
    setBusy(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [budgetForm.amount, budgetForm.budget_account_id, fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const releaseBudget = useCallback(
    async (block_id?: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setError(null);
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
        setError(e instanceof Error ? e.message : 'Hata');
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
    setError(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/awards/auto`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ mode: 'per_item_lowest' }),
      });
      await fetchAll();
      toast.success('Otomatik karar uygulandı (kalem bazında en düşük teklif).');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const generateDoc = useCallback(
    async (doc_type: string, vendor_id?: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setError(null);
      try {
        const res = await apiFetch<{ download_url: string }>(dtUrl(`/dogrudan-temin/files/${id}/docs/generate`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({ doc_type, file_format: docFormat, ...(vendor_id ? { vendor_id } : {}) }),
        });
        if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
        await fetchAll();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Hata');
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
      setError(null);
      try {
        const res = await apiFetch<{ download_url: string }>(dtUrl(`/dogrudan-temin/docs/${docId}/download`, me?.role, schoolId), { token });
        if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Hata');
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
    setError(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/items`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          name: itemForm.name,
          spec: itemForm.spec || null,
          qty: itemForm.qty,
          unit: itemForm.unit || null,
          vat_rate: Number(itemForm.vat_rate || 20),
          estimated_unit_price: itemForm.estimated_unit_price || null,
        }),
      });
      setAddOpen(false);
      setItemForm({ name: '', spec: '', qty: '1', unit: '', vat_rate: '20', estimated_unit_price: '' });
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, itemForm.estimated_unit_price, itemForm.name, itemForm.qty, itemForm.spec, itemForm.unit, itemForm.vat_rate, me?.role, schoolId, token]);

  const archive = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/archive`, me?.role, schoolId), { token, method: 'POST' });
      await fetchAll();
      toast.success('Dosya arşivlendi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const copyFile = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
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
      setError(e instanceof Error ? e.message : 'Hata');
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
    setBusy(true);
    setError(null);
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
      toast.success('Teklif kaydı oluşturuldu.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, quotePurpose, quoteVendorId, schoolId, token, vendors.length]);

  const copyResearchQuotesToBid = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ created: number }>(
        dtUrl(`/dogrudan-temin/files/${id}/quotes/copy-research-to-bid`, me?.role, schoolId),
        { token, method: 'POST', body: '{}' },
      );
      toast.success(`Kopyalandı: ${res.created ?? 0} teklif`);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const syncCommissionFromApprox = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/commissions/sync`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({ from_kind: 'yaklasik_maliyet', to_kinds: ['piyasa_satinalma', 'muayene_kabul'] }),
      });
      toast.success('Komisyon üyeleri kopyalandı.');
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const saveProcurementRef = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}`, me?.role, schoolId), {
        token,
        method: 'PATCH',
        body: JSON.stringify({ procurement_ref: procurementRefDraft.trim() || null }),
      });
      toast.success('İhale kayıt no güncellendi.');
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, procurementRefDraft, schoolId, token]);

  const saveRegistry = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      const entries = Object.entries(registryDraft).map(([stage, v]) => ({
        stage,
        doc_date: v.doc_date.trim() || null,
        number_prefix: v.number_prefix.trim() || null,
        number_suffix: v.number_suffix.trim() || null,
        meta: {},
      }));
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/document-registry`, me?.role, schoolId), {
        token,
        method: 'PUT',
        body: JSON.stringify({ entries }),
      });
      toast.success('Belge tarih/sayı kaydedildi.');
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [fetchAll, id, isSuperadmin, me?.role, registryDraft, schoolId, token]);

  const fetchQuoteItems = useCallback(
    async (qid: string) => {
      if (!token || !qid) return;
      if (isSuperadmin && !schoolId) return;
      if (quoteItems[qid]) return;
      const res = await apiFetch<{ items: QuoteItem[] }>(dtUrl(`/dogrudan-temin/quotes/${qid}/items`, me?.role, schoolId), { token });
      setQuoteItems((s) => ({ ...s, [qid]: res.items ?? [] }));
      const map: Record<string, string> = {};
      (res.items ?? []).forEach((x) => {
        map[x.dtItemId] = x.unitPrice;
      });
      setPriceDraft((s) => ({ ...s, [qid]: { ...(s[qid] ?? {}), ...map } }));
    },
    [isSuperadmin, me?.role, quoteItems, schoolId, token],
  );

  useEffect(() => {
    if (activeQuoteId) void fetchQuoteItems(activeQuoteId);
  }, [activeQuoteId, fetchQuoteItems]);

  const saveQuotePrice = useCallback(
    async (qid: string, dtItemId: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      const unit_price = priceDraft[qid]?.[dtItemId];
      if (!unit_price || !unit_price.trim()) return;
      setBusy(true);
      setError(null);
      try {
        await apiFetch(dtUrl(`/dogrudan-temin/quotes/${qid}/items`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({ dt_item_id: dtItemId, unit_price }),
        });
        setQuoteItems((s) => {
          const next = { ...s };
          delete next[qid];
          return next;
        });
        await fetchQuoteItems(qid);
        toast.success('Birim fiyat kaydedildi.');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Hata');
      } finally {
        setBusy(false);
      }
    },
    [fetchQuoteItems, isSuperadmin, me?.role, priceDraft, schoolId, token],
  );

  const recordPayment = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    if (!paymentForm.amount.trim()) {
      toast.error('Ödeme tutarını girin.');
      return;
    }
    const payAmt = Number(String(paymentForm.amount).replace(',', '.'));
    if (!Number.isFinite(payAmt) || payAmt <= 0) {
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
    setError(null);
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
      setError(e instanceof Error ? e.message : 'Hata');
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

  const createCommission = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}/commission`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          chairman_user_id: commissionForm.chairman_user_id.trim() || null,
          dt_file_id: id,
          kind: commissionKind,
        }),
      });
      setCommissionForm({ chairman_user_id: '', member_title: '' });
      setCommissionDialogOpen(false);
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [commissionForm.chairman_user_id, commissionKind, fetchAll, id, isSuperadmin, me?.role, schoolId, token]);

  const addCommissionMember = useCallback(async () => {
    if (!token || !commission) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/commission/${commission.id}/members`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          user_id: commissionForm.chairman_user_id.trim(),
          title: commissionForm.member_title.trim() || null,
        }),
      });
      setCommissionForm({ chairman_user_id: '', member_title: '' });
      await fetchAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [commission, fetchAll, isSuperadmin, me?.role, schoolId, token, commissionForm.chairman_user_id, commissionForm.member_title]);

  const downloadPaymentOrderPdf = useCallback(async (paymentId: string) => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ buffer: string; filename: string }>(
        dtUrl(`/dogrudan-temin/files/${id}/payments/${paymentId}/order-pdf`, me?.role, schoolId),
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
      setError(e instanceof Error ? e.message : 'Hata');
    } finally {
      setBusy(false);
    }
  }, [id, isSuperadmin, me?.role, schoolId, token]);

  if (!ok) return <ForbiddenView description="Bu okulda Doğrudan Temin modülü kapalı." />;

  return (
    <div className="space-y-3 text-xs">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle className="text-base">Doğrudan temin dosyası</ToolbarPageTitle>
        </ToolbarHeading>
        {isSuperadmin ? (
          <ToolbarActions>
            <div className="w-[320px] max-w-[60vw]">
              <SchoolSelectWithFilter value={schoolId} onChange={setSchool} token={token} />
            </div>
          </ToolbarActions>
        ) : null}
      </Toolbar>

      <div className="flex items-center gap-2 text-[11px]">
        <Link
          href={isSuperadmin && schoolId ? `/dogrudan-temin?school_id=${encodeURIComponent(schoolId)}` : '/dogrudan-temin'}
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <ChevronLeft className="size-3.5" /> Dosyalar
        </Link>
      </div>

      {error && <Alert message={error} />}
      {loading ? (
        <LoadingSpinner label="Yükleniyor…" className="py-10 text-xs" />
      ) : file ? (
        <>
          <Card className="border-primary/15 bg-gradient-to-br from-background to-muted/20">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-base mb-2">
                    <ClipboardList className="size-5 text-primary" />
                    {file.subject}
                  </CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-1 rounded text-[10px] font-semibold ${dtFileStatusBadgeClass(file.status)}`}>
                      {dtFileStatusLabel(file.status)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{file.year}</span>
                    <span className="text-[11px] text-muted-foreground">#{file.fileNo}</span>
                    <span className="text-[11px] font-medium text-foreground">{dtTeminTypeLabel(file.teminType)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    title="Arşivle"
                    disabled={busy}
                    onClick={() => setConfirmArchiveOpen(true)}
                  >
                    <Archive className="size-4" />
                  </Button>
                  <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" title="Dosyayı kopyala" disabled={busy}>
                        <Copy className="size-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg" title="Dosyayı kopyala">
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">Hedef yıl (opsiyonel)</div>
                            <Input value={copyForm.target_year} onChange={(e) => setCopyForm((s) => ({ ...s, target_year: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">Yeni dosya no (opsiyonel)</div>
                            <Input value={copyForm.file_no} onChange={(e) => setCopyForm((s) => ({ ...s, file_no: e.target.value }))} />
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
              <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t">
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                    Yaklaşık maliyet
                    <DtInfoHint title="Kalemler üzerinden hesaplanan tahmini toplam; onay belgesi ve piyasa araştırması ile tutarlı olmalı." />
                  </div>
                  <div className="text-lg font-semibold">{file.approxTotal ?? '—'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                    Karar tutarı
                    <DtInfoHint title="İhale/karar belgesine yansıyan toplam tutar (kararlandıktan sonra)." />
                  </div>
                  <div className="text-lg font-semibold">{file.decisionTotal ?? '—'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground flex items-center gap-1">
                    Ödenen
                    <DtInfoHint title="Bu dosyaya kayıtlı ödemelerin toplamı." />
                  </div>
                  <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">{file.paymentTotal ?? '—'}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
                <span className="text-[11px] text-muted-foreground">İhale kayıt no</span>
                <Input
                  value={procurementRefDraft}
                  onChange={(e) => setProcurementRefDraft(e.target.value)}
                  className="h-8 max-w-[220px] text-xs"
                  placeholder="örn. 2025/12"
                />
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void saveProcurementRef()}>
                  Kaydet
                </Button>
              </div>
            </CardHeader>
          </Card>

          <Alert variant="info" message={DT_LEGAL_NOTICE} />

          {dtRules?.platform_notice_tr?.trim() ? (
            <Alert variant="warning" message={dtRules.platform_notice_tr.trim()} />
          ) : null}

          <div className="rounded-lg border border-border/80 bg-muted/10 p-1.5">
            <div className="flex gap-1 overflow-x-auto">
              {DT_DETAIL_TABS.map((tab) => {
                const Icon = tabIcons[tab.id];
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    title={tab.shortHint}
                    className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium border-2 transition-colors whitespace-nowrap ${
                      active ? tab.activeClass : tab.inactiveClass
                    }`}
                  >
                    <Icon className="size-4 shrink-0 opacity-90" />
                    {tab.label}
                    <DtInfoHint title={tab.shortHint} className="opacity-70" />
                  </button>
                );
              })}
            </div>
            <p className="mt-2 px-2 text-[11px] text-muted-foreground border-t border-border/60 pt-2">{DT_SECTION_HINTS[activeTab]}</p>
          </div>

          {activeTab === 'items' && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PackageSearch className="size-4 text-emerald-600" />
                  İhtiyaç listesi
                  <DtInfoHint title={DT_SECTION_HINTS.items} />
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Dialog open={addOpen} onOpenChange={setAddOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={busy}>
                        Kalem ekle
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg" title="Kalem ekle">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            Kalem adı
                            <DtInfoHint title="Satın alınacak mal veya hizmetin kısa adı." />
                          </div>
                          <Input value={itemForm.name} onChange={(e) => setItemForm((s) => ({ ...s, name: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground">Teknik açıklama / şartname özeti</div>
                          <textarea
                            value={itemForm.spec}
                            onChange={(e) => setItemForm((s) => ({ ...s, spec: e.target.value }))}
                            className="min-h-[90px] w-full rounded-lg border border-input bg-background px-4 py-2 text-foreground transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-primary/30"
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">Miktar</div>
                            <Input value={itemForm.qty} onChange={(e) => setItemForm((s) => ({ ...s, qty: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">Birim</div>
                            <Input value={itemForm.unit} onChange={(e) => setItemForm((s) => ({ ...s, unit: e.target.value }))} />
                          </div>
                          <div className="space-y-1">
                            <div className="text-[11px] text-muted-foreground">KDV %</div>
                            <Input value={itemForm.vat_rate} onChange={(e) => setItemForm((s) => ({ ...s, vat_rate: e.target.value }))} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                            Tahmini birim fiyat (TL)
                            <DtInfoHint title="Piyasa araştırması sonucu; KDV hariç veya kurumunuza göre — tutarlılığı kontrol edin." />
                          </div>
                          <Input value={itemForm.estimated_unit_price} onChange={(e) => setItemForm((s) => ({ ...s, estimated_unit_price: e.target.value }))} />
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
                  <table className="w-full min-w-[820px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Kalem</th>
                        <th className="px-2 py-1.5">Miktar</th>
                        <th className="px-2 py-1.5">Birim</th>
                        <th className="px-2 py-1.5">KDV</th>
                        <th className="px-2 py-1.5">Tahmini BF</th>
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
                        <div className="text-[11px] text-muted-foreground">Amaç</div>
                        <select
                          value={quotePurpose}
                          onChange={(e) => setQuotePurpose(e.target.value as 'bid' | 'market_research')}
                          className="mt-0.5 w-full rounded border border-input bg-background px-2 py-1 text-xs"
                        >
                          <option value="bid">Teklif / ihale</option>
                          <option value="market_research">Fiyat araştırması</option>
                        </select>
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
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setQuoteOpen(false)} disabled={busy}>
                          Vazgeç
                        </Button>
                        <Button onClick={createQuote} disabled={busy || !quoteVendorId}>
                          Kaydet
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {quotes.length ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {quotes.map((q) => {
                      const v = vendors.find((x) => x.id === q.vendorId);
                      const active = q.id === activeQuoteId;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setActiveQuoteId(q.id)}
                          className={`rounded-md border px-2 py-1 text-[11px] font-medium flex flex-wrap items-center gap-1.5 ${
                            active
                              ? 'border-primary/40 bg-primary/5 text-primary'
                              : 'border-border bg-background hover:bg-muted/40'
                          }`}
                        >
                          <span>{v?.title ?? q.vendorId.slice(0, 8)}</span>
                          {q.purpose === 'market_research' ? (
                            <span className="rounded px-1 py-0.5 text-[9px] font-semibold border border-slate-300 bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100">
                              Araştırma
                            </span>
                          ) : null}
                          <span
                            className={`rounded px-1 py-0.5 text-[9px] font-semibold border ${dtQuoteStatusChipClass(q.status)}`}
                            title={dtQuoteStatusHint(q.status)}
                          >
                            {dtQuoteStatusLabel(q.status)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeQuoteId ? (
                    <div className="table-x-scroll rounded-md border border-border text-xs">
                      <table className="w-full min-w-[720px] text-left">
                        <thead>
                          <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-1.5">Kalem</th>
                            <th className="px-2 py-1.5">Miktar</th>
                            <th className="px-2 py-1.5">Birim fiyat</th>
                            <th className="px-2 py-1.5 w-[1%]"> </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {items.map((it) => (
                            <tr key={it.id} className="hover:bg-muted/30">
                              <td className="px-2 py-1">
                                <div className="font-medium">{it.name}</div>
                                {it.spec ? <div className="text-[11px] text-muted-foreground">{it.spec}</div> : null}
                              </td>
                              <td className="px-2 py-1">{it.qty}</td>
                              <td className="px-2 py-1">
                                <Input
                                  value={priceDraft[activeQuoteId]?.[it.id] ?? ''}
                                  onChange={(e) =>
                                    setPriceDraft((s) => ({
                                      ...s,
                                      [activeQuoteId]: { ...(s[activeQuoteId] ?? {}), [it.id]: e.target.value },
                                    }))
                                  }
                                  className="h-8 w-[140px] px-2 py-1 text-xs"
                                  placeholder="0.00"
                                />
                              </td>
                              <td className="px-2 py-1 text-right">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy || !(priceDraft[activeQuoteId]?.[it.id] ?? '').trim()}
                                  onClick={() => void saveQuotePrice(activeQuoteId, it.id)}
                                >
                                  Kaydet
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="py-4 text-center text-[11px] text-muted-foreground">Teklif yok.</p>
              )}
            </CardContent>
          </Card>
          )}

          {activeTab === 'registry' && (
          <Card>
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <FileText className="size-4 text-fuchsia-600" />
                  Belge tarih ve sayısı
                  <DtInfoHint title={DT_SECTION_HINTS.registry} />
                </CardTitle>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => void saveRegistry()}>
                  Kaydet
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="table-x-scroll rounded-md border border-border text-xs">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="px-2 py-1.5">Belge</th>
                      <th className="px-2 py-1.5 w-[170px]">Tarih</th>
                      <th className="px-2 py-1.5">Sayı (prefix)</th>
                      <th className="px-2 py-1.5 w-[120px]">Ek / no</th>
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
                      const d = registryDraft[r.stage] ?? { doc_date: r.docDate ?? '', number_prefix: r.numberPrefix ?? '', number_suffix: r.numberSuffix ?? '' };
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
          <Card>
            <CardHeader className="py-3 space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="size-4 text-violet-600" />
                  Komisyonlar
                  <DtInfoHint title={DT_SECTION_HINTS.commission} />
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={commissionKind}
                    onChange={(e) => setCommissionKind(e.target.value as typeof commissionKind)}
                    className="h-8 rounded border border-input bg-background px-2 text-xs"
                  >
                    <option value="yaklasik_maliyet">Yaklaşık maliyet</option>
                    <option value="piyasa_satinalma">Piyasa / satın alma</option>
                    <option value="muayene_kabul">Muayene / kabul</option>
                  </select>
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void syncCommissionFromApprox()}>
                    Yaklaşıktan kopyala
                  </Button>
                {commission ? (
                  <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={busy}>
                        Üye Ekle
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground uppercase">Kullanıcı ID</label>
                          <Input
                            value={commissionForm.chairman_user_id}
                            onChange={(e) => setCommissionForm((s) => ({ ...s, chairman_user_id: e.target.value }))}
                            placeholder="Üye UUID"
                            className="text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground uppercase">Ünvan (Opsiyonel)</label>
                          <Input
                            value={commissionForm.member_title}
                            onChange={(e) => setCommissionForm((s) => ({ ...s, member_title: e.target.value }))}
                            placeholder="Üye Ünvanı"
                            className="text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setCommissionDialogOpen(false)} disabled={busy}>
                            Vazgeç
                          </Button>
                          <Button onClick={addCommissionMember} disabled={busy || !commissionForm.chairman_user_id.trim()}>
                            Üye Ekle
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                ) : (
                  <Dialog open={commissionDialogOpen} onOpenChange={setCommissionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" disabled={busy}>
                        Komisyon Oluştur
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[11px] font-medium text-muted-foreground uppercase">Başkan Kullanıcı ID (Opsiyonel)</label>
                          <Input
                            value={commissionForm.chairman_user_id}
                            onChange={(e) => setCommissionForm((s) => ({ ...s, chairman_user_id: e.target.value }))}
                            placeholder="Başkan UUID"
                            className="text-xs"
                          />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" onClick={() => setCommissionDialogOpen(false)} disabled={busy}>
                            Vazgeç
                          </Button>
                          <Button onClick={createCommission} disabled={busy}>
                            Oluştur
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {commission ? (
                <div className="text-[11px] space-y-2">
                  <div className="rounded border border-border bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800 p-2">
                    <div className="font-medium text-[11px] mb-1">Durumu</div>
                    <p className="text-sm">Komisyon ID: <code className="bg-muted px-1 py-0.5 rounded">{commission.id.slice(0, 12)}...</code></p>
                    {commission.chairmanUserId ? (
                      <p className="mt-1">Başkan: <code className="bg-muted px-1 py-0.5 rounded">{commission.chairmanUserId.slice(0, 12)}...</code></p>
                    ) : (
                      <p className="mt-1 text-muted-foreground">Başkan atanmadı</p>
                    )}
                  </div>
                  {commissionMembers.length > 0 && (
                    <div className="rounded-md border border-border text-xs overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border bg-muted/60">
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold">Kullanıcı</th>
                            <th className="px-2 py-1.5 text-left text-[10px] font-semibold">Ünvan</th>
                            <th className="px-2 py-1.5 w-[1%]"> </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {commissionMembers.map((m) => (
                            <tr key={m.id} className="hover:bg-muted/30">
                              <td className="px-2 py-1.5"><code className="bg-muted px-1 py-0.5 rounded text-[10px]">{m.userId.slice(0, 12)}...</code></td>
                              <td className="px-2 py-1.5 text-muted-foreground">{m.title || '—'}</td>
                              <td className="px-2 py-1.5 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => {
                                    // TODO: Remove member
                                  }}
                                >
                                  ✕
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-center text-[11px] text-muted-foreground py-4">Komisyon oluşturulmadı. Oluşturmak için düğmeyi kullanın.</p>
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
                    onClick={() => void generateDoc('teklif_isteme', docVendorId)}
                  >
                    Teklif isteme
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

