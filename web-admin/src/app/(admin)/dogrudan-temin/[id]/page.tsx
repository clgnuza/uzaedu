'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { cn } from '@/lib/utils';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch, isAbortError } from '@/lib/api';
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
  ArchiveRestore,
  Link2,
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SchoolSelectWithFilter } from '@/components/school-select-with-filter';
import {
  DT_DETAIL_TABS,
  DT_INPUT_SM,
  DT_ITEM_UNIT_PRESETS,
  DT_LEGAL_NOTICE,
  DT_SECTION_HINTS,
  DT_SELECT_SM,
  DT_TEXTAREA_SM,
  DT_UNIT_SELECT_CUSTOM,
  type DtDetailTabId,
  dtBudgetBlockStatusHint,
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

type DtTeknikSartnameTableRow = { id: string; name: string; spec: string };
type DtTeknikSartnameDraft = {
  version: 1;
  schoolLine: string;
  docTitle: string;
  s1_title: string;
  s1_1: string;
  s2_title: string;
  s2_idare: string;
  s2_firma: string;
  s3_title: string;
  s3_1: string;
  s4_title: string;
  s4_jobName: string;
  s5_title: string;
  s5_bullets: string[];
  tableTitle: string;
  tableRows: DtTeknikSartnameTableRow[];
  s6_title: string;
  s6_body: string;
  s7_title: string;
  s7_1: string;
  s7_2: string;
  s7_3: string;
  documentDate: string | null;
  firmSignCaption: string;
  schoolStampLine: string;
  schoolTitleLine: string;
  schoolRoleLine: string;
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

type PiyasaArastirmaPreview = {
  file: { id: string; subject: string; procurement_ref: string | null; year: number; file_no: string };
  school_name: string | null;
  onay: { tarih: string; sayi: string };
  items: Array<{ id: string; name: string; spec: string; qty: string; unit: string }>;
  firms: Array<{
    index: number;
    quote_id: string;
    vendor_id: string;
    firm_label: string;
    vendor_title: string;
    complete: boolean;
    total: number | null;
    total_formatted: string | null;
    lines: Array<{
      dt_item_id: string;
      unit_price: number | null;
      unit_price_formatted: string | null;
      line_total: number | null;
      line_total_formatted: string | null;
    }>;
  }>;
  selected: {
    quote_id: string;
    vendor_id: string;
    vendor_title: string;
    address: string;
    total: number;
    total_formatted: string;
    complete: boolean;
  } | null;
  selection_basis: string | null;
  warnings: string[];
};

type YaklasikMaliyetPreview = {
  file: { id: string; subject: string; procurement_ref: string | null; year: number; file_no: string };
  school_name: string | null;
  düzenleme_tarih: string;
  hesaplama_yöntemi: string;
  firms: Array<{
    index: number;
    letter: string;
    quote_id: string;
    vendor_id: string;
    firm_label: string;
    vendor_title: string;
    complete: boolean;
    total: number | null;
    total_formatted: string | null;
  }>;
  items: Array<{
    sort: number;
    id: string;
    name: string;
    spec: string;
    qty: string;
    unit: string;
    avg_unit: number | null;
    avg_line: number | null;
    avg_unit_formatted: string | null;
    avg_line_formatted: string | null;
    firm_lines: Array<{
      quote_id: string;
      unit_price: number | null;
      unit_price_formatted: string | null;
      line_total: number | null;
      line_total_formatted: string | null;
    }>;
  }>;
  grand_approx_total: number;
  grand_approx_formatted: string;
  warnings: string[];
};

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

function newDtTeknikRowId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
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

/** Toplu PDF (ZIP) — sıra ve etiketler kurum şablon ekranıyla uyumlu. */
const DT_BULK_ARCHIVE_UI: Array<{ doc_type: string; label: string; needsVendor: boolean }> = [
  { doc_type: 'ihtiyac_listesi', label: '1-İhtiyaç Listesi Belgesi', needsVendor: false },
  { doc_type: 'teknik_sartname', label: '2-Teknik Şartname', needsVendor: false },
  { doc_type: 'komisyon_onay', label: '3-Komisyon Onay Belgesi', needsVendor: false },
  { doc_type: 'fiyat_arastirmasi', label: '4-Fiyat Araştırma', needsVendor: true },
  { doc_type: 'yaklasik_maliyet_cetveli', label: '5-Yaklaşık Maliyet Belgesi', needsVendor: false },
  { doc_type: 'onay_belgesi', label: '6-İhale Onay Belgesi', needsVendor: false },
  { doc_type: 'teklif_isteme', label: '7-Teklif Mektubu', needsVendor: true },
  { doc_type: 'piyasa_arastirma_tutanagi', label: '8-Piyasa Araştırma Belgesi', needsVendor: false },
  { doc_type: 'muayene_kabul_tutanagi', label: '9-Muayene Kabul Kom. Raporu', needsVendor: false },
  { doc_type: 'teslim_tesellum_tutanagi', label: '10-Teslim/Tesellüm', needsVendor: false },
];

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
  /** null → mevcut sayfa dosyası (`id`); doluysa arşiv satırından kopyalanan kaynak. */
  const [copySourceId, setCopySourceId] = useState<string | null>(null);
  const [copyForm, setCopyForm] = useState({ target_year: '', file_no: '' });
  const [confirmDeleteFileId, setConfirmDeleteFileId] = useState<string | null>(null);
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
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);
  const [bulkArchiveSel, setBulkArchiveSel] = useState<Record<string, boolean>>({});
  const [piyasaPreviewOpen, setPiyasaPreviewOpen] = useState(false);
  const [piyasaPreviewLoading, setPiyasaPreviewLoading] = useState(false);
  const [piyasaPreview, setPiyasaPreview] = useState<PiyasaArastirmaPreview | null>(null);
  const [yaklasikPreviewOpen, setYaklasikPreviewOpen] = useState(false);
  const [yaklasikPreviewLoading, setYaklasikPreviewLoading] = useState(false);
  const [yaklasikPreview, setYaklasikPreview] = useState<YaklasikMaliyetPreview | null>(null);
  const [teknikSartnameOpen, setTeknikSartnameOpen] = useState(false);
  const [teknikSartnameLoading, setTeknikSartnameLoading] = useState(false);
  const [teknikSartnameSaving, setTeknikSartnameSaving] = useState(false);
  const [teknikDraft, setTeknikDraft] = useState<DtTeknikSartnameDraft | null>(null);
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
  const [fileBudgetAccountDraft, setFileBudgetAccountDraft] = useState('');
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
    if (file?.id) setFileBudgetAccountDraft(file.budgetAccountId ?? '');
  }, [file?.id, file?.budgetAccountId]);

  useEffect(() => {
    if (!vendors.length) return;
    setDocVendorId((prev) => {
      if (prev && vendors.some((v) => v.id === prev)) return prev;
      return vendors[0]?.id ?? '';
    });
  }, [vendors]);

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

  const downloadBulkPdfArchive = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    const items = DT_BULK_ARCHIVE_UI.filter((x) => bulkArchiveSel[x.doc_type]).map((x) => ({
      doc_type: x.doc_type,
      ...(x.needsVendor && docVendorId.trim() ? { vendor_id: docVendorId.trim() } : {}),
    }));
    if (!items.length) {
      toast.error('En az bir belge seçin.');
      return;
    }
    // Firma seçimi opsiyonel: seçilmezse şablonda boş alanlarla üretilir.
    setBusy(true);
    setLoadBanner(null);
    try {
      const res = await apiFetch<{ download_url: string }>(
        dtUrl(`/dogrudan-temin/files/${id}/docs/bulk-archive`, me?.role, schoolId),
        {
          token,
          method: 'POST',
          body: JSON.stringify({
            items,
            default_vendor_id: docVendorId.trim() || null,
            archive_format: 'zip',
          }),
        },
      );
      if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
      setBulkArchiveOpen(false);
      toast.success('ZIP indirmesi başlatıldı.');
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [bulkArchiveSel, docVendorId, id, isSuperadmin, me?.role, schoolId, token]);

  const generateTeknikSartnamePdf = useCallback(
    async () => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        const res = await apiFetch<{ download_url: string }>(dtUrl(`/dogrudan-temin/files/${id}/docs/generate`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({ doc_type: 'teknik_sartname', file_format: 'pdf' }),
        });
        if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
        await fetchAll();
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchAll, id, isSuperadmin, me?.role, schoolId, token],
  );

  const saveTeknikSartnameDraft = useCallback(async () => {
    if (!token || !teknikDraft) return;
    if (isSuperadmin && !schoolId) return;
    setTeknikSartnameSaving(true);
    setLoadBanner(null);
    try {
      const res = await apiFetch<{ draft: DtTeknikSartnameDraft }>(
        dtUrl(`/dogrudan-temin/files/${id}/teknik-sartname-draft`, me?.role, schoolId),
        { token, method: 'PUT', body: JSON.stringify({ draft: teknikDraft }) },
      );
      setTeknikDraft(res.draft);
      toast.success('Teknik şartname kaydedildi.');
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setTeknikSartnameSaving(false);
    }
  }, [id, isSuperadmin, me?.role, schoolId, teknikDraft, token]);

  const downloadPiyasaTutanagi = useCallback(
    async (file_format: 'pdf' | 'docx') => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        const res = await apiFetch<{ download_url: string }>(dtUrl(`/dogrudan-temin/files/${id}/docs/generate`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({ doc_type: 'piyasa_arastirma_tutanagi', file_format }),
        });
        if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
        await fetchAll();
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchAll, id, isSuperadmin, me?.role, schoolId, token],
  );

  useEffect(() => {
    if (!piyasaPreviewOpen || !canFetch || !token) return;
    let cancelled = false;
    setPiyasaPreview(null);
    setPiyasaPreviewLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<PiyasaArastirmaPreview>(
          dtUrl(`/dogrudan-temin/files/${id}/piyasa-arastirma-tutanagi-preview`, me?.role, schoolId),
          { token },
        );
        if (!cancelled) setPiyasaPreview(data);
      } catch (e) {
        if (!cancelled && !isAbortError(e)) setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        if (!cancelled) setPiyasaPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [piyasaPreviewOpen, canFetch, id, me?.role, schoolId, token]);

  const downloadYaklasikCetveli = useCallback(
    async (file_format: 'pdf' | 'docx') => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        const res = await apiFetch<{ download_url: string }>(dtUrl(`/dogrudan-temin/files/${id}/docs/generate`, me?.role, schoolId), {
          token,
          method: 'POST',
          body: JSON.stringify({ doc_type: 'yaklasik_maliyet_cetveli', file_format }),
        });
        if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
        await fetchAll();
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchAll, id, isSuperadmin, me?.role, schoolId, token],
  );

  useEffect(() => {
    if (!yaklasikPreviewOpen || !canFetch || !token) return;
    let cancelled = false;
    setYaklasikPreview(null);
    setYaklasikPreviewLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<YaklasikMaliyetPreview>(
          dtUrl(`/dogrudan-temin/files/${id}/yaklasik-maliyet-cetveli-preview`, me?.role, schoolId),
          { token },
        );
        if (!cancelled) setYaklasikPreview(data);
      } catch (e) {
        if (!cancelled && !isAbortError(e)) setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        if (!cancelled) setYaklasikPreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [yaklasikPreviewOpen, canFetch, id, me?.role, schoolId, token]);

  useEffect(() => {
    if (!teknikSartnameOpen || !canFetch || !token) return;
    let cancelled = false;
    setTeknikDraft(null);
    setTeknikSartnameLoading(true);
    void (async () => {
      try {
        const data = await apiFetch<{ draft: DtTeknikSartnameDraft }>(
          dtUrl(`/dogrudan-temin/files/${id}/teknik-sartname-draft`, me?.role, schoolId),
          { token },
        );
        if (!cancelled) setTeknikDraft(data.draft);
      } catch (e) {
        if (!cancelled && !isAbortError(e)) setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        if (!cancelled) setTeknikSartnameLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teknikSartnameOpen, canFetch, id, me?.role, schoolId, token]);

  useEffect(() => {
    if (!yaklasikPreviewOpen && !piyasaPreviewOpen) return;
    const el = document.createElement('style');
    el.setAttribute('data-dt-cetvel-rapor-print', '');
    el.textContent = '@page { size: A4 landscape; margin: 10mm; }';
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [yaklasikPreviewOpen, piyasaPreviewOpen]);

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

  const fetchArchiveList = useCallback(async () => {
    if (!canFetch || !token) return;
    setArchiveListLoading(true);
    try {
      const res = await apiFetch<{ items: DtFileItem[] }>(
        dtUrl('/dogrudan-temin/files?include_archived=1', me?.role, schoolId),
        { token },
      );
      setArchiveList((res.items ?? []).filter((x) => !!x.archivedAt));
    } catch {
      setArchiveList([]);
    } finally {
      setArchiveListLoading(false);
    }
  }, [canFetch, me?.role, schoolId, token]);

  useEffect(() => {
    if (activeTab !== 'archive' || !canFetch || !token) return;
    void fetchArchiveList();
  }, [activeTab, canFetch, fetchArchiveList, token]);

  const copyFile = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    const sourceId = copySourceId ?? id;
    setBusy(true);
    setLoadBanner(null);
    try {
      const res = await apiFetch<{ id: string }>(dtUrl(`/dogrudan-temin/files/${sourceId}/copy`, me?.role, schoolId), {
        token,
        method: 'POST',
        body: JSON.stringify({
          target_year: copyForm.target_year ? Number(copyForm.target_year) : undefined,
          file_no: copyForm.file_no || undefined,
        }),
      });
      setCopyOpen(false);
      setCopySourceId(null);
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
  }, [copyForm.file_no, copyForm.target_year, copySourceId, id, isSuperadmin, me?.role, router, schoolId, token]);

  const unarchiveFileById = useCallback(
    async (fileId: string) => {
      if (!token) return;
      if (isSuperadmin && !schoolId) return;
      setBusy(true);
      setLoadBanner(null);
      try {
        await apiFetch(dtUrl(`/dogrudan-temin/files/${fileId}/unarchive`, me?.role, schoolId), { token, method: 'POST' });
        toast.success('Dosya arşivden çıkarıldı.');
        await fetchArchiveList();
        if (fileId === id) await fetchAll();
      } catch (e) {
        setLoadBanner(dtReadonlyLoadFeedback(e));
      } finally {
        setBusy(false);
      }
    },
    [fetchAll, fetchArchiveList, id, isSuperadmin, me?.role, schoolId, token],
  );

  const deleteDtFileById = useCallback(async () => {
    const targetId = confirmDeleteFileId;
    if (!token || !targetId) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${targetId}`, me?.role, schoolId), { token, method: 'DELETE' });
      setConfirmDeleteFileId(null);
      toast.success('Dosya silindi.');
      if (targetId === id) {
        router.push(
          isSuperadmin && schoolId ? `/dogrudan-temin?school_id=${encodeURIComponent(schoolId)}` : '/dogrudan-temin',
        );
      } else {
        await fetchArchiveList();
        await fetchAll();
      }
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [confirmDeleteFileId, fetchAll, fetchArchiveList, id, isSuperadmin, me?.role, router, schoolId, token]);

  const copyFilePageLink = useCallback(
    async (fileId: string) => {
      try {
        const href =
          isSuperadmin && schoolId
            ? `/dogrudan-temin/${fileId}?school_id=${encodeURIComponent(schoolId)}`
            : `/dogrudan-temin/${fileId}`;
        const abs = typeof window !== 'undefined' ? new URL(href, window.location.origin).toString() : href;
        await navigator.clipboard.writeText(abs);
        toast.success('Bağlantı panoya kopyalandı.');
      } catch {
        toast.error('Panoya kopyalanamadı.');
      }
    },
    [isSuperadmin, schoolId],
  );

  const openCopyDialog = useCallback((sourceFileId: string | null) => {
    setCopySourceId(sourceFileId);
    setCopyOpen(true);
  }, []);

  const deleteTargetLabel = useMemo(() => {
    if (!confirmDeleteFileId) return '';
    if (file && confirmDeleteFileId === file.id) return `${file.year} · #${file.fileNo} — ${file.subject}`;
    const r = archiveList.find((x) => x.id === confirmDeleteFileId);
    return r ? `${r.year} · #${r.fileNo} — ${r.subject}` : confirmDeleteFileId.slice(0, 8);
  }, [archiveList, confirmDeleteFileId, file]);

  const copyDialogSourceLabel = useMemo(() => {
    const sid = copySourceId ?? id;
    if (file && sid === file.id) return `${file.year} · #${file.fileNo} — ${file.subject}`;
    const r = archiveList.find((x) => x.id === sid);
    return r ? `${r.year} · #${r.fileNo} — ${r.subject}` : sid;
  }, [archiveList, copySourceId, file, id]);

  const docsListPdf = useMemo(() => docs.filter((d) => String(d.fileFormat || '').toLowerCase() === 'pdf'), [docs]);
  const docsListWord = useMemo(() => docs.filter((d) => String(d.fileFormat || '').toLowerCase() !== 'pdf'), [docs]);

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

  const saveFileBudgetAccount = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      await apiFetch(dtUrl(`/dogrudan-temin/files/${id}`, me?.role, schoolId), {
        token,
        method: 'PATCH',
        body: JSON.stringify({ budget_account_id: fileBudgetAccountDraft.trim() || null }),
      });
      toast.success('Dosya bütçe hesabı güncellendi.');
      await fetchAll();
    } catch (e) {
      setLoadBanner(dtReadonlyLoadFeedback(e));
    } finally {
      setBusy(false);
    }
  }, [fetchAll, fileBudgetAccountDraft, id, isSuperadmin, me?.role, schoolId, token]);

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

  const paymentTabSummary = useMemo(() => {
    if (!file) {
      return { refTotal: null as number | null, refLabel: '', paidTotal: null as number | null, remaining: null as number | null };
    }
    const paidTotal = dtParseAmount(file.paymentTotal);
    const decision = dtParseAmount(file.decisionTotal);
    const approx = dtParseAmount(file.approxTotal);
    const refTotal = decision ?? approx ?? null;
    const refLabel = decision != null ? 'Karar' : approx != null ? 'Yaklaşık' : '';
    const p = paidTotal ?? 0;
    const remaining = refTotal != null ? Math.max(0, refTotal - p) : null;
    return { refTotal, refLabel, paidTotal, remaining };
  }, [file]);

  const budgetBlockTabSummary = useMemo(() => {
    const blockedRows = budgetBlocks.filter((b) => b.status === 'blocked');
    let totalBlocked = 0;
    for (const b of blockedRows) {
      const n = dtParseAmount(b.amount);
      if (n != null) totalBlocked += n;
    }
    return {
      activeBlocked: blockedRows.length,
      totalRows: budgetBlocks.length,
      totalBlocked,
    };
  }, [budgetBlocks]);

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

  const downloadMysYukleXlsx = useCallback(async () => {
    if (!token) return;
    if (isSuperadmin && !schoolId) return;
    setBusy(true);
    setLoadBanner(null);
    try {
      const res = await apiFetch<{ download_url: string }>(
        dtUrl(`/dogrudan-temin/files/${id}/mys-yukle.xlsx`, me?.role, schoolId),
        { token },
      );
      if (res?.download_url) window.open(res.download_url, '_blank', 'noopener,noreferrer');
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
        onOpenPiyasaPreview={() => {
          setWizardOpen(false);
          setPiyasaPreviewOpen(true);
        }}
        onOpenYaklasikPreview={() => {
          setWizardOpen(false);
          setYaklasikPreviewOpen(true);
        }}
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
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-2"
                  title="Dosyayı kopyala"
                  disabled={busy}
                  onClick={() => openCopyDialog(null)}
                >
                  <Copy className="size-4" />
                </Button>
                <Dialog
                  open={copyOpen}
                  onOpenChange={(o) => {
                    setCopyOpen(o);
                    if (!o) setCopySourceId(null);
                  }}
                >
                  <DialogContent className="max-w-lg" title="Dosyayı kopyala">
                    <p className="text-[11px] text-muted-foreground">
                      Kaynak: <span className="font-medium text-foreground">{copyDialogSourceLabel}</span>
                    </p>
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
                        <Button
                          variant="outline"
                          onClick={() => {
                            setCopyOpen(false);
                            setCopySourceId(null);
                          }}
                          disabled={busy}
                        >
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
            <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-border/40 pt-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[10px] text-muted-foreground">Dosya bütçe hesabı (onay belgesi / tertip)</span>
                <select
                  className="h-9 max-w-[min(100%,420px)] rounded-xl border border-border/70 bg-background px-2 text-xs"
                  value={fileBudgetAccountDraft}
                  onChange={(e) => setFileBudgetAccountDraft(e.target.value)}
                >
                  <option value="">— Seçilmedi —</option>
                  {budgetAccounts
                    .filter((a) => a.year === file.year)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {(a.code ? `${a.code} · ` : '') + a.label} — {dtFormatNumberTr(a.allocated)} ₺
                      </option>
                    ))}
                </select>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" disabled={busy} onClick={() => void saveFileBudgetAccount()}>
                Kaydet
              </Button>
              <Link
                href={dtUrl(
                  `/dogrudan-temin/butce-hierarsisi?year=${encodeURIComponent(String(file.year))}`,
                  me?.role,
                  schoolId,
                )}
                className="text-[10px] font-medium text-primary hover:underline"
              >
                Bütçe tertipleri…
              </Link>
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
                  <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void generateDoc('harcama_talimati')}>
                    <FileDown className="size-3.5 mr-1 inline" />
                    Harcama talimatı (DOCX)
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
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="space-y-3 border-b border-border/70 bg-gradient-to-br from-amber-500/[0.08] via-muted/15 to-transparent py-4 dark:from-amber-950/25">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-amber-600/12 text-amber-800 dark:text-amber-200">
                      <Landmark className="size-4" />
                    </span>
                    Bütçe bloke
                    <DtInfoHint title={DT_SECTION_HINTS.budget} />
                  </CardTitle>
                  <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                    Tertip hesabı seçerek tutar bloke edin; kaldırma tek satır veya toplu yapılabilir. Hesap listesi dosya yılına göre «Bütçe hiyerarşisi» kayıtlarından gelir.
                  </p>
                </div>
                <span className="shrink-0 rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
                  {budgetBlockTabSummary.totalRows} kayıt · {budgetBlockTabSummary.activeBlocked} aktif bloke
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-950 dark:text-amber-100">
                  <span className="text-amber-900/70 dark:text-amber-200/80">Aktif bloke toplamı</span>
                  <span className="font-semibold tabular-nums">{dtFormatNumberTr(budgetBlockTabSummary.totalBlocked)} ₺</span>
                </span>
                {file?.year != null ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/70 px-2.5 py-1 text-[10px]">
                    <span className="text-muted-foreground">Yıl</span>
                    <span className="font-semibold tabular-nums text-foreground">{file.year}</span>
                  </span>
                ) : null}
                {file?.budgetAccountId ? (
                  <span
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky-500/25 bg-sky-500/8 px-2.5 py-1 text-[10px] text-sky-950 dark:text-sky-100"
                    title="Dosyaya atanmış varsayılan bütçe hesabı (üst bölümde değiştirilebilir)."
                  >
                    <span className="shrink-0 text-muted-foreground">Dosya hesabı</span>
                    <span className="truncate font-medium">
                      {(() => {
                        const a = budgetAccounts.find((x) => x.id === file.budgetAccountId);
                        return a ? `${a.code ? `${a.code} · ` : ''}${a.label}` : file.budgetAccountId.slice(0, 8);
                      })()}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border/80 px-2.5 py-1 text-[10px] text-muted-foreground">
                    Dosyada varsayılan bütçe hesabı atanmamış
                  </span>
                )}
              </div>
              {dtRules?.require_budget_account_on_file ? (
                <div className="flex flex-wrap gap-1.5">
                  <span className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-900 dark:text-amber-100">
                    Ödeme / işlemlerde dosya bütçe hesabı zorunlu (kurallar)
                  </span>
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Bütçe tertip hesabı</label>
                    <select
                      value={budgetForm.budget_account_id}
                      onChange={(e) => setBudgetForm((s) => ({ ...s, budget_account_id: e.target.value }))}
                      className={cn(DT_SELECT_SM, 'w-full max-w-xl')}
                    >
                      <option value="">— Hesap seçin —</option>
                      {budgetAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {(a.code ? `${a.code} · ` : '') + a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-end lg:w-auto">
                    <div className="space-y-1.5 sm:min-w-[160px]">
                      <label className="text-[11px] font-medium text-muted-foreground">Bloke tutar (₺)</label>
                      <Input
                        value={budgetForm.amount}
                        onChange={(e) => setBudgetForm((s) => ({ ...s, amount: e.target.value }))}
                        className={cn(DT_INPUT_SM, 'w-full sm:w-[160px]')}
                        placeholder="0,00"
                        inputMode="decimal"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-9"
                        disabled={busy || !budgetForm.budget_account_id || !budgetForm.amount.trim()}
                        onClick={() => void blockBudget()}
                      >
                        Bloke et
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        disabled={busy || budgetBlocks.length === 0}
                        onClick={() => setConfirmReleaseAllOpen(true)}
                      >
                        Tümünü kaldır
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              {budgetBlocks.length ? (
                <div className="table-x-scroll overflow-hidden rounded-lg border border-border text-xs">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Hesap</th>
                        <th className="px-2 py-1.5 text-right">Tutar</th>
                        <th className="px-2 py-1.5">Durum</th>
                        <th className="px-2 py-1.5 w-[1%] whitespace-nowrap">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {budgetBlocks.map((b) => {
                        const acc = budgetAccounts.find((x) => x.id === b.budgetAccountId);
                        const accLabel = acc ? (acc.code ? `${acc.code} · ` : '') + acc.label : b.budgetAccountId.slice(0, 8);
                        return (
                          <tr key={b.id} className="hover:bg-muted/30">
                            <td className="px-2 py-1.5 font-medium">{accLabel}</td>
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-amber-800 dark:text-amber-200">
                              {dtFormatNumberTr(b.amount)} ₺
                            </td>
                            <td className="px-2 py-1.5">
                              <span
                                className="inline-block max-w-[200px] truncate align-middle text-muted-foreground"
                                title={dtBudgetBlockStatusHint(b.status)}
                              >
                                {dtBudgetBlockStatusLabel(b.status)}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8"
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
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 py-10 text-center">
                  <Landmark className="size-8 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground">Henüz bloke kaydı yok.</p>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {activeTab === 'payments' && (
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="space-y-3 border-b border-border/70 bg-gradient-to-br from-emerald-500/[0.07] via-muted/15 to-transparent py-4 dark:from-emerald-950/25">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-600/12 text-emerald-700 dark:text-emerald-300">
                      <Banknote className="size-4" />
                    </span>
                    Ödemeler
                    <DtInfoHint title={DT_SECTION_HINTS.payments} />
                  </CardTitle>
                  <p className="max-w-xl text-[11px] leading-relaxed text-muted-foreground">
                    Ödeme satırı ekleyin; kayıtlı ödemeler için ödeme emri PDF indirilebilir. Üst banttaki ödenen toplam dosya özetiyle güncellenir.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-[10px]"
                    disabled={busy}
                    onClick={() => void downloadMysYukleXlsx()}
                  >
                    <FileDown className="size-3.5" />
                    MYS Excel
                  </Button>
                  <span className="rounded-md border border-border/60 bg-background/80 px-2 py-1 text-[10px] text-muted-foreground">
                    {payments.length} kayıt
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-2.5 py-1 text-[10px] text-emerald-950 dark:text-emerald-100">
                  <span className="text-muted-foreground">Ödenen</span>
                  <span className="font-semibold tabular-nums">{dtFormatNumberTr(file?.paymentTotal)} ₺</span>
                </span>
                {paymentTabSummary.refTotal != null && paymentTabSummary.refLabel ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/70 px-2.5 py-1 text-[10px]">
                    <span className="text-muted-foreground">{paymentTabSummary.refLabel}</span>
                    <span className="font-semibold tabular-nums text-foreground">{dtFormatNumberTr(paymentTabSummary.refTotal)} ₺</span>
                  </span>
                ) : null}
                {paymentTabSummary.remaining != null && paymentTabSummary.refLabel ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] text-amber-950 dark:text-amber-100">
                    <span className="text-amber-900/70 dark:text-amber-200/80">Kalan</span>
                    <span className="font-semibold tabular-nums">{dtFormatNumberTr(paymentTabSummary.remaining)} ₺</span>
                  </span>
                ) : null}
              </div>
              {dtRules ? (
                <div className="flex flex-wrap gap-1.5">
                  {dtRules.require_quote_on_payment ? (
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100">
                      Teklif seçimi zorunlu
                    </span>
                  ) : null}
                  {dtRules.require_award_before_payment ? (
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100">
                      Önce karar gerekli
                    </span>
                  ) : null}
                  {dtRules.require_budget_account_on_file ? (
                    <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:text-emerald-100">
                      Bütçe hesabı zorunlu
                    </span>
                  ) : null}
                  {dtRules.payment_note_min_length > 0 ? (
                    <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                      Not en az {dtRules.payment_note_min_length} karakter
                    </span>
                  ) : null}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-5">
              {dtRules?.require_quote_on_payment && quotes.length === 0 ? (
                <Alert variant="info" message="Ödeme için teklif seçmeniz gerekiyor; önce Teklifler sekmesinde en az bir teklif oluşturun." />
              ) : null}
              <div className="rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Tutar (₺) *</label>
                    <Input
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, amount: e.target.value }))}
                      className={DT_INPUT_SM}
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      İlgili teklif (firma){dtRules?.require_quote_on_payment ? ' *' : ''}
                    </label>
                    <select
                      value={paymentForm.quote_id}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, quote_id: e.target.value }))}
                      className={cn(DT_SELECT_SM, 'w-full')}
                    >
                      <option value="">— Seçin —</option>
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
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Referans / evrak no</label>
                    <Input
                      value={paymentForm.reference_no}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, reference_no: e.target.value }))}
                      className={DT_INPUT_SM}
                      placeholder="Opsiyonel"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Ödeme tarihi</label>
                    <Input
                      type="date"
                      value={paymentForm.paid_at}
                      onChange={(e) => setPaymentForm((s) => ({ ...s, paid_at: e.target.value }))}
                      className={DT_INPUT_SM}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Not{dtRules && dtRules.payment_note_min_length > 0 ? ` (min. ${dtRules.payment_note_min_length} karakter)` : ''}
                  </label>
                  <textarea
                    value={paymentForm.note}
                    onChange={(e) => setPaymentForm((s) => ({ ...s, note: e.target.value }))}
                    className={DT_TEXTAREA_SM}
                    placeholder="Ödeme gerekçesi, onay bilgisi vb."
                    rows={3}
                  />
                </div>
                <Button
                  className="w-full"
                  disabled={
                    busy ||
                    !paymentForm.amount.trim() ||
                    (dtRules?.require_quote_on_payment && (!paymentForm.quote_id.trim() || quotes.length === 0))
                  }
                  onClick={() => void recordPayment()}
                >
                  Ödeme kaydı ekle
                </Button>
              </div>
              {payments.length ? (
                <div className="table-x-scroll overflow-hidden rounded-lg border border-border text-xs">
                  <table className="w-full min-w-[720px] text-left">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-1.5">Tarih</th>
                        <th className="px-2 py-1.5 text-right">Tutar</th>
                        <th className="px-2 py-1.5">Teklif</th>
                        <th className="px-2 py-1.5">Ref.</th>
                        <th className="px-2 py-1.5">Not</th>
                        <th className="px-2 py-1.5 w-[1%] whitespace-nowrap">PDF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payments.map((p) => {
                        const q = p.quoteId ? quotes.find((x) => x.id === p.quoteId) : null;
                        const vn = q ? vendors.find((v) => v.id === q.vendorId)?.title : null;
                        return (
                          <tr key={p.id} className="hover:bg-muted/30">
                            <td className="px-2 py-1.5 whitespace-nowrap font-medium">
                              {p.paidAt ? new Date(p.paidAt).toLocaleDateString('tr-TR') : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                              {dtFormatNumberTr(p.amount)} ₺
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">{vn ?? (p.quoteId ? p.quoteId.slice(0, 8) : '—')}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{p.referenceNo ?? '—'}</td>
                            <td className="max-w-[220px] px-2 py-1.5 text-muted-foreground">
                              <span className="line-clamp-2" title={p.note ?? ''}>
                                {p.note ?? '—'}
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1 px-2"
                                disabled={busy}
                                onClick={() => void downloadPaymentOrderPdf(p.id)}
                                title="Ödeme emri PDF"
                              >
                                <FileDown className="size-3.5" />
                                <span className="hidden sm:inline">PDF</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 py-10 text-center">
                  <Banknote className="size-8 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground">Henüz ödeme kaydı yok.</p>
                </div>
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
          <>
          <Card className="overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="space-y-3 border-b border-border/70 bg-gradient-to-br from-slate-500/[0.07] via-sky-500/[0.05] to-transparent py-4 dark:from-slate-950/40">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-slate-600/12 text-slate-800 dark:text-slate-200">
                      <FileStack className="size-4" />
                    </span>
                    Belgeler
                    <DtInfoHint title={DT_SECTION_HINTS.docs} />
                  </CardTitle>
                  <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                    Önce çıktı biçimini seçin. Oluşturulan dosyalar aşağıda Word ve PDF olarak ayrı listelenir; indirirken uzantıya göre ayırt edebilirsiniz.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 gap-1 border-rose-200/80 bg-rose-500/10 text-rose-900 hover:bg-rose-500/15 dark:border-rose-800/50 dark:text-rose-100"
                  disabled={busy}
                  onClick={() => {
                    setBulkArchiveSel(Object.fromEntries(DT_BULK_ARCHIVE_UI.map((x) => [x.doc_type, false])));
                    setBulkArchiveOpen(true);
                  }}
                >
                  <FileDown className="size-3.5" />
                  Toplu PDF (ZIP)
                </Button>
              </div>
              <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
                <div className="space-y-1.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Çıktı biçimi</div>
                  <div className="inline-flex rounded-xl border border-border/80 bg-muted/30 p-1 shadow-inner">
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:px-4',
                        docFormat === 'docx'
                          ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-500/30 dark:bg-blue-600 dark:text-white'
                          : 'text-muted-foreground hover:bg-background/90',
                      )}
                      onClick={() => setDocFormat('docx')}
                    >
                      <FileText className="size-3.5 shrink-0 opacity-90" />
                      Word
                      <span className="hidden font-normal opacity-90 sm:inline">(.docx)</span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:px-4',
                        docFormat === 'pdf'
                          ? 'bg-rose-600 text-white shadow-md ring-1 ring-rose-500/30 dark:bg-rose-600 dark:text-white'
                          : 'text-muted-foreground hover:bg-background/90',
                      )}
                      onClick={() => setDocFormat('pdf')}
                    >
                      <FileDown className="size-3.5 shrink-0 opacity-90" />
                      PDF
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Seçili:{' '}
                    <span className={cn('font-semibold', docFormat === 'pdf' ? 'text-rose-700 dark:text-rose-300' : 'text-blue-700 dark:text-blue-300')}>
                      {docFormat === 'pdf' ? 'PDF (salt okunur / baskı)' : 'Word (DOCX — düzenlenebilir)'}
                    </span>
                    {docFormat === 'pdf' ? (
                      <span className="text-muted-foreground"> · Sözleşme yalnızca Word ile üretilir.</span>
                    ) : null}
                  </p>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5 lg:max-w-xs">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Firma (şablonda gerekli olanlar)</div>
                  <select
                    value={docVendorId}
                    onChange={(e) => setDocVendorId(e.target.value)}
                    className={cn(DT_SELECT_SM, 'w-full')}
                  >
                    <option value="">— Firma seçin (opsiyonel) —</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-2 border-t border-border/50 pt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Üret ({docFormat === 'pdf' ? 'PDF' : 'Word'})
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" className="h-9 gap-1" disabled={busy} onClick={() => void generateDoc('ihtiyac_listesi')}>
                    İhtiyaç listesi
                    <span
                      className={cn(
                        'ml-0.5 rounded px-1 py-px text-[9px] font-bold uppercase',
                        docFormat === 'pdf' ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-blue-500/15 text-blue-800 dark:text-blue-200',
                      )}
                    >
                      {docFormat === 'pdf' ? 'pdf' : 'docx'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1"
                    disabled={busy}
                    onClick={() => void generateDoc('fiyat_arastirmasi', docVendorId || undefined)}
                  >
                    Fiyat araştırması
                    <span
                      className={cn(
                        'ml-0.5 rounded px-1 py-px text-[9px] font-bold uppercase',
                        docFormat === 'pdf' ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-blue-500/15 text-blue-800 dark:text-blue-200',
                      )}
                    >
                      {docFormat === 'pdf' ? 'pdf' : 'docx'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1"
                    disabled={busy}
                    onClick={() => void generateDoc('teklif_isteme', docVendorId || undefined)}
                  >
                    Teklif mektubu
                    <span
                      className={cn(
                        'ml-0.5 rounded px-1 py-px text-[9px] font-bold uppercase',
                        docFormat === 'pdf' ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-blue-500/15 text-blue-800 dark:text-blue-200',
                      )}
                    >
                      {docFormat === 'pdf' ? 'pdf' : 'docx'}
                    </span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1" disabled={busy} onClick={() => void generateDoc('harcama_talimati')}>
                    Harcama talimatı
                    <span
                      className={cn(
                        'ml-0.5 rounded px-1 py-px text-[9px] font-bold uppercase',
                        docFormat === 'pdf' ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-blue-500/15 text-blue-800 dark:text-blue-200',
                      )}
                    >
                      {docFormat === 'pdf' ? 'pdf' : 'docx'}
                    </span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1"
                    disabled={busy || !docVendorId || docFormat === 'pdf'}
                    title={docFormat === 'pdf' ? 'Sözleşme yalnızca Word (DOCX) olarak üretilir.' : undefined}
                    onClick={() => void generateDoc('sozlesme', docVendorId)}
                  >
                    Sözleşme
                    <span className="ml-0.5 rounded bg-blue-500/15 px-1 py-px text-[9px] font-bold uppercase text-blue-800 dark:text-blue-200">docx</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1" disabled={busy} onClick={() => void generateDoc('komisyon_onay')}>
                    Komisyon onay
                    <span
                      className={cn(
                        'ml-0.5 rounded px-1 py-px text-[9px] font-bold uppercase',
                        docFormat === 'pdf' ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-blue-500/15 text-blue-800 dark:text-blue-200',
                      )}
                    >
                      {docFormat === 'pdf' ? 'pdf' : 'docx'}
                    </span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1" disabled={busy} onClick={() => void generateDoc('onay_belgesi')}>
                    Onay belgesi
                    <span
                      className={cn(
                        'ml-0.5 rounded px-1 py-px text-[9px] font-bold uppercase',
                        docFormat === 'pdf' ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-blue-500/15 text-blue-800 dark:text-blue-200',
                      )}
                    >
                      {docFormat === 'pdf' ? 'pdf' : 'docx'}
                    </span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" disabled={busy} onClick={() => setPiyasaPreviewOpen(true)}>
                    Piyasa tutanağı
                    <span className="ml-1 text-[9px] font-normal text-muted-foreground">(PDF/DOCX seçenekleri içeride)</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" disabled={busy} onClick={() => setYaklasikPreviewOpen(true)}>
                    Yaklaşık maliyet cetveli
                    <span className="ml-1 text-[9px] font-normal text-muted-foreground">(PDF/DOCX içeride)</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1" disabled={busy} onClick={() => void generateDoc('muayene_kabul_tutanagi')}>
                    Muayene kabul
                    <span
                      className={cn(
                        'ml-0.5 rounded px-1 py-px text-[9px] font-bold uppercase',
                        docFormat === 'pdf' ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-blue-500/15 text-blue-800 dark:text-blue-200',
                      )}
                    >
                      {docFormat === 'pdf' ? 'pdf' : 'docx'}
                    </span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" disabled={busy} onClick={() => setTeknikSartnameOpen(true)}>
                    Teknik şartname
                    <span className="ml-1 text-[9px] font-normal text-muted-foreground">(PDF)</span>
                  </Button>
                  <Button variant="outline" size="sm" className="h-9 gap-1" disabled={busy} onClick={() => void generateDoc('teslim_tesellum_tutanagi')}>
                    Teslim/tesellüm
                    <span
                      className={cn(
                        'ml-0.5 rounded px-1 py-px text-[9px] font-bold uppercase',
                        docFormat === 'pdf' ? 'bg-rose-500/15 text-rose-800 dark:text-rose-200' : 'bg-blue-500/15 text-blue-800 dark:text-blue-200',
                      )}
                    >
                      {docFormat === 'pdf' ? 'pdf' : 'docx'}
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-4 sm:p-5">
              {docs.length ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-blue-500/25 pb-1">
                      <FileText className="size-3.5 text-blue-600 dark:text-blue-400" />
                      <span className="text-[11px] font-semibold text-blue-900 dark:text-blue-100">Word belgeleri (.docx)</span>
                      <span className="text-[10px] text-muted-foreground">({docsListWord.length})</span>
                    </div>
                    {docsListWord.length ? (
                      <div className="table-x-scroll overflow-hidden rounded-lg border border-blue-500/20 text-xs">
                        <table className="w-full min-w-[640px] text-left">
                          <thead>
                            <tr className="border-b border-border bg-blue-500/8 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <th className="px-2 py-1.5">Tür</th>
                              <th className="px-2 py-1.5">Dosya adı</th>
                              <th className="px-2 py-1.5 w-[1%] whitespace-nowrap">İndir</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {docsListWord.map((d) => (
                              <tr key={d.id} className="hover:bg-blue-500/5">
                                <td className="px-2 py-1.5">{dtDocTypeLabel(d.docType)}</td>
                                <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{d.filename}</td>
                                <td className="px-2 py-1.5 text-right">
                                  <Button variant="outline" size="sm" className="h-8 gap-1" disabled={busy} onClick={() => void downloadDoc(d.id)}>
                                    <FileText className="size-3.5 text-blue-600 dark:text-blue-400" />
                                    DOCX
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-blue-500/20 py-4 text-center text-[11px] text-muted-foreground">
                        Henüz Word çıktısı yok.
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 border-b border-rose-500/25 pb-1">
                      <FileDown className="size-3.5 text-rose-600 dark:text-rose-400" />
                      <span className="text-[11px] font-semibold text-rose-900 dark:text-rose-100">PDF belgeleri</span>
                      <span className="text-[10px] text-muted-foreground">({docsListPdf.length})</span>
                    </div>
                    {docsListPdf.length ? (
                      <div className="table-x-scroll overflow-hidden rounded-lg border border-rose-500/20 text-xs">
                        <table className="w-full min-w-[640px] text-left">
                          <thead>
                            <tr className="border-b border-border bg-rose-500/8 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              <th className="px-2 py-1.5">Tür</th>
                              <th className="px-2 py-1.5">Dosya adı</th>
                              <th className="px-2 py-1.5 w-[1%] whitespace-nowrap">İndir</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {docsListPdf.map((d) => (
                              <tr key={d.id} className="hover:bg-rose-500/5">
                                <td className="px-2 py-1.5">{dtDocTypeLabel(d.docType)}</td>
                                <td className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">{d.filename}</td>
                                <td className="px-2 py-1.5 text-right">
                                  <Button variant="outline" size="sm" className="h-8 gap-1 border-rose-200/80 dark:border-rose-800/50" disabled={busy} onClick={() => void downloadDoc(d.id)}>
                                    <FileDown className="size-3.5 text-rose-600 dark:text-rose-400" />
                                    PDF
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-rose-500/20 py-4 text-center text-[11px] text-muted-foreground">
                        Henüz PDF çıktısı yok.
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 py-10 text-center">
                  <FileStack className="size-8 text-muted-foreground/40" />
                  <p className="text-[11px] text-muted-foreground">Henüz üretilmiş belge yok. Yukarıdan biçim seçip şablon oluşturun.</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Dialog open={bulkArchiveOpen} onOpenChange={setBulkArchiveOpen}>
            <DialogContent className="max-w-lg" title="Toplu PDF (ZIP)">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                PDF olarak kaydetmek istediğiniz sayfaları seçin
              </p>
              <p className="text-[10px] text-muted-foreground">
                Seçtikleriniz PDF üretilir ve tek ZIP dosyasında indirilir. Fiyat araştırması ve teklif mektubu için üstteki firma seçimi kullanılır.
              </p>
              <div className="max-h-[min(52vh,340px)] space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                {DT_BULK_ARCHIVE_UI.map((row) => (
                  <label
                    key={row.doc_type}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
                  >
                    <span>{row.label}</span>
                    <input
                      type="checkbox"
                      className="size-4 rounded border-input"
                      checked={!!bulkArchiveSel[row.doc_type]}
                      onChange={(e) => setBulkArchiveSel((s) => ({ ...s, [row.doc_type]: e.target.checked }))}
                    />
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">RAR arşivi sunucuda üretilmez; yalnızca ZIP kullanılır.</p>
              <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setBulkArchiveOpen(false)}>
                  Vazgeç
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-rose-600 text-white hover:bg-rose-700"
                  disabled={busy}
                  onClick={() => void downloadBulkPdfArchive()}
                >
                  ZIP indir
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={teknikSartnameOpen} onOpenChange={setTeknikSartnameOpen}>
            <DialogContent className="max-w-3xl max-h-[92vh] gap-3 overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-sm">Teknik şartname</DialogTitle>
              </DialogHeader>
              {teknikSartnameLoading || !teknikDraft ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <div className="text-[10px] font-medium text-muted-foreground">Okul satırı</div>
                      <Input
                        className={DT_INPUT_SM}
                        value={teknikDraft.schoolLine}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, schoolLine: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-muted-foreground">Belge başlığı</div>
                      <Input
                        className={DT_INPUT_SM}
                        value={teknikDraft.docTitle}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, docTitle: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-muted-foreground">Belge tarihi (PDF)</div>
                      <Input
                        className={DT_INPUT_SM}
                        type="date"
                        value={teknikDraft.documentDate ?? ''}
                        onChange={(e) =>
                          setTeknikDraft({ ...teknikDraft, documentDate: e.target.value.trim() || null })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">{teknikDraft.s1_title}</div>
                    <textarea
                      className={DT_TEXTAREA_SM}
                      rows={3}
                      value={teknikDraft.s1_1}
                      onChange={(e) => setTeknikDraft({ ...teknikDraft, s1_1: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <div className="text-[10px] font-medium text-muted-foreground">{teknikDraft.s2_title}</div>
                      <textarea
                        className={DT_TEXTAREA_SM}
                        rows={2}
                        value={teknikDraft.s2_idare}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, s2_idare: e.target.value })}
                      />
                      <textarea
                        className={DT_TEXTAREA_SM}
                        rows={2}
                        value={teknikDraft.s2_firma}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, s2_firma: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">{teknikDraft.s3_title}</div>
                    <textarea
                      className={DT_TEXTAREA_SM}
                      rows={3}
                      value={teknikDraft.s3_1}
                      onChange={(e) => setTeknikDraft({ ...teknikDraft, s3_1: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1 sm:col-span-2">
                      <div className="text-[10px] font-medium text-muted-foreground">{teknikDraft.s4_title}</div>
                      <Input
                        className={DT_INPUT_SM}
                        value={teknikDraft.s4_jobName}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, s4_jobName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">{teknikDraft.s5_title} (satır başına bir madde)</div>
                    <textarea
                      className={DT_TEXTAREA_SM}
                      rows={7}
                      value={teknikDraft.s5_bullets.join('\n')}
                      onChange={(e) =>
                        setTeknikDraft({
                          ...teknikDraft,
                          s5_bullets: e.target.value
                            .split(/\n+/)
                            .map((s) => s.replace(/^\s*[*•-]\s*/, '').trim())
                            .filter(Boolean),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">Tablo başlığı</div>
                    <Input
                      className={DT_INPUT_SM}
                      value={teknikDraft.tableTitle}
                      onChange={(e) => setTeknikDraft({ ...teknikDraft, tableTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 rounded border border-border p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Kalem tablosu
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-[10px]"
                        onClick={() =>
                          setTeknikDraft({
                            ...teknikDraft,
                            tableRows: [...teknikDraft.tableRows, { id: newDtTeknikRowId(), name: '', spec: '' }],
                          })
                        }
                      >
                        Satır ekle
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {teknikDraft.tableRows.map((r, idx) => (
                        <div key={r.id} className="grid gap-1 sm:grid-cols-[1fr_1.4fr_auto] sm:items-start">
                          <div className="space-y-0.5">
                            <div className="text-[9px] text-muted-foreground">Mal ({idx + 1})</div>
                            <Input
                              className={DT_INPUT_SM}
                              value={r.name}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTeknikDraft({
                                  ...teknikDraft,
                                  tableRows: teknikDraft.tableRows.map((x) => (x.id === r.id ? { ...x, name: v } : x)),
                                });
                              }}
                            />
                          </div>
                          <div className="space-y-0.5">
                            <div className="text-[9px] text-muted-foreground">Teknik özellik</div>
                            <textarea
                              className={DT_TEXTAREA_SM}
                              rows={2}
                              value={r.spec}
                              onChange={(e) => {
                                const v = e.target.value;
                                setTeknikDraft({
                                  ...teknikDraft,
                                  tableRows: teknikDraft.tableRows.map((x) => (x.id === r.id ? { ...x, spec: v } : x)),
                                });
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 text-[10px] sm:mt-4"
                            disabled={teknikDraft.tableRows.length <= 1}
                            onClick={() =>
                              setTeknikDraft({
                                ...teknikDraft,
                                tableRows: teknikDraft.tableRows.filter((x) => x.id !== r.id),
                              })
                            }
                          >
                            Sil
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">{teknikDraft.s6_title}</div>
                    <textarea
                      className={DT_TEXTAREA_SM}
                      rows={3}
                      value={teknikDraft.s6_body}
                      onChange={(e) => setTeknikDraft({ ...teknikDraft, s6_body: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="text-[10px] font-medium text-muted-foreground">{teknikDraft.s7_title}</div>
                    <textarea
                      className={DT_TEXTAREA_SM}
                      rows={2}
                      value={teknikDraft.s7_1}
                      onChange={(e) => setTeknikDraft({ ...teknikDraft, s7_1: e.target.value })}
                    />
                    <textarea
                      className={DT_TEXTAREA_SM}
                      rows={2}
                      value={teknikDraft.s7_2}
                      onChange={(e) => setTeknikDraft({ ...teknikDraft, s7_2: e.target.value })}
                    />
                    <textarea
                      className={DT_TEXTAREA_SM}
                      rows={2}
                      value={teknikDraft.s7_3}
                      onChange={(e) => setTeknikDraft({ ...teknikDraft, s7_3: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-muted-foreground">Firma imza başlığı</div>
                      <Input
                        className={DT_INPUT_SM}
                        value={teknikDraft.firmSignCaption}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, firmSignCaption: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-muted-foreground">Okul damga satırı</div>
                      <Input
                        className={DT_INPUT_SM}
                        value={teknikDraft.schoolStampLine}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, schoolStampLine: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-muted-foreground">Okul unvan satırı</div>
                      <Input
                        className={DT_INPUT_SM}
                        value={teknikDraft.schoolTitleLine}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, schoolTitleLine: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-muted-foreground">Okul rol satırı</div>
                      <Input
                        className={DT_INPUT_SM}
                        value={teknikDraft.schoolRoleLine}
                        onChange={(e) => setTeknikDraft({ ...teknikDraft, schoolRoleLine: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setTeknikSartnameOpen(false)}>
                      Kapat
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={teknikSartnameSaving || busy}
                      onClick={() => void saveTeknikSartnameDraft()}
                    >
                      Kaydet
                    </Button>
                    <Button type="button" size="sm" disabled={busy} onClick={() => void generateTeknikSartnamePdf()}>
                      PDF indir
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={piyasaPreviewOpen} onOpenChange={setPiyasaPreviewOpen}>
            <DialogContent className="dt-piyasa-tutanak-rapor max-w-[min(1400px,99vw)] max-h-[92vh] flex flex-col gap-3 overflow-hidden print:max-h-none print:max-w-none print:overflow-visible print:shadow-none">
              <DialogHeader>
                <DialogTitle className="text-sm">Piyasa fiyat araştırma tutanağı — önizleme</DialogTitle>
              </DialogHeader>
              {piyasaPreviewLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : piyasaPreview ? (
                <>
                  {piyasaPreview.warnings?.length ? (
                    <Alert variant="warning">
                      {piyasaPreview.warnings.map((w) => (
                        <p key={w} className="text-xs">
                          {w}
                        </p>
                      ))}
                    </Alert>
                  ) : null}
                  <div className="min-h-0 flex-1 overflow-auto rounded border border-border">
                    {piyasaPreview.firms.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">Araştırma teklifi yok.</p>
                    ) : (
                      <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
                        <thead>
                          <tr className="border-b bg-muted/50 font-semibold">
                            <th className="border px-1 py-1">#</th>
                            <th className="border px-1 py-1">Kalem</th>
                            <th className="border px-1 py-1">Mik.</th>
                            {piyasaPreview.firms.map((f) => (
                              <th key={f.quote_id} className="border px-1 py-1 text-center" colSpan={2}>
                                {f.firm_label} — {f.vendor_title}
                                {!f.complete ? ' (eksik)' : ''}
                              </th>
                            ))}
                          </tr>
                          <tr className="border-b bg-muted/30 text-[10px]">
                            <th className="border px-1 py-0.5" colSpan={3} />
                            {piyasaPreview.firms.map((f) => (
                              <Fragment key={f.quote_id}>
                                <th className="border px-1 py-0.5">Birim</th>
                                <th className="border px-1 py-0.5">Toplam</th>
                              </Fragment>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {piyasaPreview.items.map((it, idx) => (
                            <tr key={it.id} className="border-b border-border/80">
                              <td className="border px-1 py-0.5">{idx + 1}</td>
                              <td className="border px-1 py-0.5">{it.name}</td>
                              <td className="border px-1 py-0.5 whitespace-nowrap">{it.qty}</td>
                              {piyasaPreview.firms.map((f) => {
                                const ln = f.lines.find((l) => l.dt_item_id === it.id);
                                return (
                                  <Fragment key={f.quote_id}>
                                    <td className="border px-1 py-0.5 text-right whitespace-nowrap">
                                      {ln?.unit_price_formatted ?? '—'}
                                    </td>
                                    <td className="border px-1 py-0.5 text-right whitespace-nowrap">
                                      {ln?.line_total_formatted ?? '—'}
                                    </td>
                                  </Fragment>
                                );
                              })}
                            </tr>
                          ))}
                          <tr className="bg-muted/40 font-medium">
                            <td className="border px-1 py-1" colSpan={3}>
                              TOPLAM TEKLİF (KDV hariç)
                            </td>
                            {piyasaPreview.firms.map((f) => (
                              <Fragment key={f.quote_id}>
                                <td className="border px-1 py-1" />
                                <td className="border px-1 py-1 text-right whitespace-nowrap">{f.total_formatted ?? '—'}</td>
                              </Fragment>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                  {piyasaPreview.selected ? (
                    <div className="rounded border bg-muted/20 p-2 text-xs space-y-1">
                      <p className="font-semibold">
                        Seçilen: {piyasaPreview.selected.vendor_title} — {piyasaPreview.selected.total_formatted}
                        {piyasaPreview.selection_basis ? ` (${piyasaPreview.selection_basis})` : ''}
                      </p>
                      {piyasaPreview.selected.address ? (
                        <p className="text-muted-foreground">{piyasaPreview.selected.address}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2 border-t pt-2">
                    <Button size="sm" disabled={busy} onClick={() => void downloadPiyasaTutanagi('pdf')}>
                      PDF indir
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void downloadPiyasaTutanagi('docx')}>
                      DOCX indir
                    </Button>
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
          <Dialog open={yaklasikPreviewOpen} onOpenChange={setYaklasikPreviewOpen}>
            <DialogContent className="dt-yaklasik-cetvel-rapor max-w-[min(1400px,99vw)] max-h-[92vh] flex flex-col gap-3 overflow-hidden print:max-h-none print:max-w-none print:overflow-visible print:shadow-none">
              <DialogHeader>
                <DialogTitle className="text-sm">Yaklaşık maliyet cetveli — önizleme</DialogTitle>
              </DialogHeader>
              {yaklasikPreviewLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : yaklasikPreview ? (
                <>
                  <p className="text-[11px] text-muted-foreground leading-snug">{yaklasikPreview.hesaplama_yöntemi}</p>
                  {yaklasikPreview.warnings?.length ? (
                    <Alert variant="warning">
                      {yaklasikPreview.warnings.map((w) => (
                        <p key={w} className="text-xs">
                          {w}
                        </p>
                      ))}
                    </Alert>
                  ) : null}
                  <div className="text-xs rounded border bg-muted/20 px-2 py-1.5">
                    <span className="font-semibold">Düzenleme tarihi: </span>
                    {yaklasikPreview.düzenleme_tarih}
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto rounded border border-border print:max-h-none print:overflow-visible">
                    {yaklasikPreview.firms.length === 0 ? (
                      <p className="p-3 text-xs text-muted-foreground">Araştırma teklifi yok.</p>
                    ) : (
                      <table className="w-full min-w-[760px] border-collapse text-left text-[11px] print:min-w-0">
                        <thead>
                          <tr className="border-b bg-muted/50 font-semibold">
                            <th className="border px-1 py-1">#</th>
                            <th className="border px-1 py-1">Kalem</th>
                            <th className="border px-1 py-1">Özellik</th>
                            <th className="border px-1 py-1">Mik.</th>
                            <th className="border px-1 py-1">Birim</th>
                            {yaklasikPreview.firms.map((f) => (
                              <th key={f.quote_id} className="border px-1 py-1 text-center" colSpan={2}>
                                {f.letter}. {f.vendor_title}
                                {!f.complete ? ' (eksik)' : ''}
                              </th>
                            ))}
                            <th className="border px-1 py-1 text-center" colSpan={2}>
                              İdare yaklaşık (KDV hariç)
                            </th>
                          </tr>
                          <tr className="border-b bg-muted/30 text-[10px]">
                            <th className="border px-1 py-0.5" colSpan={5} />
                            {yaklasikPreview.firms.map((f) => (
                              <Fragment key={f.quote_id}>
                                <th className="border px-1 py-0.5">Birim</th>
                                <th className="border px-1 py-0.5">Toplam</th>
                              </Fragment>
                            ))}
                            <th className="border px-1 py-0.5">Birim ort.</th>
                            <th className="border px-1 py-0.5">Satır</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yaklasikPreview.items.map((it) => (
                            <tr key={it.id} className="border-b border-border/80">
                              <td className="border px-1 py-0.5">{it.sort}</td>
                              <td className="border px-1 py-0.5">{it.name}</td>
                              <td className="border px-1 py-0.5">{it.spec}</td>
                              <td className="border px-1 py-0.5 whitespace-nowrap">{it.qty}</td>
                              <td className="border px-1 py-0.5">{it.unit}</td>
                              {yaklasikPreview.firms.map((f, fi) => {
                                const ln = it.firm_lines[fi];
                                return (
                                  <Fragment key={f.quote_id}>
                                    <td className="border px-1 py-0.5 text-right whitespace-nowrap">
                                      {ln?.unit_price_formatted ?? '—'}
                                    </td>
                                    <td className="border px-1 py-0.5 text-right whitespace-nowrap">
                                      {ln?.line_total_formatted ?? '—'}
                                    </td>
                                  </Fragment>
                                );
                              })}
                              <td className="border px-1 py-0.5 text-right whitespace-nowrap">
                                {it.avg_unit_formatted ?? '—'}
                              </td>
                              <td className="border px-1 py-0.5 text-right whitespace-nowrap">
                                {it.avg_line_formatted ?? '—'}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-muted/40 font-medium">
                            <td className="border px-1 py-1" colSpan={5}>
                              TOPLAM (KDV hariç)
                            </td>
                            {yaklasikPreview.firms.map((f) => (
                              <Fragment key={f.quote_id}>
                                <td className="border px-1 py-1" />
                                <td className="border px-1 py-1 text-right whitespace-nowrap">{f.total_formatted ?? '—'}</td>
                              </Fragment>
                            ))}
                            <td className="border px-1 py-1" />
                            <td className="border px-1 py-1 text-right whitespace-nowrap">
                              {yaklasikPreview.grand_approx_formatted}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 border-t pt-2">
                    <Button size="sm" disabled={busy} onClick={() => void downloadYaklasikCetveli('pdf')}>
                      PDF indir
                    </Button>
                    <Button size="sm" disabled={busy} onClick={() => void downloadYaklasikCetveli('docx')}>
                      DOCX indir
                    </Button>
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
          </>
          )}

          {activeTab === 'archive' && (
            <Card className="overflow-hidden border-border/80 shadow-sm">
              <CardHeader className="space-y-3 border-b border-border/70 bg-gradient-to-br from-rose-500/[0.08] via-muted/15 to-transparent py-4 dark:from-rose-950/25">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-rose-600/12 text-rose-800 dark:text-rose-200">
                        <FolderArchive className="size-4" />
                      </span>
                      Arşiv ve paylaşım
                      <DtInfoHint title={DT_SECTION_HINTS.archive} />
                    </CardTitle>
                    <p className="max-w-2xl text-[11px] leading-relaxed text-muted-foreground">
                      Bu dosyayı arşivleyin veya arşivden çıkarın; bağlantı paylaşın veya kopyalayın. Aşağıdaki tabloda okul arşivindeki dosyalar için açma, kopyalama, bağlantı, arşivden çıkarma ve silme işlemleri yapılabilir.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 gap-1"
                    disabled={busy || archiveListLoading}
                    onClick={() => void fetchArchiveList()}
                  >
                    Listeyi yenile
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-4 sm:p-5">
                {file.archivedAt ? (
                  <Alert
                    variant="warning"
                    message="Bu kayıt arşivde. Varsayılan dosya listesinde gizlenir; arşiv filtresiyle erişilir."
                  />
                ) : (
                  <div className="rounded-xl border border-border/70 bg-muted/15 px-3 py-2 text-[11px] text-muted-foreground">
                    Dosyayı arşivlediğinizde varsayılan listeden kalkar; buradan geri alabilir, kopyalayabilir veya silebilirsiniz.
                  </div>
                )}
                <div className="rounded-xl border border-border/70 bg-muted/10 p-3 sm:p-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Bu dosya</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {file.archivedAt ? (
                      <Button type="button" size="sm" variant="default" disabled={busy} onClick={() => void unarchive()}>
                        <ArchiveRestore className="mr-1 size-3.5" /> Arşivden çıkar
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setConfirmArchiveOpen(true)}>
                        <Archive className="mr-1 size-3.5" /> Arşivle
                      </Button>
                    )}
                    <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => openCopyDialog(null)}>
                      <Copy className="mr-1 size-3.5" /> Kopyala
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void copyShareLink()}>
                      <Share2 className="mr-1 size-3.5" /> Bağlantı kopyala
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={mailShareLink}>
                      <Mail className="mr-1 size-3.5" /> E-posta
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setConfirmDeleteFileId(id)}>
                      <Trash2 className="mr-1 size-3.5" /> Sil
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setActiveTab('registry')}>
                      Evrak
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setActiveTab('items')}>
                      Kalemler
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold text-foreground">Okul arşivindeki dosyalar</div>
                    <span className="text-[10px] text-muted-foreground">{archiveList.length} kayıt</span>
                  </div>
                  {archiveListLoading ? (
                    <LoadingSpinner label="Arşiv yükleniyor…" className="py-8 text-xs" />
                  ) : archiveList.length ? (
                    <div className="table-x-scroll max-h-[min(55vh,420px)] overflow-auto rounded-lg border border-border text-xs">
                      <table className="w-full min-w-[720px] text-left">
                        <thead className="sticky top-0 z-[1] border-b border-border bg-muted/90 backdrop-blur-sm">
                          <tr className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-1.5">Yıl / No</th>
                            <th className="px-2 py-1.5">Konu</th>
                            <th className="px-2 py-1.5 whitespace-nowrap">Arşiv</th>
                            <th className="px-2 py-1.5 text-right">İşlemler</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {archiveList.map((a) => {
                            const href =
                              isSuperadmin && schoolId
                                ? `/dogrudan-temin/${a.id}?school_id=${encodeURIComponent(schoolId)}`
                                : `/dogrudan-temin/${a.id}`;
                            const arch = a.archivedAt ? new Date(a.archivedAt).toLocaleDateString('tr-TR') : '—';
                            return (
                              <tr key={a.id} className={a.id === id ? 'bg-rose-500/10' : 'hover:bg-muted/30'}>
                                <td className="px-2 py-1.5 whitespace-nowrap font-medium">
                                  {a.year} · #{a.fileNo}
                                </td>
                                <td className="max-w-[280px] px-2 py-1.5">
                                  <span className="line-clamp-2" title={a.subject}>
                                    {a.subject}
                                  </span>
                                </td>
                                <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">{arch}</td>
                                <td className="px-2 py-1.5">
                                  <div className="flex flex-wrap justify-end gap-1">
                                    <Button type="button" variant="outline" size="sm" className="h-7 px-2" asChild>
                                      <Link href={href}>Aç</Link>
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2"
                                      disabled={busy}
                                      title="Kopyala"
                                      onClick={() => openCopyDialog(a.id)}
                                    >
                                      <Copy className="size-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2"
                                      disabled={busy}
                                      title="Bağlantıyı kopyala"
                                      onClick={() => void copyFilePageLink(a.id)}
                                    >
                                      <Link2 className="size-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2"
                                      disabled={busy}
                                      title="Arşivden çıkar"
                                      onClick={() => void unarchiveFileById(a.id)}
                                    >
                                      <ArchiveRestore className="size-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 border-destructive/40 px-2 text-destructive hover:bg-destructive/10"
                                      disabled={busy}
                                      title="Dosyayı sil"
                                      onClick={() => setConfirmDeleteFileId(a.id)}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/80 py-10 text-center">
                      <FolderArchive className="size-8 text-muted-foreground/40" />
                      <p className="text-[11px] text-muted-foreground">Arşivde dosya yok.</p>
                    </div>
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

      <Dialog open={confirmDeleteFileId !== null} onOpenChange={(o) => !o && setConfirmDeleteFileId(null)}>
        <DialogContent title="Dosyayı sil">
          <p className="text-sm text-muted-foreground">
            Bu işlem geri alınamaz. İlgili kalemler, teklifler ve kayıtlar kurallara göre silinir veya engellenirse API hata döner.
          </p>
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1.5 text-xs font-medium text-destructive">{deleteTargetLabel}</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setConfirmDeleteFileId(null)} disabled={busy}>
              Vazgeç
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void deleteDtFileById()}>
              Sil
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

